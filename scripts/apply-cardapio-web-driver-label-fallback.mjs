import fs from 'node:fs';

const path = 'src/components/PredispatchRoutesPanel.tsx';
let s = fs.readFileSync(path, 'utf8');

const oldFallback = `(order as any).rotaFacilMotoboyName || order.assignedMotoboyName || (order as any).cardapioWebMotoboyName || (order as any).externalMotoboyName || 'Não informado'`;
const newFallback = `(order as any).rotaFacilMotoboyName || order.assignedMotoboyName || (order as any).cardapioWebMotoboyName || (order as any).externalMotoboyName || (((order as any).assignmentSource === 'rota_facil' || (order as any).dispatchSource === 'rota_facil') ? 'Não informado' : 'Definido no Cardápio Web')`;

if (s.includes(oldFallback)) {
  s = s.replaceAll(oldFallback, newFallback);
}

// Builds anteriores também podem ter o fallback de ID do Cardápio Web.
const idFallback = `(order as any).externalMotoboyName || ((order as any).cardapioWebMotoboyId ? \`Entregador CW #\${(order as any).cardapioWebMotoboyId}\` : 'Não informado')`;
const idReplacement = `(order as any).externalMotoboyName || ((order as any).cardapioWebMotoboyId ? \`Entregador CW #\${(order as any).cardapioWebMotoboyId}\` : (((order as any).assignmentSource === 'rota_facil' || (order as any).dispatchSource === 'rota_facil') ? 'Não informado' : 'Definido no Cardápio Web'))`;
if (s.includes(idFallback)) {
  s = s.replaceAll(idFallback, idReplacement);
}

if (!s.includes('Definido no Cardápio Web')) {
  throw new Error('[cw-driver-label] fallback label was not applied');
}

fs.writeFileSync(path, s);
console.log('[cw-driver-label] Cardapio Web-owned deliveries now show a clear external-driver label');
