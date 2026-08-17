import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Order, Motoboy, StoreShift } from '../types';
import { RouteMap } from './RouteMap';
import { saveMotoboyLocationToCloud } from '../lib/firebase';
import { calculateDistanceKm } from '../utils/geoUtils';
import { getMotoboyStatusPresentation } from '../utils/motoboyStatusUtils';
import {
  Bike,
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  Zap,
  ShoppingBag,
  Clock,
  MessageCircle,
  Building2,
  Volume2,
  BellRing,
  LogOut,
  DollarSign,
  CreditCard,
  ChevronRight,
  Pause,
  Lock,
  Users,
  Power,
  FileText,
  X,
  Copy,
  TrendingUp,
} from 'lucide-react';

interface MotoboyAppProps {
  motoboys: Motoboy[];
  orders: Order[];
  shift: StoreShift;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onSimulateArrival: (order: Order) => void;
  onReorderMotoboyRoute?: (orderedOrderIds: string[]) => void;
  onConfirmArrivalAtStore?: (motoboyId: string) => void;
  onUpdateMotoboyStatus?: (motoboyId: string, status: Motoboy['status']) => void;
  initialMotoboyId?: string;
  isLockedToMotoboy?: boolean;
  onLogout?: () => void;
}

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
  const [activeMotoboyId, setActiveMotoboyId] = useState<string>(() => {
    if (initialMotoboyId) return initialMotoboyId;
    try {
      return localStorage.getItem('rota_facil_active_motoboy_id') || '';
    } catch {
      return '';
    }
  });
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'map'>('active');
  const [deviceGps, setDeviceGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatusMsg, setGpsStatusMsg] = useState('Localização ativa');
  const [showDevGpsPanel, setShowDevGpsPanel] = useState(false);
  const [isEarningsModalOpen, setIsEarningsModalOpen] = useState(false);
  const [isDailyReportModalOpen, setIsDailyReportModalOpen] = useState(false);
  const [availableSince, setAvailableSince] = useState(Date.now());
  const [shiftStartedAt, setShiftStartedAt] = useState(Date.now() - 4.5 * 3600 * 1000);
  const [shiftEndedAt, setShiftEndedAt] = useState<string | null>(null);
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);
  const wakeLockRef = useRef<any>(null);
  const [expandedExtraOrderIds, setExpandedExtraOrderIds] = useState<Record<string, boolean>>({});
  const [manualExpandedId, setManualExpandedId] = useState<string | null>(null);
  const [arrivedOrderIds, setArrivedOrderIds] = useState<Record<string, boolean>>({});
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  useEffect(() => {
    if (!initialMotoboyId) return;
    setActiveMotoboyId(initialMotoboyId);
    try {
      localStorage.setItem('rota_facil_active_motoboy_id', initialMotoboyId);
    } catch {}
  }, [initialMotoboyId]);

  const activeMotoboy = useMemo(() => {
    if (!motoboys.length) return undefined;
    const target = (initialMotoboyId || activeMotoboyId || '').trim();
    if (target) {
      const exact = motoboys.find((m) => m.id === target);
      if (exact) return exact;
    }
    return isLockedToMotoboy ? undefined : motoboys[0];
  }, [motoboys, activeMotoboyId, initialMotoboyId, isLockedToMotoboy]);

  // A driver owns an order ONLY by immutable driver ID. Never by name/username.
  const matchesDriver = (order: Order) => Boolean(
    activeMotoboy?.id && order.assignedMotoboyId === activeMotoboy.id
  );

  const assignedOrders = useMemo(
    () => orders
      .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled' && matchesDriver(o))
      .sort((a, b) => (a.routeSequence || 0) - (b.routeSequence || 0)),
    [orders, activeMotoboy?.id]
  );

  const completedOrders = useMemo(() => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return orders.filter((o) => o.status === 'delivered' && o.deliveredDate === today && matchesDriver(o));
  }, [orders, activeMotoboy?.id]);

  const routeHasStarted = assignedOrders.some((o) => o.status === 'in_transit' || o.status === 'picked_up') || activeMotoboy?.status === 'delivering';
  const waitingForKitchen = assignedOrders.length > 0 && !routeHasStarted && assignedOrders.some((o) => o.status === 'pending' || o.status === 'preparing');
  const readyForPickup = assignedOrders.length > 0 && !routeHasStarted && assignedOrders.every((o) => o.status === 'ready_at_counter' || o.status === 'picked_up');
  const baseStatusPresentation = getMotoboyStatusPresentation(activeMotoboy?.status);
  const statusPresentation = activeMotoboy?.status === 'offline' || activeMotoboy?.status === 'busy' || activeMotoboy?.status === 'returning_to_store'
    ? baseStatusPresentation
    : waitingForKitchen
      ? { ...baseStatusPresentation, label: 'Aguardando cozinha', dotClass: 'bg-amber-400', textClass: 'text-amber-300' }
      : readyForPickup
        ? { ...baseStatusPresentation, label: 'Pedido pronto para retirada', dotClass: 'bg-amber-400', textClass: 'text-amber-300' }
        : routeHasStarted
          ? getMotoboyStatusPresentation('delivering')
          : baseStatusPresentation;

  const arranqueAmount = activeMotoboy?.fixedFee && activeMotoboy.fixedFee > 0 ? activeMotoboy.fixedFee : 0;
  const deliveryFeesTotal = completedOrders.reduce(
    (acc, o) => acc + (o.deliveryFee && o.deliveryFee > 0 ? o.deliveryFee : (activeMotoboy?.perDeliveryFee || 0)),
    0
  );
  const calculatedTotalEarnings = arranqueAmount + deliveryFeesTotal;
  const totalEarnedDisplay = calculatedTotalEarnings;

  const formattedCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const requestWakeLock = async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      setIsWakeLockActive(true);
      wakeLockRef.current.addEventListener('release', () => setIsWakeLockActive(false));
    } catch {}
  };

  useEffect(() => {
    requestWakeLock();
    return () => {
      if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    const success = (pos: GeolocationPosition) => {
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));
      setDeviceGps({ lat, lng });
      setGpsStatusMsg('GPS ativo');
      if (activeMotoboy && (Math.abs((activeMotoboy.currentLat || 0) - lat) > 0.0001 || Math.abs((activeMotoboy.currentLng || 0) - lng) > 0.0001)) {
        saveMotoboyLocationToCloud(activeMotoboy.id, lat, lng);
      }
    };
    const error = (err: GeolocationPositionError) => setGpsStatusMsg(`GPS pendente: ${err.message}`);
    navigator.geolocation.getCurrentPosition(success, error, { enableHighAccuracy: true, timeout: 10000 });
    const watchId = navigator.geolocation.watchPosition(success, error, { enableHighAccuracy: true, timeout: 15000, maximumAge: 4000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeMotoboy?.id]);

  useEffect(() => {
    if (activeMotoboy?.joinedQueueAt) setAvailableSince(activeMotoboy.joinedQueueAt);
  }, [activeMotoboy?.joinedQueueAt]);

  const isBeingCalledToCounter = Boolean(
    activeMotoboy?.callingToCounterAt && Date.now() - activeMotoboy.callingToCounterAt < 60000
  );

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      setNotificationPermission(await Notification.requestPermission());
    } catch {}
  };

  const handleOpenWaze = (address: string, lat?: number, lng?: number) => {
    const url = lat && lng
      ? `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`
      : `https://www.waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
    window.open(url, '_blank');
  };

  const handleOpenGoogleMaps = (address: string, lat?: number, lng?: number) => {
    const query = lat && lng ? `${lat},${lng}` : encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const handleFinishShift = () => {
    if (!activeMotoboy || !window.confirm('Tem certeza que deseja encerrar o expediente de hoje?')) return;
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setShiftEndedAt(time);
    onUpdateMotoboyStatus?.(activeMotoboy.id, 'offline');
    setIsDailyReportModalOpen(true);
  };

  const handleLogoutAccount = () => {
    if (!window.confirm('Deseja sair da conta do entregador?')) return;
    try {
      localStorage.removeItem('rota_facil_session');
      localStorage.removeItem('rota_facil_active_motoboy_id');
    } catch {}
    onLogout?.();
  };

  const availableDrivers = [...motoboys]
    .filter((m) => m.status === 'available')
    .sort((a, b) => (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0));
  const queueIndex = activeMotoboy ? availableDrivers.findIndex((m) => m.id === activeMotoboy.id) : -1;
  const queuePos = queueIndex >= 0 ? queueIndex + 1 : 0;

  if (!activeMotoboy && isLockedToMotoboy) {
    return (
      <div className="w-full max-w-md mx-auto bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-md">
        <h3 className="font-black text-slate-900 text-lg">Acesso não encontrado</h3>
        <p className="text-sm text-slate-500 mt-2">Este cadastro de entregador não existe mais.</p>
        <button onClick={onLogout} className="mt-5 w-full py-3 bg-slate-900 text-white rounded-xl font-black text-sm">Voltar ao login</button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 text-slate-900 rounded-3xl border border-slate-200 shadow-md overflow-hidden flex flex-col font-sans min-h-[680px] relative">
      <div className="bg-slate-900 px-4 py-3 text-white flex items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-base shrink-0 border border-amber-300">
            {activeMotoboy?.name?.charAt(0).toUpperCase() || 'M'}
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-base text-white leading-tight truncate">{activeMotoboy?.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${statusPresentation.dotClass}`} />
              <span className={`text-[11px] font-bold ${statusPresentation.textClass}`}>
                {statusPresentation.label}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setIsDailyReportModalOpen(true)} className="p-2 rounded-xl bg-slate-800 text-amber-300 border border-slate-700"><FileText className="w-4 h-4" /></button>
          <button onClick={() => setShowDevGpsPanel(!showDevGpsPanel)} className="p-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700"><Zap className="w-4 h-4" /></button>
          <button onClick={handleLogoutAccount} className="p-2 rounded-xl bg-rose-950 text-rose-300 border border-rose-800"><LogOut className="w-4 h-4" /></button>
        </div>
      </div>

      {isBeingCalledToCounter && (
        <div className="bg-amber-400 text-slate-950 px-4 py-3 font-black text-sm border-b border-amber-600">
          🛎️ Chamado no balcão — dirija-se à loja para retirar os pedidos.
        </div>
      )}

      {notificationPermission !== 'granted' && (
        <div className="bg-amber-500 text-slate-950 px-3.5 py-2 text-xs font-bold flex items-center justify-between">
          <span className="truncate">🔔 Ative alertas de novos pedidos</span>
          <button onClick={requestNotificationPermission} className="px-2.5 py-1 bg-slate-950 text-amber-300 rounded-lg text-[10px] font-black">ATIVAR</button>
        </div>
      )}

      {showDevGpsPanel && (
        <div className="bg-slate-800 text-slate-200 px-4 py-2 text-[11px] flex items-center justify-between">
          <span>{gpsStatusMsg}</span>
          <span>{deviceGps ? `${deviceGps.lat}, ${deviceGps.lng}` : 'Aguardando GPS'}</span>
        </div>
      )}

      <div className="bg-slate-100 px-3.5 py-3 border-b border-slate-200">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200 text-center">
            <span className="text-[10px] font-black text-slate-500 uppercase block">🎒 Na bag</span>
            <strong className="text-2xl font-black text-slate-950 block">{assignedOrders.length}</strong>
            <span className="text-[10px] text-slate-400 font-bold">pedidos ativos</span>
          </div>
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200 text-center">
            <span className="text-[10px] font-black text-slate-500 uppercase block">📦 Entregas</span>
            <strong className="text-2xl font-black text-slate-950 block">{completedOrders.length}</strong>
            <span className="text-[10px] text-slate-400 font-bold">concluídas hoje</span>
          </div>
          <button type="button" onClick={() => setIsEarningsModalOpen(true)} className="bg-amber-400 hover:bg-amber-300 p-2.5 rounded-2xl border border-amber-500 text-left transition-all shadow-sm group overflow-hidden">
            <div className="flex items-center justify-between gap-1"><span className="text-[10px] font-black text-slate-900 uppercase tracking-wide">💰 Ganhos hoje</span><ChevronRight className="w-3.5 h-3.5 text-slate-700" /></div>
            <strong className="text-lg font-black text-slate-950 block mt-1 leading-none whitespace-nowrap">{formattedCurrency(totalEarnedDisplay)}</strong>
            <span className="text-[9px] text-slate-700 font-bold block mt-1">toque para ver resumo</span>
          </button>
        </div>

        {assignedOrders.length > 0 && (
          <div className="mt-3 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between text-[10px] font-black mb-1">
              <span className="text-slate-600">{routeHasStarted ? 'Rota ativa' : waitingForKitchen ? 'Pedido vinculado' : 'Retirada'}</span>
              <span className={waitingForKitchen ? 'text-amber-700' : 'text-slate-600'}>{routeHasStarted ? `${assignedOrders.length} ${assignedOrders.length === 1 ? 'parada restante' : 'paradas restantes'}` : waitingForKitchen ? 'Aguardando cozinha' : 'Pronto para retirada'}</span>
            </div>
            <div className="h-1 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${waitingForKitchen ? 'bg-amber-400' : 'bg-slate-500'}`} style={{ width: routeHasStarted ? '70%' : waitingForKitchen ? '20%' : '40%' }} /></div>
          </div>
        )}
      </div>

      <div className="bg-slate-100 px-2 py-2 border-b border-slate-200 flex gap-1.5">
        <button onClick={() => setActiveTab('active')} className={`flex-1 py-2.5 rounded-xl font-black text-xs ${activeTab === 'active' ? 'bg-slate-950 text-white' : 'bg-white border border-slate-300'}`}>{assignedOrders.length ? (routeHasStarted ? 'Minha Rota' : 'Meus Pedidos') : 'Fila'} <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950">{assignedOrders.length}</span></button>
        <button onClick={() => setActiveTab('map')} className={`flex-1 py-2.5 rounded-xl font-black text-xs ${activeTab === 'map' ? 'bg-slate-950 text-white' : 'bg-white border border-slate-300'}`}>Mapa</button>
        <button onClick={() => setActiveTab('completed')} className={`flex-1 py-2.5 rounded-xl font-black text-xs ${activeTab === 'completed' ? 'bg-slate-950 text-white' : 'bg-white border border-slate-300'}`}>Histórico <span className="ml-1 text-slate-400">{completedOrders.length}</span></button>
      </div>

      <div className="p-3.5 flex-1 bg-slate-50 overflow-y-auto">
        {activeTab === 'active' ? (
          assignedOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-4">
              {activeMotoboy?.status === 'returning_to_store' ? (
                <>
                  <div className="text-4xl">🏢</div><h4 className="text-xl font-black">Voltando para a loja</h4><p className="text-xs text-slate-500">Ao chegar, confirme abaixo para entrar no final da fila.</p><button onClick={() => onConfirmArrivalAtStore?.(activeMotoboy.id)} className="w-full py-3 bg-slate-900 text-white font-black rounded-xl">📍 Cheguei à loja</button>
                </>
              ) : activeMotoboy?.status === 'offline' ? (
                <><div className="text-4xl">⏱️</div><h4 className="text-xl font-black">Expediente encerrado</h4><p className="text-xs text-slate-500">Entre na fila somente quando estiver pronto para trabalhar.</p><button onClick={() => { onUpdateMotoboyStatus?.(activeMotoboy.id, 'available'); setAvailableSince(Date.now()); setShiftStartedAt(Date.now()); setShiftEndedAt(null); }} className="w-full py-3.5 bg-slate-900 text-white font-black rounded-xl">Iniciar expediente / Entrar na fila</button></>
              ) : activeMotoboy?.status === 'busy' ? (
                <><div className="text-4xl">⏸️</div><h4 className="text-xl font-black">Disponibilidade pausada</h4><button onClick={() => onUpdateMotoboyStatus?.(activeMotoboy.id, 'available')} className="w-full py-3 bg-slate-900 text-white font-black rounded-xl">Voltar para a fila</button></>
              ) : (
                <>
                  <div className="flex justify-center gap-2 flex-wrap"><span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-black">● DISPONÍVEL NA LOJA</span><button onClick={requestWakeLock} className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-black">📱 Tela ligada: {isWakeLockActive ? 'Ativada' : 'Ativar'}</button></div>
                  <div className="border border-slate-200 rounded-2xl p-4"><strong className="text-4xl font-black block">{queuePos || 1}º da fila</strong><span className="text-slate-600 font-black text-sm">{queuePos <= 1 ? 'Próximo a receber um pedido' : `${queuePos - 1} à sua frente`}</span><div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100"><div className="bg-slate-50 rounded-xl p-2"><span className="text-[10px] text-slate-500 font-bold block">Estimativa</span><strong>~{Math.max(2, (queuePos || 1) * 2)} min</strong></div><div className="bg-slate-50 rounded-xl p-2"><span className="text-[10px] text-slate-500 font-bold block">Na fila</span><strong>{Math.max(0, Math.floor((Date.now() - (activeMotoboy.joinedQueueAt || availableSince)) / 60000))} min</strong></div></div></div>
                  <button onClick={() => onUpdateMotoboyStatus?.(activeMotoboy.id, 'busy')} className="w-full py-3 border border-slate-300 rounded-xl font-black">Pausar disponibilidade</button>
                  <button onClick={handleFinishShift} className="w-full py-3 bg-slate-900 text-rose-300 border border-rose-500/40 rounded-xl font-black">Encerrar expediente</button>
                  <div className="pt-4 border-t border-slate-200 text-left"><h6 className="text-xs font-black uppercase">Outros na fila ({Math.max(0, availableDrivers.length - 1)})</h6><div className="mt-2 space-y-1.5">{availableDrivers.filter((m) => m.id !== activeMotoboy.id).map((m) => <div key={m.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold">{m.name}</div>)}</div></div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              <div className={`w-full py-3 px-4 border rounded-2xl flex items-center justify-between text-xs font-black ${waitingForKitchen ? 'bg-slate-900 border-amber-400/40 text-amber-300' : 'bg-slate-900 border-slate-700 text-slate-300'}`}><span>{waitingForKitchen ? '🍳 Aguardando cozinha' : readyForPickup ? '📦 Pronto para retirada' : '● Em rota'}</span><span className="text-slate-400">{assignedOrders.length} {assignedOrders.length === 1 ? 'pedido' : 'pedidos'}</span></div>
              {assignedOrders.map((order, index) => {
                const isFirstOrder = index === 0;
                const isExpanded = isFirstOrder || manualExpandedId === order.id;
                const hasArrived = Boolean(arrivedOrderIds[order.id]);
                const isInTransit = order.status === 'in_transit';
                const isKitchenWaiting = order.status === 'pending' || order.status === 'preparing';
                const streetLine = order.street || order.address;
                const distance = calculateDistanceKm(deviceGps?.lat || activeMotoboy?.currentLat || shift.storeLat, deviceGps?.lng || activeMotoboy?.currentLng || shift.storeLng, order.lat, order.lng);

                if (!isExpanded) return <button key={order.id} onClick={() => setManualExpandedId(order.id)} className="w-full bg-white p-3 rounded-2xl border border-slate-200 text-left flex justify-between"><span><strong>#{order.codeNumber}</strong> • {order.neighborhood}</span><span className="text-slate-400 text-xs">Toque para ver</span></button>;

                return (
                  <div key={order.id} className="rounded-2xl border border-slate-300 overflow-hidden bg-white shadow-sm">
                    <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center"><span className="font-black text-xs text-slate-300">{isFirstOrder ? 'ENTREGA ATUAL' : `${index + 1}ª PARADA`}</span><strong className="text-amber-300">#{order.codeNumber}</strong></div>
                    <div className="p-4 space-y-3">
                      <div className="bg-slate-950 text-white p-4 rounded-2xl"><div className="flex justify-between text-xs font-black"><span className="text-slate-400">PEDIDO #{order.codeNumber}</span><span className="text-slate-300">📍 {(order.neighborhood || 'Centro').toUpperCase()}</span></div><h2 className="text-2xl font-black mt-2">{streetLine}</h2><div className="flex gap-2 mt-3"><span className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300 text-xs font-black">~{Math.max(2, Math.round((order.estimatedMinutes || 8) * 0.5))} min</span><span className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300 text-xs font-black">~{distance.toFixed(1)} km</span></div></div>

                      {isKitchenWaiting && <div className="bg-amber-50 border border-amber-200 rounded-2xl px-3.5 py-3 flex items-center justify-between gap-3"><div><strong className="text-amber-900 text-sm block">🍳 Aguardando cozinha</strong><span className="text-[11px] text-amber-700 font-semibold">Você já está vinculado a este pedido. Aguarde a loja avisar quando estiver pronto.</span></div><Clock className="w-5 h-5 text-amber-600 shrink-0" /></div>}

                      {(order.paymentMethod === 'pix' || order.originChannel === 'ifood' || order.originChannel === 'cardapio_web') ? (
                        <div className="bg-emerald-950/90 border border-emerald-500/50 p-3 rounded-2xl flex items-center justify-between text-emerald-100 shadow-xs">
                          <span className="text-emerald-300 font-black text-xs sm:text-sm flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ✓ Pago via {order.paymentMethod === 'pix' ? 'PIX' : order.originChannel === 'ifood' ? 'iFood' : 'Online'} • Não cobrar
                          </span>
                          <span className="bg-slate-900 border border-slate-800 text-amber-300 px-2.5 py-1 rounded-xl font-black text-xs shrink-0">
                            Ganho: + {formattedCurrency(order.deliveryFee || activeMotoboy?.perDeliveryFee || 0)}
                          </span>
                        </div>
                      ) : (
                        <div className="bg-amber-950 border-2 border-amber-500 p-3 rounded-2xl text-white space-y-2 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-black">
                                {order.paymentMethod === 'dinheiro' ? <DollarSign className="w-5 h-5 stroke-[2.5]" /> : <CreditCard className="w-5 h-5 stroke-[2.5]" />}
                              </div>
                              <div>
                                <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider block">
                                  🚨 COBRAR NO LOCAL ({order.paymentMethod === 'dinheiro' ? 'DINHEIRO' : 'MAQUININHA'})
                                </span>
                                <span className="font-bold text-xs text-amber-100 block">
                                  {order.paymentMethod === 'dinheiro' ? '💵 Receber em dinheiro' : '💳 Passar cartão na maquininha'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 bg-slate-950 px-2.5 py-1 rounded-xl border border-amber-500/40">
                              <span className="text-[9px] font-black text-amber-300 uppercase block">Cobrar</span>
                              <span className="font-black text-xl text-amber-400 leading-tight block">{formattedCurrency(order.total)}</span>
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-amber-800/60 flex items-center justify-between text-xs gap-2 flex-wrap">
                            {order.paymentMethod === 'dinheiro' && order.changeFor && order.changeFor > order.total ? (
                              <span className="bg-amber-900/80 text-amber-100 px-2 py-0.5 rounded-lg border border-amber-700 font-bold text-[11px]">
                                ⚠️ Troco p/ <strong>{formattedCurrency(order.changeFor)}</strong> (Devolver <strong>{formattedCurrency(order.changeFor - order.total)}</strong>)
                              </span>
                            ) : (
                              <span className="text-amber-200 text-[11px] font-semibold">
                                {order.paymentMethod === 'dinheiro' ? '✓ Valor exato (sem troco)' : '✓ Levar maquininha de cartão'}
                              </span>
                            )}
                            <span className="text-[11px] font-black text-emerald-400 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800 shrink-0">
                              Sua taxa: +{formattedCurrency(order.deliveryFee || activeMotoboy?.perDeliveryFee || 0)}
                            </span>
                          </div>
                        </div>
                      )}

                      {(isInTransit || order.status === 'picked_up') && <div className="grid grid-cols-2 gap-2"><button onClick={() => handleOpenWaze(order.address, order.lat, order.lng)} className="py-3.5 bg-sky-600 text-white rounded-2xl font-black flex items-center justify-center gap-2"><Navigation className="w-5 h-5" /> Navegar</button>{order.clientPhone ? <a href={`tel:${order.clientPhone.replace(/\D/g, '')}`} className="py-3.5 bg-slate-800 text-white rounded-2xl font-black flex items-center justify-center gap-2"><Phone className="w-5 h-5 text-slate-300" /> Ligar</a> : <div className="py-3.5 bg-slate-200 rounded-2xl text-center text-slate-500 font-black">Sem telefone</div>}</div>}

                      {isFirstOrder && isInTransit && !hasArrived && <button onClick={() => { setArrivedOrderIds((prev) => ({ ...prev, [order.id]: true })); onSimulateArrival(order); }} className="w-full py-4 bg-slate-900 text-white font-black text-base rounded-2xl border border-slate-700 flex items-center justify-center gap-2"><MapPin className="w-5 h-5 text-emerald-400" /> Cheguei ao local</button>}
                      {isFirstOrder && isInTransit && hasArrived && <button onClick={() => { onUpdateOrderStatus(order.id, 'delivered'); setArrivedOrderIds((prev) => { const next = { ...prev }; delete next[order.id]; return next; }); setManualExpandedId(null); }} className="w-full py-4 bg-emerald-600 text-white font-black text-base rounded-2xl flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5" /> Concluir entrega #{order.codeNumber}</button>}
                      {order.status === 'ready_at_counter' && <button onClick={() => onUpdateOrderStatus(order.id, 'picked_up')} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl">Confirmar retirada</button>}
                      {order.status === 'picked_up' && isFirstOrder && <button onClick={() => { onUpdateOrderStatus(order.id, 'in_transit'); onUpdateMotoboyStatus?.(activeMotoboy.id, 'delivering'); }} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl">Iniciar rota</button>}

                      <button onClick={() => setExpandedExtraOrderIds((prev) => ({ ...prev, [order.id]: !prev[order.id] }))} className="w-full py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 font-black text-xs">{expandedExtraOrderIds[order.id] ? 'Ocultar detalhes' : 'Ver detalhes (Itens, Rastreio, Maps)'}</button>
                      {expandedExtraOrderIds[order.id] && <div className="bg-slate-900 text-white rounded-2xl p-3.5 space-y-3 text-xs"><strong className="text-amber-300">👤 {order.clientName}</strong>{order.items?.length ? <div className="bg-slate-950 rounded-xl p-2 space-y-1">{order.items.map((item, i) => <div key={i} className="flex justify-between"><span>{item.quantity}x {item.name}</span><span>{formattedCurrency(item.price * item.quantity)}</span></div>)}</div> : null}{order.notes && <div className="bg-amber-950 border border-amber-600/40 rounded-xl p-2.5 text-amber-200">📝 {order.notes}</div>}<div className="grid grid-cols-2 gap-2"><button onClick={() => handleOpenGoogleMaps(order.address, order.lat, order.lng)} className="py-2 bg-slate-800 rounded-lg font-black">Google Maps</button><button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?rastreio=${order.trackingCode || order.id}`)} className="py-2 bg-slate-800 rounded-lg font-black text-amber-300 flex justify-center gap-1"><Copy className="w-3.5 h-3.5" /> Rastreio</button></div></div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : activeTab === 'map' ? (
          <div className="space-y-3"><div className="bg-slate-900 text-white p-3.5 rounded-2xl"><h4 className="font-black">Mapa da minha rota</h4><p className="text-xs text-slate-400 mt-1">GPS do seu celular + suas paradas</p></div><div className="h-[400px] rounded-2xl overflow-hidden border border-slate-300"><RouteMap origin={{ name: shift.storeName || 'Loja', address: shift.storeAddress, lat: shift.storeLat, lng: shift.storeLng }} motoboyName={activeMotoboy?.name} showMotoboyMarker motoboyLat={deviceGps?.lat || activeMotoboy?.currentLat} motoboyLng={deviceGps?.lng || activeMotoboy?.currentLng} stops={assignedOrders.map((o, idx) => ({ id: o.id, orderIndex: idx + 1, title: `#${o.codeNumber} - ${o.clientName}`, address: o.address, neighborhood: o.neighborhood, lat: o.lat, lng: o.lng, status: o.status === 'in_transit' ? 'in_transit' : 'pending', priority: 'high', recipientName: o.clientName }))} /></div></div>
        ) : (
          <div className="space-y-3"><div className="bg-slate-900 text-white p-4 rounded-2xl grid grid-cols-2 gap-2 text-center"><div><span className="text-[10px] text-slate-400 uppercase font-black">Entregas hoje</span><strong className="text-2xl block">{completedOrders.length}</strong></div><div><span className="text-[10px] text-slate-400 uppercase font-black">Ganhos hoje</span><strong className="text-2xl text-amber-300 block">{formattedCurrency(totalEarnedDisplay)}</strong></div></div>{completedOrders.length ? completedOrders.map((o) => <div key={o.id} className="bg-white border border-slate-200 rounded-2xl p-3 flex justify-between"><div><strong>Pedido #{o.codeNumber}</strong><p className="text-xs text-slate-500">{o.clientName} • {o.neighborhood}</p></div><span className="text-slate-700 font-black">+{formattedCurrency(o.deliveryFee || activeMotoboy?.perDeliveryFee || 0)}</span></div>) : <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">Nenhuma entrega concluída hoje.</div>}</div>
        )}
      </div>

      <div className="bg-white px-4 py-3 border-t border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-500"><span>📍 Blumenau - SC</span><button onClick={() => setIsDailyReportModalOpen(true)} className="text-slate-900 font-black">{completedOrders.length} {completedOrders.length === 1 ? 'entrega finalizada' : 'entregas finalizadas'} ›</button></div>

      {isEarningsModalOpen && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4"><div className="flex justify-between items-center border-b border-slate-200 pb-3"><div><h4 className="font-black text-lg">Ganhos de hoje</h4><p className="text-xs text-slate-500">{new Date().toLocaleDateString('pt-BR')}</p></div><button onClick={() => setIsEarningsModalOpen(false)}><X className="w-5 h-5" /></button></div><div className="bg-slate-950 text-white rounded-2xl p-4 text-center"><span className="text-[10px] uppercase text-slate-400 font-black">Total a receber</span><strong className="text-4xl text-amber-300 block mt-1">{formattedCurrency(totalEarnedDisplay)}</strong></div><div className="grid grid-cols-2 gap-2"><div className="bg-slate-50 border border-slate-200 rounded-xl p-3"><span className="text-[10px] text-slate-500 font-black uppercase">Fixo</span><strong className="block text-lg">{formattedCurrency(arranqueAmount)}</strong></div><div className="bg-slate-50 border border-slate-200 rounded-xl p-3"><span className="text-[10px] text-slate-500 font-black uppercase">Taxas</span><strong className="block text-lg">{formattedCurrency(deliveryFeesTotal)}</strong></div></div><div className="text-xs text-slate-600 font-bold">📦 {completedOrders.length} entregas concluídas hoje</div><button onClick={() => setIsEarningsModalOpen(false)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black">Fechar</button></div></div>}

      {isDailyReportModalOpen && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center"><div><h4 className="font-black text-lg">Relatório do dia</h4><p className="text-xs text-slate-500">{activeMotoboy?.name} • {new Date().toLocaleDateString('pt-BR')}</p></div><button onClick={() => setIsDailyReportModalOpen(false)}><X className="w-5 h-5" /></button></div><div className="bg-slate-950 text-white rounded-2xl p-4 text-center"><span className="text-[10px] text-amber-300 uppercase font-black">Saldo total</span><strong className="text-4xl text-amber-300 block">{formattedCurrency(totalEarnedDisplay)}</strong></div><div className="grid grid-cols-2 gap-2"><div className="bg-slate-50 border rounded-xl p-3"><span className="text-xs text-slate-500">Entregas</span><strong className="text-2xl block">{completedOrders.length}</strong></div><div className="bg-slate-50 border rounded-xl p-3"><span className="text-xs text-slate-500">Taxas</span><strong className="text-2xl block">{formattedCurrency(deliveryFeesTotal)}</strong></div></div><div className="text-xs text-slate-500">Expediente iniciado: {new Date(shiftStartedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{shiftEndedAt ? ` • encerrado ${shiftEndedAt}` : ''}</div><button onClick={() => setIsDailyReportModalOpen(false)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black">Fechar</button></div></div>}
    </div>
  );
};
