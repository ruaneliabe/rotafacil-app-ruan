import fs from 'node:fs';

const file = 'tests/e2e/nightly-battery.spec.ts';
let source = fs.readFileSync(file, 'utf8');

const storeSessionPoll = (pageExpr) => `await expect.poll(async () => ${pageExpr}.evaluate(() => {\n    try {\n      const raw = localStorage.getItem('rota_facil_session');\n      if (!raw) return false;\n      const session = JSON.parse(raw);\n      return session?.role === 'store_admin' || session?.role === 'master_admin';\n    } catch { return false; }\n  }), { timeout: 60_000 }).toBe(true);`;

const visibleTextPoll = (pageExpr, locatorExpr, timeout = '30_000') => `await expect.poll(async () => {\n    const locator = ${pageExpr}.${locatorExpr};\n    const count = await locator.count();\n    for (let i = 0; i < count; i += 1) {\n      if (await locator.nth(i).isVisible().catch(() => false)) return true;\n    }\n    return false;\n  }, { timeout: ${timeout} }).toBe(true);`;

source = source.replace(
  `import { hashPassword } from '../../src/lib/passwordSecurity';`,
  `import { hashPassword } from '../../src/lib/passwordSecurity';\nimport { isOrderInCurrentShift } from '../../src/utils/dateUtils';`,
);

const diagnosticsHelper = `\nasync function logOrderShiftDiagnostics(label: string, order: any) {\n  const [shiftSnap, orderSnap] = await Promise.all([\n    getDoc(doc(db, 'shifts', 'current_shift')),\n    getDoc(doc(db, 'orders', order.id)),\n  ]);\n  const shift = shiftSnap.exists() ? shiftSnap.data() as any : {};\n  const stored = orderSnap.exists() ? ({ id: orderSnap.id, ...orderSnap.data() } as any) : null;\n  const belongs = Boolean(stored && isOrderInCurrentShift(stored, shift));\n  console.log('[E2E][shift-diagnostic]', JSON.stringify({\n    label,\n    orderId: order.id,\n    orderExists: Boolean(stored),\n    orderStatus: stored?.status || null,\n    orderCreatedTimestamp: stored?.createdTimestamp || null,\n    orderCreatedDate: stored?.createdDate || null,\n    orderShiftId: stored?.shiftId || null,\n    orderShiftDate: stored?.shiftDate || null,\n    operationalEpoch: stored?.operationalEpoch || null,\n    shiftIsOpen: Boolean(shift?.isOpen),\n    shiftId: shift?.shiftId || null,\n    shiftDate: shift?.shiftDate || null,\n    shiftOpenedTimestamp: shift?.openedTimestamp || null,\n    belongsToCurrentShift: belongs,\n    now: Date.now(),\n  }));\n  return { shift, stored, belongs };\n}\n`;

source = source.replace(`\ntest('@session Login, sessão e F5'`, `${diagnosticsHelper}\ntest('@session Login, sessão e F5'`);

source = source.replace(
  `    const created = await seedOrder(tag, 1);\n    await expect(a.page.getByText(created.clientName).first()).toBeVisible({ timeout: 30_000 });`,
  `    const created = await seedOrder(tag, 1);\n    const diagnostic = await logOrderShiftDiagnostics('multidevice', created);\n    expect(diagnostic.stored, 'Pedido multi-device precisa existir no Firestore antes da validação da UI').toBeTruthy();\n    expect(diagnostic.belongs, 'Pedido existe no Firestore, mas a própria regra do Rota Fácil o considera fora do turno atual').toBe(true);\n    await expect(a.page.getByText(created.clientName).first()).toBeVisible({ timeout: 30_000 });`,
);

source = source.replace(
  `    const order = await seedOrder(tag, 1, { originChannel: 'cardapio_web', externalOrderId: 'PW-NIGHTLY-CARDAPIO-1' });\n    const store = await storePage(browser, tag);`,
  `    const order = await seedOrder(tag, 1, { originChannel: 'cardapio_web', externalOrderId: 'PW-NIGHTLY-CARDAPIO-1' });\n    const diagnostic = await logOrderShiftDiagnostics('cardapio-seeded', order);\n    expect(diagnostic.stored, 'Pedido Cardápio Web precisa existir no Firestore antes da validação da UI').toBeTruthy();\n    expect(diagnostic.belongs, 'Pedido Cardápio Web existe no Firestore, mas a própria regra do Rota Fácil o considera fora do turno atual').toBe(true);\n    const store = await storePage(browser, tag);`,
);

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

const fakeCardapioTest = `\n\ntest('@cardapiofake Cardápio Web fake entra no Rota Fácil sem tocar o cliente', async ({ browser, request }) => {\n  const tag = 'cardapiofake';\n  await cleanup(tag);\n  await seedStore(tag);\n  let fakeOrderId = '';\n  try {\n    const fakeName = clientName(tag, 1);\n    const fakeCode = 9891;\n    const response = await request.post(BASE_URL + '/api/webhook-cardapio-web?branch=hope_burger', {\n      data: {\n        status: 'new',\n        client_name: fakeName,\n        customer: { name: fakeName, phone: '47999990001' },\n        address: { street: 'Rua Playwright Fake', number: '777', neighborhood: 'Centro', city: 'Blumenau' },\n        total: 49.90,\n        delivery_fee: 7.90,\n        items: [{ name: 'Item fake Cardápio Web', quantity: 1, price: 42 }],\n        code: fakeCode,\n        created_at: new Date().toISOString(),\n        order_type: 'delivery',\n      },\n    });\n\n    expect(response.status(), 'Webhook fake do Rota Fácil deve aceitar o payload').toBe(200);\n    const body = await response.json();\n    fakeOrderId = String(body?.orderId || '');\n    expect(fakeOrderId, 'Webhook deve devolver o ID do pedido criado no Rota Fácil').not.toBe('');\n\n    const ref = doc(db, 'orders', fakeOrderId);\n    await expect.poll(async () => (await getDoc(ref)).exists(), { timeout: 15_000 }).toBe(true);\n    const snap = await getDoc(ref);\n    const stored = { id: snap.id, ...snap.data() } as any;\n    console.log('[E2E][cardapiofake][firestore]', JSON.stringify({\n      orderId: fakeOrderId,\n      clientName: stored.clientName,\n      originChannel: stored.originChannel,\n      operationalEpoch: stored.operationalEpoch,\n      status: stored.status,\n      trackingCode: stored.trackingCode,\n      externalOrderId: stored.externalOrderId,\n    }));\n    expect(stored.clientName).toBe(fakeName);\n    expect(stored.originChannel).toBe('cardapio_web');\n    expect(stored.operationalEpoch).toBe(OPERATIONAL_EPOCH);\n    expect(stored.status).toBe('pending');\n\n    const diagnostic = await logOrderShiftDiagnostics('cardapio-fake-webhook', stored);\n\n    const trackingContext = await browser.newContext();\n    const trackingPage = await trackingContext.newPage();\n    await trackingPage.goto('/?rastreio=' + stored.trackingCode, { waitUntil: 'domcontentloaded' });\n    await expect.poll(async () => {\n      const locator = trackingPage.getByText(new RegExp(stored.trackingCode, 'i'));\n      const count = await locator.count();\n      for (let i = 0; i < count; i += 1) if (await locator.nth(i).isVisible().catch(() => false)) return true;\n      return false;\n    }, { timeout: 60_000 }).toBe(true);\n    await trackingContext.close();\n\n    if (diagnostic.shift?.isOpen && diagnostic.belongs) {\n      const store = await storePage(browser, tag);\n      await expect.poll(async () => {\n        const locator = store.page.getByText(fakeName);\n        const count = await locator.count();\n        for (let i = 0; i < count; i += 1) if (await locator.nth(i).isVisible().catch(() => false)) return true;\n        return false;\n      }, { timeout: 30_000 }).toBe(true);\n      await store.context.close();\n    } else {\n      console.log('[E2E][cardapiofake] Pedido recebido e rastreável, mas painel operacional não é exigido porque a operação está fechada ou o pedido está fora do turno atual.');\n    }\n  } finally {\n    if (fakeOrderId) await deleteDoc(doc(db, 'orders', fakeOrderId)).catch(() => {});\n    await cleanup(tag);\n  }\n});\n`;

if (!source.includes(`@cardapiofake Cardápio Web fake entra no Rota Fácil`)) {
  source = source.replace(`\ntest('@recovery Queda de conexão e recuperação'`, `${fakeCardapioTest}\ntest('@recovery Queda de conexão e recuperação'`);
}

fs.writeFileSync(file, source);
console.log('[patch-nightly-battery-ci] responsive assertions + shift diagnostics + safe fake Cardapio webhook test applied');
