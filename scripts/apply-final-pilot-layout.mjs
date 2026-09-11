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

// Deixa o controle da operação em um lugar estável: no cabeçalho, ao lado do status do Cardápio Web.
patch('src/components/StoreDashboardLegacy.tsx', (input) => {
  let s = input;

  if (!s.includes('data-header-operation-toggle="true"')) {
    const marker = `          </span>\n\n          <button\n            type="button"\n            onClick={() => handleSyncCardapioWeb(true)}`;
    if (s.includes(marker)) {
      s = s.replace(marker, `          </span>\n\n          <button\n            data-header-operation-toggle="true"\n            type="button"\n            onClick={onToggleShift}\n            className={shift.isOpen\n              ? 'inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 text-[12px] font-black text-emerald-700 transition-all cursor-pointer hover:bg-emerald-100'\n              : 'inline-flex h-10 items-center gap-2 rounded-lg border border-violet-500 bg-violet-600 px-3.5 text-[12px] font-black text-white transition-all cursor-pointer hover:bg-violet-500'}\n            title={shift.isOpen ? 'Encerrar operação atual' : 'Abrir operação manualmente'}\n          >\n            <span className={shift.isOpen ? 'h-2 w-2 rounded-full bg-emerald-500' : 'h-2 w-2 rounded-full bg-white/80'} />\n            {shift.isOpen ? 'Encerrar turno' : 'Abrir turno'}\n          </button>\n\n          <button\n            type="button"\n            onClick={() => handleSyncCardapioWeb(true)}`);
    }
  }

  // Se algum card antigo de operação reaparecer na sidebar, esconde o card inteiro.
  // Importante: usar classe estática aqui evita gerar JSX inválido ao envolver um template literal existente.
  s = s.replace(/<div data-sidebar-operation-card="true" className=\{`[^`]*`\}>/, '<div data-sidebar-operation-card="true" className="hidden">');

  return s;
});

// Foco da tela principal: pedidos soltos -> rotas montadas -> próximo a sair.
// "Em entrega" vira uma visão secundária expansível e deixa de ocupar uma coluna fixa.
patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  if (!s.includes('const [showInTransit, setShowInTransit]')) {
    s = s.replace(
      "  const [selectedLoose, setSelectedLoose] = useState<string[]>([]);",
      "  const [selectedLoose, setSelectedLoose] = useState<string[]>([]);\n  const [showInTransit, setShowInTransit] = useState(false);"
    );
  }

  s = s.replace(
    'xl:grid-cols-[1.05fr_1.25fr_1.05fr_.78fr]',
    'xl:grid-cols-[1.05fr_1.25fr_1fr]'
  );

  const deliveryTitle = '<h3 className="text-sm font-black text-slate-900">Em entrega</h3>';
  const deliveryTitleIndex = s.indexOf(deliveryTitle);
  if (deliveryTitleIndex >= 0) {
    const deliverySectionStart = s.lastIndexOf('<section', deliveryTitleIndex);
    const deliverySectionEndTag = s.indexOf('</section>', deliveryTitleIndex);
    if (deliverySectionStart >= 0 && deliverySectionEndTag >= 0) {
      const deliverySectionEnd = deliverySectionEndTag + '</section>'.length;
      s = s.slice(0, deliverySectionStart) + s.slice(deliverySectionEnd);
    }
  }

  if (!s.includes('data-in-transit-secondary="true"')) {
    const gridMarker = '      <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[1.05fr_1.25fr_1fr]">';
    const secondary = `      <div data-in-transit-secondary="true" className="flex flex-col gap-2">\n        <div className="flex justify-end">\n          <button\n            type="button"\n            onClick={() => setShowInTransit((value) => !value)}\n            className={\`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[11px] font-black transition \${showInTransit ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-700'}\`}\n          >\n            <Bike className="h-4 w-4" />\n            Em entrega ({routeOrders.length})\n          </button>\n        </div>\n        {showInTransit && (\n          <div className="rounded-2xl border border-sky-200 bg-white p-3 shadow-sm">\n            <div className="mb-3 flex items-center justify-between gap-2">\n              <div>\n                <h3 className="text-sm font-black text-slate-900">Entregas na rua</h3>\n                <p className="text-[10px] text-slate-400">Acompanhamento secundário das rotas já retiradas</p>\n              </div>\n              <button type="button" onClick={() => setShowInTransit(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>\n            </div>\n            {routeOrders.length ? (\n              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">\n                {routeOrders.map((order) => (\n                  <article key={order.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">\n                    <div className="flex items-start justify-between gap-2">\n                      <div><b className="text-xs text-slate-900">{code(order)}</b><p className="mt-1 text-[10px] font-semibold text-slate-600">{order.clientName}</p></div>\n                      <span className="rounded-full bg-sky-50 px-2 py-1 text-[8px] font-black text-sky-700">Em rota</span>\n                    </div>\n                    <p className="mt-2 flex gap-1.5 text-[9px] text-slate-500"><MapPin className="h-3 w-3" />{order.neighborhood || order.address}</p>\n                  </article>\n                ))}\n              </div>\n            ) : (\n              <div className="py-8 text-center text-xs font-bold text-slate-500">Nenhuma entrega na rua agora.</div>\n            )}\n          </div>\n        )}\n      </div>\n\n`;
    if (s.includes(gridMarker)) s = s.replace(gridMarker, secondary + gridMarker);
  }

  // A terceira coluna passa a ser o Próximo a sair e ganha espaço de verdade.
  s = s.replace('<aside className="space-y-3">', '<aside className="min-w-0 space-y-3">');

  return s;
});
