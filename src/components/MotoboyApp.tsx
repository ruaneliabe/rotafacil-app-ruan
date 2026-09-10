import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bike,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  History,
  Info,
  KeyRound,
  LogOut,
  Map,
  MapPin,
  Navigation,
  Package,
  RefreshCw,
  Route,
  ShoppingBag,
  X,
} from 'lucide-react';
import { Motoboy, Order, StoreShift } from '../types';
import { RouteMap } from './RouteMap';
import { saveMotoboyLocationToCloud, changeMotoboyPassword } from '../lib/firebase';
import { verifyCredential } from '../lib/passwordSecurity';
import { getBrazilDateKey } from '../utils/dateUtils';

interface Props {
  motoboys: Motoboy[];
  orders: Order[];
  shift: StoreShift;
  onUpdateOrderStatus: (id: string, status: Order['status']) => void;
  onSimulateArrival: (order: Order) => void;
  onReorderMotoboyRoute?: (id: string, ids: string[]) => void;
  onConfirmArrivalAtStore?: (id: string) => void;
  onUpdateMotoboyStatus?: (id: string, status: Motoboy['status']) => void;
  initialMotoboyId?: string;
  isLockedToMotoboy?: boolean;
  onLogout?: () => void;
}

type Tab = 'orders' | 'route' | 'history';
type NavRequest = { from?: string; fullRoute: boolean } | null;

const money = (value = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const routeStatus = (order: Order) => ['picked_up', 'in_transit', 'dispatched'].includes(order.status);

const isFinalized = (order: Order) => {
  const anyOrder = order as any;
  return (
    order.status === 'delivered' ||
    order.status === 'cancelled' ||
    Boolean(order.deliveredTimestamp) ||
    Boolean(order.deliveredAt) ||
    Boolean(order.deliveredDate) ||
    anyOrder.closedInCardapioWeb === true ||
    Boolean(anyOrder.closedAt)
  );
};

const isDelivered = (order: Order) => {
  const anyOrder = order as any;
  return (
    order.status === 'delivered' ||
    Boolean(order.deliveredTimestamp) ||
    Boolean(order.deliveredAt) ||
    Boolean(order.deliveredDate) ||
    anyOrder.closedInCardapioWeb === true ||
    Boolean(anyOrder.closedAt)
  );
};

const deliveryDayKey = (order: Order) => {
  if (order.deliveredDate && /^\d{4}-\d{2}-\d{2}$/.test(order.deliveredDate)) return order.deliveredDate;
  if (order.deliveredTimestamp) return getBrazilDateKey(new Date(order.deliveredTimestamp));
  if (order.shiftDate && /^\d{4}-\d{2}-\d{2}$/.test(order.shiftDate)) return order.shiftDate;
  if (order.createdDate && /^\d{4}-\d{2}-\d{2}$/.test(order.createdDate)) return order.createdDate;
  if (order.createdTimestamp) return getBrazilDateKey(new Date(order.createdTimestamp));
  return '';
};

const formatTime = (order: Order) => {
  const raw = order.deliveredTimestamp || order.deliveredAt || order.createdTimestamp || order.createdAt;
  const date = new Date(raw as any);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const MotoboyApp: React.FC<Props> = ({
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
  const [tab, setTab] = useState<Tab>('orders');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [arrived, setArrived] = useState<Record<string, boolean>>({});
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [navRequest, setNavRequest] = useState<NavRequest>(null);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const wake = useRef<any>(null);

  const driver = useMemo(
    () =>
      initialMotoboyId
        ? motoboys.find((m) => m.id === initialMotoboyId)
        : isLockedToMotoboy
          ? undefined
          : motoboys[0],
    [motoboys, initialMotoboyId, isLockedToMotoboy]
  );

  const mine = (order: Order) => !!driver && order.assignedMotoboyId === driver.id;
  const assigned = useMemo(
    () =>
      orders
        .filter((order) => mine(order) && !isFinalized(order))
        .sort((a, b) => (a.routeSequence || 999) - (b.routeSequence || 999)),
    [orders, driver?.id]
  );

  const preparing = assigned.filter((order) => ['pending', 'preparing'].includes(order.status));
  const ready = assigned.filter((order) => order.status === 'ready_at_counter');
  const rawRoute = assigned.filter(routeStatus);

  useEffect(() => {
    const ids = rawRoute.map((order) => order.id);
    setOrderIds((prev) => [
      ...prev.filter((id) => ids.includes(id)),
      ...ids.filter((id) => !prev.includes(id)),
    ]);
  }, [rawRoute.map((order) => order.id).join('|')]);

  const route = useMemo(() => {
    const map = new globalThis.Map(rawRoute.map((order) => [order.id, order]));
    return [
      ...(orderIds.map((id) => map.get(id)).filter(Boolean) as Order[]),
      ...rawRoute.filter((order) => !orderIds.includes(order.id)),
    ];
  }, [rawRoute, orderIds]);

  const activeRun = driver?.status === 'delivering' && route.length > 0;
  const inQueue = driver?.status === 'available';
  const returning = driver?.status === 'returning_to_store';
  const current = route.find((order) => ['in_transit', 'dispatched'].includes(order.status)) || route[0];
  const todayKey = getBrazilDateKey();
  const completed = orders
    .filter((order) => mine(order) && isDelivered(order) && deliveryDayKey(order) === todayKey)
    .sort((a, b) => {
      const aa = Number(a.deliveredTimestamp || Date.parse(String(a.deliveredAt || a.createdAt)) || 0);
      const bb = Number(b.deliveredTimestamp || Date.parse(String(b.deliveredAt || b.createdAt)) || 0);
      return bb - aa;
    });
  const earned = completed.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);

  useEffect(() => {
    if (!driver || !navigator.geolocation) return;
    const success = (position: GeolocationPosition) => {
      const lat = +position.coords.latitude.toFixed(6);
      const lng = +position.coords.longitude.toFixed(6);
      setGps({ lat, lng });
      saveMotoboyLocationToCloud(driver.id, lat, lng);
    };
    navigator.geolocation.getCurrentPosition(success, () => {}, { enableHighAccuracy: true });
    const id = navigator.geolocation.watchPosition(success, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 4000,
    });
    return () => navigator.geolocation.clearWatch(id);
  }, [driver?.id]);

  useEffect(() => {
    (async () => {
      try {
        if ('wakeLock' in navigator) wake.current = await (navigator as any).wakeLock.request('screen');
      } catch {}
    })();
    return () => {
      try {
        wake.current?.release?.();
      } catch {}
    };
  }, []);

  const persist = (ids: string[]) => {
    setOrderIds(ids);
    if (driver) onReorderMotoboyRoute?.(driver.id, ids);
  };

  const move = (index: number, direction: -1 | 1) => {
    if (activeRun) return;
    const ids = route.map((order) => order.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    persist(ids);
  };

  const addressForNav = (order: Order) =>
    order.lat && order.lng ? `${order.lat},${order.lng}` : order.address;

  const remainingRoute = (from?: string) => {
    if (!from) return route;
    const index = route.findIndex((order) => order.id === from);
    return index >= 0 ? route.slice(index) : route;
  };

  const openGoogle = () => {
    if (!navRequest) return;
    const r = navRequest.fullRoute
      ? remainingRoute(navRequest.from)
      : remainingRoute(navRequest.from).slice(0, 1);
    if (!r.length) return;
    const destination = encodeURIComponent(addressForNav(r[r.length - 1]));
    const waypoints = r.slice(0, -1).map(addressForNav).join('|');
    const origin = gps ? `&origin=${encodeURIComponent(`${gps.lat},${gps.lng}`)}` : '';
    const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${destination}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=driving`;
    setNavRequest(null);
    window.location.href = url;
  };

  const openWaze = () => {
    if (!navRequest) return;
    const target = remainingRoute(navRequest.from)[0];
    if (!target) return;
    const destination = target.lat && target.lng
      ? `ll=${target.lat},${target.lng}`
      : `q=${encodeURIComponent(target.address)}`;
    setNavRequest(null);
    window.location.href = `https://waze.com/ul?${destination}&navigate=yes`;
  };

  const closePwdModal = () => {
    setShowPwdModal(false);
    setPwdCurrent('');
    setPwdNew('');
    setPwdConfirm('');
    setPwdError(null);
    setPwdSuccess(false);
    setPwdSaving(false);
  };

  const submitPwdChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setPwdError(null);
    if (!driver) return;
    if (pwdNew.trim().length < 4) return setPwdError('A nova senha precisa ter pelo menos 4 caracteres.');
    if (pwdNew !== pwdConfirm) return setPwdError('As senhas não coincidem.');
    setPwdSaving(true);
    try {
      const check = await verifyCredential(pwdCurrent, {
        passwordHash: driver.passwordHash,
        passwordSalt: driver.passwordSalt,
        legacyPlainPassword: driver.password,
      });
      if (!check.valid) {
        setPwdError('Senha atual incorreta.');
        return;
      }
      await changeMotoboyPassword(driver.id, pwdNew.trim());
      setPwdSuccess(true);
      setTimeout(closePwdModal, 1600);
    } catch {
      setPwdError('Não foi possível trocar a senha agora. Tente novamente.');
    } finally {
      setPwdSaving(false);
    }
  };

  const pickupAll = () => {
    ready.forEach((order) => onUpdateOrderStatus(order.id, 'picked_up'));
    setOrderIds((prev) => [...prev, ...ready.map((order) => order.id).filter((id) => !prev.includes(id))]);
    setTab('route');
  };

  const startRoute = () => {
    if (!route.length) return;
    route.forEach((order, index) => onUpdateOrderStatus(order.id, index === 0 ? 'in_transit' : 'picked_up'));
    if (driver) onUpdateMotoboyStatus?.(driver.id, 'delivering');
  };

  const startNext = (order: Order) => onUpdateOrderStatus(order.id, 'in_transit');
  const arrive = (order: Order) => {
    setArrived((prev) => ({ ...prev, [order.id]: true }));
    onSimulateArrival(order);
  };
  const finish = (order: Order) => {
    onUpdateOrderStatus(order.id, 'delivered');
    setArrived((prev) => {
      const next = { ...prev };
      delete next[order.id];
      return next;
    });
  };
  const markReturning = () => {
    if (driver) onUpdateMotoboyStatus?.(driver.id, 'returning_to_store');
    setTab('orders');
  };
  const enterQueue = () => {
    if (driver) {
      onConfirmArrivalAtStore?.(driver.id);
      onUpdateMotoboyStatus?.(driver.id, 'available');
    }
    setTab('orders');
  };

  if (!driver && initialMotoboyId && motoboys.length === 0) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md items-center justify-center bg-[#071426] px-6 text-white sm:min-h-[780px] sm:rounded-[28px]">
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><RefreshCw className="h-6 w-6 animate-spin text-violet-300" /></div>
          <h2 className="mt-4 text-xl font-black">Carregando seu perfil</h2>
          <p className="mt-2 text-sm text-slate-400">Sincronizando entregador e operação...</p>
        </div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
        <h3 className="font-black text-slate-900">Entregador não encontrado</h3>
        <p className="mt-2 text-sm text-slate-500">Seu usuário não está mais disponível nesta equipe.</p>
        <button onClick={onLogout} className="mt-4 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Voltar</button>
      </div>
    );
  }

  const routeStops = route.map((order, index) => ({
    id: order.id,
    orderIndex: index + 1,
    title: `#${order.codeNumber}`,
    address: order.address,
    neighborhood: order.neighborhood,
    lat: order.lat,
    lng: order.lng,
    status: order.status === 'in_transit' ? 'in_transit' : 'pending',
    priority: 'high' as const,
    recipientName: order.clientName,
  }));

  const statusText = activeRun
    ? 'Em rota'
    : returning
      ? 'Retornando para a loja'
      : inQueue
        ? ready.length
          ? 'Pedidos prontos para retirada'
          : preparing.length
            ? 'Aguardando cozinha'
            : 'Na fila'
        : 'Fora da fila';

  const tabItems: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: 'orders', label: `Pedidos${inQueue ? ` (${preparing.length + ready.length})` : ''}`, icon: ShoppingBag },
    { id: 'route', label: `Minha rota${route.length ? ` (${route.length})` : ''}`, icon: Map },
    { id: 'history', label: 'Histórico', icon: History },
  ];

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F4F6F9] text-slate-950 sm:min-h-[780px] sm:rounded-[28px] sm:border sm:border-slate-200 sm:shadow-2xl">
      <header className="bg-gradient-to-br from-[#071426] via-[#0A1C31] to-[#0D2744] px-5 pb-5 pt-[max(18px,env(safe-area-inset-top))] text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-black tracking-tight">Rota Fácil</h1>
            <div className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,.45)]" />
              <span>Online</span>
              <span className="text-slate-500">•</span>
              <span>{statusText}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowPwdModal(true)} className="grid h-10 w-10 place-items-center rounded-xl text-slate-100 transition active:bg-white/10" title="Trocar senha">
              <KeyRound className="h-5 w-5" />
            </button>
            <button onClick={onLogout} className="grid h-10 w-10 place-items-center rounded-xl text-slate-100 transition active:bg-white/10" title="Sair">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 bg-white px-3 py-4">
        <div className="text-center"><ShoppingBag className="mx-auto h-5 w-5 text-[#0A1C31]"/><div className="mt-1 text-[21px] font-black leading-none">{route.length}</div><p className="mt-1 text-[10px] font-bold text-slate-500">na rota</p></div>
        <div className="text-center"><Package className="mx-auto h-5 w-5 text-[#0A1C31]"/><div className="mt-1 text-[21px] font-black leading-none">{completed.length}</div><p className="mt-1 text-[10px] font-bold text-slate-500">entregues</p></div>
        <div className="text-center"><DollarSign className="mx-auto h-5 w-5 text-[#0A1C31]"/><div className="mt-1 text-[18px] font-black leading-none">{money(earned)}</div><p className="mt-1 text-[10px] font-bold text-slate-500">hoje</p></div>
      </section>

      <nav className="grid grid-cols-3 gap-2 bg-[#F4F6F9] px-3 py-3">
        {tabItems.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={`flex h-16 flex-col items-center justify-center gap-1 rounded-xl text-[12px] font-black transition ${tab === id ? 'bg-[#081A2F] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-100'}`}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <main className="flex-1 space-y-3 px-3 pb-24">
        {tab === 'orders' && (
          <>
            {!inQueue && returning && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-violet-50"><Bike className="h-10 w-10 text-violet-600" /></div>
                <h2 className="mt-5 text-xl font-black tracking-tight">Retornando para a loja</h2>
                <p className="mx-auto mt-2 max-w-[290px] text-[13px] leading-relaxed text-slate-500">Enquanto estiver retornando, novos pedidos reservados não ficam poluindo sua tela.</p>
                <button onClick={enterQueue} className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-[16px] font-black text-white shadow-lg shadow-violet-200 active:scale-[.99]">Entrar na fila <ArrowRight className="h-5 w-5"/></button>
              </section>
            )}

            {!inQueue && !returning && driver.status === 'delivering' && route.length === 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50"><CheckCircle2 className="h-10 w-10 text-emerald-600" /></div>
                <h2 className="mt-5 text-xl font-black">Rota concluída</h2>
                <p className="mt-2 text-[13px] text-slate-500">Todas as entregas foram finalizadas.</p>
                <button onClick={markReturning} className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#081A2F] text-sm font-black text-white"><Bike className="h-5 w-5"/>Estou retornando</button>
              </section>
            )}

            {inQueue && (
              <>
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4"><Package className="h-5 w-5 text-[#081A2F]"/><div><h2 className="text-[17px] font-black">Preparando</h2><p className="text-[11px] text-slate-500">Já reservados para você</p></div></div>
                  <div className="space-y-2 p-3">
                    {preparing.length ? preparing.map((order) => (
                      <article key={order.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center justify-between gap-3"><strong className="text-[13px]">#{order.codeNumber} • {order.clientName}</strong><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-amber-700">EM PREPARO</span></div>
                        <p className="mt-1 text-[11px] text-slate-500">{order.neighborhood || order.address}</p>
                        <p className="mt-3 flex items-center gap-1 text-[10px] font-bold text-amber-700"><Clock3 className="h-3.5 w-3.5"/>Aguardando a loja marcar como pronto</p>
                      </article>
                    )) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-9 text-center"><Package className="mx-auto h-8 w-8 text-slate-400"/><p className="mt-3 text-[13px] font-bold text-slate-500">Nenhum pedido em preparo.</p><p className="mt-1 text-[10px] leading-relaxed text-slate-400">Assim que um pedido for reservado para você, ele aparecerá aqui.</p></div>
                    )}
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4"><ShoppingBag className="h-5 w-5 text-[#081A2F]"/><div><h2 className="text-[17px] font-black">Prontos para retirada ({ready.length})</h2><p className="text-[11px] text-slate-500">Confira a carga antes de sair</p></div></div>
                  <div className="space-y-2 p-3">
                    {ready.length ? ready.map((order) => (
                      <article key={order.id} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><strong className="text-[13px]">#{order.codeNumber} • {order.clientName}</strong><p className="mt-1 text-[11px] text-slate-500">{order.address}</p></article>
                    )) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-9 text-center"><ShoppingBag className="mx-auto h-8 w-8 text-slate-400"/><p className="mt-3 text-[13px] font-bold text-slate-500">Nenhum pedido pronto.</p><p className="mt-1 text-[10px] leading-relaxed text-slate-400">Os pedidos prontos para retirada aparecerão aqui.</p></div>
                    )}
                    {ready.length > 0 && <button onClick={pickupAll} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3.5 text-[13px] font-black text-white"><CheckCircle2 className="h-4 w-4"/>Confirmar retirada dos {ready.length} pedidos</button>}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {tab === 'route' && (
          route.length ? (
            <>
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4"><div><h2 className="text-[17px] font-black">{activeRun ? 'Rota em andamento' : 'Próxima rota'}</h2><p className="mt-1 text-[11px] text-slate-500">{activeRun ? 'Siga a ordem abaixo e navegue até a próxima entrega.' : 'Ajuste a ordem antes de iniciar a rota.'}</p></div><Route className="h-5 w-5 text-violet-600"/></div>
                <div className="space-y-2 p-3">
                  {route.map((order, index) => {
                    const isCurrent = current?.id === order.id;
                    return <article key={order.id} className={`rounded-xl border p-3.5 ${isCurrent ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-start gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-black ${isCurrent ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{index + 1}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><strong className="truncate text-[13px]">#{order.codeNumber} • {order.clientName}</strong>{isCurrent && <span className="text-[9px] font-black text-violet-700">AGORA</span>}</div><p className="mt-1 text-[11px] leading-relaxed text-slate-500">{order.address}</p><p className="mt-1 text-[10px] text-slate-400">{order.neighborhood}</p></div></div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {!activeRun && <><button disabled={!index} onClick={() => move(index, -1)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-30"><ArrowUp className="h-4 w-4"/></button><button disabled={index === route.length - 1} onClick={() => move(index, 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-30"><ArrowDown className="h-4 w-4"/></button></>}
                        <button onClick={() => setNavRequest({ from: order.id, fullRoute: false })} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#081A2F] px-3 text-[11px] font-black text-white"><Navigation className="h-4 w-4"/>Navegar</button>
                        {activeRun && isCurrent && !arrived[order.id] && <button onClick={() => arrive(order)} className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-amber-400 px-3 text-[11px] font-black text-slate-950">Cheguei</button>}
                        {activeRun && isCurrent && arrived[order.id] && <button onClick={() => finish(order)} className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-emerald-600 px-3 text-[11px] font-black text-white">Concluir entrega</button>}
                        {activeRun && !isCurrent && order.status === 'picked_up' && <button onClick={() => startNext(order)} className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 px-3 text-[11px] font-black text-violet-700">Iniciar esta entrega</button>}
                      </div>
                    </article>;
                  })}
                </div>
              </section>
              <div className="grid grid-cols-2 gap-2"><button onClick={() => setShowMap(true)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[12px] font-black text-slate-700"><MapPin className="h-4 w-4"/>Ver mapa</button>{!activeRun ? <button onClick={startRoute} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-[12px] font-black text-white"><Navigation className="h-4 w-4"/>Iniciar rota</button> : <button onClick={() => setNavRequest({ fullRoute: true })} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-[12px] font-black text-white"><Route className="h-4 w-4"/>Abrir rota</button>}</div>
            </>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
              <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-violet-50 to-slate-50"><Route className="h-12 w-12 text-violet-600"/></div>
              <h2 className="mt-5 text-[22px] font-black tracking-tight">Sua rota está vazia.</h2>
              <p className="mx-auto mt-2 max-w-[270px] text-[13px] leading-relaxed text-slate-500">Os pedidos aceitos aparecerão aqui na ordem de entrega.</p>
              <div className="mt-6 flex items-start gap-2 rounded-xl bg-violet-50 p-4 text-left text-[11px] leading-relaxed text-violet-700"><Info className="mt-0.5 h-4 w-4 shrink-0"/><span>Assim que você retirar um pedido, ele será adicionado automaticamente à sua rota.</span></div>
            </section>
          )
        )}

        {tab === 'history' && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4"><div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-[#081A2F]"/><h2 className="text-[17px] font-black">Entregas de hoje</h2></div><span className="text-[10px] font-bold text-slate-400">{completed.length} entregas</span></div>
            <div className="divide-y divide-slate-100">
              {completed.length ? completed.map((order) => (
                <button key={order.id} onClick={() => setTab('history')} className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-slate-50"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500"/><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-bold text-slate-800">#{order.codeNumber} <span className="mx-1 text-slate-300">•</span> {order.clientName}</p></div><span className="text-[10px] text-slate-400">{formatTime(order)}</span><ChevronRight className="h-4 w-4 text-slate-400"/></button>
              )) : <div className="px-5 py-12 text-center"><History className="mx-auto h-9 w-9 text-slate-300"/><p className="mt-3 text-[13px] font-bold text-slate-500">Nenhuma entrega concluída hoje.</p></div>}
            </div>
          </section>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md px-3 pb-[max(10px,env(safe-area-inset-bottom))] sm:absolute">
        <div className="flex h-12 items-center justify-between rounded-xl border border-slate-200 bg-white/95 px-4 shadow-lg backdrop-blur"><div className="flex items-center gap-2 text-[10px] font-bold text-slate-500"><RefreshCw className="h-4 w-4"/><span className="h-2 w-2 rounded-full bg-emerald-500"/><span>Sincronizado agora</span></div><span className="text-[10px] font-medium text-slate-400">{new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span></div>
      </div>

      {showMap && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4">
          <div className="h-[88dvh] w-full max-w-md overflow-hidden rounded-t-3xl bg-white sm:h-[720px] sm:rounded-3xl"><div className="flex items-center justify-between border-b border-slate-200 p-4"><div><h3 className="font-black">Mapa da rota</h3><p className="text-[10px] text-slate-500">{route.length} parada{route.length===1?'':'s'} na rota</p></div><button onClick={() => setShowMap(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100"><X className="h-4 w-4"/></button></div><div className="h-[calc(100%-72px)]"><RouteMap origin={{name:shift.storeName||'Loja',address:shift.storeAddress||'',lat:shift.storeLat||-26.9194,lng:shift.storeLng||-49.0661}} stops={routeStops} motoboysList={driver?[driver]:[]} selectedMotoboyId={driver.id}/></div></div>
        </div>
      )}

      {navRequest && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 p-3 sm:items-center"><div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><div><h3 className="text-lg font-black">Abrir navegação</h3><p className="mt-1 text-[11px] text-slate-500">Escolha o app que você usa na rua.</p></div><button onClick={() => setNavRequest(null)} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100"><X className="h-4 w-4"/></button></div><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={openGoogle} className="rounded-xl bg-[#081A2F] p-4 text-sm font-black text-white">Google Maps</button><button onClick={openWaze} className="rounded-xl bg-violet-600 p-4 text-sm font-black text-white">Waze</button></div></div></div>
      )}

      {showPwdModal && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-3 sm:items-center"><form onSubmit={submitPwdChange} className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><div><h3 className="text-lg font-black">Trocar senha</h3><p className="mt-1 text-[11px] text-slate-500">Atualize sua senha de acesso ao Rota Fácil.</p></div><button type="button" onClick={closePwdModal} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100"><X className="h-4 w-4"/></button></div><div className="mt-5 space-y-3"><input type="password" value={pwdCurrent} onChange={(e)=>setPwdCurrent(e.target.value)} placeholder="Senha atual" className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-violet-400"/><input type="password" value={pwdNew} onChange={(e)=>setPwdNew(e.target.value)} placeholder="Nova senha" className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-violet-400"/><input type="password" value={pwdConfirm} onChange={(e)=>setPwdConfirm(e.target.value)} placeholder="Confirmar nova senha" className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-violet-400"/>{pwdError&&<p className="rounded-lg bg-rose-50 p-2 text-[11px] font-bold text-rose-600">{pwdError}</p>}{pwdSuccess&&<p className="rounded-lg bg-emerald-50 p-2 text-[11px] font-bold text-emerald-700">Senha alterada com sucesso.</p>}<button disabled={pwdSaving} className="h-12 w-full rounded-xl bg-violet-600 text-sm font-black text-white disabled:opacity-50">{pwdSaving?'Salvando...':'Salvar nova senha'}</button></div></form></div>
      )}
    </div>
  );
};
