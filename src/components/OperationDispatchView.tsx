import React, { useMemo, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  Navigation,
  Package,
  Phone,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Motoboy, Order, Stop, StoreShift } from '../types';
import ReactiveRouteMap from './ReactiveRouteMap';

interface OperationDispatchViewProps {
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

const money = (value = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const displayCode = (order: Order) => order.displayCode || `#${order.codeNumber}`;
const isRoute = (order: Order) => ['picked_up', 'in_transit', 'dispatched'].includes(order.status);
const isReady = (order: Order) => order.status === 'ready_at_counter';
const isPreparing = (order: Order) => Boolean(order.assignedMotoboyId) && !isReady(order) && !isRoute(order);

const stageFor = (order: Order): Stage => {
  if (isRoute(order)) return 'route';
  if (isReady(order)) return 'ready';
  if (isPreparing(order)) return 'preparing';
  return 'waiting';
};

const originLabel = (order: Order) => {
  if (order.originChannel === 'ifood') return 'iFood';
  if (order.originChannel === 'cardapio_web') {
    if (order.storeBranch === 'hope_burger') return 'Hope Burger';
    if (order.storeBranch === 'hope_pizza') return 'Hope Pizza';
    return 'Cardápio Web';
  }
  return 'Manual';
};

const driverLabel = (motoboy?: Motoboy) => {
  if (!motoboy) return 'Indisponível';
  if (motoboy.status === 'available') return 'Disponível';
  if (motoboy.status === 'delivering') return 'Em rota';
  if (motoboy.status === 'returning_to_store') return 'Voltando';
  if (motoboy.status === 'busy' || motoboy.status === 'paused') return 'Pausado';
  return 'Offline';
};

export const OperationDispatchView: React.FC<OperationDispatchViewProps> = (props) => {
  const {
    orders,
    motoboys,
    shift,
    activeOrders,
    motoboysAvailable,
    selectedMotoboyId,
    setSelectedMotoboyId,
    onOpenNewOrderModal,
    onOpenMotoboyModal,
    onSelectOrderForTracking,
    onUpdateOrderStatus,
    assignOrderRespectingLoad,
    handleCallCounter,
    triggerActionToast,
    setActiveTab,
  } = props;

  const [query, setQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [deliveryManagementOpen, setDeliveryManagementOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeOrders.filter((order) => {
      if (!q) return true;
      return `${displayCode(order)} ${order.clientName} ${order.address} ${order.neighborhood || ''} ${order.assignedMotoboyName || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [activeOrders, query]);

  const grouped = useMemo(() => ({
    waiting: filtered.filter((o) => stageFor(o) === 'waiting'),
    preparing: filtered.filter((o) => stageFor(o) === 'preparing'),
    ready: filtered.filter((o) => stageFor(o) === 'ready'),
    route: filtered.filter((o) => stageFor(o) === 'route'),
  }), [filtered]);

  const mapStops = useMemo<Stop[]>(() =>
    activeOrders
      .filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lng) && o.lat !== 0 && o.lng !== 0)
      .map((o, index) => ({
        id: o.id,
        codeNumber: o.codeNumber,
        orderIndex: index + 1,
        title: `${displayCode(o)} - ${o.clientName}`,
        recipientName: o.clientName,
        address: o.address,
        neighborhood: o.neighborhood,
        lat: o.lat,
        lng: o.lng,
        status: isRoute(o) ? 'in_transit' : 'pending',
        priority: 'medium',
        motoboyId: o.assignedMotoboyId || undefined,
        motoboyName: o.assignedMotoboyName || undefined,
      } as Stop)),
    [activeOrders]
  );

  const assignedByDriver = useMemo(() => {
    const result = new Map<string, Order[]>();
    motoboys.forEach((m) => result.set(m.id, []));
    activeOrders.forEach((o) => {
      if (!o.assignedMotoboyId) return;
      const list = result.get(o.assignedMotoboyId) || [];
      list.push(o);
      result.set(o.assignedMotoboyId, list.sort((a, b) => (a.routeSequence || 999) - (b.routeSequence || 999)));
    });
    return result;
  }, [activeOrders, motoboys]);

  const assign = (order: Order, motoboyId: string) => {
    if (order.assignedMotoboyId) return;
    assignOrderRespectingLoad(order.id, motoboyId);
    setSelectedOrderId(null);
    triggerActionToast(`${displayCode(order)} vinculado ao entregador e movido para Preparando.`);
  };

  const markReady = (order: Order) => {
    onUpdateOrderStatus(order.id, 'ready_at_counter');
    triggerActionToast(`${displayCode(order)} está pronto para retirada.`);
  };

  const columns: Array<{ id: Stage; title: string; subtitle: string; orders: Order[]; accent: string }> = [
    { id: 'waiting', title: 'Novos', subtitle: 'Sem entregador', orders: grouped.waiting, accent: 'text-amber-300' },
    { id: 'preparing', title: 'Preparando', subtitle: 'Já vinculados', orders: grouped.preparing, accent: 'text-orange-300' },
    { id: 'ready', title: 'Prontos', subtitle: 'Aguardando retirada', orders: grouped.ready, accent: 'text-emerald-300' },
    { id: 'route', title: 'Em entrega', subtitle: 'Na rua agora', orders: grouped.route, accent: 'text-blue-300' },
  ];

  const OrderCard = ({ order, stage }: { order: Order; stage: Stage }) => {
    const selected = selectedOrderId === order.id;
    return (
      <div className={`rounded-lg border bg-[#111318] ${selected ? 'border-violet-500' : 'border-slate-800'}`}>
        <button
          type="button"
          onClick={() => setSelectedOrderId(selected ? null : order.id)}
          className="w-full text-left p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <strong className="text-sm text-white">{displayCode(order)}</strong>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{originLabel(order)}</span>
              </div>
              <p className="text-xs text-slate-200 mt-1 truncate">{order.clientName}</p>
            </div>
            <strong className="text-xs text-white shrink-0">{money(order.total)}</strong>
          </div>
          <div className="mt-2 flex items-start gap-1.5 text-[10px] text-slate-500">
            <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{order.address}{order.neighborhood ? ` • ${order.neighborhood}` : ''}</span>
          </div>
          {order.assignedMotoboyName && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-violet-300">
              <Bike className="w-3 h-3" /> {order.assignedMotoboyName}
            </div>
          )}
        </button>

        {stage === 'preparing' && (
          <div className="px-3 pb-3">
            <button
              onClick={() => markReady(order)}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Pedido pronto
            </button>
          </div>
        )}

        {stage === 'ready' && (
          <div className="px-3 pb-3 text-[10px] text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Aguardando retirada por {order.assignedMotoboyName || 'entregador'}
          </div>
        )}

        {stage === 'route' && (
          <div className="px-3 pb-3 flex items-center justify-between gap-2">
            <span className="text-[10px] text-blue-300">{order.status === 'in_transit' ? 'Entrega atual' : 'Na rota'}</span>
            <button onClick={() => onSelectOrderForTracking(order)} className="text-[10px] text-violet-300">Rastrear</button>
          </div>
        )}

        {selected && stage === 'waiting' && (
          <div className="px-3 pb-3 border-t border-slate-800 pt-3">
            <select
              defaultValue=""
              onChange={(e) => e.target.value && assign(order, e.target.value)}
              className="w-full bg-violet-600 text-white rounded-lg px-3 py-2.5 text-xs outline-none"
            >
              <option value="" disabled>Vincular entregador...</option>
              {motoboys.map((m) => <option key={m.id} value={m.id} className="bg-slate-900">{m.name} — {driverLabel(m)}</option>)}
            </select>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl text-white">Pedidos & Despacho</h2>
          <p className="text-xs text-slate-400">A operação primeiro. O mapa fica dentro da gestão de entrega.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden md:block min-w-[320px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pedido, cliente, endereço ou motoboy" className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white outline-none" />
          </div>
          <button onClick={() => setDeliveryManagementOpen(true)} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs flex items-center gap-2">
            <Navigation className="w-4 h-4" /> Gestão de entrega
          </button>
          <button onClick={onOpenNewOrderModal} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-xs flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo pedido
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {columns.map((c) => (
          <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 flex items-center justify-between">
            <div><p className="text-[10px] text-slate-500">{c.title}</p><p className="text-[9px] text-slate-600">{c.subtitle}</p></div>
            <strong className={`text-xl ${c.accent}`}>{c.orders.length}</strong>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3 items-start">
        {columns.map((column) => (
          <section key={column.id} className="bg-[#0d1016] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-3 py-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm text-white">{column.title}</h3>
                <p className="text-[10px] text-slate-500">{column.subtitle}</p>
              </div>
              <span className={`text-sm ${column.accent}`}>{column.orders.length}</span>
            </div>
            <div className="p-2 space-y-2 max-h-[610px] overflow-y-auto min-h-[180px]">
              {column.orders.length === 0 ? (
                <div className="h-[150px] flex items-center justify-center text-center text-xs text-slate-600">
                  Nenhum pedido nesta etapa
                </div>
              ) : column.orders.map((order) => <OrderCard key={order.id} order={order} stage={column.id} />)}
            </div>
          </section>
        ))}
      </div>

      {deliveryManagementOpen && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm p-3 md:p-6 flex items-center justify-center">
          <div className="w-full max-w-[1500px] h-[88vh] bg-[#0b0d12] border border-slate-700 rounded-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base text-white">Gestão de Entrega</h3>
                <p className="text-[11px] text-slate-500">Rotas, entregadores e pedidos vinculados.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveTab('mapa')} className="text-xs text-violet-300 px-3 py-2">Mapa ao vivo completo</button>
                <button onClick={() => setDeliveryManagementOpen(false)} className="p-2 rounded-lg bg-slate-900 border border-slate-800"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_390px] gap-0 flex-1 min-h-0">
              <div className="p-3 min-h-0">
                <div className="h-full rounded-xl overflow-hidden border border-slate-800">
                  <ReactiveRouteMap
                    origin={{ name: shift.storeName || 'Loja', address: shift.storeAddress || '', lat: shift.storeLat, lng: shift.storeLng }}
                    stops={mapStops}
                    motoboysList={motoboys.filter((m) => m.status !== 'offline')}
                    selectedMotoboyId={selectedMotoboyId}
                    onSelectMotoboy={(id: string | null) => setSelectedMotoboyId(id)}
                  />
                </div>
              </div>

              <aside className="border-l border-slate-800 min-h-0 flex flex-col">
                <div className="px-3 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div><p className="text-sm text-white">Entregadores</p><p className="text-[10px] text-slate-500">{motoboysAvailable.length} disponíveis agora</p></div>
                  <button onClick={onOpenMotoboyModal} className="text-[10px] text-violet-300">Gerenciar</button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {motoboys.map((m) => {
                    const route = assignedByDriver.get(m.id) || [];
                    const selected = selectedMotoboyId === m.id;
                    return (
                      <div key={m.id} className={`rounded-xl border p-3 ${selected ? 'border-violet-500 bg-violet-950/20' : 'border-slate-800 bg-slate-950/60'}`}>
                        <button className="w-full text-left" onClick={() => setSelectedMotoboyId(selected ? null : m.id)}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2"><Bike className="w-4 h-4 text-blue-300"/><div><p className="text-xs text-white">{m.name}</p><p className="text-[10px] text-slate-500">{driverLabel(m)} • {route.length} pedido(s)</p></div></div>
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                          </div>
                        </button>
                        {route.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                            {route.map((o, idx) => (
                              <button key={o.id} onClick={() => onSelectOrderForTracking(o)} className="w-full text-left flex items-center gap-2 text-[10px]">
                                <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0">{idx + 1}</span>
                                <span className="text-slate-300 truncate">{displayCode(o)} • {o.neighborhood || o.address}</span>
                              </button>
                            ))}
                            <button onClick={() => handleCallCounter(m.id, m.name)} className="w-full mt-2 py-2 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-medium">Chamar no balcão</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationDispatchView;
