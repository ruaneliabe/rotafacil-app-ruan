import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after === before) {
    console.log(`[handoff-flow] ${path}: already patched or no-op`);
    return;
  }
  fs.writeFileSync(path, after);
  console.log(`[handoff-flow] ${path}: updated`);
};

// Atribuir um pedido pronto a um motoboy nunca pode rebaixar o status para "preparing".
// Também retiramos o motoboy da fila no mesmo instante da chamada, sem esperar a retirada.
patch('src/App.tsx', (input) => {
  let s = input;

  s = s.replace(
    "      assignedMotoboyName: targetMotoboy.name,\n      status: 'preparing',\n      routeSequence: (targetMotoboy.activeOrdersCount || 0) + 1,",
    "      assignedMotoboyName: targetMotoboy.name,\n      status: targetOrder.status === 'ready_at_counter' ? 'ready_at_counter' : 'preparing',\n      routeSequence: (targetMotoboy.activeOrdersCount || 0) + 1,"
  );

  s = s.replace(
    "          assignedMotoboyName: targetMotoboy.name,\n          status: 'preparing',\n          routeSequence: (targetMotoboy.activeOrdersCount || 0) + idx + 1,",
    "          assignedMotoboyName: targetMotoboy.name,\n          status: order.status === 'ready_at_counter' ? 'ready_at_counter' : 'preparing',\n          routeSequence: (targetMotoboy.activeOrdersCount || 0) + idx + 1,"
  );

  s = s.replace(
    "    const updatedMotoboy: Motoboy = {\n      ...targetMotoboy,\n      activeOrdersCount: (targetMotoboy.activeOrdersCount || 0) + 1,\n    };",
    "    const updatedMotoboy: Motoboy = {\n      ...targetMotoboy,\n      activeOrdersCount: (targetMotoboy.activeOrdersCount || 0) + 1,\n      joinedQueueAt: undefined,\n      callingToCounterAt: Date.now(),\n    };"
  );

  s = s.replace(
    "    const updatedMotoboy: Motoboy = {\n      ...targetMotoboy,\n      activeOrdersCount: (targetMotoboy.activeOrdersCount || 0) + orderIds.length,\n    };",
    "    const updatedMotoboy: Motoboy = {\n      ...targetMotoboy,\n      activeOrdersCount: (targetMotoboy.activeOrdersCount || 0) + orderIds.length,\n      joinedQueueAt: undefined,\n      callingToCounterAt: Date.now(),\n    };"
  );

  s = s.replace(
    "showToast(`${orderIds.length} pedidos vinculados a ${targetMotoboy.name}! 🍳 Em preparo`);",
    "showToast(`${orderIds.length} pedido${orderIds.length === 1 ? '' : 's'} enviado${orderIds.length === 1 ? '' : 's'} para ${targetMotoboy.name}.`);"
  );

  return s;
});

// A rota chamada continua em "Próximo a sair" até o motoboy confirmar a retirada.
// Ela fica bloqueada para nova chamada; enquanto isso a próxima rota pronta pode chamar
// o novo 1º da fila normalmente.
patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  s = s.replace(
    "  createdAt: number;\n};",
    "  createdAt: number;\n  calledMotoboyId?: string;\n  calledMotoboyName?: string;\n  calledAt?: number;\n};"
  );

  s = s.replace(
    "  const readyPrepared = prepared.filter((route) => route.orders.length > 0 && route.orders.every(isReady));\n  const nextRoute = readyPrepared[0];",
    "  const readyPrepared = prepared.filter((route) => route.orders.length > 0 && route.orders.every(isReady));\n  const waitingPickupRoutes = readyPrepared.filter((route) => Boolean(route.calledMotoboyId));\n  const nextRoute = readyPrepared.find((route) => !route.calledMotoboyId);"
  );

  if (!s.includes('Remove a rota preparada somente após a retirada')) {
    s = s.replace(
      "  useEffect(() => {\n    const valid = new Set(looseOrders.map((order) => order.id));",
      "  // Remove a rota preparada somente após a retirada confirmar a passagem para a rota do motoboy.\n  useEffect(() => {\n    setPreparedRoutes((current) => current.filter((route) => {\n      if (!route.calledMotoboyId) return true;\n      const routeOrders = route.orderIds.map((id) => activeById.get(id)).filter(Boolean) as Order[];\n      return !(routeOrders.length > 0 && routeOrders.every(isRoute));\n    }));\n  }, [activeOrders]);\n\n  useEffect(() => {\n    const valid = new Set(looseOrders.map((order) => order.id));"
    );
  }

  s = s.replace(
    "{prepared.filter((route) => route.id !== nextRoute?.id).map((route, index) => {",
    "{prepared.filter((route) => route.id !== nextRoute?.id && !route.calledMotoboyId).map((route, index) => {"
  );

  s = s.replace(
    "onAssignRouteToDriver(nextRoute.orderIds, nextDriver.id); setPreparedRoutes((current) => current.filter((route) => route.id !== nextRoute.id)); onCallNextDriver?.(nextDriver.id, nextDriver.name);",
    "onAssignRouteToDriver(nextRoute.orderIds, nextDriver.id); setPreparedRoutes((current) => current.map((route) => route.id === nextRoute.id ? { ...route, calledMotoboyId: nextDriver.id, calledMotoboyName: nextDriver.name, calledAt: Date.now() } : route)); onCallNextDriver?.(nextDriver.id, nextDriver.name);"
  );

  const nextRouteAnchor = "            {nextRoute ? <div className=\"mt-3 rounded-xl border border-violet-200 bg-violet-50/35 p-3\">";
  if (!s.includes('AGUARDANDO RETIRADA') && s.includes(nextRouteAnchor)) {
    const waitingBlock = "            {waitingPickupRoutes.map((route) => <div key={route.id} className=\"mt-3 rounded-xl border border-amber-300 bg-amber-50/45 p-3\"><div className=\"text-[10px] font-black text-amber-700\">AGUARDANDO RETIRADA</div><div className=\"mt-1 text-sm font-black text-slate-950\">{route.corridorName}</div><div className=\"mt-2 space-y-1\">{route.orders.map((order) => <div key={order.id} className=\"flex items-center gap-2 text-[9px]\"><CheckCircle2 className=\"h-3 w-3 text-emerald-500\" /><b>{code(order)}</b><span className=\"truncate text-slate-500\">{order.clientName}</span></div>)}</div><div className=\"mt-3 rounded-lg bg-white px-2.5 py-2 text-[9px] font-bold text-amber-800\">{route.calledMotoboyName || 'Motoboy'} já foi chamado · aguardando confirmar retirada</div><button type=\"button\" disabled className=\"mt-3 h-9 w-full rounded-lg bg-slate-200 text-[10px] font-black text-slate-500\">Motoboy já chamado</button></div>)}\n";
    s = s.replace(nextRouteAnchor, waitingBlock + nextRouteAnchor);
  }

  return s;
});

// Qualquer chamada pelo fluxo legado também tira o motoboy da fila imediatamente.
patch('src/components/StoreDashboardLegacy.tsx', (input) => {
  let s = input;
  s = s.replaceAll(
    "saveMotoboyToCloud({ ...nextMotoboy, callingToCounterAt: Date.now() });",
    "saveMotoboyToCloud({ ...nextMotoboy, joinedQueueAt: undefined, callingToCounterAt: Date.now() });"
  );
  return s;
});

// Na central, só está na fila quem ainda possui posição de fila e não foi chamado.
patch('src/components/OperationDispatchView.tsx', (input) => {
  let s = input;
  s = s.replace(
    ".filter((m) => m.status === 'available' && load(m.id) === 0)",
    ".filter((m) => m.status === 'available' && Boolean(m.joinedQueueAt) && !m.callingToCounterAt && load(m.id) === 0)"
  );
  return s;
});

// No app do motoboy, a fila visual também ignora quem já foi chamado.
patch('src/components/MotoboyApp.tsx', (input) => {
  let s = input;
  s = s.replace(
    ".filter((motoboy) => motoboy.status === 'available')",
    ".filter((motoboy) => motoboy.status === 'available' && Boolean(motoboy.joinedQueueAt) && !motoboy.callingToCounterAt && !orders.some((order) => order.assignedMotoboyId === motoboy.id && !isFinalized(order)))"
  );
  s = s.replace(
    "    [motoboys]\n  );",
    "    [motoboys, orders]\n  );"
  );
  return s;
});
