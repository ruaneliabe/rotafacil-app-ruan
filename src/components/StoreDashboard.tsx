import React, { useState, useEffect } from 'react';
import { Order, Motoboy, StoreShift, OrderStatus } from '../types';
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
} from 'lucide-react';
import { RouteMap } from './RouteMap';
import { ThermalTicketModal } from './ThermalTicketModal';
import { MotoboySettlementModal } from './MotoboySettlementModal';
import { DeliveryHistoryModal } from './DeliveryHistoryModal';
import { IntegrationsModal } from './IntegrationsModal';
import { getSoundEnabled, setSoundEnabled, playNewOrderSound } from '../utils/soundUtils';
import { calculateDistanceKm, calculateRoadDistanceKm } from '../utils/geoUtils';
import { analyzeOperationalBrain, DispatchRecommendation, OperationalAlert } from '../utils/dispatchBrain';
import { saveMotoboyToCloud } from '../lib/firebase';

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
  onSelectOrderForTracking: (order: Order) => void;
  onDeleteMotoboy?: (motoboyId: string) => void;
  onDeleteAllMotoboys?: () => void;
  onAddOrder?: (newOrder: Omit<Order, 'id' | 'codeNumber' | 'status' | 'createdAt' | 'trackingCode'>) => void;
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
  onSelectOrderForTracking,
  onDeleteMotoboy,
  onDeleteAllMotoboys,
  onAddOrder,
}) => {
  const [activeTab, setActiveTab] = useState<'operacao' | 'equipe' | 'financeiro' | 'historico'>('operacao');
  const [selectedMotoboyId, setSelectedMotoboyId] = useState<string | null>(motoboys[0]?.id || null);

  // Multi-select for multi-order grouping/bag dispatch
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [orderSort, setOrderSort] = useState<'time' | 'value' | 'neighborhood'>('time');
  const [isCompactMode, setIsCompactMode] = useState<boolean>(false);
  const [isAlertsSectionInView, setIsAlertsSectionInView] = useState<boolean>(true);
  const [isSavingsDismissed, setIsSavingsDismissed] = useState<boolean>(false);

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
        (o.assignedMotoboyId === nextMotoboy.id ||
          (nextMotoboy.username && o.assignedMotoboyId?.toLowerCase() === nextMotoboy.username.toLowerCase()) ||
          (nextMotoboy.name && o.assignedMotoboyId?.toLowerCase() === nextMotoboy.name.toLowerCase())) &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled'
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

  // Derived metrics matching screenshot
  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const readyAtCounter = orders.filter((o) => o.status === 'ready_at_counter');
  const unassignedOrders = activeOrders.filter((o) => !o.assignedMotoboyId);
  const deliveredToday = orders.filter((o) => o.status === 'delivered');
  const totalRevenue = orders.reduce((acc, o) => acc + o.total, 0);
  const getMotoboyLoad = (motoboyId: string) => activeOrders.filter((o) => o.assignedMotoboyId === motoboyId).length;
  const motoboysAvailable = motoboys
    .filter((m) => m.status === 'available')
    .sort((a, b) => {
      const loadDiff = getMotoboyLoad(a.id) - getMotoboyLoad(b.id);
      if (loadDiff !== 0) return loadDiff;
      return (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0);
    });

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
      (o) => o.status !== 'delivered' && o.status !== 'cancelled' && o.assignedMotoboyId === m.id
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

  // 🧠 Operational AI Brain Analysis
  const brainAnalysis = analyzeOperationalBrain(orders, motoboys, shift);

  const handleApplyBrainRecommendation = (rec: DispatchRecommendation) => {
    if (onAssignBatchToMotoboy) {
      onAssignBatchToMotoboy(rec.orderIds, rec.motoboyId);
    } else {
      rec.orderIds.forEach((id) => onAssignOrderToMotoboy(id, rec.motoboyId));
    }
    triggerActionToast(`⚡ Despacho Recomendado Aplicado! ${rec.orderIds.length} pedidos vinculados a ${rec.motoboyName}.`);
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

  // ⚡ Auto GPS Arrival Detection: If a returning motoboy enters ~150m radius of store, auto-mark arrived
  useEffect(() => {
    if (!shift.storeLat || !shift.storeLng || !onConfirmArrivalAtStore) return;

    motoboys.forEach((m) => {
      if (m.status === 'returning_to_store' && m.currentLat && m.currentLng) {
        const distKm = calculateDistanceKm(m.currentLat, m.currentLng, shift.storeLat, shift.storeLng);
        if (distKm <= 0.15) {
          onConfirmArrivalAtStore(m.id);
          triggerActionToast(`📍 Chegada automática por GPS: ${m.name} entrou no raio da loja (100m)! 🟢`);
        }
      }
    });
  }, [motoboys, shift.storeLat, shift.storeLng, onConfirmArrivalAtStore]);

  const handleNotifyMotoboyInApp = (m: Motoboy) => {
    const mOrders = orders.filter((o) => o.assignedMotoboyId === m.id && o.status !== 'delivered' && o.status !== 'cancelled');
    if (mOrders.length === 0) return;

    mOrders.forEach((ord) => {
      if (ord.status !== 'ready_at_counter' && ord.status !== 'picked_up' && ord.status !== 'in_transit') {
        onUpdateOrderStatus(ord.id, 'ready_at_counter');
      }
    });

    triggerActionToast(`🔔 Aviso de retirada enviado ao App do entregador ${m.name.split(' ')[0]}!`);
  };

  const handleSendWhatsAppToMotoboy = (m: Motoboy) => {
    const mOrders = orders.filter((o) => o.assignedMotoboyId === m.id && o.status !== 'delivered' && o.status !== 'cancelled');
    if (mOrders.length === 0) return;

    const cleanedPhone = (m.phone || '').replace(/\D/g, '');
    let msg = `🛵 *ROTA FÁCIL - PEDIDO(S) PRONTO(S) PARA RETIRADA!*\n\n`;
    msg += `Olá *${m.name}*!\n`;
    msg += `A loja *${shift.storeName}* atribuiu *${mOrders.length}* pedido(s) a você PRONTO(S) no balcão para retirar:\n\n`;

    mOrders.forEach((ord, i) => {
      msg += `📦 *${i + 1}. Pedido #${ord.codeNumber}* (${ord.clientName})\n`;
      msg += `📍 Endereço: ${ord.address} - ${ord.neighborhood}\n`;
      msg += `💵 Cobrar: ${formattedCurrency(ord.total)} (${ord.paymentMethod.toUpperCase()})\n`;
      if (ord.clientPhone) msg += `📞 Cliente: ${ord.clientPhone}\n`;
      msg += `\n`;
    });

    const url = cleanedPhone
      ? `https://wa.me/55${cleanedPhone}?text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4 text-slate-100 relative">
      {/* Real-time Store Action Toast */}
      {actionToast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 border border-blue-500/40 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-slideDown">
          <span className="text-blue-400 font-bold text-base">🔔</span>
          <span className="text-xs font-medium text-slate-100">{actionToast}</span>
        </div>
      )}

      {/* 1. CLEAN ULTRA-SLIM DASHBOARD HEADER */}
      <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-3 px-4 border border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/60 text-blue-400 flex items-center justify-center shrink-0 font-bold shadow-2xs">
            <Building2 className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">{shift.storeName || 'Hope Burger'}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                shift.isOpen ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'
              }`}>
                {shift.isOpen ? 'Aberto' : 'Fechado'}
              </span>
            </div>
            {/* Minimal line requested by user: Hope Burger • 2 pedidos • 1 motoboy ativo • R$233 hoje */}
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              <strong className="text-slate-200">{activeOrders.length} pedidos</strong> • <strong className="text-slate-200">{motoboysAvailable.length} motoboy{motoboysAvailable.length !== 1 ? 's' : ''} ativo{motoboysAvailable.length !== 1 ? 's' : ''}</strong> • <strong className="text-blue-400 font-semibold">{formattedCurrency(totalRevenue)} hoje</strong>
            </p>
          </div>
        </div>

        {/* Action Controls: Group Primary Dispatch separately from Secondary Toolbar */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
          {/* Primary Action: Standalone Highlighted Button */}
          <button
            type="button"
            onClick={handleCallNextMotoboy}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer border-2 border-emerald-400/80 uppercase tracking-wide"
            title="Sinaliza o celular do 1º motoboy da fila com aviso sonoro e vibratório para retirar o pedido no balcão"
          >
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300 shrink-0 animate-pulse" />
            <span>Despachar Próximo da Fila</span>
          </button>

          {/* Vertical Divider on Desktop */}
          <div className="hidden sm:block h-6 w-px bg-slate-800" />

          {/* Secondary Actions Group */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onOpenNewOrderModal}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Cadastrar um pedido manual avulso no sistema"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>Pedido Manual</span>
            </button>

            <button
              type="button"
              onClick={() => setIsIntegrationsOpen(true)}
              className="px-3 py-2 bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 font-bold text-xs rounded-xl border border-purple-500/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Conectado com Cardápio Web, iFood, Anota AI e PDV"
            >
              <Webhook className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Integrações</span>
            </button>

            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Relatórios e Histórico de Entregas"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Relatórios</span>
            </button>

            <button
              type="button"
              onClick={onOpenMotoboyModal}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl border border-slate-700/60 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Gerenciar cadastro da equipe de entregadores"
            >
              <Bike className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Equipe</span>
            </button>

            <button
              type="button"
              onClick={onToggleShift}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-700/60 transition-all cursor-pointer"
              title={shift.isOpen ? 'Encerrar Expediente' : 'Abrir Expediente'}
            >
              <Power className="w-4 h-4 text-rose-400" />
            </button>
          </div>
        </div>
      </div>

      {/* 🔌 INTEGRATIONS VALUE POSITIONING BANNER (COLLAPSIBLE / COMPACT) */}
      {isSyncBannerCollapsed ? (
        <div className="bg-slate-900/80 border border-purple-500/30 rounded-xl p-2.5 px-3.5 flex items-center justify-between gap-2 shadow-2xs text-xs">
          <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wide flex items-center gap-1.5 shrink-0 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE
            </span>
            <span className="font-extrabold text-white shrink-0">☁️ Dados sincronizados:</span>
            <span className="text-slate-300 font-medium truncate">Pedidos, motoboys e rastreio em tempo real</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">Nuvem ativa</span>
            <button
              type="button"
              onClick={() => setIsSyncBannerCollapsed(false)}
              className="text-[11px] font-extrabold text-slate-300 hover:text-white px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 transition-all cursor-pointer flex items-center gap-1"
            >
              <span>▼ Detalhes</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-purple-500/30 rounded-2xl p-3 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center font-bold text-sm shrink-0">
              🔌
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white">Sincronização em tempo real</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/40 uppercase">
                  Firebase Online
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Pedidos, equipe, status e localização são sincronizados entre os dispositivos conectados à loja.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-bold text-slate-400 shrink-0">Integrações externas: não configuradas</span>
            <button
              type="button"
              onClick={() => setIsSyncBannerCollapsed(true)}
              className="text-[11px] font-extrabold text-slate-400 hover:text-white px-2 py-0.5 rounded-xl bg-slate-800 border border-slate-700 transition-all cursor-pointer"
            >
              ▲ Ocultar
            </button>
          </div>
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

      {/* ⚠️ STICKY TOP ALERT BANNER (Aparece somente quando a Central de Exceções é rolada para fora da tela) */}
      {brainAnalysis.alerts.length > 0 && !isAlertsSectionInView && (
        <div
          onClick={() => {
            const el = document.getElementById('exceptions-alerts-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="sticky top-2 z-40 bg-amber-950/95 border-2 border-amber-500/80 text-amber-100 p-2.5 px-4 rounded-xl shadow-xl flex items-center justify-between gap-3 cursor-pointer transition-all animate-slideDown backdrop-blur-md"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span className="font-extrabold text-xs text-amber-200 truncate">
              {brainAnalysis.alerts[0].title}: <span className="font-medium text-amber-100">{brainAnalysis.alerts[0].description}</span>
            </span>
          </div>

          <span className="text-[10px] font-bold text-amber-300 bg-amber-900/80 px-2 py-0.5 rounded-md border border-amber-500/40 shrink-0 uppercase tracking-wide">
            Ver Central ({brainAnalysis.alerts.length}) ↑
          </span>
        </div>
      )}

      {/* 2. SUB NAVIGATION TABS */}
      <div className="bg-slate-950/35 p-1.5 rounded-2xl border border-slate-800/70 flex items-center justify-between overflow-x-auto text-xs font-medium text-slate-500 shadow-sm">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('operacao')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'operacao'
                ? 'bg-slate-800/80 text-white font-semibold shadow-sm border border-slate-700/70'
                : 'hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Operação
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              unassignedOrders.length > 0
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : activeTab === 'operacao' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-400'
            }`}>
              {unassignedOrders.length > 0 ? `${unassignedOrders.length} pendentes` : `${activeOrders.length} ativos`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('equipe')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'equipe'
                ? 'bg-slate-800/80 text-white font-semibold shadow-sm border border-slate-700/70'
                : 'hover:text-slate-200'
            }`}
          >
            Equipe ({motoboys.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('financeiro')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'financeiro'
                ? 'bg-slate-800/80 text-white font-semibold shadow-sm border border-slate-700/70'
                : 'hover:text-slate-200'
            }`}
          >
            Financeiro
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historico')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'historico'
                ? 'bg-slate-800/80 text-white font-semibold shadow-sm border border-slate-700/70'
                : 'hover:text-slate-200'
            }`}
          >
            Histórico
          </button>
        </div>
      </div>

      {activeTab === 'operacao' && (
        <div className="space-y-4">

          {/* ✨ DESPACHO RECOMENDADO (Compact & Professional) */}
          {brainAnalysis.recommendations.length > 0 && (
            <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-3.5 sm:p-4 shadow-xl space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-base shrink-0">
                    ✨
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-sm text-white tracking-tight">
                        Despacho recomendado
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsCalculationInfoOpen(true)}
                        className="text-[11px] font-extrabold text-emerald-400 hover:text-emerald-300 underline decoration-emerald-500/50 cursor-pointer flex items-center gap-1"
                      >
                        <span>Como calculamos?</span>
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      Melhor opção considerando localização, pedidos e disponibilidade dos motoboys.
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendation Cards Grid */}
              {(() => {
                const displayedRecs = showAllRecommendations
                  ? brainAnalysis.recommendations
                  : brainAnalysis.recommendations.slice(0, 2);
                const hiddenCount = brainAnalysis.recommendations.length - displayedRecs.length;

                return (
                  <div className="space-y-3">
                    <div className={`grid grid-cols-1 ${displayedRecs.length > 1 ? 'md:grid-cols-2' : ''} gap-3`}>
                      {displayedRecs.map((rec) => (
                        <div
                          key={rec.id}
                          className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-3 hover:border-emerald-500/40 transition-all shadow-sm flex flex-col justify-between"
                        >
                          <div className="space-y-2.5">
                            {/* Driver & Route Header */}
                            <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-900 pb-2">
                              <span className="text-xs font-black text-white bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5">
                                🛵 <strong className="text-emerald-400">{rec.motoboyName}</strong>
                                {rec.motoboyStatus === 'returning_to_store' && (
                                  <span className="text-[10px] text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                                    retorna em ~{rec.motoboyEtaMin}m
                                  </span>
                                )}
                              </span>

                              <span className="text-xs font-extrabold text-slate-300 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                                📍 {rec.totalStops} {rec.totalStops === 1 ? 'parada' : 'paradas'} · {rec.totalDistanceKm} km · ~{rec.estimatedTripMin} min
                              </span>
                            </div>

                            {/* Orders List with Clear Origin Source Badge */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider block">
                                {rec.orders.length === 1 ? 'Pedido selecionado:' : 'Pedidos agrupados na mesma rota:'}
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {rec.orders.map((o) => (
                                  <span
                                    key={o.id}
                                    className="inline-flex items-center gap-1.5 text-xs text-slate-200 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg font-bold"
                                  >
                                    <strong className="text-emerald-400">#{o.codeNumber}</strong>
                                    <span>{o.clientName}</span>
                                    <span className="text-[10px] text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded font-medium border border-slate-700/60">
                                      {o.originChannel === 'ifood'
                                        ? '🔴 iFood'
                                        : o.originChannel === 'cardapio_web'
                                        ? '🌐 Cardápio Web'
                                        : o.originChannel === 'pdv'
                                        ? '💻 PDV'
                                        : '💬 WhatsApp'}
                                    </span>
                                    <span className="text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded text-[10px] font-extrabold border border-emerald-500/30">
                                      📍 Bairro: {o.neighborhood}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Rationale Text */}
                            <p className="text-[11px] text-slate-500 font-medium bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
                              💡 {rec.rationale}
                            </p>

                            {/* SCENARIO B: Kitchen Wait / Return Delay Dual Decision Box */}
                            {rec.waitSuggestion?.suggestWait ? (
                              <div className="bg-amber-950/40 border-2 border-amber-500/50 rounded-xl p-3.5 space-y-2.5 text-amber-100 text-xs shadow-lg">
                                <div className="flex items-center justify-between gap-2 flex-wrap font-black text-amber-300">
                                  <span className="flex items-center gap-1.5 text-sm">
                                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                                    <span>Aguarde ~{rec.waitSuggestion.waitMinutes} min</span>
                                  </span>
                                  <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 rounded-md shadow-xs">
                                    ⏱️ Ambos permanecem dentro do prazo
                                  </span>
                                </div>

                                <div className="space-y-1 text-xs">
                                  <p className="font-black text-amber-100 leading-snug">
                                    {rec.waitSuggestion.reason}
                                  </p>
                                  {rec.waitSuggestion.subReason && (
                                    <p className="text-[11px] text-amber-200/90 leading-relaxed font-medium">
                                      {rec.waitSuggestion.subReason}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleApplyBrainRecommendation(rec);
                                      triggerActionToast(`⏳ Decisão Inteligente: Aguardando ~${rec.waitSuggestion?.waitMinutes} min para agrupar e despachar com ${rec.motoboyName}!`);
                                    }}
                                    className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black rounded-xl border border-emerald-400/50 text-xs transition-all cursor-pointer text-center shadow-md flex items-center justify-center gap-1.5"
                                  >
                                    <span>[Aguardar e agrupar]</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const readyId = rec.waitSuggestion?.readyOrderId || rec.orders[0]?.id;
                                      const readyCode = rec.waitSuggestion?.readyOrderCode || rec.orders[0]?.codeNumber;
                                      onAssignOrderToMotoboy(readyId, rec.motoboyId);
                                      triggerActionToast(`⚡ Despachado apenas #${readyCode} agora com ${rec.motoboyName}.`);
                                    }}
                                    className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-extrabold rounded-xl text-xs transition-all cursor-pointer text-center border border-slate-700 flex items-center justify-center gap-1.5"
                                  >
                                    <span>Despachar #{rec.waitSuggestion?.readyOrderCode || rec.orders[0]?.codeNumber} agora</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Direct Dispatch Action Button */
                              <button
                                type="button"
                                onClick={() => handleApplyBrainRecommendation(rec)}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-xs rounded-xl shadow-md transition-all uppercase tracking-wide cursor-pointer flex items-center justify-center gap-2 mt-2"
                              >
                                <Zap className="w-4 h-4 text-emerald-200 fill-emerald-200" />
                                <span>Aplicar Despacho Recomendado</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {brainAnalysis.recommendations.length > 2 && (
                      <div className="flex justify-center pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAllRecommendations(!showAllRecommendations)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-extrabold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                        >
                          {showAllRecommendations ? (
                            <span>▲ Recolher e mostrar apenas as 2 principais sugestões</span>
                          ) : (
                            <span>▼ Ver mais {hiddenCount} {hiddenCount === 1 ? 'sugestão de rota' : 'sugestões de rotas'}</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* 🚨 CENTRAL DE EXCEÇÕES E ALERTAS DA OPERAÇÃO (APENAS PROBLEMAS/EXCEÇÕES) */}
          {(() => {
            const problemAlerts = brainAnalysis.alerts.filter((a) => a.type !== 'savings' && a.severity !== 'info');
            const insightAlerts = brainAnalysis.alerts.filter((a) => a.type === 'savings' || a.severity === 'info');

            return (
              <>
                {problemAlerts.length > 0 && (
                  <div id="exceptions-alerts-section" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <span className="text-xs font-black text-amber-300 tracking-wide flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Atenção na Operação</span>
                      </span>
                      <span className="text-[10px] font-bold text-amber-300 uppercase bg-amber-950/80 border border-amber-800/60 px-2.5 py-0.5 rounded-full">
                        {problemAlerts.length} {problemAlerts.length === 1 ? 'alerta ativo' : 'alertas ativos'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {problemAlerts.map((alt) => (
                        <div
                          key={alt.id}
                          className={`p-2.5 rounded-xl border text-xs space-y-1 transition-all ${
                            alt.severity === 'high'
                              ? 'bg-red-950/40 border-red-500/50 text-red-100'
                              : 'bg-amber-950/40 border-amber-500/50 text-amber-100'
                          }`}
                        >
                          <div className="flex items-center justify-between font-extrabold gap-1">
                            <span>{alt.title}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{alt.timestamp}</span>
                          </div>
                          <p className="text-[11px] text-slate-300 font-medium leading-tight">
                            {alt.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ✨ INSIGHTS & EFICIÊNCIA DA OPERAÇÃO (MENSAGENS POSITIVAS DISPENSÁVEIS/MINIMIZÁVEIS) */}
                {insightAlerts.length > 0 && (
                  !isSavingsDismissed ? (
                    <div className="bg-slate-900/45 border border-slate-800/70 rounded-xl px-3 py-2 shadow-sm flex flex-row items-center justify-between gap-3 text-slate-300 transition-all">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center text-emerald-400 shrink-0 font-black text-xs">
                          ✨
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[11px] text-slate-300 uppercase tracking-wider">
                              {insightAlerts[0].title}
                            </span>
                            <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-bold uppercase">
                              Desempenho Positivo
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate sm:whitespace-normal">
                            {insightAlerts[0].description}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSavingsDismissed(true)}
                        className="px-2.5 py-1 bg-transparent hover:bg-slate-800 text-slate-500 hover:text-slate-200 border border-slate-800 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95"
                        title="Dispensar/Minimizar aviso"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span className="text-[11px] hidden sm:inline font-bold">Dispensar</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-emerald-300 text-xs transition-all">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="shrink-0 text-xs">✨</span>
                        <span className="font-bold truncate text-[11px]">{insightAlerts[0].title}:</span>
                        <span className="text-slate-300 truncate text-[11px]">{insightAlerts[0].description}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSavingsDismissed(false)}
                        className="text-[10px] font-extrabold text-emerald-400 hover:text-emerald-200 underline cursor-pointer shrink-0 pl-2"
                      >
                        Ver banner
                      </button>
                    </div>
                  )
                )}
              </>
            );
          })()}

          {/* 🛵 UNIFIED CLEAN RETURNING MOTOBOY ALERT BANNER */}
          {returningMotoboysWithDistance.length > 0 && (
            <div
              onClick={() => {
                setMapFilter('returning');
                const mapEl = document.getElementById('dashboard-map-section');
                if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-amber-950/80 border border-amber-500/60 hover:border-amber-400 text-amber-100 p-3 px-4 rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  🛵
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-amber-200 flex items-center gap-2 flex-wrap">
                    <span>
                      {returningMotoboysWithDistance.map(
                        (m) => `${m.name} retorna em ~${m.estMin} min${m.distKm > 0 ? ` · ${m.distKm.toFixed(1)} km da loja` : ''}`
                      ).join(' • ')}
                    </span>
                    <span className="text-[10px] bg-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded border border-amber-500/40 font-bold uppercase tracking-wider">
                      Ver no Mapa 🗺️
                    </span>
                  </h4>
                  <p className="text-xs text-amber-300/80 mt-0.5 font-medium">
                    Aproveite para preparar os próximos pedidos.
                  </p>
                </div>
              </div>

              {onConfirmArrivalAtStore && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  {returningMotoboysWithDistance.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onConfirmArrivalAtStore(m.id);
                        triggerActionToast(`✅ Chegada do entregador ${m.name} confirmada na loja!`);
                      }}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm border border-amber-400 shrink-0"
                    >
                      Confirmar Chegada 🟢
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. STRIPE-STYLE OPERATIONAL METRICS CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* CARD 1: Espera Médio na Fila */}
            <div className="bg-slate-900/55 px-3.5 py-3 rounded-xl border border-slate-800/80 shadow-sm flex flex-col justify-between space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" /> Espera Médio Fila
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800/80 text-slate-500 border border-slate-700/70">
                  ⚡ Otimizado
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">~7.5 min</span>
                <span className="text-[11px] text-slate-500 font-medium">aguardando despacho</span>
              </div>
            </div>

            {/* CARD 2: Tempo até Retirada */}
            <div className="bg-slate-900/55 px-3.5 py-3 rounded-xl border border-slate-800/80 shadow-sm flex flex-col justify-between space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-400 shrink-0" /> Tempo até Retirada
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800/80 text-slate-500 border border-slate-700/70">
                  Balcão
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">~2.2 min</span>
                <span className="text-[11px] text-slate-500 font-medium">chamada → saída</span>
              </div>
            </div>

            {/* CARD 3: Motoboys Disponíveis / Parados */}
            <div className="bg-slate-900/55 px-3.5 py-3 rounded-xl border border-slate-800/80 shadow-sm flex flex-col justify-between space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <Bike className="w-4 h-4 text-blue-400 shrink-0" /> Motoboys Fila Agora
                </span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${
                  motoboysAvailable.length > 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                }`}>
                  {motoboysAvailable.length} {motoboysAvailable.length === 1 ? 'disponível' : 'disponíveis'}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
                  {motoboysAvailable.length}/{motoboys.length}
                </span>
                <span className="text-[11px] text-slate-500 font-medium truncate">
                  {motoboysAvailable.length > 0 ? `1º: ${motoboysAvailable[0].name.split(' ')[0]}` : 'todos em rota'}
                </span>
              </div>
            </div>

            {/* CARD 4: Faturamento & Entregas Hoje */}
            <div className="bg-slate-900/55 px-3.5 py-3 rounded-xl border border-slate-800/80 shadow-sm flex flex-col justify-between space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" /> Entregas Hoje
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {deliveredToday.length} concluídas
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">{formattedCurrency(totalRevenue)}</span>
                <span className="text-[11px] text-slate-500 font-medium">{orders.length} pedidos</span>
              </div>
            </div>
          </div>

          {/* 5. DESPACHO VISUAL SECTION */}
          <div className="bg-slate-950/25 rounded-2xl border border-slate-800/70 shadow-sm p-3.5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-sm font-bold text-slate-200 tracking-tight">Próximo despacho</h3>
                <button
                  type="button"
                  onClick={onOpenNewOrderModal}
                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md border border-emerald-400/40 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white shrink-0" />
                  <span>+ Lançar Pedido</span>
                </button>
              </div>

              <span className="text-xs text-slate-400 font-medium">
                <strong className="text-amber-400">{unassignedOrders.length}</strong> aguardando despacho
              </span>
            </div>

            {/* Banner when 0 unassigned orders */}
            {unassignedOrders.length === 0 && (
              <div className="py-2 px-3 bg-slate-900/45 rounded-lg border border-slate-800 flex items-center gap-2 text-xs">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-xs font-black shrink-0">
                  ✓
                </div>
                <span className="font-semibold text-slate-300">Tudo despachado</span>
                <span className="text-slate-500 font-medium">Nenhum pedido aguardando motoboy.</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* Left Column: Pedidos sem motoboy - ONLY rendered when unassigned orders exist */}
              {unassignedOrders.length > 0 && (
                <div className="lg:col-span-5 bg-slate-900/40 rounded-xl p-3 border border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wide">
                        Pedidos ({unassignedOrders.length})
                      </h4>
                      {/* Compact / Detailed view toggle */}
                      <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setIsCompactMode(false)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            !isCompactMode ? 'bg-slate-800 text-white shadow-2xs' : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title="Exibir cartões detalhados com endereço e itens"
                        >
                          ☰ Detalhado
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCompactMode(true)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            isCompactMode ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title="Exibir modo compacto de alta densidade para muitos pedidos"
                        >
                          ⚡ Compacto
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Sorting selector */}
                      <select
                        value={orderSort}
                        onChange={(e) => setOrderSort(e.target.value as any)}
                        className="bg-slate-950 text-slate-300 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-800 focus:outline-none cursor-pointer"
                        title="Ordenar lista de pedidos"
                      >
                        <option value="time">🕒 Mais antigos primeiro</option>
                        <option value="value">💰 Maior valor primeiro</option>
                        <option value="neighborhood">📍 Por bairro</option>
                      </select>

                      {unassignedOrders.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedOrderIds.length === unassignedOrders.length) {
                              setSelectedOrderIds([]);
                            } else {
                              setSelectedOrderIds(unassignedOrders.map((o) => o.id));
                            }
                          }}
                          className="text-[11px] font-bold text-slate-300 hover:text-white underline cursor-pointer shrink-0"
                        >
                          {selectedOrderIds.length === unassignedOrders.length
                            ? 'Desmarcar'
                            : 'Selecionar Todos'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Smart Proximity Grouping Alert */}
                  {(() => {
                    const neighMap: Record<string, Order[]> = {};
                    unassignedOrders.forEach((o) => {
                      const neigh = o.neighborhood.trim() || 'Centro';
                      if (!neighMap[neigh]) neighMap[neigh] = [];
                      neighMap[neigh].push(o);
                    });

                    const proximityGroups = Object.entries(neighMap).filter(([_, list]) => list.length >= 2);

                    if (proximityGroups.length === 0) return null;

                    return (
                      <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700 text-xs space-y-1.5 shadow-2xs">
                        <span className="text-[10px] font-extrabold uppercase text-amber-300 block">
                          📍 Agrupamento de Rota Próxima Detectado
                        </span>
                        {proximityGroups.map(([neigh, list]) => (
                          <div key={neigh} className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-lg border border-slate-700">
                            <span className="text-[11px] font-bold text-slate-200">
                              {list.length} pedidos no bairro <strong>{neigh}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrderIds(list.map((o) => o.id));
                              }}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1"
                            >
                              <Zap className="w-3 h-3 text-slate-950" /> Agrupar Bag
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Batch Dispatch Bar when orders are checked */}
                  {selectedOrderIds.length > 0 && (
                    <div className="bg-slate-900 p-3 rounded-xl border-2 border-emerald-500/60 text-white space-y-2 shadow-md animate-fade-in">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-emerald-300 flex items-center gap-1.5 font-black">
                          🎒 Bag Ativa ({selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'pedido selecionado' : 'pedidos selecionados'})
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedOrderIds([])}
                          className="text-[10px] text-slate-300 hover:text-white underline font-semibold cursor-pointer"
                        >
                          Limpar seleção
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          id="batchMotoboySelect"
                          className="flex-1 bg-slate-800 text-white text-xs font-bold p-2 rounded-lg border border-slate-700 focus:outline-none"
                        >
                          {[...motoboys]
                            .sort((a, b) => {
                              if (a.status === 'available' && b.status !== 'available') return -1;
                              if (a.status !== 'available' && b.status === 'available') return 1;
                              return (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0);
                            })
                            .map((m) => {
                              const isAvail = m.status === 'available';
                              const statusLabel = isAvail
                                ? '🟢 Livre na Fila'
                                : m.status === 'on_delivery'
                                ? '🛵 Em Rota'
                                : m.status === 'break'
                                ? '☕ Em Pausa'
                                : '🔴 Offline';
                              return (
                                <option key={m.id} value={m.id}>
                                  {m.name} — {statusLabel} ({m.activeOrdersCount} paradas)
                                </option>
                              );
                            })}
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            const selectElem = document.getElementById('batchMotoboySelect') as HTMLSelectElement;
                            const availableFirst = motoboys.find((m) => m.status === 'available');
                            const targetId = selectElem?.value || availableFirst?.id || motoboys[0]?.id;
                            if (targetId && onAssignBatchToMotoboy) {
                              onAssignBatchToMotoboy(selectedOrderIds, targetId);
                              setSelectedOrderIds([]);
                            } else if (targetId) {
                              selectedOrderIds.forEach((id) => onAssignOrderToMotoboy(id, targetId));
                              setSelectedOrderIds([]);
                            }
                          }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg shadow-2xs shrink-0 flex items-center gap-1 cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-300" /> Despachar Bag
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                    {[...unassignedOrders]
                      .sort((a, b) => {
                        if (orderSort === 'value') return b.total - a.total;
                        if (orderSort === 'neighborhood') return a.neighborhood.localeCompare(b.neighborhood);
                        return (a.codeNumber || 0) - (b.codeNumber || 0);
                      })
                      .map((ord) => {
                        const isSelected = selectedOrderIds.includes(ord.id);

                        {/* High Density Compact Mode */}
                        if (isCompactMode) {
                          return (
                            <div
                              key={ord.id}
                              className={`bg-slate-800 p-2 rounded-xl border transition-all flex items-center justify-between gap-2 text-xs ${
                                isSelected
                                  ? 'border-2 border-emerald-500 bg-slate-800/90 ring-1 ring-emerald-500/30'
                                  : 'border-slate-700/80 hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedOrderIds((prev) => [...prev, ord.id]);
                                    } else {
                                      setSelectedOrderIds((prev) => prev.filter((id) => id !== ord.id));
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer bg-slate-900 border-slate-700 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-extrabold text-sm text-white">#{ord.codeNumber}</span>
                                    <span className="font-bold text-slate-200 truncate max-w-[110px] sm:max-w-[140px]">{ord.clientName}</span>
                                    {renderChannelBadge(ord.originChannel)}
                                  </div>
                                  <p className="text-[10px] text-emerald-300 font-bold truncate">📍 {ord.neighborhood} • <span className="text-slate-400 font-medium">{ord.address}</span></p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="px-2 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 font-black text-xs shadow-2xs">
                                  {formattedCurrency(ord.total)}
                                </span>

                                {(() => {
                                  const firstAvail = motoboys.find((m) => m.status === 'available');
                                  if (firstAvail) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => assignOrderRespectingLoad(ord.id, firstAvail.id)}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                                        title={`Despachar para 1º da fila: ${firstAvail.name}`}
                                      >
                                        <Zap className="w-3 h-3 text-amber-300 shrink-0" />
                                        <span className="hidden sm:inline">Despachar 1º</span>
                                      </button>
                                    );
                                  }
                                  return null;
                                })()}

                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      assignOrderRespectingLoad(ord.id, e.target.value);
                                    }
                                  }}
                                  defaultValue=""
                                  className="w-24 px-1.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold rounded-lg cursor-pointer focus:outline-none border border-slate-600 truncate"
                                  title="Escolher manualmente outro entregador para este pedido"
                                >
                                  <option value="" disabled className="bg-slate-900 text-slate-400">
                                    Outro...
                                  </option>
                                  {[...motoboys]
                                    .sort((a, b) => {
                                      if (a.status === 'available' && b.status !== 'available') return -1;
                                      if (a.status !== 'available' && b.status === 'available') return 1;
                                      return (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0);
                                    })
                                    .map((m) => (
                                      <option key={m.id} value={m.id} className="text-white bg-slate-900">
                                        {m.name.split(' ')[0]} ({getMotoboyLoad(m.id) > 0 ? `⚠️ ${getMotoboyLoad(m.id)} pedido${getMotoboyLoad(m.id) > 1 ? 's' : ''}` : m.status === 'available' ? '🟢 Livre' : '🛵 Rota'})
                                      </option>
                                    ))}
                                </select>
                              </div>
                            </div>
                          );
                        }

                        {/* Detailed Card View */}
                        return (
                          <div
                            key={ord.id}
                            className={`bg-slate-800 p-3 rounded-xl border transition-all space-y-2 shadow-2xs ${
                              isSelected
                                ? 'border-2 border-emerald-500 bg-slate-800/90 ring-1 ring-emerald-500/30'
                                : 'border-slate-700/80 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedOrderIds((prev) => [...prev, ord.id]);
                                    } else {
                                      setSelectedOrderIds((prev) => prev.filter((id) => id !== ord.id));
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer bg-slate-900 border-slate-700"
                                />
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-sm text-white">
                                    #{ord.codeNumber} - {ord.clientName}
                                  </span>
                                  {renderChannelBadge(ord.originChannel)}
                                </div>
                              </div>
                              {/* Prominent High-Contrast Price Badge */}
                              <span className="px-2.5 py-1 rounded-lg font-black text-xs bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-2xs">
                                {formattedCurrency(ord.total)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center gap-1 shadow-2xs">
                                📍 Bairro: {ord.neighborhood}
                              </span>
                              <span className="text-[10px] bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded font-mono border border-slate-700">
                                {ord.itemsSummary.split('+')[0]}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium line-clamp-1">🏠 {ord.address}</p>

                            <div className="pt-2 border-t border-slate-700/80 space-y-2">
                              {/* Row 1: Quick Action Links */}
                              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onSelectOrderForTracking(ord)}
                                    className="text-[11px] font-extrabold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                                    title="Abrir mapa de rastreio em tempo real"
                                  >
                                    <MapPin className="w-3 h-3 text-emerald-400" /> Rastreio
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const url = `${window.location.origin}/?rastreio=${ord.trackingCode || ord.id}`;
                                      navigator.clipboard.writeText(url);
                                      triggerActionToast(`🔗 Link de rastreio do pedido #${ord.codeNumber} copiado!`);
                                    }}
                                    className="text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-md border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
                                    title="Copiar Link de Rastreio do Cliente"
                                  >
                                    <Copy className="w-3 h-3 text-amber-400" /> Copiar Link
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setTicketOrder(ord);
                                    setIsTicketOpen(true);
                                  }}
                                  className="text-[11px] font-bold text-slate-200 hover:text-white bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded-md border border-slate-600 flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Imprimir Comanda 80mm / Enviar WhatsApp ao Cliente"
                                >
                                  <Printer className="w-3 h-3 text-slate-300" /> Comanda
                                </button>
                              </div>

                              {/* Row 2: Dispatch / Assignment controls */}
                              <div className="flex items-center gap-1.5 pt-0.5">
                                {motoboys.length > 0 && (() => {
                                  const sortedAvailable = [...motoboys]
                                    .filter((m) => m.status === 'available')
                                    .sort((a, b) => (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0));
                                  const firstAvailable = sortedAvailable[0];

                                  if (firstAvailable) {
                                    const firstName = firstAvailable.name.replace(/\s*\(.*?\)\s*/g, '').trim().split(' ')[0];
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          assignOrderRespectingLoad(ord.id, firstAvailable.id);
                                        }}
                                        className="flex-1 min-w-0 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center justify-center gap-1 transition-all cursor-pointer truncate"
                                        title={`Despachar imediatamente para 1º da fila: ${firstAvailable.name}`}
                                      >
                                        <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                                        <span className="truncate">Despachar 1º ({firstName})</span>
                                      </button>
                                    );
                                  }

                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        triggerActionToast('⚠️ NENHUM MOTOBOY DISPONÍVEL NA FILA DA LOJA NO MOMENTO.');
                                      }}
                                      className="flex-1 min-w-0 px-2 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 text-xs font-bold rounded-lg border border-slate-700/80 flex items-center justify-center gap-1 transition-all cursor-pointer truncate"
                                      title="Nenhum motoboy disponível na fila da loja no momento"
                                    >
                                      <Zap className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                      <span className="truncate text-slate-400 font-semibold">Fila Vazia</span>
                                    </button>
                                  );
                                })()}

                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      assignOrderRespectingLoad(ord.id, e.target.value);
                                    }
                                  }}
                                  defaultValue=""
                                  className="w-28 shrink-0 px-1.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg cursor-pointer focus:outline-none transition-colors border border-slate-600 truncate"
                                  title="Escolher manualmente outro entregador para este pedido"
                                >
                                  <option value="" disabled className="bg-slate-900 text-slate-400">
                                    Outro entregador...
                                  </option>
                                  {[...motoboys]
                                    .sort((a, b) => {
                                      if (a.status === 'available' && b.status !== 'available') return -1;
                                      if (a.status !== 'available' && b.status === 'available') return 1;
                                      return (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0);
                                    })
                                    .map((m) => {
                                      const isAvail = m.status === 'available';
                                      const currentLoad = getMotoboyLoad(m.id);
                                      const statusLabel = currentLoad > 0
                                        ? `⚠️ ${currentLoad} pedido${currentLoad > 1 ? 's' : ''}`
                                        : isAvail
                                        ? '🟢 Livre'
                                        : m.status === 'on_delivery'
                                        ? '🛵 Rota'
                                        : m.status === 'break'
                                        ? '☕ Pausa'
                                        : '🔴 Off';
                                      return (
                                        <option key={m.id} value={m.id} className="text-white bg-slate-900">
                                          {m.name.split(' ')[0]} ({statusLabel})
                                        </option>
                                      );
                                    })}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

                {/* Middle & Right Column: Map + Rotas Disponíveis (Dynamic Full Span when empty) */}
                <div className={`${unassignedOrders.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'} grid grid-cols-1 md:grid-cols-12 gap-3`}>
                  {/* Map Panel with Sleek Filter Controls */}
                  <div id="dashboard-map-section" className="md:col-span-7 h-[380px] md:h-auto min-h-[320px] flex flex-col bg-slate-900/90 rounded-2xl border border-slate-800 p-2.5 space-y-2.5 shadow-sm">
                  {/* Clean Toolbar Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1 pt-0.5">
                    {/* Left: Title & GPS Sync Button */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-200 tracking-wide flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-emerald-400" />
                        Visão do Mapa
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined' && 'geolocation' in navigator) {
                            triggerActionToast('📍 Buscando sua localização atual pelo GPS...');
                            navigator.geolocation.getCurrentPosition(
                              (pos) => {
                                const lat = Number(pos.coords.latitude.toFixed(6));
                                const lng = Number(pos.coords.longitude.toFixed(6));
                                const ruan = motoboys.find((m) => m.username === 'ruan' || m.name.toLowerCase().includes('ruan'));
                                if (ruan) {
                                  const updatedRuan = { ...ruan, currentLat: lat, currentLng: lng };
                                  saveMotoboyToCloud(updatedRuan);
                                  triggerActionToast(`📍 Posição do Ruan atualizada: ${lat}, ${lng}`);
                                } else {
                                  triggerActionToast(`📍 Posição GPS capturada: ${lat}, ${lng}`);
                                }
                              },
                              (err) => triggerActionToast(`⚠️ Permissão de GPS pendente: ${err.message}`),
                              { enableHighAccuracy: true }
                            );
                          } else {
                            triggerActionToast('⚠️ Dispositivo sem suporte a geolocalização');
                          }
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 border border-slate-700/80 hover:border-emerald-500/40 rounded-xl transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-2xs"
                        title="Atualizar minha posição GPS no mapa"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Right: Motoboy Dropdown & Segmented Filter Tabs */}
                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
                      {/* Motoboy Filter Selector */}
                      <div className="flex items-center gap-1.5">
                        <select
                          value={selectedMotoboyId || ''}
                          onChange={(e) => setSelectedMotoboyId(e.target.value || null)}
                          className="bg-slate-800/90 text-slate-100 border border-slate-700/80 text-xs font-semibold rounded-xl px-2.5 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs transition-all"
                          title="Filtrar o mapa para focar em apenas 1 motoboy"
                        >
                          <option value="">
                            🌐 Frota: {motoboys.filter((m) => m.status !== 'offline').length}{' '}
                            {motoboys.filter((m) => m.status !== 'offline').length === 1 ? 'motoboy ativo' : 'motoboys ativos'}
                          </option>
                          {motoboys
                            .filter((m) => m.status !== 'offline')
                            .map((m) => {
                              let locLabel = 'Na loja';
                              if (m.status === 'delivering') {
                                locLabel = 'Em rota';
                              } else if (m.status === 'returning_to_store') {
                                locLabel = 'Voltando';
                              } else if (m.currentLat && m.currentLng && shift.storeLat && shift.storeLng) {
                                const dist = calculateDistanceKm(m.currentLat, m.currentLng, shift.storeLat, shift.storeLng);
                                if (dist > 0.3) {
                                  locLabel = `Disponível (${dist.toFixed(1)} km)`;
                                }
                              }
                              return (
                                <option key={m.id} value={m.id}>
                                  🛵 {m.name} • {locLabel}
                                </option>
                              );
                            })}
                        </select>

                        {selectedMotoboyId && (
                          <button
                            type="button"
                            onClick={() => setSelectedMotoboyId(null)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs"
                            title="Voltar a ver a frota inteira no mapa"
                          >
                            <X className="w-3.5 h-3.5 text-slate-400" />
                            <span>Ver todos</span>
                          </button>
                        )}
                      </div>

                      {/* Map Layer Filter Tabs */}
                      <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => setMapFilter('all')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            mapFilter === 'all'
                              ? 'bg-emerald-500 text-slate-950 shadow-2xs font-extrabold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Todos ({activeOrders.length + motoboys.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setMapFilter('returning')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            mapFilter === 'returning'
                              ? 'bg-amber-500 text-slate-950 shadow-2xs font-extrabold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          ⚡ Voltando ({returningMotoboysWithDistance.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setMapFilter('orders')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            mapFilter === 'orders'
                              ? 'bg-blue-500 text-white shadow-2xs font-extrabold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          📦 Pedidos ({activeOrders.length})
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 rounded-xl overflow-hidden border border-slate-800">
                    <RouteMap
                      origin={{
                        name: shift.storeName,
                        address: shift.storeAddress,
                        lat: shift.storeLat,
                        lng: shift.storeLng,
                      }}
                      selectedMotoboyId={selectedMotoboyId}
                      onSelectMotoboy={(id) => setSelectedMotoboyId(id)}
                      motoboysList={
                        mapFilter === 'all'
                          ? motoboys.filter((m) => m.status !== 'offline')
                          : mapFilter === 'returning'
                          ? returningMotoboysWithDistance
                          : []
                      }
                      stops={
                        mapFilter === 'returning'
                          ? []
                          : activeOrders
                              .filter((ord) => {
                                if (!selectedMotoboyId) return true;
                                const focusedMb = motoboys.find((mb) => mb.id === selectedMotoboyId);
                                return (
                                  ord.assignedMotoboyId === selectedMotoboyId ||
                                  (focusedMb && ord.assignedMotoboyName?.toLowerCase() === focusedMb.name.toLowerCase()) ||
                                  (focusedMb?.username && ord.assignedMotoboyId?.toLowerCase() === focusedMb.username.toLowerCase())
                                );
                              })
                              .map((ord, idx) => ({
                                id: ord.id,
                                orderIndex: idx + 1,
                                title: `#${ord.codeNumber} - ${ord.clientName}`,
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

                {/* Rotas disponíveis dos Motoboys */}
                <div className="md:col-span-5 bg-slate-900/60 rounded-2xl p-3 border border-slate-700/70 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                      <h4 className="font-extrabold text-sm text-white tracking-tight">Equipe</h4>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {(() => {
                          const activeCount = motoboys.filter((m) => m.status !== 'offline').length;
                          const availableCount = motoboys.filter((m) => m.status === 'available').length;
                          const deliveringCount = motoboys.filter((m) => m.status === 'delivering').length;
                          const returningCount = motoboys.filter((m) => m.status === 'returning_to_store').length;

                          const parts = [
                            `${activeCount} ${activeCount === 1 ? 'motoboy ativo' : 'motoboys ativos'}`,
                            `${availableCount} na loja`
                          ];
                          if (deliveringCount > 0) parts.push(`${deliveringCount} em rota`);
                          if (returningCount > 0) parts.push(`${returningCount} retornando`);
                          return parts.join(' · ');
                        })()}
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-0.5">
                      {motoboys.map((m) => {
                        const availableMotoboys = [...motoboys]
                          .filter((x) => x.status === 'available')
                          .sort((a, b) => (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0));
                        const queuePos = m.status === 'available' ? availableMotoboys.findIndex((x) => x.id === m.id) + 1 : null;

                        const mOrders = orders
                          .filter(
                            (o) =>
                              o.status !== 'delivered' &&
                              o.status !== 'cancelled' &&
                              (o.assignedMotoboyId === m.id ||
                                o.assignedMotoboyName?.toLowerCase() === m.name.toLowerCase() ||
                                (m.username && o.assignedMotoboyId?.toLowerCase() === m.username.toLowerCase()) ||
                                o.assignedMotoboyId?.toLowerCase() === m.name.toLowerCase())
                          )
                          .sort((a, b) => (a.routeSequence || 0) - (b.routeSequence || 0));

                        const isDriverInTransit = m.status === 'delivering' || mOrders.some((o) => o.status === 'in_transit');
                        const allOrdersReady = mOrders.length > 0 && !isDriverInTransit && mOrders.every((o) => o.status === 'ready_at_counter' || o.status === 'picked_up');
                        const allOrdersInTransit = mOrders.length > 0 && mOrders.every((o) => o.status === 'in_transit');

                        const circleNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

                        const isThisMotoboyFocused = selectedMotoboyId === m.id;

                        return (
                          <div
                            key={m.id}
                            className={`p-3 rounded-xl border transition-all space-y-2 shadow-2xs ${
                              isThisMotoboyFocused
                                ? 'bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/40'
                                : 'bg-slate-800/90 border-slate-700/80'
                            }`}
                          >
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-extrabold text-sm text-white">{m.name}</span>
                                  {isDriverInTransit ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                      🔵 EM ROTA
                                    </span>
                                  ) : m.status === 'available' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                      🟢 NA LOJA {queuePos ? `• ${queuePos}º DA FILA` : ''}
                                    </span>
                                  ) : m.status === 'returning_to_store' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      🟠 RETORNANDO À LOJA
                                    </span>
                                  ) : m.status === 'busy' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                      ⏸️ PAUSADO
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-700 text-slate-400 border border-slate-600">
                                      ⚫ OFFLINE
                                    </span>
                                  )}
                                </div>

                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                  {m.status === 'offline' ? (
                                    'Fora de turno (Offline)'
                                  ) : m.status === 'busy' ? (
                                    'Indisponível (Pausado)'
                                  ) : isDriverInTransit ? (
                                    `Em rota de entrega na rua • ${mOrders.length} ${mOrders.length === 1 ? 'parada restante' : 'paradas restantes'}`
                                  ) : m.status === 'returning_to_store' ? (
                                    mOrders.length === 0
                                      ? 'Finalizou rota anterior e está retornando à loja'
                                      : `Retornando à loja (Já possui ${mOrders.length} ${mOrders.length === 1 ? 'pedido' : 'pedidos'} vinculados para a próxima rota)`
                                  ) : mOrders.length === 0 ? (
                                    queuePos
                                      ? `${queuePos}º lugar na fila de despacho • Na fila há ${
                                          m.joinedQueueAt ? Math.max(0, Math.floor((Date.now() - m.joinedQueueAt) / 60000)) : 0
                                        } min`
                                      : 'Disponível na loja'
                                  ) : allOrdersReady ? (
                                    `${mOrders.length} ${mOrders.length === 1 ? 'pedido pronto' : 'pedidos prontos'} para saída`
                                  ) : (
                                    `${mOrders.length} ${mOrders.length === 1 ? 'pedido' : 'pedidos'} • próxima saída com ${mOrders.length} ${mOrders.length === 1 ? 'parada' : 'paradas'}`
                                  )}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => setSelectedMotoboyId(isThisMotoboyFocused ? null : m.id)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                                  isThisMotoboyFocused
                                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-md'
                                    : 'bg-slate-700/80 hover:bg-slate-700 text-slate-200 border-slate-600'
                                }`}
                              >
                                {isThisMotoboyFocused ? '🎯 Focado' : '🗺️ Mapa'}
                              </button>
                            </div>

                            {/* Live Tracking Quick Banner for Driver in Transit */}
                            {mOrders.length > 0 && (m.status === 'delivering' || mOrders.some((o) => o.status === 'in_transit')) && (
                              <div className="bg-sky-950/80 border border-sky-500/50 p-2.5 rounded-xl flex flex-col gap-1.5 text-xs text-sky-200">
                                <div className="flex items-center justify-between font-black text-sky-300">
                                  <span className="flex items-center gap-1.5">
                                    <MapPin className="w-4 h-4 text-sky-400 animate-pulse" />
                                    <span>Rastreamento em Tempo Real</span>
                                  </span>
                                  <span className="text-[10px] bg-sky-900/90 text-sky-200 px-2 py-0.5 rounded-md border border-sky-600/50 uppercase font-black">
                                    📡 Sinal Ativo
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const activeOrder = mOrders.find((o) => o.status === 'in_transit') || mOrders[0];
                                      if (activeOrder) onSelectOrderForTracking(activeOrder);
                                    }}
                                    className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-extrabold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs uppercase"
                                  >
                                    <MapPin className="w-3 h-3 text-sky-200" />
                                    <span>Mapa ao Vivo</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const activeOrder = mOrders.find((o) => o.status === 'in_transit') || mOrders[0];
                                      if (activeOrder) {
                                        const url = `${window.location.origin}/?rastreio=${activeOrder.trackingCode || activeOrder.id}`;
                                        navigator.clipboard.writeText(url);
                                        triggerActionToast(`🔗 Link de rastreio de ${m.name.split(' ')[0]} copiado!`);
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-300 font-extrabold text-[11px] rounded-lg border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3 text-amber-400" />
                                    <span>Copiar Link</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const activeOrder = mOrders.find((o) => o.status === 'in_transit') || mOrders[0];
                                      if (activeOrder) {
                                        const trackingUrl = `${window.location.origin}/?rastreio=${activeOrder.trackingCode || activeOrder.id}`;
                                        const cleanPhone = activeOrder.clientPhone ? activeOrder.clientPhone.replace(/\D/g, '') : '';
                                        const msg = `Olá *${activeOrder.clientName}*! 🛵 O motoboy *${m.name}* está a caminho com seu pedido *#${activeOrder.codeNumber}*!\n\n📍 *Acompanhe no mapa em tempo real:* ${trackingUrl}`;
                                        const url = cleanPhone
                                          ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`
                                          : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
                                        window.open(url, '_blank');
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                  >
                                    <span>💬 Enviar Whats</span>
                                  </button>
                                </div>
                              </div>
                            )}

                             {/* Order Items List inside Driver Card */}
                            {mOrders.length > 0 && (
                              <div className="space-y-1.5 pt-1 max-h-56 overflow-y-auto pr-1">
                                {mOrders.map((ord, idx) => {
                                  const isOrdInTransit = ord.status === 'in_transit' || isDriverInTransit;
                                  const isOrdReady = (ord.status === 'ready_at_counter' || ord.status === 'picked_up') && !isDriverInTransit;
                                  const numSymbol = circleNumbers[idx] || `(${idx + 1})`;

                                  return (
                                    <div
                                      key={ord.id}
                                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs text-slate-200"
                                    >
                                      <div className="min-w-0 flex-1 pr-2">
                                        <div className="flex items-center gap-1.5 truncate">
                                          <span className="text-amber-400 font-bold shrink-0">{numSymbol}</span>
                                          <span className="font-extrabold text-white truncate">#{ord.codeNumber}</span>
                                          <span className="text-slate-400 text-[11px] truncate">— {ord.street || ord.address}</span>
                                        </div>

                                        <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                                          {isOrdInTransit ? (
                                            <span className="text-blue-400 font-bold">
                                              🔵 Em rota
                                            </span>
                                          ) : isOrdReady ? (
                                            <span className="text-emerald-400 font-bold">
                                              🟢 Pronto
                                            </span>
                                          ) : (
                                            <span className="text-amber-400 font-medium">
                                              🟠 Em cozinha
                                            </span>
                                          )}
                                          <span className="text-slate-400 line-clamp-1">• {ord.clientName}</span>
                                        </div>
                                      </div>

                                      {/* Order Action Buttons */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => onSelectOrderForTracking(ord)}
                                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-md border border-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-extrabold"
                                          title="Abrir mapa de rastreio em tempo real do pedido"
                                        >
                                          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                                          <span className="hidden sm:inline">Rastreio</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const url = `${window.location.origin}/?rastreio=${ord.trackingCode || ord.id}`;
                                            navigator.clipboard.writeText(url);
                                            triggerActionToast(`🔗 Link do pedido #${ord.codeNumber} copiado!`);
                                          }}
                                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-md border border-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-extrabold"
                                          title="Copiar Link de Rastreio do Cliente"
                                        >
                                          <Copy className="w-3.5 h-3.5 text-amber-400" />
                                          <span className="hidden sm:inline">Link</span>
                                        </button>

                                        {/* Up/Down reorder arrows if >1 orders */}
                                        {mOrders.length > 1 && onReorderMotoboyRoute && (
                                          <div className="flex items-center gap-0.5 shrink-0 bg-slate-950 p-0.5 rounded border border-slate-800">
                                            {idx > 0 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const reordered = [...mOrders];
                                                  const temp = reordered[idx];
                                                  reordered[idx] = reordered[idx - 1];
                                                  reordered[idx - 1] = temp;
                                                  onReorderMotoboyRoute(reordered.map((o) => o.id));
                                                }}
                                                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer text-[10px]"
                                                title="Mover para cima"
                                              >
                                                ▲
                                              </button>
                                            )}
                                            {idx < mOrders.length - 1 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const reordered = [...mOrders];
                                                  const temp = reordered[idx];
                                                  reordered[idx] = reordered[idx + 1];
                                                  reordered[idx + 1] = temp;
                                                  onReorderMotoboyRoute(reordered.map((o) => o.id));
                                                }}
                                                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer text-[10px]"
                                                title="Mover para baixo"
                                              >
                                                ▼
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Card Footer Actions */}
                            <div className="pt-1.5 flex items-center gap-1.5">
                              {m.status === 'returning_to_store' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onConfirmArrivalAtStore) {
                                      onConfirmArrivalAtStore(m.id);
                                    } else if (onUpdateMotoboyStatus) {
                                      onUpdateMotoboyStatus(m.id, 'available');
                                    }
                                    triggerActionToast(`🏪 Chegada de ${m.name.split(' ')[0]} confirmada! Ele está na fila para a próxima rota.`);
                                  }}
                                  className="w-full py-2.5 px-3 bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase animate-pulse"
                                >
                                  <span>🏪</span>
                                  <span>Confirmar Chegada de {m.name.split(' ')[0]} na Loja</span>
                                </button>
                              ) : mOrders.length > 0 ? (
                                <>
                                  {isDriverInTransit ? (
                                    <div className="flex-1 py-2 px-3 bg-blue-950/60 border border-blue-500/30 text-blue-300 text-center font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                                      <span>🛵</span>
                                      <span>Em rota na rua ({mOrders.length} {mOrders.length === 1 ? 'parada restante' : 'paradas restantes'})</span>
                                    </div>
                                  ) : allOrdersReady ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        mOrders.forEach((o) => {
                                          if (o.status !== 'in_transit') {
                                            onUpdateOrderStatus(o.id, 'in_transit');
                                          }
                                        });
                                        if (onUpdateMotoboyStatus) {
                                          onUpdateMotoboyStatus(m.id, 'delivering');
                                        }
                                        triggerActionToast(`🛵 ${m.name.split(' ')[0]} liberado para saída!`);
                                      }}
                                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <span>🛵</span>
                                      <span>Liberar {m.name.split(' ')[0]} para Saída ({mOrders.length} {mOrders.length === 1 ? 'parada' : 'paradas'})</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleNotifyMotoboyInApp(m)}
                                      className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <span>🔔</span>
                                      <span>Avisar que está pronto</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleSendWhatsAppToMotoboy(m)}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer"
                                    title="Avisar via WhatsApp"
                                  >
                                    <span>📱</span>
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Resumo Rápido Card matching Mockup */}
            <div className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800 space-y-2">
              <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider">Resumo rápido</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block font-medium">Pedidos no balcão</span>
                  <strong className="text-white text-sm font-bold">{readyAtCounter.length} prontos</strong>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block font-medium">Motoboys ativos</span>
                  <strong className="text-white text-sm font-bold">{motoboysAvailable.length} na fila</strong>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block font-medium">Próxima entrega</span>
                  <strong className="text-emerald-400 text-xs font-bold line-clamp-1">
                    {unassignedOrders.length > 0 && unassignedOrders[0]?.address
                      ? `${unassignedOrders[0].address}${unassignedOrders[0].neighborhood ? ` • ${unassignedOrders[0].neighborhood}` : ''}`
                      : 'Nenhuma entrega na fila'}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TEAM TAB */}
      {activeTab === 'equipe' && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700/80 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-lg text-white">Gestão da Equipe de Motoboys</h3>
              <p className="text-xs text-slate-400">Cadastre, edite e controle os entregadores da loja.</p>
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
                  className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 font-bold text-xs rounded-xl border border-rose-800/60 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Remover todos os motoboys para cadastrar do zero"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
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
            <div className="bg-slate-900/60 border border-dashed border-slate-700 rounded-2xl p-8 text-center space-y-2">
              <div className="w-12 h-12 bg-slate-800 border border-slate-700 text-slate-300 rounded-full flex items-center justify-center mx-auto text-xl">
                🛵
              </div>
              <h4 className="font-bold text-white text-sm">Nenhum motoboy cadastrado</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Sua lista de entregadores está limpa. Clique em "Cadastrar Novo Motoboy" acima para adicionar seus entregadores.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {motoboys.map((m) => (
                <div key={m.id} className="p-4 rounded-2xl border border-slate-700 bg-slate-900/70 space-y-3 relative group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-white flex items-center justify-center font-bold text-base shrink-0">
                        🛵
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-sm text-white">{m.name}</h4>
                          {/* Queue & Operational Status Tag */}
                          {(() => {
                            if (m.status === 'available') {
                              const queueIdx = motoboysAvailable.findIndex((x) => x.id === m.id) + 1;
                              return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                                  🟢 {queueIdx > 0 ? `${queueIdx}º da Fila` : 'Fila de Espera'}
                                </span>
                              );
                            }
                            if (m.status === 'returning_to_store') {
                              return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                                  🟡 Voltando à Loja
                                </span>
                              );
                            }
                            if (m.status === 'delivering') {
                              return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase">
                                  🔵 Em Rota ({m.activeOrdersCount || 1} pedido{m.activeOrdersCount > 1 ? 's' : ''})
                                </span>
                              );
                            }
                            return (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                                🔴 Offline
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{m.vehicleModel} • {m.plate}</p>
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
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                        title={`Remover ${m.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Arranque</span>
                      <span className="font-bold text-slate-200">{formattedCurrency(m.fixedFee)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Taxa por corrida</span>
                      <span className="font-bold text-slate-200">{formattedCurrency(m.perDeliveryFee)}</span>
                    </div>
                  </div>

                  {/* Login credentials box created by store for motoboy */}
                  <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700 space-y-1 text-xs">
                    <span className="text-[10px] font-extrabold text-amber-300 uppercase block">
                      🔐 Credenciais do App (Motoboy)
                    </span>
                    <div className="flex items-center justify-between font-mono text-[11px] text-slate-200 font-semibold">
                      <span>Usuário: <strong className="text-white">{m.username || m.name.toLowerCase().split(' ')[0]}</strong></span>
                      <span>Senha: <strong className="text-white">{m.password || 'Não definida'}</strong></span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Ganho acumulado hoje:</span>
                    <span className="font-black text-emerald-400">{formattedCurrency(m.totalEarnedToday)}</span>
                  </div>

                  {/* ⚡ Quick Actions per Motoboy Card */}
                  <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
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
                        className="w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md border border-blue-400/40"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0" />
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
                        className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-400 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-slate-700 hover:border-slate-600"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
                          <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0" />
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
                          className="p-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                          title={`Ligar para ${m.phone}`}
                        >
                          <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="text-[10px]">Ligar</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSendWhatsAppToMotoboy(m)}
                        className="p-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer shrink-0 flex items-center gap-1"
                        title="Enviar WhatsApp"
                      >
                        📱
                        <span className="text-[10px]">Whats</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FINANCE TAB */}
      {activeTab === 'financeiro' && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700/80 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-white">Resumo Financeiro do Turno</h3>
              <p className="text-xs text-slate-400">Controle de faturamento e fechamento de caixa com os motoboys.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsSettlementOpen(true)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl shadow-2xs border border-slate-600 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-slate-300" /> Abrir Acerto de Caixa dos Motoboys
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-700">
              <span className="text-xs font-bold text-slate-400 block">Faturamento Bruto</span>
              <span className="text-2xl font-black text-emerald-400">{formattedCurrency(totalRevenue)}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-700">
              <span className="text-xs font-bold text-slate-400 block">Total de Vendas (Pedidos)</span>
              <span className="text-2xl font-black text-white">{orders.length} pedidos</span>
            </div>
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60">
              <span className="text-xs font-bold text-amber-300 block">Comissão Motoboys (A pagar)</span>
              <span className="text-2xl font-black text-amber-200">
                {formattedCurrency(motoboys.reduce((acc, m) => acc + m.totalEarnedToday, 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'historico' && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700/80 p-5 space-y-4">
          <h3 className="font-bold text-lg text-white">Histórico Completo de Pedidos Lançados</h3>
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="p-3 rounded-xl border border-slate-700 bg-slate-900/70 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white">#{o.codeNumber} • {o.clientName}</span>
                  <p className="text-slate-400">{o.itemsSummary} — {o.address}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="font-bold text-emerald-400 block">{formattedCurrency(o.total)}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">{o.paymentMethod}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectOrderForTracking(o)}
                    className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1"
                    title="Ver Rastreio / Mapa"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/?rastreio=${o.trackingCode || o.id}`;
                      navigator.clipboard.writeText(url);
                      triggerActionToast(`🔗 Link de rastreio de #${o.codeNumber} copiado!`);
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-bold transition-all cursor-pointer"
                    title="Copiar Link de Rastreio"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTicketOrder(o);
                      setIsTicketOpen(true);
                    }}
                    className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all cursor-pointer"
                    title="Imprimir comanda 80mm"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
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
                const targetId = availableFirst?.id || motoboys[0]?.id;
                if (targetId && onAssignBatchToMotoboy) {
                  onAssignBatchToMotoboy(selectedOrderIds, targetId);
                  setSelectedOrderIds([]);
                } else if (targetId) {
                  selectedOrderIds.forEach((id) => onAssignOrderToMotoboy(id, targetId));
                  setSelectedOrderIds([]);
                }
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5 uppercase tracking-wide border border-emerald-400/40"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300 shrink-0" />
              <span>Despachar Selecionados</span>
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
  );
};
