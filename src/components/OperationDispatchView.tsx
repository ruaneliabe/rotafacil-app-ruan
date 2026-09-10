import React, { useMemo, useState } from 'react';
import {
  Bike,
  Check,
  CheckCircle2,
  Clock3,
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
type MapOrderFilter = 'all' | Stage;
type MapDriverFilter = 'all' | 'available' | 'delivering' | 'returning_to_store';

const money = (value = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
const code = (o: Order) => o.displayCode || `#${o.codeNumber}`;
const isRoute = (o: Order) => ['picked_up', 'in_transit', 'dispatched'].includes(o.status);
const stage = (o: Order): Stage =>
  isRoute(o) ? 'route' : o.status === 'ready_at_counter' ? 'ready' : o.assignedMotoboyId ? 'preparing' : 'waiting';
const stamp = (o: Order) => Number(o.createdTimestamp) || Date.now();
const minsSince = (value?: number) => Math.max(0, Math.floor((Date.now() - (Number(value) || Date.now())) / 60000));
const readyStamp = (o: Order) => Number((o as any).readyAt || (o as any).readyTimestamp || (o as any).statusUpdatedAt) || stamp(o);
const duration = (mins: number) => (mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`);
const distanceKm = (a?: number, b?: number, c?: number, d?: number) => {
  if (![a, b, c, d].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const rad = (n: number) => (n * Math.PI) / 180;
  const R = 6371;
  const x = rad(c! - a!);
  const y = rad(d! - b!);
  const q = Math.sin(x / 2) ** 2 + Math.cos(rad(a!)) * Math.cos(rad(c!)) * Math.sin(y / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
};

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
  const [manage, setManage] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>('all');
  const [mapOrderFilter, setMapOrderFilter] = useState<MapOrderFilter>('all');
  const [mapDriverFilter, setMapDriverFilter] = useState<MapDriverFilter>('all');
  const [focusDriverId, setFocusDriverId] = useState<string | null>(null);
  const [density, setDensity] = useState<'cards' | 'compact'>('cards');
  const [driverSearch, setDriverSearch] = useState('');

  const load = (id: string) =>
    activeOrders.filter((o) => o.assignedMotoboyId === id && !['delivered', 'cancelled'].includes(o.status)).length;

  const queueDrivers = useMemo(
    () =>
      motoboysAvailable
        .filter((m) => m.status === 'available' && load(m.id) === 0)
        .sort(
          (a, b) =>
            Number(a.joinedQueueAt || Number.MAX_SAFE_INTEGER) - Number(b.joinedQueueAt || Number.MAX_SAFE_INTEGER) ||
            a.name.localeCompare(b.name)
        ),
    [motoboysAvailable, activeOrders]
  );

  const driverLabel = (m?: Motoboy) => {
    if (!m) return 'Sem entregador';
    const n = load(m.id);
    if (n > 0) return n === 1 ? '1 pedido vinculado' : `${n} pedidos vinculados`;
    if (m.status === 'available') return 'Disponível';
    if (m.status === 'delivering') return 'Em entrega';
    if (m.status === 'returning_to_store') return 'Voltando';
    if (m.status === 'offline') return 'Offline';
    return 'Ocupado';
  };

  const returnEta = (m: Motoboy) => {
    if (load(m.id) > 0 && m.status === 'available') return 'aguardando retirada';
    if (m.status === 'available') return 'na loja / disponível';
    if (m.status === 'delivering') return 'após finalizar a rota';
    if (m.status !== 'returning_to_store') return 'sem previsão';
    const km = distanceKm(m.currentLat, m.currentLng, shift.storeLat, shift.storeLng);
    return km == null ? '~5–10 min' : `~${Math.max(2, Math.round((km / 25) * 60))} min`;
  };

  const filtered = useMemo(
    () =>
      activeOrders.filter(
        (o) => !q || `${code(o)} ${o.clientName} ${o.address} ${o.neighborhood || ''}`.toLowerCase().includes(q.toLowerCase())
      ),
    [activeOrders, q]
  );

  const grouped = useMemo(
    () => ({
      waiting: filtered.filter((o) => stage(o) === 'waiting').sort((a, b) => stamp(a) - stamp(b)),
      preparing: filtered.filter((o) => stage(o) === 'preparing'),
      ready: filtered.filter((o) => stage(o) === 'ready').sort((a, b) => readyStamp(a) - readyStamp(b)),
      route: filtered.filter((o) => stage(o) === 'route'),
    }),
    [filtered]
  );

  const critical = useMemo(
    () => [
      ...grouped.ready.filter((o) => minsSince(readyStamp(o)) >= 10),
      ...grouped.waiting.filter((o) => minsSince(stamp(o)) >= 15),
    ],
    [grouped.ready, grouped.waiting]
  );

  const smartSuggestions = useMemo(
    () => buildSmartRouteBatches(grouped.waiting, shift.storeLat, shift.storeLng).slice(0, 3),
    [grouped.waiting, shift.storeLat, shift.storeLng]
  );

  const orderFilterCount = (id: MapOrderFilter) =>
    id === 'all' ? activeOrders.length : activeOrders.filter((o) => stage(o) === id).length;
  const driverFilterCount = (id: MapDriverFilter) => {
    if (id === 'all') return motoboys.filter((m) => m.status !== 'offline').length;
    if (id === 'available') return queueDrivers.length;
    return motoboys.filter((m) => m.status === id).length;
  };

  const mapOrders = useMemo(
    () =>
      activeOrders.filter(
        (o) =>
          !['delivered', 'cancelled'].includes(o.status) &&
          typeof o.lat === 'number' &&
          typeof o.lng === 'number' &&
          (!focusDriverId || o.assignedMotoboyId === focusDriverId) &&
          (mapOrderFilter === 'all' || stage(o) === mapOrderFilter)
      ),
    [activeOrders, focusDriverId, mapOrderFilter]
  );

  const mapDrivers = useMemo(
    () =>
      motoboys.filter(
        (m) =>
          m.status !== 'offline' &&
          (!focusDriverId || m.id === focusDriverId) &&
          (mapDriverFilter === 'all' ||
            (mapDriverFilter === 'available' ? m.status === 'available' && load(m.id) === 0 : m.status === mapDriverFilter))
      ),
    [motoboys, focusDriverId, mapDriverFilter, activeOrders]
  );

  const stops: Stop[] = useMemo(
    () =>
      mapOrders.map(
        (o, i) =>
          ({
            id: o.id,
            codeNumber: o.codeNumber,
            orderIndex: i + 1,
            title: `${code(o)} - ${o.clientName}`,
            recipientName: o.clientName,
            address: o.address,
            neighborhood: o.neighborhood,
            lat: o.lat,
            lng: o.lng,
            status: isRoute(o) ? 'in_transit' : 'pending',
            priority: 'medium',
            motoboyId: o.assignedMotoboyId || undefined,
            motoboyName: o.assignedMotoboyName || undefined,
          }) as Stop
      ),
    [mapOrders]
  );

  const queueIndex = (m: Motoboy) => queueDrivers.findIndex((x) => x.id === m.id);
  const sortedDrivers = useMemo(
    () =>
      [...motoboys]
        .filter((m) => m.status !== 'offline')
        .sort((a, b) => {
          const ai = queueIndex(a);
          const bi = queueIndex(b);
          if (ai >= 0 && bi >= 0) return ai - bi;
          if (ai >= 0) return -1;
          if (bi >= 0) return 1;
          const al = load(a.id);
          const bl = load(b.id);
          if (al !== bl) return al - bl;
          return a.name.localeCompare(b.name);
        }),
    [motoboys, queueDrivers, activeOrders]
  );

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const assignSelected = () => {
    if (!batchDriver || !selected.length) return;
    if (onAssignBatchToMotoboy && selected.length > 1) onAssignBatchToMotoboy(selected, batchDriver);
    else selected.forEach((id) => assignOrderRespectingLoad(id, batchDriver));
    triggerActionToast(`${selected.length} pedido(s) vinculados ao entregador.`);
    setSelected([]);
    setBatchDriver('');
  };

  const assignCritical = (o: Order) => {
    const next = queueDrivers[0];
    if (!next) {
      triggerActionToast('Nenhum entregador livre na fila agora.');
      return;
    }
    assignOrderRespectingLoad(o.id, next.id);
    triggerActionToast(`${code(o)} atribuído a ${next.name}, 1º da fila.`);
  };

  const assignOldestBatch = () => {
    if (!queueDrivers.length) {
      triggerActionToast('Nenhum entregador livre agora.');
      return;
    }
    const toAssign = grouped.waiting.slice(0, queueDrivers.length);
    if (!toAssign.length) return;
    toAssign.forEach((o, i) => assignOrderRespectingLoad(o.id, queueDrivers[i].id));
    triggerActionToast(`${toAssign.length} pedido(s) mais antigos atribuídos pela ordem da fila.`);
  };

  const chooseMode = (mode: MapMode) => {
    if (mode === 'orders' && activeOrders.length === 0) return;
    if (mode === 'drivers' && motoboys.filter((m) => m.status !== 'offline').length === 0) return;
    setFocusDriverId(null);
    setMapMode(mode);
  };
  const chooseOrderFilter = (filter: MapOrderFilter) => {
    if (filter !== 'all' && orderFilterCount(filter) === 0) return;
    setFocusDriverId(null);
    setMapOrderFilter(filter);
  };
  const chooseDriverFilter = (filter: MapDriverFilter) => {
    if (filter !== 'all' && driverFilterCount(filter) === 0) return;
    setFocusDriverId(null);
    setMapDriverFilter(filter);
  };

  const columns: Array<[Stage, string, string, Order[]]> = [
    ['waiting', 'Aguardando entregador', 'Pedidos sem entregador', grouped.waiting],
    ['preparing', 'Entregador atribuído', 'Carga reservada para retirada', grouped.preparing],
    ['ready', 'Pronto para retirada', 'Aguardando retirada no balcão', grouped.ready],
    ['route', 'Em entrega', 'Pedidos na rua agora', grouped.route],
  ];

  const emptyState: Record<Stage, { title: string; subtitle: string }> = {
    waiting: { title: 'Nenhum pedido aguardando', subtitle: 'Novos pedidos do Cardápio Web aparecem aqui automaticamente.' },
    preparing: { title: 'Nenhuma carga atribuída', subtitle: 'Ao vincular um pedido, o entregador aparece nesta coluna.' },
    ready: { title: 'Nenhum pedido pronto', subtitle: 'Quando a cozinha finalizar, a retirada aparece aqui.' },
    route: { title: 'Nenhuma entrega na rua', subtitle: 'As rotas iniciadas pelos entregadores aparecem aqui.' },
  };

  const stageTone: Record<Stage, string> = {
    waiting: 'bg-amber-500',
    preparing: 'bg-violet-500',
    ready: 'bg-emerald-500',
    route: 'bg-sky-500',
  };

  const Card: React.FC<{ o: Order; s: Stage }> = ({ o, s }) => {
    const m = motoboys.find((x) => x.id === o.assignedMotoboyId);
    const wait = s === 'ready' ? minsSince(readyStamp(o)) : minsSince(stamp(o));
    const late = (s === 'ready' && wait >= 10) || (s === 'waiting' && wait >= 15);
    return (
      <article
        onClick={() => s === 'waiting' && toggle(o.id)}
        className={`rounded-xl border bg-white p-3.5 shadow-sm transition ${
          s === 'waiting' ? 'cursor-pointer hover:border-slate-300 hover:shadow-md' : ''
        } ${selected.includes(o.id) ? 'border-violet-400 ring-2 ring-violet-100' : 'border-slate-200'} ${
          late ? 'border-red-300 ring-1 ring-red-100' : ''
        }`}
      >
        {s === 'waiting' && (
          <div className={`float-right w-5 h-5 rounded-md border grid place-items-center ${selected.includes(o.id) ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`}>
            {selected.includes(o.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
          </div>
        )}
        <div className="flex justify-between gap-3 pr-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <b className="text-[15px] text-slate-950">{code(o)}</b>
              {late && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-semibold text-red-700">ATENÇÃO</span>}
            </div>
            <p className="text-sm text-slate-700 mt-1 truncate">{o.clientName}</p>
          </div>
          <b className="text-sm text-slate-900 whitespace-nowrap">{money(o.total)}</b>
        </div>
        <p className="text-xs text-slate-500 mt-2 flex gap-1.5 leading-relaxed">
          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />{o.address}
        </p>
        {s === 'waiting' && <p className={`text-xs mt-2 ${late ? 'text-red-600 font-medium' : 'text-slate-500'}`}><Clock3 className="w-3.5 h-3.5 inline mr-1" />Aguardando há {duration(wait)}</p>}
        {s === 'preparing' && (
          <>
            <p className="text-xs text-slate-600 mt-2"><Bike className="w-3.5 h-3.5 inline mr-1" />{o.assignedMotoboyName} · {driverLabel(m)}</p>
            <button onClick={(e) => { e.stopPropagation(); onUpdateOrderStatus(o.id, 'ready_at_counter'); }} className="w-full mt-3 h-9 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold">Marcar como pronto</button>
          </>
        )}
        {s === 'ready' && (
          <>
            <div className={`mt-2 text-xs font-semibold ${late ? 'text-red-600' : 'text-emerald-700'}`}>{late ? 'Pronto há ' : 'Pronto há '}{duration(wait)}</div>
            <p className="text-xs text-slate-600 mt-1"><Bike className="w-3.5 h-3.5 inline mr-1" />{o.assignedMotoboyName || 'Sem entregador'} · {m ? 'vinculado' : 'aguardando atribuição'}</p>
            {!o.assignedMotoboyId && <button onClick={(e) => { e.stopPropagation(); assignCritical(o); }} className="w-full mt-3 h-9 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold">Atribuir 1º da fila</button>}
          </>
        )}
        {s === 'route' && (
          <div className="mt-3 flex justify-between items-center">
            <span className="text-xs text-slate-600">{o.assignedMotoboyName || 'Em rota'}</span>
            <button onClick={(e) => { e.stopPropagation(); onSelectOrderForTracking(o); }} className="text-xs font-semibold text-violet-700">Rastrear</button>
          </div>
        )}
      </article>
    );
  };

  const Row: React.FC<{ o: Order; s: Stage }> = ({ o, s }) => {
    const wait = s === 'ready' ? minsSince(readyStamp(o)) : minsSince(stamp(o));
    const late = (s === 'ready' && wait >= 10) || (s === 'waiting' && wait >= 15);
    const rightLabel = s === 'waiting' ? duration(wait) : s === 'preparing' ? (o.assignedMotoboyName || '—') : s === 'ready' ? duration(wait) : (o.assignedMotoboyName || 'Em rota');
    return (
      <div
        onClick={() => s === 'waiting' ? toggle(o.id) : s === 'ready' && !o.assignedMotoboyId ? assignCritical(o) : s === 'route' ? onSelectOrderForTracking(o) : undefined}
        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition ${late ? 'bg-red-50 text-red-700' : selected.includes(o.id) ? 'bg-violet-50 text-slate-900' : 'hover:bg-slate-50 text-slate-600'}`}
      >
        {s === 'waiting' && <div className={`shrink-0 w-4 h-4 rounded border grid place-items-center ${selected.includes(o.id) ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`}>{selected.includes(o.id) && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}</div>}
        <span className="font-semibold shrink-0">{code(o)}</span>
        <span className="truncate flex-1 min-w-0">{o.clientName}</span>
        <span className={`shrink-0 whitespace-nowrap ${late ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>{rightLabel}</span>
      </div>
    );
  };

  const FilterCheck: React.FC<{ checked: boolean; label: string; count?: number; disabled?: boolean; onClick: () => void }> = ({ checked, label, count, disabled, onClick }) => (
    <button type="button" disabled={disabled} onClick={onClick} className={`w-full flex items-center gap-2 py-1 text-left ${disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'}`}>
      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`}>{checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}</span>
      <span className={`text-xs ${checked ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>{label}</span>
      {typeof count === 'number' && <span className="ml-auto text-xs text-slate-400">{count}</span>}
    </button>
  );

  const metrics = [
    ['Ativos', activeOrders.length, 'text-slate-950'],
    ['Sem entregador', grouped.waiting.length, grouped.waiting.length ? 'text-amber-700' : 'text-slate-950'],
    ['Atribuídos', grouped.preparing.length, 'text-violet-700'],
    ['Prontos', grouped.ready.length, grouped.ready.length ? 'text-emerald-700' : 'text-slate-950'],
    ['Em entrega', grouped.route.length, 'text-sky-700'],
    ['Livres na fila', queueDrivers.length, queueDrivers.length ? 'text-emerald-700' : 'text-slate-950'],
  ] as const;

  return (
    <div className="space-y-4">
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight text-slate-950">Pedidos</h2>
          <p className="text-xs text-slate-500 mt-1">Acompanhe o que precisa de decisão agora, sem ruído.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pedido, cliente ou endereço" className="w-[370px] max-w-[58vw] bg-white border border-slate-200 rounded-lg pl-9 pr-3 h-9 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
          </div>
          <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5">
            <button onClick={() => setDensity('cards')} className={`h-8 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-semibold ${density === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}><LayoutGrid className="w-3.5 h-3.5" />Cards</button>
            <button onClick={() => setDensity('compact')} className={`h-8 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-semibold ${density === 'compact' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}><List className="w-3.5 h-3.5" />Compacto</button>
          </div>
          <button onClick={() => setManage(true)} className="h-9 px-4 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm"><Navigation className="w-3.5 h-3.5" />Gestão de entrega</button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {metrics.map(([label, value, tone]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
            <div className={`text-[24px] leading-none font-semibold tracking-tight ${tone}`}>{value}</div>
            <div className="text-[10px] uppercase tracking-[.08em] text-slate-400 mt-2">{label}</div>
          </div>
        ))}
      </div>

      <FleetBottleneckBanner orders={activeOrders} motoboys={motoboys} shift={shift} onSelectOrders={(orderIds) => setSelected(orderIds)} />

      {smartSuggestions.length > 0 && (
        <section className="rounded-xl border border-violet-200 bg-violet-50/70 p-3.5">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white border border-violet-200 grid place-items-center"><Sparkles className="w-4 h-4 text-violet-600" /></div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Rotas que combinam</h3>
                <p className="text-[11px] text-slate-500">Sugestões por trajeto, desvio e tempo de espera — não apenas por bairro.</p>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
            {smartSuggestions.map((suggestion) => (
              <button key={suggestion.id} onClick={() => setSelected(suggestion.orderIds)} className="text-left rounded-lg border border-violet-200 bg-white hover:border-violet-400 p-3 transition shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-900">{suggestion.orders.map(code).join(' + ')}</span>
                  <span className="text-[10px] font-semibold text-violet-700">{suggestion.confidenceScore}%</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5">{suggestion.corridorName}</p>
                <p className="text-[10px] text-slate-400 mt-1">{suggestion.interOrderDistanceKm.toFixed(1)} km entre entregas · espera máx. {suggestion.maxWaitMinutes} min</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {grouped.waiting.length > 0 && queueDrivers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-700"><Zap className="w-4 h-4 text-violet-600 shrink-0" /><span><b>{Math.min(grouped.waiting.length, queueDrivers.length)}</b> pedido(s) podem sair agora respeitando a fila.</span></div>
          <button onClick={assignOldestBatch} className="h-8 px-3 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-800 text-xs font-semibold whitespace-nowrap">Atribuir mais antigos</button>
        </div>
      )}

      {critical.slice(0, 3).map((o) => {
        const s = stage(o);
        const wait = s === 'ready' ? minsSince(readyStamp(o)) : minsSince(stamp(o));
        return (
          <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex-1 min-w-[260px]">
              <b className="text-sm text-red-800">{code(o)} {s === 'ready' ? 'pronto' : 'sem entregador'} há {duration(wait)}</b>
              <p className="text-xs text-slate-500 mt-0.5">{o.clientName} · {o.neighborhood || o.address}</p>
            </div>
            {!o.assignedMotoboyId && <button onClick={() => assignCritical(o)} className="h-8 px-3 rounded-lg bg-violet-600 text-white text-xs font-semibold">Atribuir 1º da fila</button>}
            <button onClick={() => onSelectOrderForTracking(o)} className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs">Ver pedido</button>
          </div>
        );
      })}

      {selected.length > 0 && (
        <div className="sticky top-2 z-30 bg-white border border-violet-200 shadow-lg rounded-xl px-3 py-2.5 flex items-center gap-2">
          <div className="flex items-center gap-2"><Route className="w-4 h-4 text-violet-600" /><b className="text-xs text-slate-900">{selected.length} selecionado(s)</b></div>
          <select value={batchDriver} onChange={(e) => setBatchDriver(e.target.value)} className="ml-auto h-8 min-w-[210px] bg-white border border-slate-200 text-slate-700 rounded-lg px-2 text-xs">
            <option value="">Escolher entregador...</option>
            {motoboys.filter((m) => m.status !== 'offline').map((m) => <option key={m.id} value={m.id}>{m.name} — {driverLabel(m)}</option>)}
          </select>
          <button disabled={!batchDriver} onClick={assignSelected} className="h-8 bg-violet-600 disabled:opacity-40 text-white rounded-lg px-3 text-xs font-semibold">Vincular</button>
          <button onClick={() => setSelected([])} className="w-8 h-8 grid place-items-center text-slate-500 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {columns.map(([id, title, sub, items]) => {
          const empty = emptyState[id];
          const hasLate = id === 'ready' && items.some((o) => minsSince(readyStamp(o)) >= 10);
          return (
            <section key={id} className="rounded-xl border border-slate-200 bg-white/70 overflow-hidden min-w-0">
              <div className="px-3.5 py-3 border-b border-slate-200 bg-white flex items-start justify-between gap-2">
                <div className="flex gap-2.5 min-w-0">
                  <span className={`w-1 self-stretch min-h-9 rounded-full ${stageTone[id]}`} />
                  <div><h3 className="text-sm font-semibold text-slate-900">{title}</h3><p className="text-[11px] text-slate-400 mt-0.5">{sub}</p></div>
                </div>
                <span className={`shrink-0 min-w-7 h-7 px-2 rounded-full grid place-items-center text-xs font-semibold ${hasLate ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{items.length}</span>
              </div>
              <div className={`p-2.5 min-h-[250px] max-h-[610px] overflow-y-auto ${density === 'compact' ? 'space-y-0.5' : 'space-y-2'}`}>
                {items.length ? items.map((o) => density === 'compact' ? <Row key={o.id} o={o} s={id} /> : <Card key={o.id} o={o} s={id} />) : (
                  <div className="h-[190px] flex flex-col items-center justify-center text-center px-5">
                    <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 grid place-items-center mb-3"><PackageOpen className="w-5 h-5 text-slate-300" /></div>
                    <p className="text-xs font-medium text-slate-600">{empty.title}</p>
                    <p className="text-[10px] leading-relaxed text-slate-400 mt-1.5 max-w-[220px]">{empty.subtitle}</p>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {manage && (
        <div className="fixed inset-0 z-[80] bg-black/50 p-4 flex items-center justify-center">
          <div className="w-full max-w-[1500px] h-[88vh] bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="px-5 py-3 border-b border-slate-200 flex justify-between">
              <div><h3 className="text-slate-900 text-base font-semibold">Gestão de entrega</h3><p className="text-xs text-slate-500 mt-1">Veja a fila, filtre apenas o que existe e acompanhe a operação em tempo real.</p></div>
              <button onClick={() => setManage(false)} className="w-9 h-9 grid place-items-center rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] flex-1 min-h-0">
              <div className="relative p-3 min-h-0">
                <div className="absolute top-6 left-6 z-[60] bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-[230px] space-y-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Mostrar no mapa</p>
                  <div className="flex gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                    {([['all', 'Tudo'], ['orders', 'Pedidos'], ['drivers', 'Entregadores']] as [MapMode, string][]).map(([id, label]) => {
                      const disabled = (id === 'orders' && activeOrders.length === 0) || (id === 'drivers' && driverFilterCount('all') === 0);
                      return <button key={id} disabled={disabled} onClick={() => chooseMode(id)} className={`flex-1 h-7 rounded-md text-[10px] font-semibold ${mapMode === id ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-800'} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}>{label}</button>;
                    })}
                  </div>
                  {mapMode !== 'drivers' && (
                    <div className="space-y-0.5">
                      <FilterCheck checked={mapOrderFilter === 'all'} label="Todos os pedidos" count={activeOrders.length} onClick={() => chooseOrderFilter('all')} />
                      {([['waiting', 'Sem entregador'], ['preparing', 'Atribuídos'], ['ready', 'Prontos'], ['route', 'Em entrega']] as [MapOrderFilter, string][]).map(([id, label]) => {
                        const n = orderFilterCount(id);
                        return <FilterCheck key={id} checked={mapOrderFilter === id} label={label} count={n} disabled={n === 0} onClick={() => chooseOrderFilter(id)} />;
                      })}
                    </div>
                  )}
                  {mapMode === 'all' && <div className="h-px bg-slate-100" />}
                  {mapMode !== 'orders' && (
                    <div className="space-y-0.5">
                      <FilterCheck checked={mapDriverFilter === 'all'} label="Todos os entregadores" count={driverFilterCount('all')} onClick={() => chooseDriverFilter('all')} />
                      {([['available', 'Livres na fila'], ['delivering', 'Em entrega'], ['returning_to_store', 'Voltando']] as [MapDriverFilter, string][]).map(([id, label]) => {
                        const n = driverFilterCount(id);
                        return <FilterCheck key={id} checked={mapDriverFilter === id} label={label} count={n} disabled={n === 0} onClick={() => chooseDriverFilter(id)} />;
                      })}
                    </div>
                  )}
                </div>
                <ReactiveRouteMap
                  origin={{ name: shift.storeName || 'Loja', address: shift.storeAddress || '', lat: shift.storeLat || -26.9194, lng: shift.storeLng || -49.0661 }}
                  stops={mapMode === 'drivers' ? [] : stops}
                  motoboysList={mapMode === 'orders' ? [] : mapDrivers}
                  selectedMotoboyId={focusDriverId}
                  onSelectMotoboy={(id: string | null) => setFocusDriverId(id)}
                />
              </div>
              <aside className="border-l border-slate-200 p-3 overflow-y-auto flex flex-col bg-slate-50/50">
                <div className="mb-3">
                  <div className="flex items-center gap-2"><Users className="w-4 h-4 text-violet-600" /><h4 className="text-sm font-semibold text-slate-900">Fila de saída</h4></div>
                  <p className="text-[10px] text-slate-400 mt-1">O primeiro entregador da lista é o próximo a receber rota.</p>
                </div>
                <div className="relative mb-2"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" /><input value={driverSearch} onChange={(e) => setDriverSearch(e.target.value)} placeholder="Buscar entregador" className="w-full pl-8 pr-2 h-8 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400" /></div>
                {(() => {
                  const list = sortedDrivers.filter((m) => !driverSearch || m.name.toLowerCase().includes(driverSearch.toLowerCase()));
                  if (!list.length) return <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-10"><div className="w-11 h-11 rounded-full bg-violet-50 flex items-center justify-center mb-3"><Bike className="w-5 h-5 text-violet-600" /></div><p className="text-sm font-medium text-slate-700">Nenhum entregador encontrado</p></div>;
                  return list.map((m) => {
                    const qi = queueIndex(m);
                    const focused = focusDriverId === m.id;
                    const active = activeOrders.filter((o) => o.assignedMotoboyId === m.id && !['delivered', 'cancelled'].includes(o.status));
                    return (
                      <button key={m.id} onClick={() => setFocusDriverId(focused ? null : m.id)} className={`w-full text-left border rounded-xl p-3 mb-2 shadow-sm transition ${focused ? 'border-violet-300 bg-violet-50' : qi === 0 ? 'border-violet-200 bg-white' : 'border-slate-200 bg-white'}`}>
                        <div className="flex justify-between gap-2">
                          <div><b className="text-sm text-slate-900">{m.name}</b><p className="text-xs text-slate-500 mt-1">{driverLabel(m)}</p></div>
                          {qi >= 0 ? <span className={`h-fit rounded-full px-2 py-1 text-[10px] font-bold ${qi === 0 ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{qi === 0 ? '1º · PRÓXIMO' : `${qi + 1}º DA FILA`}</span> : active.length ? <span className="h-fit rounded-full px-2 py-1 text-[10px] font-semibold bg-slate-100 text-slate-600">Com pedido</span> : <Bike className="w-4 h-4 text-slate-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2">{active.length} pedido(s) vinculados · {returnEta(m)}</p>
                        {m.status === 'returning_to_store' && <span onClick={(e) => { e.stopPropagation(); handleCallCounter(m.id, m.name); }} className="inline-block mt-2 text-xs font-semibold text-violet-700">Chamar no balcão</span>}
                      </button>
                    );
                  });
                })()}
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationDispatchView;
