import fs from 'node:fs';

const path = 'api/sync-cardapio-web.ts';
let s = fs.readFileSync(path, 'utf8');

const marker = 'CARDAPIO_WEB_COURIER_DIAGNOSTICS_V3';

// Remove versões antigas do diagnóstico, se já tiverem sido injetadas por build anterior.
for (const oldMarker of ['// CARDAPIO_WEB_COURIER_DIAGNOSTICS_V1','// CARDAPIO_WEB_COURIER_DIAGNOSTICS_V2']) {
  if (s.includes(oldMarker)) {
    const start = s.indexOf(oldMarker);
    const end = s.indexOf('export default async function handler(req: any, res: any) {', start);
    if (start >= 0 && end > start) s = s.slice(0, start) + s.slice(end);
  }
}

if (!s.includes(marker)) {
  const anchor = 'export default async function handler(req: any, res: any) {';
  const helpers = `
// CARDAPIO_WEB_COURIER_DIAGNOSTICS_V3
// Diagnóstico SOMENTE-LEITURA do payload REAL retornado pela API Partner do Cardápio Web.
function collectCourierDiagnostics(order: any) {
  const interesting = /(deliveryman|deliveryperson|deliverydriver|courier|driver|motoboy|entregador|rider|deliveryagent|deliverypartner|delivery|dispatch|logistic|route|shipping)/i;
  const safeScalar = (value: any) => {
    if (value == null) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value);
      return text.length > 160 ? text.slice(0, 160) : text;
    }
    return null;
  };
  const matches: Array<{ path: string; type: string; value?: string | null; keys?: string[] }> = [];
  const seen = new Set<any>();
  const walk = (node: any, base = '', depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 7 || seen.has(node)) return;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
      const pathName = base ? base + '.' + key : key;
      if (interesting.test(key)) {
        if (value && typeof value === 'object') {
          matches.push({ path: pathName, type: Array.isArray(value) ? 'array' : 'object', keys: Object.keys(value as any).slice(0, 50) });
        } else {
          matches.push({ path: pathName, type: typeof value, value: safeScalar(value) });
        }
      }
      if (value && typeof value === 'object') walk(value, pathName, depth + 1);
    }
  };
  walk(order);
  return {
    topLevelKeys: order && typeof order === 'object' ? Object.keys(order).sort() : [],
    courierFields: matches,
  };
}

async function collectActiveDetailDiagnostics(cwList: any[]) {
  const diagnostics: any[] = [];
  const active = cwList
    .filter((o: any) => !['closed','canceled','cancelled'].includes(String(o?.status || '').toLowerCase()))
    .slice(0, 8);

  for (const summary of active) {
    const id = String(summary?.id || '');
    if (!id) continue;
    const token = summary?._branch === 'hope_burger' ? CARDAPIO_WEB_HOPE_BURGER_TOKEN : CARDAPIO_WEB_HOPE_PIZZA_TOKEN;
    const detail = await fetchOrderById(id, token);
    diagnostics.push({
      branch: summary?._branch || null,
      externalId: id,
      summaryStatus: summary?.status || null,
      detailFound: Boolean(detail),
      detailStatus: detail?.status || null,
      resolvedName: detail ? courierName(detail) : null,
      resolvedId: detail && typeof courierId === 'function' ? courierId(detail) : null,
      shape: detail ? collectCourierDiagnostics(detail) : null,
    });
  }
  return diagnostics;
}

`;
  if (!s.includes(anchor)) throw new Error('[cw-courier-diagnostics-v3] handler anchor missing');
  s = s.replace(anchor, helpers + anchor);
}

// Mantém apenas uma definição de diagnostics e injeta o detalhe ativo junto.
s = s.replace(/\n\s*const courierDiagnostics: any\[\] = \[[\s\S]*?\];/g, '');
s = s.replace(/\n\s*const courierDiagnostics: any\[\] = cwList\.slice\(0, 12\)[\s\S]*?\}\)\);/g, '');
s = s.replace(/\n\s*const activeDetailDiagnostics = await collectActiveDetailDiagnostics\(cwList\);/g, '');

const counters = "    let dispatchedCount = 0, deliveredCount = 0, cancelledCount = 0, purgedEmptyCount = 0, purgedTakeoutCount = 0, detailReconciledCount = 0, courierReconciledCount = 0;";
if (s.includes(counters)) {
  const injected = counters + `\n    const courierDiagnostics: any[] = cwList.slice(0, 12).map((o: any) => ({\n      branch: o?._branch || null,\n      externalId: o?.id != null ? String(o.id) : null,\n      displayId: o?.display_id != null ? String(o.display_id) : null,\n      status: normalize(o?.status),\n      resolvedName: courierName(o),\n      resolvedId: typeof courierId === 'function' ? courierId(o) : null,\n      shape: collectCourierDiagnostics(o),\n    }));\n    const activeDetailDiagnostics = await collectActiveDetailDiagnostics(cwList);`;
  s = s.replace(counters, injected);
}

s = s.replace(
  "const activeStatus = ['pending','preparing','ready_at_counter','picked_up','dispatched','in_transit'].includes(data.status);",
  "const activeStatus = ['pending','preparing','ready_at_counter','picked_up','dispatched','in_transit','waiting_to_catch'].includes(data.status) || ['waiting_to_catch','dispatched','out_for_delivery','released'].includes(normalize(cwOrder?.status));"
);

// Garante que o retorno inclua os dois diagnósticos, sem depender da formatação exata do objeto.
if (!s.includes('activeDetailDiagnostics')) {
  throw new Error('[cw-courier-diagnostics-v3] activeDetailDiagnostics injection missing');
}
if (!s.includes('courierDiagnostics')) {
  throw new Error('[cw-courier-diagnostics-v3] courierDiagnostics injection missing');
}

if (!s.includes('activeDetailDiagnostics,courierDiscoveryEndpoint')) {
  s = s.replace(/courierDiagnostics\s*,\s*courierDiscoveryEndpoint/g, 'courierDiagnostics,activeDetailDiagnostics,courierDiscoveryEndpoint');
}

// Fallback para objetos que tenham courierDiagnostics mas outra ordem/espacamento.
if (!s.includes('activeDetailDiagnostics,courierDiscoveryEndpoint')) {
  const returnIdx = s.lastIndexOf('return res.status(200).json({');
  if (returnIdx >= 0) {
    const objectEnd = s.indexOf('});', returnIdx);
    if (objectEnd > returnIdx) {
      const chunk = s.slice(returnIdx, objectEnd);
      if (chunk.includes('courierDiagnostics') && chunk.includes('courierDiscoveryEndpoint')) {
        const patchedChunk = chunk.replace(/courierDiagnostics\s*,/, 'courierDiagnostics,activeDetailDiagnostics,');
        s = s.slice(0, returnIdx) + patchedChunk + s.slice(objectEnd);
      }
    }
  }
}

for (const check of [marker, 'collectActiveDetailDiagnostics', 'const activeDetailDiagnostics = await collectActiveDetailDiagnostics(cwList);', 'waiting_to_catch', 'courierDiagnostics', 'activeDetailDiagnostics', 'courierDiscoveryEndpoint']) {
  if (!s.includes(check)) throw new Error('[cw-courier-diagnostics-v3] validation failed: ' + check);
}

fs.writeFileSync(path, s);
console.log('[cw-courier-diagnostics-v3] summary + active order detail diagnostics enabled');
