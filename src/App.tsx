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

    const unsubShift = subscribeToShift((cloudShift) => {
      setShift(cloudShift);
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
  const handleAddOrder = (newOrder: Order) => {
    saveOrderToCloud(newOrder);
    playNewOrderSound();
    showToast(`Pedido #${newOrder.codeNumber} cadastrado com sucesso! 📦`);
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
      status: 'dispatched',
      dispatchedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      routeSequence: (targetMotoboy.activeOrdersCount || 0) + 1,
    };

    saveOrderToCloud(updatedOrder);

    const updatedMotoboy: Motoboy = {
      ...targetMotoboy,
      status: 'delivering',
      activeOrdersCount: (targetMotoboy.activeOrdersCount || 0) + 1,
      joinedQueueAt: undefined,
      callingToCounterAt: undefined,
    };
    saveMotoboyToCloud(updatedMotoboy);

    playDispatchSound();
    showToast(`Pedido #${targetOrder.codeNumber} despachado com ${targetMotoboy.name}! 🚀`);
  };

  const handleAssignBatchToMotoboy = (orderIds: string[], motoboyId: string) => {
    const targetMotoboy = motoboys.find((m) => m.id === motoboyId);
    if (!targetMotoboy || orderIds.length === 0) return;

    const dispatchTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    orderIds.forEach((id, idx) => {
      const order = orders.find((o) => o.id === id);
      if (order) {
        saveOrderToCloud({
          ...order,
          assignedMotoboyId: motoboyId,
          status: 'dispatched',
          dispatchedAt: dispatchTime,
          routeSequence: (targetMotoboy.activeOrdersCount || 0) + idx + 1,
        });
      }
    });

    const updatedMotoboy: Motoboy = {
      ...targetMotoboy,
      status: 'delivering',
      activeOrdersCount: (targetMotoboy.activeOrdersCount || 0) + orderIds.length,
      joinedQueueAt: undefined,
      callingToCounterAt: undefined,
    };
    saveMotoboyToCloud(updatedMotoboy);

    playDispatchSound();
    showToast(`Rota otimizada com ${orderIds.length} pedidos despachada para ${targetMotoboy.name}! 🚀`);
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

  const handleAddMotoboy = (newMotoboy: Motoboy) => {
    saveMotoboyToCloud(newMotoboy);
    showToast(`Entregador ${newMotoboy.name} cadastrado com sucesso! 🛵`);
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

  const isStoreAdminOrMaster = session.role === 'store_admin' || session.role === 'master_admin';

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

      {/* Main Top Header Navigation */}
      {isStoreAdminOrMaster && (
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
                {session.role === 'master_admin' ? (
                  <>
                    <Crown className="w-3.5 h-3.5 text-purple-400" />
                    <span className="font-extrabold text-purple-300 hidden sm:inline">Master (Ruan)</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-medium text-slate-200 hidden sm:inline">
                      {session.storeName || shift.storeName || 'Loja'}
                    </span>
                  </>
                )}
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
