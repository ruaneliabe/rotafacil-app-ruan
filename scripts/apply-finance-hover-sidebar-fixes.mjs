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
      `{hourly.map((item)=>{\n                const ticket = item.deliveries > 0 ? item.revenue / item.deliveries : 0;\n                return <div key={item.hour} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">\n                  <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 hidden w-44 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-left shadow-2xl group-hover:block">\n                    <div className="text-[10px] font-black text-white">{item.hour}h</div>\n                    <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px]"><span className="text-slate-400">Pedidos</span><b className="text-white">{item.deliveries}</b></div>\n                    <div className="mt-1 flex items-center justify-between gap-3 text-[10px]"><span className="text-slate-400">Faturamento</span><b className="text-emerald-400">{money(item.revenue)}</b></div>\n                    <div className="mt-1 flex items-center justify-between gap-3 text-[10px]"><span className="text-slate-400">Ticket médio</span><b className="text-violet-300">{money(ticket)}</b></div>\n                  </div>\n                  <div className="relative flex flex-1 cursor-default items-end justify-center">\n                    <div className="w-full max-w-7 rounded-t-md bg-emerald-400/80 transition group-hover:bg-emerald-400" style={{height:\`\${Math.max(3,(item.revenue/maxHourlyRevenue)*100)}%\`}} />\n                    <div className="absolute left-1/2 w-2 -translate-x-1/2 rounded-full bg-violet-600 transition group-hover:scale-125" style={{bottom:\`\${Math.max(3,(item.deliveries/maxHourlyDeliveries)*92)}%\`,height:8}} />\n                  </div>\n                  <span className="mt-2 text-center text-[9px] font-bold text-slate-400 group-hover:text-slate-200">{item.hour}h</span>\n                </div>;\n              })}`
    );
  }

  return s;
});

// O card que aparece no canto esquerdo vem do wrapper StoreDashboard.tsx,
// não do dashboard legado. Compacta o card real usado em produção.
patch('src/components/StoreDashboard.tsx', (input) => {
  let s = input;

  s = s.replace(
    'className="fixed bottom-[82px] left-[14px] z-[90] hidden w-[166px] lg:block"',
    'className="fixed bottom-[82px] left-[14px] z-[90] hidden w-[148px] lg:block"'
  );
  s = s.replace(
    'className={`group w-full rounded-2xl border bg-white p-3 text-left shadow-[0_8px_30px_rgba(15,23,42,.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_34px_rgba(15,23,42,.12)] disabled:cursor-wait disabled:opacity-70 ${',
    'className={`group w-full rounded-xl border bg-white p-2.5 text-left shadow-sm transition-all hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70 ${'
  );
  s = s.replace('className="flex items-start gap-2.5"', 'className="flex items-center gap-2"');
  s = s.replace('grid h-9 w-9 shrink-0 place-items-center rounded-xl', 'grid h-7 w-7 shrink-0 place-items-center rounded-lg');
  s = s.replaceAll('className="h-4 w-4', 'className="h-3.5 w-3.5');
  s = s.replace("? 'Clique para pausar a loja'\n                    : 'Clique para iniciar a operação'", "? 'Operação em andamento'\n                    : 'Clique para abrir'");
  s = s.replace(
    'className={`mt-3 flex h-8 items-center justify-center rounded-lg text-[10px] font-black transition ${',
    'className={`mt-2 flex h-7 items-center justify-center rounded-lg text-[9px] font-black transition ${'
  );
  s = s.replace("{savingOperation ? 'AGUARDE' : operationOpen ? 'PAUSAR' : 'ABRIR LOJA'}", "{savingOperation ? 'AGUARDE' : operationOpen ? 'ENCERRAR' : 'ABRIR'}");

  return s;
});
