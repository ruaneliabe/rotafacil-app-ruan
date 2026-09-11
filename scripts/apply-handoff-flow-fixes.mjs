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
// O fluxo correto é: rota montada -> pronta -> chamada -> retirada -> rota.
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
    "showToast(`${orderIds.length} pedidos vinculados a ${targetMotoboy.name}! 🍳 Em preparo`);",
    "showToast(`${orderIds.length} pedido${orderIds.length === 1 ? '' : 's'} enviado${orderIds.length === 1 ? '' : 's'} para ${targetMotoboy.name}.`);"
  );

  return s;
});

// Depois da chamada, a rota deixa de ser uma rota pendurada/pronta e passa a pertencer
// ao motoboy. Removemos a rota preparada imediatamente para ela não voltar à coluna.
patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  s = s.replace(
    "onAssignRouteToDriver(nextRoute.orderIds, nextDriver.id); onCallNextDriver?.(nextDriver.id, nextDriver.name);",
    "onAssignRouteToDriver(nextRoute.orderIds, nextDriver.id); setPreparedRoutes((current) => current.filter((route) => route.id !== nextRoute.id)); onCallNextDriver?.(nextDriver.id, nextDriver.name);"
  );

  return s;
});
