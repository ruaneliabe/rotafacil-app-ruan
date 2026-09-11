import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after === before) {
    console.log(`[patch] ${path}: already patched or no-op`);
    return;
  }
  fs.writeFileSync(path, after);
  console.log(`[patch] ${path}: updated`);
};

patch('src/components/ManagementHub.tsx', (input) => {
  let s = input;

  if (!s.includes('Ticket médio</span><b')) {
    s = s.replace(
      /\{hourly\.map\(\(item\)=>\s*<div key=\{item\.hour\} className="flex h-full min-w-0 flex-1 flex-col justify-end">[\s\S]*?<span className="mt-2 text-center text-\[9px\] font-bold text-slate-400">\{item\.hour\}h<\/span>\s*<\/div>\)\}/,
      `{hourly.map((item)=>{\n                const ticket = item.deliveries > 0 ? item.revenue / item.deliveries : 0;\n                return <div key={item.hour} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">\n                  <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 hidden w-44 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-left shadow-2xl group-hover:block">\n                    <div className="text-[10px] font-black text-white">{item.hour}h</div>\n                    <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px]"><span className="text-slate-400">Pedidos</span><b className="text-white">{item.deliveries}</b></div>\n                    <div className="mt-1 flex items-center justify-between gap-3 text-[10px]"><span className="text-slate-400">Faturamento</span><b className="text-emerald-400">{money(item.revenue)}</b></div>\n                    <div className="mt-1 flex items-center justify-between gap-3 text-[10px]"><span className="text-slate-400">Ticket médio</span><b className="text-violet-300">{money(ticket)}</b></div>\n                  </div>\n                  <div className="relative flex flex-1 cursor-default items-end justify-center">\n                    <div className="w-full max-w-7 rounded-t-md bg-emerald-400/80 transition group-hover:bg-emerald-400" style={{height:\`\${item.revenue > 0 ? Math.max(3,(item.revenue/maxHourlyRevenue)*100) : 0}%\`}} />\n                    {item.deliveries > 0 && <div className="absolute left-1/2 w-2 -translate-x-1/2 rounded-full bg-violet-600 transition group-hover:scale-125" style={{bottom:\`\${Math.max(3,(item.deliveries/maxHourlyDeliveries)*92)}%\`,height:8}} />}\n                  </div>\n                  <span className="mt-2 text-center text-[9px] font-bold text-slate-400 group-hover:text-slate-200">{item.hour}h</span>\n                </div>;\n              })}`
    );
  }

  s = s.replace(
    'style={{height:`${Math.max(3,(item.revenue/maxHourlyRevenue)*100)}%`}}',
    'style={{height:`${item.revenue > 0 ? Math.max(3,(item.revenue/maxHourlyRevenue)*100) : 0}%`}}'
  );

  // Evita envolver novamente o marcador quando ele já possui a condição de entregas > 0.
  if (!s.includes('{item.deliveries > 0 && <div className="absolute left-1/2 w-2 -translate-x-1/2 rounded-full bg-violet-600 transition group-hover:scale-125"')) {
    s = s.replace(
      '<div className="absolute left-1/2 w-2 -translate-x-1/2 rounded-full bg-violet-600 transition group-hover:scale-125" style={{bottom:`${Math.max(3,(item.deliveries/maxHourlyDeliveries)*92)}%`,height:8}} />',
      '{item.deliveries > 0 && <div className="absolute left-1/2 w-2 -translate-x-1/2 rounded-full bg-violet-600 transition group-hover:scale-125" style={{bottom:`${Math.max(3,(item.deliveries/maxHourlyDeliveries)*92)}%`,height:8}} />}'
    );
  }

  return s;
});

// Remove o toggle de "Loja" da legenda do mapa. A loja continua sempre visível no mapa.
patch('src/components/OperationManagementEnhancer.tsx', (input) => {
  let s = input;
  s = s.replace(
    /\n\s*<button onClick=\{\(\) => setShowStore\(\(v\) => !v\)\} className="flex w-full items-start gap-2\.5 px-3 py-2\.5 text-left hover:bg-slate-50">[\s\S]*?<\/button>/,
    ''
  );
  return s;
});

// Mantém compatibilidade com versões antigas do card de operação sem sobrescrever
// o card atual, que já é posicionado e estilizado diretamente no StoreDashboard.
patch('src/components/StoreDashboard.tsx', (input) => input);
