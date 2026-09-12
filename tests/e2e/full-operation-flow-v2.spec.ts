import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
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
import { prepareOperationalShiftForTest, restoreOperationalShift } from './support/shift';

const numberEnv = (name: string, fallback: number) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const GPS_INTERVAL_MS = numberEnv('E2E_GPS_INTERVAL_MS', 5000);
const GPS_STEPS_PER_LEG = Math.max(1, Math.floor(numberEnv('E2E_GPS_STEPS_PER_LEG', 2)));
const RETURN_HOLD_MS = Math.max(2500, numberEnv('E2E_RETURN_HOLD_MS', 3500));

type Point = { latitude: number; longitude: number };
type Telemetry = { at: string; type: string; label: string; data?: Record<string, unknown> };

const criticalConsolePattern = /resource-exhausted|quota exceeded|permission-denied|react.*#310|uncaught|unhandled/i;

const nowIso = () => new Date().toISOString();
const pushTelemetry = (log: Telemetry[], type: string, label: string, data?: Record<string, unknown>) => {
  log.push({ at: nowIso(), type, label, data });
  console.log(`[E2E][${type}] ${label}${data ? ` ${JSON.stringify(data)}` : ''}`);
};

async function attachTelemetry(testInfo: TestInfo, telemetry: Telemetry[]) {
  await testInfo.attach('flow-telemetry.json', {
    body: Buffer.from(JSON.stringify(telemetry, null, 2), 'utf8'),
    contentType: 'application/json',
  });
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.png`);
  await page.screenshot({ path, fullPage: true }).catch(() => undefined);
  await testInfo.attach(name, { path, contentType: 'image/png' }).catch(() => undefined);
}

async function browserGps(page: Page): Promise<Point> {
  return page.evaluate(() => new Promise<Point>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (error) => reject(new Error(`geolocation error ${error.code}: ${error.message}`)),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  }));
}

async function moveGps(
  page: Page,
  context: BrowserContext,
  from: Point,
  to: Point,
  label: string,
  telemetry: Telemetry[],
) {
  for (let step = 1; step <= GPS_STEPS_PER_LEG; step += 1) {
    const ratio = step / GPS_STEPS_PER_LEG;
    const point = {
      latitude: from.latitude + (to.latitude - from.latitude) * ratio,
      longitude: from.longitude + (to.longitude - from.longitude) * ratio,
      accuracy: 8,
    };

    await context.setGeolocation(point);
    await page.waitForTimeout(250);
    const observed = await browserGps(page);

    expect(Math.abs(observed.latitude - point.latitude)).toBeLessThan(0.00005);
    expect(Math.abs(observed.longitude - point.longitude)).toBeLessThan(0.00005);

    pushTelemetry(telemetry, 'gps', label, {
      step,
      totalSteps: GPS_STEPS_PER_LEG,
      latitude: Number(observed.latitude.toFixed(6)),
      longitude: Number(observed.longitude.toFixed(6)),
      intervalMs: GPS_INTERVAL_MS,
    });

    await page.waitForTimeout(GPS_INTERVAL_MS);
  }
}

async function loginStore(page: Page, telemetry: Telemetry[]) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="store-user"]').fill(STORE_USER);
  await page.locator('input[name="store-pass"]').fill(STORE_PASS);
  await page.getByRole('button', { name: /Entrar no Painel/i }).click();
  await expect(page.getByText(/Pedidos e despacho/i).first()).toBeVisible({ timeout: 60_000 });
  pushTelemetry(telemetry, 'store', 'login concluído');
}

async function createOrder(page: Page, input: (typeof ORDER_INPUTS)[number], index: number, telemetry: Telemetry[]) {
  const openOrder = page.getByRole('button', { name: /^\+?\s*Pedido$/i }).last();
  await expect(openOrder).toBeVisible({ timeout: 30_000 });
  await expect(openOrder).toBeEnabled({ timeout: 30_000 });
  await openOrder.click();

  const modalHeading = page.getByRole('heading', { name: /^Lançar Pedido #\d+/i });
  await expect(modalHeading).toBeVisible({ timeout: 20_000 });

  await page.getByPlaceholder('Ex: João Silva').fill(input.name);
  await page.getByPlaceholder('(47) 99999-8888').fill(`47999993${String(index + 1).padStart(3, '0')}`);
  await page.getByPlaceholder('Ex: Rua XV de Novembro').fill(input.street);
  await page.getByPlaceholder('Ex: 653 ou S/N').fill(input.number);
  await page.getByPlaceholder('Ex: Velha Central').fill(input.neighborhood);

  const manual = page.getByRole('button', { name: /^Manual$/i }).last();
  if (await manual.isVisible().catch(() => false)) await manual.click();

  const submit = page.getByRole('button', { name: /CONFIRMAR E LANÇAR PEDIDO/i });
  await expect(submit).toBeEnabled({ timeout: 20_000 });
  await submit.click();
  await expect(modalHeading).toBeHidden({ timeout: 30_000 });
  pushTelemetry(telemetry, 'order', 'pedido criado', { clientName: input.name });
}

async function selectLooseOrder(page: Page, clientName: string) {
  const button = page.getByRole('button', { name: new RegExp(clientName, 'i') }).first();
  await expect(button).toBeVisible({ timeout: 30_000 });
  await button.click();
}

async function buildRoute(page: Page, clientNames: string[], telemetry: Telemetry[]) {
  for (const name of clientNames) await selectLooseOrder(page, name);
  const label = clientNames.length === 1 ? /Montar saída/i : /Montar rota/i;
  const button = page.getByRole('button', { name: label }).last();
  await expect(button).toBeVisible({ timeout: 10_000 });
  await expect(button).toBeEnabled({ timeout: 10_000 });
  await button.click();
  await page.waitForTimeout(500);
  pushTelemetry(telemetry, 'route', 'rota montada', { clients: clientNames });
}

async function markOrderReady(page: Page, clientName: string) {
  const readyName = /Pronto(?: p\/ Entrega| ➔)?$/i;
  const row = page.locator('div').filter({ hasText: clientName }).filter({
    has: page.getByRole('button', { name: readyName }),
  }).last();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole('button', { name: readyName }).first().click();
}

async function loginDriver(page: Page, driver: (typeof DRIVERS)[number], telemetry: Telemetry[]) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.json');
  await expect.poll(async () => page.evaluate(async () => Boolean(await navigator.serviceWorker?.getRegistration())).catch(() => false), {
    timeout: 30_000,
  }).toBe(true);

  await page.getByRole('button', { name: /^Entregador$/i }).click();
  await page.locator('input[name="driver-user"]').fill(driver.username);
  await page.locator('input[name="driver-pass"]').fill(driver.password);
  await page.getByRole('button', { name: /Acessar Entregador/i }).click();
  await expect(page.getByRole('button', { name: /Entrar na fila/i })).toBeVisible({ timeout: 60_000 });
  pushTelemetry(telemetry, 'driver', 'login PWA concluído', { driverId: driver.id });
}

async function waitForDriverStatus(id: string, status: string, timeout = 30_000) {
  await expect.poll(async () => (await getDriver(id))?.status, { timeout }).toBe(status);
}

async function waitForDriverAvailable(id: string) {
  await waitForDriverStatus(id, 'available');
}

async function finishDriverRoute(
  page: Page,
  context: BrowserContext,
  driverId: string,
  consoleErrors: string[],
  telemetry: Telemetry[],
  testInfo: TestInfo,
) {
  await test.step(`${driverId}: confirmar retirada`, async () => {
    const pickup = page.getByRole('button', { name: /Confirmar retirada/i });
    await expect(pickup).toBeVisible({ timeout: 60_000 });
    await pickup.click();

    const start = page.getByRole('button', { name: /Iniciar rota/i });
    await expect(start).toBeVisible({ timeout: 30_000 });
    await start.click();
    await waitForDriverStatus(driverId, 'delivering');
    pushTelemetry(telemetry, 'driver', 'rota iniciada', { driverId });
  });

  const assigned = (await getE2EOrders())
    .filter((order) => order.assignedMotoboyId === driverId)
    .sort((a, b) => Number(a.routeSequence || 999) - Number(b.routeSequence || 999) || String(a.clientName).localeCompare(String(b.clientName)));

  expect(assigned.length, `O motoboy ${driverId} deve receber pelo menos um pedido`).toBeGreaterThan(0);
  pushTelemetry(telemetry, 'driver', 'pedidos atribuídos', { driverId, count: assigned.length, clients: assigned.map((o) => o.clientName) });

  let current: Point = STORE_LOCATION;
  for (const [index, order] of assigned.entries()) {
    await test.step(`${driverId}: GPS até ${order.clientName} + entrega ${index + 1}/${assigned.length}`, async () => {
      const target = { latitude: Number(order.lat), longitude: Number(order.lng) };
      expect(Number.isFinite(target.latitude) && Number.isFinite(target.longitude), `GPS inválido para ${order.clientName}`).toBe(true);

      await moveGps(page, context, current, target, `${driverId} -> ${order.clientName}`, telemetry);
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

      pushTelemetry(telemetry, 'delivery', 'entrega concluída', { driverId, clientName: order.clientName, orderId: order.id });

      const next = page.getByRole('button', { name: /Iniciar próxima|Próxima entrega|Seguir para próxima/i }).first();
      if (index < assigned.length - 1 && await next.isVisible().catch(() => false)) await next.click();
    });
  }

  await test.step(`${driverId}: validar retorno NÃO automático`, async () => {
    await expect(page.getByText(/Rota concluída/i)).toBeVisible({ timeout: 30_000 });
    const returningButton = page.getByRole('button', { name: /Estou retornando/i });
    await expect(returningButton).toBeVisible({ timeout: 30_000 });

    // Regressão crítica: depois da última entrega o sistema NÃO pode pular sozinho
    // para returning_to_store nem exibir Entrar na fila antes do clique explícito.
    await waitForDriverStatus(driverId, 'delivering');
    await expect(page.getByRole('button', { name: /Entrar na fila/i })).toHaveCount(0);
    await page.waitForTimeout(RETURN_HOLD_MS);
    await waitForDriverStatus(driverId, 'delivering');
    await expect(returningButton).toBeVisible();
    await expect(page.getByRole('button', { name: /Entrar na fila/i })).toHaveCount(0);

    await screenshot(page, testInfo, `${driverId}-rota-concluida-aguardando-retorno`);
    pushTelemetry(telemetry, 'return', 'aguardou clique Estou retornando sem autoavanço', { driverId, holdMs: RETURN_HOLD_MS });

    await returningButton.click();
    await waitForDriverStatus(driverId, 'returning_to_store');
    await expect(page.getByText(/Retornando para a loja/i).first()).toBeVisible({ timeout: 30_000 });
    pushTelemetry(telemetry, 'return', 'retorno iniciado explicitamente', { driverId });
  });

  await test.step(`${driverId}: GPS de retorno + entrada na fila`, async () => {
    await moveGps(page, context, current, STORE_LOCATION, `${driverId} -> loja`, telemetry);

    const enterQueue = page.getByRole('button', { name: /Entrar na fila/i });
    await expect(enterQueue).toBeVisible({ timeout: 30_000 });
    await screenshot(page, testInfo, `${driverId}-retorno-concluido`);
    await enterQueue.click();
    await waitForDriverAvailable(driverId);

    const snapshot = await getDriver(driverId);
    expect(Number(snapshot?.joinedQueueAt)).toBeGreaterThan(0);
    pushTelemetry(telemetry, 'queue', 'retornou e entrou no fim da fila', { driverId, joinedQueueAt: snapshot?.joinedQueueAt });
  });

  const critical = consoleErrors.filter((line) => criticalConsolePattern.test(line));
  expect(critical, `Erros críticos no console do ${driverId}:\n${critical.join('\n')}`).toEqual([]);
}

test('PWA ponta a ponta: 8 pedidos, 3 rotas, 3 motoboys, GPS a cada 5s e retorno explícito', async ({ browser }, testInfo) => {
  test.setTimeout(15 * 60 * 1000);
  const telemetry: Telemetry[] = [];
  const contexts: BrowserContext[] = [];
  const storeConsoleErrors: string[] = [];

  pushTelemetry(telemetry, 'test', 'início', {
    baseUrl: process.env.E2E_BASE_URL || 'https://rotafacil-app-ruan.onrender.com',
    gpsIntervalMs: GPS_INTERVAL_MS,
    gpsStepsPerLeg: GPS_STEPS_PER_LEG,
  });

  await cleanupFullFlowData();
  await prepareOperationalShiftForTest();
  await seedFullFlowIdentities();

  try {
    const storeContext = await browser.newContext({ viewport: { width: 1536, height: 1000 } });
    contexts.push(storeContext);
    await storeContext.addInitScript(() => {
      localStorage.removeItem('rotafacil_prepared_routes_preview_v2');
      localStorage.removeItem('rotafacil_prepared_routes_preview_v2_backup');
      localStorage.removeItem('rota_facil_session');
    });
    const store = await storeContext.newPage();
    store.on('console', (msg) => { if (msg.type() === 'error') storeConsoleErrors.push(`[store] ${msg.text()}`); });

    await test.step('Loja: login e criação dos 8 pedidos', async () => {
      await loginStore(store, telemetry);
      for (let i = 0; i < ORDER_INPUTS.length; i += 1) await createOrder(store, ORDER_INPUTS[i], i, telemetry);
      const created = await waitForOrderCount(8);
      expect(created).toHaveLength(8);
      expect(new Set(created.map((order) => order.id)).size).toBe(8);
      await screenshot(store, testInfo, 'loja-8-pedidos-criados');
    });

    await test.step('Loja: montar 3 rotas 3+3+2', async () => {
      await store.getByText(/Pedidos e despacho/i).first().click();
      await buildRoute(store, ['PW FLOW 01', 'PW FLOW 02', 'PW FLOW 03'], telemetry);
      await buildRoute(store, ['PW FLOW 04', 'PW FLOW 05', 'PW FLOW 06'], telemetry);
      await buildRoute(store, ['PW FLOW 07', 'PW FLOW 08'], telemetry);
      await expect(store.getByText(/Rotas montadas/i)).toBeVisible();
      await screenshot(store, testInfo, 'loja-3-rotas-montadas');
    });

    await test.step('Loja: marcar todos os pedidos prontos', async () => {
      await store.getByText(/^Kanban$/i).first().click();
      for (const input of ORDER_INPUTS) await markOrderReady(store, input.name);
      await expect.poll(async () => (await getE2EOrders()).map((order) => order.status), {
        timeout: 60_000,
      }).toEqual(Array(8).fill('ready_at_counter'));
      pushTelemetry(telemetry, 'store', '8 pedidos prontos');
    });

    await store.getByText(/Pedidos e despacho/i).first().click();
    await expect(store.getByText(/Próximo a sair/i)).toBeVisible({ timeout: 30_000 });
    await expect(store.getByText(/ROTA PRONTA/i).first()).toBeVisible({ timeout: 30_000 });

    const driverPages: Page[] = [];
    const driverContexts: BrowserContext[] = [];
    const driverConsoleErrors: string[][] = [[], [], []];

    await test.step('PWA: abrir 3 motoboys, validar manifest/SW e entrar na fila em FIFO', async () => {
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

        await loginDriver(page, DRIVERS[i], telemetry);
        await page.getByRole('button', { name: /Entrar na fila/i }).click();
        await waitForDriverAvailable(DRIVERS[i].id);
        await page.waitForTimeout(1200);
      }

      const queue = await Promise.all(DRIVERS.map((driver) => getDriver(driver.id)));
      expect(queue.map((driver) => driver?.status)).toEqual(['available', 'available', 'available']);
      expect(Number(queue[0]?.joinedQueueAt)).toBeLessThan(Number(queue[1]?.joinedQueueAt));
      expect(Number(queue[1]?.joinedQueueAt)).toBeLessThan(Number(queue[2]?.joinedQueueAt));
      pushTelemetry(telemetry, 'queue', 'FIFO validado', { order: DRIVERS.map((d) => d.id) });
    });

    for (let i = 0; i < DRIVERS.length; i += 1) {
      await test.step(`Despacho + rota completa do ${DRIVERS[i].name}`, async () => {
        const firstName = DRIVERS[i].name.split(' ')[0];
        const call = store.getByRole('button', { name: new RegExp(`Chamar ${firstName}.*balcão`, 'i') }).first();
        await expect(call).toBeVisible({ timeout: 30_000 });
        await call.click();

        await expect.poll(async () => {
          const orders = await getE2EOrders();
          return orders.filter((order) => order.assignedMotoboyId === DRIVERS[i].id).length;
        }, { timeout: 30_000 }).toBeGreaterThan(0);

        const called = await getDriver(DRIVERS[i].id);
        expect(called?.joinedQueueAt == null || called?.joinedQueueAt === 0).toBe(true);
        pushTelemetry(telemetry, 'dispatch', 'motoboy chamado e removido da fila', { driverId: DRIVERS[i].id });

        await finishDriverRoute(
          driverPages[i],
          driverContexts[i],
          DRIVERS[i].id,
          driverConsoleErrors[i],
          telemetry,
          testInfo,
        );
      });
    }

    await test.step('Validação final de integridade', async () => {
      const finalOrders = await getE2EOrders();
      expect(finalOrders).toHaveLength(8);
      expect(finalOrders.every((order) => order.status === 'delivered')).toBe(true);
      expect(new Set(finalOrders.map((order) => order.id)).size).toBe(8);

      const distribution = DRIVERS.map((driver) => finalOrders.filter((order) => order.assignedMotoboyId === driver.id).length);
      expect(distribution).toEqual([3, 3, 2]);

      const finalDrivers = await Promise.all(DRIVERS.map((driver) => getDriver(driver.id)));
      expect(finalDrivers.map((driver) => driver?.status)).toEqual(['available', 'available', 'available']);
      expect(finalDrivers.every((driver) => Number(driver?.joinedQueueAt) > 0)).toBe(true);

      const criticalStore = storeConsoleErrors.filter((line) => criticalConsolePattern.test(line));
      expect(criticalStore, `Erros críticos no console da loja:\n${criticalStore.join('\n')}`).toEqual([]);
      pushTelemetry(telemetry, 'test', 'fluxo completo aprovado', { distribution });
      await screenshot(store, testInfo, 'loja-fluxo-finalizado');
    });
  } finally {
    await attachTelemetry(testInfo, telemetry).catch(() => undefined);
    await Promise.allSettled(contexts.map((context) => context.close()));
    await cleanupFullFlowData().catch(() => undefined);
    await restoreOperationalShift().catch(() => undefined);
  }
});
