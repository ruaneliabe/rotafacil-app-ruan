import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bike, CheckCircle2, Clock3, MapPin, Navigation, Package, Route, Search, UsersRound, X, Zap } from 'lucide-react';
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

type SideTab = 'orders' | 'queue' | 'returning' | 'delivering';

const STORAGE_KEY = 'rotafacil_prepared_routes_preview_v2';
const orderCode = (o: Order) => o.displayCode || `#${o.codeNumber}`;
const isRouteOrder = (o: Order) => ['picked_up', 'in_transit', 'dispatched'].includes(String(o.status));
const isReady = (o: Order) => o.status === 'ready_at_counter';
const stamp = (o: Order) => Number(o.createdTimestamp) || Date.now();
const minsSince = (value?: number) => Math.max(0, Math.floor((Date.now() - (Number(value) || Date.now())) / 60000));
const distanceKm = (a?: number, b?: number, c?: number, d?: number) => {
  if (![a, b, c, d].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const rad = (n: number) => (n * Math.PI) / 180;
  const R = 6371;
  const dLat = rad(c! - a!);
  const dLng = rad(d! - b!);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a!)) * Math.cos(rad(c!)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
};

export const OperationManagementEnhancer: React.FC<Props> = ({ shift, orders, motoboys, onOpenNewOrderModal }) => {
  const [active, setActive] = useState(false);
  const [tab, setTab] = useState<SideTab>('orders');
  const [search, setSearch] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const legacyOverlayRef = useRef<HTMLElement | null>(null);
  const legacyCloseRef = useRef<HTMLButtonElement | null>(null);
  const suppressOpenRef = useRef(false);

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
    return () => observer.disconnect();
  }, []);

  const close = () => {
    suppressOpenRef.current = true;
    if (legacyOverlayRef.current?.isConnected) legacyOverlayRef.current.style.display = 'none';
    legacyCloseRef.current?.click();
    setActive(false);
    window.setTimeout(() => { suppressOpenRef.current = false; }, 250);
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const activeOrders = useMemo(() => orders.filter((o) => !['delivered', 'cancelled', 'failed'].includes(String(o.status))), [orders]);
  const load = (id: string) => activeOrders.filter((o) => o.assignedMotoboyId === id && !['delivered', 'cancelled'].includes(String(o.status))).length;
  const queue = useMemo(() => motoboys
    .filter((m) => m.status === 'available' && load(m.id) === 0)
    .sort((a, b) => Number(a.joinedQueueAt || Number.MAX_SAFE_INTEGER) - Number(b.joinedQueueAt || Number.MAX_SAFE_INTEGER)), [motoboys, activeOrders]);
  const returning = useMemo(() => motoboys.filter((m) => m.status === 'returning_to_store'), [motoboys]);
  const delivering = useMemo(() => motoboys.filter((m) => m.status === 'delivering'), [motoboys]);
  const waitingOrders = useMemo(() => activeOrders
    .filter((o) => !o.assignedMotoboyId && !isRouteOrder(o))
    .sort((a, b) => stamp(a) - stamp(b)), [activeOrders]);

  const filteredOrders = useMemo(() => waitingOrders.filter((o) => !search || `${orderCode(o)} ${o.clientName} ${o.address} ${o.neighborhood || ''}`.toLowerCase().includes(search.toLowerCase())), [waitingOrders, search]);

  useEffect(() => {
    const valid = new Set(waitingOrders.map((o) => o.id));
    setSelectedOrderIds((current) => current.filter((id) => valid.has(id)));
  }, [waitingOrders]);

  const visibleDrivers = useMemo(() => {
    let list: Motoboy[] = [];
    if (tab === 'queue') list = queue;
    else if (tab === 'returning') list = returning;
    else if (tab === 'delivering') list = delivering;
    if (selectedDriverId) list = list.filter((m) => m.id === selectedDriverId);
    return list.map((m) => ({ ...m, name: '🛵' }));
  }, [tab, queue, returning, delivering, selectedDriverId]);

  const mapOrders = useMemo(() => {
    if (tab === 'orders') return filteredOrders;
    if (tab === 'delivering') {
      const driverIds = new Set(delivering.map((m) => m.id));
      return activeOrders.filter((o) => o.assignedMotoboyId && driverIds.has(o.assignedMotoboyId));
    }
    return [];
  }, [tab, filteredOrders, delivering, activeOrders]);

  const stops: Stop[] = mapOrders
    .filter((o) => typeof o.lat === 'number' && typeof o.lng === 'number')
    .map((o, index) => ({
      id: o.id,
      codeNumber: o.codeNumber,
      orderIndex: index + 1,
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

  const selectedOrders = selectedOrderIds.map((id) => waitingOrders.find((o) => o.id === id)).filter(Boolean) as Order[];
  const selectedDistance = useMemo(() => {
    if (!selectedOrders.length) return null;
    let total = 0;
    let lat = shift.storeLat;
    let lng = shift.storeLng;
    for (const order of selectedOrders) {
      const km = distanceKm(lat, lng, order.lat, order.lng);
      if (km != null) total += km;
      lat = order.lat;
      lng = order.lng;
    }
    return total || null;
  }, [selectedOrders, shift.storeLat, shift.storeLng]);

  const createRoute = () => {
    if (!selectedOrders.length) return;
    const neighborhoods = Array.from(new Set(selectedOrders.map((o) => o.neighborhood).filter(Boolean) as string[]));
    const corridorName = neighborhoods.length ? neighborhoods.slice(0, 2).join(' / ') : selectedOrders.map(orderCode).slice(0, 2).join(' + ');
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const current = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(current) ? current : [];
      list.push({
        id: `map_${Date.now()}`,
        orderIds: selectedOrders.map((o) => o.id),
        corridorName,
        confidenceScore: selectedOrders.length === 1 ? 100 : 88,
        createdAt: Date.now(),
      });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new Event('storage'));
      notify(selectedOrders.length === 1 ? 'Saída individual montada.' : `Rota montada com ${selectedOrders.length} pedidos.`);
      setSelectedOrderIds([]);
    } catch {
      notify('Não foi possível montar a rota.');
    }
  };

  const eta = (m: Motoboy) => {
    const km = distanceKm(m.currentLat, m.currentLng, shift.storeLat, shift.storeLng);
    return km == null ? '~5 min' : `~${Math.max(2, Math.round((km / 25) * 60))} min`;
  };

  if (!active) return null;

  const tabs: Array<[SideTab, string, number]> = [
    ['orders', 'Pedidos', waitingOrders.length],
    ['queue', 'Motoboys na fila', queue.length],
    ['returning', 'Voltando', returning.length],
    ['delivering', 'Em entrega', delivering.length],
  ];

  return createPortal(
    <div data-operation-enhanced-modal="true" className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-3 md:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      {toast && <div className="fixed right-5 top-5 z-[110] rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white shadow-2xl">{toast}</div>}
      <section className="flex h-[94vh] w-full max-w-[1580px] flex-col overflow-hidden rounded-[22px] border border-slate-700 bg-[#0b1018] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div><div className="flex items-center gap-3"><h2 className="text-[21px] font-black">Gestão de entrega</h2><span className="inline-flex items-center gap-1.5 text-[10px] text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-500" />Atualizado agora</span></div><p className="mt-1 text-xs text-slate-400">Selecione pedidos no mapa, monte rotas e acompanhe a situação dos motoboys.</p></div>
          <div className="flex items-center gap-2"><button onClick={onOpenNewOrderModal} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black hover:bg-emerald-500"><Zap className="h-4 w-4" />Novo despacho</button><button onClick={close} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800"><X className="h-5 w-5" /></button></div>
        </header>

        <div className="grid grid-cols-2 gap-2 border-b border-slate-800 px-4 py-3 md:grid-cols-5">
          {[
            ['Pedidos sem entregador', waitingOrders.length, Package, 'text-slate-200'],
            ['Na fila', queue.length, UsersRound, 'text-emerald-400'],
            ['Em entrega', delivering.length, Bike, 'text-sky-400'],
            ['Voltando', returning.length, Navigation, 'text-orange-400'],
            ['Prontos', waitingOrders.filter(isReady).length, CheckCircle2, 'text-violet-400'],
          ].map(([label, value, Icon, cls]: any) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3"><div className="flex items-center gap-3"><span className={`grid h-9 w-9 place-items-center rounded-lg bg-slate-950 ${cls}`}><Icon className="h-4 w-4" /></span><div><strong className="text-lg leading-none">{value}</strong><p className="mt-1 text-[10px] text-slate-400">{label}</p></div></div></div>)}
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_440px]">
          <div className="relative min-h-[430px] border-r border-slate-800 bg-[#0b111c] p-3">
            <div className="h-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
              <ReactiveRouteMap origin={{ name: shift.storeName || 'Loja', address: shift.storeAddress || '', lat: shift.storeLat || -26.9194, lng: shift.storeLng || -49.0661 }} stops={stops} motoboysList={visibleDrivers} selectedMotoboyId={selectedDriverId} onSelectMotoboy={(id: string) => setSelectedDriverId(id)} />
            </div>
            <div className="absolute left-6 top-6 z-[60] flex gap-2 rounded-xl border border-slate-700 bg-slate-950/90 p-1.5 shadow-lg backdrop-blur">
              {tabs.map(([id, label, count]) => <button key={id} onClick={() => { setTab(id); setSelectedDriverId(null); }} className={`rounded-lg px-3 py-2 text-[10px] font-black transition ${tab === id ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>{label} <span className="opacity-70">({count})</span></button>)}
            </div>
          </div>

          <aside className="min-h-0 overflow-y-auto bg-[#0d131d] p-4">
            <label className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3"><Search className="h-4 w-4 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === 'orders' ? 'Buscar pedido, cliente ou endereço...' : 'Buscar...'} className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500" /></label>

            {tab === 'orders' && <>
              <div className="mb-3 rounded-xl border border-violet-800/60 bg-violet-950/25 p-3"><p className="text-[11px] font-black text-violet-200">Selecione os pedidos que deseja incluir na rota.</p><p className="mt-1 text-[9px] text-slate-400">Você pode montar uma saída individual ou agrupar vários pedidos.</p></div>
              <div className="space-y-2">
                {filteredOrders.map((o) => { const selected = selectedOrderIds.includes(o.id); const wait = minsSince(stamp(o)); return <button key={o.id} onClick={() => setSelectedOrderIds((current) => current.includes(o.id) ? current.filter((id) => id !== o.id) : [...current, o.id])} className={`w-full rounded-xl border p-3 text-left transition ${selected ? 'border-violet-500 bg-violet-950/30' : 'border-slate-700 bg-slate-900 hover:border-slate-600'}`}><div className="flex items-start gap-3"><span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${selected ? 'border-violet-500 bg-violet-600' : 'border-slate-600'}`}>{selected && <CheckCircle2 className="h-3.5 w-3.5" />}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><b className="text-xs">{orderCode(o)}</b><span className="truncate text-[11px] font-semibold text-slate-300">{o.clientName}</span><span className="ml-auto text-[9px] text-slate-400">{wait} min</span></div><p className="mt-1 flex items-center gap-1.5 truncate text-[9px] text-slate-500"><MapPin className="h-3 w-3" />{o.address}</p><div className="mt-2 flex items-center gap-2"><span className="text-[9px] text-slate-400">{o.neighborhood || 'Sem bairro'}</span><span className={`ml-auto rounded-full px-2 py-0.5 text-[8px] font-black ${isReady(o) ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>{isReady(o) ? 'Pronto' : 'Preparando'}</span></div></div></div></button>; })}
              </div>
              <div className="sticky bottom-0 mt-4 rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-2xl"><div className="flex items-center justify-between"><div><b className="text-xs">{selectedOrderIds.length} pedido{selectedOrderIds.length === 1 ? '' : 's'} selecionado{selectedOrderIds.length === 1 ? '' : 's'}</b><p className="mt-1 text-[9px] text-slate-500">{selectedDistance != null ? `~${selectedDistance.toFixed(1)} km estimados` : 'Selecione pedidos para montar a rota'}</p></div>{selectedOrderIds.length > 0 && <button onClick={() => setSelectedOrderIds([])} className="text-[9px] font-bold text-rose-400">Limpar</button>}</div><button disabled={!selectedOrderIds.length} onClick={createRoute} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-xs font-black disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"><Route className="h-4 w-4" />{selectedOrderIds.length === 1 ? 'Montar saída com 1 pedido' : `Montar rota com ${selectedOrderIds.length} pedidos`}</button></div>
            </>}

            {tab === 'queue' && <section className="space-y-2"><div className="mb-3"><h3 className="text-sm font-black">Motoboys na fila</h3><p className="mt-1 text-[9px] text-slate-500">Ordem de chegada no balcão</p></div>{queue.map((m, index) => <button key={m.id} onClick={() => setSelectedDriverId(m.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3 text-left hover:border-emerald-800"><span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-950 text-xs font-black text-emerald-400">{index + 1}º</span><div className="min-w-0 flex-1"><b className="block truncate text-xs">{m.name}</b><p className="mt-1 text-[9px] text-slate-500">Disponível para a próxima saída</p></div></button>)}{!queue.length && <p className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center text-[10px] text-slate-500">Nenhum motoboy na fila.</p>}</section>}

            {tab === 'returning' && <section className="space-y-2"><div className="mb-3"><h3 className="text-sm font-black">Motoboys voltando</h3><p className="mt-1 text-[9px] text-slate-500">Previsão de retorno para a loja</p></div>{returning.map((m) => <button key={m.id} onClick={() => setSelectedDriverId(m.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3 text-left hover:border-orange-800"><span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-950 text-orange-400"><Navigation className="h-4 w-4" /></span><div className="min-w-0 flex-1"><b className="block truncate text-xs">{m.name}</b><p className="mt-1 text-[9px] text-slate-500">Retorno estimado {eta(m)}</p></div></button>)}{!returning.length && <p className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center text-[10px] text-slate-500">Nenhum motoboy voltando.</p>}</section>}

            {tab === 'delivering' && <section className="space-y-2"><div className="mb-3"><h3 className="text-sm font-black">Motoboys em entrega</h3><p className="mt-1 text-[9px] text-slate-500">Cargas atualmente na rua</p></div>{delivering.map((m) => { const linked = activeOrders.filter((o) => o.assignedMotoboyId === m.id && !['delivered', 'cancelled'].includes(String(o.status))); return <button key={m.id} onClick={() => setSelectedDriverId(m.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3 text-left hover:border-sky-800"><span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-950 text-sky-400"><Bike className="h-4 w-4" /></span><div className="min-w-0 flex-1"><b className="block truncate text-xs">{m.name}</b><p className="mt-1 text-[9px] text-slate-500">{linked.length} pedido{linked.length === 1 ? '' : 's'} na carga</p></div></button>; })}{!delivering.length && <p className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center text-[10px] text-slate-500">Nenhum motoboy em entrega.</p>}</section>}
          </aside>
        </div>
      </section>
    </div>, document.body
  );
};
