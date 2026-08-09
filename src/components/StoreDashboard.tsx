import React, { useState } from 'react';
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
  Package,
  ShoppingBag,
  Building2,
  Trash2,
  Volume2,
  VolumeX,
  BarChart3,
} from 'lucide-react';
import { RouteMap } from './RouteMap';
import { ThermalTicketModal } from './ThermalTicketModal';
import { MotoboySettlementModal } from './MotoboySettlementModal';
import { DeliveryHistoryModal } from './DeliveryHistoryModal';
import { getSoundEnabled, setSoundEnabled, playNewOrderSound } from '../utils/soundUtils';
import { calculateDistanceKm, calculateRoadDistanceKm } from '../utils/geoUtils';

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
}) => {
  const [activeTab, setActiveTab] = useState<'operacao' | 'equipe' | 'financeiro' | 'historico'>('operacao');
  const [selectedMotoboyId, setSelectedMotoboyId] = useState<string | null>(motoboys[0]?.id || null);

  // Multi-select for multi-order grouping/bag dispatch
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Modal states for Step 4 & 5 & History Report & Sound
  const [ticketOrder, setTicketOrder] = useState<Order | null>(null);
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [soundActive, setSoundActive] = useState(() => getSoundEnabled());
  const [actionToast, setActionToast] = useState<string | null>(null);

  const triggerActionToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3500);
  };

  const [mapFilter, setMapFilter] = useState<'all' | 'returning' | 'orders'>('all');

  // Derived metrics matching screenshot
  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const readyAtCounter = orders.filter((o) => o.status === 'ready_at_counter');
  const unassignedOrders = activeOrders.filter((o) => !o.assignedMotoboyId);
  const deliveredToday = orders.filter((o) => o.status === 'delivered');
  const totalRevenue = orders.reduce((acc, o) => acc + o.total, 0);
  const motoboysAvailable = motoboys.filter((m) => m.status === 'available');

  // Calculate Motoboys returning to store (~5 min / <= 4.2 km road distance away without active orders, or explicitly 'returning_to_store')
  const returningMotoboysWithDistance = motoboys.map((m) => {
    const mActiveOrders = orders.filter(
      (o) => o.status !== 'delivered' && o.status !== 'cancelled' && o.assignedMotoboyId === m.id
    );
    let distKm = 0;
    if (m.currentLat && m.currentLng && shift.storeLat && shift.storeLng) {
      distKm = calculateRoadDistanceKm(m.currentLat, m.currentLng, shift.storeLat, shift.storeLng);
    }
    const isExplicitReturning = m.status === 'returning_to_store';
    const isNearbyReturning = mActiveOrders.length === 0 && distKm > 0 && distKm <= 4.2 && m.status !== 'offline';
    const isReturning = isExplicitReturning || isNearbyReturning;
    const estMin = Math.max(1, Math.round((distKm / 28) * 60) || 5);

    return {
      ...m,
      isReturning,
      distKm,
      estMin,
    };
  }).filter((m) => m.isReturning);

  const returningMotoboys = motoboys.filter((m) => m.status === 'returning_to_store');

  const formattedCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

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

      {/* ⚡ PROACTIVE RETURNING MOTOBOY ALERT BANNER (~5 min) */}
      {returningMotoboysWithDistance.length > 0 && (
        <div className="bg-amber-950/90 border-2 border-amber-500/80 text-amber-100 p-3.5 px-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shrink-0 shadow-md">
              🛵
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px] uppercase">
                  Aviso de Retorno (~5 min)
                </span>
                <span className="text-amber-300 text-xs font-bold">Acelere os próximos pedidos no balcão!</span>
              </div>
              <p className="text-xs text-amber-200 mt-1 font-semibold">
                {returningMotoboysWithDistance.map(
                  (m) => `${m.name} (${m.distKm > 0 ? `${m.distKm.toFixed(1)} km - ` : ''}~${m.estMin} min da loja)`
                ).join(' • ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onConfirmArrivalAtStore && returningMotoboysWithDistance[0]) {
                onConfirmArrivalAtStore(returningMotoboysWithDistance[0].id);
                triggerActionToast(`✅ Chegada do entregador ${returningMotoboysWithDistance[0].name} confirmada na loja!`);
              }
            }}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md shrink-0 border border-amber-300"
          >
            Confirmar Chegada na Loja 🟢
          </button>
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

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={() => {
              const next = !soundActive;
              setSoundEnabled(next);
              setSoundActive(next);
              if (next) playNewOrderSound();
            }}
            className={`px-2.5 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1 border transition-all cursor-pointer ${
              soundActive
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/80'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title={soundActive ? 'Som ativado (Clique para mutar)' : 'Som desativado (Clique para atvar)'}
          >
            {soundActive ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            <span className="hidden md:inline">{soundActive ? 'Som ON' : 'Som OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Relatórios e Histórico de Entregas"
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Relatórios</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewOrderModal}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Lançar Pedido
          </button>
          <button
            type="button"
            onClick={onOpenMotoboyModal}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl border border-slate-700/60 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            Motoboy
          </button>
          <button
            type="button"
            onClick={() => setIsSettlementOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl border border-slate-700/60 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-400" />
            Acerto
          </button>
          <button
            type="button"
            onClick={onToggleShift}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl border border-slate-700/60 transition-all cursor-pointer"
            title={shift.isOpen ? 'Encerrar Expediente' : 'Abrir Expediente'}
          >
            <Power className="w-4 h-4 text-rose-400" />
          </button>
        </div>
      </div>

      {/* 2. SUB NAVIGATION TABS */}
      <div className="bg-slate-900/60 p-1 rounded-xl border border-slate-800/40 flex items-center justify-between overflow-x-auto text-xs font-medium text-slate-400">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('operacao')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'operacao'
                ? 'bg-slate-800 text-white font-semibold shadow-2xs'
                : 'hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Operação
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'operacao' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-400'
            }`}>
              {activeOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('equipe')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'equipe'
                ? 'bg-slate-800 text-white font-semibold shadow-2xs'
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
                ? 'bg-slate-800 text-white font-semibold shadow-2xs'
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
                ? 'bg-slate-800 text-white font-semibold shadow-2xs'
                : 'hover:text-slate-200'
            }`}
          >
            Histórico
          </button>
        </div>
      </div>

      {activeTab === 'operacao' && (
        <div className="space-y-4">

          {/* ALERT BANNER: MOTOBOY RETURNING TO STORE */}
          {returningMotoboys.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-500/30 p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
                  <Bike className="w-4 h-4 text-slate-950" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-300 text-xs flex items-center gap-2">
                    <span>MOTOBOY RETORNANDO À LOJA</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                      {returningMotoboys.length} {returningMotoboys.length === 1 ? 'entregador' : 'entregadores'}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-300">
                    <strong className="text-white">{returningMotoboys.map((m) => m.name).join(', ')}</strong> finalizou entregas e está chegando.
                  </p>
                </div>
              </div>

              {onConfirmArrivalAtStore && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  {returningMotoboys.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onConfirmArrivalAtStore(m.id)}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Confirmar Chegada: {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. STRIPE-STYLE CLEAN METRICS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* CARD 1: Pedidos Ativos */}
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/60 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Pedidos Ativos</span>
                {unassignedOrders.length > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400">
                    {unassignedOrders.length} aguardando
                  </span>
                )}
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white tracking-tight">{activeOrders.length}</span>
                <span className="text-xs text-slate-400 font-medium">
                  {readyAtCounter.length} prontos no balcão
                </span>
              </div>
            </div>

            {/* CARD 2: Motoboys na Fila */}
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/60 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Motoboys na fila</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-400">
                  Fila de Rodízio
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white tracking-tight">
                  {motoboysAvailable.length}/{motoboys.length}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {motoboysAvailable.length > 0 ? 'disponíveis na loja' : 'todos em entrega'}
                </span>
              </div>
            </div>

            {/* CARD 3: Entregues Hoje */}
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/60 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Entregues hoje</span>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white tracking-tight">{deliveredToday.length}</span>
                <span className="text-xs text-slate-400 font-medium">concluídos hoje</span>
              </div>
            </div>

            {/* CARD 4: Faturamento Hoje */}
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/60 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Faturamento hoje</span>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-emerald-400 tracking-tight">{formattedCurrency(totalRevenue)}</span>
                <span className="text-xs text-slate-400 font-medium">{orders.length} pedidos lançados</span>
              </div>
            </div>
          </div>

          {/* 5. DESPACHO VISUAL SECTION */}
          <div className="bg-slate-900/60 rounded-xl border border-slate-800/60 shadow-2xs p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 tracking-tight">Próximo despacho</h3>

              <span className="text-xs text-slate-400 font-medium">
                <strong className="text-amber-400">{unassignedOrders.length}</strong> aguardando despacho
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* Left Column: Pedidos sem motoboy (42% width) */}
              <div className="lg:col-span-5 bg-slate-900/60 rounded-xl p-3 border border-slate-700/70 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-bold text-xs text-slate-300 uppercase">
                    Pedidos sem motoboy ({unassignedOrders.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onOpenNewOrderModal}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-100" />
                      Lançar Pedido
                    </button>
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
                        className="text-[11px] font-bold text-slate-300 hover:text-white underline cursor-pointer"
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
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-white space-y-2 shadow-sm animate-fade-in">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-white flex items-center gap-1 font-extrabold">
                        🎒 Bag Ativa ({selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'pedido' : 'pedidos'})
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
                        {motoboys.map((m, idx) => (
                          <option key={m.id} value={m.id}>
                            {idx + 1}º Fila: {m.name} ({m.activeOrdersCount} paradas)
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          const selectElem = document.getElementById('batchMotoboySelect') as HTMLSelectElement;
                          const targetId = selectElem?.value || motoboys[0]?.id;
                          if (targetId && onAssignBatchToMotoboy) {
                            onAssignBatchToMotoboy(selectedOrderIds, targetId);
                            setSelectedOrderIds([]);
                          } else if (targetId) {
                            selectedOrderIds.forEach((id) => onAssignOrderToMotoboy(id, targetId));
                            setSelectedOrderIds([]);
                          }
                        }}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-2xs shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" /> Despachar Bag
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {unassignedOrders.length === 0 ? (
                    <div className="p-5 text-center bg-slate-900/80 rounded-xl border border-slate-700/70 my-2 space-y-2 shadow-2xs">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center mx-auto text-lg font-bold">
                        ✓
                      </div>
                      <h5 className="text-sm font-extrabold text-white">Todos os pedidos estão em rota!</h5>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto">
                        Nenhum pedido pendente aguardando despacho. Novos pedidos lançados aparecerão aqui automaticamente.
                      </p>
                    </div>
                  ) : (
                    unassignedOrders.map((ord) => {
                      const isSelected = selectedOrderIds.includes(ord.id);
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
                              <span className="font-extrabold text-sm text-white">
                                #{ord.codeNumber} - {ord.clientName}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-emerald-400 border border-slate-700">
                              {formattedCurrency(ord.total)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-300">📍 {ord.neighborhood}</p>
                            <span className="text-[10px] bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded font-mono border border-slate-700">
                              {ord.itemsSummary.split('+')[0]}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1">{ord.address}</p>

                          <div className="pt-2 border-t border-slate-700/80 space-y-2">
                            {/* Row 1: Quick Action Links */}
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => onSelectOrderForTracking(ord)}
                                className="text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-slate-700 px-2 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                Rastreio <ArrowUpRight className="w-3 h-3 text-slate-400" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setTicketOrder(ord);
                                  setIsTicketOpen(true);
                                }}
                                className="text-[11px] font-bold text-slate-200 hover:text-white bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded-md border border-slate-600 flex items-center gap-1 transition-colors cursor-pointer"
                                title="Imprimir Comanda 80mm / Enviar WhatsApp"
                              >
                                <Printer className="w-3 h-3 text-slate-300" /> Comanda
                              </button>
                            </div>

                            {/* Row 2: Dispatch / Assignment controls */}
                            <div className="flex items-center gap-1.5 pt-0.5">
                              {motoboys.length > 0 && (() => {
                                const firstAvailable = motoboys.find((m) => m.status === 'available') || motoboys[0];
                                const firstName = firstAvailable
                                  ? firstAvailable.name.replace(/\s*\(.*?\)\s*/g, '').trim().split(' ')[0]
                                  : 'Motoboy';
                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (firstAvailable) {
                                        onAssignOrderToMotoboy(ord.id, firstAvailable.id);
                                      }
                                    }}
                                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center justify-center gap-1 transition-all cursor-pointer truncate"
                                    title={`Despachar imediatamente para 1º da fila: ${firstAvailable?.name}`}
                                  >
                                    <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                                    <span className="truncate">Despachar 1º ({firstName})</span>
                                  </button>
                                );
                              })()}

                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    onAssignOrderToMotoboy(ord.id, e.target.value);
                                  }
                                }}
                                defaultValue=""
                                className="w-24 shrink-0 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg cursor-pointer focus:outline-none transition-colors border border-slate-600"
                              >
                                <option value="" disabled className="bg-slate-900 text-slate-400">
                                  Fila...
                                </option>
                                {motoboys.map((m, idx) => (
                                  <option key={m.id} value={m.id} className="text-white bg-slate-900">
                                    {idx + 1}º - {m.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Middle & Right Column: Map + Rotas Disponíveis (~58% width) */}
              <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Map Panel with Clean Filter Controls */}
                <div className="md:col-span-7 h-[380px] md:h-auto min-h-[320px] flex flex-col bg-slate-900/80 rounded-2xl border border-slate-700/80 p-2 space-y-2">
                  <div className="flex items-center justify-between gap-1.5 px-1 pt-0.5">
                    <span className="text-[11px] font-black text-slate-300 uppercase tracking-wide flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      Visão do Mapa
                    </span>
                    <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-xl border border-slate-700">
                      <button
                        type="button"
                        onClick={() => setMapFilter('all')}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                          mapFilter === 'all'
                            ? 'bg-emerald-500 text-slate-950 shadow-2xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Todos ({activeOrders.length + motoboys.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapFilter('returning')}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                          mapFilter === 'returning'
                            ? 'bg-amber-500 text-slate-950 shadow-2xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ⚡ Voltando ({returningMotoboysWithDistance.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapFilter('orders')}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                          mapFilter === 'orders'
                            ? 'bg-blue-500 text-white shadow-2xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        📦 Pedidos ({activeOrders.length})
                      </button>
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
                          : activeOrders.map((ord, idx) => ({
                              id: ord.id,
                              orderIndex: idx + 1,
                              title: `#${ord.codeNumber} - ${ord.clientName}`,
                              address: ord.address,
                              lat: ord.lat,
                              lng: ord.lng,
                              status: ord.status === 'delivered' ? 'delivered' : ord.status === 'in_transit' ? 'in_transit' : 'pending',
                              priority: 'medium',
                              recipientName: ord.clientName,
                              phone: ord.clientPhone,
                              valueToReceive: ord.total,
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
                        const availableMotoboys = motoboys.filter((x) => x.status === 'available');
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

                        const allOrdersReady = mOrders.length > 0 && mOrders.every((o) => o.status === 'ready_at_counter' || o.status === 'picked_up');
                        const allOrdersInTransit = mOrders.length > 0 && mOrders.every((o) => o.status === 'in_transit');

                        const circleNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

                        return (
                          <div
                            key={m.id}
                            className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80 space-y-2 shadow-2xs"
                          >
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-extrabold text-sm text-white">{m.name}</span>
                                  {m.status === 'available' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                      🟢 NA LOJA {queuePos ? `• ${queuePos}º DA FILA` : ''}
                                    </span>
                                  ) : m.status === 'delivering' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                      🔵 EM ROTA
                                    </span>
                                  ) : m.status === 'returning_to_store' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      🟠 RETORNANDO À LOJA
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-700 text-slate-400 border border-slate-600">
                                      ⚫ OFFLINE
                                    </span>
                                  )}
                                </div>

                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                  {m.status === 'returning_to_store' ? (
                                    mOrders.length === 0
                                      ? 'Finalizou rota anterior e está retornando à loja'
                                      : `Retornando à loja (Já possui ${mOrders.length} ${mOrders.length === 1 ? 'pedido' : 'pedidos'} vinculados para a próxima rota)`
                                  ) : m.status === 'delivering' ? (
                                    `Em rota de entrega na rua • ${mOrders.length} ${mOrders.length === 1 ? 'parada restante' : 'paradas restantes'}`
                                  ) : mOrders.length === 0 ? (
                                    queuePos ? `${queuePos}º lugar na fila de despacho • Aguardando pedidos` : 'Aguardando novos pedidos na fila'
                                  ) : allOrdersReady ? (
                                    `${mOrders.length} ${mOrders.length === 1 ? 'pedido pronto' : 'pedidos prontos'} para saída`
                                  ) : (
                                    `${mOrders.length} ${mOrders.length === 1 ? 'pedido' : 'pedidos'} • próxima saída com ${mOrders.length} ${mOrders.length === 1 ? 'parada' : 'paradas'}`
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* Order Items List inside Driver Card */}
                            {mOrders.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                {mOrders.map((ord, idx) => {
                                  const isReady = ord.status === 'ready_at_counter' || ord.status === 'picked_up';
                                  const isInTransit = ord.status === 'in_transit';
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
                                          {isReady ? (
                                            <span className="text-emerald-400 font-bold">
                                              🟢 Pronto
                                            </span>
                                          ) : isInTransit ? (
                                            <span className="text-blue-400 font-bold">
                                              🔵 Em rota
                                            </span>
                                          ) : (
                                            <span className="text-amber-400 font-medium">
                                              🟠 Em cozinha
                                            </span>
                                          )}
                                          <span className="text-slate-400 line-clamp-1">• {ord.clientName}</span>
                                        </div>
                                      </div>

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
                                  {m.status === 'delivering' || allOrdersInTransit ? (
                                    <div className="flex-1 py-1.5 px-3 bg-blue-950/60 border border-blue-500/30 text-blue-300 text-center font-bold text-xs rounded-xl">
                                      🛵 Em rota na rua ({mOrders.length} {mOrders.length === 1 ? 'parada restante' : 'paradas restantes'})
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
                    {unassignedOrders[0]?.address || 'Rua dos Pioneiros 595, Água Verde • Blumenau'}
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
                        <h4 className="font-bold text-sm text-white">{m.name}</h4>
                        <p className="text-xs text-slate-400">{m.vehicleModel} • {m.plate}</p>
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
                      <span>Senha: <strong className="text-white">{m.password || '123'}</strong></span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Ganho acumulado hoje:</span>
                    <span className="font-black text-emerald-400">{formattedCurrency(m.totalEarnedToday)}</span>
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
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-bold text-emerald-400 block">{formattedCurrency(o.total)}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">{o.paymentMethod}</span>
                  </div>
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
    </div>
  );
};
