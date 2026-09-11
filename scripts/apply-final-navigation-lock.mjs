import fs from 'node:fs';

const path = 'src/components/MotoboyApp.tsx';
let s = fs.readFileSync(path, 'utf8');

const replaceOnce = (from, to, label) => {
  if (!s.includes(from)) {
    console.log(`[nav-lock] ${label}: no-op`);
    return;
  }
  s = s.replace(from, to);
  console.log(`[nav-lock] ${label}: updated`);
};

// Iniciar rota deve SOMENTE iniciar o fluxo no Rota Fácil.
// Nunca deve abrir Waze/Maps automaticamente nem reaproveitar modal antigo.
replaceOnce(
`  const startRoute = () => {
    if (!route.length) return;
    route.forEach((order, index) =>
      onUpdateOrderStatus(order.id, index === 0 ? 'in_transit' : 'picked_up')
    );
    if (driver) onUpdateMotoboyStatus?.(driver.id, 'delivering');
  };`,
`  const startRoute = () => {
    if (!route.length) return;
    setNavRequest(null);
    route.forEach((order, index) =>
      onUpdateOrderStatus(order.id, index === 0 ? 'in_transit' : 'picked_up')
    );
    if (driver) onUpdateMotoboyStatus?.(driver.id, 'delivering');
    setTab('route');
  };`,
  'start route never opens external navigation'
);

// Waze por URL não suporta uma rota multi-paradas confiável.
// Ele deve abrir exclusivamente a próxima parada; rota completa fica no Google Maps.
replaceOnce(
`  const openWaze = () => {
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
`  const openWaze = () => {
    if (!navRequest) return;
    const baseRoute = navRequest.orders?.length ? navRequest.orders : remainingRoute(navRequest.from);
    const target = baseRoute[0];
    if (!target) return;
    const hasCoords = Number.isFinite(Number(target.lat)) && Number.isFinite(Number(target.lng));
    const destination = hasCoords
      ? \`ll=\${Number(target.lat)},\${Number(target.lng)}\`
      : \`q=\${encodeURIComponent([target.address, target.neighborhood].filter(Boolean).join(', '))}\`;
    setNavRequest(null);
    launchExternalNavigation(\`https://waze.com/ul?\${destination}&navigate=yes\`);
  };`,
  'waze always opens next stop with valid destination'
);

replaceOnce(
`<div><h3 className="text-lg font-black">Abrir navegação</h3><p className="mt-1 text-[11px] text-slate-500">Abre fora do Rota Fácil. No Google Maps, a rota completa mantém as paradas na ordem; no Waze, abre a próxima parada.</p></div>`,
`<div><h3 className="text-lg font-black">Abrir navegação</h3><p className="mt-1 text-[11px] text-slate-500">Google Maps abre a rota completa com as paradas. Waze abre somente a próxima entrega.</p></div>`,
  'navigation explanation'
);

replaceOnce(
`<button onClick={openGoogle} className="rounded-xl bg-[#081A2F] p-4 text-sm font-black text-white">Google Maps</button>
              <button onClick={openWaze} className="rounded-xl bg-violet-600 p-4 text-sm font-black text-white">Waze</button>`,
`<button onClick={openGoogle} className="rounded-xl bg-[#081A2F] p-4 text-sm font-black text-white"><span className="block">Google Maps</span><span className="mt-1 block text-[9px] font-semibold text-slate-300">Rota completa</span></button>
              <button onClick={openWaze} className="rounded-xl bg-violet-600 p-4 text-sm font-black text-white"><span className="block">Waze</span><span className="mt-1 block text-[9px] font-semibold text-violet-100">Próxima parada</span></button>`,
  'navigation button labels'
);

fs.writeFileSync(path, s);
console.log('[nav-lock] final navigation behavior locked');
