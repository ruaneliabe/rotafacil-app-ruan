import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log('[strict-queue] ' + path + ': updated');
  } else {
    console.log('[strict-queue] ' + path + ': no-op');
  }
  return after;
};

patch('src/components/OperationDispatchView.tsx', (input) => {
  let s = input;
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
  if (s.includes(oldQueue)) s = s.replace(oldQueue, newQueue);
  return s;
});

patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  const stateAnchor = `  const [selectedLoose, setSelectedLoose] = useState<string[]>([]);`;
  if (!s.includes('routeDriverOverrides') && s.includes(stateAnchor)) {
    s = s.replace(stateAnchor, `${stateAnchor}\n  const [routeDriverOverrides, setRouteDriverOverrides] = useState<Record<string, string>>({});`);
  }

  const oldNext = `  const nextDriver = queueDrivers[0];
  const readyPrepared = prepared.filter((route) => route.orders.length > 0 && route.orders.every(isReady));
  const nextRoute = readyPrepared[0];`;
  const newNext = `  const readyPrepared = prepared.filter((route) => route.orders.length > 0 && route.orders.every(isReady));
  const nextRoute = readyPrepared[0];
  const manualNextDriverId = nextRoute ? routeDriverOverrides[nextRoute.id] : '';
  const nextDriver = (manualNextDriverId ? queueDrivers.find((driver) => driver.id === manualNextDriverId) : undefined) || queueDrivers[0];`;
  if (s.includes(oldNext)) s = s.replace(oldNext, newNext);

  const mapAnchor = `            {prepared.map((route, index) => {
              const ready = route.orders.filter(isReady).length;`;
  const mapReplacement = `            {prepared.map((route, index) => {
              const suggestedDriver = (routeDriverOverrides[route.id] ? queueDrivers.find((driver) => driver.id === routeDriverOverrides[route.id]) : undefined) || queueDrivers[index] || null;
              const ready = route.orders.filter(isReady).length;`;
  if (!s.includes('const suggestedDriver =') && s.includes(mapAnchor)) {
    s = s.replace(mapAnchor, mapReplacement);
  }

  const oldSuggestion = `<div className="mt-2 text-[9px] text-slate-500">Motoboy sugerido: <b className={nextDriver ? 'text-slate-800' : 'text-slate-400'}>{nextDriver ? nextDriver.name : 'aguardando fila'}</b></div>`;
  const newSuggestion = `<div className="mt-2 flex items-center gap-2 text-[9px] text-slate-500"><span className="shrink-0">Motoboy sugerido:</span><select value={routeDriverOverrides[route.id] || suggestedDriver?.id || ''} onChange={(e) => setRouteDriverOverrides((current) => ({ ...current, [route.id]: e.target.value }))} className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-800"><option value="">{suggestedDriver ? suggestedDriver.name : 'Aguardando fila'}</option>{queueDrivers.map((driver, queueIndex) => <option key={driver.id} value={driver.id}>{queueIndex + 1}º da fila - {driver.name}</option>)}</select></div>`;
  if (s.includes(oldSuggestion)) s = s.split(oldSuggestion).join(newSuggestion);

  const oldNextDriverBox = `<div className="mt-3 rounded-lg bg-white px-2.5 py-2 text-[9px] text-slate-500">{nextDriver ? <><b className="text-slate-900">1º da fila:</b> {nextDriver.name}</> : 'Nenhum motoboy disponível na fila'}</div>`;
  const newNextDriverBox = `<div className="mt-3 rounded-lg bg-white px-2.5 py-2 text-[9px] text-slate-500"><div className="mb-1 font-black text-slate-900">Motoboy para esta saída</div>{queueDrivers.length ? <select value={manualNextDriverId || queueDrivers[0]?.id || ''} onChange={(e) => nextRoute && setRouteDriverOverrides((current) => ({ ...current, [nextRoute.id]: e.target.value }))} className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold text-slate-900">{queueDrivers.map((driver, queueIndex) => <option key={driver.id} value={driver.id}>{queueIndex + 1}º da fila - {driver.name}</option>)}</select> : <span>Nenhum motoboy disponível na fila</span>}</div>`;
  if (s.includes(oldNextDriverBox)) s = s.replace(oldNextDriverBox, newNextDriverBox);

  return s;
});

console.log('[strict-queue] patch concluido sem bloquear o deploy');
