import fs from 'node:fs';

const path = 'src/components/MotoboyApp.tsx';
let s = fs.readFileSync(path, 'utf8');

const replaceOnce = (from, to, label) => {
  if (!s.includes(from)) {
    console.log(`[nav-fix] ${label}: no-op`);
    return;
  }
  s = s.replace(from, to);
  console.log(`[nav-fix] ${label}: updated`);
};

replaceOnce(
  "type NavRequest = { from?: string; fullRoute: boolean } | null;",
  "type NavRequest = { from?: string; fullRoute: boolean; orders?: Order[] } | null;",
  'navigation request supports explicit orders'
);

replaceOnce(
`  const openGoogle = () => {
    if (!navRequest) return;
    const selectedRoute = navRequest.fullRoute
      ? remainingRoute(navRequest.from)
      : remainingRoute(navRequest.from).slice(0, 1);
    if (!selectedRoute.length) return;
    const destination = encodeURIComponent(addressForNav(selectedRoute[selectedRoute.length - 1]));
    const waypoints = selectedRoute.slice(0, -1).map(addressForNav).join('|');
    const origin = gps ? \`&origin=\${encodeURIComponent(\`\${gps.lat},\${gps.lng}\`)}\` : '';
    const url = \`https://www.google.com/maps/dir/?api=1\${origin}&destination=\${destination}\${waypoints ? \`&waypoints=\${encodeURIComponent(waypoints)}\` : ''}&travelmode=driving\`;
    setNavRequest(null);
    window.location.href = url;
  };

  const openWaze = () => {
    if (!navRequest) return;
    const target = remainingRoute(navRequest.from)[0];
    if (!target) return;
    const destination = target.lat && target.lng
      ? \`ll=\${target.lat},\${target.lng}\`
      : \`q=\${encodeURIComponent(target.address)}\`;
    setNavRequest(null);
    window.location.href = \`https://waze.com/ul?\${destination}&navigate=yes\`;
  };`,
`  const launchExternalNavigation = (url: string) => {
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) window.location.assign(url);
  };

  const openGoogle = () => {
    if (!navRequest) return;
    const baseRoute = navRequest.orders?.length ? navRequest.orders : remainingRoute(navRequest.from);
    const selectedRoute = navRequest.fullRoute ? baseRoute : baseRoute.slice(0, 1);
    if (!selectedRoute.length) return;
    const destination = encodeURIComponent(addressForNav(selectedRoute[selectedRoute.length - 1]));
    const waypoints = selectedRoute.slice(0, -1).map(addressForNav).join('|');
    const origin = gps ? \`&origin=\${encodeURIComponent(\`\${gps.lat},\${gps.lng}\`)}\` : '';
    const url = \`https://www.google.com/maps/dir/?api=1\${origin}&destination=\${destination}\${waypoints ? \`&waypoints=\${encodeURIComponent(waypoints)}\` : ''}&travelmode=driving\`;
    setNavRequest(null);
    launchExternalNavigation(url);
  };

  const openWaze = () => {
    if (!navRequest) return;
    const baseRoute = navRequest.orders?.length ? navRequest.orders : remainingRoute(navRequest.from);
    const target = baseRoute[0];
    if (!target) return;
    const destination = target.lat && target.lng
      ? \`ll=\${target.lat},\${target.lng}\`
      : \`q=\${encodeURIComponent(target.address)}\`;
    setNavRequest(null);
    launchExternalNavigation(\`https://waze.com/ul?\${destination}&navigate=yes\`);
  };`,
  'open navigation outside PWA and support waiting-load planner'
);

replaceOnce(
`  const startRoute = () => {
    if (!route.length) return;
    route.forEach((order, index) =>
      onUpdateOrderStatus(order.id, index === 0 ? 'in_transit' : 'picked_up')
    );
    if (driver) onUpdateMotoboyStatus?.(driver.id, 'delivering');

    const destination = encodeURIComponent(addressForNav(route[route.length - 1]));
    const waypoints = route.slice(0, -1).map(addressForNav).join('|');
    const origin = gps ? '&origin=' + encodeURIComponent(gps.lat + ',' + gps.lng) : '';
    const url = 'https://www.google.com/maps/dir/?api=1' + origin + '&destination=' + destination + (waypoints ? '&waypoints=' + encodeURIComponent(waypoints) : '') + '&travelmode=driving';
    window.location.href = url;
  };`,
`  const startRoute = () => {
    if (!route.length) return;
    route.forEach((order, index) =>
      onUpdateOrderStatus(order.id, index === 0 ? 'in_transit' : 'picked_up')
    );
    if (driver) onUpdateMotoboyStatus?.(driver.id, 'delivering');
  };`,
  'start route without forcing navigation app'
);

replaceOnce(
`                <div className="mx-3 mb-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-3 text-[10px] leading-relaxed text-slate-500">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span>A retirada só será liberada quando <b>todos os pedidos da sua carga</b> estiverem prontos.</span>
                </div>`,
`                <div className="mx-3 mb-3 space-y-2">
                  <button onClick={() => setNavRequest({ fullRoute: true, orders: counterLoad })} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-[11px] font-black text-violet-700">
                    <Route className="h-4 w-4" /> Montar rota
                  </button>
                  <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-3 text-[10px] leading-relaxed text-slate-500">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span>A retirada só será liberada quando <b>todos os pedidos da sua carga</b> estiverem prontos.</span>
                  </div>
                </div>`,
  'show route planner while waiting for assigned orders'
);

replaceOnce(
`              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowMap(true)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[12px] font-black text-slate-700"><MapPin className="h-4 w-4" /> Ver mapa</button>
                {!activeRun ? (
                  <button onClick={startRoute} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 text-[12px] font-black text-white shadow-sm"><Navigation className="h-4 w-4" /> Iniciar rota</button>
                ) : (
                  <button onClick={() => setNavRequest({ fullRoute: true })} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 text-[12px] font-black text-white shadow-sm"><Route className="h-4 w-4" /> Abrir rota</button>
                )}
              </div>`,
`              {!activeRun && (
                <button onClick={() => setNavRequest({ fullRoute: true })} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 text-[12px] font-black text-violet-700">
                  <Route className="h-4 w-4" /> Montar rota no GPS
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowMap(true)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[12px] font-black text-slate-700"><MapPin className="h-4 w-4" /> Ver mapa</button>
                {!activeRun ? (
                  <button onClick={startRoute} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 text-[12px] font-black text-white shadow-sm"><Navigation className="h-4 w-4" /> Iniciar rota</button>
                ) : (
                  <button onClick={() => setNavRequest({ fullRoute: true })} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 text-[12px] font-black text-white shadow-sm"><Route className="h-4 w-4" /> Abrir rota</button>
                )}
              </div>`,
  'add separate route planner before starting'
);

replaceOnce(
`<div><h3 className="text-lg font-black">Abrir navegação</h3><p className="mt-1 text-[11px] text-slate-500">Escolha o app que você usa na rua.</p></div>`,
`<div><h3 className="text-lg font-black">Abrir navegação</h3><p className="mt-1 text-[11px] text-slate-500">Abre fora do Rota Fácil. No Google Maps, a rota completa mantém as paradas na ordem; no Waze, abre a próxima parada.</p></div>`,
  'clarify Google multi-stop and Waze behavior'
);

fs.writeFileSync(path, s);
console.log('[nav-fix] motoboy navigation fixes complete');
