import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bike, MapPin, Navigation, Package, Search, Store, UsersRound, X, Zap } from 'lucide-react';
import { Motoboy, Order, StoreShift, Stop } from '../types';
import ReactiveRouteMap from './ReactiveRouteMap';

interface Props {
  shift: StoreShift;
  orders: Order[];
  motoboys: Motoboy[];
  onAssignOrderToMotoboy: (orderId: string, motoboyId: string) => void;
  onConfirmArrivalAtStore?: (motoboyId: string) => void;
  onOpenNewOrderModal: () => void;
}

type MapMode = 'all' | 'unassigned' | 'route' | 'returning' | 'delivering' | 'available';

const distanceKm = (a?: number, b?: number, c?: number, d?: number) => {
  if (![a, b, c, d].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const rad = (n: number) => (n * Math.PI) / 180;
  const R = 6371;
  const dLat = rad(c! - a!);
  const dLng = rad(d! - b!);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a!)) * Math.cos(rad(c!)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
};

const orderCode = (o: Order) => o.displayCode || `#${o.codeNumber}`;
const isRouteOrder = (o: Order) => ['picked_up', 'in_transit', 'dispatched'].includes(String(o.status));

export const OperationManagementEnhancer: React.FC<Props> = ({
  shift,
  orders,
  motoboys,
  onAssignOrderToMotoboy,
  onOpenNewOrderModal,
}) => {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<MapMode>('all');
  const [driverSearch, setDriverSearch] = useState('');
  const [mapSearch, setMapSearch] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showOrders, setShowOrders] = useState(true);
  const [showDrivers, setShowDrivers] = useState(true);
  const [showStore, setShowStore] = useState(true);
  const legacyOverlayRef = useRef<HTMLElement | null>(null);
  const legacyCloseRef = useRef<HTMLButtonElement | null>(null);
  const suppressOpenRef = useRef(false);
  const mapShellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sync = () => {
      if (suppressOpenRef.current) return;
      const heading = Array.from(document.querySelectorAll('h3')).find(
        (el) => el.textContent?.trim() === 'Gestão de entrega' && !el.closest('[data-operation-enhanced-modal="true"]')
      ) as HTMLElement | undefined;
      if (!heading) return;
      const overlay = heading.closest('.fixed.inset-0') as HTMLElement | null;
      if (!overlay) return;
      legacyOverlayRef.current = overlay;
      legacyCloseRef.current = heading.parentElement?.querySelector('button') as HTMLButtonElement | null;
      overlay.style.display = 'none';
      setActive(true);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (legacyOverlayRef.current?.isConnected) legacyOverlayRef.current.style.display = '';
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const hideInternalMapOverlays = () => {
      const shell = mapShellRef.current;
      if (!shell) return;
      shell.querySelectorAll<HTMLElement>('div').forEach((el) => {
        const text = el.textContent?.trim() || '';
        if (
          (text.startsWith('Na loja (') && text.includes('Em rota (') && text.includes('Voltando (')) ||
          text.startsWith('Mapa pronto para a primeira entrega')
        ) el.style.display = 'none';
      });
    };
    hideInternalMapOverlays();
    const observer = new MutationObserver(hideInternalMapOverlays);
    if (mapShellRef.current) observer.observe(mapShellRef.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [active, mode]);

  const close = () => {
    if (suppressOpenRef.current) return;
    suppressOpenRef.current = true;
    const btn = legacyCloseRef.current;
    const overlay = legacyOverlayRef.current;
    if (overlay?.isConnected) overlay.style.display = 'none';
    btn?.click();
    setActive(false);
    window.setTimeout(() => {
      legacyOverlayRef.current = null;
      legacyCloseRef.current = null;
      suppressOpenRef.current = false;
    }, 250);
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active]);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  const activeOrders = useMemo(
    () => orders.filter((o) => !['delivered', 'cancelled', 'failed'].includes(String(o.status))),
    [orders]
  );

  const load = (id: string) => activeOrders.filter((o) => o.assignedMotoboyId === id).length;
  const available = useMemo(
    () => motoboys
      .filter((m) => m.status === 'available' && load(m.id) === 0)
      .sort((a, b) => (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0)),
    [motoboys, activeOrders]
  );
  const returning = useMemo(() => motoboys.filter((m) => m.status === 'returning_to_store'), [motoboys]);
  const delivering = useMemo(() => motoboys.filter((m) => m.status === 'delivering'), [motoboys]);
  const atStore = useMemo(() => motoboys.filter((m) => m.status === 'available'), [motoboys]);
  const waitingOrders = useMemo(() => activeOrders.filter((o) => !o.assignedMotoboyId), [activeOrders]);
  const routeOrders = useMemo(() => activeOrders.filter(isRouteOrder), [activeOrders]);

  const matchesDriverSearch = (m: Motoboy) => !driverSearch || m.name.toLowerCase().includes(driverSearch.toLowerCase());
  const queueFiltered = available.filter(matchesDriverSearch);
  const deliveringFiltered = delivering.filter(matchesDriverSearch);
  const returningFiltered = returning.filter(matchesDriverSearch);

  const visibleDrivers = useMemo(() => {
    if (!showDrivers || mode === 'unassigned' || mode === 'route') return [];
    const list = motoboys.filter((m) => {
      if (m.status === 'offline') return false;
      if (mode === 'returning' && m.status !== 'returning_to_store') return false;
      if (mode === 'delivering' && m.status !== 'delivering') return false;
      if (mode === 'available' && m.status !== 'available') return false;
      if (selectedDriverId && m.id !== selectedDriverId) return false;
      return true;
    });
    // No mapa mostramos apenas a moto, sem o nome permanente grudado no marcador.
    return list.map((m) => ({ ...m, name: '🛵' }));
  }, [motoboys, mode, selectedDriverId, showDrivers]);

  const visibleOrders = useMemo(() => {
    if (!showOrders || ['returning', 'available'].includes(mode)) return [];
    return activeOrders.filter((o) => {
      if (mode === 'unassigned' && o.assignedMotoboyId) return false;
      if (mode === 'route' && !isRouteOrder(o)) return false;
      if (mode === 'delivering') {
        const driverIds = new Set(delivering.map((m) => m.id));
        if (!o.assignedMotoboyId || !driverIds.has(o.assignedMotoboyId)) return false;
      }
      if (selectedDriverId && o.assignedMotoboyId !== selectedDriverId) return false;
      if (!mapSearch) return true;
      return `${orderCode(o)} ${o.clientName} ${o.address} ${o.neighborhood || ''}`.toLowerCase().includes(mapSearch.toLowerCase());
    });
  }, [activeOrders, mode, selectedDriverId, mapSearch, delivering, showOrders]);

  const stops: Stop[] = visibleOrders
    .filter((o) => typeof o.lat === 'number' && typeof o.lng === 'number')
    .map((o, i) => ({
      id: o.id,
      codeNumber: o.codeNumber,
      orderIndex: i + 1,
      title: `${orderCode(o)} - ${o.clientName}`,
      recipientName: o.clientName,
      address: o.address,
      neighborhood: o.neighborhood,
      lat: o.lat,
      lng: o.lng,
      status: isRouteOrder(o) ? 'in_transit' : 'pending',
      priority: 'medium',
      motoboyId: o.assignedMotoboyId || undefined,
      motoboyName: o.assignedMotoboyName || undefined,
    } as Stop));

  const eta = (m: Motoboy) => {
    const km = distanceKm(m.currentLat, m.currentLng, shift.storeLat, shift.storeLng);
    return km == null ? '~5 min' : `~${Math.max(2, Math.round((km / 25) * 60))} min`;
  };

  const assignFirst = (m: Motoboy) => {
    const order = waitingOrders[0];
    if (!order) return notify('Não há pedido aguardando atribuição.');
    onAssignOrderToMotoboy(order.id, m.id);
    notify(`${orderCode(order)} atribuído para ${m.name.split(' ')[0]}.`);
  };

  const recenter = () => {
    setMode('all');
    setSelectedDriverId(null);
    setMapSearch('');
    setShowOrders(true);
    setShowDrivers(true);
    setShowStore(true);
  };

  if (!active) return null;

  const metrics = [
    ['Disponíveis', available.length, 'Livres para novos pedidos', UsersRound, 'text-emerald-600 bg-emerald-50'],
    ['Em rota', routeOrders.length, 'Entregando agora', Bike, 'text-blue-600 bg-blue-50'],
    ['Voltando', returning.length, 'Retornando para a loja', Navigation, 'text-orange-600 bg-orange-50'],
    ['Na loja', atStore.length, 'Aguardando despacho', Store, 'text-violet-600 bg-violet-50'],
    ['Fila', waitingOrders.length, 'Pedidos para atribuir', Package, 'text-slate-600 bg-slate-100'],
  ] as const;

  const filterButtons: Array<[MapMode, string, number]> = [
    ['all', 'Todos', activeOrders.length],
    ['unassigned', 'Sem entregador', waitingOrders.length],
    ['route', 'Em rota', routeOrders.length],
    ['returning', 'Voltando', returning.length],
    ['delivering', 'Em entrega', delivering.length],
    ['available', 'Disponíveis', available.length],
  ];

  return createPortal(
    <div data-operation-enhanced-modal="true" className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-3 md:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      {toast && <div className="fixed right-5 top-5 z-[110] rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white shadow-2xl">{toast}</div>}

      <section className="flex h-[92vh] w-full max-w-[1540px] flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-[#FAF9F6] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-[20px] font-black tracking-tight text-slate-950">Gestão de entrega</h2>
            <p className="mt-1 text-xs text-slate-500">Acompanhe em tempo real os entregadores, gerencie a fila e despache pedidos de forma rápida.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[10px] text-slate-500 md:inline-flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />Atualizado agora</span>
            <button onClick={onOpenNewOrderModal} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-xs font-black text-white shadow-sm hover:bg-violet-500"><Zap className="h-4 w-4" />Novo despacho</button>
            <button onClick={close} title="Fechar gestão de entrega" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-white p-3 md:grid-cols-5">
          {metrics.map(([label, value, helper, Icon, cls]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${cls}`}><Icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-slate-700">{label}</span><strong className="text-xl leading-none text-slate-950">{value}</strong></div>
                  <p className="mt-1 truncate text-[9px] text-slate-400">{helper}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
          <label className="flex min-w-[250px] max-w-[330px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={mapSearch} onChange={(e) => setMapSearch(e.target.value)} placeholder="Buscar endereço no mapa..." className="w-full bg-transparent text-xs outline-none" />
          </label>
          {filterButtons.map(([id, label, count]) => (
            <button key={id} onClick={() => { setMode(id); setSelectedDriverId(null); }} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[11px] font-black transition ${mode === id ? 'border-violet-600 bg-violet-600 text-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`}>
              {id === 'unassigned' ? <Package className="h-3.5 w-3.5" /> : id === 'route' || id === 'delivering' ? <Bike className="h-3.5 w-3.5" /> : id === 'returning' ? <Navigation className="h-3.5 w-3.5" /> : id === 'available' ? <UsersRound className="h-3.5 w-3.5" /> : null}
              {label} <span className={mode === id ? 'text-white/80' : 'text-slate-400'}>({count})</span>
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div ref={mapShellRef} className="relative min-h-[430px] bg-slate-100 p-3">
            <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <ReactiveRouteMap
                origin={{ name: showStore ? (shift.storeName || 'Loja') : '', address: showStore ? (shift.storeAddress || '') : '', lat: shift.storeLat || -26.9194, lng: shift.storeLng || -49.0661 }}
                stops={stops}
                motoboysList={visibleDrivers}
                selectedMotoboyId={selectedDriverId}
                onSelectMotoboy={(id: string) => setSelectedDriverId(id)}
              />
            </div>

            <div className="absolute left-6 top-6 z-[60] w-[190px] overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur">
              <button onClick={() => setShowOrders((v) => !v)} className="flex w-full items-start gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50">
                <span className={`mt-0.5 grid h-4 w-4 place-items-center rounded border text-[9px] font-black ${showOrders ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>✓</span>
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-orange-500" />
                <div><div className="text-[11px] font-black text-slate-800">Pedidos</div><div className="text-[8px] text-slate-400">Endereço do cliente</div></div>
              </button>
              <button onClick={() => setShowDrivers((v) => !v)} className="flex w-full items-start gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50">
                <span className={`mt-0.5 grid h-4 w-4 place-items-center rounded border text-[9px] font-black ${showDrivers ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>✓</span>
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                <div><div className="text-[11px] font-black text-slate-800">Entregadores</div><div className="text-[8px] text-slate-400">Posição em tempo real</div></div>
              </button>
              <button onClick={() => setShowStore((v) => !v)} className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50">
                <span className={`mt-0.5 grid h-4 w-4 place-items-center rounded border text-[9px] font-black ${showStore ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>✓</span>
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-violet-600" />
                <div><div className="text-[11px] font-black text-slate-800">Loja</div><div className="max-w-[120px] truncate text-[8px] text-slate-400">{shift.storeName || 'Loja'}</div></div>
              </button>
            </div>

            <button onClick={recenter} className="absolute bottom-6 right-6 z-[60] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-black text-slate-600 shadow-lg hover:bg-slate-50">Recentralizar mapa</button>
          </div>

          <aside className="min-h-0 overflow-y-auto border-l border-slate-200 bg-white p-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input value={driverSearch} onChange={(e) => setDriverSearch(e.target.value)} placeholder="Buscar entregador ou pedido..." className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
            </div>

            <section className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3 py-2.5">
                <div className="flex items-center gap-2"><Package className="h-4 w-4 text-slate-500" /><h3 className="text-[11px] font-black text-slate-800">Próximos da fila ({queueFiltered.length})</h3></div>
                <span className="text-[9px] font-bold text-violet-600">Ordem de chegada</span>
              </div>
              <div className="divide-y divide-slate-100">
                {queueFiltered.slice(0, 6).map((m, i) => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-600">{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-black text-slate-900">{m.name}</div><div className="text-[9px] text-slate-500">Disponível{m.currentLat && shift.storeLat ? ` • ${distanceKm(m.currentLat, m.currentLng, shift.storeLat, shift.storeLng)?.toFixed(1)} km` : ''}</div></div>
                    <button onClick={() => assignFirst(m)} className="h-7 rounded-lg bg-violet-600 px-2.5 text-[9px] font-black text-white hover:bg-violet-500">Atribuir</button>
                  </div>
                ))}
                {!queueFiltered.length && <p className="px-4 py-4 text-center text-[10px] text-slate-400">Nenhum entregador disponível na fila.</p>}
              </div>
            </section>

            <section className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3 py-2.5">
                <div className="flex items-center gap-2"><Bike className="h-4 w-4 text-blue-600" /><h3 className="text-[11px] font-black text-slate-800">Motoboys em entrega ({delivering.length})</h3></div>
                <button onClick={() => setMode('delivering')} className="text-[9px] font-bold text-violet-600">Ver todos</button>
              </div>
              <div className="divide-y divide-slate-100">
                {deliveringFiltered.slice(0, 6).map((m) => {
                  const o = activeOrders.find((x) => x.assignedMotoboyId === m.id && isRouteOrder(x));
                  const km = o ? distanceKm(m.currentLat, m.currentLng, o.lat, o.lng) : null;
                  return (
                    <button key={m.id} onClick={() => setSelectedDriverId(m.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-sm text-white">🛵</span>
                      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><b className="truncate text-[11px] text-slate-800">{m.name}</b>{o && <span className="text-[9px] font-black text-slate-500">{orderCode(o)}</span>}</div><p className="mt-0.5 truncate text-[9px] text-slate-400">{o?.address || 'Entrega em andamento'}</p></div>
                      <div className="text-right"><span className="block text-[9px] font-black text-emerald-600">Em entrega</span>{km != null && <span className="text-[8px] text-slate-400">{km.toFixed(1)} km</span>}</div>
                    </button>
                  );
                })}
                {!deliveringFiltered.length && <p className="px-4 py-4 text-center text-[10px] text-slate-400">Nenhum motoboy em entrega agora.</p>}
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3 py-2.5">
                <div className="flex items-center gap-2"><Navigation className="h-4 w-4 text-orange-500" /><h3 className="text-[11px] font-black text-slate-800">Motoboys voltando ({returning.length})</h3></div>
                <button onClick={() => setMode('returning')} className="text-[9px] font-bold text-violet-600">Ver todos</button>
              </div>
              <div className="divide-y divide-slate-100">
                {returningFiltered.slice(0, 5).map((m) => (
                  <button key={m.id} onClick={() => setSelectedDriverId(m.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-orange-50 text-sm">🛵</span>
                    <div className="min-w-0 flex-1"><b className="block truncate text-[11px] text-slate-800">{m.name}</b><p className="mt-0.5 text-[9px] text-slate-400">Retornando para a loja • {eta(m)}</p></div>
                  </button>
                ))}
                {!returningFiltered.length && <p className="px-4 py-4 text-center text-[10px] text-slate-400">Nenhum entregador retornando no momento.</p>}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </div>,
    document.body
  );
};
