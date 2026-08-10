import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Pause,
  Lock,
  Users,
  Power,
  FileText,
  X,
  Share2,
  Copy,
  TrendingUp,
  Award
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

function HoldToFinishShiftButton({
  onFinish,
  className = '',
}: {
  onFinish: () => void;
  className?: string;
}) {
  const [progress, setProgress] = useState(0);
  const isHoldingRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const HOLD_DURATION_MS = 1600;

  const startHolding = (e?: React.SyntheticEvent) => {
    if (!isHoldingRef.current) {
      isHoldingRef.current = true;
      startTimeRef.current = performance.now() - (progress / 100) * HOLD_DURATION_MS;

      const step = (now: number) => {
        if (!isHoldingRef.current) return;
        if (!startTimeRef.current) startTimeRef.current = now;
        const elapsed = now - startTimeRef.current;
        const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
        setProgress(pct);

        if (pct >= 100) {
          isHoldingRef.current = false;
          setProgress(100);
          if (typeof window !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate([80, 40, 80]); } catch {}
          }
          setTimeout(() => {
            onFinish();
            setProgress(0);
          }, 150);
        } else {
          animFrameRef.current = requestAnimationFrame(step);
        }
      };

      animFrameRef.current = requestAnimationFrame(step);
    }
  };

  const stopHolding = () => {
    isHoldingRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    let currentPct = progress;
    const decay = () => {
      if (isHoldingRef.current) return;
      currentPct = Math.max(0, currentPct - 10);
      setProgress(currentPct);
      if (currentPct > 0) {
        requestAnimationFrame(decay);
      }
    };
    requestAnimationFrame(decay);
  };

  const handleClick = () => {
    if (progress >= 100) return;
    const nextPct = Math.min(100, progress + 25);
    setProgress(nextPct);
    if (nextPct >= 100) {
      if (typeof window !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([80, 40, 80]); } catch {}
      }
      setTimeout(() => {
        onFinish();
        setProgress(0);
      }, 150);
    }
  };

  return (
    <div className="w-full space-y-1">
      <button
        type="button"
        onMouseDown={startHolding}
        onMouseUp={stopHolding}
        onMouseLeave={stopHolding}
        onTouchStart={startHolding}
        onTouchEnd={stopHolding}
        onTouchCancel={stopHolding}
        onClick={handleClick}
        className={`relative overflow-hidden select-none touch-none w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-950 text-white font-black text-xs rounded-2xl border-2 border-rose-500/70 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${className}`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 transition-all duration-75 ease-out pointer-events-none"
          style={{ width: `${progress}%` }}
        />

        <div className="relative z-10 flex items-center justify-center gap-2 uppercase tracking-wide">
          <Power className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
          {progress > 0 ? (
            <span className="font-mono font-black text-white">
              ENCERRANDO EXPEDIENTE... {Math.round(progress)}%
            </span>
          ) : (
            <>
              <span>Encerrar expediente</span>
              <span className="text-[10px] text-rose-300 font-extrabold bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-800">
                Segure p/ carregar 100%
              </span>
            </>
          )}
        </div>
      </button>
      <p className="text-[10px] text-slate-400 font-medium text-center">
        💡 Mantenha pressionado ou clique repetidamente para carregar 100% e ver o relatório do dia.
      </p>
    </div>
  );
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
  const [activeMotoboyId, setActiveMotoboyId] = useState<string>(() => {
    if (initialMotoboyId) return initialMotoboyId;
    try {
      const saved = localStorage.getItem('rota_facil_active_motoboy_id');
      if (saved) return saved;
    } catch {
      // ignore
    }
    return '';
  });

  useEffect(() => {
    if (initialMotoboyId) {
      setActiveMotoboyId(initialMotoboyId);
      try {
        localStorage.setItem('rota_facil_active_motoboy_id', initialMotoboyId);
      } catch {
        // ignore
      }
    }
  }, [initialMotoboyId]);

  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'map'>('active');
  const [deviceGps, setDeviceGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string>('Localização ativa');
  const [showDevGpsPanel, setShowDevGpsPanel] = useState<boolean>(false);
  const [isEarningsModalOpen, setIsEarningsModalOpen] = useState<boolean>(false);
  const [isDailyReportModalOpen, setIsDailyReportModalOpen] = useState<boolean>(false);
  const [availableSince, setAvailableSince] = useState<number>(Date.now());
  const [shiftStartedAt, setShiftStartedAt] = useState<number>(Date.now() - 4.5 * 3600 * 1000);
  const [shiftEndedAt, setShiftEndedAt] = useState<string | null>(null);

  const handleFinishShift = () => {
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setShiftEndedAt(timeStr);
    if (onUpdateMotoboyStatus && activeMotoboy) {
      onUpdateMotoboyStatus(activeMotoboy.id, 'offline');
    }
    setIsDailyReportModalOpen(true);
    triggerSystemActionToast(`🏁 Expediente encerrado às ${timeStr}! Confira seu relatório.`);
  };

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
    }, 2500);
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

  const activeMotoboy = useMemo(() => {
    if (!motoboys || motoboys.length === 0) return undefined;
    const targetId = (activeMotoboyId || initialMotoboyId || '').trim().toLowerCase();
    if (targetId) {
      const found = motoboys.find(
        (m) =>
          m.id.toLowerCase() === targetId ||
          (m.username && m.username.toLowerCase() === targetId) ||
          m.name.toLowerCase() === targetId ||
          m.name.toLowerCase().includes(targetId)
      );
      if (found) return found;
    }
    // If locked to a motoboy or initial ID given, don't fallback to motoboys[0] if loading
    return isLockedToMotoboy ? undefined : motoboys[0];
  }, [motoboys, activeMotoboyId, initialMotoboyId, isLockedToMotoboy]);

  // Track counter call signal from store
  const isBeingCalledToCounter = Boolean(
    activeMotoboy?.callingToCounterAt &&
    Date.now() - activeMotoboy.callingToCounterAt < 60000
  );

  useEffect(() => {
    if (isBeingCalledToCounter) {
      playNewOrderAlert();
      if (typeof window !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([100, 50, 100, 50, 200]); } catch {}
      }
    }
  }, [isBeingCalledToCounter]);

  // Sync availableSince with activeMotoboy joinedQueueAt timestamp
  useEffect(() => {
    if (activeMotoboy?.joinedQueueAt) {
      setAvailableSince(activeMotoboy.joinedQueueAt);
    }
  }, [activeMotoboy?.joinedQueueAt]);

  useEffect(() => {
    // Strictly guard GPS update: Only update cloud if activeMotoboy matches the actual device session
    if (deviceGps && activeMotoboy) {
      const targetId = (activeMotoboyId || initialMotoboyId || '').trim().toLowerCase();
      const isExactMatch =
        targetId &&
        (activeMotoboy.id.toLowerCase() === targetId ||
          (activeMotoboy.username && activeMotoboy.username.toLowerCase() === targetId));

      if (isExactMatch) {
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
    }
  }, [deviceGps, activeMotoboy, activeMotoboyId, initialMotoboyId]);

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

  const arranqueAmount = activeMotoboy?.fixedFee || 0;
  const deliveryFeesTotal = completedOrders.reduce(
    (acc, o) => acc + (o.deliveryFee && o.deliveryFee > 0 ? o.deliveryFee : (activeMotoboy?.perDeliveryFee || 7.00)),
    0
  );
  const calculatedTotalEarnings = arranqueAmount + deliveryFeesTotal;
  const totalEarnedDisplay = Math.max(activeMotoboy?.totalEarnedToday || 0, calculatedTotalEarnings);

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

    // Voice announcement (Speech Synthesis) for hands-free audio alert
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance('Novo pedido atribuído! Verifique a sua bolsa.');
        utterance.lang = 'pt-BR';
        utterance.rate = 1.0;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
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
          gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + startTime + 0.02);
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
        const notif = new Notification('🛵 Rota Fácil Delivery', {
          body: bodyMsg,
          tag: 'new-order-alert',
          requireInteraction: true,
          icon: '/favicon.ico',
        });
        notif.onclick = () => {
          window.focus();
        };
      } catch (err) {
        console.warn('Error firing system notification:', err);
      }
    }
  };

  const prevAssignedIdsRef = useRef<string[]>([]);
  const prevQueuePosRef = useRef<number | null>(null);
  const isInitialMount = useRef(true);

  // Monitor queue position advances and notify motoboy when someone ahead leaves
  useEffect(() => {
    if (!activeMotoboy || activeMotoboy.status !== 'available') {
      prevQueuePosRef.current = null;
      return;
    }

    const availableDrivers = [...motoboys]
      .filter((m) => m.status === 'available')
      .sort((a, b) => (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0));

    const driverIndex = availableDrivers.findIndex((m) => m.id === activeMotoboy.id);
    const currentQueuePos = driverIndex >= 0 ? driverIndex + 1 : null;

    if (currentQueuePos !== null) {
      if (prevQueuePosRef.current !== null && currentQueuePos < prevQueuePosRef.current) {
        // Motoboy moved up in the queue (e.g., 3 -> 2 or 2 -> 1)
        const toastMsg =
          currentQueuePos === 1
            ? '🚀 Você agora é o 1º DA FILA de entregas!'
            : `🚀 Você subiu na fila! Agora você é o ${currentQueuePos}º da fila!`;

        triggerSystemActionToast(toastMsg);

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([150, 100, 150]);
          } catch {
            // ignore
          }
        }

        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
            const voiceText =
              currentQueuePos === 1
                ? 'Você subiu na fila. Agora você é o primeiro da fila!'
                : `Você subiu na fila. Agora você é o ${currentQueuePos}º da fila.`;
            const utterance = new SpeechSynthesisUtterance(voiceText);
            utterance.lang = 'pt-BR';
            utterance.rate = 1.0;
            utterance.volume = 1.0;
            window.speechSynthesis.speak(utterance);
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
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
          }
        } catch {
          // ignore
        }

        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          try {
            const notif = new Notification('🛵 Atualização da Fila', {
              body: toastMsg,
              tag: 'queue-position-update',
              requireInteraction: true,
              icon: '/favicon.ico',
            });
            notif.onclick = () => {
              window.focus();
            };
          } catch (err) {
            console.warn('Queue notification error:', err);
          }
        }
      }
      prevQueuePosRef.current = currentQueuePos;
    }
  }, [motoboys, activeMotoboy?.id, activeMotoboy?.status]);

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
        <div className="absolute top-2 left-3 right-3 z-50 bg-slate-950/95 border border-emerald-500/50 text-white p-2 px-3 shadow-xl flex items-center gap-2 animate-fadeIn backdrop-blur-md rounded-2xl">
          <div className="w-5 h-5 rounded-md bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 font-black text-xs">
            ✓
          </div>
          <div className="text-xs font-bold text-slate-100 leading-snug truncate">
            {actionToast}
          </div>
        </div>
      )}

      {/* 1. Header Bar - Clean Motoboy Profile & Action Bar */}
      <div className="bg-slate-900 px-4 py-3 text-white flex items-center justify-between gap-3 shadow-xs border-b border-slate-800">
        {/* Left: Driver Avatar + Name + Online Badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-base shrink-0 shadow-xs border border-amber-300">
            {activeMotoboy?.name ? activeMotoboy.name.charAt(0).toUpperCase() : '👤'}
          </div>

          <div className="min-w-0">
            <h3 className="font-extrabold text-sm sm:text-base text-white leading-tight truncate">
              {activeMotoboy?.name || 'Entregador'}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                activeMotoboy?.status === 'offline'
                  ? 'bg-rose-400'
                  : activeMotoboy?.status === 'busy'
                  ? 'bg-amber-400'
                  : 'bg-emerald-400 animate-pulse'
              }`}></span>
              <span className={`text-[11px] font-bold ${
                activeMotoboy?.status === 'offline'
                  ? 'text-rose-300'
                  : activeMotoboy?.status === 'busy'
                  ? 'text-amber-300'
                  : 'text-emerald-300'
              }`}>
                {activeMotoboy?.status === 'offline'
                  ? 'Offline'
                  : activeMotoboy?.status === 'busy'
                  ? 'Pausado'
                  : 'Online na Fila'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Action Icons: Report, Sound Test, Dev GPS, Logout/Switch */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Relatório do Dia Quick Access */}
          <button
            type="button"
            onClick={() => setIsDailyReportModalOpen(true)}
            title="Abrir Relatório do Dia"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-all flex items-center gap-1 text-xs font-black cursor-pointer"
          >
            <FileText className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">Relatório</span>
          </button>
          {/* Sound / Notification Test Button */}
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
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline text-slate-200">Testar Som</span>
          </button>

          {/* Dev GPS Toggle (Discrete Tool) */}
          <button
            type="button"
            onClick={() => setShowDevGpsPanel(!showDevGpsPanel)}
            title="Painel de Testes GPS"
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              showDevGpsPanel
                ? 'bg-amber-400 text-slate-950 font-black'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
            }`}
          >
            <Zap className="w-4 h-4" />
          </button>

          {/* Profile Switcher or Logout Button */}
          {isLockedToMotoboy ? (
            <button
              type="button"
              onClick={handleLogoutAccount}
              title="Sair da Conta de Entregador"
              className="p-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-300" />
            </button>
          ) : (
            <select
              value={activeMotoboyId}
              onChange={(e) => setActiveMotoboyId(e.target.value)}
              title="Alternar Perfil de Entregador"
              className="bg-slate-800 text-slate-200 font-bold text-xs py-1.5 px-2 rounded-xl border border-slate-700 focus:outline-none max-w-[100px] truncate cursor-pointer"
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

      {/* 🔔 URGENT STORE COUNTER CALL BANNER (Substitui painel de senhas) */}
      {isBeingCalledToCounter && (
        <div className="bg-amber-400 text-slate-950 p-4 px-5 border-b-4 border-amber-600 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-bounce">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center font-black text-2xl shrink-0 shadow-lg border border-slate-800">
              🛎️
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-950 uppercase tracking-tight leading-tight">
                Chamado no Balcão da Loja!
              </h3>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                Dirija-se ao balcão agora para retirar o pedido e sair para entrega.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (activeMotoboy && onUpdateMotoboyStatus) {
                saveMotoboyToCloud({ ...activeMotoboy, callingToCounterAt: undefined });
              }
              triggerSystemActionToast("🟢 Confirmação enviada! Você está no balcão da loja.");
            }}
            className="w-full sm:w-auto py-3 px-5 bg-slate-950 hover:bg-slate-900 active:scale-95 text-amber-300 font-black text-xs sm:text-sm rounded-2xl shadow-xl transition-all cursor-pointer uppercase tracking-wider border border-slate-800 shrink-0"
          >
            <span>🟢 Confirmar Presença no Balcão</span>
          </button>
        </div>
      )}

      {/* BACKGROUND NOTIFICATION PERMISSION BANNER (If not granted) */}
      {notificationPermission !== 'granted' && (
        <div className="bg-amber-500 text-slate-950 px-3.5 py-2 text-xs font-bold flex items-center justify-between gap-2 shadow-xs border-b border-amber-600">
          <div className="flex items-center gap-2 min-w-0">
            <BellRing className="w-4 h-4 shrink-0 animate-bounce text-slate-950" />
            <span className="truncate">Ative alertas p/ ouvir novos pedidos em 2º plano!</span>
          </div>
          <button
            type="button"
            onClick={requestNotificationPermission}
            className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 text-amber-300 font-black rounded-lg text-[10px] uppercase transition-all cursor-pointer shrink-0"
          >
            Ativar
          </button>
        </div>
      )}

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

      {/* 2. Three Clean, Intuitive Metric Cards */}
      <div className="bg-slate-100 px-3.5 py-2.5 border-b border-slate-200">
        <div className="grid grid-cols-3 gap-2">
          {/* Card 1: Pedidos */}
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs text-center flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight block">
              🎒 Pedidos
            </span>
            <div className="font-black text-xl text-slate-900 leading-tight my-0.5">
              {assignedOrders.length}
            </div>
            <span className="text-[10px] font-bold text-slate-400 block truncate">
              {assignedOrders.length === 1 ? '1 na bolsa' : 'na bolsa'}
            </span>
          </div>

          {/* Card 2: Entregas */}
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs text-center flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight block">
              📦 Entregas
            </span>
            <div className="font-black text-xl text-emerald-600 leading-tight my-0.5">
              {completedOrders.length}
            </div>
            <span className="text-[10px] font-bold text-slate-400 block truncate">
              hoje
            </span>
          </div>

          {/* Card 3: Ganhos hoje (Clickable -> opens extrato modal) */}
          <button
            type="button"
            onClick={() => setIsEarningsModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 active:scale-98 p-2.5 rounded-2xl text-center flex flex-col justify-between transition-all cursor-pointer shadow-xs border border-slate-800 group"
          >
            <span className="text-[10px] font-extrabold text-amber-300 uppercase tracking-tight flex items-center justify-center gap-0.5 truncate">
              💰 Ganhos hoje <ChevronRight className="w-3 h-3 text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </span>
            <div className="font-black text-sm sm:text-base text-emerald-400 leading-tight my-0.5 truncate">
              {formattedCurrency(totalEarnedDisplay)}
            </div>
            <div className="text-[9px] font-bold text-slate-300 block truncate">
              Arranque R$ {arranqueAmount.toFixed(0)} • Taxas R$ {deliveryFeesTotal.toFixed(0)}
            </div>
          </button>
        </div>

        {/* PROGRESS BAR FOR ACTIVE ROUTE */}
        {assignedOrders.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-slate-200/80">
            <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-600 mb-1">
              <span className="flex items-center gap-1 text-slate-900">
                <Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> ROTA ATIVA:
              </span>
              <span className="text-emerald-700 font-bold">
                {assignedOrders.filter((o) => o.status === 'in_transit').length > 0
                  ? 'Em deslocamento'
                  : 'Retirando pedidos'}{' '}
                • {assignedOrders.length} {assignedOrders.length === 1 ? 'parada restante' : 'paradas restantes'}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${
                    assignedOrders.some((o) => o.status === 'in_transit')
                      ? 70
                      : assignedOrders.some((o) => o.status === 'picked_up')
                      ? 40
                      : 15
                  }%`
                }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Navigation Tabs with High Contrast */}
      <div className="bg-slate-100 px-2 py-2 border-b border-slate-200 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-2 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-slate-950 text-white shadow-md border border-slate-800'
              : 'bg-white text-slate-800 hover:text-slate-950 border border-slate-300/90 shadow-2xs hover:bg-slate-50'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 ${activeTab === 'active' ? 'text-amber-400' : 'text-slate-600'}`} />
          Minha Bolsa
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'active' ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 text-slate-800 border border-slate-200'
          }`}>
            {assignedOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-2 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'map'
              ? 'bg-slate-950 text-white shadow-md border border-slate-800'
              : 'bg-white text-slate-800 hover:text-slate-950 border border-slate-300/90 shadow-2xs hover:bg-slate-50'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 text-emerald-500" />
          Mapa
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-2 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'completed'
              ? 'bg-slate-950 text-white shadow-md border border-slate-800'
              : 'bg-white text-slate-800 hover:text-slate-950 border border-slate-300/90 shadow-2xs hover:bg-slate-50'
          }`}
        >
          <CheckCircle2 className={`w-3.5 h-3.5 ${activeTab === 'completed' ? 'text-emerald-400' : 'text-slate-600'}`} />
          Concluídas
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'completed' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 text-slate-800 border border-slate-200'
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
              ) : (
                /* BATCH CONFIRM ALL PICKED UP & START ROUTE BUTTON */
                <button
                  type="button"
                  onClick={() => {
                    const firstOrder = assignedOrders[0];
                    if (firstOrder) {
                      onUpdateOrderStatus(firstOrder.id, 'in_transit');
                    }
                    assignedOrders.slice(1).forEach((o) => {
                      if (o.status !== 'in_transit' && o.status !== 'delivered' && o.status !== 'cancelled') {
                        onUpdateOrderStatus(o.id, 'picked_up');
                      }
                    });
                    if (onUpdateMotoboyStatus && activeMotoboy) {
                      onUpdateMotoboyStatus(activeMotoboy.id, 'delivering');
                    }
                    triggerSystemActionToast(
                      `🚀 Rota iniciada! Siga para a 1ª parada: #${firstOrder?.codeNumber} (${firstOrder?.neighborhood || 'Centro'})`
                    );
                  }}
                  className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 uppercase transition-all cursor-pointer animate-pulse border border-emerald-300"
                >
                  <ShoppingBag className="w-5 h-5 fill-current text-slate-950 shrink-0" />
                  <span>
                    ✓ Peguei todos os pedidos - Iniciar Rota ({assignedOrders.length} {assignedOrders.length === 1 ? 'Entrega' : 'Entregas'})
                  </span>
                </button>
              )
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
                        const availableDrivers = [...motoboys]
                          .filter((m) => m.status === 'available')
                          .sort((a, b) => (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0));
                        const driverIndex = availableDrivers.findIndex((m) => m.id === activeMotoboy?.id);
                        const queuePos = driverIndex >= 0 ? driverIndex + 1 : availableDrivers.length + 1;
                        const effectiveTimestamp = activeMotoboy?.joinedQueueAt || availableSince;
                        const minutesInQueue = Math.max(0, Math.floor((Date.now() - effectiveTimestamp) / 60000));
                        const formattedQueueTime = String(minutesInQueue).padStart(2, '0');

                        if (activeMotoboy?.status === 'offline') {
                          return (
                            <div className="space-y-4 py-3 text-center">
                              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs">
                                <Clock className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                                <span>Expediente encerrado{shiftEndedAt ? ` às ${shiftEndedAt}` : ''}</span>
                              </div>
                              <div>
                                <h4 className="text-xl font-black text-slate-900">Seu turno está fechado</h4>
                                <p className="text-xs text-slate-500 mt-1 font-medium">
                                  Inicie o expediente para entrar na fila e começar a receber entregas.
                                </p>
                              </div>
                              {onUpdateMotoboyStatus && activeMotoboy && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateMotoboyStatus(activeMotoboy.id, 'available');
                                    setAvailableSince(Date.now());
                                    setShiftStartedAt(Date.now());
                                    setShiftEndedAt(null);
                                    triggerSystemActionToast("🟢 Expediente iniciado! Você entrou na fila da loja.");
                                  }}
                                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wide border border-emerald-400"
                                >
                                  <span>🟢 Iniciar expediente</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setIsDailyReportModalOpen(true)}
                                className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-xs rounded-2xl border border-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                              >
                                <FileText className="w-4 h-4 text-slate-700" />
                                <span>📄 Ver Relatório do Dia</span>
                              </button>
                            </div>
                          );
                        }

                        if (activeMotoboy?.status === 'busy') {
                          return (
                            <div className="space-y-4 py-2 text-center">
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

                              <div className="pt-2 border-t border-slate-200/80">
                                <HoldToFinishShiftButton onFinish={handleFinishShift} />
                              </div>
                            </div>
                          );
                        }

                        const estCallTimeMin = Math.max(2, queuePos * 2);

                        return (
                          <div className="space-y-4 py-1 text-center">
                            {/* DISPONÍVEL NA LOJA BADGE */}
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                              <span className="uppercase tracking-wider">Disponível na loja</span>
                            </div>

                            {/* MAIN QUEUE POSITION HERO */}
                            <div className="bg-slate-50 border border-slate-200/90 p-4 rounded-2xl space-y-1 text-center shadow-2xs">
                              <strong className="text-4xl sm:text-5xl font-black text-slate-950 block tracking-tight">
                                {queuePos}º da fila
                              </strong>
                              <span className="text-emerald-700 font-extrabold text-sm block">
                                {queuePos === 1
                                  ? 'Próximo a receber um pedido'
                                  : `${queuePos - 1} ${queuePos - 1 === 1 ? 'motoboy antes de você' : 'motoboys antes de você'}`}
                              </span>
                            </div>

                            {/* AGUARDANDO E AVISO + ESTIMATIVA */}
                            <div className="bg-white border border-slate-200/80 p-3 rounded-2xl space-y-1.5 text-xs text-slate-600 font-medium">
                              <div className="flex items-center justify-between text-slate-700 font-bold border-b border-slate-100 pb-1.5">
                                <span>⚡ Tempo estimado até chamada:</span>
                                <span className="text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  ~{estCallTimeMin} min
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500 font-semibold pt-0.5">
                                <span>⏱️ Tempo decorrido na fila:</span>
                                <strong className="text-slate-800">{formattedQueueTime} min</strong>
                              </div>
                            </div>

                            {/* HIGH-CONTRAST CLEAR PAUSE BUTTON & SHIFT FINISH */}
                            {onUpdateMotoboyStatus && activeMotoboy && (
                              <div className="pt-1 space-y-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateMotoboyStatus(activeMotoboy.id, 'busy');
                                    triggerSystemActionToast("⏸️ Disponibilidade pausada.");
                                  }}
                                  className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-98 text-slate-900 font-black text-xs rounded-2xl border-2 border-slate-300 hover:border-slate-400 shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <Pause className="w-4 h-4 text-slate-700 shrink-0" />
                                  <span>Pausar disponibilidade</span>
                                </button>

                                <HoldToFinishShiftButton onFinish={handleFinishShift} />
                              </div>
                            )}

                            {/* LIVE FILA DA LOJA LIST */}
                            <div className="mt-5 pt-4 border-t border-slate-200/90 text-left">
                              <div className="flex items-center justify-between mb-2 px-1">
                                <h6 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                  <Users className="w-4 h-4 text-amber-500" /> Fila da Loja ({availableDrivers.length})
                                </h6>
                                <span className="text-[10px] font-bold text-slate-400">Ordem em tempo real</span>
                              </div>

                              <div className="space-y-1.5">
                                {availableDrivers.length === 0 ? (
                                  <p className="text-xs text-slate-400 text-center py-2">Nenhum motoboy na fila</p>
                                ) : (
                                  availableDrivers.map((driver, idx) => {
                                    const isMe = driver.id === activeMotoboy?.id;
                                    const driverInQueueMin = driver.joinedQueueAt
                                      ? Math.max(0, Math.floor((Date.now() - driver.joinedQueueAt) / 60000))
                                      : 0;

                                    return (
                                      <div
                                        key={driver.id}
                                        className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-extrabold border transition-all ${
                                          isMe
                                            ? 'bg-amber-400/20 border-amber-400/70 text-slate-950 shadow-2xs'
                                            : 'bg-slate-50 border-slate-200/80 text-slate-700'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                                            isMe ? 'bg-amber-400 text-slate-950 border border-amber-500' : 'bg-slate-200 text-slate-700'
                                          }`}>
                                            {idx + 1}º
                                          </span>
                                          <span className="truncate">
                                            {driver.name} {isMe && <span className="text-amber-800 font-black ml-1">(Você)</span>}
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-semibold shrink-0">
                                          {driverInQueueMin} min na fila
                                        </span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
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
                                className="ml-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 font-extrabold text-[10px] rounded-lg transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                                title="Priorizar esta entrega na rota"
                              >
                                ▲ Priorizar
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
                        {/* 1. ENDEREÇO DA ENTREGA (DOMINANTE) */}
                        <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-1.5 text-white shadow-xs">
                          <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                            <span>PRÓXIMA ENTREGA · #{order.codeNumber}</span>
                            <span className="text-emerald-400 font-bold bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                              📍 {order.neighborhood || 'Centro'}
                            </span>
                          </div>

                          <p className="text-lg font-black text-white leading-snug tracking-tight">
                            {streetLine}
                          </p>

                          <div className="flex items-center gap-2 pt-1 text-xs font-bold text-slate-300">
                            <span className="bg-slate-800/90 text-amber-300 px-2.5 py-1 rounded-lg border border-slate-700">
                              ⏱️ ~{order.estimatedMinutes || 7} min
                            </span>
                            <span className="bg-slate-800/90 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
                              🗺️ ~{order.distanceKm || 3.2} km
                            </span>
                          </div>
                        </div>

                        {/* ARRIVAL ALERT BANNER */}
                        {hasArrived && (
                          <div className="bg-amber-400 text-slate-950 p-2.5 rounded-xl font-extrabold text-xs border border-amber-300 flex items-center justify-between gap-2 shadow-xs animate-pulse">
                            <span className="flex items-center gap-1.5 font-black text-sm">
                              📍 Você está chegando!
                            </span>
                            <span className="text-[10px] font-bold bg-slate-900 text-amber-300 px-2 py-0.5 rounded-md">
                              Cliente {order.clientName} avisado
                            </span>
                          </div>
                        )}

                        {/* 2. PAGAMENTO (COMPACTO QUANDO PAGO, GIGANTE QUANDO COBRAR) */}
                        {order.paymentMethod === 'pix' || order.originChannel === 'ifood' || order.originChannel === 'cardapio_web' ? (
                          <div className="bg-emerald-950/80 border border-emerald-500/40 px-3 py-2 rounded-xl flex items-center justify-between text-emerald-200 text-xs font-bold shadow-2xs">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>✓ Já pago • {order.paymentMethod === 'pix' ? 'PIX' : order.originChannel === 'ifood' ? 'iFood' : 'ONLINE'}</span>
                            </div>
                            <span className="font-extrabold text-emerald-300 text-sm">{formattedCurrency(order.total)}</span>
                          </div>
                        ) : (
                          <div className="bg-amber-950 border-2 border-amber-500 p-3 rounded-xl text-white flex items-center justify-between shadow-md">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-black">
                                {order.paymentMethod === 'dinheiro' ? <DollarSign className="w-5 h-5 stroke-[2.5]" /> : <CreditCard className="w-5 h-5 stroke-[2.5]" />}
                              </div>
                              <div>
                                <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider block">
                                  🚨 COBRAR NO LOCAL
                                </span>
                                <span className="font-black text-xs text-amber-100 uppercase block">
                                  {order.paymentMethod === 'dinheiro' ? '💵 DINHEIRO' : '💳 CARTÃO (MAQUININHA)'}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] font-extrabold text-amber-200 uppercase block">Cobrar</span>
                              <span className="font-black text-2xl text-amber-300 leading-none block">{formattedCurrency(order.total)}</span>
                            </div>
                          </div>
                        )}

                        {/* Troco Info */}
                        {order.changeFor && order.paymentMethod === 'dinheiro' && (
                          <div className="bg-amber-50 border border-amber-300 p-2 rounded-lg flex items-center justify-between text-xs font-bold text-amber-900">
                            <span>⚠️ LEVAR TROCO PARA:</span>
                            <span className="font-extrabold bg-amber-200 px-2 py-0.5 rounded border border-amber-400">
                              {formattedCurrency(order.changeFor)}
                            </span>
                          </div>
                        )}

                        {/* CLIENTE & CONTATO (LIGAR + WHATSAPP) */}
                        {(isInTransit || isPickedUp) && (
                          <div className="flex items-center justify-between bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              <span className="truncate max-w-[120px] sm:max-w-[160px]">{order.clientName}</span>
                            </div>

                            {order.clientPhone && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <a
                                  href={`tel:${order.clientPhone.replace(/\D/g, '')}`}
                                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 flex items-center gap-1 text-[11px] font-extrabold transition-all shadow-2xs"
                                >
                                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Ligar</span>
                                </a>
                                <a
                                  href={`https://wa.me/55${order.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                    `Olá ${order.clientName}, sou o entregador da Hope Burger com seu pedido #${order.codeNumber}. Estou na sua rua/portão!`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 text-[11px] font-extrabold transition-all shadow-2xs"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 fill-current" />
                                  <span>WhatsApp</span>
                                </a>
                              </div>
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

                          {/* ACTION BUTTONS (STRICTLY LOCKED FOR NON-FIRST STOPS) */}
                          {!isFirstOrder ? (
                            <div className="bg-slate-900 border-2 border-amber-500/60 p-3.5 rounded-2xl space-y-2 text-white shadow-md">
                              <div className="flex items-center gap-2 font-black text-amber-300 text-xs uppercase tracking-wide">
                                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>🔒 PARADA #{index + 1} BLOQUEADA (AGUARDANDO A 1ª PARADA)</span>
                              </div>
                              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                                Você deve entregar o <strong>Pedido #{assignedOrders[0]?.codeNumber} (1ª Parada)</strong> primeiro. Assim que concluir a entrega anterior, esta rota será liberada automaticamente.
                              </p>
                              {onReorderMotoboyRoute && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const reordered = [...assignedOrders];
                                    const [moved] = reordered.splice(index, 1);
                                    reordered.unshift(moved);
                                    onReorderMotoboyRoute(reordered.map((o) => o.id));
                                    setManualExpandedId(null);
                                    triggerSystemActionToast(`▲ Pedido #${order.codeNumber} priorizado para a 1ª parada!`);
                                  }}
                                  className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all uppercase cursor-pointer mt-1"
                                >
                                  <span>▲ PRIORIZAR ESTA ENTREGA (ENTREGAR EM 1º LUGAR)</span>
                                </button>
                              )}
                            </div>
                          ) : isPendingInKitchen ? (
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
                                const firstOrder = assignedOrders[0];
                                if (firstOrder) {
                                  onUpdateOrderStatus(firstOrder.id, 'in_transit');
                                }
                                assignedOrders.slice(1).forEach((o) => {
                                  if (o.status !== 'in_transit' && o.status !== 'delivered' && o.status !== 'cancelled') {
                                    if (o.status !== 'picked_up') {
                                      onUpdateOrderStatus(o.id, 'picked_up');
                                    }
                                  }
                                });
                                if (onUpdateMotoboyStatus && activeMotoboy) {
                                  onUpdateMotoboyStatus(activeMotoboy.id, 'delivering');
                                }
                                triggerSystemActionToast(`🚀 Rota iniciada! 1ª parada: #${firstOrder?.codeNumber} (${firstOrder?.neighborhood || 'Centro'})`);
                              }}
                              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all uppercase cursor-pointer"
                            >
                              <Zap className="w-5 h-5 fill-current" />
                              <span>Iniciar Rota ({assignedOrders.length} {assignedOrders.length === 1 ? 'parada' : 'paradas'})</span>
                            </button>
                          ) : isInTransit ? (
                            <div className="space-y-2.5 pt-1">
                              {/* MODO ROTA: NAVEGAÇÃO DESTACADA */}
                              <button
                                type="button"
                                onClick={() => handleOpenWaze(order.address, order.lat, order.lng)}
                                className="w-full py-4 bg-sky-600 hover:bg-sky-500 active:scale-98 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer uppercase tracking-wide border border-sky-400/40"
                              >
                                <Navigation className="w-5 h-5 fill-current text-white animate-bounce" />
                                <span>🧭 ABRIR NAVEGAÇÃO (WAZE)</span>
                              </button>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenGoogleMaps(order.address, order.lat, order.lng)}
                                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                                >
                                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                                  <span>Google Maps</span>
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
                                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all uppercase cursor-pointer border border-slate-800"
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
                                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all uppercase cursor-pointer border border-emerald-400/50"
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
                    Saldo Total Hoje
                  </span>
                  <strong className="text-xl font-black text-emerald-400 block mt-0.5">
                    {formattedCurrency(totalEarnedDisplay)}
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

              {/* Saldo & Arranque Breakdown */}
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900 border-b border-emerald-200/80 pb-1.5">
                  <span>🚀 Arranque Fixo (Diária):</span>
                  <span className="font-black text-emerald-950">{formattedCurrency(arranqueAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900 border-b border-emerald-200/80 pb-1.5">
                  <span>📦 Taxas ({completedOrders.length} {completedOrders.length === 1 ? 'entrega' : 'entregas'}):</span>
                  <span className="font-black text-emerald-950">{formattedCurrency(deliveryFeesTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-black text-emerald-950 pt-0.5">
                  <span>💰 Saldo Total do Motoboy:</span>
                  <span className="text-emerald-700 text-lg font-black">{formattedCurrency(totalEarnedDisplay)}</span>
                </div>
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

      {/* FULL RELATÓRIO DO DIA / FECHAMENTO DE EXPEDIENTE MODAL */}
      {isDailyReportModalOpen && (() => {
        const shiftElapsedHours = Math.max(0.5, (Date.now() - shiftStartedAt) / (1000 * 3600));
        const shiftHoursInt = Math.floor(shiftElapsedHours);
        const shiftMinsInt = Math.round((shiftElapsedHours % 1) * 60);
        const formattedTimeInShift = `${shiftHoursInt}h ${shiftMinsInt}m`;
        const deliveriesPerHourVal = (completedOrders.length / shiftElapsedHours).toFixed(1);
        const earningsPerHourVal = (totalEarnedDisplay / shiftElapsedHours).toFixed(2);
        const highestFeeVal = completedOrders.length > 0
          ? Math.max(...completedOrders.map((o) => o.deliveryFee || activeMotoboy?.perDeliveryFee || 8.0))
          : (activeMotoboy?.perDeliveryFee || 8.0);

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-3xl max-w-sm sm:max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 relative my-auto animate-scaleUp text-slate-900 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center font-black text-lg border border-slate-800 shadow-xs">
                    📑
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-black text-base text-slate-950">Relatório do Dia</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        activeMotoboy?.status === 'offline' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        {activeMotoboy?.status === 'offline' ? `🔴 Encerrado${shiftEndedAt ? ` ${shiftEndedAt}` : ''}` : '🟢 Turno Ativo'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">
                      {activeMotoboy?.name || 'Entregador'} • {new Date().toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDailyReportModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Financial Highlights */}
              <div className="bg-slate-950 text-white p-4 rounded-2xl space-y-3 border border-slate-800 shadow-md">
                <div className="text-center border-b border-slate-800 pb-3">
                  <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider block">
                    💰 Saldo Total A Receber Hoje
                  </span>
                  <strong className="text-3xl sm:text-4xl font-black text-emerald-400 block mt-1">
                    {formattedCurrency(totalEarnedDisplay)}
                  </strong>
                  <span className="text-[10px] text-slate-400 font-medium block mt-1">
                    Arranque diário fixo + Taxas de entrega acumuladas
                  </span>
                </div>

                {/* Breakdown Row */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] font-extrabold uppercase block">🚀 Arranque Fixo</span>
                    <strong className="text-white text-sm font-black block mt-0.5">
                      {formattedCurrency(arranqueAmount)}
                    </strong>
                  </div>
                  <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 text-[10px] font-extrabold uppercase block">📦 Total em Taxas</span>
                    <strong className="text-emerald-400 text-sm font-black block mt-0.5">
                      {formattedCurrency(deliveryFeesTotal)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Performance / Gamification Metrics Grid */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-500" /> Desempenho do Turno
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">Métricas pessoais</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-amber-50/80 border border-amber-200/80 p-2.5 rounded-2xl flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
                      ⏱️
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase block truncate">Tempo Expediente</span>
                      <strong className="text-sm font-black text-slate-950 block leading-none">{formattedTimeInShift}</strong>
                    </div>
                  </div>

                  <div className="bg-emerald-50/80 border border-emerald-200/80 p-2.5 rounded-2xl flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                      🚀
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase block truncate">Entregas / Hora</span>
                      <strong className="text-sm font-black text-slate-950 block leading-none">{deliveriesPerHourVal} /h</strong>
                    </div>
                  </div>

                  <div className="bg-blue-50/80 border border-blue-200/80 p-2.5 rounded-2xl flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold shrink-0">
                      💸
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase block truncate">Ganho / Hora</span>
                      <strong className="text-sm font-black text-slate-950 block leading-none">{formattedCurrency(Number(earningsPerHourVal))} /h</strong>
                    </div>
                  </div>

                  <div className="bg-purple-50/80 border border-purple-200/80 p-2.5 rounded-2xl flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold shrink-0">
                      🏆
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase block truncate">Maior Taxa Única</span>
                      <strong className="text-sm font-black text-slate-950 block leading-none">{formattedCurrency(highestFeeVal)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operational Stats Grid */}
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-slate-50 border border-slate-200 p-2 rounded-2xl">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Entregas</span>
                  <strong className="text-base font-black text-slate-950 block">{completedOrders.length}</strong>
                  <span className="text-[9px] text-slate-400 font-bold block">finalizadas</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-2 rounded-2xl">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Km Estimado</span>
                  <strong className="text-base font-black text-slate-950 block">~{(completedOrders.length * 6.1).toFixed(1)}</strong>
                  <span className="text-[9px] text-slate-400 font-bold block">km rodados</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-2 rounded-2xl">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Tempo Rota</span>
                  <strong className="text-base font-black text-slate-950 block">~{completedOrders.length * 17}</strong>
                  <span className="text-[9px] text-slate-400 font-bold block">minutos</span>
                </div>
              </div>

              {/* Itemized Order List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    📦 Lista de Entregas ({completedOrders.length})
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400">Detalhamento por bairro</span>
                </div>

                {completedOrders.length === 0 ? (
                  <div className="p-4 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs font-semibold">
                    Nenhuma entrega realizada neste turno.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {completedOrders.map((ord, idx) => (
                      <div key={ord.id} className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <span className="font-black text-slate-900">{idx + 1}. Pedido #{ord.codeNumber}</span>
                          <p className="text-[11px] text-slate-600 font-medium truncate">{ord.neighborhood || ord.address.split(',')[0]}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-black text-emerald-700 block text-xs">
                            +{formattedCurrency(ord.deliveryFee || activeMotoboy?.perDeliveryFee || 7.00)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">Venda: {formattedCurrency(ord.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const summaryText = `*RELATÓRIO DE EXPEDIENTE - ${activeMotoboy?.name || 'ENTREGADOR'}*
📅 Data: ${new Date().toLocaleDateString('pt-BR')}
🔴 Status: Expediente Encerrado${shiftEndedAt ? ` às ${shiftEndedAt}` : ''}

📊 *RESUMO FINANCEIRO:*
🚀 Arranque Fixo: ${formattedCurrency(arranqueAmount)}
🛵 Taxas de Entrega (${completedOrders.length}): ${formattedCurrency(deliveryFeesTotal)}
💰 *SALDO TOTAL A RECEBER: ${formattedCurrency(totalEarnedDisplay)}*

⚡ *PERFORMANCE DO TURNO:*
⏱️ Tempo em Expediente: ${formattedTimeInShift}
📦 Entregas por Hora: ${deliveriesPerHourVal} /h
💸 Ganho por Hora: ${formattedCurrency(Number(earningsPerHourVal))} /h
🏆 Maior Taxa Única: ${formattedCurrency(highestFeeVal)}

📦 *MÉTRICAS OPERACIONAIS:*
• Entregas Concluídas: ${completedOrders.length}
• Distância Estimada: ~${(completedOrders.length * 6.1).toFixed(1)} km
• Total em Vendas Transportadas: ${formattedCurrency(completedOrders.reduce((acc, o) => acc + o.total, 0))}

_Gerado via RotaFácil Delivery_`;

                    navigator.clipboard.writeText(summaryText);
                    triggerSystemActionToast("📋 Relatório completo copiado! Cole no WhatsApp do gerente da loja.");
                  }}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wide border border-emerald-400/40"
                >
                  <span>💬 Copiar Resumo para WhatsApp</span>
                </button>

                {activeMotoboy?.status === 'offline' && onUpdateMotoboyStatus && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateMotoboyStatus(activeMotoboy.id, 'available');
                      setAvailableSince(Date.now());
                      setShiftStartedAt(Date.now());
                      setShiftEndedAt(null);
                      setIsDailyReportModalOpen(false);
                      triggerSystemActionToast("🟢 Você reabriu o turno e entrou na fila!");
                    }}
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-amber-300 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700 uppercase"
                  >
                    <span>🟢 Iniciar Novo Expediente</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsDailyReportModalOpen(false)}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
