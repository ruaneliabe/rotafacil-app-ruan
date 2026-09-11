const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = 'ed3bxFMKCQGtaqbTVJrDy6ZqfM7z2hEFLaRmQBo3tMW4ZkGuxTmBHAweBTrx';
const CARDAPIO_WEB_HOPE_BURGER_TOKEN = 'ddoFwAw7TbrhTcV1CzeR1bqZAegsjZyzescnjr9QfR2dBEdo6QZNMNkbSeYx';

const BASE = 'https://integracao.cardapioweb.com/api/partner/v1';

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

function safeShape(payload: any) {
  if (payload == null) return null;
  if (Array.isArray(payload)) {
    return {
      type: 'array',
      length: payload.length,
      firstItemKeys: payload[0] && typeof payload[0] === 'object' ? Object.keys(payload[0]).sort() : [],
    };
  }
  if (typeof payload !== 'object') return { type: typeof payload, value: String(payload).slice(0, 120) };

  const interesting = /(driver|courier|motoboy|entregador|delivery|rider|logistic|dispatch|route|shipping)/i;
  const hits: any[] = [];
  const seen = new Set<any>();
  const walk = (node: any, base = '', depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 6 || seen.has(node)) return;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
      const path = base ? `${base}.${key}` : key;
      if (interesting.test(key)) {
        if (value && typeof value === 'object') {
          hits.push({ path, type: Array.isArray(value) ? 'array' : 'object', keys: Object.keys(value as any).slice(0, 40) });
        } else {
          hits.push({ path, type: typeof value, value: String(value ?? '').slice(0, 120) });
        }
      }
      if (value && typeof value === 'object') walk(value, path, depth + 1);
    }
  };
  walk(payload);

  return {
    type: 'object',
    keys: Object.keys(payload).sort(),
    courierRelated: hits,
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
  return list.filter((o: any) => !['closed','canceled','cancelled'].includes(normalize(o?.status))).slice(0, 3);
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const branches = [
    { branch: 'hope_pizza', token: CARDAPIO_WEB_HOPE_PIZZA_TOKEN },
    { branch: 'hope_burger', token: CARDAPIO_WEB_HOPE_BURGER_TOKEN },
  ];

  const result: any = { success: true, runtimeMarker: 'cw-courier-probe-v1', branches: [] };

  for (const entry of branches) {
    const listRes = await getJson(`${BASE}/orders`, entry.token);
    const list = Array.isArray(listRes.payload) ? listRes.payload : [];
    const active = pickActive(list);
    const branchResult: any = {
      branch: entry.branch,
      listStatus: listRes.status,
      totalOrders: list.length,
      activeSample: active.map((o: any) => ({ id: o?.id ?? null, status: o?.status ?? null, keys: Object.keys(o || {}).sort() })),
      probes: [],
      directoryProbes: [],
    };

    for (const order of active) {
      const id = String(order?.id || '');
      if (!id) continue;
      const suffixes = ['', '/delivery', '/deliveryman', '/delivery-man', '/driver', '/courier', '/motoboy', '/entregador'];
      const orderProbe: any = { id, status: order?.status ?? null, endpoints: [] };
      for (const suffix of suffixes) {
        const probe = await getJson(`${BASE}/orders/${encodeURIComponent(id)}${suffix}`, entry.token);
        orderProbe.endpoints.push({ path: `/orders/${id}${suffix}`, status: probe.status, ok: probe.ok, shape: probe.shape });
      }
      branchResult.probes.push(orderProbe);
    }

    for (const endpoint of ['deliverymen','delivery-men','delivery_people','delivery-persons','deliverypersons','drivers','couriers','motoboys','entregadores']) {
      const probe = await getJson(`${BASE}/${endpoint}`, entry.token);
      branchResult.directoryProbes.push({ path: `/${endpoint}`, status: probe.status, ok: probe.ok, shape: probe.shape });
    }

    result.branches.push(branchResult);
  }

  return res.status(200).json(result);
}
