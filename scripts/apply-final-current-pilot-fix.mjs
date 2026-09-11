import fs from 'node:fs';

const path = 'src/components/PredispatchRoutesPanel.tsx';
let s = fs.readFileSync(path, 'utf8');

// A visão secundária "Em entrega" precisa mostrar quem está com cada pedido,
// inclusive quando a atribuição veio apenas do Cardápio Web.
const plain = `<p className="mt-2 flex gap-1.5 text-[9px] text-slate-500"><MapPin className="h-3 w-3" />{order.neighborhood || order.address}</p>`;
const detailed = `<p className="mt-2 flex gap-1.5 text-[9px] font-bold text-slate-700"><Bike className="h-3 w-3 shrink-0 text-sky-600" />Motoboy: {(order as any).rotaFacilMotoboyName || order.assignedMotoboyName || (order as any).cardapioWebMotoboyName || (order as any).externalMotoboyName || 'Não informado'}</p><p className="mt-1 flex gap-1.5 text-[9px] text-slate-500"><MapPin className="h-3 w-3" />{order.neighborhood || order.address}</p><span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black text-slate-600">{(order as any).assignmentSource === 'rota_facil' || (order as any).dispatchSource === 'rota_facil' ? 'ROTA FÁCIL' : 'CARDÁPIO WEB'}</span>`;

if (s.includes(plain)) s = s.replaceAll(plain, detailed);

// Em builds onde o card já ganhou detalhes anteriores, garante ao menos o nome do motoboy
// logo após o cliente, sem depender de cadastro local do entregador.
if (!s.includes("Motoboy: {(order as any).rotaFacilMotoboyName")) {
  const clientLine = `<p className="mt-1 text-[10px] font-semibold text-slate-600">{order.clientName}</p>`;
  const clientDetailed = `${clientLine}<p className="mt-1 text-[9px] font-bold text-slate-700">Motoboy: {(order as any).rotaFacilMotoboyName || order.assignedMotoboyName || (order as any).cardapioWebMotoboyName || (order as any).externalMotoboyName || 'Não informado'}</p>`;
  s = s.replaceAll(clientLine, clientDetailed);
}

if (!s.includes('cardapioWebMotoboyName') || !s.includes('externalMotoboyName')) {
  throw new Error('[current-pilot] courier display fallback missing');
}

fs.writeFileSync(path, s);
console.log('[current-pilot] active delivery cards now show Rota Facil/Cardapio Web courier');
