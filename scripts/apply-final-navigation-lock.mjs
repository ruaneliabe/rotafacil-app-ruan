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
// Nunca deve abrir app externo automaticamente.
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

// Remove o Waze do fluxo inteiro. Google Maps é o único navegador externo.
s = s.replace(/\n\s*const openWaze = \(\) => \{[\s\S]*?\n\s*\};\n/, '\n');

replaceOnce(
`<div><h3 className="text-lg font-black">Abrir navegação</h3><p className="mt-1 text-[11px] text-slate-500">Escolha o app que você usa na rua.</p></div>`,
`<div><h3 className="text-lg font-black">Abrir no Google Maps</h3><p className="mt-1 text-[11px] text-slate-500">A rota completa será aberta no Google Maps com as paradas na ordem.</p></div>`,
  'navigation explanation legacy'
);

replaceOnce(
`<div><h3 className="text-lg font-black">Abrir navegação</h3><p className="mt-1 text-[11px] text-slate-500">Abre fora do Rota Fácil. No Google Maps, a rota completa mantém as paradas na ordem; no Waze, abre a próxima parada.</p></div>`,
`<div><h3 className="text-lg font-black">Abrir no Google Maps</h3><p className="mt-1 text-[11px] text-slate-500">A rota completa será aberta no Google Maps com as paradas na ordem.</p></div>`,
  'navigation explanation patched'
);

replaceOnce(
`<div><h3 className="text-lg font-black">Abrir navegação</h3><p className="mt-1 text-[11px] text-slate-500">Google Maps abre a rota completa com as paradas. Waze abre somente a próxima entrega.</p></div>`,
`<div><h3 className="text-lg font-black">Abrir no Google Maps</h3><p className="mt-1 text-[11px] text-slate-500">A rota completa será aberta no Google Maps com as paradas na ordem.</p></div>`,
  'navigation explanation final'
);

s = s.replace(
`            <div className="mt-5 grid grid-cols-2 gap-2">\n              <button onClick={openGoogle} className="rounded-xl bg-[#081A2F] p-4 text-sm font-black text-white">Google Maps</button>\n              <button onClick={openWaze} className="rounded-xl bg-violet-600 p-4 text-sm font-black text-white">Waze</button>\n            </div>`,
`            <div className="mt-5">\n              <button onClick={openGoogle} className="w-full rounded-xl bg-[#081A2F] p-4 text-sm font-black text-white">Google Maps</button>\n            </div>`
);

s = s.replace(
`            <div className="mt-5 grid grid-cols-2 gap-2">\n              <button onClick={openGoogle} className="rounded-xl bg-[#081A2F] p-4 text-sm font-black text-white"><span className="block">Google Maps</span><span className="mt-1 block text-[9px] font-semibold text-slate-300">Rota completa</span></button>\n              <button onClick={openWaze} className="rounded-xl bg-violet-600 p-4 text-sm font-black text-white"><span className="block">Waze</span><span className="mt-1 block text-[9px] font-semibold text-violet-100">Próxima parada</span></button>\n            </div>`,
`            <div className="mt-5">\n              <button onClick={openGoogle} className="w-full rounded-xl bg-[#081A2F] p-4 text-sm font-black text-white"><span className="block">Google Maps</span><span className="mt-1 block text-[9px] font-semibold text-slate-300">Rota completa</span></button>\n            </div>`
);

fs.writeFileSync(path, s);
console.log('[nav-lock] Google Maps only navigation locked');
