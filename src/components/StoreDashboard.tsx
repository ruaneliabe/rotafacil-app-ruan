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
} from 'lucide-react';
import { RouteMap } from './RouteMap';
import { ThermalTicketModal } from './ThermalTicketModal';
import { MotoboySettlementModal } from './MotoboySettlementModal';

interface StoreDashboardProps {
  shift: StoreShift;
  orders: Order[];
  motoboys: Motoboy[];
  onToggleShift: () => void;
  onAssignOrderToMotoboy: (orderId: string, motoboyId: string) => void;
  onAssignBatchToMotoboy?: (orderIds: string[], motoboyId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
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

  // Modal states for Step 4 & 5
  const [ticketOrder, setTicketOrder] = useState<Order | null>(null);
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);

  // Derived metrics matching screenshot
  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const readyAtCounter = orders.filter((o) => o.status === 'ready_at_counter');
  const unassignedOrders = activeOrders.filter((o) => !o.assignedMotoboyId);
  const deliveredToday = orders.filter((o) => o.status === 'delivered');
  const totalRevenue = orders.reduce((acc, o) => acc + o.total, 0);
  const motoboysAvailable = motoboys.filter((m) => m.status === 'available');
  const returningMotoboys = motoboys.filter((m) => m.status === 'returning_to_store');

  const formattedCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleSendWhatsAppToMotoboy = (m: Motoboy) => {
    const mOrders = orders.filter((o) => o.assignedMotoboyId === m.id && o.status !== 'delivered' && o.status !== 'cancelled');
    if (mOrders.length === 0) return;

    // Step 3: Mark orders as ready_at_counter when notifying motoboy
    mOrders.forEach((ord) => {
      if (ord.status !== 'ready_at_counter' && ord.status !== 'picked_up' && ord.status !== 'in_transit') {
        onUpdateOrderStatus(ord.id, 'ready_at_counter');
      }
    });

    const cleanedPhone = (m.phone || '').replace(/\D/g, '');
    let msg = `🛵 *ROTA FÁCIL - PEDIDO(S) PRONTO(S) PARA RETIRADA!*\n\n`;
    msg += `Olá *${m.name}*!\n`;
    msg += `A loja *${shift.storeName}* atribuiu *${mOrders.length}* pedido(s) a você PRONTI(S) no balcão para retirar:\n\n`;

    mOrders.forEach((ord, i) => {
      msg += `📦 *${i + 1}. Pedido #${ord.codeNumber}* (${ord.clientName})\n`;
      msg += `📍 Endereço: ${ord.address} - ${ord.neighborhood}\n`;
      msg += `💵 Cobrar: ${formattedCurrency(ord.total)} (${ord.paymentMethod.toUpperCase()})\n`;
      if (ord.clientPhone) msg += `📞 Cliente: ${ord.clientPhone}\n`;
      msg += `\n`;
    });

    msg += `📲 Acesse seu App de Entregador para ver a rota:\n`;
    msg += `${window.location.origin}\n`;

    const encoded = encodeURIComponent(msg);
    const targetUrl = cleanedPhone
      ? `https://wa.me/55${cleanedPhone}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(targetUrl, '_blank');
  };

  return (
    <div className="space-y-4 text-slate-100">
      {/* 1. HUMANIZED GREETING & EXPEDIENTE BANNER */}
      <div className="bg-slate-800 border border-slate-700/80 rounded-2xl p-3.5 text-white flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-white flex items-center justify-center shrink-0 font-extrabold shadow-2xs">
            <Building2 className="w-5 h-5 text-slate-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white">{shift.storeName}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase ${
                shift.isOpen ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-700 text-slate-300 border-slate-600'
              }`}>
                {shift.isOpen ? 'Expediente Aberto' : 'Fechado'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
              Hoje: <span className="text-white font-bold">{orders.length} pedidos</span> • <span className="text-slate-200 font-bold">{deliveredToday.length} entregues</span> • <span className="text-slate-200 font-bold">{unassignedOrders.length} aguardando despacho</span> • <span className="text-slate-200 font-bold">{motoboys.length} motoboys em operação ({motoboysAvailable.length} na fila)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={onOpenNewOrderModal}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-100" />
            Lançar Pedido
          </button>
          <button
            type="button"
            onClick={onToggleShift}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-xl border border-slate-600 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Power className="w-3.5 h-3.5 text-rose-400" />
            {shift.isOpen ? 'Encerrar' : 'Abrir'}
          </button>
        </div>
      </div>

      {/* 2. TELA VIVA - TICKER DE EVENTOS EM TEMPO REAL */}
      <div className="bg-slate-800 border border-slate-700/80 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs overflow-x-auto shadow-2xs">
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-extrabold text-emerald-400 uppercase text-[10px] tracking-wider">
            Painel Ativo
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-300 font-medium text-xs sm:text-sm whitespace-nowrap overflow-x-auto px-2">
          {returningMotoboys.length > 0 ? (
            <span className="text-amber-300 font-bold flex items-center gap-1 animate-pulse">
              <Bike className="w-4 h-4 text-amber-400 inline" /> {returningMotoboys.map(m => m.name).join(', ')} retornando para a loja!
            </span>
          ) : (
            <span className="text-slate-200 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" /> Equipe ativa: {motoboys.length} em operação • {motoboysAvailable.length} disponíveis na fila
            </span>
          )}
          <span className="text-slate-600">•</span>
          {unassignedOrders.length > 0 ? (
            <span className="text-amber-300 font-semibold flex items-center gap-1">
              <Clock className="w-4 h-4 text-amber-400 inline" /> {unassignedOrders.length} {unassignedOrders.length === 1 ? 'pedido aguardando' : 'pedidos aguardando'} despacho
            </span>
          ) : (
            <span className="text-slate-200 flex items-center gap-1 font-semibold">
              <Check className="w-4 h-4 text-emerald-400 inline" /> Todos os pedidos despachados
            </span>
          )}
          <span className="text-slate-600">•</span>
          <span className="text-slate-100 font-mono text-xs font-bold">
            Faturamento: {formattedCurrency(totalRevenue)}
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-400 shrink-0 font-mono">
          <span>Tempo Real</span>
        </div>
      </div>

      {/* 3. SUB NAVIGATION TABS */}
      <div className="bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/80 flex items-center justify-between overflow-x-auto text-xs font-semibold text-slate-300">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('operacao')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'operacao'
                ? 'bg-slate-700 text-white font-bold shadow-2xs border border-slate-600'
                : 'hover:bg-slate-700/50 text-slate-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Operação
            <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'operacao' ? 'bg-slate-900 text-white' : 'bg-slate-700 text-slate-300'
            }`}>
              {activeOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('equipe')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'equipe'
                ? 'bg-slate-700 text-white font-bold shadow-2xs border border-slate-600'
                : 'hover:bg-slate-700/50 text-slate-300'
            }`}
          >
            Equipe ({motoboys.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('financeiro')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'financeiro'
                ? 'bg-slate-700 text-white font-bold shadow-2xs border border-slate-600'
                : 'hover:bg-slate-700/50 text-slate-300'
            }`}
          >
            Financeiro
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historico')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'historico'
                ? 'bg-slate-700 text-white font-bold shadow-2xs border border-slate-600'
                : 'hover:bg-slate-700/50 text-slate-300'
            }`}
          >
            Histórico
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSettlementOpen(true)}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold shadow-2xs border border-slate-600 transition-all flex items-center gap-1.5 text-xs shrink-0 cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-300" /> Acerto Motoboy
          </button>

          <button
            type="button"
            onClick={onOpenMotoboyModal}
            className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold border border-slate-700 hover:bg-slate-850 transition-all flex items-center gap-1.5 text-xs shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" /> Cadastrar Motoboy
          </button>
        </div>
      </div>

      {activeTab === 'operacao' && (
        <div className="space-y-4">

          {/* ALERT BANNER: MOTOBOY RETURNING TO STORE */}
          {returningMotoboys.length > 0 && (
            <div className="bg-amber-950/60 border border-amber-700/80 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs text-amber-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
                  <Bike className="w-5 h-5 text-slate-950" />
                </div>
                <div>
                  <h4 className="font-extrabold text-amber-200 text-xs flex items-center gap-2">
                    <span>MOTOBOY RETORNANDO À LOJA!</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/30 text-amber-200 border border-amber-500/40 uppercase">
                      {returningMotoboys.length} {returningMotoboys.length === 1 ? 'entregador' : 'entregadores'}
                    </span>
                  </h4>
                  <p className="text-xs text-amber-200/90">
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
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-lg shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Confirmar Chegada: {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. STRIPE-STYLE HIERARCHY METRICS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            {/* MAIN CARD: Pedidos Ativos */}
            <div className="lg:col-span-4 bg-slate-800 p-3.5 rounded-2xl border border-slate-700/80 shadow-2xs relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-400 uppercase block">RESUMO DA OPERAÇÃO</span>
                    <h3 className="text-sm sm:text-base font-black text-white">Pedidos Ativos</h3>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-black shadow-2xs ${
                  unassignedOrders.length > 0
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {unassignedOrders.length} sem motoboy
                </span>
              </div>
              
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-4xl font-black text-white tracking-tight">{activeOrders.length}</span>
                <span className="text-xs sm:text-sm text-slate-300 font-medium">
                  {readyAtCounter.length} prontos no balcão
                </span>
              </div>
            </div>

            {/* MEDIUM CARD: Motoboys na Fila */}
            <div className="lg:col-span-3 bg-slate-800 p-3.5 rounded-2xl border border-slate-700/80 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
                    <Bike className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase">Motoboys na Fila</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  motoboysAvailable.length > 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  Fila de Rodízio
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">
                  {motoboysAvailable.length}/{motoboys.length}
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  {motoboysAvailable.length > 0 ? 'disponíveis na loja' : 'todos em entrega'}
                </span>
              </div>
            </div>

            {/* SECONDARY COMPACT CARD: Entregues Hoje */}
            <div className="lg:col-span-2 bg-slate-800 p-3.5 rounded-2xl border border-slate-700/80 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase">Entregues</span>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-black text-white">{deliveredToday.length}</span>
                <span className="text-xs text-slate-400 block font-medium">concluídos hoje</span>
              </div>
            </div>

            {/* SECONDARY COMPACT CARD: Faturamento Hoje */}
            <div className="lg:col-span-3 bg-slate-800 p-3.5 rounded-2xl border border-slate-700/80 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-slate-400">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase">Faturamento Hoje</span>
              </div>
              <div className="mt-2">
                <span className="text-xl font-black text-emerald-400">{formattedCurrency(totalRevenue)}</span>
                <span className="text-xs text-slate-400 block font-medium">{orders.length} pedidos lançados</span>
              </div>
            </div>
          </div>

          {/* 5. DESPACHO VISUAL SECTION */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700/80 shadow-2xs p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
              <div>
                <span className="text-xs font-black text-slate-400 uppercase">
                  DESPACHO VISUAL INTELIGENTE
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-white">Escolha a melhor rota para o próximo despacho</h3>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {unassignedOrders.length} aguardando despacho
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
                {/* Map Panel */}
                <div className="md:col-span-7 h-[360px] md:h-auto min-h-[300px]">
                  <RouteMap
                    origin={{
                      name: shift.storeName,
                      address: shift.storeAddress,
                      lat: shift.storeLat,
                      lng: shift.storeLng,
                    }}
                    stops={activeOrders.map((ord, idx) => ({
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
                    }))}
                  />
                </div>

                {/* Rotas disponíveis dos Motoboys */}
                <div className="md:col-span-5 bg-slate-900/60 rounded-2xl p-3 border border-slate-700/70 space-y-3">
                  <div className="flex flex-col gap-2">
                    <h4 className="font-bold text-xs text-slate-300 uppercase">
                      Status da Equipe em Tempo Real
                    </h4>

                    {/* STATUS TIMELINE BAR */}
                    <div className="flex items-center gap-1.5 p-2 bg-slate-800 rounded-xl border border-slate-700 text-[10px] font-bold text-slate-300 flex-wrap shadow-2xs">
                      <span className="flex items-center gap-1 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-300">
                        🟢 Na fila ({motoboys.filter((m) => m.status === 'available').length})
                      </span>
                      <span className="flex items-center gap-1 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 text-amber-300">
                        🟠 Retornando ({motoboys.filter((m) => m.status === 'returning_to_store').length})
                      </span>
                      <span className="flex items-center gap-1 bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30 text-blue-300">
                        🔵 Em rota ({motoboys.filter((m) => m.status === 'delivering').length})
                      </span>
                      <span className="flex items-center gap-1 bg-slate-700 px-2 py-0.5 rounded border border-slate-600 text-slate-300">
                        ⚫ Offline ({motoboys.filter((m) => m.status === 'offline').length})
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {motoboys.map((m) => {
                      const mOrders = orders.filter(
                        (o) =>
                          o.status !== 'delivered' &&
                          o.status !== 'cancelled' &&
                          (o.assignedMotoboyId === m.id ||
                            o.assignedMotoboyName?.toLowerCase() === m.name.toLowerCase() ||
                            (m.username && o.assignedMotoboyId?.toLowerCase() === m.username.toLowerCase()) ||
                            o.assignedMotoboyId?.toLowerCase() === m.name.toLowerCase())
                      );

                      return (
                        <div
                          key={m.id}
                          className="bg-slate-800 p-3 rounded-xl border border-slate-700/80 space-y-2 shadow-2xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-900 border border-slate-700 text-white flex items-center justify-center font-black text-xs">
                                {m.name.charAt(0)}
                              </div>
                              <div>
                                <h5 className="font-bold text-xs text-white">{m.name}</h5>
                                <span className="text-[10px] text-slate-400 font-medium">{mOrders.length} {mOrders.length === 1 ? 'parada na rota' : 'paradas na rota'}</span>
                              </div>
                            </div>

                            {/* TIMELINE STATUS BADGES */}
                            {m.status === 'returning_to_store' ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                  🟠 Retornando
                                </span>
                                {onConfirmArrivalAtStore && (
                                  <button
                                    type="button"
                                    onClick={() => onConfirmArrivalAtStore(m.id)}
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-2xs cursor-pointer"
                                    title="Confirmar Chegada na Fila"
                                  >
                                    ✓ Chegou
                                  </button>
                                )}
                              </div>
                            ) : m.status === 'available' ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                🟢 Na fila
                              </span>
                            ) : m.status === 'delivering' ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                🔵 Em rota
                              </span>
                            ) : (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600 flex items-center gap-1">
                                ⚫ Offline
                              </span>
                            )}
                          </div>

                          {mOrders.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <div className="flex items-center justify-between pb-1 border-b border-slate-700">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Pedidos vinculados</span>
                                <button
                                  type="button"
                                  onClick={() => handleSendWhatsAppToMotoboy(m)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer transition-all"
                                  title="Avisar o motoboy via WhatsApp que os pedidos estão prontos para retirada"
                                >
                                  <span>📱</span>
                                  <span>Avisar {m.name.split(' ')[0]} (WhatsApp)</span>
                                </button>
                              </div>

                              {mOrders.map((ord, idx) => (
                                <div
                                  key={ord.id}
                                  className={`text-xs p-2.5 rounded-xl border transition-all space-y-1.5 ${
                                    ord.status === 'ready_at_counter'
                                      ? 'bg-amber-950/60 border-amber-600 ring-1 ring-amber-500/50'
                                      : 'bg-slate-900/80 border-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <div>
                                      <span className="font-extrabold text-white">#{idx + 1} • #{ord.codeNumber} {ord.clientName}</span>
                                      <p className="text-[11px] text-slate-300 line-clamp-1">{ord.address}</p>
                                    </div>

                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                                        ord.status === 'ready_at_counter'
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-2xs animate-pulse'
                                          : ord.status === 'picked_up'
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                          : ord.status === 'in_transit'
                                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                          : 'bg-slate-700 text-slate-300'
                                      }`}
                                    >
                                      {ord.status === 'ready_at_counter'
                                        ? '🛍️ Pronto Balcão'
                                        : ord.status === 'picked_up'
                                        ? '🎒 Retirado pelo Motoboy'
                                        : ord.status === 'in_transit'
                                        ? '🛵 Em Rota'
                                        : '⏳ Aguardando'}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-700 text-[11px]">
                                    {ord.status !== 'ready_at_counter' && ord.status !== 'picked_up' && ord.status !== 'in_transit' ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onUpdateOrderStatus(ord.id, 'ready_at_counter');
                                          const msg = `Olá ${m.name}! 🛍️ O pedido #${ord.codeNumber} (${ord.clientName} - ${ord.address}) está PRONTO NO BALCÃO! Por favor, confirme a retirada no seu app de entregas! 🛵`;
                                          const phone = m.phone ? m.phone.replace(/\D/g, '') : '';
                                          const url = phone
                                            ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`
                                            : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
                                          window.open(url, '_blank');
                                        }}
                                        className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer transition-all"
                                        title="Avisar ao motoboy que o pedido está pronto no balcão"
                                      >
                                        <span>🔔</span>
                                        <span>Avisar que está pronto</span>
                                      </button>
                                    ) : ord.status === 'ready_at_counter' ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const msg = `Olá ${m.name}! 🛍️ O pedido #${ord.codeNumber} (${ord.clientName} - ${ord.address}) está PRONTO NO BALCÃO! Pode vir retirar na loja para sair para entrega! 🛵`;
                                          const phone = m.phone ? m.phone.replace(/\D/g, '') : '';
                                          const url = phone
                                            ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`
                                            : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
                                          window.open(url, '_blank');
                                        }}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer transition-all"
                                        title="Avisar no WhatsApp do Motoboy que o pedido está pronto"
                                      >
                                        <span>📱</span>
                                        <span>Avisar {m.name.split(' ')[0]}</span>
                                      </button>
                                    ) : ord.status === 'picked_up' ? (
                                      <span className="text-[11px] font-extrabold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                                        ✓ Retirado (Aguardando Rota)
                                      </span>
                                    ) : null}

                                    <button
                                      type="button"
                                      onClick={() => onSelectOrderForTracking(ord)}
                                      className="text-[10px] font-extrabold text-slate-300 hover:text-white underline shrink-0 cursor-pointer"
                                    >
                                      Ver no mapa
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
    </div>
  );
};
