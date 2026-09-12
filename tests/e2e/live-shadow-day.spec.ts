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
const DURATION_MINUTES = Math.max(3, Number(process.env.LIVE_TEST_DURATION_MINUTES || 10));
const TICK_MS = Math.max(3000, Number(process.env.LIVE_TEST_TICK_MS || 5000));
const GPS_INTERVAL_MS = Math.max(5000, Number(process.env.LIVE_TEST_GPS_INTERVAL_MS || 15000));
const DRIVER_COUNT = Math.max(1, Number(process.env.LIVE_TEST_DRIVER_COUNT || 20));
const MAX_ORDERS = Math.max(1, Number(process.env.LIVE_TEST_MAX_ORDERS || 80));
const DRIVER_PREFIX = `pw_live_${RUN_ID}_driver_`;
const STORE_USER = `pw_live_${RUN_ID}_store`.toLowerCase();
const STORE_PASS = 'PwLiveReal1234';
const DRIVER_PASS = 'PwLiveDriver1234';
const PICKUP_DELAY_MS = Math.max(5000, Number(process.env.LIVE_TEST_PICKUP_DELAY_MS || 10000));
const GPS_STEPS_TO_CLIENT = 3;
const GPS_STEPS_RETURN = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const terminalStatuses = new Set(['delivered', 'closed', 'completed', 'finalized', 'concluded', 'cancelled', 'canceled', 'rejected']);

type RealOrderRuntime = {
  id: string;
  clientName: string;
  trackingCode: string;
  lat: number;
  lng: number;
  state: 'waiting' | 'assigned' | 'in_transit' | 'delivered' | 'skipped';
  firstSeenAt: number;
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
  gpsStep: number;
  returnStep: number;
  currentLat: number;
  currentLng: number;
  cycles: number;
};

type Telemetry = {
  startedAt: string;
  finishedAt?: string;
  sourceSeen: number;
  realOrdersTouched: number;
  delivered: number;
  dispatches: number;
  driverReturns: number;
  maxBusyDrivers: number;
  events: Array<{ at: string; type: string; data?: Record<string, unknown> }>;
};

function logEvent(telemetry: Telemetry, type: string, data?: Record<string, unknown>) {
  const row = { at: new Date().toISOString(), type, data };
  telemetry.events.push(row);
  console.log(`[PW-LIVE-REAL][${type}]${data ? ` ${JSON.stringify(data)}` : ''}`);
}

function assertSafeDriverId(id: string) {
  expect(id.startsWith(DRIVER_PREFIX), `BLOQUEADO: tentativa de alterar motoboy real ${id}`).toBe(true);
}

async function writeFakeDriver(id: string, patch: Record<string, unknown>) {
  assertSafeDriverId(id);
  await setDoc(doc(db, 'motoboys', id), {
    ...patch,
    isPlaywrightTest: true,
    liveRealRunId: RUN_ID,
    operationalEpoch: OPERATIONAL_EPOCH,
  }, { merge: true });
}

async function assertRealCardapioOrder(id: string) {
  const snap = await getDoc(doc(db, 'orders', id));
  expect(snap.exists(), `Pedido real ${id} precisa existir`).toBe(true);
  const data = snap.data() as any;
  expect(data.isPlaywrightTest === true, `Pedido ${id} não pode ser pedido sintético`).toBe(false);
  expect(data.originChannel, `Pedido ${id} precisa ter vindo do Cardápio Web`).toBe('cardapio_web');
  expect(data.operationalEpoch, `Pedido ${id} precisa pertencer ao epoch atual`).toBe(OPERATIONAL_EPOCH);
  return data;
}

async function writeRealOrder(id: string, patch: Record<string, unknown>) {
  await assertRealCardapioOrder(id);
  await setDoc(doc(db, 'orders', id), {
    ...patch,
    liveOperationalTestRunId: RUN_ID,
    liveOperationalTestAt: Date.now(),
  }, { merge: true });
}

async function seedStoreAndDrivers(): Promise<DriverRuntime[]> {
  const storeCredential = await hashPassword(STORE_PASS);
  await setDoc(doc(db, 'stores', STORE_USER), {
    id: STORE_USER,
    username: STORE_USER,
    passwordHash: storeCredential.hash,
    passwordSalt: storeCredential.salt,
    storeName: `PW LIVE REAL ${RUN_ID}`,
    isPlaywrightTest: true,
    liveRealRunId: RUN_ID,
    createdAt: Date.now(),
  }, { merge: true });

  const drivers: DriverRuntime[] = [];
  for (let i = 0; i < DRIVER_COUNT; i += 1) {
    const id = `${DRIVER_PREFIX}${String(i + 1).padStart(2, '0')}`;
    const name = `PW Motoboy ${String(i + 1).padStart(2, '0')}`;
    const credential = await hashPassword(DRIVER_PASS);
    const joinedQueueAt = Date.now() + i;
    await writeFakeDriver(id, {
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
      gpsStep: 0,
      returnStep: 0,
      currentLat: STORE_LOCATION.latitude,
      currentLng: STORE_LOCATION.longitude,
      cycles: 0,
    });
  }
  return drivers;
}

async function cleanupDriversAndStore(drivers: DriverRuntime[]) {
  const jobs: Promise<unknown>[] = [];
  for (const driver of drivers) {
    assertSafeDriverId(driver.id);
    jobs.push(deleteDoc(doc(db, 'motoboys', driver.id)));
  }
  jobs.push(deleteDoc(doc(db, 'stores', STORE_USER)));
  await Promise.allSettled(jobs);
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

function eligibleOrder(source: any, shift: any) {
  if (source.isPlaywrightTest) return false;
  if (source.originChannel !== 'cardapio_web') return false;
  if (source.operationalEpoch !== OPERATIONAL_EPOCH) return false;
  if (terminalStatuses.has(String(source.status || '').toLowerCase())) return false;
  return isOrderInCurrentShift(source, shift);
}

async function validateOrderOnStore(page: Page, order: RealOrderRuntime) {
  await expect.poll(async () => {
    const body = await page.locator('body').innerText().catch(() => '');
    return body.includes(order.clientName);
  }, { timeout: 30_000 }).toBe(true);
}

async function validateTracking(browser: any, order: RealOrderRuntime) {
  if (!order.trackingCode) return;
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/?rastreio=${encodeURIComponent(order.trackingCode)}`, { waitUntil: 'domcontentloaded' });
    await expect.poll(async () => {
      const body = await page.locator('body').innerText().catch(() => '');
      return body.includes(order.trackingCode) && !/Carregando dados do pedido/i.test(body);
    }, { timeout: 45_000 }).toBe(true);
  } finally {
    await context.close();
  }
}

function interpolate(fromLat: number, fromLng: number, toLat: number, toLng: number, step: number, total: number) {
  const ratio = Math.min(1, step / total);
  return {
    lat: fromLat + (toLat - fromLat) * ratio,
    lng: fromLng + (toLng - fromLng) * ratio,
  };
}

test('Operação real ao vivo: pedidos reais do Cardápio Web + 20 motoboys fake', async ({ browser }, testInfo: TestInfo) => {
  test.setTimeout((DURATION_MINUTES + 15) * 60 * 1000);

  const telemetry: Telemetry = {
    startedAt: new Date().toISOString(),
    sourceSeen: 0,
    realOrdersTouched: 0,
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
    const currentIds = new Set<string>();
    for (const row of snapshot.docs) {
      const source = { id: row.id, ...row.data() } as any;
      if (eligibleOrder(source, shift)) {
        sourceOrders.set(row.id, source);
        currentIds.add(row.id);
      }
    }
    for (const id of Array.from(sourceOrders.keys())) {
      if (!currentIds.has(id)) sourceOrders.delete(id);
    }
    gotInitialSnapshot = true;
  }, (error) => console.warn('[PW-LIVE-REAL] source listener error', error));

  const drivers = await seedStoreAndDrivers();
  const runtimes = new Map<string, RealOrderRuntime>();
  const storeContext = await browser.newContext({ viewport: { width: 1536, height: 1000 } });
  const storePage = await storeContext.newPage();
  const storeErrors: string[] = [];
  storePage.on('console', (msg) => {
    if (msg.type() === 'error') storeErrors.push(msg.text());
  });

  try {
    await loginStore(storePage);
    logEvent(telemetry, 'started', {
      durationMinutes: DURATION_MINUTES,
      drivers: DRIVER_COUNT,
      gpsIntervalMs: GPS_INTERVAL_MS,
      mode: 'REAL_ORDER_DOCS_NO_CLONE',
    });

    const startedAt = Date.now();
    let lastUiCheck = 0;
    let trackingChecks = 0;

    while (Date.now() - startedAt < DURATION_MINUTES * 60_000) {
      if (!gotInitialSnapshot) {
        await sleep(TICK_MS);
        continue;
      }

      telemetry.sourceSeen = sourceOrders.size;

      for (const source of sourceOrders.values()) {
        if (runtimes.size >= MAX_ORDERS) break;
        if (runtimes.has(source.id)) continue;
        const lat = Number.isFinite(Number(source.lat)) ? Number(source.lat) : STORE_LOCATION.latitude + 0.004;
        const lng = Number.isFinite(Number(source.lng)) ? Number(source.lng) : STORE_LOCATION.longitude + 0.004;
        const runtime: RealOrderRuntime = {
          id: source.id,
          clientName: String(source.clientName || `Pedido ${source.codeNumber || source.id}`),
          trackingCode: String(source.trackingCode || ''),
          lat,
          lng,
          state: 'waiting',
          firstSeenAt: Date.now(),
        };
        runtimes.set(source.id, runtime);
        telemetry.realOrdersTouched += 1;
        logEvent(telemetry, 'real-order-detected', {
          orderId: source.id,
          clientName: runtime.clientName,
          externalOrderId: source.externalOrderId || null,
          branch: source.storeBranch || null,
          status: source.status,
        });
        if (trackingChecks < 2 && runtime.trackingCode) {
          await validateTracking(browser, runtime);
          trackingChecks += 1;
          logEvent(telemetry, 'tracking-ok', { orderId: runtime.id, trackingCode: runtime.trackingCode });
        }
      }

      const now = Date.now();
      const waiting = Array.from(runtimes.values()).filter((order) => order.state === 'waiting');
      const available = drivers
        .filter((driver) => driver.phase === 'available')
        .sort((a, b) => a.joinedQueueAt - b.joinedQueueAt);

      while (waiting.length && available.length) {
        const driver = available.shift()!;
        const batch = waiting.splice(0, Math.min(3, waiting.length));
        driver.phase = 'called';
        driver.phaseStartedAt = now;
        driver.routeOrderIds = batch.map((order) => order.id);
        driver.deliveryIndex = 0;
        driver.gpsStep = 0;
        driver.returnStep = 0;

        await writeFakeDriver(driver.id, {
          status: 'busy',
          activeOrdersCount: batch.length,
          joinedQueueAt: null,
          callingToCounterAt: now,
        });

        for (const [index, order] of batch.entries()) {
          await writeRealOrder(order.id, {
            status: 'ready_at_counter',
            assignedMotoboyId: driver.id,
            assignedMotoboyName: driver.name,
            assignmentSource: 'rota_facil',
            dispatchSource: 'rota_facil',
            rotaFacilMotoboyId: driver.id,
            routeSequence: index + 1,
            liveOperationalTestRunId: RUN_ID,
          });
          order.state = 'assigned';
          order.driverId = driver.id;
          order.routeSequence = index + 1;
        }
        telemetry.dispatches += 1;
        logEvent(telemetry, 'assigned', { driverId: driver.id, orders: batch.map((o) => o.id) });
      }

      for (const driver of drivers) {
        if (driver.phase === 'called' && now - driver.phaseStartedAt >= PICKUP_DELAY_MS) {
          driver.phase = 'delivering';
          driver.phaseStartedAt = now;
          driver.lastGpsAt = 0;
          driver.gpsStep = 0;
          await writeFakeDriver(driver.id, {
            status: 'delivering',
            callingToCounterAt: null,
          });
          for (const orderId of driver.routeOrderIds) {
            const runtime = runtimes.get(orderId);
            if (!runtime || runtime.state !== 'assigned') continue;
            await writeRealOrder(orderId, {
              status: 'in_transit',
              pickedUpAt: now,
              dispatchedAt: new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              dispatchSource: 'rota_facil',
              assignmentSource: 'rota_facil',
              rotaFacilMotoboyId: driver.id,
            });
            runtime.state = 'in_transit';
          }
          logEvent(telemetry, 'route-started', { driverId: driver.id, orders: driver.routeOrderIds });
        }

        if (driver.phase === 'delivering' && now - driver.lastGpsAt >= GPS_INTERVAL_MS) {
          const currentId = driver.routeOrderIds[driver.deliveryIndex];
          const order = currentId ? runtimes.get(currentId) : undefined;
          if (!order) {
            driver.phase = 'returning';
            driver.phaseStartedAt = now;
            driver.returnStep = 0;
            continue;
          }

          driver.gpsStep += 1;
          const next = interpolate(driver.currentLat, driver.currentLng, order.lat, order.lng, 1, Math.max(1, GPS_STEPS_TO_CLIENT - driver.gpsStep + 1));
          driver.currentLat = driver.gpsStep >= GPS_STEPS_TO_CLIENT ? order.lat : next.lat;
          driver.currentLng = driver.gpsStep >= GPS_STEPS_TO_CLIENT ? order.lng : next.lng;
          driver.lastGpsAt = now;
          await writeFakeDriver(driver.id, {
            currentLat: driver.currentLat,
            currentLng: driver.currentLng,
            locationUpdatedAt: now,
          });
          logEvent(telemetry, 'gps', { driverId: driver.id, orderId: order.id, step: driver.gpsStep, lat: driver.currentLat, lng: driver.currentLng });

          if (driver.gpsStep >= GPS_STEPS_TO_CLIENT) {
            await writeRealOrder(order.id, {
              status: 'delivered',
              deliveredAt: new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              deliveredDate: getBrazilDateKey(),
              deliveredTimestamp: now,
              arrivedAtClient: true,
              arrivedAtClientTimestamp: now,
              routeCompletedAt: now,
              dispatchSource: 'rota_facil',
              assignmentSource: 'rota_facil',
              rotaFacilMotoboyId: driver.id,
            });
            order.state = 'delivered';
            telemetry.delivered += 1;
            logEvent(telemetry, 'delivered', { driverId: driver.id, orderId: order.id, clientName: order.clientName });
            driver.deliveryIndex += 1;
            driver.gpsStep = 0;

            if (driver.deliveryIndex >= driver.routeOrderIds.length) {
              driver.phase = 'returning';
              driver.phaseStartedAt = now;
              driver.returnStep = 0;
              await writeFakeDriver(driver.id, {
                status: 'returning_to_store',
                activeOrdersCount: 0,
                joinedQueueAt: null,
              });
              logEvent(telemetry, 'return-started', { driverId: driver.id });
            }
          }
        }

        if (driver.phase === 'returning' && now - driver.lastGpsAt >= GPS_INTERVAL_MS) {
          driver.returnStep += 1;
          const next = interpolate(driver.currentLat, driver.currentLng, STORE_LOCATION.latitude, STORE_LOCATION.longitude, 1, Math.max(1, GPS_STEPS_RETURN - driver.returnStep + 1));
          driver.currentLat = driver.returnStep >= GPS_STEPS_RETURN ? STORE_LOCATION.latitude : next.lat;
          driver.currentLng = driver.returnStep >= GPS_STEPS_RETURN ? STORE_LOCATION.longitude : next.lng;
          driver.lastGpsAt = now;
          await writeFakeDriver(driver.id, {
            status: 'returning_to_store',
            currentLat: driver.currentLat,
            currentLng: driver.currentLng,
            locationUpdatedAt: now,
          });

          if (driver.returnStep >= GPS_STEPS_RETURN) {
            const joinedQueueAt = Date.now();
            driver.phase = 'available';
            driver.joinedQueueAt = joinedQueueAt;
            driver.routeOrderIds = [];
            driver.deliveryIndex = 0;
            driver.gpsStep = 0;
            driver.returnStep = 0;
            driver.cycles += 1;
            await writeFakeDriver(driver.id, {
              status: 'available',
              activeOrdersCount: 0,
              joinedQueueAt,
              callingToCounterAt: null,
              currentLat: STORE_LOCATION.latitude,
              currentLng: STORE_LOCATION.longitude,
              locationUpdatedAt: Date.now(),
            });
            telemetry.driverReturns += 1;
            logEvent(telemetry, 'queue-return', { driverId: driver.id, cycles: driver.cycles, joinedQueueAt });
          }
        }
      }

      telemetry.maxBusyDrivers = Math.max(telemetry.maxBusyDrivers, drivers.filter((d) => d.phase !== 'available').length);

      if (now - lastUiCheck > 60_000) {
        const visibleCandidate = Array.from(runtimes.values()).find((o) => o.state !== 'skipped');
        if (visibleCandidate) {
          await validateOrderOnStore(storePage, visibleCandidate);
          logEvent(telemetry, 'store-ui-ok', { orderId: visibleCandidate.id, clientName: visibleCandidate.clientName });
        }
        lastUiCheck = now;
      }

      await sleep(TICK_MS);
    }

    expect(telemetry.realOrdersTouched, 'Precisa detectar ao menos um pedido real do Cardápio Web').toBeGreaterThan(0);
    expect(telemetry.dispatches, 'Precisa atribuir ao menos um pedido real a motoboy fake').toBeGreaterThan(0);
    expect(telemetry.delivered, 'Precisa concluir ao menos uma entrega real dentro do Rota Fácil').toBeGreaterThan(0);
    expect(telemetry.driverReturns, 'Precisa validar ao menos um retorno do motoboy à fila').toBeGreaterThan(0);

    const criticalStoreErrors = storeErrors.filter((line) => /quota exceeded|resource-exhausted|permission-denied|uncaught|unhandled/i.test(line));
    expect(criticalStoreErrors, `Erros críticos na loja:\n${criticalStoreErrors.join('\n')}`).toEqual([]);

    logEvent(telemetry, 'completed', {
      sourceSeen: telemetry.sourceSeen,
      realOrdersTouched: telemetry.realOrdersTouched,
      dispatches: telemetry.dispatches,
      delivered: telemetry.delivered,
      driverReturns: telemetry.driverReturns,
      maxBusyDrivers: telemetry.maxBusyDrivers,
    });
  } finally {
    unsubscribe();
    telemetry.finishedAt = new Date().toISOString();
    await testInfo.attach('live-real-operation-telemetry.json', {
      body: Buffer.from(JSON.stringify(telemetry, null, 2), 'utf8'),
      contentType: 'application/json',
    }).catch(() => undefined);
    await storeContext.close().catch(() => undefined);
    await cleanupDriversAndStore(drivers).catch(() => undefined);
  }
});
