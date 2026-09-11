import fs from 'node:fs';

const path = 'src/components/OperationManagementEnhancer.tsx';
let s = fs.readFileSync(path, 'utf8');

if (!s.includes('const mapShellRef = useRef<HTMLDivElement | null>(null);')) {
  s = s.replace(
    "  const suppressOpenRef = useRef(false);",
    "  const suppressOpenRef = useRef(false);\n  const mapShellRef = useRef<HTMLDivElement | null>(null);"
  );
}

if (!s.includes('const closedLegacyOverlayRef = useRef<HTMLElement | null>(null);')) {
  s = s.replace(
    "  const mapShellRef = useRef<HTMLDivElement | null>(null);",
    "  const mapShellRef = useRef<HTMLDivElement | null>(null);\n  const closedLegacyOverlayRef = useRef<HTMLElement | null>(null);"
  );
}

if (!s.includes('const [preparedRouteRevision, setPreparedRouteRevision]')) {
  s = s.replace(
    "  const [toast, setToast] = useState<string | null>(null);",
    "  const [toast, setToast] = useState<string | null>(null);\n  const [preparedRouteRevision, setPreparedRouteRevision] = useState(0);"
  );
}

s = s.replace(
  "type SideTab = 'orders' | 'queue' | 'returning' | 'delivering';",
  "type SideTab = 'overview' | 'orders' | 'queue' | 'returning' | 'delivering';"
);

s = s.replace(
  "      if (!overlay) return;\n      legacyOverlayRef.current = overlay;",
  "      if (!overlay) return;\n      if (closedLegacyOverlayRef.current === overlay && overlay.style.display === 'none') return;\n      if (closedLegacyOverlayRef.current === overlay && overlay.style.display !== 'none') closedLegacyOverlayRef.current = null;\n      legacyOverlayRef.current = overlay;"
);

s = s.replace(
  "  const close = () => {\n    suppressOpenRef.current = true;\n    if (legacyOverlayRef.current?.isConnected) legacyOverlayRef.current.style.display = 'none';",
  "  const close = () => {\n    suppressOpenRef.current = true;\n    closedLegacyOverlayRef.current = legacyOverlayRef.current;\n    if (legacyOverlayRef.current?.isConnected) legacyOverlayRef.current.style.display = 'none';"
);

if (!s.includes("window.addEventListener('rotafacil-prepared-routes-changed'")) {
  s = s.replace(
    "  const activeOrders = useMemo(() => orders.filter((o) => !['delivered', 'cancelled', 'failed'].includes(String(o.status))), [orders]);",
    "  useEffect(() => {\n    const refreshPreparedRoutes = () => setPreparedRouteRevision((value) => value + 1);\n    window.addEventListener('storage', refreshPreparedRoutes);\n    window.addEventListener('rotafacil-prepared-routes-changed', refreshPreparedRoutes);\n    return () => {\n      window.removeEventListener('storage', refreshPreparedRoutes);\n      window.removeEventListener('rotafacil-prepared-routes-changed', refreshPreparedRoutes);\n    };\n  }, []);\n\n  const preparedRouteOrderIds = useMemo(() => {\n    try {\n      const raw = window.localStorage.getItem(STORAGE_KEY);\n      const list = raw ? JSON.parse(raw) : [];\n      return new Set<string>((Array.isArray(list) ? list : []).flatMap((route: any) => Array.isArray(route?.orderIds) ? route.orderIds : []));\n    } catch {\n      return new Set<string>();\n    }\n  }, [preparedRouteRevision]);\n\n  const activeOrders = useMemo(() => orders.filter((o) => !['delivered', 'cancelled', 'failed'].includes(String(o.status))), [orders]);"
  );
}

s = s.replace(
  "  const waitingOrders = useMemo(() => activeOrders\n    .filter((o) => !o.assignedMotoboyId && !isRouteOrder(o))\n    .sort((a, b) => stamp(a) - stamp(b)), [activeOrders]);",
  "  const waitingOrders = useMemo(() => activeOrders\n    .filter((o) => !o.assignedMotoboyId && !isRouteOrder(o) && !preparedRouteOrderIds.has(o.id))\n    .sort((a, b) => stamp(a) - stamp(b)), [activeOrders, preparedRouteOrderIds]);"
);

s = s.replace(
  "    if (tab === 'queue') list = queue;\n    else if (tab === 'returning') list = returning;\n    else if (tab === 'delivering') list = delivering;",
  "    if (tab === 'overview') list = motoboys.filter((m) => ['available', 'delivering', 'returning_to_store'].includes(String(m.status)));\n    else if (tab === 'queue') list = queue;\n    else if (tab === 'returning') list = returning;\n    else if (tab === 'delivering') list = delivering;"
);

s = s.replace(
  "  }, [tab, queue, returning, delivering, selectedDriverId]);",
  "  }, [tab, queue, returning, delivering, motoboys, selectedDriverId]);"
);

s = s.replace(
  "    if (tab === 'orders') return filteredOrders;\n    if (tab === 'delivering') {",
  "    if (tab === 'overview') return activeOrders;\n    if (tab === 'orders') return filteredOrders;\n    if (tab === 'delivering') {"
);

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
  "  const tabs: Array<[SideTab, string, number]> = [\n    ['orders', 'Pedidos', waitingOrders.length],",
  "  const tabs: Array<[SideTab, string, number]> = [\n    ['overview', 'Visão geral', activeOrders.length],\n    ['orders', 'Pedidos', waitingOrders.length],"
);

s = s.replace(
  'Selecione os pedidos que deseja incluir na rota.',
  'Clique nos pedidos do mapa para incluir ou remover da rota.'
);

s = s.replace('{filteredOrders.map((o) => { const selected = selectedOrderIds.includes(o.id);', '{selectedOrders.map((o) => { const selected = true;');

s = s.replace(
  "      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));\n      window.dispatchEvent(new Event('storage'));",
  "      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));\n      window.dispatchEvent(new Event('storage'));\n      window.dispatchEvent(new Event('rotafacil-prepared-routes-changed'));\n      setPreparedRouteRevision((value) => value + 1);"
);

fs.writeFileSync(path, s);
console.log('[map-selection-fixes] overview + stable map + mounted-order filtering + modal lifecycle applied');
