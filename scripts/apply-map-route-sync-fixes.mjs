import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after === before) {
    console.log(`[map-route-sync] ${path}: already patched or no-op`);
    return;
  }
  fs.writeFileSync(path, after);
  console.log(`[map-route-sync] ${path}: updated`);
};

// Permite destacar vários pedidos selecionados sem focar/zoomar o mapa em cada clique.
patch('src/components/RouteMap.tsx', (input) => {
  let s = input;

  if (!s.includes('selectedStopIds?: string[];')) {
    s = s.replace(
      '  selectedStopId?: string | null;\n',
      '  selectedStopId?: string | null;\n  selectedStopIds?: string[];\n'
    );
  }

  if (!s.includes('selectedStopIds = [],')) {
    s = s.replace(
      '  selectedStopId,\n  onSelectStop,',
      '  selectedStopId,\n  selectedStopIds = [],\n  onSelectStop,'
    );
  }

  s = s.replace(
    '      const isSelected = stop.id === selectedStopId;',
    '      const isSelected = stop.id === selectedStopId || selectedStopIds.includes(stop.id);'
  );

  s = s.replace(
    "      const ringClass = isSelected ? 'ring-4 ring-amber-400 scale-125 z-40' : '';",
    "      const ringClass = isSelected ? 'ring-4 ring-violet-400 ring-offset-2 ring-offset-slate-950 scale-110 z-40' : '';"
  );

  // Em seleção múltipla queremos apenas destaque visual; popup automático faria o mapa parecer pular.
  s = s.replace(
    '      if (isSelected) {\n        setTimeout(() => {',
    '      if (isSelected && selectedStopId) {\n        setTimeout(() => {'
  );

  s = s.replace(
    '  }, [origin, stops, selectedStopId, motoboysList, showMotoboyMarker, motoboyLat, motoboyLng, selectedMotoboyId]);',
    "  }, [origin, stops, selectedStopId, selectedStopIds.join('|'), motoboysList, showMotoboyMarker, motoboyLat, motoboyLng, selectedMotoboyId]);"
  );

  return s;
});

patch('src/components/ReactiveRouteMap.tsx', (input) => {
  let s = input;

  if (!s.includes('selectedStopIds?: string[];')) {
    s = s.replace(
      '  selectedStopId?: string | null;\n',
      '  selectedStopId?: string | null;\n  selectedStopIds?: string[];\n'
    );
  }

  s = s.replace(
    '  const { origin, stops = [], selectedStopId } = props;',
    '  const { origin, stops = [], selectedStopId, selectedStopIds = [] } = props;'
  );

  s = s.replace(
    '      if (selectedStopId && stop?.id === selectedStopId) return true;',
    '      if ((selectedStopId && stop?.id === selectedStopId) || selectedStopIds.includes(stop?.id)) return true;'
  );

  s = s.replace(
    '  }, [stops, selectedStopId, originLat, originLng]);',
    "  }, [stops, selectedStopId, selectedStopIds.join('|'), originLat, originLng]);"
  );

  return s;
});

// A Gestão de entrega manda todos os IDs selecionados para o mapa, sem usar selectedStopId.
// Assim o mapa não recentraliza nem dá zoom, só pinta os marcadores selecionados.
patch('src/components/OperationManagementEnhancer.tsx', (input) => {
  let s = input;

  const oldMap = "<ReactiveRouteMap origin={{ name: shift.storeName || 'Loja', address: shift.storeAddress || '', lat: shift.storeLat || -26.9194, lng: shift.storeLng || -49.0661 }} stops={stops} onSelectStop={(stop: Stop) => { if (tab !== 'orders') return; setSelectedOrderIds((current) => current.includes(stop.id) ? current.filter((id) => id !== stop.id) : [...current, stop.id]); }} motoboysList={visibleDrivers} selectedMotoboyId={selectedDriverId} onSelectMotoboy={(id: string) => setSelectedDriverId(id)} />";
  const newMap = "<ReactiveRouteMap origin={{ name: shift.storeName || 'Loja', address: shift.storeAddress || '', lat: shift.storeLat || -26.9194, lng: shift.storeLng || -49.0661 }} stops={stops} selectedStopIds={selectedOrderIds} onSelectStop={(stop: Stop) => { if (tab !== 'orders') return; setSelectedOrderIds((current) => current.includes(stop.id) ? current.filter((id) => id !== stop.id) : [...current, stop.id]); }} motoboysList={visibleDrivers} selectedMotoboyId={selectedDriverId} onSelectMotoboy={(id: string) => setSelectedDriverId(id)} />";
  s = s.replace(oldMap, newMap);

  // Garante notificação para o dashboard principal imediatamente após montar a rota.
  s = s.replace(
    "      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));\n      window.dispatchEvent(new Event('storage'));\n      notify(",
    "      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));\n      window.dispatchEvent(new Event('storage'));\n      window.dispatchEvent(new Event('rotafacil-prepared-routes-changed'));\n      notify("
  );

  return s;
});

// O quadro principal de Rotas montadas precisa reagir a rotas criadas pelo modal/mapa
// no mesmo instante, sem exigir F5 ou outra ação para rerenderizar.
patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  if (!s.includes('rotafacil-prepared-routes-changed')) {
    const anchor = "  useEffect(() => {\n    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preparedRoutes)); } catch {}\n  }, [preparedRoutes]);";
    const replacement = `${anchor}\n\n  useEffect(() => {\n    const syncPreparedRoutes = () => {\n      try {\n        const raw = window.localStorage.getItem(STORAGE_KEY);\n        const parsed = raw ? JSON.parse(raw) : [];\n        if (Array.isArray(parsed)) setPreparedRoutes(parsed);\n      } catch {}\n    };\n    window.addEventListener('rotafacil-prepared-routes-changed', syncPreparedRoutes);\n    window.addEventListener('storage', syncPreparedRoutes);\n    return () => {\n      window.removeEventListener('rotafacil-prepared-routes-changed', syncPreparedRoutes);\n      window.removeEventListener('storage', syncPreparedRoutes);\n    };\n  }, []);`;
    s = s.replace(anchor, replacement);
  }

  return s;
});

console.log('[map-route-sync] selection highlight + prepared route sync applied');
