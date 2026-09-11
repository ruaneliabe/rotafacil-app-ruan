import fs from 'node:fs';

const path = 'src/components/OperationDispatchView.tsx';
let s = fs.readFileSync(path, 'utf8');

const start = s.indexOf('                <section className="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3 py-2.5"><div className="flex items-center gap-2"><Bike className="h-4 w-4 text-blue-600" /><h4 className="text-[11px] font-black text-slate-800">Motoboys em entrega');
const endMarker = '                <section className="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3 py-2.5"><div className="flex items-center gap-2"><Navigation className="h-4 w-4 text-orange-500" /><h4 className="text-[11px] font-black text-slate-800">Motoboys voltando';
const end = start >= 0 ? s.indexOf(endMarker, start) : -1;

if (start >= 0 && end > start) {
  const replacement = `                <section className="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3 py-2.5">
                    <div className="flex items-center gap-2"><Bike className="h-4 w-4 text-blue-600" /><h4 className="text-[11px] font-black text-slate-800">Motoboys em entrega ({deliveringDrivers.length})</h4></div>
                    <button onClick={() => setManageFilter('delivering')} className="text-[9px] font-bold text-violet-600">Ver todos</button>
                  </div>
                  <div className="space-y-2 p-2">
                    {searchedDeliveringDrivers.slice(0, 6).map((m, driverIndex) => {
                      const driverOrders = activeOrders
                        .filter((o) => o.assignedMotoboyId === m.id && isRoute(o))
                        .sort((a, b) => Number(a.routeSequence || 999) - Number(b.routeSequence || 999));
                      const nextOrder = driverOrders.find((o) => o.status === 'in_transit') || driverOrders[0];
                      const neighborhoods = Array.from(new Set(driverOrders.map((o) => o.neighborhood).filter(Boolean) as string[]));
                      return (
                        <button key={m.id} onClick={() => setFocusDriverId(focusDriverId === m.id ? null : m.id)} className={\`w-full rounded-xl border px-3 py-3 text-left transition hover:bg-slate-50 \${focusDriverId === m.id ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}\`}>
                          <div className="flex items-start gap-2.5">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-white"><Bike className="h-4 w-4" /></span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <b className="truncate text-[12px] text-slate-900">{m.name}</b>
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[8px] font-black text-blue-700">Rota {String(driverIndex + 1).padStart(2, '0')}</span>
                                <span className="ml-auto shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-black text-emerald-700">Em rota</span>
                              </div>

                              <div className="mt-2">
                                <p className="text-[9px] font-bold text-slate-400">Pedidos ({driverOrders.length})</p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {driverOrders.map((o) => <span key={o.id} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[9px]"><b className="shrink-0 text-blue-700">{code(o)}</b><span className="max-w-[105px] truncate text-slate-600">{o.clientName}</span></span>)}
                                  {!driverOrders.length && <span className="text-[9px] text-slate-400">Nenhum pedido ativo encontrado</span>}
                                </div>
                              </div>

                              {neighborhoods.length > 0 && <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[9px] text-slate-500"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate"><b className="text-slate-600">Bairros:</b> {neighborhoods.join(' / ')}</span></p>}
                              {nextOrder && <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[9px] text-slate-500"><Navigation className="h-3 w-3 shrink-0 text-blue-600" /><span className="truncate"><b className="text-slate-600">Próxima parada:</b> <span className="font-black text-blue-700">{code(nextOrder)}</span> {nextOrder.clientName}</span></p>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {!searchedDeliveringDrivers.length && <div className="px-4 py-4 text-center text-[10px] text-slate-400">Nenhum motoboy em entrega agora.</div>}
                  </div>
                </section>

`;
  s = s.slice(0, start) + replacement + s.slice(end);
  fs.writeFileSync(path, s);
  console.log('[delivery-details] sidebar de entregas detalhada: updated');
} else {
  console.log('[delivery-details] bloco de motoboys em entrega não encontrado: no-op');
}
