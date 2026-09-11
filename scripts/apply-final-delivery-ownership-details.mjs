import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[delivery-owner] ${path}: updated`);
  } else {
    console.log(`[delivery-owner] ${path}: no-op`);
  }
};

// Gestão de entrega: cada motoboy mostra TODOS os pedidos que está levando.
patch('src/components/OperationDispatchView.tsx', (input) => {
  let s = input;
  if (s.includes('data-delivery-owner-details="manage"')) return s;

  const headerPos = s.indexOf('Motoboys em entrega');
  if (headerPos < 0) return s;
  const start = s.lastIndexOf('<section', headerPos);
  const returningPos = s.indexOf('Motoboys voltando', headerPos);
  if (start < 0 || returningPos < 0) return s;
  const end = s.lastIndexOf('<section', returningPos);
  if (end <= start) return s;

  const block = `                <section data-delivery-owner-details="manage" className="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3 py-2.5">
                    <div className="flex items-center gap-2"><Bike className="h-4 w-4 text-blue-600" /><h4 className="text-[11px] font-black text-slate-800">Motoboys em entrega ({deliveringDrivers.length})</h4></div>
                    <button onClick={() => setManageFilter('delivering')} className="text-[9px] font-bold text-violet-600">Ver todos</button>
                  </div>
                  <div className="space-y-2 p-2">
                    {searchedDeliveringDrivers.slice(0, 8).map((m) => {
                      const driverOrders = activeOrders
                        .filter((o) => o.assignedMotoboyId === m.id && isRoute(o))
                        .sort((a, b) => Number(a.routeSequence || 999) - Number(b.routeSequence || 999));
                      const nextOrder = driverOrders.find((o) => o.status === 'in_transit') || driverOrders[0];
                      return (
                        <button key={m.id} onClick={() => setFocusDriverId(focusDriverId === m.id ? null : m.id)} className={\`w-full rounded-xl border p-3 text-left transition hover:bg-slate-50 \${focusDriverId === m.id ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}\`}>
                          <div className="flex items-center gap-2">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-white"><Bike className="h-4 w-4" /></span>
                            <div className="min-w-0 flex-1"><b className="block truncate text-[12px] text-slate-900">{m.name}</b><span className="text-[9px] text-slate-400">{driverOrders.length} pedido{driverOrders.length === 1 ? '' : 's'} na carga</span></div>
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black text-emerald-700">EM ROTA</span>
                          </div>
                          <div className="mt-2.5 space-y-1.5">
                            {driverOrders.map((o, index) => (
                              <div key={o.id} className={\`flex items-center gap-2 rounded-lg border px-2.5 py-2 \${nextOrder?.id === o.id ? 'border-blue-200 bg-blue-50/60' : 'border-slate-100 bg-slate-50'}\`}>
                                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[8px] font-black text-slate-500">{index + 1}</span>
                                <b className="shrink-0 text-[10px] text-blue-700">{code(o)}</b>
                                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-700">{o.clientName}</span>
                                {nextOrder?.id === o.id && <span className="shrink-0 text-[8px] font-black text-blue-700">PRÓXIMA</span>}
                              </div>
                            ))}
                            {!driverOrders.length && <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-[9px] text-slate-400">Nenhum pedido ativo vinculado.</div>}
                          </div>
                          {nextOrder && <div className="mt-2 flex items-center gap-1.5 text-[9px] text-slate-500"><Navigation className="h-3 w-3 shrink-0 text-blue-600" /><span className="truncate"><b className="text-slate-600">Próxima parada:</b> {code(nextOrder)} · {nextOrder.neighborhood || nextOrder.address}</span></div>}
                        </button>
                      );
                    })}
                    {!searchedDeliveringDrivers.length && <div className="px-4 py-4 text-center text-[10px] text-slate-400">Nenhum motoboy em entrega agora.</div>}
                  </div>
                </section>

`;

  return s.slice(0, start) + block + s.slice(end);
});

// Painel principal "Em entrega": agrupa por motoboy, não mais um card solto por pedido.
patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;
  if (s.includes('data-delivery-owner-details="predispatch"')) return s;

  const headerPos = s.indexOf('<h3 className="text-sm font-black text-slate-900">Em entrega</h3>');
  if (headerPos < 0) return s;
  const start = s.lastIndexOf('<section', headerPos);
  const nextPos = s.indexOf('<aside className="space-y-3">', headerPos);
  if (start < 0 || nextPos < 0) return s;

  const block = `        <section data-delivery-owner-details="predispatch" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3">
            <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-50 text-sky-600"><Bike className="h-4 w-4" /></span><div><h3 className="text-sm font-black text-slate-900">Em entrega</h3><p className="text-[10px] text-slate-400">O que cada motoboy está levando agora</p></div></div>
            <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-black text-sky-700">{new Set(routeOrders.map((o) => o.assignedMotoboyId).filter(Boolean)).size}</span>
          </div>
          <div className="max-h-[760px] min-h-[620px] space-y-2 overflow-y-auto p-2.5">
            {Array.from(new Set(routeOrders.map((o) => o.assignedMotoboyId).filter(Boolean) as string[])).length ? Array.from(new Set(routeOrders.map((o) => o.assignedMotoboyId).filter(Boolean) as string[])).map((motoboyId) => {
              const driverOrders = routeOrders.filter((o) => o.assignedMotoboyId === motoboyId).sort((a, b) => Number(a.routeSequence || 999) - Number(b.routeSequence || 999));
              const first = driverOrders[0];
              const next = driverOrders.find((o) => o.status === 'in_transit') || first;
              const driverName = first?.assignedMotoboyName || 'Motoboy';
              return (
                <article key={motoboyId} className="rounded-xl border border-sky-200 bg-sky-50/25 p-3">
                  <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-600 text-white"><Bike className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><b className="block truncate text-xs text-slate-900">{driverName}</b><span className="text-[9px] text-slate-400">{driverOrders.length} pedido{driverOrders.length === 1 ? '' : 's'} na rota</span></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black text-emerald-700">EM ROTA</span></div>
                  <div className="mt-2.5 space-y-1.5">{driverOrders.map((order, index) => <div key={order.id} className={\`flex items-center gap-2 rounded-lg border px-2 py-1.5 \${next?.id === order.id ? 'border-sky-200 bg-white' : 'border-slate-100 bg-white/80'}\`}><span className="text-[8px] font-black text-slate-400">{index + 1}º</span><b className="text-[9px] text-sky-700">{code(order)}</b><span className="min-w-0 flex-1 truncate text-[9px] font-semibold text-slate-600">{order.clientName}</span>{next?.id === order.id && <span className="text-[8px] font-black text-sky-700">PRÓXIMA</span>}</div>)}</div>
                  {next && <p className="mt-2 flex gap-1.5 text-[9px] text-slate-500"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">Próxima: {next.neighborhood || next.address}</span></p>}
                </article>
              );
            }) : <div className="flex min-h-[420px] flex-col items-center justify-center text-center"><Bike className="h-6 w-6 text-slate-300" /><p className="mt-2 text-xs font-bold text-slate-600">Nenhuma entrega na rua</p></div>}
          </div>
        </section>

`;

  return s.slice(0, start) + block + s.slice(nextPos);
});

console.log('[delivery-owner] detalhes por motoboy aplicados nas duas telas');
