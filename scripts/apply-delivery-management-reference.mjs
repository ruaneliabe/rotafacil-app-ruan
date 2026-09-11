import fs from 'node:fs';

const update = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[delivery-reference] ${path}: updated`);
  } else {
    console.log(`[delivery-reference] ${path}: no-op`);
  }
};

update('src/components/OperationDispatchView.tsx', (input) => {
  let s = input;

  // Keep the filter row identical to the approved reference, even if an older
  // build-time patch reintroduces the previous Pedidos/Entregadores tabs.
  s = s.replace(
    /\{\(\[\s*\['all',\s*'Todos'[\s\S]*?\] as Array<\[ManageFilter, string, number\]>\)\.map\(\(\[id, label, count\]\) => <button[\s\S]*?<\/button>\)\}/,
    `{([\n                ['all', 'Todos', activeOrders.length],\n                ['unassigned', 'Sem entregador', grouped.waiting.length],\n                ['route', 'Em rota', grouped.route.length],\n                ['returning', 'Voltando', returningDrivers.length],\n                ['delivering', 'Em entrega', deliveringDrivers.length],\n                ['available', 'Disponíveis', availableDrivers.length],\n              ] as Array<[ManageFilter, string, number]>).map(([id, label, count]) => <button key={id} onClick={() => setManageFilter(id)} className={\`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[11px] font-black transition \${manageFilter === id ? 'border-violet-600 bg-violet-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}\`}>{id === 'unassigned' ? <PackageOpen className=\"h-3.5 w-3.5\" /> : id === 'route' || id === 'delivering' ? <Bike className=\"h-3.5 w-3.5\" /> : id === 'returning' ? <Navigation className=\"h-3.5 w-3.5\" /> : id === 'available' ? <Users className=\"h-3.5 w-3.5\" /> : null}{label}<span className={\`text-[9px] \${manageFilter === id ? 'text-white/80' : 'text-slate-400'}\`}>({count})</span></button>)}`
  );

  // Remove only the right-side "Pedidos sem entregador" panel. The
  // "Sem entregador" filter remains available in the top filter row.
  s = s.replace(
    /\n\s*<section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50\/50 px-3 py-2\.5"><div className="flex items-center gap-2"><PackageOpen className="h-4 w-4 text-slate-500" \/><h4 className="text-\[11px\] font-black text-slate-800">Pedidos sem entregador \(\{grouped\.waiting\.length\}\)<\/h4>[\s\S]*?<\/section>/,
    ''
  );

  return s;
});

update('src/components/RouteMap.tsx', (input) => {
  let s = input;

  // On the management map, render motoboys as motorcycle pins instead of
  // permanent name badges. Clicking still opens the popup with the driver's name.
  s = s.replace(
    /const initial = mb\.name \? mb\.name\.charAt\(0\)\.toUpperCase\(\) : 'M';\n\s*const ringColor = isThisSelected[\s\S]*?const motoboyIcon = L\.divIcon\(\{[\s\S]*?iconAnchor: \[35, 24\],\n\s*\}\);/,
    `const ringColor = isThisSelected ? 'border-amber-300 ring-4 ring-amber-500/50 scale-110' : 'border-blue-400';\n\n          const motoboyIcon = L.divIcon({\n            className: 'custom-motoboy-pin z-40',\n            html: \`\n              <div class=\"relative flex items-center justify-center\">\n                <div class=\"w-9 h-9 rounded-full bg-blue-600 border-2 \${ringColor} text-white flex items-center justify-center text-base shadow-xl z-30\">\n                  🛵\n                </div>\n              </div>\n            \`,\n            iconSize: [38, 38],\n            iconAnchor: [19, 19],\n          });`
  );

  s = s.replace(
    /const initial = mb\.name \? mb\.name\.charAt\(0\)\.toUpperCase\(\) : 'M';\n\n\s*\/\/ If another motoboy is selected[\s\S]*?\/\/ Selected or low-density Motoboy Marker/,
    `// If another motoboy is selected, show a small motorcycle marker.\n        if (isFilteringActive && !isSelected) {\n          const discreteDotIcon = L.divIcon({\n            className: 'custom-discrete-dot z-20',\n            html: \`<div class=\"w-7 h-7 rounded-full \${isReturning ? 'bg-amber-500' : 'bg-blue-600'} border-2 border-white shadow-lg cursor-pointer flex items-center justify-center text-sm\">🛵</div>\`,\n            iconSize: [28, 28],\n            iconAnchor: [14, 14],\n          });\n          const dotMarker = L.marker([mbLat, mbLng], { icon: discreteDotIcon }).bindPopup(\`<div class=\"p-1.5 text-slate-100 text-xs\"><strong>\${mb.name}</strong> (\${isReturning ? 'Voltando' : 'Em rota'})</div>\`);\n          if (onSelectMotoboy) dotMarker.on('click', () => onSelectMotoboy(mb.id));\n          markersGroup.addLayer(dotMarker);\n          return;\n        }\n\n        if (!isFilteringActive && onRoad.length > 6) {\n          const fleetDotIcon = L.divIcon({\n            className: 'custom-discrete-dot z-20',\n            html: \`<div class=\"w-7 h-7 rounded-full \${isReturning ? 'bg-amber-500' : 'bg-blue-600'} border-2 border-white shadow-lg cursor-pointer flex items-center justify-center text-sm hover:scale-110 transition-transform\">🛵</div>\`,\n            iconSize: [28, 28],\n            iconAnchor: [14, 14],\n          });\n          const fleetDot = L.marker([mbLat, mbLng], { icon: fleetDotIcon }).bindPopup(\`<div class=\"p-1.5 text-slate-100 text-xs\"><strong>\${mb.name}</strong><br/>\${isReturning ? 'Voltando à loja' : 'Em rota'}</div>\`);\n          if (onSelectMotoboy) fleetDot.on('click', () => onSelectMotoboy(mb.id));\n          markersGroup.addLayer(fleetDot);\n          bounds.push([mbLat, mbLng]);\n          return;\n        }\n\n        // Selected or low-density Motoboy Marker`
  );

  s = s.replace(
    /const motoboyIcon = L\.divIcon\(\{\n\s*className: 'custom-motoboy-pin z-40',[\s\S]*?iconAnchor: \[45, 25\],\n\s*\}\);/,
    `const motoboyIcon = L.divIcon({\n          className: 'custom-motoboy-pin z-40',\n          html: \`\n            <div class=\"relative flex items-center justify-center\">\n              \${isReturning ? '<div class=\"absolute -inset-1.5 bg-amber-500/30 rounded-full animate-ping\"></div>' : ''}\n              <div class=\"w-9 h-9 rounded-full \${isReturning ? 'bg-amber-500' : 'bg-blue-600'} border-2 border-white \${isSelected ? 'ring-4 ring-violet-400/70 scale-110' : ''} flex items-center justify-center text-base shadow-xl z-30\">🛵</div>\n            </div>\n          \`,\n          iconSize: [38, 38],\n          iconAnchor: [19, 19],\n        });`
  );

  return s;
});

console.log('[delivery-reference] finished');
