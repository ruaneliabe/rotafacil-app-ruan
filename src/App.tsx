import React, { useState, useEffect } from 'react';
import { StoreShift, Order, Motoboy, UserSession } from './types';
import { INITIAL_STORE_SHIFT } from './data/initialData';
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
  activateRealPilotMode,
  saveShiftToCloud,
  seedInitialDataIfEmpty,
} from './lib/firebase';
import {
  Settings,
  Building2,
  CheckCircle2,
  LogOut,
  Crown,
  Store,
  Bike,
  Package,
  Activity,
  ShieldCheck,
  User,
  Radio,
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
      } else if (session.role === 'store_admin' || session.role === 'master_admin') {
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

  const handleActivateRealPilot = async () => {
    try {
      const pilotShift = await activateRealPilotMode();
      setShift(pilotShift);
      setIsAccountSettingsOpen(false);
      showToast('Piloto real ativado com sucesso! Pronto para pedidos reais.');
    } catch (err: any) {
      console.error('Falha ao ativar piloto real:', err);
      showToast(err?.message || 'Falha ao ativar piloto real. Tente novamente.');
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Initial Firestore Setup & Realtime Subscriptions
  useEffect(() => {
    seedInitialDataIfEmpty().catch((err) => console.warn('Erro ao inicializar Firestore:', err));

    const unsubOrders = subscribeToOrders((cloudOrders) => {
      setOrders((prev) => {
        if (prev.length > 0 && cloudOrders.length > prev.length) {
          const prevIds = new Set(prev.map((o) => o.id));
          const hasNew = cloudOrders.some((o) => !prevIds.has(o.id));
          if (hasNew) playNewOrderSound();
        }
        return cloudOrders;
      });
      setCloudSynced(true);
    });

    const unsubMotoboys = subscribeToMotoboys((cloudMotoboys) => {
      setMotoboys(cloudMotoboys);
      setCloudSynced(true);
    });

    const CARDAPIO_WEB_USER_TOKEN = 'ed3bxFMKCQGtaqbTVJrDy6ZqfM7z2hEFLaRmQBo3tMW4ZkGuxTmBHAweBTrx';
    const unsubShift = subscribeToShift((cloudShift) => {
      const mergedShift = { ...cloudShift };
      const currentToken = mergedShift.integrations?.cardapioWeb?.accountId;
      if (!currentToken || currentToken === 'hope-burger-cardapio' || currentToken === 'hope-pizza-cardapio') {
        mergedShift.integrations = {
          ...mergedShift.integrations,
          cardapioWeb: {
            enabled: true,
            accountId: CARDAPIO_WEB_USER_TOKEN,
            webhookUrl: mergedShift.integrations?.cardapioWeb?.webhookUrl || '',
          },
        };
      }
      setShift(mergedShift);
      setCloudSynced(true);
    });

    return () => {
      unsubOrders();
      unsubMotoboys();
      unsubShift();
    };
  }, []);

  // 2. Realtime Watchdog
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      motoboys.forEach((m) => {
        if (
          m.callingToCounterAt &&
          now - m.callingToCounterAt > 15000 &&
          m.status === 'available'
        ) {
          const updated = {
            ...m,
            callingToCounterAt: undefined,
          };
          saveMotoboyToCloud(updated);
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [motoboys]);

  // Order Handlers
  const handleAddOrder = (newOrderData: Omit<Order, 'id' | 'codeNumber' | 'status' | 'createdAt' | 'trackingCode'> | Order) => {
    const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    const nextCode = (newOrderData as any).codeNumber || (orders.reduce((max, o) => Math.max(max, o.codeNumber || 0), 100) + 1);
    const orderId = (newOrderData as any).id || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const tracking = (newOrderData as any).trackingCode || `ROTA-${nextCode}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const completeOrder: Order = {
      id: orderId,
      codeNumber: nextCode,
      clientName: newOrderData.clientName || 'Cliente',
      clientPhone: newOrderData.clientPhone || '',
      address: newOrderData.address || 'Endereço da entrega',
      street: newOrderData.street,
      houseNumber: newOrderData.houseNumber,
      complement: newOrderData.complement,
      neighborhood: newOrderData.neighborhood || 'Centro',
      lat: newOrderData.lat || shift.storeLat || -26.9194,
      lng: newOrderData.lng || shift.storeLng || -49.0661,
      items: newOrderData.items || [],
      itemsSummary: newOrderData.itemsSummary || 'Pedido',
      subtotal: newOrderData.subtotal || newOrderData.total || 0,
      deliveryFee: newOrderData.deliveryFee || 0,
      total: newOrderData.total || 0,
      paymentMethod: newOrderData.paymentMethod || 'pix',
      changeFor: newOrderData.changeFor,
      status: (newOrderData as any).status || 'pending',
      createdAt: (newOrderData as any).createdAt || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      createdDate: (newOrderData as any).createdDate || today,
      estimatedMinutes: newOrderData.estimatedMinutes || 25,
      assignedMotoboyId: newOrderData.assignedMotoboyId || null,
      assignedMotoboyName: newOrderData.assignedMotoboyName || null,
      originChannel: newOrderData.originChannel || 'manual',
      kitchenReadyInMin: newOrderData.kitchenReadyInMin || 0,
      trackingCode: tracking,
    };

    saveOrderToCloud(completeOrder);
    playNewOrderSound();
    showToast(`Pedido #${completeOrder.codeNumber} cadastrado com sucesso! 📦`);
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: Order['status']) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;

    if (newStatus === 'dispatched') playDispatchSound();
    if (newStatus === 'delivered') playDeliverySuccessSound();

    const updatedOrder: Order = {
      ...target,
      status: newStatus,
      dispatchedAt:
        newStatus === 'dispatched' ? new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : target.dispatchedAt,
      deliveredAt:
        newStatus === 'delivered' ? new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : target.deliveredAt,
      deliveredTimestamp: newStatus === 'delivered' ? Date.now() : target.deliveredTimestamp,
    };

    saveOrderToCloud(updatedOrder);

    // If dispatched and has motoboy, make sure motoboy is in delivering status
    if (newStatus === 'dispatched' && target.assignedMotoboyId) {
      const driver = motoboys.find((m) => m.id === target.assignedMotoboyId);
      if (driver && driver.status !== 'delivering') {
        saveMotoboyToCloud({
          ...driver,
          status: 'delivering',
          activeOrdersCount: (driver.activeOrdersCount || 0) + 1,
          joinedQueueAt: undefined,
          callingToCounterAt: undefined,
        });
      }
    }

    // If order was delivered or cancelled, check motoboy status
    if (newStatus === 'delivered' || newStatus === 'cancelled') {
      const driverId = target.assignedMotoboyId;
      if (driverId) {
        const driver = motoboys.find((m) => m.id === driverId);
        if (driver) {
          const remainingOrders = orders.filter(
            (o) => o.assignedMotoboyId === driverId && o.id !== orderId && o.status !== 'delivered' && o.status !== 'cancelled'
          );

          if (remainingOrders.length === 0) {
            const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
            const isDifferentDay = driver.statsDate !== today;
            const updatedDriver: Motoboy = {
              ...driver,
              status: 'returning_to_store',
              activeOrdersCount: 0,
              joinedQueueAt: undefined,
              callingToCounterAt: undefined,
              deliveriesCountToday: (isDifferentDay ? 0 : (driver.deliveriesCountToday || 0)) + (newStatus === 'delivered' ? 1 : 0),
              totalEarnedToday: (isDifferentDay ? 0 : (driver.totalEarnedToday || 0)) + (newStatus === 'delivered' ? (target.deliveryFee || 0) : 0),
              statsDate: today,
            };
            saveMotoboyToCloud(updatedDriver);
          }
        }
      }
    }
  };

  const handleAssignOrderToMotoboy = (orderId: string, motoboyId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const targetMotoboy = motoboys.find((m) => m.id === motoboyId);
    if (!targetOrder || !targetMotoboy) return;

    const updatedOrder: Order = {
      ...targetOrder,
      assignedMotoboyId: motoboyId,
      assignedMotoboyName: targetMotoboy.name,
      status: 'preparing',
      routeSequence: (targetMotoboy.activeOrdersCount || 0) + 1,
    };

    saveOrderToCloud(updatedOrder);

    const updatedMotoboy: Motoboy = {
      ...targetMotoboy,
      activeOrdersCount: (targetMotoboy.activeOrdersCount || 0) + 1,
    };
    saveMotoboyToCloud(updatedMotoboy);

    playNewOrderSound();
    showToast(`Pedido #${targetOrder.codeNumber} vinculado a ${targetMotoboy.name}! 🍳 Em preparo (Aguardando ficar pronto)`);
  };

  const handleAssignBatchToMotoboy = (orderIds: string[], motoboyId: string) => {
    const targetMotoboy = motoboys.find((m) => m.id === motoboyId);
    if (!targetMotoboy || orderIds.length === 0) return;

    orderIds.forEach((id, idx) => {
      const order = orders.find((o) => o.id === id);
      if (order) {
        saveOrderToCloud({
          ...order,
          assignedMotoboyId: motoboyId,
          assignedMotoboyName: targetMotoboy.name,
          status: 'preparing',
          routeSequence: (targetMotoboy.activeOrdersCount || 0) + idx + 1,
        });
      }
    });

    const updatedMotoboy: Motoboy = {
      ...targetMotoboy,
      activeOrdersCount: (targetMotoboy.activeOrdersCount || 0) + orderIds.length,
    };
    saveMotoboyToCloud(updatedMotoboy);

    playNewOrderSound();
    showToast(`${orderIds.length} pedidos vinculados a ${targetMotoboy.name}! 🍳 Em preparo`);
  };

  const handleReorderMotoboyRoute = (motoboyId: string, reorderedOrderIds: string[]) => {
    reorderedOrderIds.forEach((orderId, index) => {
      const order = orders.find((o) => o.id === orderId);
      if (order && order.assignedMotoboyId === motoboyId) {
        saveOrderToCloud({
          ...order,
          routeSequence: index + 1,
        });
      }
    });
    showToast('Sequência da rota atualizada com sucesso! 🗺️');
  };

  const handleUpdateMotoboyStatus = (motoboyId: string, newStatus: Motoboy['status']) => {
    const target = motoboys.find((m) => m.id === motoboyId);
    if (!target) return;

    const updated: Motoboy = {
      ...target,
      status: newStatus,
      joinedQueueAt: newStatus === 'available' ? (target.joinedQueueAt || Date.now()) : undefined,
      callingToCounterAt: undefined,
    };
    saveMotoboyToCloud(updated);
  };

  const handleConfirmArrivalAtStore = (motoboyId: string) => {
    const target = motoboys.find((m) => m.id === motoboyId);
    if (!target) return;

    const updated: Motoboy = {
      ...target,
      status: 'available',
      activeOrdersCount: 0,
      joinedQueueAt: Date.now(),
      callingToCounterAt: undefined,
    };
    saveMotoboyToCloud(updated);
    showToast(`${target.name} chegou à loja e entrou no final da fila! 🏁`);
  };

  const handleToggleShift = () => {
    const updatedShift: StoreShift = {
      ...shift,
      isOpen: !shift.isOpen,
      openedAt: !shift.isOpen ? new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : shift.openedAt,
    };
    setShift(updatedShift);
    saveShiftToCloud(updatedShift);
    showToast(updatedShift.isOpen ? 'Turno aberto! Loja pronta para receber pedidos.' : 'Turno fechado.');
  };

  const handleAddMotoboy = (newMotoboyData: Omit<Motoboy, 'id' | 'status' | 'activeOrdersCount' | 'totalEarnedToday'> | Motoboy) => {
    const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    const motoboyId = (newMotoboyData as any).id || `mb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const completeMotoboy: Motoboy = {
      id: motoboyId,
      name: newMotoboyData.name,
      phone: newMotoboyData.phone || '',
      plate: newMotoboyData.plate || '',
      vehicleModel: newMotoboyData.vehicleModel || '',
      username: newMotoboyData.username || '',
      password: newMotoboyData.password || '',
      status: (newMotoboyData as any).status || 'available',
      activeOrdersCount: 0,
      deliveriesCountToday: 0,
      totalEarnedToday: 0,
      statsDate: today,
      joinedQueueAt: Date.now(),
      currentLat: newMotoboyData.currentLat || 0,
      currentLng: newMotoboyData.currentLng || 0,
    };
    saveMotoboyToCloud(completeMotoboy);
    showToast(`Entregador ${completeMotoboy.name} cadastrado com sucesso! 🛵`);
  };

  const handleDeleteMotoboy = (motoboyId: string) => {
    deleteMotoboyFromCloud(motoboyId);
    showToast('Entregador removido com sucesso.');
  };

  const handleDeleteAllMotoboys = () => {
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
            isOperator={Boolean(session && (session.role === 'store_admin' || session.role === 'master_admin'))}
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
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-center items-center">
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

  const isStoreAdminOrMaster = session.role === 'store_admin' || session.role === 'master_admin';
  const activeOrdersCount = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length;
  const activeMotoboysCount = motoboys.filter((m) => m.status !== 'offline').length;
  const storeDisplayName = session.storeName || shift.storeName || 'Minha Loja';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col selection:bg-slate-700 selection:text-white">
      {!isOnline && (
        <div className="sticky top-0 z-[100] bg-rose-600 text-white text-center text-xs font-black px-3 py-2 shadow-lg">
          ⚠️ SEM INTERNET — alterações podem não chegar aos outros dispositivos até a conexão voltar.
        </div>
      )}
      {/* Toast Notification */}
      {toastMessage && isStoreAdminOrMaster && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-800/95 border border-slate-700 text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 animate-fadeIn">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Top Header Navigation (Control Panel Bar) */}
      {isStoreAdminOrMaster && (
        <header className="bg-slate-950/90 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md text-white shadow-md">
          <div className="max-w-[1680px] mx-auto px-3 sm:px-5 py-2.5 flex items-center justify-between gap-4">
            
            {/* Left: Brand Identity & Active Store Hierarchy */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-blue-400 font-bold shadow-xs">
                  <Building2 className="w-4 h-4 text-blue-400" />
                </div>
                <div className="leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm text-white tracking-tight">Rota Fácil</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">OS</span>
                  </div>
                </div>
              </div>

              {/* Vertical divider */}
              <div className="h-5 w-px bg-slate-800 hidden sm:block shrink-0" />

              {/* Store & Status Pill */}
              <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1 min-w-0">
                <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-xs font-bold text-slate-100 truncate max-w-[140px] sm:max-w-[200px]">
                  {storeDisplayName}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                    shift.isOpen
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {shift.isOpen ? 'Aberto' : 'Fechado'}
                </span>
              </div>
            </div>

            {/* Center: System Telemetry & Operational State (Hidden on small screens) */}
            <div className="hidden lg:flex items-center gap-3">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-medium text-slate-300">Conectado</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <div className="flex items-center gap-1 bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-800/80">
                  <Package className="w-3 h-3 text-amber-400" />
                  <span className="text-[11px] font-semibold text-slate-200">{activeOrdersCount} {activeOrdersCount === 1 ? 'pedido ativo' : 'pedidos ativos'}</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-800/80">
                  <Bike className="w-3 h-3 text-blue-400" />
                  <span className="text-[11px] font-semibold text-slate-200">{activeMotoboysCount} {activeMotoboysCount === 1 ? 'entregador ativo' : 'entregadores ativos'}</span>
                </div>
              </div>
            </div>

            {/* Right: Actions, Configuration & User Profile */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAccountSettingsOpen(true)}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Configurações da Loja"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden md:inline">Configurações</span>
              </button>

              {/* User Session Chip */}
              <div className="flex items-center gap-1.5 bg-slate-900/90 pl-2 pr-1 py-1 rounded-xl border border-slate-800 text-xs">
                {session.role === 'master_admin' ? (
                  <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                    <Crown className="w-3.5 h-3.5 text-purple-400" />
                    <span className="hidden sm:inline">Master</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <div className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-200">
                      <User className="w-3 h-3 text-slate-400" />
                    </div>
                    <span className="hidden sm:inline max-w-[100px] truncate text-slate-200 font-semibold">
                      {session.username || 'Admin'}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSession(null);
                    showToast('Sessão encerrada.');
                  }}
                  className="ml-1 p-1 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 rounded-lg transition-all text-xs cursor-pointer"
                  title="Sair da conta"
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
        {isStoreAdminOrMaster && (
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
            onSaveIntegrations={(integrations, branches) => {
              const updatedShift = {
                ...shift,
                integrations,
                ...(branches ? { branches } : {}),
              };
              setShift(updatedShift);
              saveShiftToCloud(updatedShift);
              showToast('Integrações salvas! Cardápio Web conectado com sucesso! 🚀🔌');
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
        isOpen={isAccountSettingsOpen || Boolean(shift.setupRequired && isStoreAdminOrMaster)}
        onClose={() => { if (!shift.setupRequired) setIsAccountSettingsOpen(false); }}
        shift={shift}
        onSaveSettings={handleSaveStoreSettings}
        onActivateRealPilot={shift.setupRequired ? undefined : handleActivateRealPilot}
        firstSetup={Boolean(shift.setupRequired)}
      />
    </div>
  );
}
