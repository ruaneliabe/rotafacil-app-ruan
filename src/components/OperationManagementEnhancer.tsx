import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bike, CheckCircle2, Clock3, MapPin, Navigation, Package, Search, Store, UsersRound, Zap } from 'lucide-react';
import { Motoboy, Order, StoreShift, Stop } from '../types';
import ReactiveRouteMap from './ReactiveRouteMap';

interface Props {
  shift: StoreShift;
  orders: Order[];
  motoboys: Motoboy[];
  onAssignOrderToMotoboy: (orderId: string, motoboyId: string) => void;
  onAssignBatchToMotoboy?: (orderIds: string[], motoboyId: string) => void;
  onConfirmArrivalAtStore?: (motoboyId: string) => void;
  onOpenNewOrderModal: () => void;
}

type MapMode = 'all' | 'orders' | 'drivers';

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
  onConfirmArrivalAtStore,
  onOpenNewOrderModal,
}) => {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const legacyRef = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<MapMode>('all');
  const [driverSearch, setDriverSearch] = useState('');
  const [mapSearch, setMapSearch] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const cleanup = () => {
      if (legacyRef.current) legacyRef.current.style.display = '';
      document.querySelector<HTMLElement>('[data-operation-panel-host="true"]')?.remove();
      legacyRef.current = null;
      setHost(null);
    };

    const sync = () => {
      const heading = Array.from(document.querySelectorAll('h2')).find((el) => el.textContent?.trim() === 'Pedidos' && !el.closest('[data-operation-panel-root="true"]')) as HTMLElement | undefined;
      if (!heading) return;
      const legacy = heading.closest('div.space-y-4') as HTMLElement | null;
      const parent = legacy?.parentElement;
      if (!legacy || !parent) return;
      if (legacyRef.current && legacyRef.current !== legacy) cleanup();
      legacyRef.current = legacy;
      legacy.style.display = 'none';
      let portal = parent.querySelector<HTMLElement>(':scope > [data-operation-panel-host="true"]');
      if (!portal) {
        portal = document.createElement('div');
        portal.dataset.operationPanelHost = 'true';
        portal.className = 'w-full';
        parent.insertBefore(portal, legacy);
      }
      setHost(portal);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); cleanup(); };
  }, []);

  const notify = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 2400); };
  const activeOrders = useMemo(() => orders.filter((o) => !['delivered', 'cancelled', 'failed'].includes(String(o.status))), [orders]);
  const load = (id: string) => activeOrders.filter((o) => o.assignedMotoboyId === id).length;
  const available = useMemo(() => motoboys.filter((m) => m.status === 'available' && load(m.id) === 0).sort((a, b) => (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0)), [motoboys, activeOrders]);
  const returning = useMemo(() => motoboys.filter((m) => m.status === 'returning_to_store'), [motoboys]);
  const delivering = useMemo(() => motoboys.filter((m) => m.status === 'delivering'), [motoboys]);
  const atStore = useMemo(() => motoboys.filter((m) => m.status === 'available'), [motoboys]);
  const waitingOrders = useMemo(() => activeOrders.filter((o) => !o.assignedMotoboyId), [activeOrders]);

  const queueFiltered = available.filter((m) => !driverSearch || m.name.toLowerCase().includes(driverSearch.toLowerCase()));

  const visibleOrders = useMemo(() => activeOrders.filter((o) => {
    if (mode === 'drivers') return false;
    if (selectedDriverId && o.assignedMotoboyId !== selectedDriverId) return false;
    if (!mapSearch) return true;
    return `${orderCode(o)} ${o.clientName} ${o.address} ${o.neighborhood || ''}`.toLowerCase().includes(mapSearch.toLowerCase());
  }), [activeOrders, mode, selectedDriverId, mapSearch]);

  const visibleDrivers = useMemo(() => motoboys.filter((m) => {
    if (mode === 'orders') return false;
    if (m.status === 'offline') return false;
    if (selectedDriverId && m.id !== selectedDriverId) return false;
    return true;
  }), [motoboys, mode, selectedDriverId]);

  const stops: Stop[] = visibleOrders.filter((o) => typeof o.lat === 'number' && typeof o.lng === 'number').map((o, i) => ({
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

  if (!host) return null;

  const metrics = [
    ['Disponíveis', available.length, 'Livres para novos pedidos', UsersRound, 'text-emerald-600 bg-emerald-50'],
    ['Em rota', delivering.length, 'Entregando agora', Bike, 'text-blue-600 bg-blue-50'],
    ['Voltando', returning.length, 'Retornando para a loja', Navigation, 'text-orange-600 bg-orange-50'],
    ['Na loja', atStore.length, 'Aguardando despacho', Store, 'text-violet-600 bg-violet-50'],
    ['Fila', waitingOrders.length, 'Pedidos para atribuir', Package, 'text-slate-600 bg-slate-100'],
  ] as const;

  return createPortal(
    <section data-operation-panel-root="true" className="space-y-4">
      {toast && <div className="fixed right-5 top-5 z-[100] rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white shadow-2xl">{toast}</div>}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div><h2 className="text-xl font-black tracking-tight text-slate-950">Gestão de entrega</h2><p className="mt-1 text-xs text-slate-500">Acompanhe em tempo real os entregadores, gerencie a fila e despache pedidos de forma rápida.</p></div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Atualizado agora</span><button onClick={onOpenNewOrderModal} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2.5 text-xs font-black text-white hover:bg-violet-500"><Zap className="h-4 w-4" />Novo despacho</button></div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-4 md:grid-cols-3 xl:grid-cols-5">
          {metrics.map(([label, value, helper, Icon, cls]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center gap-2"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${cls}`}><Icon className="h-4 w-4" /></span><div className="min-w-0"><div className="flex items-center justify-between gap-4"><span className="text-xs font-black text-slate-700">{label}</span><strong className="text-xl text-slate-950">{value}</strong></div><p className="mt-0.5 text-[10px] text-slate-500">{helper}</p></div></div></div>)}
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex flex-col gap-2 border-b border-slate-200 bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input value={mapSearch} onChange={(e) => setMapSearch(e.target.value)} placeholder="Buscar endereço no mapa..." className="w-full bg-transparent text-xs outline-none" /></label>
              <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">{(['all','orders','drivers'] as MapMode[]).map((m) => <button key={m} onClick={() => { setMode(m); setSelectedDriverId(null); }} className={`rounded-md px-3 py-1.5 text-[11px] font-black ${mode === m ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}>{m === 'all' ? 'Todos' : m === 'orders' ? 'Pedidos' : 'Entregadores'}</button>)}</div>
            </div>
            <div className="h-[590px] w-full">
              <ReactiveRouteMap origin={{ name: shift.storeName || 'Loja', address: shift.storeAddress || '', lat: shift.storeLat || -26.9194, lng: shift.storeLng || -49.0661 }} stops={stops} motoboysList={visibleDrivers} selectedMotoboyId={selectedDriverId} onSelectMotoboy={(id: string) => setSelectedDriverId(id)} />
            </div>
          </div>

          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-3"><label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input value={driverSearch} onChange={(e) => setDriverSearch(e.target.value)} placeholder="Buscar entregador por nome..." className="w-full bg-transparent text-xs outline-none" /></label></div>

            <div className="border-b border-slate-200 p-3"><div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-2 text-xs font-black text-slate-900"><UsersRound className="h-4 w-4 text-violet-600" />Próximos da fila ({queueFiltered.length})</h3><span className="text-[10px] font-bold text-violet-600">Ordem de chegada</span></div><div className="divide-y divide-slate-100">{queueFiltered.slice(0, 5).map((m, i) => <div key={m.id} className="flex items-center gap-2 py-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-600">{String(i + 1).padStart(2,'0')}</span><div className="min-w-0 flex-1"><div className="truncate text-xs font-black text-slate-900">{m.name}</div><div className="text-[10px] text-slate-500">Disponível{m.currentLat && shift.storeLat ? ` • ${distanceKm(m.currentLat,m.currentLng,shift.storeLat,shift.storeLng)?.toFixed(1)} km` : ''}</div></div><button onClick={() => assignFirst(m)} className="rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-black text-white hover:bg-violet-500">Atribuir</button></div>)}</div></div>

            <div className="border-b border-slate-200 p-3"><div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-2 text-xs font-black text-slate-900"><Navigation className="h-4 w-4 text-orange-500" />Retornando para a loja ({returning.length})</h3></div><div className="divide-y divide-slate-100">{returning.slice(0, 4).map((m) => <div key={m.id} className="flex items-center gap-2 py-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /><div className="min-w-0 flex-1"><div className="text-xs font-black text-slate-900">{m.name}</div><div className="text-[10px] text-orange-600">Voltando • {eta(m)}</div></div><button onClick={() => notify(`${m.name.split(' ')[0]} chamado para o balcão.`)} className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-black text-violet-700">Chamar balcão</button><button onClick={() => setSelectedDriverId(m.id)} className="rounded-lg border border-slate-200 p-2 text-slate-500"><MapPin className="h-3.5 w-3.5" /></button></div>)}</div>{returning.length === 0 && <p className="py-2 text-[11px] text-slate-400">Nenhum entregador retornando agora.</p>}</div>

            <div className="p-3"><div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-2 text-xs font-black text-slate-900"><Bike className="h-4 w-4 text-blue-500" />Em rota ({delivering.length})</h3></div><div className="divide-y divide-slate-100">{delivering.slice(0, 5).map((m) => { const o = activeOrders.find((x) => x.assignedMotoboyId === m.id); const km = o ? distanceKm(m.currentLat,m.currentLng,o.lat,o.lng) : null; return <button key={m.id} onClick={() => setSelectedDriverId(m.id)} className="flex w-full items-center gap-2 py-2 text-left"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /><div className="min-w-0 flex-1"><div className="text-xs font-black text-slate-900">{m.name}</div><div className="truncate text-[10px] text-slate-500">{o ? `Entregando ${orderCode(o)}` : 'Em rota'}</div></div><span className="text-[10px] font-bold text-slate-600">{km == null ? '—' : `${km.toFixed(1)} km`}</span></button>; })}</div>{delivering.length === 0 && <p className="py-2 text-[11px] text-slate-400">Nenhum entregador em rota agora.</p>}</div>
          </aside>
        </div>
      </div>
    </section>, host
  );
};
