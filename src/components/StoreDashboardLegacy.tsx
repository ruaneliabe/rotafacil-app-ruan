import React, { useState, useEffect } from 'react';
import { Order, Motoboy, StoreShift, OrderStatus, StoreIntegrations, StoreBranch } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  UserCheck,
  Plus,
  Bike,
  MapPin,
  ChevronRight,
  Zap,
  Phone,
  DollarSign,
  ArrowUpRight,
  Filter,
  Check,
  Power,
  Navigation,
  Printer,
  Receipt,
  Share2,
  Copy,
  Package,
  ShoppingBag,
  Building2,
  Trash2,
  Volume2,
  VolumeX,
  BarChart3,
  Webhook,
  X,
  RotateCw,
  Sparkles,
  Map,
  Settings,
  LogOut,
  User,
  Kanban,
} from 'lucide-react';
import { RouteMap } from './RouteMap';
import { RouteModal } from './RouteModal';
import { ThermalTicketModal } from './ThermalTicketModal';
import { MotoboySettlementModal } from './MotoboySettlementModal';
import { DeliveryHistoryModal } from './DeliveryHistoryModal';
import { IntegrationsModal } from './IntegrationsModal';
import { KanbanBoard } from './KanbanBoard';
import OperationDispatchView from './OperationDispatchView';
import { ActionHeroLevel1 } from './ActionHeroLevel1';
import { ManagementHub } from './ManagementHub';
import { getSoundEnabled, setSoundEnabled, playNewOrderSound } from '../utils/soundUtils';
import { PaymentBadge, getPaymentMethodLabel } from '../utils/paymentUtils';
import { calculateDistanceKm, calculateRoadDistanceKm } from '../utils/geoUtils';
import { analyzeOperationalBrain, DispatchRecommendation, OperationalAlert } from '../utils/dispatchBrain';
import { buildSmartRouteBatches } from '../utils/routeCorridorUtils';
import { FleetBottleneckBanner } from './FleetBottleneckBanner';
import { getMotoboyStatusPresentation } from '../utils/motoboyStatusUtils';
import { saveMotoboyLocationToCloud, saveMotoboyToCloud } from '../lib/firebase';
import { getBrazilDateKey, isOrderInCurrentShift } from '../utils/dateUtils';

interface StoreDashboardProps {
  shift: StoreShift;
  orders: Order[];
  motoboys: Motoboy[];
  onToggleShift: () => void;
  onAssignOrderToMotoboy: (orderId: string, motoboyId: string) => void;
  onAssignBatchToMotoboy?: (orderIds: string[], motoboyId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onUpdateMotoboyStatus?: (motoboyId: string, status: Motoboy['status']) => void;
  onReorderMotoboyRoute?: (orderedOrderIds: string[]) => void;
  onConfirmArrivalAtStore?: (motoboyId: string) => void;
  onOpenNewOrderModal: () => void;
  onOpenMotoboyModal: () => void;
  onOpenStoreSettings: () => void;
  onSelectOrderForTracking: (order: Order) => void;
  onDeleteMotoboy?: (motoboyId: string) => void;
  onResetMotoboyPassword?: (motoboyId: string) => void;
  onDeleteAllMotoboys?: () => void;
  onAddOrder?: (newOrder: Omit<Order, 'id' | 'codeNumber' | 'status' | 'createdAt' | 'trackingCode'>) => void;
  onSaveIntegrations?: (integrations: StoreIntegrations, branches?: StoreBranch[]) => void;
  username?: string;
  onLogout?: () => void;
}

export const StoreDashboard: React.FC<StoreDashboardProps> = ({
  shift,
  orders,
  motoboys,
  onToggleShift,
  onAssignOrderToMotoboy,
  onAssignBatchToMotoboy,
  onUpdateOrderStatus,
  onUpdateMotoboyStatus,
  onReorderMotoboyRoute,
  onConfirmArrivalAtStore,
  onOpenNewOrderModal,
  onOpenMotoboyModal,
  onOpenStoreSettings,
  onSelectOrderForTracking,
  onDeleteMotoboy,
  onResetMotoboyPassword,
  onDeleteAllMotoboys,
  onAddOrder,
  onSaveIntegrations,
  username,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'kanban' | 'operacao' | 'mapa' | 'equipe' | 'gestao' | 'financeiro' | 'historico'>('operacao');
  const [selectedMotoboyId, setSelectedMotoboyId] = useState<string | null>(null);
  const [selectedOrderIdOnMap, setSelectedOrderIdOnMap] = useState<string | null>(null);

  // Multi-select for multi-order grouping/bag dispatch
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [orderSort, setOrderSort] = useState<'time' | 'value' | 'neighborhood'>('time');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [isRouteModalOpen, setIsRouteModalOpen] = useState<boolean>(false);
  const [isCompactMode, setIsCompactMode] = useState<boolean>(false);
  const [isAlertsSectionInView, setIsAlertsSectionInView] = useState<boolean>(true);
  const [isSavingsDismissed, setIsSavingsDismissed] = useState<boolean>(false);
  const [showAllOperationalAlerts, setShowAllOperationalAlerts] = useState<boolean>(false);
  const [dismissedProximityGroups, setDismissedProximityGroups] = useState<string[]>([]);
  const [showAllProximityGroups, setShowAllProximityGroups] = useState<boolean>(false);

  useEffect(() => {
    const el = document.getElementById('exceptions-alerts-section');
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsAlertsSectionInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Modal states for Step 4 & 5 & History Report & Sound
  const [ticketOrder, setTicketOrder] = useState<Order | null>(null);
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState(false);
  const [isCalculationInfoOpen, setIsCalculationInfoOpen] = useState(false);
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);

  // 🛎️ 30-Second Counter Call State (Substitui painel de senhas)
  const [callingCounterTimer, setCallingCounterTimer] = useState<{
    motoboyId: string;
    motoboyName: string;
    secondsLeft: number;
  } | null>(null);

  // Countdown timer for calling motoboy to counter
  useEffect(() => {
    if (!callingCounterTimer) return;
    if (callingCounterTimer.secondsLeft <= 0) {
      triggerActionToast(`⏱️ Tempo esgotado (30s) para ${callingCounterTimer.motoboyName.split(' ')[0]} no balcão.`);
      return;
    }
    const timer = setInterval(() => {
      setCallingCounterTimer((prev) =>
        prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : null
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [callingCounterTimer]);

  const handleCallNextMotoboy = () => {
    if (motoboysAvailable.length === 0) {
      triggerActionToast("⚠️ Nenhum motoboy disponível na fila da loja no momento.");
      return;
    }
    const nextMotoboy = motoboysAvailable[0];

    // Check orders currently assigned/linked to nextMotoboy
    const motoboyLinkedOrders = activeOrders.filter(
      (o) =>
        o.assignedMotoboyId === nextMotoboy.id &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled' &&
        o.status !== 'failed'
    );

    // Scenario A: User manually selected checkboxes in the order list
    if (selectedOrderIds.length > 0) {
      if (onAssignBatchToMotoboy) {
        onAssignBatchToMotoboy(selectedOrderIds, nextMotoboy.id);
      } else {
        selectedOrderIds.forEach((id) => onAssignOrderToMotoboy(id, nextMotoboy.id));
      }
      playNewOrderSound();
      saveMotoboyToCloud({ ...nextMotoboy, callingToCounterAt: Date.now() });
      setCallingCounterTimer({
        motoboyId: nextMotoboy.id,
        motoboyName: nextMotoboy.name,
        secondsLeft: 30,
      });
      triggerActionToast(
        `🚀 ${selectedOrderIds.length} ${selectedOrderIds.length === 1 ? 'pedido selecionado vinculado' : 'pedidos selecionados vinculados'} a ${nextMotoboy.name.split(' ')[0]} e chamado ao balcão!`
      );
      setSelectedOrderIds([]);
      return;
    }

    // Scenario B: Motoboy already has orders linked to them
    if (motoboyLinkedOrders.length > 0) {
      playNewOrderSound();
      saveMotoboyToCloud({ ...nextMotoboy, callingToCounterAt: Date.now() });
      setCallingCounterTimer({
        motoboyId: nextMotoboy.id,
        motoboyName: nextMotoboy.name,
        secondsLeft: 30,
      });
      triggerActionToast(
        `🛎️ Chamando ${nextMotoboy.name.split(' ')[0]} no balcão com ${motoboyLinkedOrders.length} ${motoboyLinkedOrders.length === 1 ? 'pedido vinculado' : 'pedidos vinculados'}!`
      );
      return;
    }

    // Scenario C: No orders linked and no checkboxes selected
    triggerActionToast(
      `⚠️ O motoboy ${nextMotoboy.name.split(' ')[0]} não possui pedidos vinculados! Vincule os pedidos ao motoboy (ou selecione na lista) antes de despachar.`
    );
  };

  const handleSimulateIncomingOrder = (channel: 'ifood' | 'cardapio_web' | 'pdv' | 'whatsapp') => {
    if (!onAddOrder) return;

    const baseLat = shift.storeLat || -26.91530418395996;
    const baseLng = shift.storeLng || -49.1146354675293;

    let clientName = 'Cliente iFood';
    let address = 'Rua XV de Novembro, 1200';
    let neighborhood = 'Centro';
    let itemsSummary = '2x X-Burguer Especial, 1x Batata Frita';
    let total = 58.00;
    let orderLat = -26.9189;
    let orderLng = -49.0660;

    if (channel === 'ifood') {
      clientName = 'Rodrigo (iFood #4829)';
      address = 'Av. Brasil, 450 - Ap 201';
      neighborhood = 'Victor Konder';
      itemsSummary = '1x Combo Smash Bacon, 1x Milkshake Chocolate';
      total = 64.90;
      orderLat = -26.9090;
      orderLng = -49.0710;
    } else if (channel === 'cardapio_web') {
      clientName = 'Camila Ribeiro (Cardápio Web)';
      address = 'Rua 7 de Setembro, 1820';
      neighborhood = 'Centro';
      itemsSummary = '2x Pizza Artesanal Marguerita 35cm';
      total = 89.00;
      orderLat = -26.9180;
      orderLng = -49.0670;
    } else if (channel === 'pdv') {
      clientName = 'Balcão / Caixa PDV';
      address = 'Rua São Paulo, 310';
      neighborhood = 'Itoupava Seca';
      itemsSummary = '3x Beirute de Filé Mignon';
      total = 105.00;
      orderLat = -26.8970;
      orderLng = -49.0830;
    } else {
      clientName = 'Juliana Martins (WhatsApp Bot)';
      address = 'Rua Joinville, 520';
      neighborhood = 'Vila Nova';
      itemsSummary = '1x X-Salada Duplo, 1x Guaraná 2L';
      total = 42.50;
      orderLat = -26.9067;
      orderLng = -49.0785;
    }

    onAddOrder({
      clientName,
      clientPhone: '47998811223',
      address,
      neighborhood,
      lat: orderLat,
      lng: orderLng,
      itemsSummary,
      total,
      deliveryFee: 8.00,
      paymentMethod: 'pix',
      estimatedMinutes: 25,
      assignedMotoboyId: null,
      assignedMotoboyName: null,
      originChannel: channel,
      kitchenReadyInMin: 0,
    });

    triggerActionToast(`⚡ Novo Pedido Sincronizado do ${channel.toUpperCase()}! Entrou na fila de despacho.`);
  };
  const [soundActive, setSoundActive] = useState(() => getSoundEnabled());
  const [actionToast, setActionToast] = useState<string | null>(null);

  const triggerActionToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3500);
  };

  const [mapFilter, setMapFilter] = useState<'all' | 'returning' | 'orders'>('all');
  const [isSyncBannerCollapsed, setIsSyncBannerCollapsed] = useState(true);
  const [isSyncingCw, setIsSyncingCw] = useState(false);

  // Sincronização em tempo real com o Cardápio Web (remove despachados/entregues)
  const handleSyncCardapioWeb = async (showFeedback = true) => {
    try {
      setIsSyncingCw(true);
      const res = await fetch('/api/cardapio-web/sync');
      if (res.ok) {
        const data = await res.json();
        if (showFeedback && data.totalUpdated > 0) {
          triggerActionToast(`🔄 Cardápio Web: ${data.totalUpdated} pedido(s) sincronizado(s) com sucesso!`);
        } else if (showFeedback) {
          triggerActionToast('✓ Sincronizado com Cardápio Web: Todos os pedidos estão em dia.');
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar com Cardápio Web:', err);
    } finally {
      setIsSyncingCw(false);
    }
  };

  // Auto-sync a cada 15 segundos para manter o mapa e balcão 100% sincronizados com o Cardápio Web
  useEffect(() => {
    handleSyncCardapioWeb(false);
    const interval = setInterval(() => {
      handleSyncCardapioWeb(false);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Helper para exibir o código diferenciado (ex: HB-50 vs HP-50) sem alterar a documentação real do pedido (codeNumber)
  const getOrderDisplayCode = (ord: Order) => {
    if (ord.displayCode) return ord.displayCode;
    const isBurger = ord.storeBranch === 'hope_burger' || ord.storeName?.toLowerCase().includes('burger');
    const isPizza = ord.storeBranch === 'hope_pizza' || ord.storeName?.toLowerCase().includes('pizz');
    if (isBurger) return `HB-${ord.codeNumber}`;
    if (isPizza) return `HP-${ord.codeNumber}`;
    return `#${ord.codeNumber}`;
  };

  const isTakeoutOrder = (o: Order) => {
    const addr = (o.address || '').toLowerCase();
    const neigh = (o.neighborhood || '').toLowerCase();
    return addr.includes('retirada') || addr.includes('balcão') || addr.includes('takeout') || neigh.includes('balcão') || (o as any).order_type === 'takeout';
  };

  const todayDateKey = getBrazilDateKey();

  // Pedidos ativos de entrega da operação atual.
  // Pedido MANUAL pendente criado hoje precisa continuar visível mesmo com a operação fechada.
  // Isso evita o caso em que o pedido é salvo no Firestore, entra na sugestão de rota,
  // mas some das colunas/contadores por não existir um turno aberto no momento do cadastro.
  const activeOrders = orders.filter((o) => {
    if (o.status === 'delivered' || o.status === 'cancelled' || o.status === 'failed') return false;
    if (isTakeoutOrder(o)) return false;

    const isManualPendingToday =
      o.originChannel === 'manual' &&
      o.createdDate === todayDateKey &&
      (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready_at_counter');

    if (isManualPendingToday) return true;
    if (!shift.isOpen) return false;
    if (!isOrderInCurrentShift(o, shift)) return false;
    return true;
  });
  const activeIntegrationsCount = [shift.integrations?.ifood, shift.integrations?.cardapioWeb]
    .filter((item) => item?.enabled).length;
  const hasStoreAddress = Boolean(shift.storeAddress?.trim());
  const onboardingSteps = [
    { label: 'Configurar dados da loja', done: hasStoreAddress },
    { label: 'Cadastrar primeiro motoboy', done: motoboys.length > 0 },
    { label: 'Abrir a operação', done: shift.isOpen },
    { label: 'Lançar primeiro pedido', done: orders.length > 0 },
  ];
  const completedOnboardingSteps = onboardingSteps.filter((step) => step.done).length;
  const showOnboarding = completedOnboardingSteps < onboardingSteps.length;
  const nextOnboardingStepIndex = onboardingSteps.findIndex((step) => !step.done);
  const readyAtCounter = activeOrders.filter((o) => o.status === 'ready_at_counter');
  // Pedidos aguardando despacho (exclui os que já foram despachados pelo Cardápio Web ou estão em trânsito)
  const unassignedOrders = activeOrders.filter(
    (o) => !o.assignedMotoboyId && (o.status === 'pending' || o.status === 'ready_at_counter')
  );

  // Pedidos e faturamento vinculados estritamente ao turno operacional ativo
  // Quando a loja estiver fechada, o faturamento do turno ativo permanece zerado (R$ 0,00)
  const currentShiftOrders = shift.isOpen
    ? orders.filter((o) => isOrderInCurrentShift(o, shift) && o.status !== 'cancelled' && o.status !== 'failed')
    : [];

  const deliveredToday = currentShiftOrders.filter((o) => o.status === 'delivered');
  const todayOrders = currentShiftOrders;
  const inProgressToday = currentShiftOrders.filter((o) => o.status !== 'delivered').length;
  const totalRevenue = currentShiftOrders.reduce((acc, o) => acc + (o.total || 0), 0);
  const getMotoboyLoad = (motoboyId: string) => activeOrders.filter((o) => o.assignedMotoboyId === motoboyId).length;
  const motoboysAvailable = motoboys
    .filter((m) => m.status === 'available')
    .sort((a, b) => {
      const loadDiff = getMotoboyLoad(a.id) - getMotoboyLoad(b.id);
      if (loadDiff !== 0) return loadDiff;
      return (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0);
    });
  const queueWaitSamples = motoboysAvailable
    .filter((motoboy) => Boolean(motoboy.joinedQueueAt))
    .map((motoboy) => Math.max(0, (Date.now() - Number(motoboy.joinedQueueAt)) / 60000));
  const averageQueueWaitMinutes = queueWaitSamples.length > 0
    ? queueWaitSamples.reduce((sum, minutes) => sum + minutes, 0) / queueWaitSamples.length
    : null;

  const assignOrderRespectingLoad = (orderId: string, motoboyId: string) => {
    const target = motoboys.find((m) => m.id === motoboyId);
    if (!target) return;
    const currentLoad = getMotoboyLoad(target.id);
    const nextFree = motoboysAvailable.find((m) => getMotoboyLoad(m.id) === 0 && m.id !== target.id);
    if (currentLoad > 0) {
      const suggestion = nextFree ? ` O próximo livre da fila é ${nextFree.name.split(' ')[0]}.` : '';
      const ok = window.confirm(`${target.name.split(' ')[0]} já possui ${currentLoad} ${currentLoad === 1 ? 'pedido vinculado' : 'pedidos vinculados'}.${suggestion} Deseja adicionar mais este pedido mesmo assim?`);
      if (!ok) return;
    }
    onAssignOrderToMotoboy(orderId, motoboyId);
  };

  // Calculate Motoboys returning to store (~5 min / <= 4.2 km road distance away without active orders, or explicitly 'returning_to_store')
  const returningMotoboysWithDistance = motoboys.map((m) => {
    const mActiveOrders = orders.filter(
      (o) => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'failed' && o.assignedMotoboyId === m.id
    );
    let distKm = 0;
    if (m.currentLat && m.currentLng && shift.storeLat && shift.storeLng) {
      distKm = calculateRoadDistanceKm(m.currentLat, m.currentLng, shift.storeLat, shift.storeLng);
    }
    const isReturning = m.status === 'returning_to_store';
    const estMin = Math.max(1, Math.round((distKm / 28) * 60) || 5);

    return {
      ...m,
      isReturning,
      distKm,
      estMin,
    };
  }).filter((m) => m.isReturning);

  const returningMotoboys = motoboys.filter((m) => m.status === 'returning_to_store');
  const availableMotoboys = motoboys.filter((m) => m.status === 'available');

  // 🧠 Operational AI Brain Analysis
  const brainAnalysis = analyzeOperationalBrain(orders, motoboys, shift);
  const operationalProblemAlerts = brainAnalysis.alerts.filter((alert) => alert.type !== 'savings' && alert.severity !== 'info');

  const inTransitOrders = activeOrders.filter((o) => o.status === 'in_transit');

  const handleCallCounter = (motoboyId: string, motoboyName: string) => {
    triggerActionToast(`🛎️ Chamando entregador ${motoboyName.split(' ')[0]} no balcão!`);
    if (getSoundEnabled()) {
      playNewOrderSound();
    }
  };

  const delayedOrders = unassignedOrders.filter((o) => {
    const elapsedMinutes = Math.floor((Date.now() - o.createdAt) / 60000);
    return elapsedMinutes >= 20;
  });

  const handleApplyBrainRecommendation = (rec: DispatchRecommendation) => {
    const targetDriver = motoboys.find((m) => m.id === rec.motoboyId);
    if (targetDriver && targetDriver.status === 'returning_to_store') {
      triggerActionToast(
        `📦 Lote pré-organizado para ${rec.motoboyName} (${rec.orderIds.length} pedidos)! Entregador ainda a caminho da loja (~${rec.motoboyEtaMin || 5} min). Não despache antes do motoboy pisar no pátio.`
      );
    } else {
      triggerActionToast(
        `⚡ Despacho Recomendado Aplicado! ${rec.orderIds.length} pedidos vinculados a ${rec.motoboyName}.`
      );
    }

    if (onAssignBatchToMotoboy) {
      onAssignBatchToMotoboy(rec.orderIds, rec.motoboyId);
    } else {
      rec.orderIds.forEach((id) => onAssignOrderToMotoboy(id, rec.motoboyId));
    }
  };

  const renderChannelBadge = (channel?: string) => {
    switch (channel) {
      case 'ifood':
        return (
          <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs">
            🔴 iFood
          </span>
        );
      case 'cardapio_web':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs">
            🌐 Cardápio
          </span>
        );
      case 'pdv':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs">
            💻 PDV
          </span>
        );
      case 'manual':
        return (
          <span className="inline-flex items-center gap-1 bg-slate-700/80 text-slate-300 border border-slate-600 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs">
            📞 Manual
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs">
            💬 WhatsApp
          </span>
        );
    }
  };

  const formattedCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleNotifyMotoboyInApp = (m: Motoboy) => {
    const mOrders = orders.filter((o) => o.assignedMotoboyId === m.id && o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'failed');
    if (mOrders.length === 0) return;

    mOrders.forEach((ord) => {
      if (ord.status !== 'ready_at_counter' && ord.status !== 'picked_up' && ord.status !== 'in_transit') {
        onUpdateOrderStatus(ord.id, 'ready_at_counter');
      }
    });

    triggerActionToast(`🔔 Aviso de retirada enviado ao App do entregador ${m.name.split(' ')[0]}!`);
  };

  const handleSendWhatsAppToMotoboy = (m: Motoboy) => {
    const mOrders = orders.filter((o) => o.assignedMotoboyId === m.id && o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'failed');
    if (mOrders.length === 0) return;

    const cleanedPhone = (m.phone || '').replace(/\D/g, '');
    let msg = `🛵 *ROTA FÁCIL - PEDIDO(S) PRONTO(S) PARA RETIRADA!*\n\n`;
    msg += `Olá *${m.name}*!\n`;
    msg += `A loja *${shift.storeName}* atribuiu *${mOrders.length}* pedido(s) a você PRONTO(S) no balcão para retirar:\n\n`;

    mOrders.forEach((ord, i) => {
      msg += `📦 *${i + 1}. Pedido ${getOrderDisplayCode(ord)}* (${ord.clientName})\n`;
      msg += `📍 Endereço: ${ord.address} - ${ord.neighborhood}\n`;
      msg += `💵 Cobrar: ${formattedCurrency(ord.total)} (${getPaymentMethodLabel(ord.paymentMethod)})\n`;
      if (ord.clientPhone) msg += `📞 Cliente: ${ord.clientPhone}\n`;
      msg += `\n`;
    });

    const url = cleanedPhone
      ? `https://wa.me/55${cleanedPhone}?text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
  };

  return (
    <div className="flex min-h-screen bg-[#FAF9F6] text-slate-900 -m-3 md:-m-4">

      {/* SIDEBAR — identidade, status da loja e navegação principal */}
      <aside className="hidden md:flex md:w-56 shrink-0 flex-col justify-between bg-[#FAF9F6] border-r border-[#E5E3DC] p-4 sticky top-0 h-screen">
        <div>
          <div className="mb-5">
            <div className="text-[15px] font-semibold text-slate-900 tracking-tight">Rota Fácil</div>
            <div className="text-xs text-slate-500 truncate mt-0.5">{shift.storeName || 'Minha loja'}</div>
          </div>

          <nav className="space-y-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('operacao')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                activeTab === 'operacao'
                  ? 'bg-violet-50 text-violet-900 font-medium border-l-2 border-violet-600'
                  : 'text-slate-600 hover:bg-slate-100 border-l-2 border-transparent'
              }`}
            >
              <Package className={`w-4 h-4 ${activeTab === 'operacao' ? 'text-violet-700' : 'text-slate-400'}`} />
              <span className="flex-1 text-left">Pedidos e despacho</span>
              {unassignedOrders.length > 0 && (
                <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-full px-1.5 py-0.5">
                  {unassignedOrders.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('kanban')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                activeTab === 'kanban'
                  ? 'bg-violet-50 text-violet-900 font-medium border-l-2 border-violet-600'
                  : 'text-slate-600 hover:bg-slate-100 border-l-2 border-transparent'
              }`}
            >
              <Kanban className={`w-4 h-4 ${activeTab === 'kanban' ? 'text-violet-700' : 'text-slate-400'}`} />
              <span className="flex-1 text-left">Kanban</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('equipe')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                activeTab === 'equipe'
                  ? 'bg-violet-50 text-violet-900 font-medium border-l-2 border-violet-600'
                  : 'text-slate-600 hover:bg-slate-100 border-l-2 border-transparent'
              }`}
            >
              <Bike className={`w-4 h-4 ${activeTab === 'equipe' ? 'text-violet-700' : 'text-slate-400'}`} />
              <span className="flex-1 text-left">Entregadores</span>
              <span className="text-[10px] text-slate-400">{motoboysAvailable.length}/{motoboys.filter((m) => m.status !== 'offline').length}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('financeiro')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                activeTab === 'gestao' || activeTab === 'financeiro'
                  ? 'bg-violet-50 text-violet-900 font-medium border-l-2 border-violet-600'
                  : 'text-slate-600 hover:bg-slate-100 border-l-2 border-transparent'
              }`}
            >
              <DollarSign className={`w-4 h-4 ${activeTab === 'gestao' || activeTab === 'financeiro' ? 'text-violet-700' : 'text-slate-400'}`} />
              <span className="flex-1 text-left">Financeiro</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('gestao')}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors text-slate-600 hover:bg-slate-100 border-l-2 border-transparent"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span className="flex-1 text-left">Gestão e fechamento</span>
            </button>
          </nav>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onToggleShift}
            className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${shift.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {shift.isOpen ? 'Loja aberta · encerrar' : 'Loja fechada · abrir'}
          </button>
          <button
            type="button"
            onClick={onOpenStoreSettings}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] text-slate-600 hover:bg-slate-100"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            Configurações
          </button>
          <div className="flex items-center justify-between px-2.5 pt-2 border-t border-[#E5E3DC]">
            <span className="flex items-center gap-1.5 text-xs text-slate-600">
              <User className="w-3.5 h-3.5 text-slate-400" />
              {username || 'Admin'}
            </span>
            {onLogout && (
              <button type="button" onClick={onLogout} title="Sair" className="text-slate-400 hover:text-rose-600">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* CONTEÚDO */}
      <div className="flex-1 min-w-0 p-3 md:p-4 space-y-4">
      {/* Real-time Store Action Toast */}
      {actionToast && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-violet-200 text-slate-900 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 animate-slideDown">
          <span className="text-violet-500 font-bold text-base">🔔</span>
          <span className="text-xs font-medium text-slate-700">{actionToast}</span>
        </div>
      )}

      {/* Filtro de marca (múltiplas bandeiras na mesma loja) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center bg-white p-1 rounded-lg border border-[#E5E3DC] gap-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setStoreFilter('all')}
            className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
              storeFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Todas ({activeOrders.length})
          </button>
          {(shift.branches || [
            { id: 'hope_burger', name: 'Hope Burger', icon: '🍔', tag: 'HB' },
            { id: 'hope_pizza', name: 'Hope Pizza', icon: '🍕', tag: 'HP' },
          ]).map((branch) => {
            const isSel = storeFilter === branch.id;
            const count = activeOrders.filter((o) => {
              if (o.storeBranch === branch.id) return true;
              if (o.storeId === branch.id) return true;
              if (branch.id === 'hope_burger' && (o.storeBranch === 'hope_burger' || o.storeName?.toLowerCase().includes('burger'))) return true;
              if (branch.id === 'hope_pizza' && (o.storeBranch === 'hope_pizza' || o.storeName?.toLowerCase().includes('pizz') || o.storeName?.toLowerCase().includes('pizza'))) return true;
              return false;
            }).length;

            return (
              <button
                key={branch.id}
                type="button"
                onClick={() => setStoreFilter(branch.id)}
                className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 cursor-pointer ${
                  isSel ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{branch.icon || '🏪'}</span>
                <span>{branch.name}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-semibold ${isSel ? 'bg-white text-violet-800' : 'bg-slate-100 text-slate-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="px-2 py-1 rounded text-[11px] font-medium bg-white border border-[#E5E3DC] text-slate-500 hidden md:inline-flex items-center gap-1"
            title="Status do Cardápio Web"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${shift.cardapioWebStatus?.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            CW: {shift.cardapioWebStatus?.isOpen ? 'Aberto' : 'Fechado'}
          </span>

          <button
            type="button"
            onClick={() => handleSyncCardapioWeb(true)}
            disabled={isSyncingCw}
            className="p-1.5 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-lg transition-all border border-[#E5E3DC] cursor-pointer"
            title="Sincronizar com Cardápio Web"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSyncingCw ? 'animate-spin text-violet-500' : ''}`} />
          </button>

          {brainAnalysis.recommendations[0] && (
            <button
              type="button"
              onClick={() => handleApplyBrainRecommendation(brainAnalysis.recommendations[0])}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              title="Despachar a rota sugerida pelo sistema"
            >
              <span>Despachar ({brainAnalysis.recommendations[0].orders.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenNewOrderModal}
            disabled={Boolean(shift.pilotMode && activeOrders.length >= 5)}
            className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo pedido</span>
          </button>
        </div>
      </div>

      {/* 2. AVISOS DIRETOS (SEM POLUIÇÃO DE DASHBOARD) */}
      {(brainAnalysis.recommendations[0] || (motoboysAvailable.length === 0 && unassignedOrders.length > 0) || delayedOrders.length > 0) && (
        <div className="space-y-1.5">
          {/* Rota sugerida direta */}
          {brainAnalysis.recommendations[0] && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-emerald-700 font-semibold">Rota sugerida:</span>
                <span>
                  Enviar <strong>{brainAnalysis.recommendations[0].motoboyName}</strong> com{' '}
                  {brainAnalysis.recommendations[0].orders.map((o) => `#${o.codeNumber}`).join(', ')}{' '}
                  ({brainAnalysis.recommendations[0].corridorLabel || brainAnalysis.recommendations[0].neighborhoodSummary}) • ~{brainAnalysis.recommendations[0].estimatedTripMin} min
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleApplyBrainRecommendation(brainAnalysis.recommendations[0])}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg cursor-pointer shrink-0"
              >
                Despachar rota
              </button>
            </div>
          )}

          {/* Aguardando motoboy */}
          {motoboysAvailable.length === 0 && unassignedOrders.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3.5 py-1.5 rounded-xl text-xs flex items-center justify-between gap-2">
              <span>
                <strong>Aguardando motoboy:</strong> {unassignedOrders.length} {unassignedOrders.length === 1 ? 'pedido pronto' : 'pedidos prontos'} no balcão • Entregador retorna em breve
              </span>
            </div>
          )}

          {/* Pedidos com atraso */}
          {delayedOrders.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-1.5 rounded-xl text-xs flex items-center justify-between gap-2">
              <span>
                <strong>{delayedOrders.length} {delayedOrders.length === 1 ? 'pedido atrasado' : 'pedidos atrasados'}</strong> (+20 min esperando) • Priorize estes despachos
              </span>
              <button
                type="button"
                onClick={() => setSelectedOrderIds(delayedOrders.map((o) => o.id))}
                className="text-xs text-rose-700 hover:text-rose-900 underline cursor-pointer"
              >
                Selecionar atrasados
              </button>
            </div>
          )}
        </div>
      )}

      {/* 🛎️ ACTIVE 30-SECOND COUNTER CALL BANNER (Substitui painel de senhas) */}
      {callingCounterTimer && (
        <div className="bg-amber-400 text-slate-950 p-3.5 px-5 rounded-2xl border-2 border-amber-500 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-bounce">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-black text-xl shrink-0 shadow-md">
              🛎️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-slate-950 uppercase tracking-tight">
                  Chamando {callingCounterTimer.motoboyName} no Balcão!
                </h3>
                <span className="px-2 py-0.5 bg-slate-950 text-amber-400 font-black text-xs rounded-lg font-mono">
                  ⏱️ {callingCounterTimer.secondsLeft}s
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                O aplicativo do entregador está apitando e vibrando para ele se dirigir ao balcão.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setCallingCounterTimer(null);
                triggerActionToast(`✅ Presença de ${callingCounterTimer.motoboyName.split(' ')[0]} confirmada no balcão!`);
              }}
              className="flex-1 sm:flex-none py-2 px-4 bg-slate-950 hover:bg-slate-900 active:scale-95 text-amber-300 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer border border-slate-800"
            >
              🟢 Confirmar no Balcão
            </button>
            <button
              type="button"
              onClick={() => {
                setCallingCounterTimer(null);
                handleCallNextMotoboy();
              }}
              className="py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer border border-amber-600"
              title="Pular e chamar o próximo motoboy da fila"
            >
              ⏭️ Próximo
            </button>
          </div>
        </div>
      )}

      {activeTab === 'operacao' && (
        <OperationDispatchView
          orders={orders}
          motoboys={motoboys}
          shift={shift}
          activeOrders={activeOrders}
          unassignedOrders={unassignedOrders}
          motoboysAvailable={motoboysAvailable}
          selectedOrderIds={selectedOrderIds}
          setSelectedOrderIds={setSelectedOrderIds}
          selectedMotoboyId={selectedMotoboyId}
          setSelectedMotoboyId={setSelectedMotoboyId}
          onAssignOrderToMotoboy={onAssignOrderToMotoboy}
          onAssignBatchToMotoboy={onAssignBatchToMotoboy}
          onUpdateOrderStatus={onUpdateOrderStatus}
          onUpdateMotoboyStatus={onUpdateMotoboyStatus}
          onOpenNewOrderModal={onOpenNewOrderModal}
          onOpenMotoboyModal={onOpenMotoboyModal}
          onSelectOrderForTracking={onSelectOrderForTracking}
          setIsRouteModalOpen={setIsRouteModalOpen}
          setTicketOrder={setTicketOrder}
          setIsTicketOpen={setIsTicketOpen}
          handleCallCounter={handleCallCounter}
          triggerActionToast={triggerActionToast}
          setActiveTab={setActiveTab}
          getMotoboyLoad={getMotoboyLoad}
          assignOrderRespectingLoad={assignOrderRespectingLoad}
        />
      )}

      {/* KANBAN BOARD TAB */}
      {activeTab === 'kanban' && (
        <KanbanBoard
          orders={orders}
          motoboys={motoboys}
          shift={shift}
          storeFilter={storeFilter as any}
          onSetStoreFilter={(filter) => setStoreFilter(filter)}
          onUpdateOrderStatus={onUpdateOrderStatus}
          onAssignOrderToMotoboy={onAssignOrderToMotoboy}
          onAssignBatchToMotoboy={onAssignBatchToMotoboy}
          onSelectOrderForTracking={onSelectOrderForTracking}
          onOpenThermalTicket={(order) => {
            setTicketOrder(order);
            setIsTicketOpen(true);
          }}
          onOpenNewOrderModal={onOpenNewOrderModal}
        />
      )}

      {/* 🗺️ DEDICATED LIVE MAP TAB */}
      {activeTab === 'mapa' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
            <div>
              <h3 className="font-black text-lg text-white tracking-tight flex items-center gap-2">
                <Map className="w-5 h-5 text-blue-400" />
                <span>Mapa ao Vivo da Frota em Blumenau</span>
              </h3>
              <p className="text-xs text-slate-400">
                Acompanhe a localização em tempo real dos entregadores, rotas ativas e paradas de entrega.
              </p>
            </div>

            {/* Motoboy Filter Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedMotoboyId || ''}
                onChange={(e) => setSelectedMotoboyId(e.target.value || null)}
                className="bg-slate-800 text-slate-100 border border-slate-700 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
              >
                <option value="">🌐 Toda a Frota ({motoboys.filter((m) => m.status !== 'offline').length} ativos)</option>
                {motoboys
                  .filter((m) => m.status !== 'offline')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      🛵 {m.name} ({m.status === 'delivering' ? 'Em rota' : m.status === 'returning_to_store' ? 'Voltando' : 'No pátio'})
                    </option>
                  ))}
              </select>

              {selectedMotoboyId && (
                <button
                  type="button"
                  onClick={() => setSelectedMotoboyId(null)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
                >
                  Ver Todos
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 h-[600px] w-full relative">
            <RouteMap
              origin={{
                name: shift.storeName || 'Hope Burger & Pizza',
                address: shift.storeAddress || '',
                lat: shift.storeLat || -26.9194,
                lng: shift.storeLng || -49.0661,
              }}
              selectedMotoboyId={selectedMotoboyId}
              onSelectMotoboy={(id) => setSelectedMotoboyId(id)}
              selectedStopId={selectedOrderIdOnMap}
              onSelectStop={(stop) => setSelectedOrderIdOnMap(stop.id)}
              motoboysList={
                selectedMotoboyId
                  ? motoboys.filter((m) => m.id === selectedMotoboyId)
                  : motoboys.filter((m) => m.status !== 'offline')
              }
              stops={
                selectedOrderIdOnMap
                  ? orders
                      .filter((ord) => ord.id === selectedOrderIdOnMap && typeof ord.lat === 'number' && typeof ord.lng === 'number')
                      .map((ord, idx) => ({
                        id: ord.id,
                        codeNumber: ord.codeNumber,
                        orderIndex: idx + 1,
                        title: `${getOrderDisplayCode(ord)} - ${ord.clientName}`,
                        address: ord.address,
                        neighborhood: ord.neighborhood,
                        lat: ord.lat,
                        lng: ord.lng,
                        status: ord.status === 'delivered' ? 'delivered' : ord.status === 'in_transit' ? 'in_transit' : 'pending',
                        priority: 'high',
                        recipientName: ord.clientName,
                        phone: ord.clientPhone,
                        valueToReceive: ord.total,
                        motoboyId: ord.assignedMotoboyId || undefined,
                        motoboyName: ord.assignedMotoboyName || undefined,
                      }))
                  : orders
                      .filter((ord) => {
                        if (ord.address?.toLowerCase().includes('retirada') || ord.neighborhood?.toLowerCase() === 'balcão') return false;
                        if (ord.status === 'delivered' || ord.status === 'cancelled') return false;
                        if (typeof ord.lat !== 'number' || typeof ord.lng !== 'number') return false;
                        if (!selectedMotoboyId) return true;
                        return ord.assignedMotoboyId === selectedMotoboyId;
                      })
                      .map((ord, idx) => ({
                        id: ord.id,
                        codeNumber: ord.codeNumber,
                        orderIndex: idx + 1,
                        title: `${getOrderDisplayCode(ord)} - ${ord.clientName}`,
                        address: ord.address,
                        neighborhood: ord.neighborhood,
                        lat: ord.lat,
                        lng: ord.lng,
                        status: ord.status === 'delivered' ? 'delivered' : ord.status === 'in_transit' ? 'in_transit' : 'pending',
                        priority: 'medium',
                        recipientName: ord.clientName,
                        phone: ord.clientPhone,
                        valueToReceive: ord.total,
                        motoboyId: ord.assignedMotoboyId || undefined,
                        motoboyName: ord.assignedMotoboyName || undefined,
                      }))
              }
            />
          </div>
        </div>
      )}

      {/* TEAM TAB */}
      {activeTab === 'equipe' && (
        <div className="bg-slate-100 rounded-2xl border border-slate-200/80 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-lg text-slate-900">Gestão da Equipe de Motoboys</h3>
              <p className="text-xs text-slate-500">Cadastre, edite e controle os entregadores da loja.</p>
            </div>
            <div className="flex items-center gap-2">
              {motoboys.length > 0 && onDeleteAllMotoboys && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('DESEJA REMOVER TODOS MOTOBOY? Esta ação apagará todos os entregadores do sistema.')) {
                      onDeleteAllMotoboys();
                    }
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-50 text-rose-700 font-bold text-xs rounded-xl border border-rose-800/60 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Remover todos os motoboys para cadastrar do zero"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Remover Todos ({motoboys.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenMotoboyModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" /> Cadastrar Novo Motoboy
              </button>
            </div>
          </div>

          {motoboys.length === 0 ? (
            <div className="bg-white/60 border border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 border border-slate-200 text-slate-600 rounded-full flex items-center justify-center mx-auto text-xl">
                🛵
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Nenhum motoboy cadastrado</h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Cadastre a equipe antes de abrir a operação para conseguir vincular e despachar pedidos.
              </p>
              <button type="button" onClick={onOpenMotoboyModal} className="mx-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Cadastrar primeiro motoboy
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {motoboys.map((m) => {
                const statusPresentation = getMotoboyStatusPresentation(m.status);
                return (
                <div key={m.id} className="p-4 rounded-2xl border border-slate-200 bg-white/70 space-y-3 relative group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 flex items-center justify-center font-bold text-base shrink-0">
                        🛵
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-sm text-slate-900">{m.name}</h4>
                          {/* Queue & Operational Status Tag */}
                          {(() => {
                            if (m.status === 'available') {
                              const queueIdx = motoboysAvailable.findIndex((x) => x.id === m.id) + 1;
                              return (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase ${statusPresentation.badgeClass}`}>
                                  🟢 {queueIdx > 0 ? `${queueIdx}º da Fila` : 'Fila de Espera'}
                                </span>
                              );
                            }
                            if (m.status === 'returning_to_store') {
                              return (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase ${statusPresentation.badgeClass}`}>
                                  🟠 Voltando à Loja
                                </span>
                              );
                            }
                            if (m.status === 'delivering') {
                              return (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase ${statusPresentation.badgeClass}`}>
                                  🔵 Em Rota ({m.activeOrdersCount || 1} pedido{m.activeOrdersCount > 1 ? 's' : ''})
                                </span>
                              );
                            }
                            if (m.status === 'busy') {
                              return (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase ${statusPresentation.badgeClass}`}>
                                  ⏸️ Pausado
                                </span>
                              );
                            }
                            return (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase ${statusPresentation.badgeClass}`}>
                                🔴 Expediente encerrado
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{m.vehicleModel} • {m.plate}</p>
                      </div>
                    </div>

                    {onDeleteMotoboy && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Tem certeza que deseja excluir o motoboy ${m.name}?`)) {
                            onDeleteMotoboy(m.id);
                          }
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        title={`Remover ${m.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Arranque</span>
                      <span className="font-bold text-slate-700">{formattedCurrency(m.fixedFee)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Taxa por corrida</span>
                      <span className="font-bold text-slate-700">{formattedCurrency(m.perDeliveryFee)}</span>
                    </div>
                  </div>

                  {/* Login credentials box created by store for motoboy */}
                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                    <span className="text-[10px] font-extrabold text-amber-700 uppercase block">
                      🔐 Credenciais do App (Motoboy)
                    </span>
                    <div className="flex items-center justify-between font-mono text-[11px] text-slate-700 font-semibold">
                      <span>Usuário: <strong className="text-slate-900">{m.username || m.name.toLowerCase().split(' ')[0]}</strong></span>
                      {m.password ? (
                        <span>Senha: <strong className="text-slate-900">{m.password}</strong></span>
                      ) : (
                        <span className="text-slate-500">🔒 Senha protegida</span>
                      )}
                    </div>
                    {onResetMotoboyPassword && (
                      <button
                        type="button"
                        onClick={() => onResetMotoboyPassword(m.id)}
                        className="w-full mt-0.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-[10px] uppercase tracking-wide cursor-pointer"
                      >
                        Gerar nova senha
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Ganho acumulado hoje:</span>
                    <span className="font-black text-emerald-600">{formattedCurrency(m.totalEarnedToday)}</span>
                  </div>

                  {/* ⚡ Quick Actions per Motoboy Card */}
                  <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
                    {/* Action Row 1: Quick Assign Order button or + Lançar Pedido */}
                    {unassignedOrders.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const ordersToAssign = selectedOrderIds.length > 0
                            ? selectedOrderIds
                            : [unassignedOrders[0].id];
                          
                          if (onAssignBatchToMotoboy) {
                            onAssignBatchToMotoboy(ordersToAssign, m.id);
                          } else {
                            ordersToAssign.forEach((id) => onAssignOrderToMotoboy(id, m.id));
                          }
                          setSelectedOrderIds([]);
                          triggerActionToast(`📦 ${ordersToAssign.length} pedido(s) atribuído(s) para ${m.name.split(' ')[0]}!`);
                        }}
                        className="w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md border border-blue-200"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>
                          {selectedOrderIds.length > 0
                            ? `Atribuir ${selectedOrderIds.length} selecionado(s)`
                            : `Atribuir Pedido (${unassignedOrders.length} na fila)`}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenNewOrderModal}
                        className="w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-emerald-600 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200 hover:border-slate-300"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>+ Lançar Pedido para {m.name.split(' ')[0]}</span>
                      </button>
                    )}

                    {/* Action Row 2: Secondary buttons */}
                    <div className="flex items-center gap-1.5">
                      {m.status === 'available' ? (
                        <button
                          type="button"
                          onClick={() => {
                            playNewOrderSound();
                            saveMotoboyToCloud({ ...m, callingToCounterAt: Date.now() });
                            setCallingCounterTimer({
                              motoboyId: m.id,
                              motoboyName: m.name,
                              secondsLeft: 30,
                            });
                            triggerActionToast(`🛎️ Chamando ${m.name.split(' ')[0]} no balcão!`);
                          }}
                          className="flex-1 py-1.5 px-2 bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                          title="Chamar para retirar no balcão"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>Chamar Balcão</span>
                        </button>
                      ) : m.status === 'returning_to_store' && onConfirmArrivalAtStore ? (
                        <button
                          type="button"
                          onClick={() => {
                            onConfirmArrivalAtStore(m.id);
                            triggerActionToast(`✅ Chegada de ${m.name.split(' ')[0]} confirmada!`);
                          }}
                          className="flex-1 py-1.5 px-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <span>Confirmar Chegada</span>
                        </button>
                      ) : null}

                      {m.phone && (
                        <a
                          href={`tel:${m.phone.replace(/\D/g, '')}`}
                          className="p-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-blue-700 hover:text-slate-900 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                          title={`Ligar para ${m.phone}`}
                        >
                          <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="text-[10px]">Ligar</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSendWhatsAppToMotoboy(m)}
                        className="p-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-emerald-600 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer shrink-0 flex items-center gap-1"
                        title="Enviar WhatsApp"
                      >
                        📱
                        <span className="text-[10px]">Whats</span>
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* NÍVEL 3 — GESTÃO (FINANCEIRO, HISTÓRICO, RELATÓRIOS E INTEGRAÇÕES) */}
      {(activeTab === 'gestao' || activeTab === 'financeiro' || activeTab === 'historico') && (
        <ManagementHub
          shift={shift}
          orders={orders}
          motoboys={motoboys}
          onOpenSettlementModal={() => setIsSettlementOpen(true)}
          onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
          onOpenIntegrationsModal={() => setIsIntegrationsOpen(true)}
          onSyncCardapioWeb={handleSyncCardapioWeb}
          isSyncingCw={isSyncingCw}
          onToggleShift={onToggleShift}
        />
      )}

      {/* Modals for Step 4 & 5 */}
      <ThermalTicketModal
        isOpen={isTicketOpen}
        onClose={() => {
          setIsTicketOpen(false);
          setTicketOrder(null);
        }}
        order={ticketOrder}
        shift={shift}
        motoboy={motoboys.find((m) => m.id === ticketOrder?.assignedMotoboyId)}
      />

      <MotoboySettlementModal
        isOpen={isSettlementOpen}
        onClose={() => setIsSettlementOpen(false)}
        motoboys={motoboys}
        orders={orders}
      />

      <DeliveryHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        orders={orders}
        motoboys={motoboys}
        storeName={shift.storeName}
      />

      <IntegrationsModal
        isOpen={isIntegrationsOpen}
        onClose={() => setIsIntegrationsOpen(false)}
        storeName={shift.storeName}
        integrations={shift.integrations}
        branches={shift.branches}
        onSave={(integrations, updatedBranches) => {
          onSaveIntegrations?.(integrations, updatedBranches);
          triggerActionToast('Configurações de integração salvas com sucesso!');
        }}
        onSimulateIncomingOrder={handleSimulateIncomingOrder}
      />

      {/* Como Calculamos Modal */}
      {isCalculationInfoOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-800 text-slate-100 relative my-auto animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black">
                  ✨
                </div>
                <div>
                  <h4 className="font-black text-base text-white">Como calculamos o despacho?</h4>
                  <p className="text-xs text-slate-400 font-medium">Algoritmo de eficiência logística em tempo real</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCalculationInfoOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-1">
                <strong className="text-emerald-400 font-bold block text-xs">1. Localização e GPS do Entregador</strong>
                <p className="text-slate-400">
                  Acompanha a posição exata em tempo real na loja ou no trajeto de volta.
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-1">
                <strong className="text-emerald-400 font-bold block text-xs">2. Posição no Rodízio / Fila</strong>
                <p className="text-slate-400">
                  Respeita a ordem justa de chegada do motoboy na loja para distribuição equilibrada.
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-1">
                <strong className="text-emerald-400 font-bold block text-xs">3. Proximidade dos Destinos (Agrupamento)</strong>
                <p className="text-slate-400">
                  Agrupa entregas na mesma direção e bairros vizinhos para otimizar o percurso.
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-1">
                <strong className="text-emerald-400 font-bold block text-xs">4. Pedidos Prontos e Preparo na Cozinha</strong>
                <p className="text-slate-400">
                  Sincroniza balcão com KDS: se um pedido em preparo fica pronto em ~3 min, sugere aguardar a saída conjunta.
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-1">
                <strong className="text-emerald-400 font-bold block text-xs">5. Previsão de Retorno (ETA)</strong>
                <p className="text-slate-400">
                  Calcula quando o motoboy em rota estará de volta para pré-alocar a bag da próxima rodada.
                </p>
              </div>

              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-emerald-300 font-medium text-[11px] leading-snug">
                💡 <strong>Controle Humano Sempre:</strong> O Rota Fácil recomenda e a equipe da loja confirma com um único clique.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCalculationInfoOpen(false)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all uppercase tracking-wider cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* 🗺️ Interactive Route & Deliveries Map Modal */}
      <RouteModal
        isOpen={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        orders={orders}
        motoboys={motoboys}
        shift={shift}
        selectedStoreFilter={storeFilter}
        onSelectOrderForTracking={onSelectOrderForTracking}
        onAssignOrderToMotoboy={onAssignOrderToMotoboy}
      />

      {/* 🎒 FLOATING BATCH DISPATCH BAR WHEN CHECKBOXES ARE CHECKED */}
      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 border-2 border-emerald-500/80 p-3 px-5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-slideUp text-white w-[92%] max-w-xl">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span className="font-black text-xs sm:text-sm text-emerald-300 uppercase tracking-wide">
              🎒 {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'pedido selecionado' : 'pedidos selecionados'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const availableFirst = motoboys.find((m) => m.status === 'available');
                if (!availableFirst) {
                  triggerActionToast(
                    '⚠️ Despacho bloqueado: Nenhum motoboy disponível no pátio da loja no momento. Aguarde o retorno de um entregador para evitar saídas fictícias.'
                  );
                  return;
                }
                const targetId = availableFirst.id;
                if (onAssignBatchToMotoboy) {
                  onAssignBatchToMotoboy(selectedOrderIds, targetId);
                  setSelectedOrderIds([]);
                } else {
                  selectedOrderIds.forEach((id) => onAssignOrderToMotoboy(id, targetId));
                  setSelectedOrderIds([]);
                }
                triggerActionToast(
                  `🚀 ${selectedOrderIds.length} pedidos despachados com ${availableFirst.name} (1º da fila)!`
                );
              }}
              className={`px-3.5 py-2 active:scale-95 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5 uppercase tracking-wide border ${
                availableMotoboys.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40'
                  : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400/40'
              }`}
              title={
                availableMotoboys.length === 0
                  ? 'Atenção: Nenhum motoboy disponível no pátio da loja'
                  : 'Despachar com o primeiro motoboy livre da fila'
              }
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300 shrink-0" />
              <span>
                {availableMotoboys.length > 0
                  ? `Despachar (${availableMotoboys[0].name.split(' ')[0]})`
                  : 'Aguardando Motoboy'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedOrderIds([])}
              className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

