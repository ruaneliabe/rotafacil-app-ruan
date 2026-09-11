import fs from 'node:fs';

const path = 'src/components/OperationManagementEnhancer.tsx';
let s = fs.readFileSync(path, 'utf8');

if (!s.includes('const mapShellRef = useRef<HTMLDivElement | null>(null);')) {
  s = s.replace(
    "  const suppressOpenRef = useRef(false);",
    "  const suppressOpenRef = useRef(false);\n  const mapShellRef = useRef<HTMLDivElement | null>(null);"
  );
}

if (!s.includes('hideLegacyMapStatusBar')) {
  s = s.replace(
    "  useEffect(() => {\n    const valid = new Set(waitingOrders.map((o) => o.id));\n    setSelectedOrderIds((current) => current.filter((id) => valid.has(id)));\n  }, [waitingOrders]);",
    "  useEffect(() => {\n    const valid = new Set(waitingOrders.map((o) => o.id));\n    setSelectedOrderIds((current) => current.filter((id) => valid.has(id)));\n  }, [waitingOrders]);\n\n  useEffect(() => {\n    if (!active) return;\n    const hideLegacyMapStatusBar = () => {\n      const shell = mapShellRef.current;\n      if (!shell) return;\n      shell.querySelectorAll<HTMLElement>('div').forEach((element) => {\n        const text = (element.textContent || '').replace(/\\s+/g, ' ').trim();\n        if (text.startsWith('Na loja (') && text.includes('Em rota (') && text.includes('Voltando (')) {\n          element.style.setProperty('display', 'none', 'important');\n        }\n      });\n    };\n    hideLegacyMapStatusBar();\n    const observer = new MutationObserver(hideLegacyMapStatusBar);\n    if (mapShellRef.current) observer.observe(mapShellRef.current, { childList: true, subtree: true });\n    return () => observer.disconnect();\n  }, [active, tab]);"
  );
}

s = s.replace(
  '<div className="relative min-h-[430px] border-r border-slate-800 bg-[#0b111c] p-3">',
  '<div ref={mapShellRef} className="relative min-h-[430px] border-r border-slate-800 bg-[#0b111c] p-3">'
);

const oldMap = '<ReactiveRouteMap origin={{ name: shift.storeName || \'Loja\', address: shift.storeAddress || \'\', lat: shift.storeLat || -26.9194, lng: shift.storeLng || -49.0661 }} stops={stops} motoboysList={visibleDrivers} selectedMotoboyId={selectedDriverId} onSelectMotoboy={(id: string) => setSelectedDriverId(id)} />';
const previousPatchedMap = '<ReactiveRouteMap origin={{ name: shift.storeName || \'Loja\', address: shift.storeAddress || \'\', lat: shift.storeLat || -26.9194, lng: shift.storeLng || -49.0661 }} stops={stops} selectedStopId={selectedOrderIds[selectedOrderIds.length - 1] || null} onSelectStop={(stop: Stop) => { if (tab !== \'orders\') return; setSelectedOrderIds((current) => current.includes(stop.id) ? current.filter((id) => id !== stop.id) : [...current, stop.id]); }} motoboysList={visibleDrivers} selectedMotoboyId={selectedDriverId} onSelectMotoboy={(id: string) => setSelectedDriverId(id)} />';
const stableMap = '<ReactiveRouteMap origin={{ name: shift.storeName || \'Loja\', address: shift.storeAddress || \'\', lat: shift.storeLat || -26.9194, lng: shift.storeLng || -49.0661 }} stops={stops} onSelectStop={(stop: Stop) => { if (tab !== \'orders\') return; setSelectedOrderIds((current) => current.includes(stop.id) ? current.filter((id) => id !== stop.id) : [...current, stop.id]); }} motoboysList={visibleDrivers} selectedMotoboyId={selectedDriverId} onSelectMotoboy={(id: string) => setSelectedDriverId(id)} />';
s = s.replace(oldMap, stableMap);
s = s.replace(previousPatchedMap, stableMap);

s = s.replace(
  'Selecione os pedidos que deseja incluir na rota.',
  'Clique nos pedidos do mapa para incluir ou remover da rota.'
);

// The right panel is now only a basket of what the operator clicked on the map.
s = s.replace('{filteredOrders.map((o) => { const selected = selectedOrderIds.includes(o.id);', '{selectedOrders.map((o) => { const selected = true;');

fs.writeFileSync(path, s);
console.log('[map-selection-fixes] stable map selection + selected-only route basket applied');
