import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after === before) {
    console.log(`[layout-patch] ${path}: already patched or no-op`);
    return;
  }
  fs.writeFileSync(path, after);
  console.log(`[layout-patch] ${path}: updated`);
};

// Ajustes da Central de pedidos para operação com alto volume:
// - sugestões de rota mais compactas e com rótulo legível no lugar do percentual;
// - idade do pedido mais antigo visível no cabeçalho da fila;
// - ação "Atribuir mais antigos" junto da própria coluna de aguardando;
// - seletor mostra apenas motoboys realmente disponíveis, em ordem de fila;
// - colunas operacionais altas para suportar bastante volume.
patch('src/components/OperationDispatchView.tsx', (input) => {
  let s = input;

  s = s.replace(
    'className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"',
    'className="min-w-0 min-h-[760px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"'
  );

  s = s.replace(
    'max-h-[650px] min-h-[330px] overflow-y-auto',
    'max-h-[1000px] min-h-[700px] overflow-y-auto'
  );

  s = s.replace(
    'className="flex h-[220px] flex-col items-center justify-center px-5 text-center"',
    'className="flex h-[600px] flex-col items-center justify-center px-5 text-center"'
  );

  // Rotas que combinam: reduz altura e peso visual sem perder as 3 melhores sugestões.
  s = s.replace(
    'className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3.5"',
    'className="rounded-2xl border border-violet-200 bg-violet-50/60 px-3 py-2.5"'
  );
  s = s.replace(
    'className="mb-2 flex items-center gap-2"',
    'className="mb-1.5 flex items-center gap-2"'
  );
  s = s.replace(
    'className="text-sm font-black text-slate-900">Rotas que combinam',
    'className="text-xs font-black text-slate-900">Rotas que combinam'
  );
  s = s.replace(
    'className="rounded-xl border border-violet-200 bg-white p-3 text-left"',
    'className="rounded-xl border border-violet-200 bg-white px-2.5 py-2 text-left transition hover:border-violet-300 hover:bg-violet-50/40"'
  );
  s = s.replace(
    'className="mt-1 text-[10px] text-slate-500">{s.corridorName}',
    'className="mt-0.5 truncate text-[9px] text-slate-500">{s.corridorName}'
  );
  s = s.replace(
    '<span className="text-[10px] font-black text-violet-700">{s.confidenceScore}%</span>',
    '<span className="whitespace-nowrap rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-black text-violet-700">{s.confidenceScore >= 95 ? \'Excelente combinação\' : s.confidenceScore >= 80 ? \'Boa combinação\' : \'Combinação razoável\'}</span>'
  );

  // Remove a faixa isolada de atribuição: a ação passa a morar no cabeçalho da coluna "Aguardando entregador".
  s = s.replace(
    /\n\s*\{grouped\.waiting\.length > 0 && queueDrivers\.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">[\s\S]*?<\/div>\}\n/,
    '\n'
  );

  const oldHeader = '<div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3.5 py-3"><div className="flex gap-2.5"><span className={`w-1 self-stretch rounded-full ${tones[id]}`} /><div><h3 className="text-[13px] font-black text-slate-900">{title}</h3><p className="mt-0.5 text-[10px] text-slate-400">{subtitle}</p></div></div><span className="grid h-7 min-w-7 place-items-center rounded-full bg-slate-100 px-2 text-xs font-black text-slate-600">{items.length}</span></div>';
  const newHeader = '<div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3.5 py-3"><div className="flex min-w-0 gap-2.5"><span className={`w-1 self-stretch rounded-full ${tones[id]}`} /><div className="min-w-0"><h3 className="text-[13px] font-black text-slate-900">{title}</h3><div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-[10px] text-slate-400">{subtitle}</p>{id === \'waiting\' && items.length > 0 && <span className={`text-[9px] font-black ${minsSince(stamp(items[0])) >= 15 ? \'text-rose-600\' : \'text-amber-600\'}`}>Mais antigo há {duration(minsSince(stamp(items[0])))}</span>}</div></div></div><div className="flex shrink-0 flex-col items-end gap-1.5"><span className="grid h-7 min-w-7 place-items-center rounded-full bg-slate-100 px-2 text-xs font-black text-slate-600">{items.length}</span>{id === \'waiting\' && items.length > 0 && queueDrivers.length > 0 && <button onClick={assignOldest} className="h-7 rounded-lg bg-violet-600 px-2.5 text-[9px] font-black text-white shadow-sm transition hover:bg-violet-500">Atribuir mais antigos</button>}</div></div>';
  s = s.replace(oldHeader, newHeader);

  // No seletor, só aparecem motoboys aptos a receber pedido, já ordenados pela fila.
  const oldDriverOptions = '{queueDrivers.length > 0 && <optgroup label="Fila de despacho">{queueDrivers.map((m, index) => <option key={m.id} value={m.id}>{index + 1}º DA FILA — {m.name}</option>)}</optgroup>}{motoboys.some((m) => m.status !== \'offline\' && !queueDrivers.some((q) => q.id === m.id)) && <optgroup label="Outros entregadores">{motoboys.filter((m) => m.status !== \'offline\' && !queueDrivers.some((q) => q.id === m.id)).map((m) => <option key={m.id} value={m.id}>{m.name} — {driverLabel(m)}</option>)}</optgroup>}';
  const newDriverOptions = '{queueDrivers.length > 0 ? <optgroup label="Fila de despacho">{queueDrivers.map((m, index) => <option key={m.id} value={m.id}>{index + 1}º DA FILA — {m.name}</option>)}</optgroup> : <option value="" disabled>Nenhum motoboy disponível na fila</option>}';
  s = s.replace(oldDriverOptions, newDriverOptions);

  return s;
});

// O histórico de pedidos entregues é secundário na operação. Mantém ele abaixo
// da central principal e com um respiro maior, priorizando as colunas ativas.
patch('src/components/StoreDashboardLegacy.tsx', (input) => {
  let s = input;

  s = s.replace(
    "      {activeTab === 'operacao' && (\n        <DeliveredOrdersDashboard orders={orders} />\n      )}",
    "      {activeTab === 'operacao' && (\n        <div className=\"mt-12 pb-6\">\n          <DeliveredOrdersDashboard orders={orders} />\n        </div>\n      )}"
  );

  return s;
});
