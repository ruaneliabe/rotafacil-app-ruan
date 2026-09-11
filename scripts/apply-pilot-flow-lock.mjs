import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[pilot-flow-lock] ${path}: updated`);
  } else {
    console.log(`[pilot-flow-lock] ${path}: no-op`);
  }
  return after;
};

// 1) Dashboard de despacho: depois de chamar o motoboy, a carga deixa de ser
// "pedido solto/rota montada" e passa para acompanhamento de retirada/entrega.
const panel = patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  // Pedido já vinculado a motoboy NUNCA pode voltar para Pedidos soltos.
  s = s.replace(
    ".filter((order) => !preparedIds.has(order.id) && !isRoute(order) && !['delivered', 'cancelled'].includes(order.status))",
    ".filter((order) => !order.assignedMotoboyId && !preparedIds.has(order.id) && !isRoute(order) && !['delivered', 'cancelled'].includes(order.status))"
  );

  // Em entrega também acompanha a carga que já foi chamada e ainda aguarda retirada.
  s = s.replace(
    "const routeOrders = useMemo(() => activeOrders.filter(isRoute).sort((a, b) => stamp(a) - stamp(b)), [activeOrders]);",
    "const routeOrders = useMemo(() => activeOrders.filter((order) => isRoute(order) || (Boolean(order.assignedMotoboyId) && order.status === 'ready_at_counter')).sort((a, b) => stamp(a) - stamp(b)), [activeOrders]);"
  );

  // A partir do clique em chamar, a rota sai imediatamente do quadro de pré-despacho.
  // Os pedidos continuam no Firestore vinculados ao motoboy e prontos para retirada.
  s = s.replace(
    /onAssignRouteToDriver\(nextRoute\.orderIds, nextDriver\.id\);\s*setPreparedRoutes\(\(current\) => current\.map\(\(route\) => route\.id === nextRoute\.id \? \{ \.\.\.route, calledMotoboyId: nextDriver\.id, calledMotoboyName: nextDriver\.name, calledAt: Date\.now\(\) \} : route\)\);\s*onCallNextDriver\?\.\(nextDriver\.id, nextDriver\.name\);/g,
    "onAssignRouteToDriver(nextRoute.orderIds, nextDriver.id); setPreparedRoutes((current) => current.filter((route) => route.id !== nextRoute.id)); onCallNextDriver?.(nextDriver.id, nextDriver.name);"
  );

  // Compatibilidade caso a versão anterior ainda remova a rota antes da chamada.
  s = s.replace(
    /onAssignRouteToDriver\(nextRoute\.orderIds, nextDriver\.id\);\s*setPreparedRoutes\(\(current\) => current\.filter\(\(route\) => route\.id !== nextRoute\.id\)\);\s*onCallNextDriver\?\.\(nextDriver\.id, nextDriver\.name\);/g,
    "onAssignRouteToDriver(nextRoute.orderIds, nextDriver.id); setPreparedRoutes((current) => current.filter((route) => route.id !== nextRoute.id)); onCallNextDriver?.(nextDriver.id, nextDriver.name);"
  );

  // No acompanhamento, diferencia visualmente o pedido chamado que ainda não foi retirado.
  s = s.replace(
    '<span className="rounded-full bg-sky-50 px-2 py-1 text-[8px] font-black text-sky-700">Em rota</span>',
    '<span className="rounded-full bg-sky-50 px-2 py-1 text-[8px] font-black text-sky-700">{order.status === \'ready_at_counter\' ? \'Aguardando retirada\' : \'Em rota\'}</span>'
  );

  return s;
});

// 2) App do motoboy: estados explícitos e mutuamente exclusivos.
const motoboyApp = patch('src/components/MotoboyApp.tsx', (input) => {
  let s = input;

  // Fila real: só quem tem joinedQueueAt e ainda não foi chamado.
  s = s.replace(
    /\.filter\(\(motoboy\) => motoboy\.status === 'available'[^\n]*\)/,
    ".filter((motoboy) => motoboy.status === 'available' && Boolean(motoboy.joinedQueueAt) && !motoboy.callingToCounterAt && !orders.some((order) => order.assignedMotoboyId === motoboy.id && !isFinalized(order)))"
  );
  s = s.replace(
    "  const inQueue = driver?.status === 'available';",
    "  const inQueue = queuePosition > 0;"
  );

  // O bloco normal de fila volta a existir apenas quando está de fato na fila.
  s = s.replace(
    /\{\(inQueue \|\| preparing\.length > 0 \|\| ready\.length > 0\) && \(/g,
    '{inQueue && ('
  );

  // Remove fallbacks experimentais antigos para não haver telas duplicadas/conflitantes.
  s = s.replace(/\s*\{!inQueue && !returning && driver\.status !== 'delivering' && preparing\.length === 0 && ready\.length === 0 && route\.length === 0 && \(\s*<section data-emergency-enter-queue="true"[\s\S]*?<\/section>\s*\)\}/g, '');
  s = s.replace(/\s*\{!inQueue && !returning && driver\.status !== 'delivering' && preparing\.length === 0 && ready\.length === 0 && route\.length === 0 && \(\s*<section data-motoboy-idle-recovery="true"[\s\S]*?<\/section>\s*\)\}/g, '');

  const anchor = `        {tab === 'orders' && (\n          <>`;
  if (!s.includes('data-pilot-flow-lock="idle"') && s.includes(anchor)) {
    const canonical = `        {tab === 'orders' && (\n          <>\n            {!inQueue && !returning && driver.status !== 'delivering' && preparing.length === 0 && ready.length === 0 && route.length === 0 && (\n              <section data-pilot-flow-lock="idle" className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">\n                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-violet-50"><UsersRound className="h-10 w-10 text-violet-600" /></div>\n                <h2 className="mt-5 text-xl font-black tracking-tight">Fora da fila</h2>\n                <p className="mx-auto mt-2 max-w-[290px] text-[13px] leading-relaxed text-slate-500">Entre na fila para ficar disponível para o próximo despacho.</p>\n                <button type="button" onClick={enterQueue} className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-[16px] font-black text-white shadow-lg active:scale-[.99]">Entrar na fila <ArrowRight className="h-5 w-5" /></button>\n              </section>\n            )}\n\n            {!inQueue && !returning && driver.status !== 'delivering' && (preparing.length > 0 || ready.length > 0) && (\n              <section data-pilot-flow-lock="handoff" className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">\n                <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-4">\n                  <h2 className="text-[17px] font-black text-emerald-950">Chamado para retirada</h2>\n                  <p className="mt-1 text-[11px] text-emerald-700">Confira os pedidos abaixo e confirme a retirada no balcão.</p>\n                </div>\n                {preparing.length > 0 && <div className="space-y-2 border-b border-slate-100 p-3">{preparing.map((order) => <article key={order.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3"><strong className="text-[13px]">#{order.codeNumber} • {order.clientName}</strong><p className="mt-1 text-[11px] text-slate-500">{order.address}</p><p className="mt-2 text-[10px] font-black text-amber-700">Ainda em preparo</p></article>)}</div>}\n                <div className="space-y-2 p-3">\n                  {ready.map((order) => <article key={order.id} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><strong className="text-[13px]">#{order.codeNumber} • {order.clientName}</strong><p className="mt-1 text-[11px] text-slate-500">{order.address}</p><p className="mt-2 text-[10px] font-black text-emerald-700">PRONTO PARA RETIRADA</p></article>)}\n                  {ready.length > 0 && <button type="button" onClick={pickupAll} className="mt-2 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-[15px] font-black text-white shadow-sm active:bg-emerald-700"><CheckCircle2 className="h-5 w-5" />Confirmar retirada dos {ready.length} pedido{ready.length === 1 ? '' : 's'}</button>}\n                </div>\n              </section>\n            )}`;
    s = s.replace(anchor, canonical);
  }

  return s;
});

// 3) Central/legado: motoboy chamado sai imediatamente da fila e o próximo assume.
const legacy = patch('src/components/StoreDashboardLegacy.tsx', (input) => {
  let s = input;
  s = s.replace(
    ".filter((m) => m.status === 'available')",
    ".filter((m) => m.status === 'available' && Boolean(m.joinedQueueAt) && !m.callingToCounterAt)"
  );
  return s;
});

// Validações de build: se qualquer regra crítica não entrou, falha ANTES do Vite publicar.
const mustContain = (source, value, label) => {
  if (!source.includes(value)) throw new Error(`[pilot-flow-lock] validação falhou: ${label}`);
};
mustContain(panel, '!order.assignedMotoboyId && !preparedIds.has(order.id)', 'pedido atribuído não volta para soltos');
mustContain(panel, "order.status === 'ready_at_counter'", 'chamado aparece no acompanhamento');
mustContain(motoboyApp, 'data-pilot-flow-lock="idle"', 'botão Entrar na fila');
mustContain(motoboyApp, 'data-pilot-flow-lock="handoff"', 'confirmação de retirada');
mustContain(legacy, "Boolean(m.joinedQueueAt) && !m.callingToCounterAt", 'fila avança após chamada');

console.log('[pilot-flow-lock] fluxo validado: fila -> chamada -> retirada -> rota -> entrega');
