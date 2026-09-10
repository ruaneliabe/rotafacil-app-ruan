import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after === before) console.log(`[patch] ${path}: already patched or no-op`);
  else {
    fs.writeFileSync(path, after);
    console.log(`[patch] ${path}: updated`);
  }
};

patch('src/components/StoreDashboardLegacy.tsx', (input) => {
  let s = input;

  s = s.replace(
    "const [activeTab, setActiveTab] = useState<'kanban' | 'operacao' | 'mapa' | 'equipe' | 'gestao' | 'financeiro' | 'historico'>('operacao');",
    "const [activeTab, setActiveTab] = useState<'kanban' | 'operacao' | 'mapa' | 'equipe' | 'gestao' | 'financeiro' | 'historico'>(() => {\n    try {\n      const saved = sessionStorage.getItem('rota_facil_store_active_tab');\n      if (saved && ['kanban', 'operacao', 'mapa', 'equipe', 'gestao', 'financeiro', 'historico'].includes(saved)) return saved as any;\n    } catch {}\n    return 'operacao';\n  });"
  );

  const persistenceAnchor = "  const [showAllProximityGroups, setShowAllProximityGroups] = useState<boolean>(false);";
  if (!s.includes("sessionStorage.setItem('rota_facil_store_active_tab'")) {
    s = s.replace(
      persistenceAnchor,
      `${persistenceAnchor}\n\n  useEffect(() => {\n    try { sessionStorage.setItem('rota_facil_store_active_tab', activeTab); } catch {}\n  }, [activeTab]);`
    );
  }

  // Remove SOMENTE a faixa verde duplicada "Rota sugerida". O bloco "Rotas que combinam" fica.
  s = s.replace(/\n\s*\{\/\* Rota sugerida direta \*\/\}\n\s*\{brainAnalysis\.recommendations\[0\] && \(\n\s*<div className="bg-emerald-50[\s\S]*?\n\s*<\/div>\n\s*\)\}/, '');

  return s;
});

patch('src/components/DashboardUiBehaviorFixes.tsx', (input) => {
  let s = input;
  // O dashboard real agora persiste a própria aba. Não forçar Pedidos após F5.
  s = s.replace(/\n\s*\/\/ F5\/reload deve sempre voltar[\s\S]*?\n\s*}, 120\);\n/, '\n');
  s = s.replace(/\n\s*window\.clearTimeout\(initialTabTimer\);/, '');
  return s;
});

patch('src/components/OperationDispatchView.tsx', (input) => {
  let s = input;

  s = s.replace(
    "const stamp = (o: Order) => Number(o.createdTimestamp) || Date.now();",
    "const stamp = (o: Order) => Number((o as any).sourceCreatedTimestamp || o.createdTimestamp || o.createdAt) || Number.MAX_SAFE_INTEGER;"
  );

  s = s.replace(
    "waiting: filtered.filter((o) => stage(o) === 'waiting').sort((a, b) => stamp(a) - stamp(b)),",
    `waiting: filtered.filter((o) => stage(o) === 'waiting').sort((a, b) => {\n      const sameCardapioSequence = a.originChannel === 'cardapio_web' && b.originChannel === 'cardapio_web' &&\n        (a.storeBranch || a.storeName || '') === (b.storeBranch || b.storeName || '') &&\n        Number.isFinite(Number(a.codeNumber)) && Number.isFinite(Number(b.codeNumber));\n      if (sameCardapioSequence && Number(a.codeNumber) !== Number(b.codeNumber)) {\n        return Number(a.codeNumber) - Number(b.codeNumber);\n      }\n      return stamp(a) - stamp(b) || Number(a.codeNumber || 0) - Number(b.codeNumber || 0);\n    }),`
  );

  return s;
});

patch('src/components/MotoboyApp.tsx', (input) => {
  let s = input;

  const readyAnchor = "  const ready = assigned.filter((order) => order.status === 'ready_at_counter');\n  const rawRoute = assigned.filter(routeStatus);";
  if (!s.includes('const counterLoad = assigned.filter')) {
    s = s.replace(
      readyAnchor,
      `  const ready = assigned.filter((order) => order.status === 'ready_at_counter');\n  const counterLoad = assigned.filter((order) => ['pending', 'preparing', 'ready_at_counter'].includes(order.status));\n  const allCounterLoadReady = counterLoad.length > 0 && counterLoad.every((order) => order.status === 'ready_at_counter');\n  const rawRoute = assigned.filter(routeStatus);`
    );
  }

  const enterQueueAnchor = `  const enterQueue = () => {\n    if (driver) {\n      onConfirmArrivalAtStore?.(driver.id);\n      onUpdateMotoboyStatus?.(driver.id, 'available');\n    }\n    setTab('orders');\n  };`;
  if (!s.includes('const leaveQueue = () =>')) {
    s = s.replace(
      enterQueueAnchor,
      `${enterQueueAnchor}\n\n  const leaveQueue = () => {\n    if (!driver || counterLoad.length > 0 || route.length > 0) return;\n    onUpdateMotoboyStatus?.(driver.id, 'paused');\n    setTab('orders');\n  };`
    );
  }

  s = s.replace(
    '  const orderCount = preparing.length + ready.length + unassignedPending.length;',
    '  const orderCount = counterLoad.length;'
  );

  const start = s.indexOf('            {inQueue && (');
  const endMarker = "\n          </>\n        )}\n\n        {tab === 'route' && (";
  const end = s.indexOf(endMarker, start);

  if (start !== -1 && end !== -1) {
    const replacement = `            {inQueue && counterLoad.length === 0 && (\n              <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">\n                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-50">\n                  <Clock3 className="h-8 w-8 text-slate-500" />\n                </div>\n                <h2 className="mt-4 text-xl font-black tracking-tight">Aguardando</h2>\n                <p className="mt-2 text-[13px] font-semibold text-slate-500">\n                  {queuePosition > 0 ? (queuePosition === 1 ? 'Você é o próximo da fila.' : queuePosition + 'º na fila · ' + queueAhead + ' ' + (queueAhead === 1 ? 'motoboy na frente' : 'motoboys na frente')) : 'Aguardando posição na fila.'}\n                </p>\n                <p className="mx-auto mt-2 max-w-[280px] text-[11px] leading-relaxed text-slate-400">Assim que a loja reservar um pedido para você, esta tela muda automaticamente para Preparando.</p>\n                <button onClick={leaveQueue} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-[13px] font-black text-slate-700 active:bg-slate-50">\n                  Sair da fila\n                </button>\n              </section>\n            )}\n\n            {!inQueue && !returning && driver.status === 'paused' && route.length === 0 && (\n              <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">\n                <UsersRound className="mx-auto h-9 w-9 text-slate-400" />\n                <h2 className="mt-4 text-xl font-black">Fora da fila</h2>\n                <p className="mt-2 text-[12px] text-slate-500">Você não receberá novos pedidos enquanto estiver fora da fila.</p>\n                <button onClick={enterQueue} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-violet-600 text-[13px] font-black text-white">Entrar na fila</button>\n              </section>\n            )}\n\n            {inQueue && counterLoad.length > 0 && !allCounterLoadReady && (\n              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">\n                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">\n                  <div className="flex items-center gap-3">\n                    <Package className="h-5 w-5 text-[#081A2F]" />\n                    <div>\n                      <h2 className="text-[17px] font-black">Preparando</h2>\n                      <p className="text-[11px] text-slate-500">{ready.length}/{counterLoad.length} pedidos prontos</p>\n                    </div>\n                  </div>\n                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-black text-amber-700">AGUARDE A CARGA</span>\n                </div>\n                <div className="space-y-2 p-3">\n                  {counterLoad.map((order) => {\n                    const isReady = order.status === 'ready_at_counter';\n                    return (\n                      <article key={order.id} className={'rounded-xl border p-3.5 ' + (isReady ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-[#FFF9E8]')}>\n                        <div className="flex items-center justify-between gap-3">\n                          <strong className="min-w-0 truncate text-[13px]">#{order.codeNumber} • {order.clientName}</strong>\n                          <span className={'shrink-0 rounded-full bg-white px-2 py-1 text-[9px] font-black ' + (isReady ? 'text-emerald-700' : 'text-amber-700')}>{isReady ? 'PRONTO' : 'EM PREPARO'}</span>\n                        </div>\n                        <p className="mt-1 text-[11px] text-slate-500">{order.neighborhood || order.address}</p>\n                        <p className={'mt-3 flex items-center gap-1 text-[10px] font-bold ' + (isReady ? 'text-emerald-700' : 'text-amber-700')}>\n                          {isReady ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}\n                          {isReady ? 'Pronto · aguardando os demais' : 'Aguardando a loja marcar como pronto'}\n                        </p>\n                      </article>\n                    );\n                  })}\n                </div>\n                <div className="mx-3 mb-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-3 text-[10px] leading-relaxed text-slate-500">\n                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />\n                  <span>A retirada só será liberada quando <b>todos os pedidos da sua carga</b> estiverem prontos.</span>\n                </div>\n              </section>\n            )}\n\n            {inQueue && allCounterLoadReady && (\n              <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">\n                <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50/50 px-4 py-4">\n                  <ShoppingBag className="h-5 w-5 text-emerald-700" />\n                  <div>\n                    <h2 className="text-[17px] font-black">Prontos para retirada ({counterLoad.length})</h2>\n                    <p className="text-[11px] text-slate-500">Toda a sua carga está pronta</p>\n                  </div>\n                </div>\n                <div className="space-y-2 p-3">\n                  {counterLoad.map((order) => (\n                    <article key={order.id} className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">\n                      <div className="flex items-center justify-between gap-3">\n                        <strong className="text-[13px]">#{order.codeNumber} • {order.clientName}</strong>\n                        <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-emerald-700">PRONTO</span>\n                      </div>\n                      <p className="mt-1 text-[11px] text-slate-500">{order.address}</p>\n                    </article>\n                  ))}\n                  <button onClick={pickupAll} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3.5 text-[13px] font-black text-white shadow-sm active:bg-violet-700">\n                    <CheckCircle2 className="h-4 w-4" /> Confirmar retirada dos {counterLoad.length} pedidos\n                  </button>\n                </div>\n              </section>\n            )}`;

    s = s.slice(0, start) + replacement + s.slice(end);
  }

  // Ao iniciar, abre o Google Maps com TODOS os destinos na ordem definida como paradas.
  s = s.replace(
    `  const startRoute = () => {\n    if (!route.length) return;\n    route.forEach((order, index) =>\n      onUpdateOrderStatus(order.id, index === 0 ? 'in_transit' : 'picked_up')\n    );\n    if (driver) onUpdateMotoboyStatus?.(driver.id, 'delivering');\n  };`,
    `  const startRoute = () => {\n    if (!route.length) return;\n    route.forEach((order, index) =>\n      onUpdateOrderStatus(order.id, index === 0 ? 'in_transit' : 'picked_up')\n    );\n    if (driver) onUpdateMotoboyStatus?.(driver.id, 'delivering');\n\n    const destination = encodeURIComponent(addressForNav(route[route.length - 1]));\n    const waypoints = route.slice(0, -1).map(addressForNav).join('|');\n    const origin = gps ? '&origin=' + encodeURIComponent(gps.lat + ',' + gps.lng) : '';\n    const url = 'https://www.google.com/maps/dir/?api=1' + origin + '&destination=' + destination + (waypoints ? '&waypoints=' + encodeURIComponent(waypoints) : '') + '&travelmode=driving';\n    window.location.href = url;\n  };`
  );

  // Ao concluir a última entrega, volta automaticamente para Pedidos.
  s = s.replace(
    `  const finish = (order: Order) => {\n    onUpdateOrderStatus(order.id, 'delivered');\n    setArrived((prev) => {\n      const next = { ...prev };\n      delete next[order.id];\n      return next;\n    });\n  };`,
    `  const finish = (order: Order) => {\n    const isLastStop = route.length === 1 && route[0]?.id === order.id;\n    onUpdateOrderStatus(order.id, 'delivered');\n    setArrived((prev) => {\n      const next = { ...prev };\n      delete next[order.id];\n      return next;\n    });\n    if (isLastStop) {\n      setShowMap(false);\n      setNavRequest(null);\n      setTab('orders');\n    }\n  };`
  );

  // Impede que os textos dos botões de ação quebrem ou sejam cortados no celular.
  s = s.replace(
    `className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-emerald-600 px-3 text-[11px] font-black text-white">Concluir entrega</button>`,
    `className="inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-emerald-600 px-2 text-[10px] font-black leading-none text-white">Concluir entrega</button>`
  );
  s = s.replace(
    `className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 px-3 text-[11px] font-black text-violet-700">Próxima parada</button>`,
    `className="inline-flex min-h-11 min-w-[126px] flex-1 items-center justify-center whitespace-nowrap rounded-lg border border-violet-200 bg-violet-50 px-2 text-[10px] font-black leading-none text-violet-700">Próxima parada</button>`
  );

  return s;
});

console.log('[patch] runtime source fixes complete');
