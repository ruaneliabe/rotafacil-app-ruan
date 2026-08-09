import React, { useState, useEffect, useRef } from 'react';
import { Order, Motoboy } from '../types';
import { RouteMap } from './RouteMap';
import { saveMotoboyToCloud } from '../lib/firebase';
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
  QrCode,
  Sparkles,
  ChevronRight,
  ArrowRight,
  Store,
  User,
  Pause
} from 'lucide-react';

interface MotoboyAppProps {
  motoboys: Motoboy[];
  orders: Order[];
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
  onUpdateOrderStatus,
  onSimulateArrival,
  onReorderMotoboyRoute,
  onConfirmArrivalAtStore,
  onUpdateMotoboyStatus,
  initialMotoboyId,
  isLockedToMotoboy = false,
  onLogout,
}) => {
  const [activeMotoboyId, setActiveMotoboyId] = useState<string>(
    initialMotoboyId || motoboys[0]?.id || ''
  );

  useEffect(() => {
    if (initialMotoboyId) {
      setActiveMotoboyId(initialMotoboyId);
    }
  }, [initialMotoboyId]);

  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'map'>('active');
  const [deviceGps, setDeviceGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string>('Localização ativa');
  const [showDevGpsPanel, setShowDevGpsPanel] = useState<boolean>(false);
  const [isEarningsModalOpen, setIsEarningsModalOpen] = useState<boolean>(false);
  const [availableSince, setAvailableSince] = useState<number>(Date.now());

  // Track device GPS position in real time
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      const handleSuccess = (pos: GeolocationPosition) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setDeviceGps({ lat, lng });
        setGpsStatusMsg(`GPS Ativo (Lat: ${lat}, Lng: ${lng})`);
      };

      const handleError = (err: GeolocationPositionError) => {
        console.warn('Erro ao obter GPS:', err.message);
        setGpsStatusMsg(`Permissão de GPS pendente (${err.message})`);
      };

      // Initial fetch
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
        enableHighAccuracy: true,
        timeout: 10000,
      });

      // Continuous watch
      const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 4000,
      });

      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setGpsStatusMsg('Navegador sem suporte a GPS');
    }
  }, []);

  const handleRequestGpsManual = () => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      setGpsStatusMsg('Buscando localização exata...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          setDeviceGps({ lat, lng });
          setGpsStatusMsg(`GPS Atualizado! (${lat}, ${lng})`);
          triggerSystemActionToast(`📍 Posição atualizada: ${lat}, ${lng}`);
        },
        (err) => {
          setGpsStatusMsg(`Erro no GPS: ${err.message}`);
          triggerSystemActionToast(`⚠️ Não foi possível obter GPS: ${err.message}`);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const [showNotificationToast, setShowNotificationToast] = useState<boolean>(false);
  const [notificationToastTitle, setNotificationToastTitle] = useState<string>('NOVO PEDIDO OU ROTA DISPONÍVEL');
  const [notificationToastMessage, setNotificationToastMessage] = useState<string>('Novo pedido ou rota disponível');
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);
  // Expanded card state (defaults to index 0)
  const [manualExpandedId, setManualExpandedId] = useState<string | null>(null);
  const [arrivedOrderIds, setArrivedOrderIds] = useState<Record<string, boolean>>({});

  const triggerSystemActionToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => {
      setActionToast(null);
    }, 4000);
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
      });
    } else {
      setShowInstallGuide(!showInstallGuide);
    }
  };

  const activeMotoboy =
    motoboys.find(
      (m) =>
        m.id === activeMotoboyId ||
        (m.username && m.username.toLowerCase() === activeMotoboyId.toLowerCase()) ||
        m.name.toLowerCase() === activeMotoboyId.toLowerCase() ||
        m.name.toLowerCase().includes(activeMotoboyId.toLowerCase())
    ) || motoboys[0];

  // Sync availableSince with activeMotoboy joinedQueueAt timestamp
  useEffect(() => {
    if (activeMotoboy?.joinedQueueAt) {
      setAvailableSince(activeMotoboy.joinedQueueAt);
    }
  }, [activeMotoboy?.joinedQueueAt]);

  useEffect(() => {
    if (deviceGps && activeMotoboy) {
      if (
        Math.abs((activeMotoboy.currentLat || 0) - deviceGps.lat) > 0.0001 ||
        Math.abs((activeMotoboy.currentLng || 0) - deviceGps.lng) > 0.0001
      ) {
        saveMotoboyToCloud({
          ...activeMotoboy,
          currentLat: deviceGps.lat,
          currentLng: deviceGps.lng,
        });
      }
    }
  }, [deviceGps, activeMotoboy]);

  const effectiveMotoboyId = activeMotoboy?.id || activeMotoboyId;

  const matchesDriver = (o: Order) => {
    const assignedId = (o.assignedMotoboyId || '').toLowerCase().trim();
    const assignedName = (o.assignedMotoboyName || '').toLowerCase().trim();

    const mId = (effectiveMotoboyId || '').toLowerCase().trim();
    const mActiveId = (activeMotoboyId || '').toLowerCase().trim();
    const mInitId = (initialMotoboyId || '').toLowerCase().trim();
    const mName = (activeMotoboy?.name || '').toLowerCase().trim();
    const mUsername = (activeMotoboy?.username || '').toLowerCase().trim();

    if (!assignedId && !assignedName) return false;

    // Direct ID/Username/Name matches
    const isIdMatch =
      (mId && assignedId === mId) ||
      (mActiveId && assignedId === mActiveId) ||
      (mInitId && assignedId === mInitId) ||
      (mUsername && assignedId === mUsername) ||
      (mName && assignedId === mName);

    const isNameMatch =
      (mName && assignedName === mName) ||
      (mUsername && assignedName === mUsername) ||
      (mId && assignedName === mId) ||
      (mActiveId && assignedName === mActiveId) ||
      (mName && (assignedName.includes(mName) || mName.includes(assignedName))) ||
      (mName && (assignedId.includes(mName) || mName.includes(assignedId))) ||
      (assignedName && (mName.includes(assignedName) || mUsername.includes(assignedName)));

    return isIdMatch || isNameMatch;
  };

  const assignedOrders = orders
    .filter((o) => {
      if (o.status === 'delivered' || o.status === 'cancelled') return false;
      return matchesDriver(o);
    })
    .sort((a, b) => (a.routeSequence || 0) - (b.routeSequence || 0));

  const completedOrders = orders.filter((o) => {
    if (o.status !== 'delivered') return false;
    return matchesDriver(o);
  });

  const formattedCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
        if (perm === 'granted') {
          triggerSystemActionToast('Notificações de áudio e tela ativadas com sucesso!');
        }
      } catch (err) {
        console.warn('Notification permission error:', err);
      }
    }
  };

  // Sound and vibration alert
  const playNewOrderAlert = (bodyMsg: string = 'Novo pedido ou rota disponível') => {
    if (!soundEnabled) return;

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 400]);
      } catch {
        // ignore
      }
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const playBeep = (freq: number, startTime: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

          gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
          gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(ctx.currentTime + startTime);
          osc.stop(ctx.currentTime + startTime + duration);
        };

        // Pleasant 3-tone chime sequence (C5, E5, G5)
        playBeep(523.25, 0, 0.18);
        playBeep(659.25, 0.15, 0.2);
        playBeep(783.99, 0.32, 0.45);
      }
    } catch (e) {
      console.warn('Could not play audio alert:', e);
    }

    // Push system browser notification if allowed
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Rota Fácil Delivery 🛵', {
          body: bodyMsg,
          tag: 'new-order-alert',
        });
      } catch (err) {
        console.warn('Error firing system notification:', err);
      }
    }
  };

  const prevAssignedIdsRef = useRef<string[]>([]);
  const isInitialMount = useRef(true);

  useEffect(() => {
    const currentAssignedIds = assignedOrders.map((o) => o.id);

    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevAssignedIdsRef.current = currentAssignedIds;
      return;
    }

    // Identify newly assigned orders that weren't assigned in the previous tick
    const newlyAssigned = assignedOrders.filter(
      (o) => !prevAssignedIdsRef.current.includes(o.id)
    );

    if (newlyAssigned.length > 0) {
      playNewOrderAlert(`🛵 Novo(s) ${newlyAssigned.length} pedido(s) atribuído(s) a você!`);
    }

    prevAssignedIdsRef.current = currentAssignedIds;
  }, [assignedOrders]);

  const handleOpenGoogleMaps = (address: string, lat?: number, lng?: number) => {
    const query = (lat && lng) ? `${lat},${lng}` : encodeURIComponent(address);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(url, '_blank');
  };

  const handleOpenWaze = (address: string, lat?: number, lng?: number) => {
    const url = (lat && lng)
      ? `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`
      : `https://www.waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
    window.open(url, '_blank');
  };

  const handleSendWhatsAppArrival = (order: Order) => {
    const message = `Olá ${order.clientName}! 🛵 Seu motoboy (${activeMotoboy?.name || 'Rota Fácil'}) CHEGOU com o pedido #${order.codeNumber}! Pode vir receber, por favor! 🛵`;
    const cleanPhone = order.clientPhone.replace(/\D/g, '');
    if (cleanPhone) {
      const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
  };

  const handleSendWhatsAppDeparture = (order: Order) => {
    const trackingUrl = `${window.location.origin}/?rastreio=${order.trackingCode || order.id}`;
    const message = `Olá ${order.clientName}! 🛵 Seu pedido #${order.codeNumber} SAIU PARA ENTREGA com o entregador ${activeMotoboy?.name || 'Rota Fácil'}! 🛵\n\nAcompanhe no mapa em tempo real:\n${trackingUrl}`;
    const cleanPhone = order.clientPhone.replace(/\D/g, '');
    if (cleanPhone) {
      const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    }
  };

  const handleLogoutAccount = () => {
    if (window.confirm('Deseja sair da conta do entregador?')) {
      try {
        localStorage.removeItem('rota_facil_session');
      } catch {
        // ignore
      }
      if (onLogout) {
        onLogout();
      } else {
        window.location.reload();
      }
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 text-slate-900 rounded-3xl border border-slate-200 shadow-md overflow-hidden flex flex-col font-sans min-h-[680px] relative">

      {/* Official Store Automation Notification Toast */}
      {actionToast && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-slate-900/95 border-b-2 border-amber-400 text-white p-2.5 px-3.5 shadow-2xl flex items-center gap-2.5 animate-slideDown backdrop-blur-md rounded-t-3xl">
          <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-black text-sm">
            ✓
          </div>
          <div className="text-xs font-bold text-slate-100 leading-snug">
            {actionToast}
          </div>
        </div>
      )}

      {/* 1. Header Bar - Clean Motoboy Profile & Action Bar */}
      <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
        {/* Left: Driver Avatar + Protagonist Name + Online & GPS Badge */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Motoboy Photo / Avatar */}
          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-2xs shrink-0 border border-slate-700">
            {activeMotoboy?.name ? activeMotoboy.name.charAt(0).toUpperCase() : '👤'}
          </div>

          <div className="min-w-0">
            {/* Protagonist Name */}
            <h3 className="font-black text-base sm:text-lg text-slate-900 leading-snug truncate">
              {activeMotoboy?.name || 'Entregador'}
            </h3>

            {/* Online Status & Discrete GPS Badge */}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="text-xs font-bold text-emerald-700 truncate">
                  Online
                </span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                <span className="text-emerald-600">📍</span>
                <span>Localização ativa</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Action Icons: Sound Toggle, Dev Panel, Install, Logout/Switch */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Dev GPS Toggle (Discrete Tool) */}
          <button
            type="button"
            onClick={() => setShowDevGpsPanel(!showDevGpsPanel)}
            title="Alternar Painel Dev/Testes de GPS"
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              showDevGpsPanel
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
          </button>

          {/* Sound Test / Toggle Button */}
          <button
            type="button"
            onClick={() => {
              if (notificationPermission === 'default') {
                requestNotificationPermission();
              }
              playNewOrderAlert();
              triggerSystemActionToast('Sinal sonoro de entrega testado!');
            }}
            title="Testar sinal sonoro de entregas"
            className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 border border-slate-200 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-2xs"
          >
            <Volume2 className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline text-slate-700">Som</span>
          </button>

          {/* Profile Switcher or Logout Button */}
          {isLockedToMotoboy ? (
            <button
              type="button"
              onClick={handleLogoutAccount}
              title="Sair da Conta de Entregador"
              className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          ) : (
            <select
              value={activeMotoboyId}
              onChange={(e) => setActiveMotoboyId(e.target.value)}
              title="Alternar Perfil de Entregador"
              className="bg-slate-100 text-slate-800 font-bold text-xs py-2 px-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 max-w-[110px] truncate cursor-pointer"
            >
              {motoboys.map((m) => (
                <option key={m.id} value={m.id}>
                  ⚙️ {m.name.split(' ')[0]}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* DEV / TEST GPS PANEL (Only visible when toggled) */}
      {showDevGpsPanel && (
        <div className="bg-amber-950/90 text-amber-100 px-3.5 py-2.5 text-xs font-medium border-b border-amber-800 flex flex-col sm:flex-row items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded">
              MODO TESTE
            </span>
            <span className="text-amber-200 font-mono text-[11px] truncate">
              {gpsStatusMsg}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRequestGpsManual}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-[10px] transition-all cursor-pointer"
            >
              📍 Atualizar GPS Real
            </button>
            <button
              type="button"
              onClick={() => {
                const testLat = -26.9298;
                const testLng = -49.0965;
                setDeviceGps({ lat: testLat, lng: testLng });
                setGpsStatusMsg(`📍 Posição Simula Longe (~3km)`);
                if (activeMotoboy) {
                  saveMotoboyToCloud({
                    ...activeMotoboy,
                    currentLat: testLat,
                    currentLng: testLng,
                  });
                }
                triggerSystemActionToast('📍 Posição de teste definida (~3 km da loja)!');
              }}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 font-black rounded-lg text-[10px] border border-amber-500/30 transition-all cursor-pointer"
            >
              📍 Simular Longe (~3km)
            </button>
          </div>
        </div>
      )}

      {/* 2. Top Summary Earnings & Progress Bar (CLICKABLE TO OPEN DETAILED BREAKDOWN) */}
      <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-800 font-extrabold flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-slate-700" />
              {assignedOrders.length === 1 ? '1 pedido na bolsa' : `${assignedOrders.length} pedidos na bolsa`}
            </span>
          </div>

          {/* Clickable Earnings Summary */}
          <button
            type="button"
            onClick={() => setIsEarningsModalOpen(true)}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 active:scale-98 px-3 py-1.5 rounded-xl shadow-2xs transition-all cursor-pointer group"
            title="Clique para ver o resumo completo do dia"
          >
            <span className="text-[11px] text-slate-500 font-black uppercase group-hover:text-slate-700">Hoje:</span>
            <span className="font-black text-sm text-slate-900 flex items-center gap-1">
              {completedOrders.length} {completedOrders.length === 1 ? 'entrega' : 'entregas'} • {formattedCurrency(
                completedOrders.reduce((acc, o) => acc + o.total, 0) || (activeMotoboy?.totalEarnedToday || 0)
              )} <span className="text-[10px] font-bold text-slate-400">cobrados</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* PROGRESS BAR FOR ACTIVE DELIVERY RUN ONLY */}
        {assignedOrders.length > 0 && (
          <div className="pt-1">
            <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-500 mb-1">
              <span>PROGRESSO DA ROTA ATIVA</span>
              <span className="text-slate-800 font-bold">
                {assignedOrders.filter((o) => o.status === 'in_transit').length > 0
                  ? 'Em rota de entrega'
                  : 'Retirada / A caminho'} • {assignedOrders.length} {assignedOrders.length === 1 ? 'parada pendente' : 'paradas pendentes'}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
              <div
                className="bg-slate-900 h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${
                    assignedOrders.some((o) => o.status === 'in_transit')
                      ? 65
                      : assignedOrders.some((o) => o.status === 'picked_up')
                      ? 35
                      : 15
                  }%`
                }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Navigation Tabs */}
      <div className="bg-slate-100 px-2 py-2 border-b border-slate-200 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Minha Bolsa
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'active' ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-700'
          }`}>
            {assignedOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'map'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          Mapa
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'completed'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Concluídas
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'completed' ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-700'
          }`}>
            {completedOrders.length}
          </span>
        </button>
      </div>

      {/* 4. Main Body Content */}
      <div className="p-3.5 space-y-4 flex-1 overflow-y-auto bg-slate-50 flex flex-col justify-between">
        {activeTab === 'active' ? (
          <>
            {/* Quick Batch Bar or Informative Status Bar */}
            {assignedOrders.length > 0 && (
              assignedOrders.some((o) => o.status === 'in_transit') ? (
                /* INFORMATIVE ROUTE STATUS BAR WHEN ALREADY IN TRANSIT */
                <div className="w-full py-3 px-4 bg-slate-900 border border-emerald-500/50 rounded-2xl flex items-center justify-between text-xs font-black text-emerald-300 shadow-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span className="uppercase">🚚 ROTA EM ANDAMENTO</span>
                  </div>
                  <span className="text-slate-300 font-bold bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
                    Entrega {assignedOrders.findIndex(o => o.status === 'in_transit') >= 0 ? assignedOrders.findIndex(o => o.status === 'in_transit') + 1 : 1} de {assignedOrders.length}
                  </span>
                </div>
              ) : assignedOrders.some((o) => o.status !== 'picked_up' && o.status !== 'in_transit') ? (
                /* BATCH PICKUP CONFIRMATION BUTTON */
                <button
                  type="button"
                  onClick={() => {
                    assignedOrders.forEach((o) => {
                      if (o.status !== 'picked_up' && o.status !== 'in_transit') {
                        onUpdateOrderStatus(o.id, 'picked_up');
                      }
                    });
                    triggerSystemActionToast("✅ Retirada de todos os pedidos confirmada! Clique em Iniciar Rota ao sair.");
                  }}
                  className="w-full py-3.5 px-4 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-slate-950 font-black text-xs rounded-2xl shadow-xl flex items-center justify-center gap-2 uppercase transition-all cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 fill-current" />
                  Confirma retirada de todos os pedidos ({assignedOrders.length})
                </button>
              ) : assignedOrders.some((o) => o.status === 'picked_up') ? (
                /* BATCH START ROUTE BUTTON */
                <button
                  type="button"
                  onClick={() => {
                    assignedOrders.forEach((o) => {
                      if (o.status === 'picked_up') {
                        onUpdateOrderStatus(o.id, 'in_transit');
                      }
                    });
                    triggerSystemActionToast("🚀 Rota Iniciada! Todas as entregas estão em andamento.");
                  }}
                  className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-black text-xs rounded-2xl shadow-xl flex items-center justify-center gap-2 uppercase transition-all cursor-pointer animate-pulse"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  Iniciar rota completa ({assignedOrders.length} Entregas)
                </button>
              ) : null
            )}

            {/* Empty State or Active Orders */}
            {assignedOrders.length === 0 ? (
              <div className="my-auto py-6 px-2">
                <div className="bg-white rounded-2xl p-6 text-center border border-slate-200 shadow-xs space-y-4 max-w-sm mx-auto">
                  {activeMotoboy?.status === 'returning_to_store' ? (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mx-auto border border-slate-200">
                        <Building2 className="w-6 h-6 text-slate-800" />
                      </div>

                      <div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200 inline-block mb-1">
                          Retornando
                        </span>
                        <h4 className="font-black text-slate-900 text-lg">Voltando para a Loja</h4>
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                          Ao chegar na loja, toque no botão abaixo para entrar na fila.
                        </p>
                      </div>

                      {onConfirmArrivalAtStore && (
                        <button
                          type="button"
                          onClick={() => {
                            onConfirmArrivalAtStore(activeMotoboy.id);
                            triggerSystemActionToast("✅ Chegada confirmada na loja!");
                          }}
                          className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        >
                          <MapPin className="w-4 h-4 text-emerald-400" />
                          <span>Cheguei à Loja</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {/* DYNAMIC HUMAN-CENTERED QUEUE POSITION */}
                      {(() => {
                        const availableDrivers = motoboys.filter((m) => m.status === 'available');
                        const driverIndex = availableDrivers.findIndex((m) => m.id === activeMotoboy?.id);
                        const queuePos = driverIndex >= 0 ? driverIndex + 1 : 1;
                        const effectiveTimestamp = activeMotoboy?.joinedQueueAt || availableSince;
                        const minutesInQueue = Math.max(0, Math.floor((Date.now() - effectiveTimestamp) / 60000));
                        const formattedQueueTime = String(minutesInQueue).padStart(2, '0');

                        const isPaused = activeMotoboy?.status === 'busy' || activeMotoboy?.status === 'offline';

                        if (isPaused) {
                          return (
                            <div className="space-y-4 py-2">
                              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                                ⏸️ Disponibilidade Pausada
                              </div>
                              <div>
                                <h4 className="text-xl font-black text-slate-900">Você está em pausa</h4>
                                <p className="text-xs text-slate-500 mt-1 font-medium">
                                  Você não receberá novos pedidos até voltar a ficar disponível.
                                </p>
                              </div>
                              {onUpdateMotoboyStatus && activeMotoboy && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateMotoboyStatus(activeMotoboy.id, 'available');
                                    setAvailableSince(Date.now());
                                    triggerSystemActionToast("🟢 Você voltou a ficar disponível na loja!");
                                  }}
                                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <span>🟢 Voltar a ficar Disponível</span>
                                </button>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-5 py-2">
                            {/* DISPONÍVEL NA LOJA BADGE */}
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                              <span className="uppercase tracking-wider">🟢 DISPONÍVEL NA LOJA</span>
                            </div>

                            {/* MAIN QUEUE POSITION HERO */}
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1 text-center">
                              {queuePos === 1 ? (
                                <>
                                  <span className="text-emerald-600 font-black text-sm uppercase tracking-wide block">
                                    Você é o próximo
                                  </span>
                                  <strong className="text-4xl font-black text-slate-900 block tracking-tight">
                                    1º na fila
                                  </strong>
                                </>
                              ) : (
                                <>
                                  <strong className="text-4xl font-black text-slate-900 block tracking-tight">
                                    {queuePos}º na fila
                                  </strong>
                                  <span className="text-slate-600 font-extrabold text-xs block pt-0.5">
                                    {queuePos - 1} {queuePos - 1 === 1 ? 'motoboy antes de você' : 'motoboys antes de você'}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* AGUARDANDO E AVISO */}
                            <div className="space-y-1.5">
                              <h5 className="font-black text-slate-900 text-sm">Aguardando uma nova entrega</h5>
                              <p className="text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5">
                                <span>🔔 Você será avisado quando receber um pedido</span>
                              </p>
                              <p className="text-xs text-slate-400 font-semibold pt-1">
                                Tempo na fila: <strong className="text-slate-700">{formattedQueueTime} min</strong>
                              </p>
                            </div>

                            {/* PAUSAR BOTÃO */}
                            {onUpdateMotoboyStatus && activeMotoboy && (
                              <div className="pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateMotoboyStatus(activeMotoboy.id, 'busy');
                                    triggerSystemActionToast("⏸️ Disponibilidade pausada.");
                                  }}
                                  className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <Pause className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Pausar disponibilidade</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* List of active delivery cards */
              <div className="space-y-3">
                {assignedOrders.map((order, index) => {
                  const isInTransit = order.status === 'in_transit';
                  const isFirstOrder = index === 0;
                  const isExpanded = isFirstOrder || manualExpandedId === order.id;
                  const hasArrived = Boolean(arrivedOrderIds[order.id]);

                  const isReadyAtCounter = order.status === 'ready_at_counter';
                  const isPickedUp = order.status === 'picked_up';
                  const isPendingInKitchen = order.status === 'preparing' || order.status === 'pending';

                  // Street line vs Neighborhood
                  const streetLine = order.street || order.address;
                  const neighborhoodLine = `${order.neighborhood || 'Centro'} • Blumenau`;

                  // Circle stop numbers: ⚡ 1ª PARADA, 2ª PARADA, etc.
                  const stopLabel = isFirstOrder ? '⚡ 1ª PARADA' : `${index + 1}ª PARADA`;

                  // COMPACT CARD FOR SECONDARY PARADAS
                  if (!isExpanded) {
                    return (
                      <div
                        key={order.id}
                        onClick={() => setManualExpandedId(order.id)}
                        className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-extrabold text-[11px] border border-slate-200">
                              {stopLabel}
                            </span>
                            <span className="font-extrabold text-sm text-slate-900">
                              #{order.codeNumber}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isReadyAtCounter ? (
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                🟢 Pronto
                              </span>
                            ) : isInTransit ? (
                              <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                🔵 Em rota
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                🟠 Aguardando
                              </span>
                            )}

                            {onReorderMotoboyRoute && index > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const reordered = [...assignedOrders];
                                  const temp = reordered[index];
                                  reordered[index] = reordered[index - 1];
                                  reordered[index - 1] = temp;
                                  onReorderMotoboyRoute(reordered.map((o) => o.id));
                                  setManualExpandedId(null);
                                }}
                                className="ml-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 font-extrabold text-[10px] rounded-lg transition-all cursor-pointer shadow-2xs"
                                title="Fazer esta parada em 1º lugar"
                              >
                                ▲ Fazer 1ª
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-600 font-medium pt-0.5">
                          <div className="flex items-center gap-1.5 truncate pr-2">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-extrabold text-[10px] shrink-0 border border-emerald-200">
                              📍 {order.neighborhood || 'Centro'}
                            </span>
                            <span className="truncate font-semibold text-slate-800">{streetLine}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 shrink-0">Toque para ver</span>
                        </div>
                      </div>
                    );
                  }

                  // EXPANDED PRIMARY CARD (1ª PARADA)
                  return (
                    <div
                      key={order.id}
                      className={`rounded-2xl border transition-all overflow-hidden bg-white ${
                        hasArrived
                          ? 'border-amber-400 shadow-md ring-1 ring-amber-400/30'
                          : isInTransit
                          ? 'border-slate-800 shadow-md'
                          : isFirstOrder
                          ? 'border-slate-300 shadow-xs ring-1 ring-slate-200'
                          : 'border-slate-200'
                      }`}
                    >
                      {/* CARD HEADER */}
                      <div className="bg-slate-900 px-3.5 py-2.5 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1 shadow-2xs">
                            {stopLabel}
                          </span>
                          <span className="font-extrabold text-xs text-slate-300">
                            {isFirstOrder ? 'PRÓXIMA ENTREGA' : `Parada ${index + 1} de ${assignedOrders.length}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-black text-base text-amber-300">
                            #{order.codeNumber}
                          </span>
                          {!isFirstOrder && (
                            <button
                              type="button"
                              onClick={() => setManualExpandedId(null)}
                              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700"
                            >
                              Recolher
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-3.5 space-y-3">
                        {/* 1. ENDEREÇO DA ENTREGA */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                          <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
                            Endereço de Entrega
                          </span>
                          <p className="text-base font-black text-slate-900 leading-snug">
                            {streetLine}
                          </p>
                          <div className="pt-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 font-black text-xs border border-emerald-300 shadow-2xs">
                              📍 Bairro: {order.neighborhood || 'Centro'}
                            </span>
                          </div>
                        </div>

                        {/* 2. PAGAMENTO (ALTÍSSIMA VISIBILIDADE) */}
                        <div className="bg-slate-900 p-3 rounded-xl text-white flex items-center justify-between border border-slate-800 shadow-2xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                              {order.paymentMethod === 'dinheiro' && <DollarSign className="w-5 h-5 text-amber-400" />}
                              {order.paymentMethod === 'pix' && <QrCode className="w-5 h-5 text-emerald-400" />}
                              {order.paymentMethod === 'cartao_maquininha' && <CreditCard className="w-5 h-5 text-sky-400" />}
                            </div>
                            <div>
                              <span className="text-[10px] font-extrabold text-slate-400 uppercase block tracking-wider">
                                Forma de Pagamento
                              </span>
                              <span className="font-black text-xs text-amber-300 uppercase block">
                                {order.paymentMethod === 'dinheiro'
                                  ? '💵 DINHEIRO'
                                  : order.paymentMethod === 'pix'
                                  ? '⚡ PIX (PAGO NA LOJA)'
                                  : '💳 CARTÃO (MAQUININHA)'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">
                              {order.paymentMethod === 'pix' ? 'Valor' : 'Cobrar Cliente'}
                            </span>
                            <span className="font-black text-2xl text-emerald-400 leading-none block">
                              {formattedCurrency(order.total)}
                            </span>
                          </div>
                        </div>

                        {/* Troco Info */}
                        {order.changeFor && order.paymentMethod === 'dinheiro' && (
                          <div className="bg-amber-50 border border-amber-300 p-2 rounded-lg flex items-center justify-between text-xs font-bold text-amber-900">
                            <span>⚠️ LEVAR TROCO PARA:</span>
                            <span className="font-extrabold bg-amber-200 px-2 py-0.5 rounded border border-amber-400">
                              {formattedCurrency(order.changeFor)}
                            </span>
                          </div>
                        )}

                        {/* CLIENTE & CONTATO (QUANDO EM ROTA) */}
                        {isInTransit && (
                          <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              <span>{order.clientName}</span>
                            </div>

                            {order.clientPhone && (
                              <a
                                href={`tel:${order.clientPhone}`}
                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1 text-[11px] font-extrabold transition-all shadow-2xs"
                              >
                                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Ligar</span>
                              </a>
                            )}
                          </div>
                        )}

                        {/* STATUS MESSAGE & MAIN ACTION BUTTON */}
                        <div className="pt-1 space-y-2">
                          {/* STATUS TAG */}
                          {isPendingInKitchen ? (
                            <div className="w-full py-2.5 px-3 bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs rounded-xl flex items-center justify-center gap-2 text-center">
                              <Clock className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                              <span>⏳ Aguardando a loja finalizar o pedido</span>
                            </div>
                          ) : isReadyAtCounter ? (
                            <div className="w-full py-2.5 px-3 bg-emerald-50 border border-emerald-300 text-emerald-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 text-center">
                              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>✅ PEDIDO PRONTO PARA RETIRADA NO BALCÃO</span>
                            </div>
                          ) : isPickedUp ? (
                            <div className="w-full py-2.5 px-3 bg-slate-900 text-amber-300 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 text-center">
                              <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>🎒 RETIRADO (NA BAG) — PRONTO PARA SAÍDA</span>
                            </div>
                          ) : null}

                          {/* ACTION BUTTONS */}
                          {isPendingInKitchen ? (
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateOrderStatus(order.id, 'picked_up');
                                triggerSystemActionToast(`✅ Retirada do pedido #${order.codeNumber} confirmada!`);
                              }}
                              className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all uppercase cursor-pointer"
                            >
                              <ShoppingBag className="w-4 h-4 text-amber-400" />
                              <span>Confirmar Retirada Agora</span>
                            </button>
                          ) : isReadyAtCounter ? (
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateOrderStatus(order.id, 'picked_up');
                                triggerSystemActionToast(`✅ Retirada do pedido #${order.codeNumber} confirmada!`);
                              }}
                              className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all uppercase cursor-pointer animate-pulse"
                            >
                              <ShoppingBag className="w-5 h-5 text-slate-950 fill-current" />
                              <span>Confirmar Retirada</span>
                            </button>
                          ) : isPickedUp ? (
                            <button
                              type="button"
                              onClick={() => {
                                assignedOrders.forEach((o) => {
                                  if (o.status !== 'in_transit' && o.status !== 'delivered' && o.status !== 'cancelled') {
                                    onUpdateOrderStatus(o.id, 'in_transit');
                                  }
                                });
                                if (onUpdateMotoboyStatus && activeMotoboy) {
                                  onUpdateMotoboyStatus(activeMotoboy.id, 'delivering');
                                }
                                triggerSystemActionToast(`🚀 Rota iniciada com ${assignedOrders.length} ${assignedOrders.length === 1 ? 'parada' : 'paradas'}!`);
                              }}
                              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all uppercase cursor-pointer"
                            >
                              <Zap className="w-5 h-5 fill-current" />
                              <span>Iniciar Rota ({assignedOrders.length} {assignedOrders.length === 1 ? 'parada' : 'paradas'})</span>
                            </button>
                          ) : isInTransit ? (
                            <div className="space-y-2">
                              {/* ROTA GPS BUTTONS */}
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenWaze(order.address, order.lat, order.lng)}
                                  className="py-3 px-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                                >
                                  <Navigation className="w-4 h-4 fill-current" />
                                  <span>WAZE</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenGoogleMaps(order.address, order.lat, order.lng)}
                                  className="py-3 px-2 bg-blue-700 hover:bg-blue-600 active:scale-95 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                                >
                                  <MapPin className="w-4 h-4" />
                                  <span>GOOGLE MAPS</span>
                                </button>
                              </div>

                              {/* FINAL STEP BUTTON: CHEGUEI OR ENTREGUE */}
                              {!hasArrived ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setArrivedOrderIds((prev) => ({ ...prev, [order.id]: true }));
                                    onSimulateArrival(order);
                                    triggerSystemActionToast("📍 Cheguei ao local! Cliente notificado.");
                                  }}
                                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all uppercase cursor-pointer"
                                >
                                  <MapPin className="w-4 h-4 text-emerald-400" />
                                  <span>CHEGUEI AO LOCAL</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateOrderStatus(order.id, 'delivered');
                                    setManualExpandedId(null);
                                    triggerSystemActionToast("✓ Entrega concluída!");
                                  }}
                                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all uppercase cursor-pointer"
                                >
                                  <CheckCircle2 className="w-5 h-5" />
                                  <span>✓ CONCLUIR ENTREGA</span>
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : activeTab === 'map' ? (
          /* LIVE ROUTE MAP TAB */
          <div className="space-y-3">
            <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
                  <h4 className="font-extrabold text-sm text-white">Mapa da Rota Ao Vivo</h4>
                </div>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full font-bold text-slate-300">
                  {deviceGps ? '📍 GPS Sincronizado' : '📍 Permissão Solicitada'}
                </span>
              </div>

              {/* AVISAR LOJA VOLTANDO BUTTON */}
              <button
                type="button"
                onClick={() => {
                  if (activeMotoboy) {
                    const nextLat = deviceGps?.lat || activeMotoboy.currentLat || -26.9248;
                    const nextLng = deviceGps?.lng || activeMotoboy.currentLng || -49.0815;
                    const updated = {
                      ...activeMotoboy,
                      status: 'returning_to_store' as const,
                      currentLat: nextLat,
                      currentLng: nextLng,
                    };
                    saveMotoboyToCloud(updated);
                    if (onUpdateMotoboyStatus) {
                      onUpdateMotoboyStatus(activeMotoboy.id, 'returning_to_store');
                    }
                    triggerSystemActionToast('🛵 Notificação enviada à loja: "Voltando pra Loja (~5 min)"!');
                  }
                }}
                className={`w-full py-2.5 px-3 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                  activeMotoboy?.status === 'returning_to_store'
                    ? 'bg-amber-500 text-slate-950 border border-amber-400 animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400'
                }`}
              >
                <Navigation className="w-4 h-4 text-white" />
                <span>
                  {activeMotoboy?.status === 'returning_to_store'
                    ? '⚡ STATUS: VOLTANDO PARA A LOJA (~5 MIN)'
                    : '🛵 AVISAR LOJA: ESTOU VOLTANDO DA ROTA (~5 MIN)'}
                </span>
              </button>
            </div>

            <div className="h-[400px] rounded-2xl overflow-hidden border border-slate-300 shadow-sm">
              <RouteMap
                origin={{
                  name: 'Ponto de Partida / Loja',
                  address: 'Rua dos Caçadores, 653, Blumenau - SC',
                  lat: -26.9228,
                  lng: -49.1014,
                }}
                motoboyName={activeMotoboy?.name}
                motoboyVehicle={activeMotoboy?.vehicleModel}
                showMotoboyMarker={true}
                motoboyLat={deviceGps?.lat || activeMotoboy?.currentLat}
                motoboyLng={deviceGps?.lng || activeMotoboy?.currentLng}
                stops={assignedOrders.map((o, idx) => ({
                  id: o.id,
                  orderIndex: idx + 1,
                  title: `#${o.codeNumber} - ${o.clientName}`,
                  address: o.address,
                  lat: o.lat,
                  lng: o.lng,
                  status: o.status === 'delivered' ? 'delivered' : o.status === 'in_transit' ? 'in_transit' : 'pending',
                  priority: 'high',
                  recipientName: o.clientName,
                }))}
              />
            </div>
          </div>
        ) : (
          /* COMPLETED ORDERS TAB */
          <div className="space-y-3">
            {/* DAILY SUMMARY HEADER CARD */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md space-y-3 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-amber-300 tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Entregas de Hoje
                </span>
                <span className="text-[11px] font-extrabold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                  {new Date().toLocaleDateString('pt-BR')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-center">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                    Concluídas
                  </span>
                  <strong className="text-xl font-black text-white block mt-0.5">
                    {activeMotoboy?.deliveriesCountToday || completedOrders.length}
                  </strong>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                    Faturamento Taxas
                  </span>
                  <strong className="text-xl font-black text-emerald-400 block mt-0.5">
                    {formattedCurrency(
                      activeMotoboy?.totalEarnedToday ||
                        completedOrders.reduce(
                          (acc, o) => acc + (o.deliveryFee || activeMotoboy?.perDeliveryFee || 8.5),
                          0
                        )
                    )}
                  </strong>
                </div>
              </div>
            </div>

            {completedOrders.length === 0 ? (
              <div className="py-10 text-center text-slate-500 space-y-2 bg-white rounded-2xl border border-slate-200">
                <CheckCircle2 className="w-12 h-12 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-700">Nenhuma entrega concluída hoje ainda.</p>
                <p className="text-[11px] text-slate-400">Assim que você finalizar pedidos, eles aparecerão aqui com o valor da taxa.</p>
              </div>
            ) : (
              completedOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-white border border-slate-200 p-3.5 rounded-2xl flex items-center justify-between text-xs shadow-2xs hover:border-slate-300 transition-all"
                >
                  <div className="space-y-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-900 text-sm">Pedido #{ord.codeNumber}</span>
                      <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ CONCLUÍDO
                      </span>
                    </div>
                    <p className="text-slate-800 font-bold truncate">{ord.clientName} • {ord.neighborhood}</p>
                    <span className="text-[11px] text-slate-500 block truncate">{ord.address}</span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-black text-slate-900 text-sm block">
                      {formattedCurrency(ord.total)}
                    </span>
                    <span className="text-[11px] text-emerald-700 block font-black">
                      Taxa: +{formattedCurrency(ord.deliveryFee || activeMotoboy?.perDeliveryFee || 8.5)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 5. Footer Summary Bar */}
      <div className="bg-white px-4 py-3 border-t border-slate-200 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
          <span>📍 Blumenau - SC</span>
          <span className="text-slate-900 font-black">
            {completedOrders.length} {completedOrders.length === 1 ? 'entrega finalizada' : 'entregas finalizadas'}
          </span>
        </div>
      </div>

      {/* DETAILED EARNINGS & SALES BREAKDOWN MODAL */}
      {isEarningsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-slate-200 relative my-auto animate-scaleUp text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  💰
                </div>
                <div>
                  <h4 className="font-black text-base text-slate-900">Resumo de Hoje</h4>
                  <p className="text-xs text-slate-500 font-medium">{new Date().toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEarningsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <LogOut className="w-5 h-5 rotate-180" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Deliveries Count & Km Driven */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Entregas</span>
                  <strong className="text-2xl font-black text-slate-900 block mt-0.5">
                    {completedOrders.length}
                  </strong>
                  <span className="text-[10px] text-slate-500 font-bold block">finalizadas hoje</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Km Rodados</span>
                  <strong className="text-2xl font-black text-slate-900 block mt-0.5">
                    ~{(completedOrders.length * 6.1).toFixed(1)} <span className="text-xs">km</span>
                  </strong>
                  <span className="text-[10px] text-slate-500 font-bold block">em rotas calculadas</span>
                </div>
              </div>

              {/* Total Collected / Sales */}
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-1 shadow-xs border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-bold">Cobrado/Recebido dos Clientes:</span>
                  <span className="font-black text-emerald-400 text-base">
                    {formattedCurrency(
                      completedOrders.reduce((acc, o) => acc + o.total, 0)
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium leading-tight">
                  Valor total das vendas (Pix/Dinheiro/Cartão) a ser prestado contas com a loja no fechamento.
                </p>
              </div>

              {/* Net Delivery Fee Earnings */}
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-xs font-black text-emerald-950">
                  <span>Ganho em Taxas de Entrega:</span>
                  <span className="text-emerald-700 text-base">
                    {formattedCurrency(
                      completedOrders.reduce(
                        (acc, o) => acc + (o.deliveryFee || activeMotoboy?.perDeliveryFee || 8.5),
                        0
                      )
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 font-medium leading-tight">
                  Seu ganho garantido acumulado hoje (acumula por entrega realizada).
                </p>
              </div>

              {/* Time in route */}
              <div className="flex items-center justify-between text-xs text-slate-600 font-bold pt-1 px-1">
                <span>Tempo estimado em rota:</span>
                <span className="text-slate-900 font-black">~{completedOrders.length * 17} minutos</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEarningsModalOpen(false)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer uppercase tracking-wider"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
