import fs from 'node:fs';

const path = 'api/sync-cardapio-web.ts';
let s = fs.readFileSync(path, 'utf8');

const marker = 'CARDAPIO_WEB_COURIER_DISCOVERY_V1';
if (!s.includes(marker)) {
  const insertBefore = 'export default async function handler(req: any, res: any) {';
  const helpers = `
// CARDAPIO_WEB_COURIER_DISCOVERY_V1
// Descoberta SOMENTE-LEITURA do entregador vinculado no Cardápio Web.
// A API de pedidos nem sempre expõe o nome no payload principal, então tentamos:
// 1) campos/objetos de entregador no próprio pedido;
// 2) sub-recursos somente GET do pedido;
// 3) diretórios somente GET de entregadores, resolvendo um ID para nome.
type CourierResolution = { name: string | null; id: string | null; source: string | null };
type CourierDirectoryCache = { expiresAt: number; byId: Map<string, string>; endpoint: string | null };
const courierDirectoryCache = new Map<string, CourierDirectoryCache>();
let lastCourierDiscoveryEndpoint: string | null = null;

const courierKeyRegex = /(deliveryman|deliveryperson|deliverydriver|courier|driver|motoboy|entregador|rider|deliveryagent|deliverypartner)/i;
const idKeyRegex = /(id|uuid|code)$/i;

function courierId(order: any): string | null {
  const seen = new Set<any>();
  const walk = (node: any, depth: number, courierContext = false): string | null => {
    if (!node || typeof node !== 'object' || depth > 7 || seen.has(node)) return null;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
      const normalizedKey = key.replace(/[^a-zA-Z0-9]/g, '');
      const isCourierKey = courierKeyRegex.test(normalizedKey);
      const isIdKey = idKeyRegex.test(normalizedKey);
      if ((isCourierKey && /id$/i.test(normalizedKey)) || (courierContext && isIdKey)) {
        if (typeof value === 'string' || typeof value === 'number') {
          const text = String(value).trim();
          if (text) return text;
        }
      }
      if (value && typeof value === 'object') {
        const found = walk(value, depth + 1, courierContext || isCourierKey);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(order, 0, false);
}

function normalizeDirectoryPayload(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['data','items','results','deliverymen','delivery_man','drivers','couriers','motoboys','entregadores','delivery_people','deliveryPersons']) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

async function fetchCourierDirectory(token: string): Promise<CourierDirectoryCache> {
  const cached = courierDirectoryCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const endpoints = [
    'deliverymen',
    'delivery-men',
    'delivery_people',
    'delivery-persons',
    'deliverypersons',
    'drivers',
    'couriers',
    'motoboys',
    'entregadores',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch('https://integracao.cardapioweb.com/api/partner/v1/' + endpoint, {
        method: 'GET',
        headers: { 'X-API-KEY': token },
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const list = normalizeDirectoryPayload(payload);
      const byId = new Map<string, string>();
      for (const item of list) {
        const id = courierId(item) || String(item?.id ?? item?.uuid ?? item?.code ?? '').trim() || null;
        const name = courierName(item) || String(item?.name ?? item?.nome ?? item?.full_name ?? item?.display_name ?? '').trim() || null;
        if (id && name) byId.set(String(id), String(name));
      }
      if (byId.size > 0) {
        lastCourierDiscoveryEndpoint = endpoint;
        const result = { expiresAt: Date.now() + 10 * 60_000, byId, endpoint };
        courierDirectoryCache.set(token, result);
        return result;
      }
    } catch {}
  }

  const empty = { expiresAt: Date.now() + 10 * 60_000, byId: new Map<string, string>(), endpoint: null };
  courierDirectoryCache.set(token, empty);
  return empty;
}

async function fetchCourierOrderSupplement(externalId: string, token: string): Promise<any | null> {
  const base = 'https://integracao.cardapioweb.com/api/partner/v1/orders/' + encodeURIComponent(externalId);
  const suffixes = ['/deliveryman','/delivery-man','/driver','/courier','/motoboy','/entregador','/delivery'];
  for (const suffix of suffixes) {
    try {
      const response = await fetch(base + suffix, { method: 'GET', headers: { 'X-API-KEY': token } });
      if (!response.ok) continue;
      const payload = await response.json();
      if (payload && (courierName(payload) || courierId(payload))) {
        lastCourierDiscoveryEndpoint = 'orders/{id}' + suffix;
        return payload;
      }
    } catch {}
  }
  return null;
}

async function resolveCardapioWebCourier(order: any, externalId: string, token: string): Promise<CourierResolution> {
  let name = courierName(order);
  let id = courierId(order);
  if (name) return { name, id, source: 'order-payload' };

  if (!id) {
    const supplement = await fetchCourierOrderSupplement(externalId, token);
    if (supplement) {
      name = courierName(supplement);
      id = courierId(supplement);
      if (name) return { name, id, source: lastCourierDiscoveryEndpoint };
    }
  }

  if (id) {
    const directory = await fetchCourierDirectory(token);
    const resolved = directory.byId.get(String(id)) || null;
    if (resolved) return { name: resolved, id: String(id), source: directory.endpoint };
  }

  return { name: null, id: id ? String(id) : null, source: null };
}

`;
  if (!s.includes(insertBefore)) throw new Error('[cw-courier-discovery] handler anchor missing');
  s = s.replace(insertBefore, helpers + insertBefore);
}

const oldResolution = `      const externalDriver = courierName(cwOrder) || data.cardapioWebMotoboyName || data.externalMotoboyName || null;`;
const newResolution = `      const primaryCourierToken = branch === 'hope_burger' ? CARDAPIO_WEB_HOPE_BURGER_TOKEN : CARDAPIO_WEB_HOPE_PIZZA_TOKEN;\n      const fallbackCourierToken = branch === 'hope_burger' ? CARDAPIO_WEB_HOPE_PIZZA_TOKEN : CARDAPIO_WEB_HOPE_BURGER_TOKEN;\n      let courierResolution = await resolveCardapioWebCourier(cwOrder, externalId, primaryCourierToken);\n      if (!courierResolution.name && !courierResolution.id) {\n        courierResolution = await resolveCardapioWebCourier(cwOrder, externalId, fallbackCourierToken);\n      }\n      const externalDriver = courierResolution.name || data.cardapioWebMotoboyName || data.externalMotoboyName || null;\n      const externalDriverId = courierResolution.id || data.cardapioWebMotoboyId || data.externalMotoboyId || null;`;
if (s.includes(oldResolution)) s = s.replace(oldResolution, newResolution);

const oldDriverPatch = `      if (externalDriver) {\n        patch.externalMotoboyName = externalDriver;\n        patch.cardapioWebMotoboyName = externalDriver;\n        courierReconciledCount++;\n      }`;
const newDriverPatch = `      if (externalDriver) {\n        patch.externalMotoboyName = externalDriver;\n        patch.cardapioWebMotoboyName = externalDriver;\n        courierReconciledCount++;\n      }\n      if (externalDriverId) {\n        patch.externalMotoboyId = String(externalDriverId);\n        patch.cardapioWebMotoboyId = String(externalDriverId);\n      }\n      if (courierResolution.source) patch.cardapioWebCourierSource = courierResolution.source;`;
if (s.includes(oldDriverPatch)) s = s.replace(oldDriverPatch, newDriverPatch);

const oldResponse = `return res.status(200).json({ success:true,totalCwOrders:cwList.length,dispatchedCount,deliveredCount,cancelledCount,purgedEmptyCount,purgedTakeoutCount,detailReconciledCount,courierReconciledCount,totalUpdated:dispatchedCount+deliveredCount+cancelledCount+courierReconciledCount });`;
const newResponse = `return res.status(200).json({ success:true,totalCwOrders:cwList.length,dispatchedCount,deliveredCount,cancelledCount,purgedEmptyCount,purgedTakeoutCount,detailReconciledCount,courierReconciledCount,courierDiscoveryEndpoint:lastCourierDiscoveryEndpoint,totalUpdated:dispatchedCount+deliveredCount+cancelledCount+courierReconciledCount });`;
if (s.includes(oldResponse)) s = s.replace(oldResponse, newResponse);

const checks = [marker, 'resolveCardapioWebCourier', 'fetchCourierDirectory', 'fetchCourierOrderSupplement', 'cardapioWebCourierSource', 'courierDiscoveryEndpoint:lastCourierDiscoveryEndpoint'];
const missing = checks.filter((value) => !s.includes(value));
if (missing.length) throw new Error('[cw-courier-discovery] validation failed: ' + missing.join(', '));

fs.writeFileSync(path, s);
console.log('[cw-courier-discovery] read-only courier discovery enabled');
