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

// Tooltip real no gráfico financeiro.
patch('src/components/ManagementHub.tsx', (input) => {
  let s = input;

  if (!s.includes('Ticket médio</span><b')) {
    s = s.replace(
      /\{hourly\.map\(\(item\)=>\s*<div key=\{item\.hour\} className="flex h-full min-w-0 flex-1 flex-col justify-end">[\s\S]*?<span className="mt-2 text-center text-\[9px\] font-bold text-slate-400">\{item\.hour\}h<\/span>\s*<\/div>\)\}/,
      `{hourly.map((item)=>{\n                const ticket = item.deliveries > 0 ? item.revenue / item.deliveries : 0;\n                return <div key={item.hour} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">\n                  <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 hidden w-44 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-left shadow-2xl group-hover:block">\n                    <div className="text-[10px] font-black text-white">{item.hour}h</div>\n                    <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px]"><span className="text-slate-400">Pedidos</span><b className="text-white">{item.deliveries}</b></div>\n                    <div className="mt-1 flex items-center justify-between gap-3 text-[10px]"><span className="text-slate-400">Faturamento</span><b className="text-emerald-400">{money(item.revenue)}</b></div>\n                    <div className="mt-1 flex items-center justify-between gap-3 text-[10px]"><span className="text-slate-400">Ticket médio</span><b className="text-violet-300">{money(ticket)}</b></div>\n                  </div>\n                  <div className="relative flex flex-1 cursor-default items-end justify-center">\n                    <div className="w-full max-w-7 rounded-t-md bg-emerald-400/80 transition group-hover:bg-emerald-400" style={{height:\`${Math.max(3,(item.revenue/maxHourlyRevenue)*100)}%\`}} />\n                    <div className="absolute left-1/2 w-2 -translate-x-1/2 rounded-full bg-violet-600 transition group-hover:scale-125" style={{bottom:\`${Math.max(3,(item.deliveries/maxHourlyDeliveries)*92)}%\`,height:8}} />\n                  </div>\n                  <span className="mt-2 text-center text-[9px] font-bold text-slate-400 group-hover:text-slate-200">{item.hour}h</span>\n                </div>;\n              })}`
    );
  }

  return s;
});

// Ajusta a Gestão de entrega para ficar visualmente muito próxima da referência enviada.
patch('src/components/OperationManagementEnhancer.tsx', (input) => {
  let s = input;

  s = s.replace("['Em rota', routeOrders.length, 'Entregando agora'", "['Pedidos em rota', routeOrders.length, 'Entregando agora'");
  s = s.replace("['route', 'Em rota', routeOrders.length]", "['route', 'Pedidos em rota', routeOrders.length]");
  s = s.replace("['returning', 'Voltando', returning.length]", "['returning', 'Motoboys voltando', returning.length]");
  s = s.replace("['delivering', 'Em entrega', delivering.length]", "['delivering', 'Motoboys em entrega', delivering.length]");
  s = s.replace('placeholder="Buscar endereço no mapa..."', 'placeholder="Buscar endereço, entregador ou pedido..."');

  s = s.replace(
    'className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-3 md:p-5"',
    'className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/35 p-4 md:p-7"'
  );
  s = s.replace(
    'className="flex h-[92vh] w-full max-w-[1540px] flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-[#FAF9F6] shadow-2xl"',
    'className="flex h-[90vh] w-full max-w-[1420px] flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-2xl"'
  );
  s = s.replace('className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"', 'className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5"');
  s = s.replace('className="text-[20px] font-black tracking-tight text-slate-950"', 'className="text-[22px] font-black tracking-tight text-slate-950"');
  s = s.replace('className="mt-1 text-xs text-slate-500"', 'className="mt-1 text-[13px] text-slate-500"');
  s = s.replace('className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-white p-3 md:grid-cols-5"', 'className="grid grid-cols-2 gap-2.5 border-b border-slate-200 bg-white px-4 py-3.5 md:grid-cols-5"');
  s = s.replaceAll('className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm"', 'className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"');
  s = s.replaceAll('grid h-11 w-11 shrink-0 place-items-center rounded-xl', 'grid h-12 w-12 shrink-0 place-items-center rounded-2xl');

  s = s.replace('className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3"', 'className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3.5"');
  s = s.replace('className="flex min-w-[250px] max-w-[330px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"', 'className="flex min-w-[310px] max-w-[360px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"');

  s = s.replace('lg:grid-cols-[minmax(0,1fr)_390px]', 'lg:grid-cols-[minmax(0,1fr)_385px]');
  s = s.replace('className="relative min-h-[430px] bg-slate-100 p-3"', 'className="relative min-h-[460px] bg-white p-3"');

  // A referência usa controles de mapa no topo direito, não uma caixa grande de legenda à esquerda.
  s = s.replace(
    /\n\s*<div className="absolute left-6 top-6 z-\[60\] w-\[190px\][\s\S]*?<\/div>\n\n\s*<button onClick=\{recenter\}/,
    `\n            <div className="absolute right-6 top-6 z-[60] flex items-center gap-2">\n              <button type="button" onClick={() => { setShowOrders((v) => !v); setShowDrivers(true); setShowStore(true); }} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 shadow-lg hover:bg-slate-50"><Package className="h-4 w-4 text-slate-600" />Camadas</button>\n              <button type="button" onClick={() => mapShellRef.current?.requestFullscreen?.()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 shadow-lg hover:bg-slate-50"><Zap className="h-4 w-4 text-slate-600" />Expandir mapa</button>\n            </div>\n\n            <button onClick={recenter}`
  );

  // Remove o botão Atribuir visual da fila e deixa o card igual ao exemplo.
  s = s.replace(/\n\s*<button onClick=\{\(\) => assignFirst\(m\)\} className="h-7 rounded-lg bg-violet-600 px-2\.5 text-\[9px\] font-black text-white hover:bg-violet-500">Atribuir<\/button>/g, '');

  s = s.replace(
    'className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-600"',
    'className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-700"'
  );

  // Quando não há movimento, mostra o resumo positivo da referência.
  if (!s.includes('Tudo certo por enquanto!')) {
    s = s.replace(
      '            </section>\n          </aside>',
      `            </section>\n\n            {!waitingOrders.length && !delivering.length && !returning.length && (\n              <div className="mt-3 rounded-2xl bg-violet-50 px-4 py-4">\n                <div className="flex items-start gap-3">\n                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-600">i</span>\n                  <div>\n                    <p className="text-[12px] font-black text-violet-700">Tudo certo por enquanto!</p>\n                    <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Todos os motoboys estão disponíveis e não há pedidos na fila.</p>\n                  </div>\n                </div>\n              </div>\n            )}\n          </aside>`
    );
  }

  return s;
});

// Corrige de vez o controle flutuante de operação da esquerda.
patch('src/components/StoreDashboard.tsx', (input) => {
  let s = input;

  s = s.replace(/className="fixed bottom-\[82px\] left-\[14px\] z-\[90\] hidden w-\[\d+px\] lg:block"/, 'className="fixed bottom-[86px] left-[18px] z-[70] hidden w-[150px] lg:block"');
  s = s.replace(
    /className=\{`group w-full rounded-[^`]+?\$\{/,
    'className={`group w-full rounded-xl border bg-[#151515] p-2.5 text-left shadow-lg transition hover:bg-[#1B1B1B] disabled:cursor-wait disabled:opacity-70 ${'
  );
  s = s.replace('className="flex items-start gap-2.5"', 'className="flex items-center gap-2"');
  s = s.replace(/grid h-\d+ w-\d+ shrink-0 place-items-center rounded-[^ ]+/, 'grid h-7 w-7 shrink-0 place-items-center rounded-lg');
  s = s.replaceAll('className="h-4 w-4', 'className="h-3.5 w-3.5');
  s = s.replace('text-[11px] font-black leading-tight text-slate-900', 'text-[10px] font-black leading-tight text-white');
  s = s.replace('text-[9px] leading-snug text-slate-500', 'text-[8px] leading-snug text-slate-400');
  s = s.replace("? 'Clique para pausar a loja'\n                    : 'Clique para iniciar a operação'", "? 'Recebendo pedidos'\n                    : 'Clique para iniciar'");
  s = s.replace(/className=\{`mt-3 flex h-8 items-center justify-center rounded-lg text-\[10px\] font-black transition \$\{/, 'className={`mt-2 flex h-7 items-center justify-center rounded-lg text-[9px] font-black transition ${');
  s = s.replace("{savingOperation ? 'AGUARDE' : operationOpen ? 'PAUSAR' : 'ABRIR LOJA'}", "{savingOperation ? 'AGUARDE' : operationOpen ? 'ENCERRAR' : 'ABRIR'}");
  s = s.replace("? 'bg-slate-950 text-white group-hover:bg-slate-800'\n              : 'bg-violet-600 text-white group-hover:bg-violet-500'", "? 'bg-emerald-600 text-white group-hover:bg-emerald-500'\n              : 'bg-violet-600 text-white group-hover:bg-violet-500'");

  return s;
});
