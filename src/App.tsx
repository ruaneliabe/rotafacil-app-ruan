import React, { useState, useEffect } from 'react';
import { StoreShift, Order, Motoboy, OrderStatus, UserSession } from './types';
import {
  INITIAL_STORE_SHIFT,
  INITIAL_MOTOBOYS,
  INITIAL_ORDERS,
} from './data/initialData';
import { StoreDashboard } from './components/StoreDashboard';
import { MotoboyApp } from './components/MotoboyApp';
import { CustomerTrackingView } from './components/CustomerTrackingView';
import { NewOrderModal } from './components/NewOrderModal';
import { AddMotoboyModal } from './components/AddMotoboyModal';
import { LoginModal } from './components/LoginModal';
import { StoreAccountSettingsModal } from './components/StoreAccountSettingsModal';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import {
  subscribeToOrders,
  subscribeToMotoboys,
  subscribeToShift,
  saveOrderToCloud,
  saveMotoboyToCloud,
  deleteMotoboyFromCloud,
  deleteAllMotoboysFromCloud,
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

const logoImg = '/src/assets/images/hope_burger_logo_1786042748845.jpg';

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
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [motoboys, setMotoboys] = useState<Motoboy[]>(INITIAL_MOTOBOYS);
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

  const handleSaveStoreSettings = (updatedShift: StoreShift) => {
    setShift(updatedShift);
    saveShiftToCloud(updatedShift);
    showToast(`Configurações da loja "${updatedShift.storeName}" salvas com sucesso! 🏢`);
  };

  // 1. Firebase Cloud Sync initialization & snapshot listeners
  useEffect(() => {
    seedInitialDataIfEmpty().then(() => {
      setCloudSynced(true);
    });

    const unsubOrders = subscribeToOrders((cloudOrders) => {
      setOrders(cloudOrders);
    });

    const unsubMotoboys = subscribeToMotoboys((cloudMotoboys) => {
      setMotoboys(cloudMotoboys);
    });

    const unsubShift = subscribeToShift((cloudShift) => {
      if (cloudShift) {
        setShift(cloudShift);
      }
    });

    return () => {
      unsubOrders();
      unsubMotoboys();
      unsubShift();
    };
  }, []);

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
    const targetMotoboy = motoboys.find(
      (m) =>
        m.id === motoboyId ||
        (m.username && m.username.toLowerCase() === motoboyId.toLowerCase()) ||
        m.name.toLowerCase() === motoboyId.toLowerCase()
    );
    if (!targetMotoboy) return;

    const orderObj = orders.find((o) => o.id === orderId);
    if (!orderObj) return;

    const updatedOrder: Order = {
      ...orderObj,
      assignedMotoboyId: targetMotoboy.id,
      assignedMotoboyName: targetMotoboy.name,
      status: orderObj.status === 'in_transit' || orderObj.status === 'picked_up' ? orderObj.status : 'ready_at_counter',
    };

    const updatedMotoboy: Motoboy = {
      ...targetMotoboy,
      activeOrdersCount: targetMotoboy.activeOrdersCount + 1,
      status: targetMotoboy.status === 'delivering' ? 'delivering' : 'available',
    };

    // Update local & cloud
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));
    setMotoboys((prev) => prev.map((m) => (m.id === motoboyId ? updatedMotoboy : m)));
    saveOrderToCloud(updatedOrder);
    saveMotoboyToCloud(updatedMotoboy);

    showToast(`Pedido #${updatedOrder.codeNumber} atribuído a ${targetMotoboy.name}! Lanche marcado como PRONTO no balcão. 🛍️`);
  };

  const handleAssignBatchToMotoboy = (orderIds: string[], motoboyId: string) => {
    const targetMotoboy = motoboys.find(
      (m) =>
        m.id === motoboyId ||
        (m.username && m.username.toLowerCase() === motoboyId.toLowerCase()) ||
        m.name.toLowerCase() === motoboyId.toLowerCase()
    );
    if (!targetMotoboy || orderIds.length === 0) return;

    const updatedOrdersList = orders.map((o) => {
      if (orderIds.includes(o.id)) {
        const updated: Order = {
          ...o,
          assignedMotoboyId: targetMotoboy.id,
          assignedMotoboyName: targetMotoboy.name,
          status: o.status === 'in_transit' || o.status === 'picked_up' ? o.status : 'ready_at_counter',
        };
        saveOrderToCloud(updated);
        return updated;
      }
      return o;
    });

    const updatedMotoboy: Motoboy = {
      ...targetMotoboy,
      activeOrdersCount: targetMotoboy.activeOrdersCount + orderIds.length,
      status: targetMotoboy.status === 'delivering' ? 'delivering' : 'available',
    };

    setOrders(updatedOrdersList);
    setMotoboys((prev) => prev.map((m) => (m.id === motoboyId ? updatedMotoboy : m)));
    saveMotoboyToCloud(updatedMotoboy);

    showToast(`Bag de Rota com ${orderIds.length} pedidos atribuída a ${targetMotoboy.name}! Pronta para retirada no balcão. 🎒🛍️`);
  };

  const handleConfirmArrivalAtStore = (motoboyId: string) => {
    const targetMotoboy = motoboys.find((m) => m.id === motoboyId);
    if (!targetMotoboy) return;

    const updatedMotoboy: Motoboy = {
      ...targetMotoboy,
      activeOrdersCount: 0,
      status: 'available',
    };

    // Coloca o motoboy no final da fila de rodízio
    setMotoboys((prev) => {
      const others = prev.filter((m) => m.id !== motoboyId);
      return [...others, updatedMotoboy];
    });

    saveMotoboyToCloud(updatedMotoboy);
    showToast(`Motoboy ${targetMotoboy.name} chegou à loja e entrou no final da fila de rodízio! 🏁🛵`);
  };

  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

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
    if (status === 'delivered' && targetOrder.assignedMotoboyId) {
      const targetMotoboy = motoboys.find((m) => m.id === targetOrder.assignedMotoboyId);
      if (targetMotoboy) {
        const remainingActiveCount = orders.filter(
          (o) =>
            o.id !== orderId &&
            o.assignedMotoboyId === targetMotoboy.id &&
            o.status !== 'delivered' &&
            o.status !== 'cancelled'
        ).length;

        const isFinishedAll = remainingActiveCount === 0;

        const updatedMotoboy: Motoboy = {
          ...targetMotoboy,
          totalEarnedToday: targetMotoboy.totalEarnedToday + targetMotoboy.perDeliveryFee,
          activeOrdersCount: remainingActiveCount,
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
          showToast(
            `Pedido #${targetOrder.codeNumber} entregue! 🎉 (${remainingActiveCount} ${remainingActiveCount === 1 ? 'restante' : 'restantes'})`
          );
        }
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
    const nextCode = orders.length + 101;
    const newOrd: Order = {
      ...newOrdData,
      id: `ord-${nextCode}`,
      codeNumber: nextCode,
      status: 'ready_at_counter',
      createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      trackingCode: `RF-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    setOrders((prev) => [newOrd, ...prev]);
    saveOrderToCloud(newOrd);
    showToast(`Pedido #${nextCode} criado e salvo na nuvem! 🛵`);
  };

  const handleAddMotoboy = (
    newMotoboyData: Omit<Motoboy, 'id' | 'status' | 'activeOrdersCount' | 'totalEarnedToday'>
  ) => {
    const newM: Motoboy = {
      ...newMotoboyData,
      id: `m-${Date.now()}`,
      status: 'available',
      activeOrdersCount: 0,
      totalEarnedToday: newMotoboyData.fixedFee || 0,
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
      ) || orders[0];

    return (
      <div className="min-h-screen bg-slate-100">
        {matchedOrder ? (
          <CustomerTrackingView
            order={matchedOrder}
            motoboy={motoboys.find((m) => m.id === matchedOrder.assignedMotoboyId)}
            shift={shift}
            onBackToDashboard={() => {
              window.history.pushState({}, '', window.location.pathname);
              setUrlTrackingCode(null);
            }}
          />
        ) : (
          <div className="max-w-md mx-auto p-8 text-center space-y-4 font-sans text-slate-800">
            <h2 className="text-xl font-bold">Rastreio de Pedido</h2>
            <p className="text-sm text-slate-600">
              Carregando dados do pedido <strong>{urlTrackingCode}</strong>...
            </p>
          </div>
        )}
      </div>
    );
  }

  // Standalone Login Screen if not authenticated
  if (!session) {
    return (
      <div className="min-h-screen bg-[#1c0429] text-purple-50 font-sans flex flex-col justify-center items-center p-4">
        {toastMessage && (
          <div className="fixed top-5 right-5 z-50 bg-gradient-to-r from-pink-600 to-purple-800 text-white font-black text-xs px-5 py-3.5 rounded-2xl shadow-2xl border-2 border-yellow-400 flex items-center gap-2 animate-bounce">
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
    <div className="min-h-screen bg-[#1c0429] text-purple-50 font-sans flex flex-col selection:bg-pink-500 selection:text-white">
      {/* Toast Notification - Clean, professional dark badge */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900/95 border border-emerald-500/50 text-slate-100 font-bold text-xs px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 animate-fadeIn">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Top Header Navigation - Store Admin Only */}
      {session.role === 'store_admin' && (
        <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-40 shadow-md text-slate-100">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
            
            {/* Brand & Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-md shadow-emerald-500/20 shrink-0">
                <Building2 className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-white text-base tracking-tight">
                    {shift.storeName || 'Rota Fácil'}
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                    ONLINE 🟢
                  </span>
                </div>
              </div>
            </div>

            {/* Center Info: Live Clock & Store Status */}
            <div className="hidden md:flex items-center gap-2.5 bg-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs font-semibold">
              <span className="text-slate-300">{currentTimeStr || 'Hoje'}</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {shift.storeName || 'Loja Ativa'}
              </span>
            </div>

            {/* User Status & Actions */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsAccountSettingsOpen(true)}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Configurações da Conta e Nome da Loja"
              >
                <Settings className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Configurar Loja</span>
              </button>

              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white">Loja (Admin)</span>
                <button
                  onClick={() => {
                    setSession(null);
                    showToast('Sessão encerrada.');
                  }}
                  className="ml-1 px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                  title="Sair"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 w-full mx-auto ${session.role === 'motoboy' ? 'p-1 sm:p-4 max-w-md' : 'max-w-7xl p-4 md:p-6 space-y-6'}`}>
        {session.role === 'store_admin' && (
          <StoreDashboard
            shift={shift}
            orders={orders}
            motoboys={motoboys}
            onToggleShift={handleToggleShift}
            onAssignOrderToMotoboy={handleAssignOrderToMotoboy}
            onAssignBatchToMotoboy={handleAssignBatchToMotoboy}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onConfirmArrivalAtStore={handleConfirmArrivalAtStore}
            onOpenNewOrderModal={() => setIsNewOrderModalOpen(true)}
            onOpenMotoboyModal={() => setIsMotoboyModalOpen(true)}
            onDeleteMotoboy={handleDeleteMotoboy}
            onDeleteAllMotoboys={handleDeleteAllMotoboys}
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
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onConfirmArrivalAtStore={handleConfirmArrivalAtStore}
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
        nextOrderCode={orders.length + 101}
      />

      <AddMotoboyModal
        isOpen={isMotoboyModalOpen}
        onClose={() => setIsMotoboyModalOpen(false)}
        onAddMotoboy={handleAddMotoboy}
      />

      <StoreAccountSettingsModal
        isOpen={isAccountSettingsOpen}
        onClose={() => setIsAccountSettingsOpen(false)}
        shift={shift}
        onSaveSettings={handleSaveStoreSettings}
      />
    </div>
  );
}
