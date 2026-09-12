import { expect, test, type Page } from '@playwright/test';
import { moveGps } from './helpers/gps';
import {
  cleanupPwaFlowFixture,
  DRIVER_PASS,
  DRIVER_USER,
  readTestDriver,
  readTestOrders,
  seedPwaFlowFixture,
} from './helpers/firebase-fixture';

const num = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const START = {
  latitude: num('E2E_START_LAT', -26.9204),
  longitude: num('E2E_START_LNG', -49.0982),
};

const END = {
  latitude: num('E2E_END_LAT', -26.9176),
  longitude: num('E2E_END_LNG', -49.0927),
};

const GPS_INTERVAL_MS = num('E2E_GPS_INTERVAL_MS', 5000);
const GPS_DURATION_MS = num('E2E_GPS_DURATION_MS', 60_000);

const closeTo = (a: number, b: number, tolerance = 0.0002) => Math.abs(a - b) <= tolerance;

async function readBrowserGpsSafely(page: Page) {
  if (page.isClosed()) return null;

  return page.evaluate(() => new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (value: { latitude: number; longitude: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timer = window.setTimeout(() => finish(null), 4000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        finish({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        window.clearTimeout(timer);
        finish(null);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 3000 },
    );
  })).catch(() => null);
}

test.describe('Rota Fácil PWA - fluxo completo do entregador com GPS móvel', () => {
  test.beforeEach(async () => {
    await seedPwaFlowFixture();
  });

  test.afterEach(async () => {
    await cleanupPwaFlowFixture();
  });

  test('login -> retirada -> rota -> GPS X/Y -> todas as entregas concluídas', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ ...START, accuracy: 8 });

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Confirma que estamos realmente exercitando a versão PWA.
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.json');
    await expect.poll(async () => {
      return page.evaluate(async () => Boolean(await navigator.serviceWorker?.getRegistration())).catch(() => false);
    }, { timeout: 30_000 }).toBe(true);

    // Login real do PWA com um motoboy isolado criado só para o teste.
    await page.getByRole('button', { name: 'Entregador' }).click();
    await page.locator('input[name="driver-user"]').fill(DRIVER_USER);
    await page.locator('input[name="driver-pass"]').fill(DRIVER_PASS);
    await page.getByRole('button', { name: /Acessar Entregador/i }).click();

    const pickup = page.getByRole('button', { name: /Confirmar retirada dos 2 pedidos/i });
    await expect(pickup).toBeVisible({ timeout: 60_000 });
    await pickup.click();

    await expect.poll(async () => {
      const orders = await readTestOrders();
      return orders.map((o) => o?.status);
    }, { timeout: 20_000 }).toEqual(['picked_up', 'picked_up']);

    const startRoute = page.getByRole('button', { name: /Iniciar rota/i });
    await expect(startRoute).toBeVisible({ timeout: 20_000 });
    await startRoute.click();

    await expect.poll(async () => {
      const [first, second] = await readTestOrders();
      const driver = await readTestDriver();
      return [first?.status, second?.status, driver?.status];
    }, { timeout: 20_000 }).toEqual(['in_transit', 'picked_up', 'delivering']);

    // Move o GPS de X para Y em passos reais a cada 5 segundos por padrão.
    // O app mantém GPS local fluido e limita escrita em nuvem, então validamos os dois lados.
    await moveGps(context, START, END, {
      intervalMs: GPS_INTERVAL_MS,
      durationMs: GPS_DURATION_MS,
      onStep: async (point, index) => {
        console.log(`[gps] #${index} ${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`);
      },
    });

    // O PWA pode navegar/reidratar enquanto o GPS está sendo alterado. A leitura anterior
    // podia ficar pendurada até o timeout de 10 minutos e morrer com "Execution context was destroyed".
    // Agora cada tentativa tem timeout próprio, tolera navegação e repete até a página estabilizar.
    await expect.poll(async () => {
      const browserGps = await readBrowserGpsSafely(page);
      if (!browserGps) return false;
      return closeTo(browserGps.latitude, END.latitude) && closeTo(browserGps.longitude, END.longitude);
    }, {
      timeout: 30_000,
      intervals: [500, 1000, 2000],
      message: 'O navegador deve receber a posição GPS final Y mesmo se o PWA navegar/reidratar',
    }).toBe(true);

    // Como o app grava no Firestore no máximo a cada 45s, não exigimos que a posição
    // em nuvem seja exatamente Y; exigimos que ela tenha realmente avançado a partir de X.
    await expect.poll(async () => {
      const driver = await readTestDriver();
      if (!driver || typeof driver.currentLat !== 'number' || typeof driver.currentLng !== 'number') return false;
      const movedLat = Math.abs(driver.currentLat - START.latitude) > 0.0003;
      const movedLng = Math.abs(driver.currentLng - START.longitude) > 0.0003;
      return movedLat || movedLng;
    }, { timeout: 70_000 }).toBe(true);

    // Finaliza as duas paradas da rota.
    let completed = 0;
    for (let safety = 0; safety < 5; safety += 1) {
      const arrived = page.getByRole('button', { name: /^Cheguei$/i }).first();
      if (!(await arrived.isVisible().catch(() => false))) break;

      await arrived.click();
      const finish = page.getByRole('button', { name: /Concluir entrega/i }).first();
      await expect(finish).toBeVisible({ timeout: 20_000 });
      await finish.click();
      completed += 1;
      await page.waitForTimeout(1200);
    }

    expect(completed).toBe(2);

    await expect.poll(async () => {
      const orders = await readTestOrders();
      return orders.map((o) => o?.status);
    }, { timeout: 30_000 }).toEqual(['delivered', 'delivered']);

    await expect.poll(async () => (await readTestDriver())?.status, { timeout: 30_000 }).toBe('returning_to_store');

    const critical = consoleErrors.filter((line) =>
      /resource-exhausted|quota exceeded|permission-denied|uncaught|react.*#310/i.test(line),
    );
    expect(critical, `Erros críticos no console:\n${critical.join('\n')}`).toEqual([]);
  });
});
