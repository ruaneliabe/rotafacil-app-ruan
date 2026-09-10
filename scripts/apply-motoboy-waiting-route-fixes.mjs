import fs from 'node:fs';

const path = 'src/components/MotoboyApp.tsx';
let s = fs.readFileSync(path, 'utf8');

const replaceOnce = (from, to, label) => {
  if (!s.includes(from)) {
    console.log(`[waiting-route-fix] ${label}: no-op`);
    return;
  }
  s = s.replace(from, to);
  console.log(`[waiting-route-fix] ${label}: updated`);
};

// Permite reorganizar a carga ainda enquanto os pedidos estao em preparo.
replaceOnce(
`  const move = (index: number, direction: -1 | 1) => {
    if (activeRun) return;
    const ids = route.map((order) => order.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    persist(ids);
  };`,
`  const move = (index: number, direction: -1 | 1) => {
    if (activeRun) return;
    const ids = route.map((order) => order.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    persist(ids);
  };

  const moveCounterLoad = (index: number, direction: -1 | 1) => {
    const ids = counterLoad.map((order) => order.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    if (driver) onReorderMotoboyRoute?.(driver.id, ids);
  };`,
  'allow reordering assigned orders before pickup'
);

// Usa universal links. No iPhone, o sistema abre o app nativo quando instalado;
// se nao estiver instalado, o mesmo link abre no navegador externo padrao.
// Evita custom schemes (waze:// / comgooglemaps://), que geram "endereco invalido" no Safari/PWA.
replaceOnce(
`  const launchExternalNavigation = (url: string) => {
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) window.location.assign(url);
  };`,
`  const launchExternalNavigation = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer external';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };`,
  'launch universal link outside PWA with native-app/browser fallback'
);

// Mantem Google Maps como HTTPS universal link: abre o app se instalado ou o navegador externo se nao.
replaceOnce(
`    const url = \`https://www.google.com/maps/dir/?api=1\${origin}&destination=\${destination}\${waypoints ? \`&waypoints=\${encodeURIComponent(waypoints)}\` : ''}&travelmode=driving\`;
    setNavRequest(null);
    launchExternalNavigation(url);`,
`    const url = \`https://www.google.com/maps/dir/?api=1\${origin}&destination=\${destination}\${waypoints ? \`&waypoints=\${encodeURIComponent(waypoints)}\` : ''}&travelmode=driving\`;
    setNavRequest(null);
    launchExternalNavigation(url);`,
  'Google Maps uses universal HTTPS link'
);

// Mantem Waze como HTTPS universal link: abre o app se instalado ou o navegador externo se nao.
replaceOnce(
`    setNavRequest(null);
    launchExternalNavigation(\`https://waze.com/ul?\${destination}&navigate=yes\`);`,
`    const webUrl = \`https://waze.com/ul?\${destination}&navigate=yes\`;
    setNavRequest(null);
    launchExternalNavigation(webUrl);`,
  'Waze uses universal HTTPS link'
);

// O mapa interno tambem funciona antes da retirada usando a carga reservada.
replaceOnce(
`  const routeStops = route.map((order, index) => ({`,
`  const mapOrders = route.length ? route : counterLoad;
  const routeStops = mapOrders.map((order, index) => ({`,
  'show waiting load on internal map'
);
replaceOnce(
`<div><h3 className="font-black">Mapa da rota</h3><p className="text-[10px] text-slate-500">{route.length} parada{route.length === 1 ? '' : 's'} na rota</p></div>`,
`<div><h3 className="font-black">Mapa da rota</h3><p className="text-[10px] text-slate-500">{mapOrders.length} parada{mapOrders.length === 1 ? '' : 's'} na rota</p></div>`,
  'map modal uses waiting load count'
);

// Mostra setas em cada pedido enquanto aguarda a cozinha.
replaceOnce(
`{counterLoad.map((order) => {
                    const isReady = order.status === 'ready_at_counter';`,
`{counterLoad.map((order, index) => {
                    const isReady = order.status === 'ready_at_counter';`,
  'waiting cards receive index'
);
replaceOnce(
`                        <p className="mt-1 text-[11px] text-slate-500">{order.neighborhood || order.address}</p>
                        <p className={'mt-3 flex items-center gap-1 text-[10px] font-bold ' + (isReady ? 'text-emerald-700' : 'text-amber-700')}>`,
`                        <p className="mt-1 text-[11px] text-slate-500">{order.neighborhood || order.address}</p>
                        <div className="mt-3 flex gap-2">
                          <button disabled={!index} onClick={() => moveCounterLoad(index, -1)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-30" title="Entregar antes"><ArrowUp className="h-4 w-4" /></button>
                          <button disabled={index === counterLoad.length - 1} onClick={() => moveCounterLoad(index, 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-30" title="Entregar depois"><ArrowDown className="h-4 w-4" /></button>
                          <span className="flex min-w-0 flex-1 items-center text-[10px] font-bold text-slate-500">Ordem de entrega: {index + 1}</span>
                        </div>
                        <p className={'mt-3 flex items-center gap-1 text-[10px] font-bold ' + (isReady ? 'text-emerald-700' : 'text-amber-700')}>`,
  'waiting cards show route order controls'
);

// Enquanto espera, oferece mapa interno e escolha do GPS externo.
replaceOnce(
`                  <button onClick={() => setNavRequest({ fullRoute: true, orders: counterLoad })} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-[11px] font-black text-violet-700">
                    <Route className="h-4 w-4" /> Montar rota
                  </button>`,
`                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setShowMap(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-700">
                      <MapPin className="h-4 w-4" /> Ver no mapa
                    </button>
                    <button onClick={() => setNavRequest({ fullRoute: true, orders: counterLoad })} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-2 text-[11px] font-black text-violet-700">
                      <Route className="h-4 w-4" /> Abrir no GPS
                    </button>
                  </div>`,
  'waiting state shows map and GPS actions'
);

fs.writeFileSync(path, s);
console.log('[waiting-route-fix] motoboy waiting route fixes complete');
