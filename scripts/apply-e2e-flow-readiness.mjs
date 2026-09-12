import fs from 'node:fs';

const path = 'src/components/StoreDashboardLegacy.tsx';
let source = fs.readFileSync(path, 'utf8');
const before = source;

source = source.replace(/\n\s*disabled=\{Boolean\(shift\.pilotMode\s*&&\s*activeOrders\.length\s*>=\s*5\)\}/g, '');
source = source.replace(/\n\s*disabled=\{shift\.pilotMode\s*&&\s*activeOrders\.length\s*>=\s*5\}/g, '');

if (source.includes('disabled={Boolean(shift.pilotMode && activeOrders.length >= 5)}')) {
  throw new Error('[e2e-flow-readiness] failed to unlock Novo pedido button');
}

if (source !== before) {
  fs.writeFileSync(path, source);
  console.log('[e2e-flow-readiness] Novo pedido stays enabled regardless of pilot active-order count');
} else {
  console.log('[e2e-flow-readiness] Novo pedido already unlocked');
}
