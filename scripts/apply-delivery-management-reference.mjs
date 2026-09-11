import fs from 'node:fs';

const update = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[delivery-reference] ${path}: updated`);
  } else {
    console.log(`[delivery-reference] ${path}: no-op`);
  }
};

update('src/components/OperationDispatchView.tsx', (input) => {
  let s = input;

  // Keep the management filters identical to the approved reference.
  s = s.replace(
    /\{\(\[\s*\['all',\s*'Todos'[\s\S]*?\] as Array<\[ManageFilter, string, number\]>\)\.map\(\(\[id, label, count\]\) => <button[\s\S]*?<\/button>\)\}/,
    `{([\n                ['all', 'Todos', activeOrders.length],\n                ['unassigned', 'Sem entregador', grouped.waiting.length],\n                ['route', 'Em rota', grouped.route.length],\n                ['returning', 'Voltando', returningDrivers.length],\n                ['delivering', 'Em entrega', deliveringDrivers.length],\n                ['available', 'Disponíveis', availableDrivers.length],\n              ] as Array<[ManageFilter, string, number]>).map(([id, label, count]) => <button key={id} onClick={() => setManageFilter(id)} className={\`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[11px] font-black transition \${manageFilter === id ? 'border-violet-600 bg-violet-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}\`}>{id === 'unassigned' ? <PackageOpen className=\"h-3.5 w-3.5\" /> : id === 'route' || id === 'delivering' ? <Bike className=\"h-3.5 w-3.5\" /> : id === 'returning' ? <Navigation className=\"h-3.5 w-3.5\" /> : id === 'available' ? <Users className=\"h-3.5 w-3.5\" /> : null}{label}<span className={\`text-[9px] \${manageFilter === id ? 'text-white/80' : 'text-slate-400'}\`}>({count})</span></button>)}`
  );

  // Remove ONLY the right-side "Pedidos sem entregador" section.
  // The top "Sem entregador" filter remains visible and functional.
  s = s.replace(
    /\n\s*<section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50\/50 px-3 py-2\.5"><div className="flex items-center gap-2"><PackageOpen className="h-4 w-4 text-slate-500" \/><h4 className="text-\[11px\] font-black text-slate-800">Pedidos sem entregador \(\{grouped\.waiting\.length\}\)<\/h4>[\s\S]*?<\/section>/,
    ''
  );

  return s;
});

// IMPORTANT: RouteMap is intentionally not rewritten here. Previous regex-based
// marker rewriting could remove structural braces and break the production build.
// Any map marker visual changes must be made directly in RouteMap.tsx.

console.log('[delivery-reference] finished');
