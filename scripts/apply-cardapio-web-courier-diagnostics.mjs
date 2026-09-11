import fs from 'node:fs';

const path = 'api/sync-cardapio-web.ts';
let s = fs.readFileSync(path, 'utf8');

const marker = 'CARDAPIO_WEB_COURIER_DIAGNOSTICS_V1';
if (!s.includes(marker)) {
  const anchor = "export default async function handler(req: any, res: any) {";
  const helpers = `
// CARDAPIO_WEB_COURIER_DIAGNOSTICS_V1
// Diagnóstico SOMENTE-LEITURA para descobrir exatamente quais campos de entregador
// a API Partner do Cardápio Web expõe sem vazar dados do cliente.
function collectCourierDiagnostics(order: any) {
  const interesting = /(deliveryman|deliveryperson|deliverydriver|courier|driver|motoboy|entregador|rider|deliveryagent|deliverypartner)/i;
  const safeScalar = (value: any) => {
    if (value == null) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value);
      return text.length > 120 ? text.slice(0, 120) : text;
    }
    return null;
  };
  const matches: Array<{ path: string; type: string; value?: string | null; keys?: string[] }> = [];
  const seen = new Set<any>();
  const walk = (node: any, base = '', depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 6 || seen.has(node)) return;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
      const pathName = base ? base + '.' + key : key;
      if (interesting.test(key)) {
        if (value && typeof value === 'object') {
          matches.push({ path: pathName, type: Array.isArray(value) ? 'array' : 'object', keys: Object.keys(value as any).slice(0, 40) });
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
    deliveryKeys: order?.delivery && typeof order.delivery === 'object' ? Object.keys(order.delivery).sort() : [],
    dispatchKeys: order?.dispatch && typeof order.dispatch === 'object' ? Object.keys(order.dispatch).sort() : [],
    logisticKeys: order?.logistic && typeof order.logistic === 'object' ? Object.keys(order.logistic).sort() : [],
    logisticsKeys: order?.logistics && typeof order.logistics === 'object' ? Object.keys(order.logistics).sort() : [],
    courierFields: matches,
  };
}

`;
  if (!s.includes(anchor)) throw new Error('[cw-courier-diagnostics] handler anchor missing');
  s = s.replace(anchor, helpers + anchor);
}

const counters = "    let dispatchedCount = 0, deliveredCount = 0, cancelledCount = 0, purgedEmptyCount = 0, purgedTakeoutCount = 0, detailReconciledCount = 0, courierReconciledCount = 0;";
const countersWithDebug = counters + "\n    const courierDiagnostics: any[] = [];";
if (s.includes(counters) && !s.includes('const courierDiagnostics: any[] = []')) {
  s = s.replace(counters, countersWithDebug);
}

const beforeLocalPriority = "      const localPriority = hasRotaFacilOwnership(data);";
const debugBlock = `      if (activeStatus && courierDiagnostics.length < 8) {\n        courierDiagnostics.push({\n          externalId,\n          branch,\n          status: normalize(cwOrder?.status),\n          resolvedName: externalDriver || null,\n          resolvedId: externalDriverId || null,\n          resolutionSource: courierResolution.source || null,\n          shape: collectCourierDiagnostics(cwOrder),\n        });\n      }\n      const localPriority = hasRotaFacilOwnership(data);`;
if (s.includes(beforeLocalPriority) && !s.includes('courierDiagnostics.push({')) {
  s = s.replace(beforeLocalPriority, debugBlock);
}

const responseNeedle = "courierDiscoveryEndpoint:lastCourierDiscoveryEndpoint,totalUpdated:";
if (s.includes(responseNeedle) && !s.includes('courierDiagnostics,courierDiscoveryEndpoint')) {
  s = s.replace(responseNeedle, "courierDiagnostics,courierDiscoveryEndpoint:lastCourierDiscoveryEndpoint,totalUpdated:");
}

for (const check of [marker, 'collectCourierDiagnostics', 'courierDiagnostics.push({', 'courierDiagnostics,courierDiscoveryEndpoint']) {
  if (!s.includes(check)) throw new Error('[cw-courier-diagnostics] validation failed: ' + check);
}

fs.writeFileSync(path, s);
console.log('[cw-courier-diagnostics] sanitized courier payload diagnostics enabled');
