import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Motoboy, Order, StoreShift } from '../types';
import { RouteMap } from './RouteMap';
import { saveMotoboyLocationToCloud } from '../lib/firebase';
import {
  ArrowDown,
  ArrowUp,
  Bike,
  CheckCircle2,
  Clock3,
  DollarSign,
  History,
  LogOut,
  MapPin,
  Navigation,
  Package,
  Phone,
  Route,
  ShoppingBag,
} from 'lucide-react';

interface MotoboyAppProps {
  motoboys: Motoboy[];
  orders: Order[];
  shift: StoreShift;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onSimulateArrival: (order: Order) => void;
  onReorderMotoboyRoute?: (motoboyId: string, orderedOrderIds: string[]) => void;
  onConfirmArrivalAtStore?: (motoboyId: string) => void;
  onUpdateMotoboyStatus?: (motoboyId: string, status: Motoboy['status']) => void;
  initialMotoboyId?: string;
  isLockedToMotoboy?: boolean;
  onLogout?: () => void;
}

type Tab = 'orders' | 'route' | 'history';

const money = (value = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const routeStatus = (order: Order) => ['picked_up', 'in_transit', 'dispatched'].includes(order.status);

export const MotoboyApp: React.FC<MotoboyAppProps> = ({
  motoboys,
  orders,
  shift,
  onUpdateOrderStatus,
  onSimulateArrival,
  onReorderMotoboyRoute,
  onConfirmArrivalAtStore,
  onUpdateMotoboyStatus,
  initialMotoboyId,
  isLockedToMotoboy = false,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [deviceGps, setDeviceGps] = useState<{ lat: number; lng: number } | null>(null);
  const [arrivedOrderIds, setArrivedOrderIds] = useState<Record<string, boolean>>({});
  const [localRouteOrderIds, setLocalRouteOrderIds] = useState<string[]>([]);
  const wakeLockRef = useRef<any>(null);

  const activeMotoboy = useMemo(() => {
    if (!motoboys.length) return undefined;
    if (initialMotoboyId) return motoboys.find((m) => m.id === initialMotoboyId);
    return isLockedToMotoboy ? undefined : motoboys[0];
  }, [motoboys, initialMotoboyId, isLockedToMotoboy]);

  const matchesDriver = (order: Order) => Boolean(activeMotoboy?.id && order.assignedMotoboyId === activeMotoboy.id);

  const assignedOrders = useMemo(() =>
    orders
      .filter((o) => matchesDriver(o) && !['delivered', 'cancelled'].includes(o.status))
      .sort((a, b) => (a.routeSequence || 999) - (b.routeSequence || 999)),
    [orders, activeMotoboy?.id]
  );

  const preparingOrders = useMemo(() =>
    assignedOrders.filter((o) => o.status === 'pending' || o.status === 'preparing'),
    [assignedOrders]
  );

  const readyOrders = useMemo(() =>
    assignedOrders.filter((o) => o.status === 'ready_at_counter'),
    [assignedOrders]
  );

  const rawRouteOrders = useMemo(() =>
    assignedOrders.filter(routeStatus),
    [assignedOrders]
  );

  useEffect(() => {
    const currentIds = rawRouteOrders.map((o) => o.id);
    setLocalRouteOrderIds((prev) => {
      const kept = prev.filter((id) => currentIds.includes(id));
      const missing = currentIds.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
  }, [rawRouteOrders.map((o) => o.id).join('|')]);

  const routeOrders = useMemo(() => {
    const byId = new Map(rawRouteOrders.map((o) => [o.id, o]));
    const ordered = localRouteOrderIds.map((id) => byId.get(id)).filter(Boolean) as Order[];
    const missing = rawRouteOrders.filter((o) => !localRouteOrderIds.includes(o.id));
    return [...ordered, ...missing];
  }, [rawRouteOrders, localRouteOrderIds]);

  const currentRouteOrder = routeOrders.find((o) => o.status === 'in_transit' || o.status === 'dispatched') || routeOrders[0];
  const routeIsMoving = routeOrders.some((o) => o.status === 'in_transit' || o.status === 'dispatched');

  const completedOrders = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return orders.filter((o) => matchesDriver(o) && o.status === 'delivered' && (!o.deliveredDate || o.deliveredDate === today));
  }, [orders, activeMotoboy?.id]);

  const totalEarned = completedOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

  useEffect(() => {
    if (!activeMotoboy || !('geolocation' in navigator)) return;
    const success = (pos: GeolocationPosition) => {
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));
      setDeviceGps({ lat, lng });
      saveMotoboyLocationToCloud(activeMotoboy.id, lat, lng);
    };
    navigator.geolocation.getCurrentPosition(success, () => {}, { enableHighAccuracy: true, timeout: 10000 });
    const id = navigator.geolocation.watchPosition(success, () => {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 4000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [activeMotoboy?.id]);

  useEffect(() => {
    const request = async () => {
      try {
        if ('wakeLock' in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch {}
    };
    request();
    return () => { try { wakeLockRef.current?.release?.(); } catch {} };
  }, []);

  const persistRouteOrder = (ids: string[]) => {
    setLocalRouteOrderIds(ids);
    if (activeMotoboy) onReorderMotoboyRoute?.(activeMotoboy.id, ids);
  };

  const moveRoute = (index: number, direction: -1 | 1) => {
    if (routeIsMoving) return;
    const next = [...routeOrders.map((o) => o.id)];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    persistRouteOrder(next);
  };

  const routeAddress = (o: Order) => (o.lat && o.lng ? `${o.lat},${o.lng}` : o.address);

  const openGoogleRoute = (fromOrderId?: string) => {
    let remaining = routeOrders;
    if (fromOrderId) {
      const idx = routeOrders.findIndex((o) => o.id === fromOrderId);
      if (idx >= 0) remaining = routeOrders.slice(idx);
    }
    if (!remaining.length) return;

    const destination = encodeURIComponent(routeAddress(remaining[remaining.length - 1]));
    const waypoints = remaining.slice(0, -1).map((o) => routeAddress(o)).join('|');
    const origin = deviceGps ? `&origin=${encodeURIComponent(`${deviceGps.lat},${deviceGps.lng}`)}` : '';
    const waypointParam = waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '';
    window.open(`https://www.google.com/maps/dir/?api=1${origin}&destination=${destination}${waypointParam}&travelmode=driving`, '_blank');
  };

  const startCurrentStop = (order: Order) => {
    routeOrders.forEach((o) => {
      if (o.id !== order.id && (o.status === 'in_transit' || o.status === 'dispatched')) {
        onUpdateOrderStatus(o.id, 'picked_up');
      }
    });
    if (order.status === 'picked_up') onUpdateOrderStatus(order.id, 'in_transit');
    if (activeMotoboy) onUpdateMotoboyStatus?.(activeMotoboy.id, 'delivering');
    setArrivedOrderIds((prev) => ({ ...prev, [order.id]: false }));
    openGoogleRoute(order.id);
  };

  const confirmArrival = (order: Order) => {
    setArrivedOrderIds((prev) => ({ ...prev, [order.id]: true }));
    onSimulateArrival(order);
  };

  const finishCurrentDelivery = (order: Order) => {
    onUpdateOrderStatus(order.id, 'delivered');
    setArrivedOrderIds((prev) => {
      const next = { ...prev };
      delete next[order.id];
      return next;
    });
  };

  if (!activeMotoboy && isLockedToMotoboy) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
        <h3 className="text-lg font-semibold">Entregador não encontrado</h3>
        <button onClick={onLogout} className="mt-4 w-full py-3 bg-slate-900 text-white rounded-xl">Voltar ao login</button>
      </div>
    );
  }

  if (!activeMotoboy) return null;

  return (
    <div className="w-full max-w-md mx-auto bg-slate-100 text-slate-900 min-h-[720px] rounded-2xl overflow-hidden border border-slate-200">
      <header className="bg-slate-950 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-semibold">{activeMotoboy.name.charAt(0).toUpperCase()}</div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{activeMotoboy.name}</h2>
            <p className="text-[11px] text-slate-400">{routeIsMoving ? 'Em rota' : readyOrders.length ? 'Pedido pronto para retirada' : preparingOrders.length ? 'Aguardando cozinha' : 'Disponível'}</p>
          </div>
        </div>
        <button onClick={onLogout} className="p-2 rounded-lg bg-slate-900 text-slate-400"><LogOut className="w-4 h-4" /></button>
      </header>

      <div className="grid grid-cols-3 gap-2 p-3 bg-white border-b border-slate-200">
        <div className="rounded-xl border border-slate-200 p-2 text-center"><ShoppingBag className="w-4 h-4 mx-auto text-slate-500"/><strong className="block text-lg mt-1">{routeOrders.length}</strong><span className="text-[9px] text-slate-500">na rota</span></div>
        <div className="rounded-xl border border-slate-200 p-2 text-center"><Package className="w-4 h-4 mx-auto text-slate-500"/><strong className="block text-lg mt-1">{completedOrders.length}</strong><span className="text-[9px] text-slate-500">entregues</span></div>
        <div className="rounded-xl border border-slate-200 p-2 text-center"><DollarSign className="w-4 h-4 mx-auto text-slate-500"/><strong className="block text-sm mt-1">{money(totalEarned)}</strong><span className="text-[9px] text-slate-500">hoje</span></div>
      </div>

      <nav className="grid grid-cols-3 gap-1.5 p-2 bg-slate-100 border-b border-slate-200">
        <button onClick={() => setActiveTab('orders')} className={`py-2.5 rounded-lg text-xs ${activeTab === 'orders' ? 'bg-slate-950 text-white' : 'bg-white border border-slate-200'}`}>Pedidos ({preparingOrders.length + readyOrders.length})</button>
        <button onClick={() => setActiveTab('route')} className={`py-2.5 rounded-lg text-xs ${activeTab === 'route' ? 'bg-slate-950 text-white' : 'bg-white border border-slate-200'}`}>Minha rota ({routeOrders.length})</button>
        <button onClick={() => setActiveTab('history')} className={`py-2.5 rounded-lg text-xs ${activeTab === 'history' ? 'bg-slate-950 text-white' : 'bg-white border border-slate-200'}`}>Histórico</button>
      </nav>

      <main className="p-3 space-y-3">
        {activeTab === 'orders' && (
          <>
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Preparando</h3><p className="text-[10px] text-slate-500">Já vinculados a você</p></div><span className="text-sm text-amber-600">{preparingOrders.length}</span></div>
              <div className="p-2 space-y-2">
                {preparingOrders.length === 0 ? <p className="text-xs text-slate-400 text-center py-5">Nenhum pedido em preparo.</p> : preparingOrders.map((o) => (
                  <div key={o.id} className="rounded-lg bg-amber-50 border border-amber-200 p-3"><div className="flex items-start justify-between gap-2"><div><strong className="text-sm">#{o.codeNumber}</strong><p className="text-xs mt-1">{o.clientName}</p><p className="text-[10px] text-slate-500 mt-1">{o.neighborhood || o.address}</p></div><Clock3 className="w-4 h-4 text-amber-600"/></div><p className="text-[10px] text-amber-700 mt-2">Aguarde a loja marcar como pronto.</p></div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Prontos para retirada</h3><p className="text-[10px] text-slate-500">Confirme cada pedido que colocou na bag</p></div><span className="text-sm text-emerald-600">{readyOrders.length}</span></div>
              <div className="p-2 space-y-2">
                {readyOrders.length === 0 ? <p className="text-xs text-slate-400 text-center py-5">Nenhum pedido pronto agora.</p> : readyOrders.map((o) => (
                  <div key={o.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><div className="flex items-start justify-between"><div><strong className="text-sm">#{o.codeNumber} • {o.clientName}</strong><p className="text-[10px] text-slate-500 mt-1">{o.address}</p></div><CheckCircle2 className="w-4 h-4 text-emerald-600"/></div><button onClick={() => { onUpdateOrderStatus(o.id, 'picked_up'); setActiveTab('route'); }} className="w-full mt-3 py-3 rounded-lg bg-amber-400 text-slate-950 text-sm font-medium">Confirmar retirada #{o.codeNumber}</button></div>
                ))}
              </div>
            </section>

            {!preparingOrders.length && !readyOrders.length && !routeOrders.length && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                {activeMotoboy.status === 'returning_to_store' ? (
                  <><Bike className="w-8 h-8 mx-auto text-slate-400"/><h3 className="mt-3 font-semibold">Voltando para a loja</h3><button onClick={() => onConfirmArrivalAtStore?.(activeMotoboy.id)} className="w-full mt-4 py-3 bg-slate-950 text-white rounded-lg">Cheguei à loja</button></>
                ) : (
                  <><Package className="w-8 h-8 mx-auto text-slate-400"/><h3 className="mt-3 font-semibold">Sem pedidos vinculados</h3><p className="text-xs text-slate-500 mt-1">Aguarde a loja enviar a próxima entrega.</p></>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'route' && (
          <>
            {routeOrders.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-7 text-center"><Route className="w-9 h-9 mx-auto text-slate-400"/><h3 className="mt-3 font-semibold">Sua rota está vazia</h3><p className="text-xs text-slate-500 mt-1">Confirme a retirada de um pedido para adicionar à rota.</p></div>
            ) : (
              <>
                <section className="bg-slate-950 text-white rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Ordem da rota</h3><p className="text-[10px] text-slate-400">{routeIsMoving ? 'Rota iniciada: sequência bloqueada' : 'Escolha qual entrega será 1ª, 2ª, 3ª...'}</p></div><Navigation className="w-5 h-5 text-violet-300"/></div>
                  <div className="space-y-1.5">
                    {routeOrders.map((o, index) => (
                      <div key={o.id} className={`rounded-lg border p-2.5 flex items-center gap-2 ${currentRouteOrder?.id === o.id ? 'border-violet-500 bg-violet-950/30' : 'border-slate-800 bg-slate-900'}`}>
                        <span className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs shrink-0">{index + 1}</span>
                        <div className="min-w-0 flex-1"><p className="text-xs truncate">#{o.codeNumber} • {o.clientName}</p><p className="text-[10px] text-slate-500 truncate">{o.neighborhood || o.address}</p></div>
                        {!routeIsMoving && <div className="flex gap-1"><button disabled={index === 0} onClick={() => moveRoute(index, -1)} className="p-1.5 rounded bg-slate-800 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5"/></button><button disabled={index === routeOrders.length - 1} onClick={() => moveRoute(index, 1)} className="p-1.5 rounded bg-slate-800 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5"/></button></div>}
                      </div>
                    ))}
                  </div>
                  {!routeIsMoving && currentRouteOrder && <button onClick={() => startCurrentStop(currentRouteOrder)} className="w-full py-3 rounded-lg bg-violet-600 text-white text-sm font-medium flex items-center justify-center gap-2"><Navigation className="w-4 h-4"/> Iniciar rota e navegar</button>}
                  {routeIsMoving && <button onClick={() => openGoogleRoute(currentRouteOrder?.id)} className="w-full py-3 rounded-lg bg-sky-600 text-white text-sm font-medium flex items-center justify-center gap-2"><Navigation className="w-4 h-4"/> Navegar rota restante</button>}
                </section>

                <div className="h-[220px] rounded-xl overflow-hidden border border-slate-200 bg-white">
                  <RouteMap
                    origin={{ name: shift.storeName || 'Loja', address: shift.storeAddress, lat: shift.storeLat, lng: shift.storeLng }}
                    motoboyName={activeMotoboy.name}
                    showMotoboyMarker
                    motoboyLat={deviceGps?.lat || activeMotoboy.currentLat}
                    motoboyLng={deviceGps?.lng || activeMotoboy.currentLng}
                    stops={routeOrders.map((o, idx) => ({ id:o.id, orderIndex:idx+1, title:`#${o.codeNumber} - ${o.clientName}`, address:o.address, neighborhood:o.neighborhood, lat:o.lat, lng:o.lng, status:o.status === 'in_transit' ? 'in_transit' : 'pending', priority:'high', recipientName:o.clientName }))}
                  />
                </div>

                {routeOrders.map((order, index) => {
                  const isCurrent = currentRouteOrder?.id === order.id;
                  const arrived = Boolean(arrivedOrderIds[order.id]);
                  return (
                    <article key={order.id} className={`rounded-xl border overflow-hidden bg-white ${isCurrent ? 'border-violet-400 shadow-sm' : 'border-slate-200 opacity-80'}`}>
                      <div className={`px-3 py-2.5 flex items-center justify-between ${isCurrent ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}><span className="text-xs font-medium">{isCurrent ? 'ENTREGA ATUAL' : `${index + 1}ª PARADA`}</span><strong className="text-sm">#{order.codeNumber}</strong></div>
                      <div className="p-3 space-y-3">
                        <div><p className="text-[10px] text-slate-500 uppercase">{order.neighborhood}</p><h3 className="text-lg font-semibold mt-1">{order.street || order.address}</h3><p className="text-xs text-slate-500 mt-1">{order.clientName}</p></div>

                        {isCurrent ? (
                          <>
                            {order.status === 'picked_up' && <button onClick={() => startCurrentStop(order)} className="w-full py-3 bg-violet-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"><Navigation className="w-4 h-4"/> Iniciar esta parada</button>}
                            {(order.status === 'in_transit' || order.status === 'dispatched') && !arrived && <button onClick={() => confirmArrival(order)} className="w-full py-3 bg-slate-950 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"><MapPin className="w-4 h-4 text-emerald-400"/> Confirmar chegada</button>}
                            {(order.status === 'in_transit' || order.status === 'dispatched') && arrived && <button onClick={() => finishCurrentDelivery(order)} className="w-full py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4"/> Confirmar entrega</button>}
                            <div className="grid grid-cols-2 gap-2"><button onClick={() => openGoogleRoute(order.id)} className="py-2.5 bg-sky-600 text-white rounded-lg text-xs flex items-center justify-center gap-1.5"><Navigation className="w-4 h-4"/> Navegar</button>{order.clientPhone ? <a href={`tel:${order.clientPhone.replace(/\D/g,'')}`} className="py-2.5 bg-slate-800 text-white rounded-lg text-xs flex items-center justify-center gap-1.5"><Phone className="w-4 h-4"/> Ligar</a> : <div className="py-2.5 bg-slate-200 text-slate-500 rounded-lg text-xs text-center">Sem telefone</div>}</div>
                          </>
                        ) : (
                          <div className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-500">Bloqueado até concluir a parada anterior.</div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-3 py-3 border-b border-slate-200 flex items-center gap-2"><History className="w-4 h-4 text-slate-500"/><div><h3 className="text-sm font-semibold">Entregas de hoje</h3><p className="text-[10px] text-slate-500">{completedOrders.length} concluídas • {money(totalEarned)}</p></div></div>
            <div className="p-2 space-y-2">{completedOrders.length === 0 ? <p className="text-xs text-slate-400 text-center py-6">Nenhuma entrega concluída hoje.</p> : completedOrders.map((o) => <div key={o.id} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between"><div><strong className="text-sm">#{o.codeNumber}</strong><p className="text-xs text-slate-500">{o.clientName} • {o.neighborhood}</p></div><span className="text-xs text-emerald-600">+ {money(o.deliveryFee)}</span></div>)}</div>
          </section>
        )}
      </main>
    </div>
  );
};
