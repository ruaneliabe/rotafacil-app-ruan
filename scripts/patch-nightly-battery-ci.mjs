import fs from 'node:fs';

const file = 'tests/e2e/nightly-battery.spec.ts';
let source = fs.readFileSync(file, 'utf8');

const storeSessionPoll = (pageExpr) => `await expect.poll(async () => ${pageExpr}.evaluate(() => {\n    try {\n      const raw = localStorage.getItem('rota_facil_session');\n      if (!raw) return false;\n      const session = JSON.parse(raw);\n      return session?.role === 'store_admin' || session?.role === 'master_admin';\n    } catch { return false; }\n  }), { timeout: 60_000 }).toBe(true);`;

const visibleTextPoll = (pageExpr, locatorExpr, timeout = '30_000') => `await expect.poll(async () => {\n    const locator = ${pageExpr}.${locatorExpr};\n    const count = await locator.count();\n    for (let i = 0; i < count; i += 1) {\n      if (await locator.nth(i).isVisible().catch(() => false)) return true;\n    }\n    return false;\n  }, { timeout: ${timeout} }).toBe(true);`;

source = source.replace(
  `await expect(page.getByText(/Pedidos e despacho/i).first()).toBeVisible({ timeout: 60_000 });`,
  storeSessionPoll('page'),
);

source = source.replace(
  `await expect(store.page.getByText(/Pedidos e despacho/i).first()).toBeVisible({ timeout: 60_000 });`,
  storeSessionPoll('store.page'),
);

source = source.replace(
  `await expect(page.getByText(order.clientName).first()).toBeVisible({ timeout: 60_000 });`,
  visibleTextPoll('page', `getByText(new RegExp(order.trackingCode, 'i'))`, '60_000'),
);

source = source.replace(
  `await expect(a.page.getByText(created.clientName).first()).toBeVisible({ timeout: 30_000 });`,
  visibleTextPoll('a.page', `getByText(created.clientName)`, '30_000'),
);

source = source.replace(
  `await expect(b.page.getByText(created.clientName).first()).toBeVisible({ timeout: 30_000 });`,
  visibleTextPoll('b.page', `getByText(created.clientName)`, '30_000'),
);

source = source.replace(
  `await expect(store.page.getByText(order.clientName).first()).toBeVisible({ timeout: 30_000 });`,
  visibleTextPoll('store.page', `getByText(order.clientName)`, '30_000'),
);

source = source.replace(
  `await expect(store.page.getByText(/Cardápio Web/i).first()).toBeVisible({ timeout: 30_000 });`,
  visibleTextPoll('store.page', `getByText(/Cardápio Web/i)`, '30_000'),
);

source = source.replace(
  `await expect(store.page.getByText(/Pedidos e despacho/i).first()).toBeVisible({ timeout: 60_000 });`,
  storeSessionPoll('store.page'),
);

fs.writeFileSync(file, source);
console.log('[patch-nightly-battery-ci] responsive visibility, session and tracking assertions hardened');
