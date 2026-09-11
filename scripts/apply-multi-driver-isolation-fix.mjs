import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log('[multi-driver] ' + path + ': updated');
  } else {
    console.log('[multi-driver] ' + path + ': no-op');
  }
};

patch('src/App.tsx', (input) => {
  let s = input;

  // Nunca permita que um despacho posterior roube um pedido que já pertence a outro motoboy.
  s = s.replace(
`  const handleAssignOrderToMotoboy = (orderId: string, motoboyId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const targetMotoboy = motoboys.find((m) => m.id === motoboyId);
    if (!targetOrder || !targetMotoboy) return;`,
`  const handleAssignOrderToMotoboy = (orderId: string, motoboyId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const targetMotoboy = motoboys.find((m) => m.id === motoboyId);
    if (!targetOrder || !targetMotoboy) return;
    if (targetOrder.assignedMotoboyId && targetOrder.assignedMotoboyId !== motoboyId && !['delivered', 'cancelled'].includes(targetOrder.status)) {
      showToast(\`Pedido #\${targetOrder.codeNumber} já está com outro motoboy e não foi movido.\`);
      return;
    }`
  );

  s = s.replace(
`  const handleAssignBatchToMotoboy = (orderIds: string[], motoboyId: string) => {
    const targetMotoboy = motoboys.find((m) => m.id === motoboyId);
    if (!targetMotoboy || orderIds.length === 0) return;

    orderIds.forEach((id, idx) => {
      const order = orders.find((o) => o.id === id);
      if (order) {
        saveOrderToCloud({`,
`  const handleAssignBatchToMotoboy = (orderIds: string[], motoboyId: string) => {
    const targetMotoboy = motoboys.find((m) => m.id === motoboyId);
    if (!targetMotoboy || orderIds.length === 0) return;

    const safeOrderIds = orderIds.filter((id) => {
      const order = orders.find((o) => o.id === id);
      if (!order) return false;
      return !order.assignedMotoboyId || order.assignedMotoboyId === motoboyId || ['delivered', 'cancelled'].includes(order.status);
    });
    if (!safeOrderIds.length) {
      showToast('Esses pedidos já estão vinculados a outro motoboy.');
      return;
    }

    safeOrderIds.forEach((id, idx) => {
      const order = orders.find((o) => o.id === id);
      if (order) {
        saveOrderToCloud({`
  );

  s = s.replaceAll(
    `(targetMotoboy.activeOrdersCount || 0) + orderIds.length`,
    `(targetMotoboy.activeOrdersCount || 0) + safeOrderIds.length`
  );
  s = s.replaceAll(
    `\`${'${orderIds.length}'} pedidos vinculados a \${targetMotoboy.name}! 🍳 Em preparo\``,
    `\`${'${safeOrderIds.length}'} pedidos vinculados a \${targetMotoboy.name}! 🍳 Em preparo\``
  );

  // Se um motoboy possui carga ativa, ele nunca pode reaparecer na fila por acidente.
  const watchdogAnchor = `  // 2. Realtime Watchdog\n  useEffect(() => {`;
  if (!s.includes('multi-driver route isolation') && s.includes(watchdogAnchor)) {
    s = s.replace(watchdogAnchor,
`  // multi-driver route isolation: motoboy com pedido ativo não pode voltar para a fila
  useEffect(() => {
    motoboys.forEach((m) => {
      const hasActiveAssigned = orders.some((o) =>
        o.assignedMotoboyId === m.id && !['delivered', 'cancelled'].includes(o.status)
      );
      if (hasActiveAssigned && m.joinedQueueAt) {
        saveMotoboyToCloud({ ...m, joinedQueueAt: undefined });
      }
    });
  }, [orders, motoboys]);

  // 2. Realtime Watchdog
  useEffect(() => {`);
  }

  return s;
});

patch('src/components/MotoboyApp.tsx', (input) => {
  let s = input;

  // A fila visual também deve excluir motoboys que já têm pedidos ativos atribuídos.
  s = s.replace(
`      [...motoboys]
        .filter((motoboy) => motoboy.status === 'available')`,
`      [...motoboys]
        .filter((motoboy) => {
          const hasAssigned = orders.some((order) => order.assignedMotoboyId === motoboy.id && !isFinalized(order));
          return motoboy.status === 'available' && Boolean(motoboy.joinedQueueAt) && !motoboy.callingToCounterAt && !hasAssigned;
        })`
  );

  return s;
});

console.log('[multi-driver] route isolation enforced');
