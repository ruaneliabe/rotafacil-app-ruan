import React, { useState, useEffect } from 'react';
import { StoreShift, Order, Motoboy, OrderStatus, UserSession } from './types';
import {
  INITIAL_STORE_SHIFT,
} from './data/initialData';
import { StoreDashboard } from './components/StoreDashboard';
import { MotoboyApp } from './components/MotoboyApp';
import { CustomerTrackingView } from './components/CustomerTrackingView';
import { NewOrderModal } from './components/NewOrderModal';
import { AddMotoboyModal } from './components/AddMotoboyModal';
import { LoginModal } from './components/LoginModal';
import { StoreAccountSettingsModal } from './components/StoreAccountSettingsModal';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { playNewOrderSound, playDispatchSound, playDeliverySuccessSound } from './utils/soundUtils';
import {
  subscribeToOrders,
  subscribeToMotoboys,
  subscribeToShift,
  saveOrderToCloud,
  saveMotoboyToCloud,
  saveMotoboyLocationToCloud,
  deleteMotoboyFromCloud,
  deleteAllMotoboysFromCloud,
  deleteAllOrdersFromCloud,
  clearAllDatabaseData,
  activateRealPilotMode,
  saveShiftToCloud,
  seedInitialDataIfEmpty,
} from './lib/firebase';
import {
  Store,
  Bike,
  Smartphone,
  LogIn,
  LogOut,
  UserCheck,
  Cloud,
  Sparkles,
  Settings,
  Building2,
  CheckCircle2,
} from 'lucide-react';


const logoImg = '/hope-burger-logo.jpg';

export default function App() {
  const [activeViewMode, setActiveViewMode] = useState<'store' | 'motoboy'>('store');
  const [urlTrackingCode, setUrlTrackingCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('rastreio') ||
      params.get('track') ||
      params.get('tracking') ||
      params.get('order') ||
      null
    );
  });

  const [shift, setShift] = useState<StoreShift>({
    ...INITIAL_STORE_SHIFT,
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [selectedTrackingOrder, setSelectedTrackingOrder] = useState<Order | null>(null);

  // Listen for popstate URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      setUrlTrackingCode(
        params.get('rastreio') ||
        params.get('track') ||
        params.get('tracking') ||
        params.get('order') ||
        null
      );
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('rota_facil_session');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  });

  useEffect(() => {
    if (session) {
      localStorage.setItem('rota_facil_session', JSON.stringify(session));
      if (session.role === 'motoboy') {
        setActiveViewMode('motoboy');
      } else if (session.role === 'store_admin') {
        setActiveViewMode('store');
      }
    } else {
      localStorage.removeItem('rota_facil_session');
    }
  }, [session]);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isMotoboyModalOpen, setIsMotoboyModalOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);

  // Remove legacy operational data from older browser-only builds.
  // Operational state must always come from Firestore so every device sees the same data.
  useEffect(() => {
    const legacyOperationalKeys = [
      'rota_facil_orders',
      'rota_facil_motoboys',
      'rota_facil_shift',
      'rota_facil_store_shift',
      'rota_facil_saved_routes_v1',
    ];

    legacyOperationalKeys.forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem('rota_facil_active_motoboy_id');
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSaveStoreSettings = (updatedShift: StoreShift) => {
    const configuredShift = { ...updatedShift, setupRequired: false, pilotMode: true, demoDataDisabled: true };
    setShift(configuredShift);
    saveShiftToCloud(configuredShift);
    setIsAccountSettingsOpen(false);
    showToast(`Configurações da loja "${updatedShift.storeName}" salvas com sucesso! 🏢`);
  };

  // 1. Firebase Cloud Sync initialization & snapshot listeners
  useEffect(() => {
    // Firestore is the single source of truth for all operational data.
    // We only consider the app synced after the first snapshots arrive.
    let ordersReady = false;
    let motoboysReady = false;
    let shiftReady = false;
    const markCloudReady = () => {
      if (ordersReady && motoboysReady && shiftReady) setCloudSynced(true);
    };

    let disposed = false;
    let unsubOrders = () => {};
    let unsubMotoboys = () => {};
    let unsubShift = () => {};

    const startCloudSync = async () => {
      // Finish and verify the reset before listeners or reconciliation effects can write.
      await seedInitialDataIfEmpty();
      if (disposed) return;
      setOrders([]);
      setMotoboys([]);

      unsubOrders = subscribeToOrders((cloudOrders) => {
        setOrders(cloudOrders);
        ordersReady = true;
        markCloudReady();
      });

      unsubMotoboys = subscribeToMotoboys((cloudMotoboys) => {
        setMotoboys(cloudMotoboys);
        motoboysReady = true;
        markCloudReady();
      });

      unsubShift = subscribeToShift((cloudShift) => {
        shiftReady = true;
        markCloudReady();
        if (cloudShift) {
          setShift(cloudShift);
        }
      });
    };

    startCloudSync().catch((err) => console.error('Cloud initialization failed:', err));

    return () => {
      disposed = true;
      unsubOrders();
      unsubMotoboys();
      unsubShift();
    };
  }, []);

  // Only the authenticated motoboy device updates its own GPS position.
  // The store/admin device must never overwrite a driver's location.
  useEffect(() => {
    if (session?.role !== 'motoboy' || !session.motoboyId) return;
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    const motoboyId = session.motoboyId;

    const handleGpsUpdate = (pos: GeolocationPosition) => {
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));

      setMotoboys((prevMotoboys) => {
        const index = prevMotoboys.findIndex((m) => m.id === motoboyId);
        if (index === -1) return prevMotoboys;

        const current = prevMotoboys[index];
        const distChanged =
          Math.abs((current.currentLat || 0) - lat) > 0.0001 ||
          Math.abs((current.currentLng || 0) - lng) > 0.0001;

        const heartbeatDue = !current.locationUpdatedAt || Date.now() - current.locationUpdatedAt >= 10000;
        if (!distChanged && !heartbeatDue) return prevMotoboys;

        const locationUpdatedAt = Date.now();
        const updatedMotoboy = { ...current, currentLat: lat, currentLng: lng, locationUpdatedAt };
        saveMotoboyLocationToCloud(motoboyId, lat, lng, locationUpdatedAt);
        const updatedList = [...prevMotoboys];
        updatedList[index] = updatedMotoboy;
        return updatedList;
      });
    };

    navigator.geolocation.getCurrentPosition(handleGpsUpdate, () => {}, { enableHighAccuracy: true });
    const watchId = navigator.geolocation.watchPosition(
      handleGpsUpdate,
      (err) => console.warn('Motoboy GPS watch warning:', err.message),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [session?.role, session?.motoboyId]);

  // Keep the displayed active-order counter consistent even after reassignment or multi-device edits.
  useEffect(() => {
    if (!cloudSynced) return;
    motoboys.forEach((m) => {
      const expectedCount = orders.filter(
        (o) =>
          o.assignedMotoboyId === m.id &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled'
      ).length;
      if (m.activeOrdersCount !== expectedCount) {
        saveMotoboyToCloud({ ...m, activeOrdersCount: expectedCount });
      }
    });
  }, [cloudSynced, orders, motoboys]);

  // Real-time Clock for top header
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const dayName = days[now.getDay()];
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setCurrentTimeStr(`${dayName} • ${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string, duration = 3500) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), duration);
  };

  const handleToggleShift = () => {
    setShift((prev) => {
      const nextOpen = !prev.isOpen;
      const updated = { ...prev, isOpen: nextOpen };
      saveShiftToCloud(updated);
      showToast(nextOpen ? 'Expediente ABERTO no Rota Fácil! 🛵' : 'Expediente ENCERRADO.');
      return updated;
    });
  };

  const handleAssignOrderToMotoboy = (orderId: string, motoboyId: string) => {
    const targetMotoboy = motoboys.find((m) => m.id === motoboyId);
    if (!targetMotoboy) return;

    const orderObj = orders.find((o) => o.id === orderId);
    if (!orderObj) return;

    const newStatus =
      orderObj.status === 'in_transit' || orderObj.status === 'picked_up' || orderObj.status === 'ready_at_counter'
        ? orderObj.status
        : 'preparing';

    const updatedOrder: Order = {
      ...orderObj,
      assignedMotoboyId: targetMotoboy.id,
      assignedMotoboyName: targetMotoboy.name,
      status: newStatus,
    };

    const updatedMotoboy: Motoboy = {
      ...targetMotoboy,
      activeOrdersCount: targetMotoboy.activeOrdersCount + 1,
      status: targetMotoboy.status,
    };

    // Update local & cloud
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));
    setMotoboys((prev) => prev.map((m) => (m.id === targetMotoboy.id ? updatedMotoboy : m)));
    saveOrderToCloud(updatedOrder);
    saveMotoboyToCloud(updatedMotoboy);
    playDispatchSound();

    showToast(`Pedido #${updatedOrder.codeNumber} vinculado a ${targetMotoboy.name}! 🛵`);
  };

  const handleAssignBatchToMotoboy = (orderIds: string[], motoboyId: string) => {
    const targetMotoboy = motoboys.find((m) => m.id === motoboyId);
    if (!targetMotoboy || orderIds.length === 0) return;

    const updatedOrdersList = orders.map((o) => {
      if (orderIds.includes(o.id)) {
        const newStatus =
          o.status === 'in_transit' || o.status === 'picked_up' || o.status === 'ready_at_counter'
            ? o.status
            : 'preparing';

        const updated: Order = {
          ...o,
          assignedMotoboyId: targetMotoboy.id,
          assignedMotoboyName: targetMotoboy.name,
          status: newStatus,
        };
        saveOrderToCloud(updated);
        return updated;
      }
      return o;
    });

    const updatedMotoboy: Motoboy = {
      ...targetMotoboy,
      activeOrdersCount: targetMotoboy.activeOrdersCount + orderIds.length,
      status: targetMotoboy.status,
    };

    setOrders(updatedOrdersList);
    setMotoboys((prev) => prev.map((m) => (m.id === targetMotoboy.id ? updatedMotoboy : m)));
    saveMotoboyToCloud(updatedMotoboy);

    showToast(`Bag de Rota com ${orderIds.length} pedidos vinculada a ${targetMotoboy.name}! 🎒🛵`);
  };

  const handleConfirmArrivalAtStore = (motoboyId: string) => {
    const targetMotoboy = motoboys.find((m) => m.id === motoboyId);
    if (!targetMotoboy || targetMotoboy.status !== 'returning_to_store') return;

    const now = Date.now();
    const updatedMotoboy: Motoboy = {
      ...targetMotoboy,
      activeOrdersCount: 0,
      status: 'available',
      joinedQueueAt: now, // Reset queue timestamp when returning to store from delivery
    };

    // Coloca o motoboy no final da fila de rodízio
    setMotoboys((prev) => {
      const others = prev.filter((m) => m.id !== motoboyId);
      return [...others, updatedMotoboy];
    });

    saveMotoboyToCloud(updatedMotoboy);
    showToast(`Motoboy ${targetMotoboy.name} chegou à loja e entrou no final da fila de rodízio! 🏁🛵`);
  };

  const handleUpdateMotoboyStatus = (motoboyId: string, status: Motoboy['status']) => {
    const targetMotoboy = motoboys.find((m) => m.id === motoboyId);
    if (!targetMotoboy) return;

    const now = Date.now();
    const updatedMotoboy: Motoboy = {
      ...targetMotoboy,
      status,
      joinedQueueAt:
        status === 'available'
          ? targetMotoboy.status !== 'available'
            ? now
            : targetMotoboy.joinedQueueAt || now
          : undefined,
    };

    setMotoboys((prev) => prev.map((m) => (m.id === motoboyId ? updatedMotoboy : m)));
    saveMotoboyToCloud(updatedMotoboy);

    if (status === 'busy') {
      showToast(`Motoboy ${targetMotoboy.name} saiu da fila de espera e pausou atendimento. ⏸️`);
    } else if (status === 'available') {
      showToast(`Motoboy ${targetMotoboy.name} entrou na fila de rodízio da loja! 🏁🛵`);
    }
  };

  const handleClearAllData = async () => {
    if (
      window.confirm(
        '⚠️ Tem certeza que deseja APAGAR TODOS OS DADOS (pedidos e motoboys)? O sistema será zerado para você começar do zero.'
      )
    ) {
      await clearAllDatabaseData();
      setOrders([]);
      setMotoboys([]);
      localStorage.removeItem('rota_facil_orders');
      localStorage.removeItem('rota_facil_motoboys');
      showToast('🧹 Todos os dados foram apagados! Banco zerado para você começar do zero. 🚀', 5000);
    }
  };

  const handleActivateRealPilot = async () => {
    if (shift.adminPassword === 'hope2026') {
      showToast('Troque primeiro a senha padrão da loja antes de ativar o Piloto Real.', 6000);
      return;
    }
    if (!window.confirm('ATIVAR PILOTO REAL? Isso apagará definitivamente os 300 pedidos e 20 motoboys de demonstração. Os dados da loja serão preservados.')) return;
    try {
      const pilotShift = await activateRealPilotMode();
      setOrders([]);
      setMotoboys([]);
      setShift(pilotShift);
      showToast('✅ Piloto Real ativado. Banco limpo e massa de demonstração desativada.', 7000);
    } catch (error) {
      console.error(error);
      showToast('❌ Não foi possível ativar o piloto. Nenhuma operação real deve começar.', 7000);
    }
  };

  const handleReorderMotoboyRoute = (orderedOrderIds: string[]) => {
    setOrders((prev) => {
      const updated = prev.map((ord) => {
        const seqIdx = orderedOrderIds.indexOf(ord.id);
        if (seqIdx !== -1) {
          // Reordering must never start/alter a delivery by itself.
          // Status changes only through explicit pickup/start/deliver actions.
          const updatedOrd: Order = { ...ord, routeSequence: seqIdx + 1 };
          saveOrderToCloud(updatedOrd);
          return updatedOrd;
        }
        return ord;
      });
      return updated;
    });
    showToast('MAPA: Sequência de entregas atualizada!');
  };

  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;
    // Idempotency guard: avoids double earnings / duplicate delivery actions on rapid taps.
    if (targetOrder.status === status) return;
    if (targetOrder.status === 'delivered' || targetOrder.status === 'cancelled') return;
    if (status === 'delivered' && targetOrder.status !== 'in_transit') {
      showToast('Este pedido ainda não está em rota e não pode ser concluído.');
      return;
    }

    const updatedOrder: Order = {
      ...targetOrder,
      status,
      deliveredAt:
        status === 'delivered'
          ? new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : targetOrder.deliveredAt,
    };

    setOrders((prev) => prev.map((ord) => (ord.id === orderId ? updatedOrder : ord)));
    saveOrderToCloud(updatedOrder);

    // If order goes in_transit, update motoboy status to delivering
    if (status === 'in_transit' && targetOrder.assignedMotoboyId) {
      const targetMotoboy = motoboys.find((m) => m.id === targetOrder.assignedMotoboyId);
      if (targetMotoboy && targetMotoboy.status !== 'delivering') {
        const updatedMotoboy: Motoboy = {
          ...targetMotoboy,
          status: 'delivering',
        };
        setMotoboys((prev) => prev.map((m) => (m.id === targetMotoboy.id ? updatedMotoboy : m)));
        saveMotoboyToCloud(updatedMotoboy);
      }
    }

    // Update motoboy status & earnings if delivered
    if (status === 'delivered') {
      playDeliverySuccessSound();
      const targetMotoboy = motoboys.find((m) => m.id === targetOrder.assignedMotoboyId);

      if (targetMotoboy) {
        const remainingActiveOrders = orders
          .filter(
            (o) =>
              o.id !== orderId &&
              o.assignedMotoboyId === targetMotoboy.id &&
              o.status !== 'delivered' &&
              o.status !== 'cancelled'
          )
          .sort((a, b) => (a.routeSequence || 99) - (b.routeSequence || 99));

        const isFinishedAll = remainingActiveOrders.length === 0;

        // Next remaining order in sequence automatically goes 'in_transit' as motoboy is already out delivering
        if (!isFinishedAll && remainingActiveOrders.length > 0) {
          const nextOrder = remainingActiveOrders[0];
          if (nextOrder.status !== 'in_transit') {
            const updatedNextOrder: Order = {
              ...nextOrder,
              status: 'in_transit',
            };
            setOrders((prev) => prev.map((ord) => (ord.id === nextOrder.id ? updatedNextOrder : ord)));
            saveOrderToCloud(updatedNextOrder);
          }
        }

        const feeEarned = targetOrder.deliveryFee && targetOrder.deliveryFee > 0
          ? targetOrder.deliveryFee
          : (targetMotoboy.perDeliveryFee && targetMotoboy.perDeliveryFee > 0 ? targetMotoboy.perDeliveryFee : 5.0);

        const updatedMotoboy: Motoboy = {
          ...targetMotoboy,
          deliveriesCountToday: (targetMotoboy.deliveriesCountToday || 0) + 1,
          totalEarnedToday: (targetMotoboy.totalEarnedToday || 0) + feeEarned,
          activeOrdersCount: remainingActiveOrders.length,
          status: isFinishedAll ? 'returning_to_store' : 'delivering',
        };

        setMotoboys((prev) => prev.map((m) => (m.id === targetMotoboy.id ? updatedMotoboy : m)));
        saveMotoboyToCloud(updatedMotoboy);

        if (isFinishedAll) {
          showToast(
            `🚨 ATENÇÃO LOJA: Motoboy ${targetMotoboy.name} finalizou TODAS as entregas e está VOLTANDO PARA A LOJA! 🏪🛵`,
            7000
          );
        } else {
          const nextCode = remainingActiveOrders[0]?.codeNumber;
          showToast(
            `Pedido #${targetOrder.codeNumber} entregue! 🎉 Próxima parada da rota: #${nextCode || 'Próximo'}`
          );
        }
      } else {
        showToast(`Pedido #${targetOrder.codeNumber} marcado como entregue! 🎉`);
      }
    } else if (status === 'picked_up') {
      showToast(
        `✅ Retirada do Pedido #${targetOrder.codeNumber} confirmada pelo motoboy! Próximo passo: Iniciar Rota.`,
        4000
      );
    } else if (status === 'in_transit') {
      showToast(
        `🚀 Pedido #${targetOrder.codeNumber} INICIOU A ROTA! Rastreio ativo para ${targetOrder.clientName}.`,
        5000
      );
    } else if (status === 'ready_at_counter') {
      showToast(
        `🛍️ Motoboy avisado! Pedido #${targetOrder.codeNumber} pronto para retirada no balcão.`,
        4000
      );
    } else {
      showToast(`Status do pedido #${targetOrder.codeNumber} atualizado!`);
    }
  };

  const handleAddOrder = (
    newOrdData: Omit<Order, 'id' | 'codeNumber' | 'status' | 'createdAt' | 'trackingCode'>
  ) => {
    const currentActiveOrders = orders.filter((order) => order.status !== 'delivered' && order.status !== 'cancelled').length;
    if (shift.pilotMode && currentActiveOrders >= 5) {
      showToast('Piloto Real limitado a 5 pedidos simultâneos. Finalize ou cancele um pedido antes de criar outro.', 6000);
      return;
    }
    const maxCode = orders.reduce((max, o) => Math.max(max, o.codeNumber || 0), 100);
    const nextCode = maxCode + 1;
    const newOrd: Order = {
      ...newOrdData,
      id: `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      codeNumber: nextCode,
      status: 'pending',
      assignedMotoboyId: null,
      assignedMotoboyName: null,
      createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      trackingCode: `RF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    };

    setOrders((prev) => [newOrd, ...prev]);
    saveOrderToCloud(newOrd);
    playNewOrderSound();
    showToast(`Pedido #${nextCode} criado e salvo na nuvem! 🛵`);
  };

  const handleAddMotoboy = (
    newMotoboyData: Omit<Motoboy, 'id' | 'status' | 'activeOrdersCount' | 'totalEarnedToday'>
  ) => {
    const newM: Motoboy = {
      ...newMotoboyData,
      id: `m-${Date.now()}`,
      status: 'offline',
      activeOrdersCount: 0,
      totalEarnedToday: 0,
      deliveriesCountToday: 0,
    };

    setMotoboys((prev) => [...prev, newM]);
    saveMotoboyToCloud(newM);
    showToast(`Motoboy ${newM.name} cadastrado com sucesso! 🛵`);
  };

  const handleDeleteMotoboy = (motoboyId: string) => {
    setMotoboys((prev) => prev.filter((m) => m.id !== motoboyId));
    deleteMotoboyFromCloud(motoboyId);
    showToast('Motoboy removido.');
  };

  const handleDeleteAllMotoboys = () => {
    setMotoboys([]);
    deleteAllMotoboysFromCloud();
    showToast('Todos os motoboys foram removidos com sucesso! Pode cadastrar do zero. 🛵');
  };

  const handleLoginSuccess = (userSession: UserSession) => {
    setSession(userSession);
    if (userSession.role === 'motoboy') {
      setActiveViewMode('motoboy');
      showToast(`Bem-vindo, entregador ${userSession.motoboyName}! 🛵`);
    } else {
      setActiveViewMode('store');
      if (shift.setupRequired) setIsAccountSettingsOpen(true);
      showToast(`Bem-vindo ao Painel Rota Fácil! 🛵`);
    }
  };

  // If customer accessed via a direct tracking link (?rastreio=HOPE-xxx)
  if (urlTrackingCode) {
    const matchedOrder =
      orders.find(
        (o) =>
          o.trackingCode.toLowerCase() === urlTrackingCode.toLowerCase() ||
          o.id === urlTrackingCode ||
          o.codeNumber.toString() === urlTrackingCode
      );

    return (
      <div className="min-h-screen bg-slate-100">
        {matchedOrder ? (
          <CustomerTrackingView
            order={matchedOrder}
            motoboy={motoboys.find((m) => m.id === matchedOrder.assignedMotoboyId)}
            shift={shift}
            allOrders={orders}
            isOperator={Boolean(session && session.role === 'store_admin')}
            onBackToDashboard={() => {
              window.history.pushState({}, '', window.location.pathname);
              setUrlTrackingCode(null);
            }}
          />
        ) : (
          <div className="max-w-md mx-auto p-8 text-center space-y-4 font-sans text-slate-800">
            <h2 className="text-xl font-bold">Rastreio de Pedido</h2>
            <p className="text-sm text-slate-600">
              {cloudSynced ? (
                <>Pedido <strong>{urlTrackingCode}</strong> não encontrado. Confira o link enviado pela loja.</>
              ) : (
                <>Carregando dados do pedido <strong>{urlTrackingCode}</strong>...</>
              )}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Standalone Login Screen if not authenticated
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col justify-center items-center p-4">
        {toastMessage && (
          <div className="fixed top-5 right-5 z-50 bg-slate-800 border border-slate-700 text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2">
            <span>{toastMessage}</span>
          </div>
        )}
        <LoginModal
          isStandalonePage={true}
          onLoginSuccess={handleLoginSuccess}
          motoboys={motoboys}
          shift={shift}
          logoUrl={logoImg}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col selection:bg-slate-700 selection:text-white">
      {!isOnline && (
        <div className="sticky top-0 z-[100] bg-rose-600 text-white text-center text-xs font-black px-3 py-2 shadow-lg">
          ⚠️ SEM INTERNET — alterações podem não chegar aos outros dispositivos até a conexão voltar.
        </div>
      )}
      {/* Toast Notification - Clean, professional neutral badge (Store Admin only) */}
      {toastMessage && session?.role === 'store_admin' && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-800/95 border border-slate-700 text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 animate-fadeIn">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Top Header Navigation - Store Admin Only */}
      {session.role === 'store_admin' && (
        <header className="bg-slate-950/80 border-b border-slate-800/60 sticky top-0 z-40 backdrop-blur-md text-white">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-3">
            
            {/* Brand & Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-white text-sm tracking-tight">
                  Rota Fácil
                </h1>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                  Ao vivo
                </span>
              </div>
            </div>

            {/* User Status & Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAccountSettingsOpen(true)}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                title="Configurações da Conta e Nome da Loja"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Configurar Loja</span>
              </button>

              <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="font-medium text-slate-200 hidden sm:inline">Loja</span>
                <button
                  type="button"
                  onClick={() => {
                    setSession(null);
                    showToast('Sessão encerrada.');
                  }}
                  className="ml-1 px-1.5 py-0.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 rounded transition-all text-xs cursor-pointer"
                  title="Sair"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 w-full mx-auto ${session.role === 'motoboy' ? 'p-1 sm:p-3 max-w-md' : 'max-w-[1680px] p-3 md:p-4 space-y-4'}`}>
        {session.role === 'store_admin' && (
          <StoreDashboard
            shift={shift}
            orders={orders}
            motoboys={motoboys}
            onToggleShift={handleToggleShift}
            onAssignOrderToMotoboy={handleAssignOrderToMotoboy}
            onAssignBatchToMotoboy={handleAssignBatchToMotoboy}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onUpdateMotoboyStatus={handleUpdateMotoboyStatus}
            onReorderMotoboyRoute={handleReorderMotoboyRoute}
            onConfirmArrivalAtStore={handleConfirmArrivalAtStore}
            onOpenNewOrderModal={() => setIsNewOrderModalOpen(true)}
            onOpenMotoboyModal={() => setIsMotoboyModalOpen(true)}
            onOpenStoreSettings={() => setIsAccountSettingsOpen(true)}
            onDeleteMotoboy={handleDeleteMotoboy}
            onDeleteAllMotoboys={handleDeleteAllMotoboys}
            onAddOrder={handleAddOrder}
            onSaveIntegrations={(integrations) => {
              const updatedShift = { ...shift, integrations };
              setShift(updatedShift);
              saveShiftToCloud(updatedShift);
              showToast('Integrações da loja salvas com sucesso! 🔌');
            }}
            onSelectOrderForTracking={(ord) => {
              setSelectedTrackingOrder(ord);
              const trackingUrl = `${window.location.origin}/?rastreio=${ord.trackingCode || ord.id}`;
              try {
                navigator.clipboard.writeText(trackingUrl);
                showToast(`Mapa do pedido #${ord.codeNumber} aberto e link copiado! 🗺️🔗`);
              } catch {
                showToast(`Mapa do pedido #${ord.codeNumber} aberto! 🗺️`);
              }
            }}
          />
        )}

        {session.role === 'motoboy' && (
          <div className="py-2 space-y-4 max-w-md mx-auto">
            <MotoboyApp
              motoboys={motoboys}
              orders={orders}
              shift={shift}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onReorderMotoboyRoute={handleReorderMotoboyRoute}
              onConfirmArrivalAtStore={handleConfirmArrivalAtStore}
              onUpdateMotoboyStatus={handleUpdateMotoboyStatus}
              onSimulateArrival={(order) => {
                showToast(`Status "CHEGUEI" enviado ao cliente ${order.clientName}! 🔔`);
              }}
              initialMotoboyId={session.motoboyId}
              isLockedToMotoboy={true}
              onLogout={() => {
                setSession(null);
                showToast('Sessão de entregador encerrada.');
              }}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <OrderTrackingModal
        isOpen={Boolean(selectedTrackingOrder)}
        order={selectedTrackingOrder}
        onClose={() => setSelectedTrackingOrder(null)}
        motoboy={motoboys.find((m) => m.id === selectedTrackingOrder?.assignedMotoboyId)}
        shift={shift}
      />

      <NewOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        onAddOrder={handleAddOrder}
        nextOrderCode={orders.reduce((max, o) => Math.max(max, o.codeNumber || 0), 100) + 1}
      />

      <AddMotoboyModal
        isOpen={isMotoboyModalOpen}
        onClose={() => setIsMotoboyModalOpen(false)}
        onAddMotoboy={handleAddMotoboy}
      />

      <StoreAccountSettingsModal
        isOpen={isAccountSettingsOpen || Boolean(shift.setupRequired && session.role === 'store_admin')}
        onClose={() => { if (!shift.setupRequired) setIsAccountSettingsOpen(false); }}
        shift={shift}
        onSaveSettings={handleSaveStoreSettings}
        onClearAllData={shift.setupRequired ? undefined : handleClearAllData}
        onActivateRealPilot={shift.setupRequired ? undefined : handleActivateRealPilot}
        firstSetup={Boolean(shift.setupRequired)}
      />
    </div>
  );
}
