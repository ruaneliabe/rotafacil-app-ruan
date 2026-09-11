import fs from 'node:fs';

const path = 'src/components/OperationDispatchView.tsx';
const before = fs.readFileSync(path, 'utf8');
let after = before;

const oldQueue = `  const queueDrivers = useMemo(
    () => motoboysAvailable
      .filter((m) => m.status === 'available' && load(m.id) === 0)
      .sort((a, b) => Number(a.joinedQueueAt || Number.MAX_SAFE_INTEGER) - Number(b.joinedQueueAt || Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)),
    [motoboysAvailable, activeOrders]
  );`;

const newQueue = `  const queueDrivers = useMemo(
    () => motoboys
      .filter((m) => m.status === 'available' && Boolean(m.joinedQueueAt) && !m.callingToCounterAt && load(m.id) === 0)
      .sort((a, b) => Number(a.joinedQueueAt || Number.MAX_SAFE_INTEGER) - Number(b.joinedQueueAt || Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)),
    [motoboys, activeOrders]
  );`;

if (after.includes(oldQueue)) after = after.replace(oldQueue, newQueue);

if (after !== before) {
  fs.writeFileSync(path, after);
  console.log('[strict-queue] fila oficial aplicada');
} else {
  console.log('[strict-queue] fila oficial ja aplicada ou fonte diferente');
}

// Importante para o piloto: nao fazemos mais mutacoes parciais em PredispatchRoutesPanel.
// Elas causavam referencias incompletas (routeDriverOverrides/suggestedDriver) e tela preta ao montar rota.
console.log('[strict-queue] predispatch preservado sem mutacoes inseguras');
