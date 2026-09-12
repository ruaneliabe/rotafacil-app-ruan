import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, OPERATIONAL_EPOCH, STORE_LOCATION } from './support/fixture';
import { hashPassword } from '../../src/lib/passwordSecurity';
import { getBrazilDateKey, isOrderInCurrentShift } from '../../src/utils/dateUtils';

const BASE_URL = process.env.E2E_BASE_URL || 'https://rotafacil-app-ruan.onrender.com';
const RUN_ID = String(process.env.GITHUB_RUN_ID || Date.now()).replace(/[^0-9A-Za-z_-]/g, '');
const DURATION_MINUTES = Math.max(10, Number(process.env.LIVE_TEST_DURATION_MINUTES || 120));
const TICK_MS = Math.max(5000, Number(process.env.LIVE_TEST_TICK_MS || 15000));
const GPS_INTERVAL_MS = Math.max(30000, Number(process.env.LIVE_TEST_GPS_INTERVAL_MS || 60000));
const DRIVER_COUNT = Math.max(1, Number(process.env.LIVE_TEST_DRIVER_COUNT || 20));
const MAX_ORDERS = Math.max(1, Number(process.env.LIVE_TEST_MAX_ORDERS || 60));
const ORDER_PREFIX = `pw_live_${RUN_ID}_order_`;
const DRIVER_PREFIX = `pw_live_${RUN_ID}_driver_`;
const STORE_USER = `pw_live_${RUN_ID}_store`.toLowerCase();
const STORE_PASS = 'PwLiveShadow1234';
const DRIVER_PASS = 'PwLiveDriver1234';
const READY_DELAY_MS = 20_000;
const PICKUP_DELAY_MS = 15_000;
const RETURN_STEPS = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const terminalSourceStatuses = new Set(['delivered', 'closed', 'completed', 'finalized', 'concluded', 'cancelled', 'canceled', 'rejected']);

type ShadowOrder = {
  id: string;
  sourceId: string;
  clientName: string;
  trackingCode: string;
  lat: number;
  lng: number;
  createdAtMs: number;
  state: 'pending' | 'ready' | 'assigned' | 'in_transit' | 'delivered';
  driverId?: string;
  routeSequence?: number;
};

type DriverRuntime = {
  id: string;
  name: string;
  joinedQueueAt: number;
  phase: 'available' | 'called' | 'delivering' | 'returning';
  routeOrderIds: string[];
  deliveryIndex: number;
  phaseStartedAt: number;
  lastGpsAt: number;
  returnStep: number;
  cycles: number;
};

type Telemetry = {
  startedAt: string;
  finishedAt?: string;
  sourceSeen: number;
  shadowsCreated: number;
  delivered: number;
  dispatches: number;
  driverReturns: number;
  maxBusyDrivers: number;
  events: Array<{ at: string; type: string; data?: Record<string, unknown> }>;
};

function logEvent(telemetry: Telemetry, type: string, data?: Record<string, unknown>) {
  const row = { at: new Date().toISOString(), type, data };
  telemetry.events.push(row);
  console.log(`[PW-LIVE][${type}]${data ? ` ${JSON.stringify(data)}` : ''}`);
}

function assertSafeOrderId(id: string) {
  expect(id.startsWith(ORDER_PREFIX), `BLOQUEADO: tentativa de alterar pedido real ${id}`).toBe(true);
}

function assertSafeDriverId(id: string) {
  expect(id.startsWith(DRIVER_PREFIX), `BLOQUEADO: tentativa de alterar motoboy real ${id}`).toBe(true);
}

async function writeShadowOrder(id: string, patch: Record<string, unknown>) {
  assertSafeOrderId(id);
  await setDoc(doc(db, 'orders', id), {
    ...patch,
    isPlaywrightTest: true,
    liveShadowRunId: RUN_ID,
    operationalEpoch: OPERATIONAL_EPOCH,
  }, { merge: true });
}

async function writeShadowDriver(id: string, patch: Record<string, unknown>) {
  assertSafeDriverId(id);
  await setDoc(doc(db, 'motoboys', id), {
    ...patch,
    isPlaywrightTest: true,
    liveShadowRunId: RUN_ID,
    operationalEpoch: OPERATIONAL_EPOCH,
  }, { merge: true });
}

async function seedStoreAndDrivers(): Promise<DriverRuntime[]> {
  const storeCredential = await hashPassword(STORE_PASS);
  await setDoc(doc(db, 'stores', STORE_USER), {
    id: STORE_USER,
    username: STORE_USER,
    passwordHash: storeCredential.hash,
    passwordSalt: storeCredential.salt,
    storeName: `PW LIVE SHADOW ${RUN_ID}`,
    isPlaywrightTest: true,
    liveShadowRunId: RUN_ID,
    createdAt: Date.now(),
  }, { merge: true });

  const drivers: DriverRuntime[] = [];
  for (let i = 0; i < DRIVER_COUNT; i += 1) {
    const id = `${DRIVER_PREFIX}${String(i + 1).padStart(2, '0')}`;
    const name = `PW LIVE Motoboy ${String(i + 1).padStart(2, '0')}`;
    const credential = await hashPassword(DRIVER_PASS);
    const joinedQueueAt = Date.now() + i;
    await writeShadowDriver(id, {
      id,
      username: id,
      passwordHash: credential.hash,
      passwordSalt: credential.salt,
      name,
      phone: `4799988${String(i + 1).padStart(4, '0')}`,
      plate: `PW${String(i + 1).padStart(2, '0')}TST`,
      status: 'available',
      activeOrdersCount: 0,
      joinedQueueAt,
      callingToCounterAt: null,
      currentLat: STORE_LOCATION.latitude,
      currentLng: STORE_LOCATION.longitude,
      locationUpdatedAt: Date.now(),
      deliveriesCountToday: 0,
      totalEarnedToday: 0,
      statsDate: getBrazilDateKey(),
    });
    drivers.push({
      id,
      name,
      joinedQueueAt,
      phase: 'available',
      routeOrderIds: [],
      deliveryIndex: 0,
      phaseStartedAt: Date.now(),
      lastGpsAt: 0,
      returnStep: 0,
      cycles: 0,
    });
  }
  return drivers;
}

async function loginStore(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="store-user"]').fill(STORE_USER);
  await page.locator('input[name="store-pass"]').fill(STORE_PASS);
  await page.getByRole('button', { name: /Entrar no Painel/i }).click();
  await expect.poll(async () => page.evaluate(() => {
    try {
      const raw = localStorage.getItem('rota_facil_session');
      if (!raw) return false;
      const session = JSON.parse(raw);
      return session?.role === 'store_admin' || session?.role === 'master_admin';
    } catch { return false; }
  }), { timeout: 60_000 }).toBe(true);
}

async function cloneSourceOrder(source: any, shift: any, index: number): Promise<ShadowOrder> {
  const id = `${ORDER_PREFIX}${String(index).padStart(3, '0')}`;
  const clientName = `PW LIVE • ${String(source.clientName || `Pedido ${index}`)}`;
  const trackingCode = `PWLIVE-${RUN_ID.slice(-6)}-${String(index).padStart(3, '0')}`;
  const lat = Number.isFinite(Number(source.lat)) ? Number(source.lat) : STORE_LOCATION.latitude + 0.005;
  const lng = Number.isFinite(Number(source.lng)) ? Number(source.lng) : STORE_LOCATION.longitude + 0.005;
  const now = Date.now();

  await writeShadowOrder(id, {
    id,
    codeNumber: 980000 + index,
    clientName,
    clientPhone: source.clientPhone || '',
    address: source.address || 'Endereço recebido do Cardápio Web',
    street: source.street || '',
    houseNumber: source.houseNumber || '',
    complement: source.complement || '',
    neighborhood: source.neighborhood || '',
    lat,
    lng,
    items: Array.isArray(source.items) ? source.items : [],
    itemsSummary: source.itemsSummary || 'Pedido espelho do fluxo real',
    subtotal: Number(source.subtotal || 0),
    deliveryFee: Number(source.deliveryFee || 0),
    total: Number(source.total || 0),
    paymentMethod: source.paymentMethod || 'pix',
    status: 'pending',
    createdAt: new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    createdDate: getBrazilDateKey(),
    createdTimestamp: now,
    shiftId: shift.shiftId || null,
    shiftDate: shift.shiftDate || getBrazilDateKey(),
    estimatedMinutes: 25,
    assignedMotoboyId: null,
    assignedMotoboyName: null,
    assignmentSource: null,
    dispatchSource: null,
    trackingCode,
    originChannel: 'manual',
    shadowSourceChannel: 'cardapio_web',
    shadowSourceOrderId: source.id,
    shadowSourceExternalOrderId: source.externalOrderId || null,
    shadowStoreBranch: source.storeBranch || null,
    shadowStoreName: source.storeName || null,
  });

  return { id, sourceId: source.id, clientName, trackingCode, lat, lng, createdAtMs: now, state: 'pending' };
}

async function cleanup(shadows: Map<string, ShadowOrder>, drivers: DriverRuntime[]) {
  const jobs: Promise<unknown>[] = [];
  for (const id of shadows.keys()) {
    assertSafeOrderId(id);
    jobs.push(deleteDoc(doc(db, 'orders', id)));
  }
  for (const driver of drivers) {
    assertSafeDriverId(driver.id);
    jobs.push(deleteDoc(doc(db, 'motoboys', driver.id)));
  }
  jobs.push(deleteDoc(doc(db, 'stores', STORE_USER)));
  await Promise.allSettled(jobs);
}

async function validateTracking(browser: any, shadow: ShadowOrder) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/?rastreio=${shadow.trackingCode}`, { waitUntil: 'domcontentloaded' });
    await expect.poll(async () => (await page.locator('body').innerText()).includes(shadow.trackingCode), { timeout: 45_000 }).toBe(true);
  } finally {
    await context.close();
  }
}

function activeSourceForShift(source: any, shift: any) {
  if (source.isPlaywrightTest) return false;
  if (source.originChannel !== 'cardapio_web') return false;
  if (source.operationalEpoch !== OPERATIONAL_EPOCH) return false;
  if (terminalSourceStatuses.has(String(source.status || '').toLowerCase())) return false;
  return isOrderInCurrentShift(source, shift);
}

test('Operação sombra ao vivo por 2h: pedidos reais + 20 motoboys + GPS + retorno', async ({ browser }, testInfo: TestInfo) => {
  test.setTimeout((DURATION_MINUTES + 15) * 60 * 1000);

  const telemetry: Telemetry = {
    startedAt: new Date().toISOString(),
    sourceSeen: 0,
    shadowsCreated: 0,
    delivered: 0,
    dispatches: 0,
    driverReturns: 0,
    maxBusyDrivers: 0,
    events: [],
  };

  const shiftSnap = await getDoc(doc(db, 'shifts', 'current_shift'));
  expect(shiftSnap.exists(), 'Turno atual precisa existir').toBe(true);
  const shift = shiftSnap.data() as any;
  expect(Boolean(shift.isOpen), 'A operação precisa estar aberta durante o teste').toBe(true);

  const sourceOrders = new Map<string, any>();
  const sourceQuery = query(collection(db, 'orders'), where('originChannel', '==', 'cardapio_web'));
  let gotInitialSnapshot = false;
  const unsubscribe = onSnapshot(sourceQuery, (snapshot) => {
    for (const row of snapshot.docs) {
      const source = { id: row.id, ...row.data() } as any;
      if (activeSourceForShift(source, shift)) sourceOrders.set(row.id, source);
    }
    gotInitialSnapshot = true;
  }, (error) => console.warn('[PW-LIVE] source listener error', error));

  const drivers = await seedStoreAndDrivers();
  const shadows = new Map<string, ShadowOrder>();
  const clonedSources = new Set<string>();
  const storeContext = await browser.newContext({ viewport: { width: 1536, height: 1000 } });
  const storePage = await storeContext.newPage();
  const storeErrors: string[] = [];
  storePage.on('console', (msg) => {
    if (msg.type() === 'error') storeErrors.push(msg.text());
  });

  try {
    await loginStore(storePage);
    logEvent(telemetry, 'started', { durationMinutes: DURATION_MINUTES, drivers: DRIVER_COUNT, gpsIntervalMs: GPS_INTERVAL_MS });

    const startedAt = Date.now();
    let shadowIndex = 0;
    let lastUiCheck = 0;
    let trackingChecks = 0;

    while (Date.now() - startedAt < DURATION_MINUTES * 60_000) {
      if (!gotInitialSnapshot) {
        await sleep(TICK_MS);
        continue;
      }

      telemetry.sourceSeen = sourceOrders.size;

      for (const source of sourceOrders.values()) {
        if (shadows.size >= MAX_ORDERS) break;
        if (clonedSources.has(source.id)) continue;
        clonedSources.add(source.id);
        shadowIndex += 1;
        const shadow = await cloneSourceOrder(source, shift, shadowIndex);
        shadows.set(shadow.id, shadow);
        telemetry.shadowsCreated += 1;
        logEvent(telemetry, 'shadow-created', { shadowId: shadow.id, sourceId: source.id, clientName: shadow.clientName });
        if (trackingChecks < 3) {
          await validateTracking(browser, shadow);
          trackingChecks += 1;
          logEvent(telemetry, 'tracking-ok', { shadowId: shadow.id, trackingCode: shadow.trackingCode });
        }
      }

      const now = Date.now();
      for (const shadow of shadows.values()) {
        if (shadow.state === 'pending' && now - shadow.createdAtMs >= READY_DELAY_MS) {
          await writeShadowOrder(shadow.id, { status: 'ready_at_counter' });
          shadow.state = 'ready';
          logEvent(telemetry, 'ready', { orderId: shadow.id });
        }
      }

      const ready = Array.from(shadows.values()).filter((order) => order.state === 'ready');
      const available = drivers
        .filter((driver) => driver.phase === 'available')
        .sort((a, b) => a.joinedQueueAt - b.joinedQueueAt);

      while (ready.length && available.length) {
        const driver = available.shift()!;
        const batch = ready.splice(0, Math.min(3, ready.length));
        driver.phase = 'called';
        driver.phaseStartedAt = now;
        driver.routeOrderIds = batch.map((order) => order.id);
        driver.deliveryIndex = 0;
        driver.returnStep = 0;

        await writeShadowDriver(driver.id, {
          status: 'busy',
          activeOrdersCount: batch.length,
          joinedQueueAt: null,
          callingToCounterAt: now,
        });

        for (const [index, order] of batch.entries()) {
          await writeShadowOrder(order.id, {
            status: 'ready_at_counter',
            assignedMotoboyId: driver.id,
            assignedMotoboyName: driver.name,
            assignmentSource: 'rota_facil',
            dispatchSource: 'rota_facil',
            rotaFacilMotoboyId: driver.id,
            routeSequence: index + 1,
          });
          order.state = 'assigned';
          order.driverId = driver.id;
          order.routeSequence = index + 1;
        }
        telemetry.dispatches += 1;
        logEvent(telemetry, 'called-to-counter', { driverId: driver.id, orders: batch.map((o) => o.id) });
      }

      for (const driver of drivers) {
        if (driver.phase === 'called' && now - driver.phaseStartedAt >= PICKUP_DELAY_MS) {
          driver.phase = 'delivering';
          driver.phaseStartedAt = now;
          driver.lastGpsAt = 0;
          await writeShadowDriver(driver.id, { status: 'delivering', callingToCounterAt: null });
          for (const orderId of driver.routeOrderIds) {
            const order = shadows.get(orderId)!;
            await writeShadowOrder(orderId, {
              status: 'in_transit',
              dispatchedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            });
            order.state = 'in_transit';
          }
          logEvent(telemetry, 'route-started', { driverId: driver.id, orders: driver.routeOrderIds });
        }

        if (driver.phase === 'delivering' && now - driver.lastGpsAt >= GPS_INTERVAL_MS) {
          const currentOrderId = driver.routeOrderIds[Math.min(driver.deliveryIndex, driver.routeOrderIds.length - 1)];
          const currentOrder = shadows.get(currentOrderId);
          if (currentOrder) {
            await writeShadowDriver(driver.id, {
              currentLat: currentOrder.lat,
              currentLng: currentOrder.lng,
              locationUpdatedAt: now,
            });
            driver.lastGpsAt = now;

            await writeShadowOrder(currentOrder.id, {
              status: 'delivered',
              arrivedAtClient: true,
              arrivedAtClientTimestamp: now,
              deliveredAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              deliveredDate: getBrazilDateKey(),
              deliveredTimestamp: now,
            });
            currentOrder.state = 'delivered';
            telemetry.delivered += 1;
            driver.deliveryIndex += 1;
            logEvent(telemetry, 'delivered', { driverId: driver.id, orderId: currentOrder.id, sequence: driver.deliveryIndex });

            if (driver.deliveryIndex >= driver.routeOrderIds.length) {
              driver.phase = 'returning';
              driver.phaseStartedAt = now;
              driver.returnStep = 0;
              await writeShadowDriver(driver.id, {
                status: 'returning_to_store',
                activeOrdersCount: 0,
                joinedQueueAt: null,
                callingToCounterAt: null,
              });
              logEvent(telemetry, 'return-started', { driverId: driver.id });
            }
          }
        }

        if (driver.phase === 'returning' && now - driver.lastGpsAt >= GPS_INTERVAL_MS) {
          driver.returnStep += 1;
          const ratio = Math.min(1, driver.returnStep / RETURN_STEPS);
          const sourceOrder = shadows.get(driver.routeOrderIds[driver.routeOrderIds.length - 1]);
          const startLat = sourceOrder?.lat ?? STORE_LOCATION.latitude;
          const startLng = sourceOrder?.lng ?? STORE_LOCATION.longitude;
          const lat = startLat + (STORE_LOCATION.latitude - startLat) * ratio;
          const lng = startLng + (STORE_LOCATION.longitude - startLng) * ratio;
          await writeShadowDriver(driver.id, { currentLat: lat, currentLng: lng, locationUpdatedAt: now });
          driver.lastGpsAt = now;

          if (driver.returnStep >= RETURN_STEPS) {
            driver.phase = 'available';
            driver.routeOrderIds = [];
            driver.deliveryIndex = 0;
            driver.cycles += 1;
            driver.joinedQueueAt = now;
            await writeShadowDriver(driver.id, {
              status: 'available',
              activeOrdersCount: 0,
              joinedQueueAt: now,
              callingToCounterAt: null,
              currentLat: STORE_LOCATION.latitude,
              currentLng: STORE_LOCATION.longitude,
              locationUpdatedAt: now,
              deliveriesCountToday: driver.cycles,
            });
            telemetry.driverReturns += 1;
            logEvent(telemetry, 'returned-to-queue', { driverId: driver.id, cycles: driver.cycles, joinedQueueAt: now });
          }
        }
      }

      const busy = drivers.filter((driver) => driver.phase !== 'available').length;
      telemetry.maxBusyDrivers = Math.max(telemetry.maxBusyDrivers, busy);

      if (now - lastUiCheck >= 60_000 && shadows.size > 0) {
        lastUiCheck = now;
        const body = await storePage.locator('body').innerText().catch(() => '');
        expect(body.includes('PW LIVE'), 'Painel da loja precisa continuar renderizando pedidos sombra durante a carga').toBe(true);
        logEvent(telemetry, 'dashboard-ok', { busyDrivers: busy, shadows: shadows.size, delivered: telemetry.delivered });
      }

      await sleep(TICK_MS);
    }

    expect(telemetry.shadowsCreated, 'Nenhum pedido real do Cardápio Web foi observado durante as 2h').toBeGreaterThan(0);
    expect(telemetry.dispatches, 'Nenhum despacho sombra foi executado').toBeGreaterThan(0);
    expect(telemetry.delivered, 'Nenhuma entrega sombra foi concluída').toBeGreaterThan(0);
    expect(drivers.length).toBe(DRIVER_COUNT);

    const criticalStoreErrors = storeErrors.filter((line) => /quota exceeded|resource-exhausted|permission-denied|uncaught|unhandled/i.test(line));
    expect(criticalStoreErrors, `Erros críticos no painel:\n${criticalStoreErrors.join('\n')}`).toEqual([]);

    telemetry.finishedAt = new Date().toISOString();
    await testInfo.attach('live-shadow-telemetry.json', {
      body: Buffer.from(JSON.stringify(telemetry, null, 2), 'utf8'),
      contentType: 'application/json',
    });
    logEvent(telemetry, 'completed', { delivered: telemetry.delivered, dispatches: telemetry.dispatches, returns: telemetry.driverReturns });
  } finally {
    unsubscribe();
    telemetry.finishedAt ||= new Date().toISOString();
    await testInfo.attach('live-shadow-telemetry-final.json', {
      body: Buffer.from(JSON.stringify(telemetry, null, 2), 'utf8'),
      contentType: 'application/json',
    }).catch(() => undefined);
    await storeContext.close().catch(() => undefined);
    await cleanup(shadows, drivers).catch((error) => console.error('[PW-LIVE] cleanup failed', error));
  }
});
