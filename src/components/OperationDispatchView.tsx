import React, { useMemo, useState } from 'react';
import { Bike, MapPin, Package, Phone, Plus, Search } from 'lucide-react';
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

const money = (value = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const displayCode = (order: Order) => order.displayCode || `#${order.codeNumber}`;

const orderStatusLabel = (order: Order) => {
  if (order.status === 'in_transit' || order.status === 'dispatched') return 'Em rota';
  if (order.status === 'ready_at_counter' || order.status === 'picked_up') return 'Pronto';
  if (order.status === 'preparing') return 'Preparando';
  return 'Novo';
};

const driverStatusLabel = (motoboy: Motoboy) => {
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
    unassignedOrders,
    motoboysAvailable,
    selectedMotoboyId,
    setSelectedMotoboyId,
    onOpenNewOrderModal,
    onOpenMotoboyModal,
    onSelectOrderForTracking,
    assignOrderRespectingLoad,
    setActiveTab,
  } = props;

  const [query, setQuery] = useState('');
  const [orderFilter, setOrderFilter] = useState<'all' | 'waiting' | 'route'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(activeOrders[0]?.id || null);
  const [sideMode, setSideMode] = useState<'orders' | 'drivers'>('orders');

  const visibleOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeOrders.filter((order) => {
      const matchesSearch =
        !q ||
        `${displayCode(order)} ${order.clientName} ${order.address} ${order.neighborhood || ''}`
          .toLowerCase()
          .includes(q);
      const matchesFilter =
        orderFilter === 'all' ||
        (orderFilter === 'waiting' && !['in_transit', 'dispatched'].includes(order.status)) ||
        (orderFilter === 'route' && ['in_transit', 'dispatched'].includes(order.status));
      return matchesSearch && matchesFilter;
    });
  }, [activeOrders, query, orderFilter]);

  const selectedOrder = activeOrders.find((order) => order.id === selectedOrderId) || null;

  const mapStops: Stop[] = useMemo(
    () =>
      activeOrders
        .filter(
          (order) =>
            typeof order.lat === 'number' &&
            order.lat !== 0 &&
            typeof order.lng === 'number' &&
            order.lng !== 0
        )
        .map((order, index) => ({
          id: order.id,
          codeNumber: order.codeNumber,
          orderIndex: index + 1,
          name: order.clientName,
          title: `${displayCode(order)} - ${order.clientName}`,
          recipientName: order.clientName,
          phone: order.clientPhone,
          address: order.address,
          neighborhood: order.neighborhood,
          lat: order.lat,
          lng: order.lng,
          status: ['in_transit', 'dispatched'].includes(order.status) ? 'in_transit' : 'pending',
          priority: 'medium',
          valueToReceive: order.total,
          motoboyId: order.assignedMotoboyId || undefined,
          motoboyName: order.assignedMotoboyName || undefined,
        } as Stop)),
    [activeOrders]
  );

  const activeDrivers = motoboys.filter((motoboy) => motoboy.status !== 'offline');
  const returningCount = motoboys.filter((motoboy) => motoboy.status === 'returning_to_store').length;
  const routeCount = activeOrders.filter((order) => ['in_transit', 'dispatched'].includes(order.status)).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Central de Despacho</h2>
          <p className="text-xs text-slate-400">Mapa, pedidos e entregadores no mesmo lugar.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-[300px] hidden md:block">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar pedido, cliente ou endereço..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-violet-500"
            />
          </div>
          <button
            onClick={onOpenNewOrderModal}
            className="bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2 text-xs font-black flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Novo pedido
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-slate-500">Aguardando</p>
          <strong className="text-lg text-amber-300">{unassignedOrders.length}</strong>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-slate-500">Em rota</p>
          <strong className="text-lg text-blue-300">{routeCount}</strong>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-slate-500">Motoboys livres</p>
          <strong className="text-lg text-emerald-300">{motoboysAvailable.length}</strong>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-slate-500">Voltando</p>
          <strong className="text-lg text-orange-300">{returningCount}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_350px] gap-3 min-h-[680px]">
        <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden min-h-[680px] flex flex-col">
          <div className="px-3 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {([
                ['all', 'Todos', activeOrders.length],
                ['waiting', 'Aguardando', activeOrders.length - routeCount],
                ['route', 'Em rota', routeCount],
              ] as const).map(([id, label, count]) => (
                <button
                  key={id}
                  onClick={() => setOrderFilter(id)}
                  className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold ${
                    orderFilter === id
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
            <button
              onClick={() => setActiveTab('mapa')}
              className="text-[11px] font-bold text-violet-400 hover:text-violet-300"
            >
              Abrir mapa completo ↗
            </button>
          </div>

          {!shift.storeAddress?.trim() && (
            <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200">
              ⚠ Configure o endereço da loja para centralizar corretamente o mapa.
            </div>
          )}

          <div className="flex-1 min-h-[580px] p-3">
            <div className="w-full h-full min-h-[580px] rounded-xl overflow-hidden border border-slate-800">
              <ReactiveRouteMap
                origin={{
                  name: shift.storeName || 'Loja',
                  address: shift.storeAddress || '',
                  lat: shift.storeLat || -26.9194,
                  lng: shift.storeLng || -49.0661,
                }}
                stops={mapStops}
                motoboysList={activeDrivers}
                selectedStopId={selectedOrderId}
                selectedMotoboyId={selectedMotoboyId}
                onSelectStop={(stop: Stop) => {
                  setSelectedOrderId(stop.id || null);
                  setSideMode('orders');
                }}
                onSelectMotoboy={(motoboyId: string | null) => {
                  setSelectedMotoboyId(motoboyId);
                  setSideMode('drivers');
                }}
              />
            </div>
          </div>
        </section>

        <aside className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden min-h-[680px] flex flex-col">
          <div className="grid grid-cols-2 border-b border-slate-800">
            <button
              onClick={() => setSideMode('orders')}
              className={`py-3 text-xs font-black ${sideMode === 'orders' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              📦 Pedidos ({visibleOrders.length})
            </button>
            <button
              onClick={() => setSideMode('drivers')}
              className={`py-3 text-xs font-black ${sideMode === 'drivers' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              🛵 Motoboys ({activeDrivers.length})
            </button>
          </div>

          {sideMode === 'orders' ? (
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {visibleOrders.length === 0 && (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-6">
                  <Package className="w-10 h-10 text-slate-600 mb-3" />
                  <p className="text-sm font-bold text-slate-300">Nenhum pedido agora</p>
                  <p className="text-xs text-slate-500 mt-1">Novos pedidos aparecerão aqui.</p>
                </div>
              )}

              {visibleOrders.map((order) => {
                const selected = selectedOrderId === order.id;
                return (
                  <div
                    key={order.id}
                    className={`rounded-xl border p-3 transition ${
                      selected ? 'bg-violet-950/30 border-violet-500' : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <button className="w-full text-left" onClick={() => setSelectedOrderId(order.id)}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm text-white">{displayCode(order)}</strong>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            ['in_transit', 'dispatched'].includes(order.status)
                              ? 'bg-blue-500/15 text-blue-300'
                              : 'bg-rose-500/15 text-rose-300'
                          }`}>
                            {orderStatusLabel(order)}
                          </span>
                        </div>
                        <span className="text-xs font-black text-white">{money(order.total)}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-200 mt-2">{order.clientName}</p>
                      <p className="text-[10px] text-slate-500 mt-1 flex gap-1 items-start">
                        <MapPin className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{order.address}{order.neighborhood ? ` - ${order.neighborhood}` : ''}</span>
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[9px] text-slate-500">
                        <span>{order.originChannel === 'cardapio_web' ? 'Cardápio Web' : 'Pedido manual'}</span>
                        <span>{order.createdAt || ''}</span>
                      </div>
                    </button>

                    {selected && (
                      <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) assignOrderRespectingLoad(order.id, e.target.value);
                          }}
                          className="w-full bg-violet-600 text-white font-black rounded-lg px-3 py-2.5 text-xs outline-none"
                        >
                          <option value="" disabled>🛵 Despachar com...</option>
                          {motoboys.map((motoboy) => (
                            <option key={motoboy.id} value={motoboy.id} className="bg-slate-900">
                              {motoboy.name} — {driverStatusLabel(motoboy)}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => onSelectOrderForTracking(order)}
                          className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-2 text-[10px] font-bold text-slate-200"
                        >
                          Ver rastreio e detalhes
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              <div className="flex justify-end px-1 pb-1">
                <button onClick={onOpenMotoboyModal} className="text-[10px] text-violet-400 font-bold">Gerenciar entregadores</button>
              </div>
              {motoboys.map((motoboy) => {
                const load = orders.filter(
                  (order) =>
                    order.assignedMotoboyId === motoboy.id &&
                    !['delivered', 'cancelled'].includes(order.status)
                ).length;
                const selected = selectedMotoboyId === motoboy.id;
                const dot = motoboy.status === 'available'
                  ? 'bg-emerald-400'
                  : motoboy.status === 'delivering'
                  ? 'bg-blue-400'
                  : motoboy.status === 'returning_to_store'
                  ? 'bg-amber-400'
                  : 'bg-slate-500';

                return (
                  <button
                    key={motoboy.id}
                    onClick={() => setSelectedMotoboyId(selected ? null : motoboy.id)}
                    className={`w-full text-left rounded-xl border p-3 ${
                      selected ? 'bg-violet-950/30 border-violet-500' : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-black text-slate-200 shrink-0">
                          {motoboy.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-white truncate">{motoboy.name}</p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <span className={`w-2 h-2 rounded-full ${dot}`} />
                            {driverStatusLabel(motoboy)}
                          </p>
                          <p className="text-[9px] text-slate-500 mt-0.5">{load} entrega(s) ativa(s)</p>
                        </div>
                      </div>
                      {motoboy.phone && <Phone className="w-3.5 h-3.5 text-slate-500" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="border-t border-slate-800 px-3 py-2.5 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[9px] text-slate-500">Disponíveis</p>
              <strong className="text-xs text-emerald-300">{motoboysAvailable.length}</strong>
            </div>
            <div>
              <p className="text-[9px] text-slate-500">Em rota</p>
              <strong className="text-xs text-blue-300">{motoboys.filter((m) => m.status === 'delivering').length}</strong>
            </div>
            <div>
              <p className="text-[9px] text-slate-500">Voltando</p>
              <strong className="text-xs text-amber-300">{returningCount}</strong>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default OperationDispatchView;
