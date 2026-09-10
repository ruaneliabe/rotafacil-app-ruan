import React, { useMemo, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  LayoutGrid,
  List,
  MapPin,
  Navigation,
  PackageOpen,
  Route,
  Search,
  Sparkles,
  Store,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { Motoboy, Order, Stop, StoreShift } from '../types';
import ReactiveRouteMap from './ReactiveRouteMap';
import { FleetBottleneckBanner } from './FleetBottleneckBanner';
import { buildSmartRouteBatches } from '../utils/routeCorridorUtils';

interface P {
  orders: Order[];
  motoboys: Motoboy[];
  shift: StoreShift;
  activeOrders: Order[];
  unassignedOrders: Order[];
  motoboysAvailable: Motoboy[];
  selectedOrderIds: string[];
  setSelectedOrderIds: (ids: string[]) => void;
  selectedMotoboyId: string | null;
  setSelectedMotoboyId: (id: string | null) => void;
  onAssignOrderToMotoboy: (orderId: string, motoboyId: string) => void;
  onAssignBatchToMotoboy?: (orderIds: string[], motoboyId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onUpdateMotoboyStatus?: (motoboyId: string, status: Motoboy['status']) => void;
  onOpenNewOrderModal: () => void;
  onOpenMotoboyModal: () => void;
  onSelectOrderForTracking: (order: Order) => void;
  setIsRouteModalOpen: (open: boolean) => void;
  setTicketOrder: (order: Order) => void;
  setIsTicketOpen: (open: boolean) => void;
  handleCallCounter: (motoboyId: string, motoboyName: string) => void;
  triggerActionToast: (msg: string) => void;
  setActiveTab: (tab: any) => void;
  getMotoboyLoad: (motoboyId: string) => number;
  assignOrderRespectingLoad: (orderId: string, motoboyId: string) => void;
}

type Stage = 'waiting' | 'preparing' | 'ready' | 'route';
type ManageFilter = 'all' | 'unassigned' | 'route' | 'returning' | 'delivering' | 'available';

const money = (value = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
const code = (o: Order) => o.displayCode || `#${o.codeNumber}`;
const isRoute = (o: Order) => ['picked_up', 'in_transit', 'dispatched'].includes(o.status);
const stage = (o: Order): Stage =>
  isRoute(o) ? 'route' : o.status === 'ready_at_counter' ? 'ready' : o.assignedMotoboyId ? 'preparing' : 'waiting';
const stamp = (o: Order) => Number(o.createdTimestamp) || Date.now();
const minsSince = (value?: number) => Math.max(0, Math.floor((Date.now() - (Number(value) || Date.now())) / 60000));
const readyStamp = (o: Order) => Number((o as any).readyAt || (o as any).readyTimestamp || (o as any).statusUpdatedAt) || stamp(o);
const duration = (mins: number) => mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
const paymentLabel = (value?: string) => value === 'pix' ? 'Pix' : value === 'dinheiro' ? 'Dinheiro' : 'Cartão';
const channelLabel = (value?: string) => value === 'cardapio_web' ? 'Cardápio Web' : value === 'manual' ? 'Manual' : value === 'ifood' ? 'iFood' : value === 'pdv' ? 'PDV' : 'Pedido';

export const OperationDispatchView: React.FC<P> = (p) => {
  const {
    motoboys,
    shift,
    activeOrders,
    motoboysAvailable,
    onSelectOrderForTracking,
    onUpdateOrderStatus,
    assignOrderRespectingLoad,
    onAssignBatchToMotoboy,
    handleCallCounter,
    triggerActionToast,
  } = p;

  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [batchDriver, setBatchDriver] = useState('');
  const [density, setDensity] = useState<'cards' | 'compact'>('cards');
  const [manage, setManage] = useState(false);
  const [manageFilter, setManageFilter] = useState<ManageFilter>('all');
  const [focusDriverId, setFocusDriverId] = useState<string | null>(null);
  const [driverSearch, setDriverSearch] = useState('');
  const [showOrders, setShowOrders] = useState(true);
  const [showDrivers, setShowDrivers] = useState(true);
  const [showStore, setShowStore] = useState(true);

  const load = (id: string) => activeOrders.filter((o) => o.assignedMotoboyId === id && !['delivered', 'cancelled'].includes(o.status)).length;

  const queueDrivers = useMemo(
    () => motoboysAvailable
      .filter((m) => m.status === 'available' && load(m.id) === 0)
      .sort((a, b) => Number(a.joinedQueueAt || Number.MAX_SAFE_INTEGER) - Number(b.joinedQueueAt || Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)),
    [motoboysAvailable, activeOrders]
  );

  const driverLabel = (m: Motoboy) => {
    const linked = load(m.id);
    if (linked) return `${linked} pedido${linked === 1 ? '' : 's'} vinculado${linked === 1 ? '' : 's'}`;
    if (m.status === 'available') return 'Disponível';
    if (m.status === 'delivering') return 'Em entrega';
    if (m.status === 'returning_to_store') return 'Voltando';
    if (m.status === 'paused') return 'Pausado';
    return 'Ocupado';
  };

  const filtered = useMemo(
    () => activeOrders.filter((o) => !q || `${code(o)} ${o.clientName} ${o.address} ${o.neighborhood || ''}`.toLowerCase().includes(q.toLowerCase())),
    [activeOrders, q]
  );

  const grouped = useMemo(() => ({
    waiting: filtered.filter((o) => stage(o) === 'waiting').sort((a, b) => stamp(a) - stamp(b)),
    preparing: filtered.filter((o) => stage(o) === 'preparing'),
    ready: filtered.filter((o) => stage(o) === 'ready').sort((a, b) => readyStamp(a) - readyStamp(b)),
    route: filtered.filter((o) => stage(o) === 'route'),
  }), [filtered]);

  const suggestions = useMemo(
    () => buildSmartRouteBatches(grouped.waiting, shift.storeLat, shift.storeLng).slice(0, 3),
    [grouped.waiting, shift.storeLat, shift.storeLng]
  );

  const mapOrders = useMemo(() => activeOrders.filter((o) =>
    !['delivered', 'cancelled'].includes(o.status) &&
    Number.isFinite(o.lat) && Number.isFinite(o.lng) &&
    (!focusDriverId || o.assignedMotoboyId === focusDriverId)
  ), [activeOrders, focusDriverId]);

  const mapDrivers = useMemo(() => motoboys.filter((m) =>
    m.status !== 'offline' && (!focusDriverId || m.id === focusDriverId)
  ), [motoboys, focusDriverId]);

  const stops: Stop[] = useMemo(() => mapOrders.map((o, index) => ({
    id: o.id,
    codeNumber: o.codeNumber,
    orderIndex: index + 1,
    title: `${code(o)} - ${o.clientName}`,
    recipientName: o.clientName,
    address: o.address,
    neighborhood: o.neighborhood,
    lat: o.lat,
    lng: o.lng,
    status: isRoute(o) ? 'in_transit' : 'pending',
    priority: 'medium',
    valueToReceive: o.total,
  })), [mapOrders]);

  const deliveringDrivers = motoboys.filter((m) => m.status === 'delivering');
  const returningDrivers = motoboys.filter((m) => m.status === 'returning_to_store');
  const availableDrivers = motoboys.filter((m) => m.status === 'available');

  const searchedQueueDrivers = queueDrivers.filter((m) => !driverSearch || m.name.toLowerCase().includes(driverSearch.toLowerCase()));
  const searchedDeliveringDrivers = deliveringDrivers.filter((m) => !driverSearch || m.name.toLowerCase().includes(driverSearch.toLowerCase()));
  const searchedReturningDrivers = returningDrivers.filter((m) => !driverSearch || m.name.toLowerCase().includes(driverSearch.toLowerCase()));
  const searchedWaitingOrders = grouped.waiting.filter((o) => !driverSearch || `${code(o)} ${o.clientName} ${o.address}`.toLowerCase().includes(driverSearch.toLowerCase()));

  const visibleStops = !showOrders ? [] : manageFilter === 'all'
    ? stops
    : manageFilter === 'unassigned'
      ? stops.filter((s) => grouped.waiting.some((o) => o.id === s.id))
      : manageFilter === 'route'
        ? stops.filter((s) => s.status === 'in_transit')
        : [];

  const visibleMapDrivers = !showDrivers ? [] : manageFilter === 'all'
    ? mapDrivers
    : manageFilter === 'returning'
      ? mapDrivers.filter((m) => m.status === 'returning_to_store')
      : manageFilter === 'delivering'
        ? mapDrivers.filter((m) => m.status === 'delivering')
        : manageFilter === 'available'
          ? mapDrivers.filter((m) => m.status === 'available')
          : [];

  const toggle = (id: string) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const assignSelected = () => {
    if (!batchDriver || !selected.length) return;
    if (onAssignBatchToMotoboy && selected.length > 1) onAssignBatchToMotoboy(selected, batchDriver);
    else selected.forEach((id) => assignOrderRespectingLoad(id, batchDriver));
    triggerActionToast(`${selected.length} pedido(s) vinculados ao entregador.`);
    setSelected([]);
    setBatchDriver('');
  };

  const assignFirst = (order: Order) => {
    const next = queueDrivers[0];
    if (!next) return triggerActionToast('Nenhum entregador livre na fila agora.');
    assignOrderRespectingLoad(order.id, next.id);
    triggerActionToast(`${code(order)} atribuído a ${next.name}, 1º da fila.`);
  };

  const assignOldest = () => {
    if (!queueDrivers.length) return triggerActionToast('Nenhum entregador livre agora.');
    const list = grouped.waiting.slice(0, queueDrivers.length);
    list.forEach((order, index) => assignOrderRespectingLoad(order.id, queueDrivers[index].id));
    if (list.length) triggerActionToast(`${list.length} pedido(s) atribuídos pela ordem da fila.`);
  };

  const columns: Array<[Stage, string, string, Order[]]> = [
    ['waiting', 'Aguardando entregador', 'Pedidos sem entregador', grouped.waiting],
    ['preparing', 'Entregador atribuído', 'Carga reservada para retirada', grouped.preparing],
    ['ready', 'Pronto para retirada', 'Aguardando retirada no balcão', grouped.ready],
    ['route', 'Em entrega', 'Pedidos na rua agora', grouped.route],
  ];

  const tones: Record<Stage, string> = {
    waiting: 'bg-amber-500',
    preparing: 'bg-violet-500',
    ready: 'bg-emerald-500',
    route: 'bg-sky-500',
  };

  const empty: Record<Stage, [string, string]> = {
    waiting: ['Nenhum pedido aguardando', 'Novos pedidos aparecem aqui automaticamente.'],
    preparing: ['Nenhuma carga atribuída', 'Ao vincular um pedido, ele aparece nesta coluna.'],
    ready: ['Nenhum pedido pronto', 'Quando a cozinha finalizar, a retirada aparece aqui.'],
    route: ['Nenhuma entrega na rua', 'As rotas iniciadas aparecem aqui.'],
  };

  const OrderCard = ({ order, currentStage }: { order: Order; currentStage: Stage }) => {
    const wait = currentStage === 'ready' ? minsSince(readyStamp(order)) : minsSince(stamp(order));
    const late = (currentStage === 'ready' && wait >= 10) || (currentStage === 'waiting' && wait >= 15);
    return (
      <article onClick={() => currentStage === 'waiting' && toggle(order.id)} className={`rounded-2xl border bg-white p-3.5 shadow-sm transition ${currentStage === 'waiting' ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''} ${selected.includes(order.id) ? 'border-violet-400 ring-2 ring-violet-100' : late ? 'border-rose-300' : 'border-slate-200'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="text-[15px] font-black text-slate-950">{code(order)}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">{channelLabel(order.originChannel)}</span>{late && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-black text-rose-700">ATENÇÃO</span>}</div><p className="mt-1 truncate text-[13px] font-semibold text-slate-700">{order.clientName}</p></div>
          <div className="flex items-start gap-2"><span className="whitespace-nowrap text-[13px] font-black text-slate-950">{money(order.total)}</span>{currentStage === 'waiting' && <span className={`grid h-5 w-5 place-items-center rounded-md border ${selected.includes(order.id) ? 'border-violet-600 bg-violet-600' : 'border-slate-300'}`}>{selected.includes(order.id) && <CheckCircle2 className="h-3 w-3 text-white" />}</span>}</div>
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5"><p className="flex gap-1.5 text-[11px] leading-relaxed text-slate-600"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{order.address}</p>{order.neighborhood && <p className="mt-1 pl-5 text-[10px] font-semibold text-slate-400">{order.neighborhood}</p>}</div>
        <div className="mt-3 flex flex-wrap gap-1.5"><span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-600"><CreditCard className="h-3 w-3" />{paymentLabel(order.paymentMethod)}</span><span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold ${late ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}><Clock3 className="h-3 w-3" />{currentStage === 'ready' ? `Pronto há ${duration(wait)}` : `Há ${duration(wait)}`}</span></div>
        {currentStage === 'preparing' && <button onClick={(e) => { e.stopPropagation(); onUpdateOrderStatus(order.id, 'ready_at_counter'); }} className="mt-3 h-9 w-full rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-800">Marcar como pronto</button>}
        {currentStage === 'ready' && !order.assignedMotoboyId && <button onClick={(e) => { e.stopPropagation(); assignFirst(order); }} className="mt-3 h-9 w-full rounded-lg bg-violet-600 text-xs font-bold text-white">Atribuir 1º da fila</button>}
        {currentStage === 'route' && <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-[10px] font-semibold text-slate-500"><Bike className="mr-1 inline h-3.5 w-3.5" />{order.assignedMotoboyName || 'Em rota'}</span><button onClick={(e) => { e.stopPropagation(); onSelectOrderForTracking(order); }} className="rounded-lg bg-sky-50 px-2.5 py-1.5 text-[10px] font-black text-sky-700">Rastrear</button></div>}
      </article>
    );
  };

  const metrics = [
    { label: 'Ativos', value: activeOrders.length, helper: 'pedidos na operação', icon: PackageOpen, bg: 'bg-slate-100', iconTone: 'text-slate-700', valueTone: 'text-slate-950' },
    { label: 'Sem entregador', value: grouped.waiting.length, helper: 'precisam de decisão', icon: Users, bg: 'bg-amber-50', iconTone: 'text-amber-600', valueTone: grouped.waiting.length ? 'text-amber-700' : 'text-slate-950' },
    { label: 'Atribuídos', value: grouped.preparing.length, helper: 'reservados para retirada', icon: Bike, bg: 'bg-violet-50', iconTone: 'text-violet-600', valueTone: 'text-violet-700' },
    { label: 'Prontos', value: grouped.ready.length, helper: 'aguardando balcão', icon: CheckCircle2, bg: 'bg-emerald-50', iconTone: 'text-emerald-600', valueTone: grouped.ready.length ? 'text-emerald-700' : 'text-slate-950' },
    { label: 'Em entrega', value: grouped.route.length, helper: 'na rua agora', icon: Navigation, bg: 'bg-sky-50', iconTone: 'text-sky-600', valueTone: 'text-sky-700' },
    { label: 'Livres na fila', value: queueDrivers.length, helper: queueDrivers[0] ? `${queueDrivers[0].name.split(' ')[0]} é o próximo` : 'nenhum livre agora', icon: Bike, bg: 'bg-emerald-50', iconTone: 'text-emerald-600', valueTone: queueDrivers.length ? 'text-emerald-700' : 'text-slate-950' },
  ];

  const recenter = () => {
    setFocusDriverId(null);
    setManageFilter('all');
    setShowOrders(true);
    setShowDrivers(true);
    setShowStore(true);
  };

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-[22px] font-black tracking-tight text-slate-950">Central de pedidos</h2><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black ${shift.isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span className={`h-2 w-2 rounded-full ${shift.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />{shift.isOpen ? 'OPERAÇÃO ABERTA' : 'OPERAÇÃO FECHADA'}</span></div><p className="mt-1 text-xs text-slate-500">Pedidos, fila e entregadores em uma visão operacional rápida.</p></div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2"><div className="relative min-w-[260px] flex-1 xl:max-w-[430px]"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pedido, cliente, bairro ou endereço" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 outline-none" /></div><div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1"><button onClick={() => setDensity('cards')} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold ${density === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}><LayoutGrid className="h-3.5 w-3.5" />Cards</button><button onClick={() => setDensity('compact')} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold ${density === 'compact' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}><List className="h-3.5 w-3.5" />Compacto</button></div><button onClick={() => setManage(true)} className="flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-black text-white shadow-sm"><Navigation className="h-4 w-4" />Gestão de entrega</button></div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">{metrics.map(({ label, value, helper, icon: Icon, bg, iconTone, valueTone }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"><div className="flex items-start gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${bg} ${iconTone}`}><Icon className="h-4 w-4" /></span><div className="min-w-0"><div className={`text-[22px] font-black leading-none ${valueTone}`}>{value}</div><div className="mt-1 text-[10px] font-black uppercase tracking-[.05em] text-slate-500">{label}</div><div className="mt-1 truncate text-[9px] text-slate-400">{helper}</div></div></div></div>)}</div>

      <FleetBottleneckBanner orders={activeOrders} motoboys={motoboys} shift={shift} onSelectOrders={(ids) => setSelected(ids)} />

      {suggestions.length > 0 && <section className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3.5"><div className="mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-600" /><h3 className="text-sm font-black text-slate-900">Rotas que combinam</h3></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{suggestions.map((s) => <button key={s.id} onClick={() => setSelected(s.orderIds)} className="rounded-xl border border-violet-200 bg-white p-3 text-left"><div className="flex justify-between gap-2"><span className="text-xs font-black text-slate-900">{s.orders.map(code).join(' + ')}</span><span className="text-[10px] font-black text-violet-700">{s.confidenceScore}%</span></div><p className="mt-1 text-[10px] text-slate-500">{s.corridorName}</p></button>)}</div></section>}

      {grouped.waiting.length > 0 && queueDrivers.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs text-slate-700"><Zap className="h-4 w-4 text-violet-600" /><span><b>{Math.min(grouped.waiting.length, queueDrivers.length)}</b> pedido(s) podem sair agora respeitando a fila.</span></div><button onClick={assignOldest} className="h-8 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-bold text-violet-800">Atribuir mais antigos</button></div>}

      {selected.length > 0 && <div className="sticky top-2 z-30 flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2.5 shadow-lg"><Route className="h-4 w-4 text-violet-600" /><b className="text-xs text-slate-900">{selected.length} selecionado(s)</b><select value={batchDriver} onChange={(e) => setBatchDriver(e.target.value)} className="ml-auto h-8 min-w-[210px] rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Escolher entregador...</option>{motoboys.filter((m) => m.status !== 'offline').map((m) => <option key={m.id} value={m.id}>{m.name} — {driverLabel(m)}</option>)}</select><button disabled={!batchDriver} onClick={assignSelected} className="h-8 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white disabled:opacity-40">Vincular</button><button onClick={() => setSelected([])} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100"><X className="h-4 w-4" /></button></div>}

      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">{columns.map(([id, title, subtitle, items]) => <section key={id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3.5 py-3"><div className="flex gap-2.5"><span className={`w-1 self-stretch rounded-full ${tones[id]}`} /><div><h3 className="text-[13px] font-black text-slate-900">{title}</h3><p className="mt-0.5 text-[10px] text-slate-400">{subtitle}</p></div></div><span className="grid h-7 min-w-7 place-items-center rounded-full bg-slate-100 px-2 text-xs font-black text-slate-600">{items.length}</span></div><div className={`max-h-[650px] min-h-[330px] overflow-y-auto p-2.5 ${density === 'compact' ? 'space-y-1' : 'space-y-2'}`}>{items.length ? items.map((o) => density === 'cards' ? <OrderCard key={o.id} order={o} currentStage={id} /> : <button key={o.id} onClick={() => id === 'waiting' ? toggle(o.id) : id === 'route' ? onSelectOrderForTracking(o) : undefined} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-50"><b>{code(o)}</b><span className="min-w-0 flex-1 truncate text-slate-600">{o.clientName}</span><span className="text-slate-400">{money(o.total)}</span></button>) : <div className="flex h-[220px] flex-col items-center justify-center px-5 text-center"><PackageOpen className="mb-3 h-5 w-5 text-slate-300" /><p className="text-xs font-bold text-slate-600">{empty[id][0]}</p><p className="mt-1.5 text-[10px] text-slate-400">{empty[id][1]}</p></div>}</div></section>)}</div>

      {manage && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[2px]">
          <div className="flex h-[91vh] w-full max-w-[1580px] flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div><h3 className="text-[20px] font-black tracking-tight text-slate-950">Gestão de entrega</h3><p className="mt-1 text-xs text-slate-500">Acompanhe em tempo real os entregadores, gerencie a fila e despache pedidos de forma rápida.</p></div>
              <div className="flex items-center gap-3"><div className="hidden text-right md:block"><div className="flex items-center justify-end gap-2 text-[10px] text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" />Atualizado agora</div><div className="mt-0.5 text-[9px] text-slate-400">em tempo real</div></div><button onClick={() => p.setIsRouteModalOpen(true)} className="hidden h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-black text-white shadow-sm hover:bg-violet-500 sm:flex"><Zap className="h-4 w-4" />Novo despacho</button><button onClick={() => { setManage(false); recenter(); }} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50"><X className="h-5 w-5 text-slate-500" /></button></div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-white p-3 md:grid-cols-5">
              {[
                { label: 'Disponíveis', value: queueDrivers.length, helper: 'Livres para novos pedidos', icon: Users, tone: 'bg-emerald-50 text-emerald-600' },
                { label: 'Em rota', value: grouped.route.length, helper: 'Entregando agora', icon: Bike, tone: 'bg-blue-50 text-blue-600' },
                { label: 'Voltando', value: returningDrivers.length, helper: 'Retornando para a loja', icon: Navigation, tone: 'bg-orange-50 text-orange-600' },
                { label: 'Na loja', value: availableDrivers.length, helper: 'Aguardando despacho', icon: Store, tone: 'bg-violet-50 text-violet-600' },
                { label: 'Fila', value: grouped.waiting.length, helper: 'Pedidos para atribuir', icon: PackageOpen, tone: 'bg-slate-100 text-slate-600' },
              ].map(({ label, value, helper, icon: Icon, tone }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm"><div className="flex items-center gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-slate-700">{label}</span><b className="text-xl leading-none text-slate-950">{value}</b></div><p className="mt-1 truncate text-[9px] text-slate-400">{helper}</p></div></div></div>)}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/40 px-4 py-3">
              <div className="relative min-w-[250px] flex-1 xl:max-w-[330px]"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar endereço no mapa..." className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" /></div>
              {([
                ['all', 'Todos', activeOrders.length],
                ['unassigned', 'Sem entregador', grouped.waiting.length],
                ['route', 'Em rota', grouped.route.length],
                ['returning', 'Voltando', returningDrivers.length],
                ['delivering', 'Em entrega', deliveringDrivers.length],
                ['available', 'Disponíveis', availableDrivers.length],
              ] as Array<[ManageFilter, string, number]>).map(([id, label, count]) => <button key={id} onClick={() => setManageFilter(id)} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[11px] font-black transition ${manageFilter === id ? 'border-violet-600 bg-violet-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{label}<span className={`text-[9px] ${manageFilter === id ? 'text-white/80' : 'text-slate-400'}`}>({count})</span></button>)}
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_430px]">
              <div className="relative min-h-[420px] bg-slate-100 p-3">
                <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><ReactiveRouteMap origin={{ name: showStore ? (shift.storeName || 'Loja') : '', address: showStore ? (shift.storeAddress || '') : '', lat: shift.storeLat || -26.9194, lng: shift.storeLng || -49.0661 }} stops={visibleStops} motoboysList={visibleMapDrivers} selectedMotoboyId={focusDriverId} onSelectMotoboy={(id: string | null) => setFocusDriverId(id)} /></div>

                <div className="absolute left-6 top-6 z-[60] w-[190px] overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur">
                  <button onClick={() => setShowOrders((v) => !v)} className="flex w-full items-start gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50"><span className={`mt-0.5 grid h-4 w-4 place-items-center rounded border text-[9px] font-black ${showOrders ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>✓</span><span className="mt-1 h-2.5 w-2.5 rounded-full bg-orange-500" /><div><div className="text-[11px] font-black text-slate-800">Pedidos</div><div className="text-[8px] text-slate-400">Endereço do cliente</div></div></button>
                  <button onClick={() => setShowDrivers((v) => !v)} className="flex w-full items-start gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50"><span className={`mt-0.5 grid h-4 w-4 place-items-center rounded border text-[9px] font-black ${showDrivers ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>✓</span><span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" /><div><div className="text-[11px] font-black text-slate-800">Entregadores</div><div className="text-[8px] text-slate-400">Posição em tempo real</div></div></button>
                  <button onClick={() => setShowStore((v) => !v)} className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50"><span className={`mt-0.5 grid h-4 w-4 place-items-center rounded border text-[9px] font-black ${showStore ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>✓</span><span className="mt-1 h-2.5 w-2.5 rounded-full bg-violet-600" /><div><div className="text-[11px] font-black text-slate-800">Loja</div><div className="max-w-[120px] truncate text-[8px] text-slate-400">{shift.storeName || 'Loja'}</div></div></button>
                </div>

                <button onClick={recenter} className="absolute bottom-6 right-6 z-[60] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-black text-slate-600 shadow-lg hover:bg-slate-50">Recentralizar mapa</button>
              </div>

              <aside className="min-h-0 overflow-y-auto border-l border-slate-200 bg-white p-3">
                <div className="relative mb-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={driverSearch} onChange={(e) => setDriverSearch(e.target.value)} placeholder="Buscar entregador ou pedido..." className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" /></div>

                <section className="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3 py-2.5"><div className="flex items-center gap-2"><PackageOpen className="h-4 w-4 text-slate-500" /><h4 className="text-[11px] font-black text-slate-800">Próximos da fila ({queueDrivers.length})</h4></div><span className="text-[9px] font-bold text-violet-600">Ordem de chegada</span></div><div className="divide-y divide-slate-100">{searchedQueueDrivers.slice(0, 5).map((m, index) => <button key={m.id} onClick={() => setFocusDriverId(focusDriverId === m.id ? null : m.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"><span className="text-[10px] font-black text-slate-500">#{index + 1}</span><div className="min-w-0 flex-1"><b className="block truncate text-[11px] text-slate-800">{m.name}</b><span className="text-[9px] text-slate-400">{index === 0 ? 'Próximo despacho' : `${index + 1}º da fila`}</span></div><ChevronRight className="h-4 w-4 text-slate-300" /></button>)}{!searchedQueueDrivers.length && <div className="px-4 py-4 text-center text-[10px] text-slate-400">Nenhum entregador disponível na fila.</div>}</div></section>

                <section className="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3 py-2.5"><div className="flex items-center gap-2"><Bike className="h-4 w-4 text-blue-600" /><h4 className="text-[11px] font-black text-slate-800">Motoboys em entrega ({deliveringDrivers.length})</h4></div><button onClick={() => setManageFilter('delivering')} className="text-[9px] font-bold text-violet-600">Ver todos</button></div><div className="divide-y divide-slate-100">{searchedDeliveringDrivers.slice(0, 6).map((m) => { const order = activeOrders.find((o) => o.assignedMotoboyId === m.id && isRoute(o)); return <button key={m.id} onClick={() => setFocusDriverId(focusDriverId === m.id ? null : m.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"><span className="grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-white"><Bike className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><b className="truncate text-[11px] text-slate-800">{m.name}</b>{order && <span className="text-[9px] font-black text-slate-500">{code(order)}</span>}</div><p className="mt-0.5 truncate text-[9px] text-slate-400">{order?.address || 'Entrega em andamento'}</p></div><span className="whitespace-nowrap text-[9px] font-black text-emerald-600">Em entrega</span></button>; })}{!searchedDeliveringDrivers.length && <div className="px-4 py-4 text-center text-[10px] text-slate-400">Nenhum motoboy em entrega agora.</div>}</div></section>

                <section className="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3 py-2.5"><div className="flex items-center gap-2"><Navigation className="h-4 w-4 text-orange-500" /><h4 className="text-[11px] font-black text-slate-800">Motoboys voltando ({returningDrivers.length})</h4></div><button onClick={() => setManageFilter('returning')} className="text-[9px] font-bold text-violet-600">Ver todos</button></div><div className="divide-y divide-slate-100">{searchedReturningDrivers.slice(0, 5).map((m) => <div key={m.id} className="flex items-center gap-2 px-3 py-2"><button onClick={() => setFocusDriverId(focusDriverId === m.id ? null : m.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-500"><Navigation className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><b className="block truncate text-[11px] text-slate-800">{m.name}</b><p className="mt-0.5 text-[9px] text-slate-400">Retornando para a loja</p></div></button><button onClick={() => handleCallCounter(m.id, m.name)} className="rounded-lg bg-violet-50 px-2 py-1 text-[9px] font-black text-violet-700">Chamar</button></div>)}{!searchedReturningDrivers.length && <div className="px-4 py-4 text-center text-[10px] text-slate-400">Nenhum entregador retornando no momento.</div>}</div></section>

                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3 py-2.5"><div className="flex items-center gap-2"><PackageOpen className="h-4 w-4 text-slate-500" /><h4 className="text-[11px] font-black text-slate-800">Pedidos sem entregador ({grouped.waiting.length})</h4></div><button onClick={() => setManageFilter('unassigned')} className="text-[9px] font-bold text-violet-600">Ver todos</button></div><div className="divide-y divide-slate-100">{searchedWaitingOrders.slice(0, 5).map((o) => <button key={o.id} onClick={() => onSelectOrderForTracking(o)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"><span className="text-[10px] font-black text-slate-800">{code(o)}</span><div className="min-w-0 flex-1"><b className="block truncate text-[11px] text-slate-700">{o.clientName}</b><p className="mt-0.5 truncate text-[9px] text-slate-400">{o.address}</p></div><span className="whitespace-nowrap text-[9px] font-black text-rose-600">Sem entregador</span></button>)}{!searchedWaitingOrders.length && <div className="px-4 py-4 text-center text-[10px] text-slate-400">Nenhum pedido aguardando entregador.</div>}</div></section>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationDispatchView;
