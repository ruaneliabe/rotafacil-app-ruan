import fs from 'node:fs';

const target = 'api/sync-cardapio-web.ts';

const source = `import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';

const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = process.env.CARDAPIO_WEB_HOPE_PIZZA_TOKEN || process.env.CW_HOPE_PIZZA_TOKEN || '';
const CARDAPIO_WEB_HOPE_BURGER_TOKEN = process.env.CARDAPIO_WEB_HOPE_BURGER_TOKEN || process.env.CW_HOPE_BURGER_TOKEN || '';
const STORE_PILOT_RESET_VERSION = 'zeroed_store_pilot_2026_08_17_v10';

const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const BASE_RATE_LIMIT_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000;
const MAX_DETAIL_FETCHES_PER_RUN = 12;
const DETAIL_DELAY_MS = 1500;

let syncInFlight: Promise<any> | null = null;
let lastRunAt = 0;
let lastResult: any = null;
let rateLimitUntil = 0;
let rateLimitLevel = 0;
const branchCache: Record<string, { at: number; rows: any[] }> = {};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getDbInstance() {
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'rotafacil-app-oficial',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
  };
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const dbId = process.env.VITE_FIRESTORE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || '(default)';
  return dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);
}

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
const terminal = new Set(['closed','delivered','finalized','concluded','completed','finished','done','canceled','cancelled','rejected']);
const activeExternal = new Set(['waiting_to_catch','confirmed','pending','new','received','open','preparing','production','in_preparation','accepted','released','dispatched','saiu_para_entrega','out_for_delivery']);

function mapCwStatus(raw: unknown): string | null {
  const status = normalize(raw);
  if (['released','dispatched','saiu_para_entrega','out_for_delivery'].includes(status)) return 'dispatched';
  if (status === 'waiting_to_catch') return 'ready_at_counter';
  if (['confirmed','preparing','production','in_preparation','accepted'].includes(status)) return 'preparing';
  if (['pending','new','received','open'].includes(status)) return 'pending';
  if (['closed','delivered','finalized','concluded','completed','finished','done'].includes(status)) return 'delivered';
  if (['canceled','cancelled','rejected'].includes(status)) return 'cancelled';
  return null;
}

function saoPauloDateKey(value: any): string | null {
  if (value == null || value === '') return null;
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === 'number') date = new Date(value < 100000000000 ? value * 1000 : value);
  else {
    const text = String(value).trim();
    const numeric = /^\\d+$/.test(text) ? Number(text) : null;
    date = numeric != null ? new Date(numeric < 100000000000 ? numeric * 1000 : numeric) : new Date(text.includes(' ') && !text.includes('T') ? text.replace(' ', 'T') : text);
  }
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return \`${'${obj.year}'}-${'${obj.month}'}-${'${obj.day}'}\`;
}

function todaySaoPaulo() { return saoPauloDateKey(new Date())!; }
function isSummaryRecent(summary: any): boolean {
  const today = todaySaoPaulo();
  const yesterday = saoPauloDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const candidates = [summary?.created_at, summary?.createdAt, summary?.created, summary?.order_date, summary?.orderDate, summary?.date];
  for (const value of candidates) {
    const key = saoPauloDateKey(value);
    if (key) return key === today || key === yesterday;
  }
  return false;
}

function parseSourceDate(...values: any[]) {
  for (const value of values) {
    const key = saoPauloDateKey(value);
    if (!key) continue;
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return { date: key, timestamp: d.getTime() };
  }
  const now = new Date();
  return { date: todaySaoPaulo(), timestamp: now.getTime() };
}

function enterRateLimit(retryAfterHeader?: string | null) {
  rateLimitLevel = Math.min(rateLimitLevel + 1, 4);
  const headerSeconds = retryAfterHeader && /^\\d+$/.test(retryAfterHeader) ? Number(retryAfterHeader) : 0;
  const exponential = Math.min(BASE_RATE_LIMIT_COOLDOWN_MS * Math.pow(2, rateLimitLevel - 1), MAX_RATE_LIMIT_COOLDOWN_MS);
  rateLimitUntil = Date.now() + Math.max(exponential, headerSeconds * 1000);
  return Math.ceil((rateLimitUntil - Date.now()) / 1000);
}

function clearRateLimitAfterSuccess() {
  rateLimitLevel = 0;
  rateLimitUntil = 0;
}

async function listOrders(token: string, branch: 'hope_pizza' | 'hope_burger') {
  const response = await fetch('https://integracao.cardapioweb.com/api/partner/v1/orders', { headers: { 'X-API-KEY': token } });
  if (response.status === 429) {
    return { rows: branchCache[branch]?.rows || [], rateLimited: true, retryAfterSeconds: enterRateLimit(response.headers.get('retry-after')), fromCache: Boolean(branchCache[branch]) };
  }
  if (!response.ok) throw new Error(\`Cardapio Web list ${'${branch}'}: HTTP ${'${response.status}'}\`);
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload.map((order: any) => ({ ...order, _branch: branch })) : [];
  branchCache[branch] = { at: Date.now(), rows };
  return { rows, rateLimited: false, retryAfterSeconds: 0, fromCache: false };
}

async function fetchDetail(id: string, token: string) {
  const response = await fetch(\`https://integracao.cardapioweb.com/api/partner/v1/orders/${'${encodeURIComponent(id)}'}\`, { headers: { 'X-API-KEY': token } });
  if (response.status === 429) {
    return { data: null, rateLimited: true, retryAfterSeconds: enterRateLimit(response.headers.get('retry-after')) };
  }
  if (!response.ok) return { data: null, rateLimited: false, retryAfterSeconds: 0 };
  const payload = await response.json();
  return { data: payload?.id ? payload : null, rateLimited: false, retryAfterSeconds: 0 };
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
  const source = parseSourceDate(detail?.created_at, detail?.createdAt, detail?.created, detail?.order_date, detail?.orderDate, detail?.date);
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
    id: \`cw_${'${detail.id}'}\`, externalOrderId: String(detail.id),
    codeNumber: Number.isFinite(display) && display > 0 ? display : Number(detail.id) || Date.now(),
    clientName: String(customer?.name || 'Cliente Cardapio Web'), clientPhone: String(customer?.phone || customer?.cellphone || ''),
    address: fullAddress || 'Endereco informado no Cardapio Web', street, houseNumber: number,
    complement: String(address?.complement || ''), neighborhood: neighborhood || 'Nao informado',
    lat: Number.isFinite(lat) && lat !== 0 ? lat : -26.9194, lng: Number.isFinite(lng) && lng !== 0 ? lng : -49.0661,
    items: itemRows, itemsSummary: itemRows.map((item: any) => \`${'${item.quantity}'}x ${'${item.name}'}\`).join(', ') || 'Pedido Cardapio Web',
    subtotal: Number(detail?.subtotal || Math.max(0, Number(detail?.total || 0) - Number(detail?.delivery_fee || 0))),
    deliveryFee: Number(detail?.delivery_fee || 0), total: Number(detail?.total || 0), paymentMethod: 'pix', status,
    createdAt: new Date(source.timestamp).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
    createdDate: source.date, createdTimestamp: source.timestamp, sourceCreatedDate: source.date, sourceCreatedTimestamp: source.timestamp, shiftDate: source.date,
    estimatedMinutes: 25, assignedMotoboyId: null, assignedMotoboyName: null,
    originChannel: 'cardapio_web', storeBranch: branch, storeName: branch === 'hope_burger' ? 'Hope Burger' : 'Hope Pizza',
    trackingCode: \`CW-${'${detail.id}'}\`, operationalEpoch: STORE_PILOT_RESET_VERSION,
    cardapioWebStatus: normalize(detail?.status), dispatchSource: status === 'dispatched' ? 'cardapio_web' : null,
    cardapioWebDispatchDetected: status === 'dispatched', closedInCardapioWeb: status === 'delivered',
  };
}

async function performSync() {
  const now = Date.now();
  if (rateLimitUntil > now) {
    return { success: true, deferred: true, rateLimited: true, retryAfterSeconds: Math.ceil((rateLimitUntil - now) / 1000), ...(lastResult || {}) };
  }
  if (lastResult && now - lastRunAt < MIN_SYNC_INTERVAL_MS) {
    return { ...lastResult, success: true, cached: true, nextSyncInSeconds: Math.ceil((MIN_SYNC_INTERVAL_MS - (now - lastRunAt)) / 1000) };
  }

  const db = getDbInstance();
  const pizza = await listOrders(CARDAPIO_WEB_HOPE_PIZZA_TOKEN, 'hope_pizza');
  await sleep(750);
  const burger = await listOrders(CARDAPIO_WEB_HOPE_BURGER_TOKEN, 'hope_burger');
  const listRateLimited = pizza.rateLimited || burger.rateLimited;
  const external = [...pizza.rows, ...burger.rows];

  const snap = await getDocs(query(collection(db, 'orders'), where('originChannel', '==', 'cardapio_web')));
  const existingById = new Map(snap.docs.map((row) => [row.id, row.data() as any]));
  let imported = 0, updated = 0, detailFetches = 0, skippedHistorical = 0, deferredDetails = 0;
  let detailRateLimited = false;
  let retryAfterSeconds = listRateLimited ? Math.max(pizza.retryAfterSeconds, burger.retryAfterSeconds) : 0;

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

    const shouldImport = activeExternal.has(rawStatus) || isSummaryRecent(summary);
    if (!shouldImport) { skippedHistorical++; continue; }
    if (detailFetches >= MAX_DETAIL_FETCHES_PER_RUN || rateLimitUntil > Date.now()) { deferredDetails++; continue; }

    const token = summary._branch === 'hope_burger' ? CARDAPIO_WEB_HOPE_BURGER_TOKEN : CARDAPIO_WEB_HOPE_PIZZA_TOKEN;
    if (detailFetches > 0) await sleep(DETAIL_DELAY_MS);
    const detailResult = await fetchDetail(externalId, token);
    detailFetches++;
    if (detailResult.rateLimited) {
      detailRateLimited = true;
      retryAfterSeconds = Math.max(retryAfterSeconds, detailResult.retryAfterSeconds);
      deferredDetails++;
      continue;
    }
    if (!detailResult.data) continue;
    const order = toOrder(detailResult.data, summary._branch);
    if (!order) continue;
    await setDoc(doc(db, 'orders', order.id), order, { merge: true });
    existingById.set(order.id, order);
    imported++;
  }

  if (!listRateLimited && !detailRateLimited) clearRateLimitAfterSuccess();
  lastRunAt = Date.now();
  lastResult = {
    success: true,
    totalExternal: external.length,
    imported,
    updated,
    detailFetches,
    deferredDetails,
    skippedHistorical,
    partial: listRateLimited || detailRateLimited || deferredDetails > 0,
    rateLimited: listRateLimited || detailRateLimited,
    retryAfterSeconds,
    cacheUsed: pizza.fromCache || burger.fromCache,
  };
  return lastResult;
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
    if (!syncInFlight) syncInFlight = performSync().finally(() => { syncInFlight = null; });
    const result = await syncInFlight;
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Cardapio Web sync failed:', error);
    return res.status(500).json({ success: false, error: error?.message || String(error) });
  }
}
`;

fs.writeFileSync(target, source);
console.log('[cw-rate-limit-guard] 5-minute dedupe, single-flight sync, 12-detail batches and 429 backoff enabled');
