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

  const oldChart = `{hourly.map((item)=><div key={item.hour} className="flex h-full min-w-0 flex-1 flex-col justify-end">\n                <div className="relative flex flex-1 items-end justify-center">\n                  <div className="w-full max-w-7 rounded-t-md bg-emerald-400/80" style={{height:\`${'${'}Math.max(3,(item.revenue/maxHourlyRevenue)*100)}%\`}} title={\`${'${'}item.hour}h · ${'${'}money(item.revenue)}\`} />\n                  <div className="absolute left-1/2 w-2 -translate-x-1/2 rounded-full bg-violet-600" style={{bottom:\`${'${'}Math.max(3,(item.deliveries/maxHourlyDeliveries)*92)}%\`,height:8}} title={\`${'${'}item.deliveries} entregas\`} />\n                </div>\n                <span className="mt-2 text-center text-[9px] font-bold text-slate-400">{item.hour}h</span>\n              </div>)}`;

  const newChart = `{hourly.map((item)=>{\n                const ticket = item.deliveries > 0 ? item.revenue / item.deliveries : 0;\n                return <div key={item.hour} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">\n                  <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 hidden w-44 -translate-x-1/2 rounded-xl border border-slate-200 bg-slate-950 px-3 py-2.5 text-left shadow-2xl group-hover:block">\n                    <div className="text-[10px] font-black text-white">{item.hour}h</div>\n                    <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px]"><span className="text-slate-400">Pedidos</span><b className="text-white">{item.deliveries}</b></div>\n                    <div className="mt-1 flex items-center justify-between gap-3 text-[10px]"><span className="text-slate-400">Faturamento</span><b className="text-emerald-400">{money(item.revenue)}</b></div>\n                    <div className="mt-1 flex items-center justify-between gap-3 text-[10px]"><span className="text-slate-400">Ticket médio</span><b className="text-violet-300">{money(ticket)}</b></div>\n                  </div>\n                  <div className="relative flex flex-1 items-end justify-center cursor-default">\n                    <div className="w-full max-w-7 rounded-t-md bg-emerald-400/80 transition group-hover:bg-emerald-400" style={{height:\`${'${'}Math.max(3,(item.revenue/maxHourlyRevenue)*100)}%\`}} />\n                    <div className="absolute left-1/2 w-2 -translate-x-1/2 rounded-full bg-violet-600 ring-2 ring-violet-600/10 transition group-hover:scale-125" style={{bottom:\`${'${'}Math.max(3,(item.deliveries/maxHourlyDeliveries)*92)}%\`,height:8}} />\n                  </div>\n                  <span className="mt-2 text-center text-[9px] font-bold text-slate-400 group-hover:text-slate-700">{item.hour}h</span>\n                </div>;\n              })}`;

  if (s.includes(oldChart)) s = s.replace(oldChart, newChart);

  return s;
});

patch('src/components/StoreDashboardLegacy.tsx', (input) => {
  let s = input;

  const oldSidebar = `<div className="space-y-2.5">\n          <button\n            type="button"\n            onClick={onToggleShift}\n            className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800"\n          >\n            <span className={\`w-1.5 h-1.5 rounded-full ${'${'}shift.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}\`} />\n            {shift.isOpen ? 'Loja aberta · encerrar' : 'Loja fechada · abrir'}\n          </button>`;

  const newSidebar = `<div className="space-y-2.5">\n          <div className="rounded-xl border border-slate-200 bg-white/70 px-2.5 py-2">\n            <div className="flex items-center gap-2">\n              <span className={\`h-2 w-2 shrink-0 rounded-full ${'${'}shift.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}\`} />\n              <div className="min-w-0 flex-1">\n                <p className="truncate text-[11px] font-black text-slate-700">{shift.isOpen ? 'Operação aberta' : 'Operação fechada'}</p>\n                <p className="mt-0.5 text-[9px] text-slate-400">{shift.isOpen ? 'Recebendo e despachando pedidos' : 'Sem novos despachos'}</p>\n              </div>\n            </div>\n            <button\n              type="button"\n              onClick={onToggleShift}\n              className={\`mt-2 h-7 w-full rounded-lg text-[10px] font-black transition ${'${'}shift.isOpen ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50' : 'bg-violet-600 text-white hover:bg-violet-500'}\`}\n            >\n              {shift.isOpen ? 'Encerrar operação' : 'Abrir operação'}\n            </button>\n          </div>`;

  if (s.includes(oldSidebar)) s = s.replace(oldSidebar, newSidebar);

  return s;
});
