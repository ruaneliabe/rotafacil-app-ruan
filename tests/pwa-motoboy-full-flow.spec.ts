import { expect, test } from '@playwright/test';
import { moveGps } from './helpers/gps';

const num = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const START = {
  latitude: num('E2E_START_LAT', -26.9194),
  longitude: num('E2E_START_LNG', -49.0661),
};

const END = {
  latitude: num('E2E_END_LAT', -26.9280),
  longitude: num('E2E_END_LNG', -49.1090),
};

const GPS_INTERVAL_MS = num('E2E_GPS_INTERVAL_MS', 5000);
const GPS_DURATION_MS = num('E2E_GPS_DURATION_MS', 60_000);
const DRIVER_USER = process.env.E2E_DRIVER_USER || 'teste_lucas';
const DRIVER_PASS = process.env.E2E_DRIVER_PASS || 'Teste1234';

test.describe('Rota Fácil PWA - fluxo completo do entregador com GPS móvel', () => {
  test('login -> retirada -> rota -> GPS X/Y -> entrega concluída', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ ...START, accuracy: 8 });

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Login real do PWA do motoboy.
    await page.getByRole('button', { name: 'Entregador' }).click();
    await page.locator('input[name="driver-user"]').fill(DRIVER_USER);
    await page.locator('input[name="driver-pass"]').fill(DRIVER_PASS);
    await page.getByRole('button', { name: /Acessar Entregador/i }).click();

    await expect(page.getByText(/Bem-vindo|entregador/i).first()).toBeVisible({ timeout: 20_000 }).catch(() => {});

    // Pré-condição do teste: a loja já deve ter chamado este motoboy e deixado
    // pelo menos um pedido em ready_at_counter. O teste valida o fluxo real do PWA.
    const pickup = page.getByRole('button', { name: /Confirmar retirada dos \d+ pedidos/i });
    await expect(pickup).toBeVisible({ timeout: 60_000 });
    await pickup.click();

    const startRoute = page.getByRole('button', { name: /Iniciar rota/i });
    await expect(startRoute).toBeVisible({ timeout: 20_000 });
    await startRoute.click();

    // O navigator.geolocation.watchPosition do app recebe uma nova posição a
    // cada 5s (configurável), exatamente como um celular se deslocando de X a Y.
    await moveGps(context, START, END, {
      intervalMs: GPS_INTERVAL_MS,
      durationMs: GPS_DURATION_MS,
      onStep: async (point, index) => {
        console.log(`[gps] #${index} ${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`);
      },
    });

    // Primeira entrega da rota.
    const arrived = page.getByRole('button', { name: /^Cheguei$/i }).first();
    await expect(arrived).toBeVisible({ timeout: 20_000 });
    await arrived.click();

    const finish = page.getByRole('button', { name: /Concluir entrega/i }).first();
    await expect(finish).toBeVisible({ timeout: 20_000 });
    await finish.click();

    // Se houver mais paradas, percorre o mesmo fluxo de forma sequencial.
    for (let safety = 0; safety < 10; safety += 1) {
      const next = page.getByRole('button', { name: /Próxima parada/i }).first();
      if (!(await next.isVisible().catch(() => false))) break;

      await next.click();
      const nextArrived = page.getByRole('button', { name: /^Cheguei$/i }).first();
      await expect(nextArrived).toBeVisible({ timeout: 20_000 });
      await nextArrived.click();

      const nextFinish = page.getByRole('button', { name: /Concluir entrega/i }).first();
      await expect(nextFinish).toBeVisible({ timeout: 20_000 });
      await nextFinish.click();
    }

    // Não falha por warnings conhecidos; falha só pelos erros críticos que queremos caçar.
    const critical = consoleErrors.filter((line) =>
      /resource-exhausted|quota exceeded|permission-denied|uncaught|react.*#310/i.test(line),
    );
    expect(critical, `Erros críticos no console:\n${critical.join('\n')}`).toEqual([]);
  });
});
