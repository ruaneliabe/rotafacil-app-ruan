import { expect, test } from '@playwright/test';
import { moveGps } from './helpers/gps';
import {
  cleanupPwaFlowFixture,
  DRIVER_PASS,
  DRIVER_USER,
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
const GPS_DURATION_MS = num('E2E_GPS_DURATION_MS', 30_000);

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

    // Login real do PWA, usando um motoboy isolado criado só para este teste.
    await page.getByRole('button', { name: 'Entregador' }).click();
    await page.locator('input[name="driver-user"]').fill(DRIVER_USER);
    await page.locator('input[name="driver-pass"]').fill(DRIVER_PASS);
    await page.getByRole('button', { name: /Acessar Entregador/i }).click();

    // Os dois pedidos do fixture já estão vinculados e prontos no balcão.
    const pickup = page.getByRole('button', { name: /Confirmar retirada dos 2 pedidos/i });
    await expect(pickup).toBeVisible({ timeout: 60_000 });
    await pickup.click();

    const startRoute = page.getByRole('button', { name: /Iniciar rota/i });
    await expect(startRoute).toBeVisible({ timeout: 20_000 });
    await startRoute.click();

    // Simula o celular se deslocando de X até Y. O browser dispara novas posições
    // para navigator.geolocation.watchPosition a cada 5 segundos por padrão.
    await moveGps(context, START, END, {
      intervalMs: GPS_INTERVAL_MS,
      durationMs: GPS_DURATION_MS,
      onStep: async (point, index) => {
        console.log(`[gps] #${index} ${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`);
      },
    });

    // Finaliza todas as paradas visíveis da rota. O app promove automaticamente
    // a próxima parada depois que a anterior é concluída.
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

    const critical = consoleErrors.filter((line) =>
      /resource-exhausted|quota exceeded|permission-denied|uncaught|react.*#310/i.test(line),
    );
    expect(critical, `Erros críticos no console:\n${critical.join('\n')}`).toEqual([]);
  });
});
