import fs from 'node:fs';

const path = 'api/sync-cardapio-web.ts';
let s = fs.readFileSync(path, 'utf8');

const marker = 'CARDAPIO_WEB_COURIER_DIAGNOSTICS_V2';

// Remove a versão antiga do diagnóstico, se já tiver sido injetada por build anterior.
if (s.includes('// CARDAPIO_WEB_COURIER_DIAGNOSTICS_V1')) {
  const start = s.indexOf('// CARDAPIO_WEB_COURIER_DIAGNOSTICS_V1');
  const end = s.indexOf('export default async function handler(req: any, res: any) {', start);
  if (start >= 0 && end > start) s = s.slice(0, start) + s.slice(end);
}

if (!s.includes(marker)) {
  const anchor = 'export default async function handler(req: any, res: any) {';
  const helpers = `
// CARDAPIO_WEB_COURIER_DIAGNOSTICS_V2
// Diagnóstico SOMENTE-LEITURA do payload REAL retornado pela API Partner do Cardápio Web.
// Não depende do pedido existir/matchear no Firestore; amostra diretamente cwList.
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

`;
  if (!s.includes(anchor)) throw new Error('[cw-courier-diagnostics-v2] handler anchor missing');
  s = s.replace(anchor, helpers + anchor);
}

// Remove o contador/array V1 antigo se estiver presente e injeta o V2.
s = s.replace(/\n\s*const courierDiagnostics: any\[\] = \[\];/g, '');
const counters = "    let dispatchedCount = 0, deliveredCount = 0, cancelledCount = 0, purgedEmptyCount = 0, purgedTakeoutCount = 0, detailReconciledCount = 0, courierReconciledCount = 0;";
if (s.includes(counters) && !s.includes('const courierDiagnostics: any[] = cwList')) {
  s = s.replace(counters, counters + `\n    const courierDiagnostics: any[] = cwList.slice(0, 12).map((o: any) => ({\n      branch: o?._branch || null,\n      externalId: o?.id != null ? String(o.id) : null,\n      displayId: o?.display_id != null ? String(o.display_id) : null,\n      status: normalize(o?.status),\n      resolvedName: courierName(o),\n      resolvedId: typeof courierId === 'function' ? courierId(o) : null,\n      shape: collectCourierDiagnostics(o),\n    }));`);
}

// Remove push V1, que dependia de activeStatus/Firestore e por isso retornava [].
s = s.replace(/\n\s*if \(activeStatus && courierDiagnostics\.length < 8\) \{[\s\S]*?\n\s*\}/g, '');

// Garante diagnostics no JSON final.
if (s.includes('courierDiscoveryEndpoint:lastCourierDiscoveryEndpoint,totalUpdated:') && !s.includes('courierDiagnostics,courierDiscoveryEndpoint')) {
  s = s.replace('courierDiscoveryEndpoint:lastCourierDiscoveryEndpoint,totalUpdated:', 'courierDiagnostics,courierDiscoveryEndpoint:lastCourierDiscoveryEndpoint,totalUpdated:');
}

for (const check of [marker, 'cwList.slice(0, 12)', 'collectCourierDiagnostics(o)', 'courierDiagnostics,courierDiscoveryEndpoint']) {
  if (!s.includes(check)) throw new Error('[cw-courier-diagnostics-v2] validation failed: ' + check);
}

fs.writeFileSync(path, s);
console.log('[cw-courier-diagnostics-v2] direct Cardapio Web payload diagnostics enabled');
