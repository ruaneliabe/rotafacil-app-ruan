const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = process.env.CARDAPIO_WEB_HOPE_PIZZA_TOKEN || 'ed3bxFMKCQGtaqbTVJrDy6ZqfM7z2hEFLaRmQBo3tMW4ZkGuxTmBHAweBTrx';
const CARDAPIO_WEB_HOPE_BURGER_TOKEN = process.env.CARDAPIO_WEB_HOPE_BURGER_TOKEN || 'ddoFwAw7TbrhTcV1CzeR1bqZAegsjZyzescnjr9QfR2dBEdo6QZNMNkbSeYx';

const BASE = 'https://integracao.cardapioweb.com/api/partner/v1';
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

function safeActor(value: any) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { type: typeof value, value: String(value).slice(0, 160) };
  }
  if (typeof value !== 'object') return { type: typeof value };
  return {
    type: Array.isArray(value) ? 'array' : 'object',
    keys: Object.keys(value).sort().slice(0, 80),
    id: value?.id ?? value?.uuid ?? value?.code ?? value?.driver_id ?? value?.courier_id ?? null,
    name: value?.name ?? value?.nome ?? value?.full_name ?? value?.display_name ?? value?.username ?? null,
  };
}

function safeShape(payload: any) {
  if (payload == null) return null;
  if (Array.isArray(payload)) {
    return {
      type: 'array',
      length: payload.length,
      firstItemKeys: payload[0] && typeof payload[0] === 'object' ? Object.keys(payload[0]).sort().slice(0, 80) : [],
      firstItemActor: payload[0] && typeof payload[0] === 'object' ? safeActor(payload[0]) : null,
    };
  }
  if (typeof payload !== 'object') return { type: typeof payload, value: String(payload).slice(0, 160) };

  const interesting = /(driver|courier|motoboy|entregador|deliver|delivery|rider|logistic|dispatch|route|shipping|user|assigned|responsible|fleet|carrier|pickup|catch|transport)/i;
  const hits: any[] = [];
  const seen = new Set<any>();
  const walk = (node: any, base = '', depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 7 || seen.has(node)) return;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
      const path = base ? `${base}.${key}` : key;
      if (interesting.test(key)) {
        if (value && typeof value === 'object') hits.push({ path, ...safeActor(value) });
        else hits.push({ path, type: typeof value, value: String(value ?? '').slice(0, 160) });
      }
      if (value && typeof value === 'object') walk(value, path, depth + 1);
    }
  };
  walk(payload);

  return {
    type: 'object',
    keys: Object.keys(payload).sort().slice(0, 100),
    deliveredBy: safeActor(payload?.delivered_by),
    courierRelated: hits.slice(0, 100),
  };
}

async function getJson(url: string, token: string) {
  try {
    const response = await fetch(url, { method: 'GET', headers: { 'X-API-KEY': token } });
    let payload: any = null;
    try { payload = await response.json(); } catch {}
    return { ok: response.ok, status: response.status, shape: safeShape(payload), payload };
  } catch (error: any) {
    return { ok: false, status: 0, error: error?.message || String(error), shape: null, payload: null };
  }
}

function pickActive(list: any[]) {
  return list.filter((o: any) => !['closed','canceled','cancelled'].includes(normalize(o?.status))).slice(0, 2);
}

function isUseful(probe: any) {
  if (!probe?.ok || probe?.payload == null) return false;
  if (Array.isArray(probe.payload)) return probe.payload.length > 0;
  if (typeof probe.payload === 'object') return Object.keys(probe.payload).length > 0;
  return String(probe.payload).trim().length > 0;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const branches = [
    { branch: 'hope_pizza', token: CARDAPIO_WEB_HOPE_PIZZA_TOKEN },
    { branch: 'hope_burger', token: CARDAPIO_WEB_HOPE_BURGER_TOKEN },
  ];

  const result: any = { success: true, runtimeMarker: 'cw-logistics-probe-v3', branches: [] };

  const rootEndpoints = [
    'deliveries','delivery','dispatches','dispatch','logistics','logistic','routes','delivery-routes','delivery_routes',
    'shipping','shipments','assignments','delivery-assignments','courier-assignments','driver-assignments',
    'fleets','fleet','carriers','couriers','drivers','deliverymen','motoboys','entregadores','riders','pickups','pickup'
  ];

  const orderSuffixes = [
    '', '/delivery', '/deliveries', '/dispatch', '/dispatches', '/logistics', '/logistic', '/route', '/routes',
    '/delivery-route', '/delivery-routes', '/shipping', '/shipment', '/assignment', '/assignments',
    '/courier-assignment', '/driver-assignment', '/driver', '/courier', '/deliveryman', '/motoboy', '/entregador',
    '/rider', '/fleet', '/carrier', '/pickup', '/tracking'
  ];

  for (const entry of branches) {
    const listRes = await getJson(`${BASE}/orders`, entry.token);
    const list = Array.isArray(listRes.payload) ? listRes.payload : [];
    const active = pickActive(list);
    const branchResult: any = {
      branch: entry.branch,
      listStatus: listRes.status,
      totalOrders: list.length,
      activeSample: active.map((o: any) => ({ id: o?.id ?? null, status: o?.status ?? null })),
      usefulOrderEndpoints: [],
      usefulRootEndpoints: [],
      checkedOrderEndpointCount: 0,
      checkedRootEndpointCount: 0,
    };

    for (const order of active) {
      const id = String(order?.id || '');
      if (!id) continue;
      for (const suffix of orderSuffixes) {
        const path = `/orders/${encodeURIComponent(id)}${suffix}`;
        const probe = await getJson(`${BASE}${path}`, entry.token);
        branchResult.checkedOrderEndpointCount++;
        if (isUseful(probe)) {
          branchResult.usefulOrderEndpoints.push({
            orderId: id,
            orderStatus: order?.status ?? null,
            path,
            status: probe.status,
            shape: probe.shape,
          });
        }
      }
    }

    for (const endpoint of rootEndpoints) {
      const path = `/${endpoint}`;
      const probe = await getJson(`${BASE}${path}`, entry.token);
      branchResult.checkedRootEndpointCount++;
      if (isUseful(probe)) {
        branchResult.usefulRootEndpoints.push({ path, status: probe.status, shape: probe.shape });
      }
    }

    result.branches.push(branchResult);
  }

  return res.status(200).json(result);
}
