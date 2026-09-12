import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  cleanupFullFlowData,
  DRIVERS,
  getDriver,
  getE2EOrders,
  ORDER_INPUTS,
  seedFullFlowIdentities,
  STORE_LOCATION,
  STORE_PASS,
  STORE_USER,
  waitForOrderCount,
} from './support/fixture';

const numberEnv = (name: string, fallback: number) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const GPS_INTERVAL_MS = numberEnv('E2E_GPS_INTERVAL_MS', 5000);
const GPS_STEPS_PER_LEG = Math.max(1, Math.floor(numberEnv('E2E_GPS_STEPS_PER_LEG', 2)));

type Point = { latitude: number; longitude: number };

const criticalConsolePattern = /resource-exhausted|quota exceeded|permission-denied|react.*#310|uncaught/i;

async function moveGps(context: BrowserContext, from: Point, to: Point, label: string) {
  for (let step = 1; step <= GPS_STEPS_PER_LEG; step += 1) {
    const ratio = step / GPS_STEPS_PER_LEG;
    const point = {
      latitude: from.latitude + (to.latitude - from.latitude) * ratio,
      longitude: from.longitude + (to.longitude - from.longitude) * ratio,
      accuracy: 8,
    };
    await context.setGeolocation(point);
    console.log(`[GPS][${label}] ${step}/${GPS_STEPS_PER_LEG}: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`);
    await new Promise((resolve) => setTimeout(resolve, GPS_INTERVAL_MS));
  }
}

async function loginStore(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="store-user"]').fill(STORE_USER);
  await page.locator('input[name="store-pass"]').fill(STORE_PASS);
  await page.getByRole('button', { name: /Entrar no Painel/i }).click();
  await expect(page.getByText(/Pedidos e despacho/i).first()).toBeVisible({ timeout: 60_000 });
}

async function createOrder(page: Page, input: (typeof ORDER_INPUTS)[number], index: number) {
  await page.getByRole('button', { name: /\+?\s*Pedido/i }).first().click();
  await expect(page.getByText(/Lançar Pedido/i)).toBeVisible({ timeout: 20_000 });

  await page.getByPlaceholder('Ex: João Silva').fill(input.name);
  await page.getByPlaceholder('(47) 99999-8888').fill(`47999993${String(index + 1).padStart(3, '0')}`);
  await page.getByPlaceholder('Ex: Rua XV de Novembro').fill(input.street);
  await page.getByPlaceholder('Ex: 653 ou S/N').fill(input.number);
  await page.getByPlaceholder('Ex: Velha Central').fill(input.neighborhood);

  const manual = page.getByRole('button', { name: /Manual/i }).last();
  if (await manual.isVisible().catch(() => false)) await manual.click();

  await page.getByRole('button', { name: /CONFIRMAR E LANÇAR PEDIDO/i }).click();
  await expect(page.getByText(/Lançar Pedido/i)).toBeHidden({ timeout: 30_000 });
}

async function selectLooseOrder(page: Page, clientName: string) {
  const button = page.getByRole('button', { name: new RegExp(clientName, 'i') }).first();
  await expect(button).toBeVisible({ timeout: 30_000 });
  await button.click();
}

async function buildRoute(page: Page, clientNames: string[]) {
  for (const name of clientNames) await selectLooseOrder(page, name);
  const label = clientNames.length === 1 ? /Montar saída/i : /Montar rota/i;
  const button = page.getByRole('button', { name: label }).filter({ visible: true }).last();
  await expect(button).toBeEnabled({ timeout: 10_000 });
  await button.click();
  await page.waitForTimeout(500);
}

async function markOrderReady(page: Page, clientName: string) {
  const row = page.locator('div').filter({ hasText: clientName }).filter({
    has: page.getByRole('button', { name: /Pronto(?: p\/ Entrega| ➔)?$/i }),
  }).last();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const ready = row.getByRole('button', { name: /Pronto(?: p\/ Entrega| ➔)?$/i }).first();
  await ready.click();
}

async function loginDriver(page: Page, driver: (typeof DRIVERS)[number]) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Entregador$/i }).click();
  await page.locator('input[name="driver-user"]').fill(driver.username);
  await page.locator('input[name="driver-pass"]').fill(driver.password);
  await page.getByRole('button', { name: /Acessar Entregador/i }).click();
  await expect(page.getByRole('button', { name: /Entrar na fila/i })).toBeVisible({ timeout: 60_000 });
}

async function waitForDriverAvailable(id: string) {
  await expect.poll(async () => (await getDriver(id))?.status, { timeout: 30_000 }).toBe('available');
}

async function finishDriverRoute(
  page: Page,
  context: BrowserContext,
  driverId: string,
  consoleErrors: string[],
) {
  const pickup = page.getByRole('button', { name: /Confirmar retirada/i });
  await expect(pickup).toBeVisible({ timeout: 60_000 });
  await pickup.click();

  const start = page.getByRole('button', { name: /Iniciar rota/i });
  await expect(start).toBeVisible({ timeout: 30_000 });
  await start.click();

  await expect.poll(async () => (await getDriver(driverId))?.status, { timeout: 30_000 }).toBe('delivering');

  const assigned = (await getE2EOrders())
    .filter((order) => order.assignedMotoboyId === driverId)
    .sort((a, b) => Number(a.routeSequence || 999) - Number(b.routeSequence || 999) || String(a.clientName).localeCompare(String(b.clientName)));

  expect(assigned.length, `O motoboy ${driverId} deve receber pelo menos um pedido`).toBeGreaterThan(0);

  let current: Point = STORE_LOCATION;
  for (const order of assigned) {
    const target = {
      latitude: Number(order.lat),
      longitude: Number(order.lng),
    };

    await moveGps(context, current, target, `${driverId} -> ${order.clientName}`);
    current = target;

    const arrived = page.getByRole('button', { name: /^Cheguei$/i }).first();
    await expect(arrived).toBeVisible({ timeout: 30_000 });
    await arrived.click();

    const finish = page.getByRole('button', { name: /Concluir entrega/i }).first();
    await expect(finish).toBeVisible({ timeout: 30_000 });
    await finish.click();

    await expect.poll(async () => {
      const orders = await getE2EOrders();
      return orders.find((item) => item.id === order.id)?.status;
    }, { timeout: 30_000 }).toBe('delivered');

    const next = page.getByRole('button', { name: /Iniciar próxima|Próxima entrega|Seguir para próxima/i }).first();
    if (await next.isVisible().catch(() => false)) await next.click();
  }

  await expect(page.getByText(/Rota concluída/i)).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Estou retornando/i }).click();
  await expect.poll(async () => (await getDriver(driverId))?.status, { timeout: 30_000 }).toBe('returning_to_store');

  await moveGps(context, current, STORE_LOCATION, `${driverId} -> loja`);
  await expect(page.getByRole('button', { name: /Entrar na fila/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Entrar na fila/i }).click();
  await waitForDriverAvailable(driverId);

  const critical = consoleErrors.filter((line) => criticalConsolePattern.test(line));
  expect(critical, `Erros críticos no console do ${driverId}:\n${critical.join('\n')}`).toEqual([]);
}

test('fluxo completo: loja + 8 pedidos + 3 rotas + fila + 3 motoboys + GPS + retorno', async ({ browser }) => {
  test.setTimeout(12 * 60 * 1000);
  await cleanupFullFlowData();
  await seedFullFlowIdentities();

  const contexts: BrowserContext[] = [];
  const consoleErrors: string[] = [];

  try {
    const storeContext = await browser.newContext({ viewport: { width: 1536, height: 1000 } });
    contexts.push(storeContext);
    await storeContext.addInitScript(() => {
      localStorage.removeItem('rotafacil_prepared_routes_preview_v2');
      localStorage.removeItem('rotafacil_prepared_routes_preview_v2_backup');
      localStorage.removeItem('rota_facil_session');
    });
    const store = await storeContext.newPage();
    store.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[store] ${msg.text()}`); });

    await loginStore(store);

    for (let i = 0; i < ORDER_INPUTS.length; i += 1) {
      await createOrder(store, ORDER_INPUTS[i], i);
    }

    const created = await waitForOrderCount(8);
    expect(new Set(created.map((order) => order.id)).size).toBe(8);

    await store.getByText(/Pedidos e despacho/i).first().click();
    await buildRoute(store, ['PW FLOW 01', 'PW FLOW 02', 'PW FLOW 03']);
    await buildRoute(store, ['PW FLOW 04', 'PW FLOW 05', 'PW FLOW 06']);
    await buildRoute(store, ['PW FLOW 07', 'PW FLOW 08']);
    await expect(store.getByText(/Rotas montadas/i)).toBeVisible();

    await store.getByText(/^Kanban$/i).first().click();
    for (const input of ORDER_INPUTS) await markOrderReady(store, input.name);

    await expect.poll(async () => (await getE2EOrders()).map((order) => order.status), {
      timeout: 60_000,
    }).toEqual(Array(8).fill('ready_at_counter'));

    await store.getByText(/Pedidos e despacho/i).first().click();
    await expect(store.getByText(/Próximo a sair/i)).toBeVisible({ timeout: 30_000 });
    await expect(store.getByText(/ROTA PRONTA/i).first()).toBeVisible({ timeout: 30_000 });

    const driverPages: Page[] = [];
    const driverContexts: BrowserContext[] = [];
    const driverConsoleErrors: string[][] = [[], [], []];

    for (let i = 0; i < DRIVERS.length; i += 1) {
      const context = await browser.newContext({
        viewport: { width: 430, height: 900 },
        isMobile: true,
        hasTouch: true,
        permissions: ['geolocation'],
        geolocation: { ...STORE_LOCATION, accuracy: 8 },
      });
      contexts.push(context);
      driverContexts.push(context);
      await context.addInitScript(() => localStorage.removeItem('rota_facil_session'));
      const page = await context.newPage();
      page.on('console', (msg) => { if (msg.type() === 'error') driverConsoleErrors[i].push(msg.text()); });
      driverPages.push(page);

      await loginDriver(page, DRIVERS[i]);
      await page.getByRole('button', { name: /Entrar na fila/i }).click();
      await waitForDriverAvailable(DRIVERS[i].id);
      await page.waitForTimeout(1200);
    }

    await expect.poll(async () => {
      const snapshots = await Promise.all(DRIVERS.map((driver) => getDriver(driver.id)));
      return snapshots.map((driver) => driver?.status);
    }, { timeout: 30_000 }).toEqual(['available', 'available', 'available']);

    const queue = await Promise.all(DRIVERS.map((driver) => getDriver(driver.id)));
    expect(Number(queue[0]?.joinedQueueAt)).toBeLessThan(Number(queue[1]?.joinedQueueAt));
    expect(Number(queue[1]?.joinedQueueAt)).toBeLessThan(Number(queue[2]?.joinedQueueAt));

    for (let i = 0; i < DRIVERS.length; i += 1) {
      const firstName = DRIVERS[i].name.split(' ')[0];
      const call = store.getByRole('button', { name: new RegExp(`Chamar ${firstName}.*balcão`, 'i') }).first();
      await expect(call).toBeVisible({ timeout: 30_000 });
      await call.click();

      await expect.poll(async () => {
        const orders = await getE2EOrders();
        return orders.filter((order) => order.assignedMotoboyId === DRIVERS[i].id).length;
      }, { timeout: 30_000 }).toBeGreaterThan(0);

      await finishDriverRoute(driverPages[i], driverContexts[i], DRIVERS[i].id, driverConsoleErrors[i]);
    }

    const finalOrders = await getE2EOrders();
    expect(finalOrders).toHaveLength(8);
    expect(finalOrders.every((order) => order.status === 'delivered')).toBe(true);
    expect(new Set(finalOrders.map((order) => order.id)).size).toBe(8);

    const distribution = DRIVERS.map((driver) => finalOrders.filter((order) => order.assignedMotoboyId === driver.id).length);
    expect(distribution).toEqual([3, 3, 2]);

    const finalDrivers = await Promise.all(DRIVERS.map((driver) => getDriver(driver.id)));
    expect(finalDrivers.map((driver) => driver?.status)).toEqual(['available', 'available', 'available']);

    const criticalStore = consoleErrors.filter((line) => criticalConsolePattern.test(line));
    expect(criticalStore, `Erros críticos no console da loja:\n${criticalStore.join('\n')}`).toEqual([]);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    await cleanupFullFlowData();
  }
});
