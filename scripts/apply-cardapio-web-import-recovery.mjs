import fs from 'node:fs';

const target = 'api/sync-cardapio-web.ts';

const source = `import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';

const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = process.env.CARDAPIO_WEB_HOPE_PIZZA_TOKEN || process.env.CW_HOPE_PIZZA_TOKEN || '';
const CARDAPIO_WEB_HOPE_BURGER_TOKEN = process.env.CARDAPIO_WEB_HOPE_BURGER_TOKEN || process.env.CW_HOPE_BURGER_TOKEN || '';
const STORE_PILOT_RESET_VERSION = 'zeroed_store_pilot_2026_08_17_v10';
const FIREBASE_APP_NAME = 'rotafacil-cardapio-sync';

function getDbInstance() {
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyD-XkOCjvoGt3VZRfLQyH5Dg1S7P2Ex2-8',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || 'rotafacil-app-oficial.firebaseapp.com',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'rotafacil-app-oficial',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || 'rotafacil-app-oficial.firebasestorage.app',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '846726683671',
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '1:846726683671:web:d0b5ddc701815609be9052',
  };
  const app = getApps().find((candidate) => candidate.name === FIREBASE_APP_NAME)
    || initializeApp(firebaseConfig, FIREBASE_APP_NAME);
  const dbId = process.env.VITE_FIRESTORE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || '(default)';
  return dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);
}

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
const terminal = new Set(['closed','delivered','finalized','concluded','completed','finished','done','canceled','cancelled','rejected']);
const activeExternal = new Set(['waiting_to_catch','confirmed','pending','new','received','open','preparing','production','in_preparation','accepted','released','dispatched','saiu_para_entrega','out_for_delivery']);

function mapCwStatus(raw: unknown): string | null {
  const status = normalize(raw);
  if (['released','dispatched','saiu_para_entrega','out_for_delivery'].includes(status)) return 'dispatched';
  if (['waiting_to_catch'].includes(status)) return 'ready_at_counter';
  if (['confirmed','preparing','production','in_preparation','accepted'].includes(status)) return 'preparing';
  if (['pending','new','received','open'].includes(status)) return 'pending';
  if (['closed','delivered','finalized','concluded','completed','finished','done'].includes(status)) return 'delivered';
  if (['canceled','cancelled','rejected'].includes(status)) return 'cancelled';
  return null;
}

function parseSourceDate(...values: any[]) {
  for (const raw of values) {
    if (raw == null || raw === '') continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return { date: \`${'${obj.year}'}-${'${obj.month}'}-${'${obj.day}'}\`, timestamp: d.getTime() };
  }
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { date: \`${'${obj.year}'}-${'${obj.month}'}-${'${obj.day}'}\`, timestamp: now.getTime() };
}

async function listOrders(token: string, branch: 'hope_pizza' | 'hope_burger') {
  if (!token) return [];
  const response = await fetch('https://integracao.cardapioweb.com/api/partner/v1/orders', { headers: { 'X-API-KEY': token } });
  if (!response.ok) throw new Error(\`Cardapio Web list ${'${branch}'}: HTTP ${'${response.status}'}\`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload.map((order: any) => ({ ...order, _branch: branch })) : [];
}

async function fetchDetail(id: string, token: string) {
  if (!id || !token) return null;
  const response = await fetch(\`https://integracao.cardapioweb.com/api/partner/v1/orders/${'${encodeURIComponent(id)}'}\`, { headers: { 'X-API-KEY': token } });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.id ? payload : null;
}

function changedPatch(current: any, next: any) {
  const patch: any = {};
  for (const [key, value] of Object.entries(next)) {
    if (JSON.stringify(current?.[key] ?? null) !== JSON.stringify(value ?? null)) patch[key] = value;
  }
  return patch;
}

function toOrder(detail: any, branch: 'hope_pizza' | 'hope_burger') {
  const status = mapCwStatus(detail?.status) || 'pending';
  const orderType = normalize(detail?.order_type);
  if (['takeout','indoor','balcao'].includes(orderType)) return null;

  const customer = detail?.customer || {};
  const address = detail?.delivery_address || {};
  const source = parseSourceDate(detail?.created_at, detail?.createdAt, detail?.created);
  const display = Number(detail?.display_id || detail?.external_display_id || 0);
  const items = Array.isArray(detail?.items) ? detail.items : [];
  const itemRows = items.map((item: any, index: number) => ({
    id: String(item?.id || index + 1),
    name: String(item?.name || item?.product_name || item?.title || 'Item'),
    price: Number(item?.price ?? item?.unit_price ?? item?.total ?? 0),
    quantity: Number(item?.quantity || item?.qty || 1),
  }));
  const street = String(address?.street || '').trim();
  const number = String(address?.number || '').trim();
  const neighborhood = String(address?.neighborhood || '').trim();
  const fullAddress = [street, number, neighborhood, address?.city].filter(Boolean).join(', ');
  const lat = Number(address?.latitude);
  const lng = Number(address?.longitude);

  return {
    id: \`cw_${'${detail.id}'}\`,
    externalOrderId: String(detail.id),
    codeNumber: Number.isFinite(display) && display > 0 ? display : Number(detail.id) || Date.now(),
    clientName: String(customer?.name || 'Cliente Cardapio Web'),
    clientPhone: String(customer?.phone || customer?.cellphone || ''),
    address: fullAddress || 'Endereco informado no Cardapio Web',
    street,
    houseNumber: number,
    complement: String(address?.complement || ''),
    neighborhood: neighborhood || 'Nao informado',
    lat: Number.isFinite(lat) && lat !== 0 ? lat : -26.9194,
    lng: Number.isFinite(lng) && lng !== 0 ? lng : -49.0661,
    items: itemRows,
    itemsSummary: itemRows.map((item: any) => \`${'${item.quantity}'}x ${'${item.name}'}\`).join(', ') || 'Pedido Cardapio Web',
    subtotal: Number(detail?.subtotal || Math.max(0, Number(detail?.total || 0) - Number(detail?.delivery_fee || 0))),
    deliveryFee: Number(detail?.delivery_fee || 0),
    total: Number(detail?.total || 0),
    paymentMethod: 'pix',
    status,
    createdAt: new Date(source.timestamp).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
    createdDate: source.date,
    createdTimestamp: source.timestamp,
    sourceCreatedDate: source.date,
    sourceCreatedTimestamp: source.timestamp,
    shiftDate: source.date,
    estimatedMinutes: 25,
    assignedMotoboyId: null,
    assignedMotoboyName: null,
    originChannel: 'cardapio_web',
    storeBranch: branch,
    storeName: branch === 'hope_burger' ? 'Hope Burger' : 'Hope Pizza',
    trackingCode: \`CW-${'${detail.id}'}\`,
    operationalEpoch: STORE_PILOT_RESET_VERSION,
    cardapioWebStatus: normalize(detail?.status),
    dispatchSource: status === 'dispatched' ? 'cardapio_web' : null,
    cardapioWebDispatchDetected: status === 'dispatched',
    closedInCardapioWeb: status === 'delivered',
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!CARDAPIO_WEB_HOPE_PIZZA_TOKEN || !CARDAPIO_WEB_HOPE_BURGER_TOKEN) {
    return res.status(500).json({ success: false, error: 'Cardapio Web credentials are not configured on the server.' });
  }

  try {
    const db = getDbInstance();
    const [pizza, burger] = await Promise.all([
      listOrders(CARDAPIO_WEB_HOPE_PIZZA_TOKEN, 'hope_pizza'),
      listOrders(CARDAPIO_WEB_HOPE_BURGER_TOKEN, 'hope_burger'),
    ]);
    const external = [...pizza, ...burger];
    const snap = await getDocs(query(collection(db, 'orders'), where('originChannel', '==', 'cardapio_web')));
    const existingById = new Map(snap.docs.map((row) => [row.id, row.data() as any]));

    let imported = 0;
    let updated = 0;
    let detailFetches = 0;
    let skippedHistorical = 0;

    for (const summary of external) {
      const externalId = String(summary?.id || '');
      if (!externalId) continue;
      const docId = \`cw_${'${externalId}'}\`;
      const current = existingById.get(docId);
      const rawStatus = normalize(summary?.status);
      const mapped = mapCwStatus(rawStatus);

      if (current) {
        const desired: any = { cardapioWebStatus: rawStatus };
        if (mapped && !(current?.dispatchSource === 'rota_facil' && !terminal.has(rawStatus))) {
          desired.status = mapped;
          if (mapped === 'dispatched' && current?.dispatchSource !== 'rota_facil') desired.dispatchSource = 'cardapio_web';
          if (mapped === 'delivered') desired.closedInCardapioWeb = true;
        }
        const patch = changedPatch(current, desired);
        if (Object.keys(patch).length) {
          await setDoc(doc(db, 'orders', docId), patch, { merge: true });
          updated++;
        }
        continue;
      }

      if (!activeExternal.has(rawStatus)) {
        skippedHistorical++;
        continue;
      }

      const token = summary._branch === 'hope_burger' ? CARDAPIO_WEB_HOPE_BURGER_TOKEN : CARDAPIO_WEB_HOPE_PIZZA_TOKEN;
      const detail = await fetchDetail(externalId, token);
      detailFetches++;
      if (!detail) continue;
      const order = toOrder(detail, summary._branch);
      if (!order) continue;
      await setDoc(doc(db, 'orders', order.id), order, { merge: true });
      imported++;
    }

    return res.status(200).json({
      success: true,
      totalExternal: external.length,
      imported,
      updated,
      detailFetches,
      skippedHistorical,
    });
  } catch (error: any) {
    console.error('Cardapio Web sync failed:', error);
    return res.status(500).json({ success: false, error: error?.message || String(error) });
  }
}
`;

fs.writeFileSync(target, source);
console.log('[cw-import-recovery] active Cardapio Web orders are imported and existing orders reconciled without historical scans');