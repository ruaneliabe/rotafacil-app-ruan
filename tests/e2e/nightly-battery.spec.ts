import { expect, test, type Browser, type Page } from '@playwright/test';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db, OPERATIONAL_EPOCH, STORE_LOCATION } from './support/fixture';
import { hashPassword } from '../../src/lib/passwordSecurity';

const BASE_URL = process.env.E2E_BASE_URL || 'https://rotafacil-app-ruan.onrender.com';
const PREFIX = 'PW NIGHTLY';
const PASS = 'PwNightly1234';
const criticalConsolePattern = /resource-exhausted|quota exceeded|permission-denied|react.*#310|uncaught|unhandled/i;

const slug = (tag: string) => tag.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const storeUser = (tag: string) => `pw_nightly_${slug(tag)}`;
const driverId = (tag: string, index: number) => `pw_nightly_${slug(tag)}_driver_${index}`;
const orderId = (tag: string, index: number) => `pw_nightly_${slug(tag)}_order_${index}`;
const clientName = (tag: string, index: number) => `${PREFIX} ${tag.toUpperCase()} ${String(index).padStart(2, '0')}`;

async function cleanup(tag: string) {
  const [orders, drivers] = await Promise.all([
    getDocs(collection(db, 'orders')),
    getDocs(collection(db, 'motoboys')),
  ]);
  const jobs: Promise<unknown>[] = [];
  for (const item of orders.docs) {
    if (String(item.data().clientName || '').startsWith(`${PREFIX} ${tag.toUpperCase()}`)) jobs.push(deleteDoc(item.ref));
  }
  for (const item of drivers.docs) {
    if (item.id.startsWith(`pw_nightly_${slug(tag)}_driver_`)) jobs.push(deleteDoc(item.ref));
  }
  jobs.push(deleteDoc(doc(db, 'stores', storeUser(tag))));
  await Promise.allSettled(jobs);
}

async function seedStore(tag: string) {
  const credential = await hashPassword(PASS);
  await setDoc(doc(db, 'stores', storeUser(tag)), {
    id: storeUser(tag), username: storeUser(tag),
    passwordHash: credential.hash, passwordSalt: credential.salt,
    storeName: `PLAYWRIGHT NIGHTLY ${tag.toUpperCase()}`,
    createdAt: Date.now(), isPlaywrightTest: true,
  }, { merge: true });
}

async function seedDriver(tag: string, index: number, overrides: Record<string, unknown> = {}) {
  const credential = await hashPassword(PASS);
  const id = driverId(tag, index);
  const payload = {
    id,
    username: id,
    passwordHash: credential.hash,
    passwordSalt: credential.salt,
    name: `PW NIGHTLY ${tag.toUpperCase()} MOTO ${index}`,
    phone: `4799998${String(index).padStart(4, '0')}`,
    status: 'available',
    activeOrdersCount: 0,
    deliveriesCountToday: 0,
    totalEarnedToday: 0,
    joinedQueueAt: Date.now() + index * 1000,
    callingToCounterAt: null,
    currentLat: STORE_LOCATION.latitude,
    currentLng: STORE_LOCATION.longitude,
    operationalEpoch: OPERATIONAL_EPOCH,
    isPlaywrightTest: true,
    createdAt: Date.now() + index,
    ...overrides,
  };
  await setDoc(doc(db, 'motoboys', id), payload, { merge: true });
  return payload;
}

async function seedOrder(tag: string, index: number, overrides: Record<string, unknown> = {}) {
  const id = orderId(tag, index);
  const payload = {
    id,
    codeNumber: 9100 + index,
    clientName: clientName(tag, index),
    clientPhone: `479998${String(index).padStart(5, '0')}`,
    address: `Rua Playwright, ${100 + index}`,
    street: 'Rua Playwright',
    houseNumber: String(100 + index),
    neighborhood: 'Centro',
    lat: STORE_LOCATION.latitude + index * 0.001,
    lng: STORE_LOCATION.longitude + index * 0.001,
    items: [{ name: 'Item teste noturno', quantity: 1, price: 25 }],
    itemsSummary: '1x Item teste noturno',
    subtotal: 25,
    deliveryFee: 5,
    total: 30,
    paymentMethod: 'pix',
    status: 'pending',
    createdAt: '04:00',
    createdDate: new Date().toISOString().slice(0, 10),
    createdTimestamp: Date.now() + index,
    originChannel: 'manual',
    trackingCode: `PW-NIGHTLY-${slug(tag).toUpperCase()}-${index}`,
    operationalEpoch: OPERATIONAL_EPOCH,
    isPlaywrightTest: true,
    ...overrides,
  };
  await setDoc(doc(db, 'orders', id), payload, { merge: true });
  return payload;
}

async function loginStore(page: Page, tag: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="store-user"]').fill(storeUser(tag));
  await page.locator('input[name="store-pass"]').fill(PASS);
  await page.getByRole('button', { name: /Entrar no Painel/i }).click();
  await expect(page.getByText(/Pedidos e despacho/i).first()).toBeVisible({ timeout: 60_000 });
}

async function loginDriver(page: Page, tag: string, index: number) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Entregador$/i }).click();
  await page.locator('input[name="driver-user"]').fill(driverId(tag, index));
  await page.locator('input[name="driver-pass"]').fill(PASS);
  await page.getByRole('button', { name: /Acessar Entregador/i }).click();
  await expect(page.getByRole('button', { name: /Entrar na fila/i })).toBeVisible({ timeout: 60_000 });
}

async function storePage(browser: Browser, tag: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginStore(page, tag);
  return { context, page };
}

async function getTaggedOrders(tag: string) {
  const snap = await getDocs(collection(db, 'orders'));
  return snap.docs.map((x) => ({ id: x.id, ...x.data() } as any))
    .filter((x) => String(x.clientName || '').startsWith(`${PREFIX} ${tag.toUpperCase()}`));
}

async function getTaggedDrivers(tag: string) {
  const snap = await getDocs(collection(db, 'motoboys'));
  return snap.docs.map((x) => ({ id: x.id, ...x.data() } as any))
    .filter((x) => x.id.startsWith(`pw_nightly_${slug(tag)}_driver_`));
}

test('@session Login, sessão e F5', async ({ browser }) => {
  const tag = 'session';
  await cleanup(tag); await seedStore(tag); await seedDriver(tag, 1, { status: 'returning_to_store', joinedQueueAt: null });
  try {
    const store = await storePage(browser, tag);
    await store.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(store.page.getByText(/Pedidos e despacho/i).first()).toBeVisible({ timeout: 60_000 });
    expect(await store.page.evaluate(() => JSON.parse(localStorage.getItem('rota_facil_session') || '{}').role)).toMatch(/store_admin|master_admin/);
    await store.context.close();

    const dctx = await browser.newContext();
    const dpage = await dctx.newPage();
    await loginDriver(dpage, tag, 1);
    await dpage.reload({ waitUntil: 'domcontentloaded' });
    await expect(dpage.getByRole('button', { name: /Entrar na fila/i })).toBeVisible({ timeout: 60_000 });
    const saved = await dpage.evaluate(() => JSON.parse(localStorage.getItem('rota_facil_session') || '{}'));
    expect(saved.role).toBe('motoboy');
    expect(saved.motoboyId).toBe(driverId(tag, 1));
    await dctx.close();
  } finally { await cleanup(tag); }
});

test('@multidevice Sincronização multi-dispositivo', async ({ browser }) => {
  const tag = 'multidevice';
  await cleanup(tag); await seedStore(tag);
  try {
    const a = await storePage(browser, tag);
    const b = await storePage(browser, tag);
    const created = await seedOrder(tag, 1);
    await expect(a.page.getByText(created.clientName).first()).toBeVisible({ timeout: 30_000 });
    await expect(b.page.getByText(created.clientName).first()).toBeVisible({ timeout: 30_000 });
    await deleteDoc(doc(db, 'orders', created.id));
    await expect(a.page.getByText(created.clientName)).toHaveCount(0, { timeout: 30_000 });
    await expect(b.page.getByText(created.clientName)).toHaveCount(0, { timeout: 30_000 });
    await a.context.close(); await b.context.close();
  } finally { await cleanup(tag); }
});

test('@queue Fila e múltiplos motoboys', async () => {
  const tag = 'queue';
  await cleanup(tag); await seedStore(tag);
  const base = Date.now() - 60_000;
  try {
    for (let i = 1; i <= 10; i += 1) await seedDriver(tag, i, { joinedQueueAt: base + i * 1000 });
    let queue = (await getTaggedDrivers(tag)).filter((d) => d.status === 'available' && Number(d.joinedQueueAt) > 0)
      .sort((a, b) => Number(a.joinedQueueAt) - Number(b.joinedQueueAt));
    expect(queue.map((d) => d.id)).toEqual(Array.from({ length: 10 }, (_, i) => driverId(tag, i + 1)));

    await setDoc(doc(db, 'motoboys', driverId(tag, 1)), { callingToCounterAt: Date.now(), joinedQueueAt: null }, { merge: true });
    queue = (await getTaggedDrivers(tag)).filter((d) => d.status === 'available' && Number(d.joinedQueueAt) > 0)
      .sort((a, b) => Number(a.joinedQueueAt) - Number(b.joinedQueueAt));
    expect(queue[0]?.id).toBe(driverId(tag, 2));
    expect(queue.some((d) => d.id === driverId(tag, 1))).toBe(false);

    await setDoc(doc(db, 'motoboys', driverId(tag, 1)), { status: 'returning_to_store', callingToCounterAt: null, joinedQueueAt: null }, { merge: true });
    await setDoc(doc(db, 'motoboys', driverId(tag, 1)), { status: 'available', joinedQueueAt: Date.now() + 120_000 }, { merge: true });
    queue = (await getTaggedDrivers(tag)).filter((d) => d.status === 'available' && Number(d.joinedQueueAt) > 0)
      .sort((a, b) => Number(a.joinedQueueAt) - Number(b.joinedQueueAt));
    expect(queue.at(-1)?.id).toBe(driverId(tag, 1));
  } finally { await cleanup(tag); }
});

test('@gps Rotas, GPS e rastreamento', async ({ browser }) => {
  const tag = 'gps';
  await cleanup(tag); await seedStore(tag);
  const driver = await seedDriver(tag, 1, { status: 'delivering', joinedQueueAt: null, activeOrdersCount: 1 });
  const order = await seedOrder(tag, 1, { status: 'in_transit', assignedMotoboyId: driver.id, assignedMotoboyName: driver.name, routeSequence: 1 });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(`/?rastreio=${order.trackingCode}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(order.clientName).first()).toBeVisible({ timeout: 60_000 });

    for (let i = 1; i <= 3; i += 1) {
      const lat = STORE_LOCATION.latitude + i * 0.002;
      const lng = STORE_LOCATION.longitude + i * 0.002;
      await setDoc(doc(db, 'motoboys', driver.id), { currentLat: lat, currentLng: lng, locationUpdatedAt: Date.now() }, { merge: true });
      await expect.poll(async () => Number((await getDoc(doc(db, 'motoboys', driver.id))).data()?.currentLat), { timeout: 10_000 }).toBe(lat);
      await page.waitForTimeout(1200);
    }
    expect(errors.filter((line) => criticalConsolePattern.test(line))).toEqual([]);
    await ctx.close();
  } finally { await cleanup(tag); }
});

test('@ordercycle Pedidos e ciclo de entrega', async () => {
  const tag = 'ordercycle';
  await cleanup(tag); await seedStore(tag);
  const driver = await seedDriver(tag, 1, { status: 'available', joinedQueueAt: Date.now() - 5000 });
  const order = await seedOrder(tag, 1);
  try {
    const ref = doc(db, 'orders', order.id);
    const states = ['preparing', 'ready_at_counter', 'dispatched', 'in_transit', 'delivered'];
    for (const status of states) {
      await setDoc(ref, {
        status,
        assignedMotoboyId: driver.id,
        assignedMotoboyName: driver.name,
        ...(status === 'delivered' ? { deliveredTimestamp: Date.now() } : {}),
      }, { merge: true });
      expect((await getDoc(ref)).data()?.status).toBe(status);
    }
    await setDoc(doc(db, 'motoboys', driver.id), { status: 'returning_to_store', activeOrdersCount: 0, joinedQueueAt: null }, { merge: true });
    const finalDriver = (await getDoc(doc(db, 'motoboys', driver.id))).data() as any;
    expect(finalDriver.status).toBe('returning_to_store');
    expect(finalDriver.joinedQueueAt == null).toBe(true);
  } finally { await cleanup(tag); }
});

test('@cardapio Cardápio Web e sincronização', async ({ browser }) => {
  const tag = 'cardapio';
  await cleanup(tag); await seedStore(tag);
  try {
    const order = await seedOrder(tag, 1, { originChannel: 'cardapio_web', externalOrderId: 'PW-NIGHTLY-CARDAPIO-1' });
    const store = await storePage(browser, tag);
    await expect(store.page.getByText(order.clientName).first()).toBeVisible({ timeout: 30_000 });
    await expect(store.page.getByText(/Cardápio Web/i).first()).toBeVisible({ timeout: 30_000 });

    await setDoc(doc(db, 'orders', order.id), { itemsSummary: '2x Item atualizado pelo Cardápio Web', total: 55 }, { merge: true });
    const tagged = await getTaggedOrders(tag);
    expect(tagged).toHaveLength(1);
    expect(tagged[0].itemsSummary).toContain('atualizado');
    expect(tagged[0].originChannel).toBe('cardapio_web');
    await store.context.close();
  } finally { await cleanup(tag); }
});

test('@recovery Queda de conexão e recuperação', async ({ browser }) => {
  const tag = 'recovery';
  await cleanup(tag); await seedStore(tag);
  try {
    const store = await storePage(browser, tag);
    await store.context.setOffline(true);
    await expect(store.page.getByText(/SEM INTERNET/i)).toBeVisible({ timeout: 15_000 });
    expect(await store.page.evaluate(() => navigator.onLine)).toBe(false);
    await store.context.setOffline(false);
    await expect.poll(async () => store.page.evaluate(() => navigator.onLine), { timeout: 15_000 }).toBe(true);
    await expect(store.page.getByText(/SEM INTERNET/i)).toHaveCount(0, { timeout: 15_000 });
    await store.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(store.page.getByText(/Pedidos e despacho/i).first()).toBeVisible({ timeout: 60_000 });
    await store.context.close();
  } finally { await cleanup(tag); }
});

test('@integrity Integridade do banco e isolamento', async () => {
  const tag = 'integrity';
  await cleanup(tag); await seedStore(tag);
  try {
    const distribution = [3, 3, 2];
    let orderIndex = 1;
    for (let i = 1; i <= 3; i += 1) {
      const driver = await seedDriver(tag, i, { status: 'delivering', joinedQueueAt: null, activeOrdersCount: distribution[i - 1] });
      for (let j = 0; j < distribution[i - 1]; j += 1) {
        await seedOrder(tag, orderIndex, { status: 'in_transit', assignedMotoboyId: driver.id, assignedMotoboyName: driver.name, routeSequence: j + 1 });
        orderIndex += 1;
      }
    }
    const orders = await getTaggedOrders(tag);
    const drivers = await getTaggedDrivers(tag);
    expect(orders).toHaveLength(8);
    expect(drivers).toHaveLength(3);
    expect(new Set(orders.map((o) => o.id)).size).toBe(8);
    expect(orders.every((o) => o.operationalEpoch === OPERATIONAL_EPOCH)).toBe(true);
    expect(drivers.every((d) => d.joinedQueueAt == null)).toBe(true);
    expect(drivers.map((d) => orders.filter((o) => o.assignedMotoboyId === d.id).length).sort()).toEqual([2, 3, 3]);
  } finally {
    await cleanup(tag);
    expect(await getTaggedOrders(tag)).toHaveLength(0);
    expect(await getTaggedDrivers(tag)).toHaveLength(0);
  }
});

test('@smoke Smoke produção', async ({ page, request }) => {
  const tag = 'smoke';
  await cleanup(tag); await seedStore(tag);
  try {
    const health = await request.get(`${BASE_URL}/api/health`);
    expect(health.status()).toBe(200);
    const healthJson = await health.json();
    expect(healthJson.status).toBe('ok');
    expect(String(healthJson.commit || '')).not.toBe('');

    const manifest = await request.get(`${BASE_URL}/manifest.json`);
    expect(manifest.status()).toBe(200);
    const manifestJson = await manifest.json();
    expect(manifestJson.name || manifestJson.short_name).toBeTruthy();

    await loginStore(page, tag);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.json');
    await expect.poll(async () => page.evaluate(async () => Boolean(await navigator.serviceWorker?.getRegistration())).catch(() => false), { timeout: 30_000 }).toBe(true);
  } finally { await cleanup(tag); }
});
