import { expect, test, type Page } from '@playwright/test';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, OPERATIONAL_EPOCH } from './support/fixture';
import { hashPassword } from '../../src/lib/passwordSecurity';
import { isOrderInCurrentShift } from '../../src/utils/dateUtils';

const BASE_URL = process.env.E2E_BASE_URL || 'https://rotafacil-app-ruan.onrender.com';
const PASS = 'PwCardapioFake1234';
const RUN_SCOPE = String(process.env.GITHUB_RUN_ID || Date.now()).replace(/[^0-9a-z_-]/gi, '');
const STORE_USER = `pw_cwfake_${RUN_SCOPE}`.toLowerCase();
const CLIENT_NAME = `PW NIGHTLY CWFAKE ${RUN_SCOPE}`;

async function seedStore() {
  const credential = await hashPassword(PASS);
  await setDoc(doc(db, 'stores', STORE_USER), {
    id: STORE_USER,
    username: STORE_USER,
    passwordHash: credential.hash,
    passwordSalt: credential.salt,
    storeName: `PLAYWRIGHT CWFAKE ${RUN_SCOPE}`,
    createdAt: Date.now(),
    isPlaywrightTest: true,
  }, { merge: true });
}

async function loginStore(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="store-user"]').fill(STORE_USER);
  await page.locator('input[name="store-pass"]').fill(PASS);
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

async function expectVisibleText(page: Page, text: string | RegExp, timeout = 30_000) {
  await expect.poll(async () => {
    const locator = page.getByText(text);
    const count = await locator.count();
    for (let i = 0; i < count; i += 1) {
      if (await locator.nth(i).isVisible().catch(() => false)) return true;
    }
    return false;
  }, { timeout }).toBe(true);
}

test('Cardápio Web fake entra no Rota Fácil sem tocar o cliente', async ({ browser, request }) => {
  await seedStore();
  let fakeOrderId = '';

  try {
    // Sem id/order_id/data.id: o webhook NÃO consulta a API do Cardápio Web.
    const response = await request.post(`${BASE_URL}/api/webhook-cardapio-web?branch=hope_burger`, {
      data: {
        status: 'new',
        client_name: CLIENT_NAME,
        customer: { name: CLIENT_NAME, phone: '47999990001' },
        address: { street: 'Rua Playwright Fake', number: '777', neighborhood: 'Centro', city: 'Blumenau' },
        total: 49.90,
        delivery_fee: 7.90,
        items: [{ name: 'Item fake Cardápio Web', quantity: 1, price: 42 }],
        code: 9891,
        created_at: new Date().toISOString(),
        order_type: 'delivery',
      },
    });

    expect(response.status(), 'Webhook do Rota Fácil deve aceitar o payload fake').toBe(200);
    const body = await response.json();
    fakeOrderId = String(body?.orderId || '');
    expect(fakeOrderId, 'Webhook deve devolver o ID do pedido criado').not.toBe('');

    const orderRef = doc(db, 'orders', fakeOrderId);
    await expect.poll(async () => (await getDoc(orderRef)).exists(), { timeout: 20_000 }).toBe(true);
    const orderSnap = await getDoc(orderRef);
    const order = { id: orderSnap.id, ...orderSnap.data() } as any;
    expect(order.clientName).toBe(CLIENT_NAME);
    expect(order.originChannel).toBe('cardapio_web');
    expect(order.operationalEpoch).toBe(OPERATIONAL_EPOCH);
    expect(order.status).toBe('pending');
    expect(String(order.externalOrderId || '')).toBe('');

    const shiftSnap = await getDoc(doc(db, 'shifts', 'current_shift'));
    const shift = shiftSnap.exists() ? shiftSnap.data() as any : {};
    const belongs = isOrderInCurrentShift(order, shift);
    console.log('[CWFAKE][diagnostic]', JSON.stringify({ orderId: fakeOrderId, projectOrderFound: true, clientName: order.clientName, originChannel: order.originChannel, trackingCode: order.trackingCode, operationalEpoch: order.operationalEpoch, shiftIsOpen: Boolean(shift.isOpen), shiftId: shift.shiftId || null, shiftDate: shift.shiftDate || null, shiftOpenedTimestamp: shift.openedTimestamp || null, orderCreatedTimestamp: order.createdTimestamp || null, orderCreatedDate: order.createdDate || null, belongsToCurrentShift: belongs }));

    const trackingContext = await browser.newContext();
    const trackingPage = await trackingContext.newPage();
    await trackingPage.goto(`/?rastreio=${order.trackingCode}`, { waitUntil: 'domcontentloaded' });
    await expectVisibleText(trackingPage, /Seu pedido está sendo preparado na cozinha/i, 60_000);
    await expectVisibleText(trackingPage, new RegExp(`Código de Rastreio:\\s*${order.trackingCode}`, 'i'), 60_000);
    await trackingContext.close();
    console.log('[CWFAKE][tracking] pedido fake carregado integralmente no rastreio público');

    if (shift.isOpen && belongs) {
      const storeContext = await browser.newContext();
      const storePage = await storeContext.newPage();
      const browserDiagnostics: string[] = [];
      storePage.on('console', (msg) => {
        if (msg.type() === 'warning' || msg.type() === 'error') {
          const line = `[browser-console][${msg.type()}] ${msg.text()}`;
          browserDiagnostics.push(line);
          console.log(line);
        }
      });
      storePage.on('pageerror', (err) => {
        const line = `[browser-pageerror] ${err.message}`;
        browserDiagnostics.push(line);
        console.log(line);
      });
      storePage.on('requestfailed', (req) => {
        const line = `[browser-requestfailed] ${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'unknown'}`;
        browserDiagnostics.push(line);
        console.log(line);
      });

      await loginStore(storePage);
      try {
        await expectVisibleText(storePage, CLIENT_NAME, 45_000);
      } catch (error) {
        const stillThere = await getDoc(orderRef);
        console.log('[CWFAKE][dashboard-failure]', JSON.stringify({
          fakeOrderStillExists: stillThere.exists(),
          fakeOrderStatus: stillThere.exists() ? (stillThere.data() as any).status : null,
          fakeOrderEpoch: stillThere.exists() ? (stillThere.data() as any).operationalEpoch : null,
          visibleBodyText: (await storePage.locator('body').innerText().catch(() => '')).slice(0, 5000),
          browserDiagnostics,
        }));
        throw error;
      }
      await expectVisibleText(storePage, /Cardápio Web|Cardápio/i, 45_000);
      await storeContext.close();
      console.log('[CWFAKE][dashboard] pedido fake visível no painel da loja');
    }
  } finally {
    if (fakeOrderId) await deleteDoc(doc(db, 'orders', fakeOrderId)).catch(() => {});
    await deleteDoc(doc(db, 'stores', STORE_USER)).catch(() => {});
  }
});
