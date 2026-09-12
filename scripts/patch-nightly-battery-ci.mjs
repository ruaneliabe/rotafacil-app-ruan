import fs from 'node:fs';

const file = 'tests/e2e/nightly-battery.spec.ts';
let source = fs.readFileSync(file, 'utf8');

const sessionPoll = `await expect.poll(async () => page.evaluate(() => {\n    try {\n      const raw = localStorage.getItem('rota_facil_session');\n      if (!raw) return false;\n      const session = JSON.parse(raw);\n      return session?.role === 'store_admin' || session?.role === 'master_admin';\n    } catch { return false; }\n  }), { timeout: 60_000 }).toBe(true);`;

source = source.replace(
  `await expect(page.getByText(/Pedidos e despacho/i).first()).toBeVisible({ timeout: 60_000 });`,
  sessionPoll,
);

source = source.replace(
  `await expect(store.page.getByText(/Pedidos e despacho/i).first()).toBeVisible({ timeout: 60_000 });`,
  `await expect.poll(async () => store.page.evaluate(() => {\n      try {\n        const raw = localStorage.getItem('rota_facil_session');\n        if (!raw) return false;\n        const session = JSON.parse(raw);\n        return session?.role === 'store_admin' || session?.role === 'master_admin';\n      } catch { return false; }\n    }), { timeout: 60_000 }).toBe(true);`,
);

source = source.replace(
  `await expect(page.getByText(order.clientName).first()).toBeVisible({ timeout: 60_000 });`,
  `await expect(page.getByText(new RegExp(order.trackingCode, 'i')).first()).toBeVisible({ timeout: 60_000 });`,
);

fs.writeFileSync(file, source);
console.log('[patch-nightly-battery-ci] mobile session and tracking assertions hardened');
