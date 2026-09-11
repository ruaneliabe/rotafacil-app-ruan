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

update('src/components/OperationManagementEnhancer.tsx', (input) => {
  let s = input;

  // "Sem entregador" must contain only unfinished orders that truly have no motoboy.
  // Exclude every terminal status we may receive from local data or integrations,
  // and also any order already carrying a delivered timestamp.
  s = s.replace(
    `    () => orders.filter((o) => !['delivered', 'cancelled', 'failed'].includes(String(o.status))),`,
    `    () => orders.filter((o) => {\n      const status = String(o.status || '').toLowerCase();\n      const terminal = ['delivered', 'cancelled', 'failed', 'completed', 'concluded', 'concluido', 'finished', 'finalized'];\n      return !terminal.includes(status) && !o.deliveredAt && !o.deliveredTimestamp;\n    }),`
  );

  return s;
});

update('src/components/RouteMap.tsx', (input) => {
  let s = input;

  // Safe, exact marker-only replacements: keep all map structure intact.
  // At-store motoboy: replace the initial avatar with a motorcycle icon.
  s = s.replace(
    `                <div class="w-8 h-8 rounded-full bg-slate-950 border-2 \${ringColor} text-emerald-300 flex items-center justify-center font-black text-xs shadow-2xl z-30">\n                  \${initial}\n                </div>`,
    `                <div class="w-8 h-8 rounded-full bg-slate-950 border-2 \${ringColor} text-white flex items-center justify-center text-sm shadow-2xl z-30">\n                  🛵\n                </div>`
  );

  // Dense fleet marker: use motorcycle instead of the driver's initial.
  s = s.replace(
    `html: \`<div class="w-5 h-5 rounded-full \${isReturning ? 'bg-amber-500' : 'bg-blue-600'} border-2 border-slate-950 shadow-lg cursor-pointer flex items-center justify-center text-[9px] font-black text-white hover:scale-125 transition-transform">\${initial}</div>\``,
    `html: \`<div class="w-7 h-7 rounded-full \${isReturning ? 'bg-amber-500' : 'bg-blue-600'} border-2 border-white shadow-lg cursor-pointer flex items-center justify-center text-sm text-white hover:scale-110 transition-transform">🛵</div>\``
  );

  // Focused / low-density road motoboy: replace avatar initial with motorcycle.
  s = s.replace(
    `              <div class="w-8 h-8 rounded-full bg-slate-950 border-2 \${ringColor} \${isSelected ? 'ring-4 ring-amber-400/80 scale-110' : ''} flex items-center justify-center font-black text-xs shadow-2xl z-30">\n                \${initial}\n              </div>`,
    `              <div class="w-9 h-9 rounded-full \${isReturning ? 'bg-amber-500' : 'bg-blue-600'} border-2 border-white \${isSelected ? 'ring-4 ring-violet-400/70 scale-110' : ''} flex items-center justify-center text-base shadow-2xl z-30">\n                🛵\n              </div>`
  );

  // Single dedicated motoboy marker uses the same motorcycle avatar.
  s = s.replace(
    `              <div class="w-8 h-8 rounded-full bg-slate-900 border-2 border-emerald-400 text-emerald-300 flex items-center justify-center font-black text-xs shadow-xl z-30">\n                \${initial}\n              </div>`,
    `              <div class="w-9 h-9 rounded-full bg-blue-600 border-2 border-white text-white flex items-center justify-center text-base shadow-xl z-30">\n                🛵\n              </div>`
  );

  return s;
});

console.log('[delivery-reference] finished');
