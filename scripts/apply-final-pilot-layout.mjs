import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after === before) {
    console.log(`[final-pilot-layout] ${path}: already patched or no-op`);
    return;
  }
  fs.writeFileSync(path, after);
  console.log(`[final-pilot-layout] ${path}: updated`);
};

// Dashboard legado: só corrige duplicidade e fila. Nada de overlays/portais aqui.
patch('src/components/StoreDashboardLegacy.tsx', (input) => {
  let s = input;
  s = s.replace(/<div data-sidebar-operation-card="true" className=\{`[^`]*`\}>/, '<div data-sidebar-operation-card="true" className="hidden">');
  s = s.replace(
    ".filter((m) => m.status === 'available')",
    ".filter((m) => m.status === 'available' && (!m.callingToCounterAt || Number(m.callingToCounterAt) < Number(m.joinedQueueAt || 0)))"
  );
  return s;
});

// App do motoboy: chamado ao balcão deixa a fila imediatamente.
patch('src/components/MotoboyApp.tsx', (input) => {
  let s = input;
  s = s.replace(
    ".filter((motoboy) => motoboy.status === 'available')",
    ".filter((motoboy) => motoboy.status === 'available' && (!motoboy.callingToCounterAt || Number(motoboy.callingToCounterAt) < Number(motoboy.joinedQueueAt || 0)))"
  );
  s = s.replace(
    "  const inQueue = driver?.status === 'available';",
    "  const inQueue = queuePosition > 0;"
  );
  return s;
});

// Gestão de entrega usa a mesma regra da fila.
patch('src/components/OperationDispatchView.tsx', (input) => {
  let s = input;
  s = s.replace(
    ".filter((m) => m.status === 'available' && load(m.id) === 0)",
    ".filter((m) => m.status === 'available' && load(m.id) === 0 && (!m.callingToCounterAt || Number(m.callingToCounterAt) < Number(m.joinedQueueAt || 0)))"
  );
  return s;
});

// Tela principal: Pedidos soltos -> Rotas montadas -> Próximo a sair.
// Em entrega vira visão secundária sem ocupar coluna fixa.
patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  if (!s.includes('const [showInTransit, setShowInTransit]')) {
    s = s.replace(
      "  const [selectedLoose, setSelectedLoose] = useState<string[]>([]);",
      "  const [selectedLoose, setSelectedLoose] = useState<string[]>([]);\n  const [showInTransit, setShowInTransit] = useState(false);"
    );
  }

  const deliveryTitle = '<h3 className="text-sm font-black text-slate-900">Em entrega</h3>';
  const deliveryTitleIndex = s.indexOf(deliveryTitle);
  if (deliveryTitleIndex >= 0) {
    const deliverySectionStart = s.lastIndexOf('<section', deliveryTitleIndex);
    const deliverySectionEndTag = s.indexOf('</section>', deliveryTitleIndex);
    if (deliverySectionStart >= 0 && deliverySectionEndTag >= 0) {
      s = s.slice(0, deliverySectionStart) + s.slice(deliverySectionEndTag + '</section>'.length);
    }
  }

  // Força três colunas com Próximo a sair largo e estável.
  s = s.replace(
    /<div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-\[[^"]+\]">/,
    '<div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-3" style={{ gridTemplateColumns: \'minmax(0,1fr) minmax(0,1fr) minmax(320px,.85fr)\' }}>'
  );

  if (!s.includes('data-in-transit-secondary="true"')) {
    const gridMarker = /      <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-3" style=\{\{ gridTemplateColumns: '[^']+' \}\}>/;
    const secondary = `      <div data-in-transit-secondary="true" className="flex items-center justify-end gap-2">\n        <button\n          type="button"\n          onClick={() => setShowInTransit((value) => !value)}\n          className={\`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[11px] font-black transition \${showInTransit ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-700'}\`}\n        >\n          <Bike className="h-4 w-4" />\n          Em entrega ({routeOrders.length})\n        </button>\n      </div>\n      {showInTransit && (\n        <div className="rounded-2xl border border-sky-200 bg-white p-3 shadow-sm">\n          <div className="mb-3 flex items-center justify-between gap-2">\n            <div><h3 className="text-sm font-black text-slate-900">Entregas na rua</h3><p className="text-[10px] text-slate-400">Acompanhamento das rotas já retiradas</p></div>\n            <button type="button" onClick={() => setShowInTransit(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>\n          </div>\n          {routeOrders.length ? (\n            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">\n              {routeOrders.map((order) => (\n                <article key={order.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">\n                  <div className="flex items-start justify-between gap-2"><div><b className="text-xs text-slate-900">{code(order)}</b><p className="mt-1 text-[10px] font-semibold text-slate-600">{order.clientName}</p></div><span className="rounded-full bg-sky-50 px-2 py-1 text-[8px] font-black text-sky-700">Em rota</span></div>\n                  <p className="mt-2 flex gap-1.5 text-[9px] text-slate-500"><MapPin className="h-3 w-3" />{order.neighborhood || order.address}</p>\n                </article>\n              ))}\n            </div>\n          ) : <div className="py-8 text-center text-xs font-bold text-slate-500">Nenhuma entrega na rua agora.</div>}\n        </div>\n      )}\n\n`;
    const match = s.match(gridMarker);
    if (match) s = s.replace(match[0], secondary + match[0]);
  }

  s = s.replace('<aside className="space-y-3">', '<aside className="min-w-0 space-y-3">');
  s = s.replace(/\n\s*<section className="rounded-2xl border border-violet-100 bg-violet-50\/45 p-3">[\s\S]*?<\/section>/, '');
  s = s.replace(
    "<section className={`rounded-2xl border bg-white shadow-sm ${nextRoute ? 'border-emerald-300 p-3' : 'border-slate-200 p-2.5'}`}>",
    "<section className={`min-h-[240px] rounded-2xl border bg-white shadow-sm ${nextRoute ? 'border-emerald-300 p-4' : 'border-slate-200 p-4'}`}>")
  ;
  s = s.replace(
    '<div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/35 p-3">',
    '<div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">'
  );
  s = s.replace(
    'className="mt-3 h-9 w-full rounded-lg bg-emerald-600 text-[10px] font-black text-white disabled:bg-slate-300"',
    'className="mt-4 h-11 w-full rounded-xl bg-emerald-600 px-3 text-[12px] font-black text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"'
  );

  return s;
});
