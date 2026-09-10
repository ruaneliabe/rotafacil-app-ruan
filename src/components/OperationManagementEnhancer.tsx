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

type MapMode = 'all' | 'orders' | 'drivers' | 'returning' | 'delivering';

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
    const hideBadMapOverlays = () => {
      const shell = mapShellRef.current;
      if (!shell) return;
      shell.querySelectorAll<HTMLElement>('div').forEach((el) => {
        const text = el.textContent?.trim() || '';
        if (
          (text.startsWith('Na loja (') && text.includes('Em rota (') && text.includes('Voltando (')) ||
          text.startsWith('Mapa pronto para a primeira entrega')
        ) {
          el.style.display = 'none';
        }
      });
    };
    hideBadMapOverlays();
    const observer = new MutationObserver(hideBadMapOverlays);
    if (mapShellRef.current) observer.observe(mapShellRef.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [active, mode]);

  const close = () => {
    if (suppressOpenRef.current) return;
    suppressOpenRef.current = true;
    const btn = legacyCloseRef.current;
    const overlay = legacyOverlayRef.current;

    // Important: keep the legacy modal hidden while we close its React state.
    // Unhiding it first caused the old management screen to flash/open again.
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
    () => motoboys.filter((m) => m.status === 'available' && load(m.id) === 0).sort((a, b) => (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0)),
    [motoboys, activeOrders]
  );
  const returning = useMemo(() => motoboys.filter((m) => m.status === 'returning_to_store'), [motoboys]);
  const delivering = useMemo(() => motoboys.filter((m) => m.status === 'delivering'), [motoboys]);
  const atStore = useMemo(() => motoboys.filter((m) => m.status === 'available'), [motoboys]);
  const waitingOrders = useMemo(() => activeOrders.filter((o) => !o.assignedMotoboyId), [activeOrders]);
  const queueFiltered = available.filter((m) => !driverSearch || m.name.toLowerCase().includes(driverSearch.toLowerCase()));

  const visibleDrivers = useMemo(() => motoboys.filter((m) => {
    if (m.status === 'offline') return false;
    if (mode === 'orders') return false;
    if (mode === 'returning' && m.status !== 'returning_to_store') return false;
    if (mode === 'delivering' && m.status !== 'delivering') return false;
    if (selectedDriverId && m.id !== selectedDriverId) return false;
    return true;
  }), [motoboys, mode, selectedDriverId]);

  const visibleOrders = useMemo(() => activeOrders.filter((o) => {
    if (mode === 'drivers' || mode === 'returning') return false;
    if (mode === 'delivering') {
      const driverIds = new Set(delivering.map((m) => m.id));
      if (!o.assignedMotoboyId || !driverIds.has(o.assignedMotoboyId)) return false;
    }
    if (selectedDriverId && o.assignedMotoboyId !== selectedDriverId) return false;
    if (!mapSearch) return true;
    return `${orderCode(o)} ${o.clientName} ${o.address} ${o.neighborhood || ''}`.toLowerCase().includes(mapSearch.toLowerCase());
  }), [activeOrders, mode, selectedDriverId, mapSearch, delivering]);

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
      status: ['picked_up', 'in_transit', 'dispatched'].includes(String(o.status)) ? 'in_transit' : 'pending',
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

  if (!active) return null;

  const metrics = [
    ['Disponíveis', available.length, 'Livres para novos pedidos', UsersRound, 'text-emerald-600 bg-emerald-50'],
    ['Em rota', delivering.length, 'Entregando agora', Bike, 'text-blue-600 bg-blue-50'],
    ['Voltando', returning.length, 'Retornando para a loja', Navigation, 'text-orange-600 bg-orange-50'],
    ['Na loja', atStore.length, 'Aguardando despacho', Store, 'text-violet-600 bg-violet-50'],
    ['Fila', waitingOrders.length, 'Pedidos para atribuir', Package, 'text-slate-600 bg-slate-100'],
  ] as const;

  const filterButtons: Array<[MapMode, string, number | null]> = [
    ['all', 'Todos', null],
    ['orders', 'Pedidos', activeOrders.length],
    ['drivers', 'Entregadores', motoboys.filter((m) => m.status !== 'offline').length],
    ['returning', 'Retornando', returning.length],
    ['delivering', 'Em rota', delivering.length],
  ];

  return createPortal(
    <div data-operation-enhanced-modal="true" className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-3 md:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      {toast && <div className="fixed right-5 top-5 z-[110] rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white shadow-2xl">{toast}</div>}
      <section className="flex h-[92vh] w-full max-w-[1540px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#FAF9F6] shadow-2xl">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div><h2 className="text-xl font-black tracking-tight text-slate-950">Gestão de entrega</h2><p className="mt-1 text-xs text-slate-500">Acompanhe em tempo real os entregadores, gerencie a fila e despache pedidos de forma rápida.</p></div>
          <div className="flex items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" />Atualizado agora</span>
            <button onClick={onOpenNewOrderModal} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-[11px] font-black text-white hover:bg-violet-500"><Zap className="h-3.5 w-3.5" />Novo despacho</button>
            <button onClick={close} title="Fechar gestão de entrega" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-5">
          {metrics.map(([label, value, helper, Icon, cls]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center gap-2"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${cls}`}><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-4"><span className="text-xs font-black text-slate-700">{label}</span><strong className="text-xl text-slate-950">{value}</strong></div><p className="mt-0.5 text-[10px] text-slate-500">{helper}</p></div></div></div>)}
        </div>

        <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div ref={mapShellRef} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex flex-col gap-2 border-b border-slate-200 bg-white p-3 xl:flex-row xl:items-center xl:justify-between">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input value={mapSearch} onChange={(e) => setMapSearch(e.target.value)} placeholder="Buscar endereço no mapa..." className="w-full bg-transparent text-xs outline-none" /></label>
              <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
                {filterButtons.map(([id, label, count]) => <button key={id} onClick={() => { setMode(id); setSelectedDriverId(null); }} className={`rounded-md px-2.5 py-1.5 text-[10px] font-black transition ${mode === id ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white hover:text-slate-800'}`}>{label}{count !== null ? ` (${count})` : ''}</button>)}
              </div>
            </div>
            <div className="h-full min-h-[520px] w-full">
              <ReactiveRouteMap origin={{ name: shift.storeName || 'Loja', address: shift.storeAddress || '', lat: shift.storeLat || -26.9194, lng: shift.storeLng || -49.0661 }} stops={stops} motoboysList={visibleDrivers} selectedMotoboyId={selectedDriverId} onSelectMotoboy={(id: string) => setSelectedDriverId(id)} />
            </div>
          </div>

          <aside className="min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-3"><label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input value={driverSearch} onChange={(e) => setDriverSearch(e.target.value)} placeholder="Buscar entregador por nome..." className="w-full bg-transparent text-xs outline-none" /></label></div>

            <div className="border-b border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-2 text-xs font-black text-slate-900"><UsersRound className="h-4 w-4 text-violet-600" />Próximos da fila ({queueFiltered.length})</h3><span className="text-[10px] font-bold text-violet-600">Ordem de chegada</span></div>
              <div className="divide-y divide-slate-100">{queueFiltered.slice(0, 6).map((m, i) => <div key={m.id} className="flex items-center gap-2 py-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-600">{String(i + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><div className="truncate text-xs font-black text-slate-900">{m.name}</div><div className="text-[10px] text-slate-500">Disponível{m.currentLat && shift.storeLat ? ` • ${distanceKm(m.currentLat, m.currentLng, shift.storeLat, shift.storeLng)?.toFixed(1)} km` : ''}</div></div><button onClick={() => assignFirst(m)} className="h-8 rounded-lg bg-violet-600 px-3 text-[10px] font-black text-white hover:bg-violet-500">Atribuir</button></div>)}</div>
            </div>

            <div className="border-b border-slate-200 p-3">
              <div className="mb-2"><h3 className="flex items-center gap-2 text-xs font-black text-slate-900"><Navigation className="h-4 w-4 text-orange-500" />Retornando para a loja ({returning.length})</h3></div>
              <div className="divide-y divide-slate-100">{returning.slice(0, 5).map((m) => <div key={m.id} className="flex items-center gap-2 py-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /><div className="min-w-0 flex-1"><div className="text-xs font-black text-slate-900">{m.name}</div><div className="text-[10px] text-orange-600">Voltando • {eta(m)}</div></div><button onClick={() => notify(`${m.name.split(' ')[0]} chamado para o balcão.`)} className="h-8 whitespace-nowrap rounded-lg border border-violet-200 bg-violet-50 px-2.5 text-[10px] font-black text-violet-700 hover:bg-violet-100">Chamar balcão</button><button onClick={() => setSelectedDriverId(m.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500"><MapPin className="h-3.5 w-3.5" /></button></div>)}</div>
              {returning.length === 0 && <p className="py-2 text-[11px] text-slate-400">Nenhum entregador retornando agora.</p>}
            </div>

            <div className="p-3">
              <div className="mb-2"><h3 className="flex items-center gap-2 text-xs font-black text-slate-900"><Bike className="h-4 w-4 text-blue-500" />Em rota ({delivering.length})</h3></div>
              <div className="divide-y divide-slate-100">{delivering.slice(0, 6).map((m) => { const o = activeOrders.find((x) => x.assignedMotoboyId === m.id); const km = o ? distanceKm(m.currentLat, m.currentLng, o.lat, o.lng) : null; return <button key={m.id} onClick={() => setSelectedDriverId(m.id)} className="flex w-full items-center gap-2 py-2 text-left"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /><div className="min-w-0 flex-1"><div className="text-xs font-black text-slate-900">{m.name}</div><div className="truncate text-[10px] text-slate-500">{o ? `Entregando ${orderCode(o)}` : 'Em rota'}</div></div><span className="text-[10px] font-bold text-slate-500">{km != null ? `${km.toFixed(1)} km` : ''}</span></button>; })}</div>
              {delivering.length === 0 && <p className="py-2 text-[11px] text-slate-400">Nenhum entregador em rota agora.</p>}
            </div>
          </aside>
        </div>
      </section>
    </div>,
    document.body
  );
};
