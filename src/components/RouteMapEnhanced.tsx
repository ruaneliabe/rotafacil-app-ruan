import React, { useMemo, useState } from 'react';
import { Bike, MapPin, Package, Search } from 'lucide-react';
import { LocationPoint, Motoboy, Stop } from '../types';
import { RouteMap as BaseRouteMap } from '@/src/components/RouteMap';

type RouteMapProps = {
  origin: LocationPoint;
  stops: Stop[];
  selectedStopId?: string | null;
  onSelectStop?: (stop: Stop) => void;
  onUpdateStopStatus?: (stopId: string, status: Stop['status']) => void;
  motoboyName?: string;
  motoboyVehicle?: string;
  showMotoboyMarker?: boolean;
  motoboyLat?: number;
  motoboyLng?: number;
  motoboysList?: Motoboy[];
  selectedMotoboyId?: string | null;
  onSelectMotoboy?: (motoboyId: string | null) => void;
};

type MapView = 'all' | 'orders' | 'motoboys';
type DriverFilter = 'all' | 'available' | 'delivering' | 'returning_to_store';

const driverStatus = (m: Motoboy) => {
  if (m.status === 'available') return 'Disponível';
  if (m.status === 'delivering') return 'Em rota';
  if (m.status === 'returning_to_store') return 'Voltando';
  if (m.status === 'busy') return 'Pausado';
  return 'Offline';
};

const driverStatusClass = (m: Motoboy) => {
  if (m.status === 'available') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (m.status === 'delivering') return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  if (m.status === 'returning_to_store') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-slate-800 text-slate-400 border-slate-700';
};

export const RouteMap: React.FC<RouteMapProps> = (props) => {
  const {
    stops = [],
    motoboysList = [],
    selectedStopId,
    selectedMotoboyId,
    onSelectStop,
    onSelectMotoboy,
  } = props;

  // A tela grande do StoreDashboard passa callbacks de seleção de pedido e motoboy.
  // Os mapas compactos continuam usando o componente original sem painel adicional.
  const isDedicatedDispatchMap = Boolean(onSelectStop && onSelectMotoboy);
  const [view, setView] = useState<MapView>('all');
  const [driverFilter, setDriverFilter] = useState<DriverFilter>('all');
  const [query, setQuery] = useState('');

  const activeDrivers = useMemo(
    () => motoboysList.filter((m) => m.status !== 'offline'),
    [motoboysList]
  );

  const filteredDrivers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeDrivers.filter((m) => {
      if (driverFilter !== 'all' && m.status !== driverFilter) return false;
      if (!q) return true;
      return `${m.name} ${m.vehicleModel || ''} ${m.plate || ''}`.toLowerCase().includes(q);
    });
  }, [activeDrivers, driverFilter, query]);

  const filteredStops = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stops.filter((stop) => {
      if (!q) return true;
      return `${stop.codeNumber || ''} ${stop.title || ''} ${stop.recipientName || ''} ${stop.address || ''} ${stop.neighborhood || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [stops, query]);

  if (!isDedicatedDispatchMap) {
    return <BaseRouteMap {...props} />;
  }

  const visibleDrivers = view === 'orders' ? [] : filteredDrivers;
  const visibleStops = view === 'motoboys' ? [] : filteredStops;

  const availableCount = activeDrivers.filter((m) => m.status === 'available').length;
  const deliveringCount = activeDrivers.filter((m) => m.status === 'delivering').length;
  const returningCount = activeDrivers.filter((m) => m.status === 'returning_to_store').length;

  return (
    <div className="w-full h-full min-h-[560px] bg-slate-950 flex flex-col overflow-hidden">
      <div className="shrink-0 p-3 border-b border-slate-800 bg-slate-950/95 space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {([
              ['all', `Todos (${stops.length + activeDrivers.length})`],
              ['orders', `Pedidos (${stops.length})`],
              ['motoboys', `Motoboys (${activeDrivers.length})`],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`px-3 py-1.5 rounded-lg border text-[11px] font-black transition-colors ${
                  view === id
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {id === 'orders' ? '📦' : id === 'motoboys' ? '🛵' : '◉'} {label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar pedido, cliente ou motoboy..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-white placeholder:text-slate-500 outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {view !== 'orders' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              ['all', 'Todos', activeDrivers.length],
              ['available', 'Disponíveis', availableCount],
              ['delivering', 'Em rota', deliveringCount],
              ['returning_to_store', 'Voltando', returningCount],
            ] as const).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDriverFilter(id)}
                className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${
                  driverFilter === id
                    ? 'bg-slate-800 border-violet-500/70 text-violet-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="relative min-h-[430px] border-r border-slate-800">
          <BaseRouteMap
            {...props}
            stops={visibleStops}
            motoboysList={visibleDrivers}
            selectedStopId={selectedStopId}
            selectedMotoboyId={selectedMotoboyId}
          />
          <div className="absolute left-3 bottom-3 z-[450] bg-slate-950/90 border border-slate-700 rounded-xl px-3 py-2 text-[9px] text-slate-300 backdrop-blur-md shadow-xl">
            <div className="font-black text-white mb-1.5">Legenda</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span>📍 Pedido</span>
              <span className="text-emerald-300">● Disponível</span>
              <span className="text-blue-300">● Em rota</span>
              <span className="text-amber-300">● Voltando</span>
            </div>
          </div>
        </div>

        <aside className="hidden xl:block bg-slate-900/95 min-h-0 overflow-y-auto p-3">
          {view !== 'motoboys' && (
            <section className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Package className="w-3.5 h-3.5 text-violet-400" />
                <h4 className="text-xs font-black text-white">Pedidos no mapa ({filteredStops.length})</h4>
              </div>
              <div className="space-y-2">
                {filteredStops.length === 0 && (
                  <div className="border border-dashed border-slate-800 rounded-lg p-4 text-center text-[10px] text-slate-500">
                    Nenhum pedido para este filtro.
                  </div>
                )}
                {filteredStops.slice(0, 12).map((stop) => (
                  <button
                    key={stop.id}
                    type="button"
                    onClick={() => onSelectStop?.(stop)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                      selectedStopId === stop.id
                        ? 'bg-violet-950/40 border-violet-500'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-xs text-white">#{stop.codeNumber || '—'}</strong>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        stop.status === 'in_transit'
                          ? 'bg-blue-500/15 text-blue-300'
                          : 'bg-rose-500/15 text-rose-300'
                      }`}>
                        {stop.status === 'in_transit' ? 'Em rota' : 'Aguardando'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300 mt-1 truncate">{stop.recipientName || stop.title}</p>
                    <p className="text-[9px] text-slate-500 mt-1 flex gap-1 items-start">
                      <MapPin className="w-3 h-3 shrink-0 text-rose-400" />
                      <span className="line-clamp-2">{stop.address}</span>
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {view !== 'orders' && (
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <Bike className="w-3.5 h-3.5 text-emerald-400" />
                <h4 className="text-xs font-black text-white">Entregadores ({filteredDrivers.length})</h4>
              </div>
              <div className="space-y-2">
                {filteredDrivers.length === 0 && (
                  <div className="border border-dashed border-slate-800 rounded-lg p-4 text-center text-[10px] text-slate-500">
                    Nenhum entregador neste status.
                  </div>
                )}
                {filteredDrivers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectMotoboy?.(m.id)}
                    className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border text-left ${
                      selectedMotoboyId === m.id
                        ? 'bg-violet-950/40 border-violet-500'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[11px] font-black text-slate-200 shrink-0">
                        {m.name?.charAt(0).toUpperCase() || 'M'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-white truncate">{m.name}</p>
                        <span className={`inline-flex mt-0.5 px-1.5 py-0.5 rounded border text-[9px] font-bold ${driverStatusClass(m)}`}>
                          {driverStatus(m)}
                        </span>
                      </div>
                    </div>
                    <span className="text-slate-600">›</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};
