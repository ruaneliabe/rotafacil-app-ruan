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
type MapMode = 'all' | 'orders' | 'drivers';

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
  const [mapMode, setMapMode] = useState<MapMode>('all');
  const [focusDriverId, setFocusDriverId] = useState<string | null>(null);
  const [driverSearch, setDriverSearch] = useState('');

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

  const critical = useMemo(() => [
    ...grouped.ready.filter((o) => minsSince(readyStamp(o)) >= 10),
    ...grouped.waiting.filter((o) => minsSince(stamp(o)) >= 15),
  ], [grouped.ready, grouped.waiting]);

  const suggestions = useMemo(
    () => buildSmartRouteBatches(grouped.waiting, shift.storeLat, shift.storeLng).slice(0, 3),
    [grouped.waiting, shift.storeLat, shift.storeLng]
  );

  const sortedDrivers = useMemo(() => [...motoboys]
    .filter((m) => m.status !== 'offline')
    .sort((a, b) => {
      const ai = queueDrivers.findIndex((x) => x.id === a.id);
      const bi = queueDrivers.findIndex((x) => x.id === b.id);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return load(a.id) - load(b.id) || a.name.localeCompare(b.name);
    }), [motoboys, queueDrivers, activeOrders]);

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
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[15px] font-black text-slate-950">{code(order)}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">{channelLabel(order.originChannel)}</span>
              {late && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-black text-rose-700">ATENÇÃO</span>}
            </div>
            <p className="mt-1 truncate text-[13px] font-semibold text-slate-700">{order.clientName}</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="whitespace-nowrap text-[13px] font-black text-slate-950">{money(order.total)}</span>
            {currentStage === 'waiting' && <span className={`grid h-5 w-5 place-items-center rounded-md border ${selected.includes(order.id) ? 'border-violet-600 bg-violet-600' : 'border-slate-300'}`}>{selected.includes(order.id) && <CheckCircle2 className="h-3 w-3 text-white" />}</span>}
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="flex gap-1.5 text-[11px] leading-relaxed text-slate-600"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{order.address}</p>
          {order.neighborhood && <p className="mt-1 pl-5 text-[10px] font-semibold text-slate-400">{order.neighborhood}</p>}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-600"><CreditCard className="h-3 w-3" />{paymentLabel(order.paymentMethod)}</span>
          <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold ${late ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}><Clock3 className="h-3 w-3" />{currentStage === 'ready' ? `Pronto há ${duration(wait)}` : `Há ${duration(wait)}`}</span>
          {order.deliveryFee > 0 && <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">Taxa {money(order.deliveryFee)}</span>}
        </div>

        {currentStage === 'preparing' && <div className="mt-3"><p className="mb-2 text-[10px] font-semibold text-slate-500"><Bike className="mr-1 inline h-3.5 w-3.5" />{order.assignedMotoboyName || 'Entregador vinculado'}</p><button onClick={(e) => { e.stopPropagation(); onUpdateOrderStatus(order.id, 'ready_at_counter'); }} className="h-9 w-full rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-800 hover:bg-emerald-100">Marcar como pronto</button></div>}
        {currentStage === 'ready' && !order.assignedMotoboyId && <button onClick={(e) => { e.stopPropagation(); assignFirst(order); }} className="mt-3 h-9 w-full rounded-lg bg-violet-600 text-xs font-bold text-white hover:bg-violet-500">Atribuir 1º da fila</button>}
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

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[22px] font-black tracking-tight text-slate-950">Central de pedidos</h2>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black ${shift.isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span className={`h-2 w-2 rounded-full ${shift.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />{shift.isOpen ? 'OPERAÇÃO ABERTA' : 'OPERAÇÃO FECHADA'}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Pedidos, fila e entregadores em uma visão operacional rápida.</p>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <div className="relative min-w-[260px] flex-1 xl:max-w-[430px]"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pedido, cliente, bairro ou endereço" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100" /></div>
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1"><button onClick={() => setDensity('cards')} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold ${density === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}><LayoutGrid className="h-3.5 w-3.5" />Cards</button><button onClick={() => setDensity('compact')} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold ${density === 'compact' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}><List className="h-3.5 w-3.5" />Compacto</button></div>
            <button onClick={() => setManage(true)} className="flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-black text-white shadow-sm hover:bg-violet-500"><Navigation className="h-4 w-4" />Gestão de entrega</button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {metrics.map(({ label, value, helper, icon: Icon, bg, iconTone, valueTone }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"><div className="flex items-start gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${bg} ${iconTone}`}><Icon className="h-4 w-4" /></span><div className="min-w-0"><div className={`text-[22px] font-black leading-none ${valueTone}`}>{value}</div><div className="mt-1 text-[10px] font-black uppercase tracking-[.05em] text-slate-500">{label}</div><div className="mt-1 truncate text-[9px] text-slate-400">{helper}</div></div></div></div>)}
      </div>

      <FleetBottleneckBanner orders={activeOrders} motoboys={motoboys} shift={shift} onSelectOrders={(ids) => setSelected(ids)} />

      {suggestions.length > 0 && <section className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3.5"><div className="mb-2 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white"><Sparkles className="h-4 w-4 text-violet-600" /></span><div><h3 className="text-sm font-black text-slate-900">Rotas que combinam</h3><p className="text-[10px] text-slate-500">Sugestões por trajeto e tempo de espera.</p></div></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{suggestions.map((s) => <button key={s.id} onClick={() => setSelected(s.orderIds)} className="rounded-xl border border-violet-200 bg-white p-3 text-left hover:border-violet-400"><div className="flex justify-between gap-2"><span className="text-xs font-black text-slate-900">{s.orders.map(code).join(' + ')}</span><span className="text-[10px] font-black text-violet-700">{s.confidenceScore}%</span></div><p className="mt-1 text-[10px] text-slate-500">{s.corridorName}</p></button>)}</div></section>}

      {grouped.waiting.length > 0 && queueDrivers.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs text-slate-700"><Zap className="h-4 w-4 text-violet-600" /><span><b>{Math.min(grouped.waiting.length, queueDrivers.length)}</b> pedido(s) podem sair agora respeitando a fila.</span></div><button onClick={assignOldest} className="h-8 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-bold text-violet-800">Atribuir mais antigos</button></div>}

      {selected.length > 0 && <div className="sticky top-2 z-30 flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2.5 shadow-lg"><Route className="h-4 w-4 text-violet-600" /><b className="text-xs text-slate-900">{selected.length} selecionado(s)</b><select value={batchDriver} onChange={(e) => setBatchDriver(e.target.value)} className="ml-auto h-8 min-w-[210px] rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Escolher entregador...</option>{motoboys.filter((m) => m.status !== 'offline').map((m) => <option key={m.id} value={m.id}>{m.name} — {driverLabel(m)}</option>)}</select><button disabled={!batchDriver} onClick={assignSelected} className="h-8 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white disabled:opacity-40">Vincular</button><button onClick={() => setSelected([])} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100"><X className="h-4 w-4" /></button></div>}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {columns.map(([id, title, subtitle, items]) => <section key={id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3.5 py-3"><div className="flex gap-2.5"><span className={`w-1 self-stretch rounded-full ${tones[id]}`} /><div><h3 className="text-[13px] font-black text-slate-900">{title}</h3><p className="mt-0.5 text-[10px] text-slate-400">{subtitle}</p></div></div><span className="grid h-7 min-w-7 place-items-center rounded-full bg-slate-100 px-2 text-xs font-black text-slate-600">{items.length}</span></div><div className={`max-h-[650px] min-h-[330px] overflow-y-auto p-2.5 ${density === 'compact' ? 'space-y-1' : 'space-y-2'}`}>{items.length ? items.map((o) => density === 'cards' ? <OrderCard key={o.id} order={o} currentStage={id} /> : <button key={o.id} onClick={() => id === 'waiting' ? toggle(o.id) : id === 'route' ? onSelectOrderForTracking(o) : undefined} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-50"><b className="shrink-0">{code(o)}</b><span className="min-w-0 flex-1 truncate text-slate-600">{o.clientName}</span><span className="shrink-0 text-slate-400">{money(o.total)}</span></button>) : <div className="flex h-[220px] flex-col items-center justify-center px-5 text-center"><span className="mb-3 grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-slate-50"><PackageOpen className="h-5 w-5 text-slate-300" /></span><p className="text-xs font-bold text-slate-600">{empty[id][0]}</p><p className="mt-1.5 max-w-[220px] text-[10px] leading-relaxed text-slate-400">{empty[id][1]}</p></div>}</div></section>)}
        </div>

        <aside className="space-y-3 xl:sticky xl:top-3 xl:self-start">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3"><div><h3 className="text-[13px] font-black text-slate-900">Mapa da operação</h3><p className="mt-0.5 text-[10px] text-slate-400">Pedidos e entregadores agora</p></div><button onClick={() => setManage(true)} className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-[10px] font-black text-violet-700">Expandir</button></div><div className="h-[235px] bg-slate-100"><ReactiveRouteMap origin={{ name: shift.storeName || 'Loja', address: shift.storeAddress || '', lat: shift.storeLat || -26.9194, lng: shift.storeLng || -49.0661 }} stops={stops.slice(0, 12)} motoboysList={motoboys.filter((m) => m.status !== 'offline')} selectedMotoboyId={null} /></div></section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-violet-600" /><h3 className="text-[13px] font-black text-slate-900">Entregadores</h3></div><span className="text-[10px] font-bold text-slate-400">{sortedDrivers.length} online</span></div><div className="max-h-[320px] divide-y divide-slate-100 overflow-y-auto">{sortedDrivers.length ? sortedDrivers.slice(0, 8).map((m) => { const qi = queueDrivers.findIndex((x) => x.id === m.id); return <button key={m.id} onClick={() => { setFocusDriverId(m.id); setManage(true); }} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-black ${qi === 0 ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{m.name.charAt(0).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="truncate text-[11px] font-black text-slate-900">{m.name}</p>{qi === 0 && <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[8px] font-black text-violet-700">PRÓXIMO</span>}</div><p className="mt-0.5 truncate text-[9px] text-slate-400">{qi >= 0 ? `${qi + 1}º da fila` : driverLabel(m)} · {load(m.id)} pedido(s)</p></div><ChevronRight className="h-4 w-4 text-slate-300" /></button>; }) : <div className="px-4 py-8 text-center text-[11px] text-slate-400">Nenhum entregador online agora.</div>}</div></section>

          <section className="rounded-2xl bg-slate-950 p-3.5 text-white shadow-sm"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-300" /><h3 className="text-[12px] font-black">Resumo rápido</h3></div><div className="mt-3 grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-white/5 p-2.5"><p className="text-[18px] font-black">{critical.length}</p><p className="mt-1 text-[9px] text-slate-400">atenções</p></div><div className="rounded-xl bg-white/5 p-2.5"><p className="text-[18px] font-black">{queueDrivers.length}</p><p className="mt-1 text-[9px] text-slate-400">livres na fila</p></div></div></section>
        </aside>
      </div>

      {manage && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"><div className="flex h-[88vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-3"><div><h3 className="text-base font-black text-slate-900">Gestão de entrega</h3><p className="mt-1 text-xs text-slate-500">Mapa, fila e situação da frota em tempo real.</p></div><button onClick={() => { setManage(false); setFocusDriverId(null); }} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><X className="h-5 w-5 text-slate-500" /></button></div><div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="relative min-h-0 p-3"><div className="absolute left-6 top-6 z-[60] flex rounded-lg border border-slate-200 bg-white p-1 shadow-lg">{(['all','orders','drivers'] as MapMode[]).map((mode) => <button key={mode} onClick={() => setMapMode(mode)} className={`rounded-md px-3 py-1.5 text-[10px] font-black ${mapMode === mode ? 'bg-violet-600 text-white' : 'text-slate-500'}`}>{mode === 'all' ? 'Tudo' : mode === 'orders' ? 'Pedidos' : 'Entregadores'}</button>)}</div><ReactiveRouteMap origin={{ name: shift.storeName || 'Loja', address: shift.storeAddress || '', lat: shift.storeLat || -26.9194, lng: shift.storeLng || -49.0661 }} stops={mapMode === 'drivers' ? [] : stops} motoboysList={mapMode === 'orders' ? [] : mapDrivers} selectedMotoboyId={focusDriverId} onSelectMotoboy={(id: string | null) => setFocusDriverId(id)} /></div><aside className="overflow-y-auto border-l border-slate-200 bg-slate-50/50 p-3"><div className="mb-3"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-violet-600" /><h4 className="text-sm font-black text-slate-900">Fila de saída</h4></div><p className="mt-1 text-[10px] text-slate-400">O primeiro entregador é o próximo a receber rota.</p></div><div className="relative mb-2"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" /><input value={driverSearch} onChange={(e) => setDriverSearch(e.target.value)} placeholder="Buscar entregador" className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-xs" /></div>{sortedDrivers.filter((m) => !driverSearch || m.name.toLowerCase().includes(driverSearch.toLowerCase())).map((m) => { const qi = queueDrivers.findIndex((x) => x.id === m.id); const focused = focusDriverId === m.id; return <button key={m.id} onClick={() => setFocusDriverId(focused ? null : m.id)} className={`mb-2 w-full rounded-xl border p-3 text-left shadow-sm ${focused ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-white'}`}><div className="flex justify-between gap-2"><div><b className="text-sm text-slate-900">{m.name}</b><p className="mt-1 text-xs text-slate-500">{driverLabel(m)}</p></div>{qi >= 0 && <span className={`h-fit rounded-full px-2 py-1 text-[10px] font-black ${qi === 0 ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{qi === 0 ? '1º · PRÓXIMO' : `${qi + 1}º DA FILA`}</span>}</div>{m.status === 'returning_to_store' && <span onClick={(e) => { e.stopPropagation(); handleCallCounter(m.id, m.name); }} className="mt-2 inline-block text-xs font-black text-violet-700">Chamar no balcão</span>}</button>; })}</aside></div></div></div>}
    </div>
  );
};

export default OperationDispatchView;
