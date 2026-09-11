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

// Central de despacho orientada à operação real da loja:
// pedidos soltos -> rotas montadas -> em entrega -> próximo a sair.
patch('src/components/OperationDispatchView.tsx', (input) => {
  let s = input;

  s = s.replace(
    "import { FleetBottleneckBanner } from './FleetBottleneckBanner';",
    "import { FleetBottleneckBanner } from './FleetBottleneckBanner';\nimport { PredispatchRoutesPanel } from './PredispatchRoutesPanel';"
  );

  s = s.replace('>Central de pedidos</h2>', '>Central de despacho</h2>');
  s = s.replace(
    'Pedidos, fila e entregadores em uma visão operacional rápida.',
    'Organize pedidos, monte cargas e libere motoboys no momento certo.'
  );

  // O painel antigo de gargalo era visualmente pesado; o novo quadro já resume o pico.
  s = s.replace(
    '      <FleetBottleneckBanner orders={activeOrders} motoboys={motoboys} shift={shift} onSelectOrders={(ids) => setSelected(ids)} />\n',
    ''
  );

  // Troca sugestões simples pelo quadro operacional completo de pré-despacho.
  s = s.replace(
    /\n\s*\{suggestions\.length > 0 && <section className="rounded-2xl border border-violet-200 bg-violet-50\/70 p-3\.5">[\s\S]*?<\/section>\}\n/,
    '\n      <PredispatchRoutesPanel suggestions={suggestions} activeOrders={activeOrders} queueDrivers={queueDrivers} onSelectOrders={(ids) => setSelected(ids)} onCallNextDriver={handleCallCounter} onMarkOrderReady={(orderId) => onUpdateOrderStatus(orderId, \'ready_at_counter\')} triggerActionToast={triggerActionToast} />\n'
  );

  // Remove a faixa isolada de atribuição e esconde o kanban antigo da central.
  s = s.replace(
    /\n\s*\{grouped\.waiting\.length > 0 && queueDrivers\.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">[\s\S]*?<\/div>\}\n/,
    '\n'
  );
  s = s.replace(
    'className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"',
    'className="hidden"'
  );

  // No seletor de lote aparecem apenas motoboys realmente aptos, na ordem da fila.
  const oldDriverOptions = '{queueDrivers.length > 0 && <optgroup label="Fila de despacho">{queueDrivers.map((m, index) => <option key={m.id} value={m.id}>{index + 1}º DA FILA — {m.name}</option>)}</optgroup>}{motoboys.some((m) => m.status !== \'offline\' && !queueDrivers.some((q) => q.id === m.id)) && <optgroup label="Outros entregadores">{motoboys.filter((m) => m.status !== \'offline\' && !queueDrivers.some((q) => q.id === m.id)).map((m) => <option key={m.id} value={m.id}>{m.name} — {driverLabel(m)}</option>)}</optgroup>}';
  const newDriverOptions = '{queueDrivers.length > 0 ? <optgroup label="Fila de despacho">{queueDrivers.map((m, index) => <option key={m.id} value={m.id}>{index + 1}º DA FILA — {m.name}</option>)}</optgroup> : <option value="" disabled>Nenhum motoboy disponível na fila</option>}';
  s = s.replace(oldDriverOptions, newDriverOptions);

  return s;
});

// Rotas montadas são uma decisão do despachante: ele pode liberar todos os pedidos
// de uma carga de uma vez. A primeira rota 100% pronta vai para "Próximo a sair".
patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  s = s.replace(
    '  onCallNextDriver?: (motoboyId: string, motoboyName: string) => void;\n  triggerActionToast: (message: string) => void;',
    '  onCallNextDriver?: (motoboyId: string, motoboyName: string) => void;\n  onMarkOrderReady?: (orderId: string) => void;\n  triggerActionToast: (message: string) => void;'
  );

  s = s.replace(
    '  onCallNextDriver,\n  triggerActionToast,',
    '  onCallNextDriver,\n  onMarkOrderReady,\n  triggerActionToast,'
  );

  // A rota que virou a próxima saída deixa de ocupar espaço na coluna de rotas montadas.
  s = s.replace(
    '{prepared.map((route, index) => {',
    '{prepared.filter((route) => route.id !== nextRoute?.id).map((route, index) => {'
  );

  // Em vez de esperar cada pedido ser marcado individualmente, o despachante libera a carga toda.
  const oldActions = '<div className="mt-3 flex gap-2"><button onClick={() => onSelectOrders(route.orderIds)} className="h-8 flex-1 rounded-lg border border-slate-200 bg-white text-[9px] font-black text-slate-700">Ver pedidos</button>{allReady && <button disabled={!nextDriver} onClick={() => { if (!nextDriver) return; onSelectOrders(route.orderIds); onCallNextDriver?.(nextDriver.id, nextDriver.name); triggerActionToast(`${nextDriver.name.split(\' \')[0]} chamado para a rota ${String(index + 1).padStart(2, \'0\')}.`); }} className="h-8 flex-1 rounded-lg bg-violet-600 px-2 text-[9px] font-black text-white disabled:bg-slate-300"><Play className="mr-1 inline h-3 w-3" />{nextDriver ? `Chamar ${nextDriver.name.split(\' \')[0]}` : \'Aguardando motoboy\'}</button>}</div>';
  const newActions = '<div className="mt-3 flex gap-2"><button onClick={() => onSelectOrders(route.orderIds)} className="h-8 flex-1 rounded-lg border border-slate-200 bg-white text-[9px] font-black text-slate-700">Ver pedidos</button>{!allReady && <button disabled={!onMarkOrderReady} onClick={() => { if (!onMarkOrderReady) return; route.orders.filter((order) => !isReady(order)).forEach((order) => onMarkOrderReady(order.id)); triggerActionToast(`${route.orders.length} pedido${route.orders.length === 1 ? \'\' : \'s\'} marcado${route.orders.length === 1 ? \'\' : \'s\'} como pronto${route.orders.length === 1 ? \'\' : \'s\'}. Rota liberada para a próxima saída.`); }} className="h-8 flex-1 rounded-lg bg-emerald-600 px-2 text-[9px] font-black text-white disabled:bg-slate-300"><CheckCircle2 className="mr-1 inline h-3 w-3" />Colocar todos como prontos</button>}</div>';
  s = s.replace(oldActions, newActions);

  return s;
});

patch('src/components/StoreDashboardLegacy.tsx', (input) => {
  let s = input;
  s = s.replace(
    "      {activeTab === 'operacao' && (\n        <DeliveredOrdersDashboard orders={orders} />\n      )}",
    "      {activeTab === 'operacao' && (\n        <div className=\"mt-12 pb-6\">\n          <DeliveredOrdersDashboard orders={orders} />\n        </div>\n      )}"
  );
  return s;
});
