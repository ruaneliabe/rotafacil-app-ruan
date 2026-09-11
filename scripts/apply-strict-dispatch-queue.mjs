import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after === before) console.log(`[strict-queue] ${path}: no-op`);
  else { fs.writeFileSync(path, after); console.log(`[strict-queue] ${path}: updated`); }
  return after;
};

// A fila oficial vem dos motoboys reais e respeita joinedQueueAt.
const dispatch = patch('src/components/OperationDispatchView.tsx', (input) => {
  let s = input;
  s = s.replace(
    /const queueDrivers = useMemo\([\s\S]*?\n  \);/,
    `const queueDrivers = useMemo(\n    () => motoboys\n      .filter((m) => m.status === 'available' && Boolean(m.joinedQueueAt) && !m.callingToCounterAt && load(m.id) === 0)\n      .sort((a, b) => Number(a.joinedQueueAt || Number.MAX_SAFE_INTEGER) - Number(b.joinedQueueAt || Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)),\n    [motoboys, activeOrders]\n  );`
  );
  return s;
});

const panel = patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  if (!s.includes('routeDriverOverrides')) {
    s = s.replace(
      "  const [selectedLoose, setSelectedLoose] = useState<string[]>([]);",
      "  const [selectedLoose, setSelectedLoose] = useState<string[]>([]);\n  const [routeDriverOverrides, setRouteDriverOverrides] = useState<Record<string, string>>({});"
    );
  }

  s = s.replace(
    "  const nextDriver = queueDrivers[0];\n  const readyPrepared = prepared.filter((route) => route.orders.length > 0 && route.orders.every(isReady));\n  const nextRoute = readyPrepared[0];",
    "  const readyPrepared = prepared.filter((route) => route.orders.length > 0 && route.orders.every(isReady));\n  const nextRoute = readyPrepared[0];\n  const manualNextDriverId = nextRoute ? routeDriverOverrides[nextRoute.id] : '';\n  const nextDriver = (manualNextDriverId ? queueDrivers.find((driver) => driver.id === manualNextDriverId) : undefined) || queueDrivers[0];"
  );

  // Cada rota mostra um motoboy diferente conforme a posição real da fila.
  s = s.replace(
    "            {prepared.map((route, index) => {\n              const ready = route.orders.filter(isReady).length;",
    "            {prepared.map((route, index) => {\n              const suggestedDriver = (routeDriverOverrides[route.id] ? queueDrivers.find((driver) => driver.id === routeDriverOverrides[route.id]) : undefined) || queueDrivers[index] || null;\n              const ready = route.orders.filter(isReady).length;"
  );
  s = s.replace(
    "{prepared.filter((route) => route.id !== nextRoute?.id).map((route, index) => {\n              const ready = route.orders.filter(isReady).length;",
    "{prepared.filter((route) => route.id !== nextRoute?.id).map((route, index) => {\n              const suggestedDriver = (routeDriverOverrides[route.id] ? queueDrivers.find((driver) => driver.id === routeDriverOverrides[route.id]) : undefined) || queueDrivers[index] || null;\n              const ready = route.orders.filter(isReady).length;"
  );

  // Troca o texto fixo de sugestão por seletor manual, mantendo a ordem como padrão.
  s = s.replace(
    /<div className="mt-2 text-\[9px\] text-slate-500">Motoboy sugerido:[\s\S]*?<\/div>/g,
    `<div className="mt-2 flex items-center gap-2 text-[9px] text-slate-500"><span className="shrink-0">Motoboy sugerido:</span><select value={routeDriverOverrides[route.id] || suggestedDriver?.id || ''} onChange={(e) => setRouteDriverOverrides((current) => ({ ...current, [route.id]: e.target.value }))} className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-800"><option value="">{suggestedDriver ? suggestedDriver.name : 'Aguardando fila'}</option>{queueDrivers.map((driver, queueIndex) => <option key={driver.id} value={driver.id}>{queueIndex + 1}º da fila — {driver.name}</option>)}</select></div>`
  );

  // No Próximo a sair, o padrão é SEMPRE o 1º da fila. Só muda com escolha manual explícita.
  s = s.replace(
    /<div className="mt-3 rounded-lg bg-white px-2\.5 py-2 text-\[9px\] text-slate-500">\{nextDriver \? <>[\s\S]*?<\/div>/,
    `<div className="mt-3 rounded-lg bg-white px-2.5 py-2 text-[9px] text-slate-500"><div className="mb-1 font-black text-slate-900">Motoboy para esta saída</div>{queueDrivers.length ? <select value={manualNextDriverId || queueDrivers[0]?.id || ''} onChange={(e) => nextRoute && setRouteDriverOverrides((current) => ({ ...current, [nextRoute.id]: e.target.value }))} className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold text-slate-900">{queueDrivers.map((driver, queueIndex) => <option key={driver.id} value={driver.id}>{queueIndex + 1}º da fila — {driver.name}</option>)}</select> : <span>Nenhum motoboy disponível na fila</span>}</div>`
  );

  return s;
});

const checks = [
  ['fila ordenada por joinedQueueAt', dispatch.includes('Boolean(m.joinedQueueAt)') && dispatch.includes('Number(a.joinedQueueAt'))],
  ['override manual por rota', panel.includes('routeDriverOverrides')],
  ['sugestao sequencial', panel.includes('queueDrivers[index] || null')],
  ['proximo usa primeiro da fila por padrao', panel.includes('|| queueDrivers[0]')],
  ['seletor de motoboy', panel.includes('1º da fila —')],
];
const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) throw new Error(`[strict-queue] validação falhou: ${failed.join(', ')}`);
console.log('[strict-queue] fila validada: ordem real -> sugestoes sequenciais -> override manual -> chamada consistente');
