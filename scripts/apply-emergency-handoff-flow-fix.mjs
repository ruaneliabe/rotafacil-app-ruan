import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log('[handoff-emergency] ' + path + ': updated');
  } else {
    console.log('[handoff-emergency] ' + path + ': no-op');
  }
};

patch('src/components/StoreDashboardLegacy.tsx', (input) => {
  let s = input;

  const oldQueue = `  const motoboysAvailable = motoboys\n    .filter((m) => m.status === 'available')\n    .sort((a, b) => {\n      const loadDiff = getMotoboyLoad(a.id) - getMotoboyLoad(b.id);\n      if (loadDiff !== 0) return loadDiff;\n      return (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0);`;
  const newQueue = `  const motoboysAvailable = motoboys\n    .filter((m) => m.status === 'available' && Boolean(m.joinedQueueAt) && !m.callingToCounterAt && getMotoboyLoad(m.id) === 0)\n    .sort((a, b) => {\n      return Number(a.joinedQueueAt || Number.MAX_SAFE_INTEGER) - Number(b.joinedQueueAt || Number.MAX_SAFE_INTEGER);`;
  if (s.includes(oldQueue)) s = s.replace(oldQueue, newQueue);

  s = s.replaceAll(
    `saveMotoboyToCloud({ ...nextMotoboy, callingToCounterAt: Date.now() });`,
    `saveMotoboyToCloud({ ...nextMotoboy, joinedQueueAt: undefined, callingToCounterAt: Date.now() });`
  );

  return s;
});

patch('src/components/MotoboyApp.tsx', (input) => {
  let s = input;
  s = s.replace(
    `  const inQueue = driver?.status === 'available';`,
    `  const inQueue = driver?.status === 'available' && Boolean(driver?.joinedQueueAt) && !driver?.callingToCounterAt;`
  );
  s = s.replace(
    `            {inQueue && (\n              <>`,
    `            {(inQueue || assigned.length > 0) && (\n              <>`
  );
  return s;
});

patch('src/App.tsx', (input) => {
  let s = input;
  s = s.replace(
    `      status: 'preparing',\n      routeSequence: (targetMotoboy.activeOrdersCount || 0) + 1,`,
    `      status: targetOrder.status === 'ready_at_counter' ? 'ready_at_counter' : (targetOrder.status === 'pending' ? 'preparing' : targetOrder.status),\n      routeSequence: (targetMotoboy.activeOrdersCount || 0) + 1,`
  );
  s = s.replace(
    `          status: 'preparing',\n          routeSequence: (targetMotoboy.activeOrdersCount || 0) + idx + 1,`,
    `          status: order.status === 'ready_at_counter' ? 'ready_at_counter' : (order.status === 'pending' ? 'preparing' : order.status),\n          routeSequence: (targetMotoboy.activeOrdersCount || 0) + idx + 1,`
  );
  return s;
});

console.log('[handoff-emergency] called-driver handoff flow enforced');
