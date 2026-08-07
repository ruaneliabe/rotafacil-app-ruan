import React, { useState, useEffect, useRef } from 'react';
import { Order, Motoboy } from '../types';
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
  User
} from 'lucide-react';

interface MotoboyAppProps {
  motoboys: Motoboy[];
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onSimulateArrival: (order: Order) => void;
  onConfirmArrivalAtStore?: (motoboyId: string) => void;
  initialMotoboyId?: string;
  isLockedToMotoboy?: boolean;
  onLogout?: () => void;
}

export const MotoboyApp: React.FC<MotoboyAppProps> = ({
  motoboys,
  orders,
  onUpdateOrderStatus,
  onSimulateArrival,
  onConfirmArrivalAtStore,
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

  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [showNotificationToast, setShowNotificationToast] = useState<boolean>(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);
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

  const effectiveMotoboyId = activeMotoboy?.id || activeMotoboyId;

  const matchesDriver = (o: Order) => {
    const assignedId = (o.assignedMotoboyId || '').toLowerCase().trim();
    const assignedName = (o.assignedMotoboyName || '').toLowerCase().trim();

    const mId = (effectiveMotoboyId || '').toLowerCase().trim();
    const mActiveId = (activeMotoboyId || '').toLowerCase().trim();
    const mName = (activeMotoboy?.name || '').toLowerCase().trim();
    const mUsername = (activeMotoboy?.username || '').toLowerCase().trim();

    if (!assignedId && !assignedName) return false;

    // Direct ID/Username/Name matches
    const isIdMatch =
      (mId && assignedId === mId) ||
      (mActiveId && assignedId === mActiveId) ||
      (mUsername && assignedId === mUsername) ||
      (mName && assignedId === mName);

    const isNameMatch =
      (mName && assignedName === mName) ||
      (mUsername && assignedName === mUsername) ||
      (mId && assignedName === mId) ||
      (mActiveId && assignedName === mActiveId) ||
      (mName && (assignedName.includes(mName) || mName.includes(assignedName))) ||
      (mName && (assignedId.includes(mName) || mName.includes(assignedId)));

    return isIdMatch || isNameMatch;
  };

  const assignedOrders = orders.filter((o) => {
    if (o.status === 'delivered' || o.status === 'cancelled') return false;
    return matchesDriver(o);
  });

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
  const playNewOrderAlert = () => {
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
          body: 'Novo pedido ou rota disponível na sua bolsa!',
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
    const currentAssignedIds = assignedOrders.map((o) => `${o.id}_${o.status}`);

    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevAssignedIdsRef.current = currentAssignedIds;
      return;
    }

    const hasNewAssignmentOrReady = currentAssignedIds.some(
      (idStatus) => !prevAssignedIdsRef.current.includes(idStatus)
    );

    if (hasNewAssignmentOrReady) {
      playNewOrderAlert();
      setShowNotificationToast(true);
      const timer = setTimeout(() => setShowNotificationToast(false), 7000);
      return () => clearTimeout(timer);
    }

    prevAssignedIdsRef.current = currentAssignedIds;
  }, [assignedOrders]);

  const handleOpenGoogleMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  };

  const handleOpenWaze = (address: string) => {
    const url = `https://www.waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
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
    <div className="w-full max-w-md mx-auto bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col font-sans min-h-[680px] relative">
      
      {/* Toast Alert when new order is assigned */}
      {showNotificationToast && (
        <div className="absolute top-16 left-3 right-3 z-50 bg-slate-900/95 border-2 border-emerald-500 text-slate-100 p-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-fadeIn backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold shrink-0">
              <BellRing className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="font-extrabold text-xs text-emerald-300 uppercase tracking-wide block">
                NOVA ROTA / PEDIDO DISPONÍVEL 🔔
              </span>
              <span className="text-xs font-semibold text-slate-300">
                A loja atualizou os pedidos da sua bolsa.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowNotificationToast(false)}
            className="text-emerald-950 bg-emerald-400 hover:bg-emerald-300 font-extrabold text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm shrink-0"
          >
            OK
          </button>
        </div>
      )}

      {/* Official Store Automation Notification Toast */}
      {actionToast && (
        <div className="absolute top-16 left-3 right-3 z-50 bg-slate-900/95 border-2 border-emerald-500/70 text-emerald-100 p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-fadeIn backdrop-blur-md">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-black text-base border border-emerald-500/40">
            ✓
          </div>
          <div className="text-xs font-extrabold leading-snug">
            {actionToast}
          </div>
        </div>
      )}

      {/* 1. Header Bar - Clean Motoboy Profile & Action Bar */}
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
        {/* Left: Driver Avatar + Protagonist Name + Online Badge + ID */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Motoboy Photo / Avatar */}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 flex items-center justify-center font-black text-lg shadow-md shadow-emerald-500/20 shrink-0 border border-emerald-400/30">
            {activeMotoboy?.name ? activeMotoboy.name.charAt(0).toUpperCase() : '👤'}
          </div>

          <div className="min-w-0">
            {/* Protagonist Name */}
            <h3 className="font-black text-base sm:text-lg text-white leading-snug truncate">
              {activeMotoboy?.name || 'Entregador'}
            </h3>

            {/* Online Status Badge (+2px larger text) */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              <span className="text-xs font-bold text-emerald-400 truncate">
                Modo Entregador • Online
              </span>
            </div>

            {/* Driver ID / Vehicle Plate (Smaller & Subtle) */}
            <div className="text-[11px] font-mono font-medium text-slate-400 mt-0.5">
              ID: <span className="text-slate-300 font-bold">{activeMotoboy?.plate || activeMotoboy?.id.slice(0, 8).toUpperCase() || 'BNU-9B88'}</span>
            </div>
          </div>
        </div>

        {/* Right Action Icons: Sound Toggle & Test, Install, Logout/Switch */}
        <div className="flex items-center gap-2 shrink-0">
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
            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 active:scale-95 text-amber-400 border border-slate-700 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs"
          >
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline text-slate-300">Som</span>
          </button>

          {/* PWA Install Button (Hides if already in standalone app mode) */}
          {!(typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone)) && (
            <button
              type="button"
              onClick={handleInstallClick}
              title="Instalar App no Celular"
              className="px-2.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 text-emerald-300 border border-emerald-500/40 transition-all flex items-center gap-1.5 text-xs font-extrabold cursor-pointer"
            >
              <span>📲</span>
              <span className="hidden sm:inline">Instalar</span>
            </button>
          )}

          {/* Profile Switcher or Logout Button */}
          {isLockedToMotoboy ? (
            <button
              type="button"
              onClick={handleLogoutAccount}
              title="Sair da Conta de Entregador"
              className="px-2.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Sair</span>
            </button>
          ) : (
            <select
              value={activeMotoboyId}
              onChange={(e) => setActiveMotoboyId(e.target.value)}
              title="Alternar Perfil de Entregador"
              className="bg-slate-800 text-slate-200 font-bold text-xs py-2 px-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-[120px] truncate cursor-pointer"
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

      {/* PWA INSTALL GUIDE MODAL */}
      {showInstallGuide && (
        <div className="bg-slate-900 border-b border-emerald-500/40 p-4 space-y-3 text-xs text-slate-200">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-sm text-emerald-400 flex items-center gap-1.5">
              📱 Como instalar como App no Celular
            </span>
            <button
              onClick={() => setShowInstallGuide(false)}
              className="text-slate-400 hover:text-white font-bold text-sm px-2 py-0.5 rounded bg-slate-800"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="font-extrabold text-amber-300 block">🤖 No Android (Chrome):</span>
              <p className="text-slate-300 leading-relaxed">
                1. Toque nos <strong>3 pontinhos (⋮)</strong> no canto superior do navegador.<br />
                2. Toque em <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar aplicativo"</strong>.<br />
                3. O ícone do Rota Fácil aparecerá na sua tela como um app nativo!
              </p>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="font-extrabold text-cyan-300 block">🍏 No iPhone (Safari):</span>
              <p className="text-slate-300 leading-relaxed">
                1. Toque no botão de <strong>Compartilhar (↑)</strong> no rodapé do Safari.<br />
                2. Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.<br />
                3. Confirme em "Adicionar" no topo direito.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Top Summary Earnings & Progress Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 px-4 py-2.5 border-b border-slate-800 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-200 font-extrabold flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              {assignedOrders.length === 1 ? '1 pedido na bolsa' : `${assignedOrders.length} pedidos na bolsa`}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-xl">
            <span className="text-[10px] text-emerald-300 font-black uppercase">Hoje:</span>
            <span className="font-black text-sm text-emerald-400">
              {formattedCurrency(activeMotoboy?.totalEarnedToday || 0)}
            </span>
          </div>
        </div>

        {/* PROGRESS BAR FOR DELIVERY RUN */}
        {(assignedOrders.length > 0 || completedOrders.length > 0) && (
          <div className="pt-1">
            <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-400 mb-1">
              <span>PROGRESSO DA ROTA</span>
              <span className="text-emerald-400">{completedOrders.length} de {assignedOrders.length + completedOrders.length} entregas concluídas</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${
                    (assignedOrders.length + completedOrders.length) > 0
                      ? (completedOrders.length / (assignedOrders.length + completedOrders.length)) * 100
                      : 0
                  }%`
                }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Navigation Tabs */}
      <div className="bg-slate-900/80 px-3 py-2 border-b border-slate-800 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-3 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'bg-slate-800/80 text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          Minha Bolsa
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
            activeTab === 'active' ? 'bg-slate-950 text-emerald-400' : 'bg-slate-700 text-slate-300'
          }`}>
            {assignedOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-3 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'completed'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'bg-slate-800/80 text-slate-400 hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Concluídas
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
            activeTab === 'completed' ? 'bg-slate-950 text-emerald-400' : 'bg-slate-700 text-slate-300'
          }`}>
            {completedOrders.length}
          </span>
        </button>
      </div>

      {/* 4. Main Body Content */}
      <div className="p-3.5 space-y-4 flex-1 overflow-y-auto bg-slate-950 flex flex-col justify-between">
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
              <div className="my-auto space-y-4 py-4">
                {activeMotoboy?.status === 'returning_to_store' ? (
                  <div className="bg-slate-900/90 rounded-3xl p-6 text-center border border-amber-500/40 space-y-4 shadow-xl">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
                      <Building2 className="w-7 h-7 text-amber-400" />
                    </div>
                    <div>
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-block mb-1.5">
                        ROTA CONCLUÍDA
                      </span>
                      <h4 className="font-black text-white text-lg">Voltando para a Loja</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto font-medium">
                        Hope Burger (Rua dos Caçadores, 653)
                      </p>
                    </div>

                    {onConfirmArrivalAtStore && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            onConfirmArrivalAtStore(activeMotoboy.id);
                            triggerSystemActionToast("✅ Status atualizado: Você entrou na fila de rodízio da loja!");
                          }}
                          className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-extrabold text-xs rounded-xl border border-slate-700 transition-all inline-flex items-center gap-2 cursor-pointer shadow-md"
                        >
                          <MapPin className="w-4 h-4 text-emerald-400" />
                          <span>Cheguei à loja</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* NA FILA DE RODÍZIO VIEW */
                  <div className="bg-slate-900/90 rounded-3xl p-6 text-center border border-emerald-500/40 space-y-4 shadow-xl">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border-2 border-emerald-500/40">
                      <Store className="w-8 h-8 text-emerald-400" />
                    </div>

                    <div>
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1.5 mb-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Disponível na Loja
                      </span>
                      <h4 className="font-black text-white text-xl">Fila de Rodízio</h4>
                      <p className="text-xs text-slate-400 mt-1 font-medium">
                        Aguardando próximo despacho de pedidos da cozinha...
                      </p>
                    </div>

                    {/* DYNAMIC QUEUE POSITION */}
                    {(() => {
                      const availableDrivers = motoboys.filter((m) => m.status === 'available');
                      const driverIndex = availableDrivers.findIndex((m) => m.id === activeMotoboy?.id);
                      const queuePos = driverIndex >= 0 ? driverIndex + 1 : 1;

                      return (
                        <div className="pt-2 text-center">
                          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                              Sua Posição no Rodízio
                            </span>
                            <span className="text-2xl font-black text-emerald-400 block">
                              {queuePos}º na fila
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {onConfirmArrivalAtStore && activeMotoboy && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            onConfirmArrivalAtStore(activeMotoboy.id);
                            triggerSystemActionToast("✅ Presença confirmada na fila da loja!");
                          }}
                          className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all inline-flex items-center gap-2 cursor-pointer shadow-md"
                        >
                          <MapPin className="w-4 h-4 text-emerald-400" />
                          <span>Confirmar Presença na Loja</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* List of active delivery cards */
              <div className="space-y-4">
                {assignedOrders.map((order, index) => {
                  const isInTransit = order.status === 'in_transit';
                  const isFirstOrder = index === 0;
                  const hasArrived = Boolean(arrivedOrderIds[order.id]);

                  return (
                    <div
                      key={order.id}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        hasArrived
                          ? 'bg-slate-900 border-amber-400 shadow-xl shadow-amber-950/40 ring-2 ring-amber-400/40'
                          : isInTransit
                          ? 'bg-slate-900 border-emerald-500 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/30'
                          : isFirstOrder
                          ? 'bg-slate-900 border-slate-700 shadow-md'
                          : 'bg-slate-900/80 border-slate-800 opacity-90'
                      }`}
                    >
                      {/* Card Header: 🔥 PRÓXIMA ENTREGA or Parada #, Pedido #, Status */}
                      <div className="bg-slate-950/90 px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isFirstOrder ? (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md">
                              <Zap className="w-3.5 h-3.5 fill-current" />
                              PRÓXIMA ENTREGA
                            </span>
                          ) : (
                            <span className="w-7 h-7 rounded-lg font-black text-xs bg-slate-800 text-slate-200 flex items-center justify-center border border-slate-700">
                              #{index + 1}
                            </span>
                          )}
                          <div>
                            <span className="font-black text-sm text-white block leading-none">
                              Pedido #{order.codeNumber}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {isFirstOrder ? 'Foco Principal' : `Parada ${index + 1} de ${assignedOrders.length}`}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 ${
                            hasArrived
                              ? 'bg-amber-400 text-slate-950 font-black'
                              : isInTransit
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                              : order.status === 'picked_up'
                              ? 'bg-emerald-400 text-slate-950 font-black'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {hasArrived ? (
                            <>
                              <MapPin className="w-3 h-3" /> NO LOCAL
                            </>
                          ) : isInTransit ? (
                            <>
                              <Navigation className="w-3 h-3" /> EM ROTA
                            </>
                          ) : order.status === 'picked_up' ? (
                            <>
                              <ShoppingBag className="w-3 h-3" /> RETIRADO (NA BAG)
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" /> PRONTO NO BALCÃO
                            </>
                          )}
                        </span>
                      </div>

                      <div className="p-3.5 space-y-3">
                        {/* NOTICE BANNERS FOR STEPS */}
                        {order.status !== 'picked_up' && order.status !== 'in_transit' ? (
                          <div className="bg-amber-500/20 border-2 border-amber-400/80 p-3 rounded-xl flex items-center gap-2.5 text-xs text-amber-100 shadow-md">
                            <ShoppingBag className="w-5 h-5 text-amber-300 shrink-0" />
                            <div>
                              <span className="font-black text-amber-200 block text-xs uppercase tracking-wide">
                                PRONTO PARA RETIRADA NO BALCÃO
                              </span>
                              <span className="text-[11px] text-amber-300 font-medium leading-tight block">
                                A loja avisou que está pronto! Pegue o pacote e clique em "Confirma retirada do pedido".
                              </span>
                            </div>
                          </div>
                        ) : order.status === 'picked_up' ? (
                          <div className="bg-emerald-500/20 border-2 border-emerald-400/80 p-3 rounded-xl flex items-center gap-2.5 text-xs text-emerald-100 shadow-md">
                            <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
                            <div>
                              <span className="font-black text-emerald-200 block text-xs uppercase tracking-wide">
                                RETIRADA CONFIRMADA (NA BAG)
                              </span>
                              <span className="text-[11px] text-emerald-300 font-medium leading-tight block">
                                Quando subir na moto para iniciar o trajeto, clique em "Iniciar rota".
                              </span>
                            </div>
                          </div>
                        ) : null}
                        {/* 1º ONDE EU VOU? (ADDRESS IS THE PROTAGONIST) */}
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-amber-300/90 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-amber-400" /> {order.neighborhood.toUpperCase()}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {order.createdAt}
                            </span>
                          </div>

                          <div className="flex items-start gap-2 pt-0.5">
                            <MapPin className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-base font-black text-white leading-snug">
                                {order.address}
                              </p>
                              <span className="text-xs text-slate-400 font-medium block">
                                {order.neighborhood} • Blumenau
                              </span>
                            </div>
                          </div>

                          {/* ESTIMATED TIME & DISTANCE */}
                          {isInTransit && (
                            <div className="pt-1.5 flex items-center gap-2 border-t border-slate-900 text-[11px] font-bold">
                              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> ~{7 + (index * 3)} min
                              </span>
                              <span className="text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1">
                                <Navigation className="w-3 h-3 text-slate-400" /> {(1.5 + index * 0.8).toFixed(1)} km
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 2º CLIENT & CONTACT (SHOW WHEN IN TRANSIT) */}
                        {isInTransit && (
                          <div className="flex items-center justify-between bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-2 text-xs font-bold text-white">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{order.clientName}</span>
                            </div>

                            {order.clientPhone && (
                              <a
                                href={`tel:${order.clientPhone}`}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 text-[11px] font-semibold transition-all"
                              >
                                <Phone className="w-3 h-3 text-slate-400" /> Ligar
                              </a>
                            )}
                          </div>
                        )}

                        {/* 3º VOU COBRAR? (PAYMENT CARD - HIGHLIGHTED WHEN ARRIVED) */}
                        <div className={`p-3 rounded-xl transition-all ${
                          hasArrived
                            ? 'bg-amber-950/60 border-2 border-amber-400 text-amber-100 shadow-lg'
                            : 'bg-slate-950/90 border border-slate-800/90'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                hasArrived ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-900 border-slate-800'
                              }`}>
                                {order.paymentMethod === 'dinheiro' && <DollarSign className={`w-4 h-4 ${hasArrived ? 'text-slate-950' : 'text-amber-400'}`} />}
                                {order.paymentMethod === 'pix' && <QrCode className={`w-4 h-4 ${hasArrived ? 'text-slate-950' : 'text-emerald-400'}`} />}
                                {order.paymentMethod === 'cartao_maquininha' && <CreditCard className={`w-4 h-4 ${hasArrived ? 'text-slate-950' : 'text-slate-300'}`} />}
                              </div>
                              <div>
                                <span className={`text-[10px] font-extrabold uppercase block ${
                                  hasArrived ? 'text-amber-300' : 'text-slate-400'
                                }`}>
                                  {hasArrived ? '💰 RECEBER NO LOCAL' : 'Pagamento'}
                                </span>
                                <span className="font-bold text-xs uppercase block text-slate-100">
                                  {order.paymentMethod === 'dinheiro'
                                    ? '💵 Dinheiro'
                                    : order.paymentMethod === 'pix'
                                    ? '⚡ PIX (Pago)'
                                    : '💳 Cartão (Maquininha)'}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className={`text-[10px] font-extrabold uppercase block ${
                                hasArrived ? 'text-amber-300' : 'text-slate-400'
                              }`}>Cobrar</span>
                              <span className={`font-black text-2xl leading-none ${
                                hasArrived ? 'text-amber-300' : 'text-white'
                              }`}>
                                {formattedCurrency(order.total)}
                              </span>
                            </div>
                          </div>

                          {order.changeFor && (
                            <div className="mt-2 pt-1.5 border-t border-slate-900/80 flex items-center justify-between text-xs font-bold text-amber-300">
                              <span>⚠️ TROCO PARA:</span>
                              <span className="bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 font-mono text-amber-200">
                                {formattedCurrency(order.changeFor)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 4º NAVEGAÇÃO GPS (AZUL APENAS PARA NAVEGAÇÃO) */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenWaze(order.address)}
                            className="py-2.5 px-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                          >
                            <Navigation className="w-3.5 h-3.5 fill-current" />
                            WAZE
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenGoogleMaps(order.address)}
                            className="py-2.5 px-2 bg-blue-700 hover:bg-blue-600 active:scale-95 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            GOOGLE MAPS
                          </button>
                        </div>

                        {/* 5º PROGRESSIVE ACTION BUTTONS (PASSOS DA ENTREGA) */}
                        <div className="pt-1.5 space-y-2 border-t border-slate-800">
                          {order.status !== 'picked_up' && !isInTransit ? (
                            /* PASSO 2: CONFIRMAR RETIRADA DO PEDIDO */
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateOrderStatus(order.id, 'picked_up');
                                triggerSystemActionToast(`✅ Retirada do pedido #${order.codeNumber} confirmada! Próximo passo: Iniciar Rota.`);
                              }}
                              className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all uppercase cursor-pointer"
                            >
                              <ShoppingBag className="w-5 h-5 text-slate-950 fill-current" />
                              Confirma retirada do pedido
                            </button>
                          ) : order.status === 'picked_up' ? (
                            /* PASSO 3: INICIAR ROTA */
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateOrderStatus(order.id, 'in_transit');
                                triggerSystemActionToast(`🚀 Rota iniciada para o pedido #${order.codeNumber}! Cliente notificado.`);
                              }}
                              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/50 transition-all uppercase cursor-pointer animate-pulse"
                            >
                              <Zap className="w-5 h-5 fill-current" />
                              Iniciar rota
                            </button>
                          ) : !hasArrived ? (
                            /* STATE: EM ROTA -> BOTÃO "CHEGUEI AO LOCAL" */
                            <button
                              type="button"
                              onClick={() => {
                                setArrivedOrderIds((prev) => ({ ...prev, [order.id]: true }));
                                onSimulateArrival(order);
                                triggerSystemActionToast("📍 Status 'Cheguei ao local' atualizado! O cliente foi notificado pelo WhatsApp da Loja.");
                              }}
                              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/50 transition-all uppercase cursor-pointer"
                            >
                              <span className="text-base">📍</span>
                              CHEGUEI AO LOCAL
                            </button>
                          ) : (
                            /* STATE: CHEGOU -> CONCLUIR ENTREGA */
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateOrderStatus(order.id, 'delivered');
                                triggerSystemActionToast("✓ Entregue! Carregando próxima parada...");
                              }}
                              className="w-full py-3.5 bg-emerald-400 hover:bg-emerald-300 active:scale-98 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 transition-all uppercase cursor-pointer"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                              {assignedOrders.length > 1 && index < assignedOrders.length - 1
                                ? '✓ ENTREGUE (Carregar Próxima)'
                                : '✓ CONCLUIR ENTREGA'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* COMPLETED ORDERS TAB */
          <div className="space-y-3">
            {completedOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-xs font-bold">Nenhuma entrega concluída hoje ainda.</p>
              </div>
            ) : (
              completedOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-sm">Pedido #{ord.codeNumber}</span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        CONCLUÍDO
                      </span>
                    </div>
                    <p className="text-slate-300 font-medium">{ord.clientName} • {ord.neighborhood}</p>
                    <span className="text-[10px] text-slate-400 block">{ord.address}</span>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-emerald-400 text-base block">
                      {formattedCurrency(ord.total)}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-bold">
                      Taxa: +{formattedCurrency(activeMotoboy?.perDeliveryFee || 8.5)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 5. Footer Summary Bar & Logout CTA */}
      <div className="bg-slate-900 px-4 py-3 border-t border-slate-800 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
          <span>📍 Blumenau - SC</span>
          <span className="text-emerald-400 font-black">
            {completedOrders.length} {completedOrders.length === 1 ? 'entrega finalizada' : 'entregas finalizadas'}
          </span>
        </div>

        {isLockedToMotoboy && (
          <button
            type="button"
            onClick={handleLogoutAccount}
            className="w-full py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 active:scale-98 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Sair da Conta (Trocar Entregador)</span>
          </button>
        )}
      </div>
    </div>
  );
};
