import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log('[ownership-lock] ' + path + ': updated');
  } else {
    console.log('[ownership-lock] ' + path + ': no-op');
  }
  return after;
};

const panel = patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  // Uma rota de pré-despacho só existe enquanto TODOS os pedidos ainda não têm dono.
  s = s.replace(
    `.filter((route) => route.orders.length > 0), [preparedRoutes, activeById]);`,
    `.filter((route) => route.orders.length > 0 && route.orders.every((order) => !order.assignedMotoboyId)), [preparedRoutes, activeById]);`
  );

  // Próximo a sair nunca pode reaproveitar uma carga já atribuída.
  s = s.replace(
    `const readyPrepared = prepared.filter((route) => route.orders.length > 0 && route.orders.every(isReady));`,
    `const readyPrepared = prepared.filter((route) => route.orders.length > 0 && route.orders.every((order) => isReady(order) && !order.assignedMotoboyId));`
  );

  // Ao chamar, remove a rota LOCALMENTE antes de qualquer write assíncrono.
  // Isso impede o próximo motoboy de enxergar/clicar na mesma rota durante o atraso do Firestore.
  s = s.replace(
    `onAssignRouteToDriver(nextRoute.orderIds, nextDriver.id); onCallNextDriver?.(nextDriver.id, nextDriver.name);`,
    `setPreparedRoutes((current) => current.filter((route) => route.id !== nextRoute.id)); onAssignRouteToDriver(nextRoute.orderIds, nextDriver.id); onCallNextDriver?.(nextDriver.id, nextDriver.name);`
  );
  s = s.replace(
    `onAssignRouteToDriver(nextRoute.orderIds, nextDriver.id); setPreparedRoutes((current) => current.filter((route) => route.id !== nextRoute.id)); onCallNextDriver?.(nextDriver.id, nextDriver.name);`,
    `setPreparedRoutes((current) => current.filter((route) => route.id !== nextRoute.id)); onAssignRouteToDriver(nextRoute.orderIds, nextDriver.id); onCallNextDriver?.(nextDriver.id, nextDriver.name);`
  );

  return s;
});

const app = patch('src/App.tsx', (input) => {
  let s = input;

  // Lock síncrono em memória: protege contra dois cliques/duas atribuições antes do realtime atualizar `orders`.
  if (!s.includes('pendingOrderAssignmentOwners')) {
    const importEnd = s.indexOf('\n\n');
    if (importEnd >= 0) {
      s = s.slice(0, importEnd + 2) + `const pendingOrderAssignmentOwners = new Map<string, string>();\n\n` + s.slice(importEnd + 2);
    }
  }

  s = s.replace(
`    if (!targetOrder || !targetMotoboy) return;
    if (targetOrder.assignedMotoboyId && targetOrder.assignedMotoboyId !== motoboyId && !['delivered', 'cancelled'].includes(targetOrder.status)) {`,
`    if (!targetOrder || !targetMotoboy) return;
    const effectiveOwner = targetOrder.assignedMotoboyId || pendingOrderAssignmentOwners.get(orderId);
    if (effectiveOwner && effectiveOwner !== motoboyId && !['delivered', 'cancelled'].includes(targetOrder.status)) {`
  );

  s = s.replace(
`      return;
    }

    const updatedOrder: Order = {`,
`      return;
    }
    pendingOrderAssignmentOwners.set(orderId, motoboyId);

    const updatedOrder: Order = {`
  );

  s = s.replace(
`    const safeOrderIds = orderIds.filter((id) => {
      const order = orders.find((o) => o.id === id);
      if (!order) return false;
      return !order.assignedMotoboyId || order.assignedMotoboyId === motoboyId || ['delivered', 'cancelled'].includes(order.status);
    });`,
`    const safeOrderIds = orderIds.filter((id) => {
      const order = orders.find((o) => o.id === id);
      if (!order) return false;
      const effectiveOwner = order.assignedMotoboyId || pendingOrderAssignmentOwners.get(id);
      return !effectiveOwner || effectiveOwner === motoboyId || ['delivered', 'cancelled'].includes(order.status);
    });`
  );

  s = s.replace(
`    safeOrderIds.forEach((id, idx) => {
      const order = orders.find((o) => o.id === id);`,
`    safeOrderIds.forEach((id, idx) => {
      pendingOrderAssignmentOwners.set(id, motoboyId);
      const order = orders.find((o) => o.id === id);`
  );

  // Ao finalizar/cancelar, libera o lock daquele pedido.
  s = s.replace(
`    if (newStatus === 'delivered' || newStatus === 'cancelled') {
      const driverId = target.assignedMotoboyId;`,
`    if (newStatus === 'delivered' || newStatus === 'cancelled') {
      pendingOrderAssignmentOwners.delete(orderId);
      const driverId = target.assignedMotoboyId;`
  );

  return s;
});

if (!panel.includes('route.orders.every((order) => !order.assignedMotoboyId)')) {
  throw new Error('[ownership-lock] rota atribuída ainda pode permanecer no pré-despacho');
}
if (!app.includes('pendingOrderAssignmentOwners')) {
  throw new Error('[ownership-lock] lock síncrono de atribuição não foi aplicado');
}

console.log('[ownership-lock] cada pedido pertence a um único motoboy; rota some ao chamar');
