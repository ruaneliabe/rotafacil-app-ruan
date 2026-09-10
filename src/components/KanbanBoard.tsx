import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Order, Motoboy, StoreShift, OrderStatus } from '../types';
import { getBrazilDateKey, isOrderInCurrentShift } from '../utils/dateUtils';
import { PaymentBadge, getPaymentMethodLabel } from '../utils/paymentUtils';
import { buildSmartRouteBatches, analyzeRouteTrajectory } from '../utils/routeCorridorUtils';
import { FleetBottleneckBanner } from './FleetBottleneckBanner';
import {
  Search,
  Clock,
  MapPin,
  Bike,
  Package,
  CheckCircle2,
  ChefHat,
  AlertTriangle,
  Printer,
  Zap,
  ArrowRight,
  Eye,
  RotateCw,
  Sparkles,
  CreditCard,
  DollarSign,
  Plus,
  LayoutGrid,
  List,
  CheckSquare,
  Square,
  Flame,
  Send,
  Users
} from 'lucide-react';

interface KanbanBoardProps {
  orders: Order[];
  motoboys: Motoboy[];
  shift: StoreShift;
  storeFilter: 'all' | 'hope_pizza' | 'hope_burger';
  onSetStoreFilter: (filter: 'all' | 'hope_pizza' | 'hope_burger') => void;
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  onAssignOrderToMotoboy: (orderId: string, motoboyId: string) => void;
  onAssignBatchToMotoboy?: (orderIds: string[], motoboyId: string) => void;
  onSelectOrderForTracking?: (order: Order) => void;
  onOpenThermalTicket?: (order: Order) => void;
  onOpenNewOrderModal?: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  orders,
  motoboys,
  shift,
  storeFilter,
  onSetStoreFilter,
  onUpdateOrderStatus,
  onAssignOrderToMotoboy,
  onAssignBatchToMotoboy,
  onSelectOrderForTracking,
  onOpenThermalTicket,
  onOpenNewOrderModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [viewDensity, setViewDensity] = useState<'compact' | 'detailed'>('detailed');
  const [selectedReadyIds, setSelectedReadyIds] = useState<string[]>([]);
  const [selectedTargetMotoboyId, setSelectedTargetMotoboyId] = useState<string>('');
  const [bottleneckFilter, setBottleneckFilter] = useState<'all' | 'delayed_prep' | 'cooling_counter' | 'batches'>('all');
  const [dispatchBlockedToast, setDispatchBlockedToast] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      await fetch('/api/cardapio-web/sync');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const getOrderMinutes = (o: Order) => {
    const [h, m] = (o.createdAt || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const getOrderWaitMinutes = (o: Order) => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const ordMinutes = getOrderMinutes(o);
    let diff = nowMinutes - ordMinutes;
    if (diff < 0) diff += 24 * 60; // virada da meia-noite
    return diff;
  };

  const isTakeoutOrder = (o: Order) => {
    const addr = (o.address || '').toLowerCase();
    const neigh = (o.neighborhood || '').toLowerCase();
    return addr.includes('retirada') || addr.includes('balcão') || neigh.includes('balcão') || (o as any).order_type === 'takeout';
  };

  const getOrderDisplayCode = (ord: Order) => {
    if (ord.displayCode) return ord.displayCode;
    const isBurger = ord.storeBranch === 'hope_burger' || ord.storeName?.toLowerCase().includes('burger');
    const isPizza = ord.storeBranch === 'hope_pizza' || ord.storeName?.toLowerCase().includes('pizz');
    if (isBurger) return `HB-${ord.codeNumber}`;
    if (isPizza) return `HP-${ord.codeNumber}`;
    return `#${ord.codeNumber}`;
  };

  // Motoboys disponíveis ordenados por fila
  const availableMotoboys = useMemo(() => {
    return motoboys
      .filter((m) => m.status === 'available')
      .sort((a, b) => (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0));
  }, [motoboys]);

  // Motoboys em retorno
  const returningMotoboys = useMemo(() => {
    return motoboys.filter((m) => m.status === 'returning_to_store');
  }, [motoboys]);

  const todayDateKey = useMemo(() => {
    return getBrazilDateKey();
  }, []);

  // Filtragem principal dos pedidos do turno
  const baseShiftOrders = useMemo(() => {
    if (!shift.isOpen) return [];
    return orders.filter((ord) => {
      if (isTakeoutOrder(ord)) return false;
      if (ord.status === 'cancelled' || ord.status === 'failed') return false;
      if (!isOrderInCurrentShift(ord, shift)) return false;
      if (storeFilter === 'hope_pizza') {
        const isPizza = ord.storeBranch === 'hope_pizza' || ord.storeName?.toLowerCase().includes('pizz');
        if (!isPizza) return false;
      }
      if (storeFilter === 'hope_burger') {
        const isBurger = ord.storeBranch === 'hope_burger' || ord.storeName?.toLowerCase().includes('burger');
        if (!isBurger) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesClient = (ord.clientName || '').toLowerCase().includes(q);
        const matchesCode = String(ord.codeNumber).includes(q) || (ord.displayCode || '').toLowerCase().includes(q);
        const matchesNeigh = (ord.neighborhood || '').toLowerCase().includes(q);
        const matchesAddress = (ord.address || '').toLowerCase().includes(q);
        if (!matchesClient && !matchesCode && !matchesNeigh && !matchesAddress) return false;
      }
      return true;
    });
  }, [orders, shift, storeFilter, searchQuery]);

  // Contadores de gargalos operacionais (alta demanda)
  const delayedPrepCount = useMemo(() => {
    return baseShiftOrders.filter((o) => (o.status === 'pending' || o.status === 'preparing') && getOrderWaitMinutes(o) >= 25).length;
  }, [baseShiftOrders]);

  const coolingCounterCount = useMemo(() => {
    return baseShiftOrders.filter((o) => o.status === 'ready_at_counter' && getOrderWaitMinutes(o) >= 8).length;
  }, [baseShiftOrders]);

  // Lotes inteligentes de rota para pedidos prontos no balcão:
  // - Considera o mesmo caminho / corredor (mesmo em bairros diferentes!)
  // - Respeita rigorosamente a janela de tempo de entrada (jamais junta pedido de 30m com pedido de 2m)
  const smartReadyBatches = useMemo(() => {
    const readyOnly = baseShiftOrders.filter((o) => o.status === 'ready_at_counter');
    return buildSmartRouteBatches(readyOnly);
  }, [baseShiftOrders]);

  // Aplicação do filtro de gargalo
  const filteredOrders = useMemo(() => {
    if (bottleneckFilter === 'delayed_prep') {
      return baseShiftOrders.filter((o) => (o.status === 'pending' || o.status === 'preparing') && getOrderWaitMinutes(o) >= 25);
    }
    if (bottleneckFilter === 'cooling_counter') {
      return baseShiftOrders.filter((o) => o.status === 'ready_at_counter' && getOrderWaitMinutes(o) >= 8);
    }
    if (bottleneckFilter === 'batches') {
      const orderIdsInSmartBatches = new Set(smartReadyBatches.flatMap((b) => b.orderIds));
      return baseShiftOrders.filter((o) => o.status === 'ready_at_counter' && orderIdsInSmartBatches.has(o.id));
    }
    return baseShiftOrders;
  }, [baseShiftOrders, bottleneckFilter, smartReadyBatches]);

  // 1. Novos / Pendentes
  const pendingOrders = useMemo(() => {
    return filteredOrders
      .filter((o) => o.status === 'pending')
      .sort((a, b) => getOrderMinutes(a) - getOrderMinutes(b));
  }, [filteredOrders]);

  // 2. Em Preparo
  const preparingOrders = useMemo(() => {
    return filteredOrders
      .filter((o) => o.status === 'preparing')
      .sort((a, b) => getOrderMinutes(a) - getOrderMinutes(b));
  }, [filteredOrders]);

  // 3. Prontos no Balcão
  const readyOrders = useMemo(() => {
    return filteredOrders
      .filter((o) => o.status === 'ready_at_counter')
      .sort((a, b) => getOrderMinutes(a) - getOrderMinutes(b));
  }, [filteredOrders]);

  // 4. Em Rota / Na Rua
  const dispatchedOrders = useMemo(() => {
    return filteredOrders
      .filter((o) => o.status === 'dispatched' || o.status === 'in_transit' || o.status === 'picked_up')
      .sort((a, b) => (b.dispatchedAt || '').localeCompare(a.dispatchedAt || ''));
  }, [filteredOrders]);

  // 5. Entregues no Turno Atual
  const deliveredOrders = useMemo(() => {
    if (!shift.isOpen) return [];
    return orders
      .filter((o) => o.status === 'delivered' && isOrderInCurrentShift(o, shift))
      .slice(0, 40);
  }, [orders, shift]);

  // Despacho de lote por bairro ou selecionados (com proteção anti-despacho sem motoboy)
  const handleDispatchBatchOrders = (orderIds: string[], targetMotoboyId?: string) => {
    const finalDriverId = targetMotoboyId || availableMotoboys[0]?.id;
    if (!finalDriverId) {
      setDispatchBlockedToast(
        '⚠️ Despacho bloqueado: Nenhum motoboy disponível no pátio da loja no momento. Aguarde o retorno de um entregador para evitar saídas fictícias.'
      );
      setTimeout(() => setDispatchBlockedToast(null), 5000);
      return;
    }

    if (onAssignBatchToMotoboy) {
      onAssignBatchToMotoboy(orderIds, finalDriverId);
    } else {
      orderIds.forEach((id) => onAssignOrderToMotoboy(id, finalDriverId));
    }
    setSelectedReadyIds((prev) => prev.filter((id) => !orderIds.includes(id)));
  };

  // Análise de agrupamento inteligente por rota/corredor considerando janela de tempo estrita e SLA
  const getNeighborhoodPairingInfo = (order: Order) => {
    const orderWait = getOrderWaitMinutes(order);
    const hasAvailableDriver = availableMotoboys.length > 0;

    // Se o pedido está há 25+ min esperando ou 10+ min pronto no balcão, prioridade máxima de saída
    if (orderWait >= 25 || (order.status === 'ready_at_counter' && orderWait >= 10)) {
      return {
        type: 'urgent',
        badge: hasAvailableDriver
          ? '🚨 Saída Imediata'
          : '🚨 Saída Imediata (1º da Fila · Aguardando Motoboy)',
        desc: hasAvailableDriver
          ? `Aguardando há ${orderWait} min. Prioridade máxima: não reter para outros pedidos!`
          : `Aguardando há ${orderWait} min. Prioridade 1 de saída assim que um entregador retornar ao pátio.`
      };
    }

    // Busca candidato que esteja no mesmo trajeto / corredor e com tempo estritamente compatível
    const pool = readyOrders.length > 1 ? readyOrders : readyOrders.concat(pendingOrders);
    for (const other of pool) {
      if (other.id === order.id) continue;
      const trajectory = analyzeRouteTrajectory(order, other);
      if (trajectory.canShareRoute && trajectory.timeCompatible) {
        const isDiffNeigh = (order.neighborhood || '').trim().toLowerCase() !== (other.neighborhood || '').trim().toLowerCase();
        return {
          type: 'combo',
          badge: `⚡ Par Rota: ${getOrderDisplayCode(other)}${isDiffNeigh ? ` (${other.neighborhood})` : ''}`,
          desc: trajectory.explanation
        };
      }
    }

    return null;
  };

  const renderChannelBadge = (order: Order) => {
    const channel = order.originChannel;
    if (channel === 'cardapio_web') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-500/15 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
          🌐 CW
        </span>
      );
    }
    if (channel === 'ifood') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-200 shrink-0">
          🔴 iFood
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
        Balcão
      </span>
    );
  };

  // Linha ultra compacta de alta demanda (para operações de 200 pedidos)
  const renderOrderRow = (order: Order, currentColumn: 'pending' | 'preparing' | 'ready' | 'dispatched' | 'delivered') => {
    const waitMinutes = getOrderWaitMinutes(order);
    const isOverdue = waitMinutes >= 30;
    const isWarning = waitMinutes >= 20 && !isOverdue;
    const isReadyCooling = currentColumn === 'ready' && waitMinutes >= 8;
    const isBurger = order.storeBranch === 'hope_burger' || order.storeName?.toLowerCase().includes('burger');
    const isPizza = order.storeBranch === 'hope_pizza' || order.storeName?.toLowerCase().includes('pizz');
    const isSelected = selectedReadyIds.includes(order.id);
    const pairingInfo = getNeighborhoodPairingInfo(order);

    return (
      <div
        key={order.id}
        className={`group p-2 rounded-xl border text-slate-800 transition-all text-xs flex flex-col gap-1.5 shadow-2xs ${
          isSelected
            ? 'border-emerald-200 bg-emerald-50 ring-1 ring-emerald-200'
            : isOverdue || isReadyCooling
            ? 'border-rose-200 bg-rose-50 hover:border-rose-200'
            : isWarning
            ? 'border-amber-200 bg-amber-50 hover:border-amber-200'
            : 'border-slate-200/90 bg-white/90 hover:border-slate-200'
        }`}
      >
        {/* Linha 1: Checkbox (se pronto) + Código + Espera + Canal + Ações de Impressão */}
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {currentColumn === 'ready' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedReadyIds((prev) =>
                    prev.includes(order.id) ? prev.filter((id) => id !== order.id) : [...prev, order.id]
                  );
                }}
                className="text-slate-500 hover:text-emerald-600 cursor-pointer shrink-0"
                title={isSelected ? 'Desmarcar' : 'Selecionar para lote'}
              >
                {isSelected ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4" />}
              </button>
            )}

            <span className={`text-[11px] font-black px-1.5 py-0.5 rounded shrink-0 ${
              isPizza ? 'bg-rose-500/20 text-rose-700 border border-rose-200' :
              isBurger ? 'bg-amber-500/20 text-amber-700 border border-amber-200' :
              'bg-slate-100 text-slate-900 border border-slate-200'
            }`}>
              {getOrderDisplayCode(order)}
            </span>

            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 flex items-center gap-0.5 ${
              isOverdue || isReadyCooling
                ? 'bg-rose-500/20 text-rose-700'
                : isWarning
                ? 'bg-amber-500/20 text-amber-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              <Clock className="w-2.5 h-2.5" />
              <span>{waitMinutes}m</span>
            </span>

            {renderChannelBadge(order)}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onOpenThermalTicket && (
              <button
                type="button"
                onClick={() => onOpenThermalTicket(order)}
                className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 cursor-pointer"
                title="Imprimir comanda"
              >
                <Printer className="w-3 h-3" />
              </button>
            )}
            {onSelectOrderForTracking && (
              <button
                type="button"
                onClick={() => onSelectOrderForTracking(order)}
                className="p-1 rounded bg-slate-100 hover:bg-blue-50 text-blue-600 cursor-pointer"
                title="Ver no mapa"
              >
                <MapPin className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Linha 2: Cliente & Bairro & Smart Route Pill */}
        <div className="flex items-baseline justify-between gap-1 text-[11px] min-w-0 flex-wrap">
          <span className="font-bold text-slate-700 truncate flex-1">{order.clientName}</span>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-emerald-600 font-semibold truncate max-w-[110px]">{order.neighborhood || 'Centro'}</span>
            {pairingInfo && (
              <span
                title={pairingInfo.desc}
                className={`text-[9px] font-black px-1 py-0.5 rounded shrink-0 border ${
                  pairingInfo.type === 'urgent'
                    ? 'bg-rose-500/20 text-rose-700 border-rose-200'
                    : 'bg-emerald-500/20 text-emerald-700 border-emerald-200'
                }`}
              >
                {pairingInfo.badge}
              </span>
            )}
          </div>
        </div>

        {/* Linha 3: Resumo rápido de itens */}
        {order.itemsSummary && (
          <p className="text-[10px] text-slate-500 truncate bg-slate-50/50 px-1.5 py-0.5 rounded">
            {order.itemsSummary}
          </p>
        )}

        {/* Linha 4: Financeiro e Ação de Avanço */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/60 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-900 text-[11px]">
              R$ {(order.total || 0).toFixed(2).replace('.', ',')}
            </span>
            <PaymentBadge method={order.paymentMethod} changeFor={order.changeFor} total={order.total} size="xs" />
          </div>

          {/* Botão de avanço rápido */}
          {currentColumn === 'pending' && (
            <button
              type="button"
              onClick={() => onUpdateOrderStatus(order.id, 'preparing')}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <ChefHat className="w-2.5 h-2.5" />
              <span>Preparar</span>
            </button>
          )}

          {currentColumn === 'preparing' && (
            <button
              type="button"
              onClick={() => onUpdateOrderStatus(order.id, 'ready_at_counter')}
              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <Package className="w-2.5 h-2.5" />
              <span>Pronto</span>
            </button>
          )}

          {currentColumn === 'ready' && (
            availableMotoboys.length > 0 ? (
              <button
                type="button"
                onClick={() => onAssignOrderToMotoboy(order.id, availableMotoboys[0].id)}
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                title={`Despachar com 1º da fila: ${availableMotoboys[0].name}`}
              >
                <Bike className="w-2.5 h-2.5" />
                <span>Despachar ({availableMotoboys[0].name.split(' ')[0]})</span>
              </button>
            ) : (
              <span
                className="text-[9px] text-amber-700 bg-amber-500/15 border border-amber-200 px-1.5 py-0.5 rounded font-semibold cursor-help"
                title="Aguardando retorno de entregador ao pátio da loja. Pedido em fila prioritária."
              >
                ⏳ Aguardando Motoboy
              </span>
            )
          )}

          {currentColumn === 'dispatched' && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-indigo-700 font-semibold truncate max-w-[80px]">
                {order.assignedMotoboyName?.split(' ')[0] || 'Em rota'}
              </span>
              <button
                type="button"
                onClick={() => onUpdateOrderStatus(order.id, 'delivered')}
                className="px-1.5 py-0.5 bg-slate-100 hover:bg-emerald-600 text-emerald-600 hover:text-white font-bold text-[10px] rounded transition-all cursor-pointer"
                title="Confirmar entrega"
              >
                ✓ Entregue
              </button>
            </div>
          )}

          {currentColumn === 'delivered' && (
            <span className="text-[10px] text-slate-400 font-medium">Concluído</span>
          )}
        </div>
      </div>
    );
  };

  // Card padrão detalhado
  const renderOrderCard = (order: Order, currentColumn: 'pending' | 'preparing' | 'ready' | 'dispatched' | 'delivered') => {
    const waitMinutes = getOrderWaitMinutes(order);
    const isOverdue = waitMinutes >= 30;
    const isWarning = waitMinutes >= 20 && !isOverdue;
    const isReadyCooling = currentColumn === 'ready' && waitMinutes >= 8;
    const pairingInfo = getNeighborhoodPairingInfo(order);
    const isBurger = order.storeBranch === 'hope_burger' || order.storeName?.toLowerCase().includes('burger');
    const isPizza = order.storeBranch === 'hope_pizza' || order.storeName?.toLowerCase().includes('pizz');
    const isSelected = selectedReadyIds.includes(order.id);

    return (
      <div
        key={order.id}
        className={`bg-white rounded-xl p-3.5 border transition-all text-slate-800 space-y-2.5 shadow-sm ${
          isSelected
            ? 'border-emerald-200 bg-emerald-50 ring-1 ring-emerald-200'
            : isOverdue || isReadyCooling
            ? 'border-rose-200 bg-rose-50'
            : isWarning
            ? 'border-amber-200 bg-amber-50'
            : 'border-slate-200 hover:border-slate-200'
        }`}
      >
        {/* Top Header: Code, Channel & Time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {currentColumn === 'ready' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedReadyIds((prev) =>
                    prev.includes(order.id) ? prev.filter((id) => id !== order.id) : [...prev, order.id]
                  );
                }}
                className="text-slate-500 hover:text-emerald-600 cursor-pointer shrink-0"
              >
                {isSelected ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4" />}
              </button>
            )}

            <span className={`text-base font-black tracking-tight px-1.5 py-0.5 rounded ${
              isPizza ? 'bg-rose-500/20 text-rose-700 border border-rose-200' :
              isBurger ? 'bg-amber-500/20 text-amber-700 border border-amber-200' :
              'bg-slate-100 text-slate-900'
            }`}>
              {getOrderDisplayCode(order)}
            </span>
            {renderChannelBadge(order)}
          </div>

          <div className="flex items-center gap-1 text-xs">
            <Clock className={`w-3.5 h-3.5 ${isOverdue || isReadyCooling ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-500'}`} />
            <span className={`font-semibold ${isOverdue || isReadyCooling ? 'text-rose-600 font-bold' : isWarning ? 'text-amber-700 font-bold' : 'text-slate-500'}`}>
              {order.createdAt || '--:--'} ({waitMinutes}m)
            </span>
          </div>
        </div>

        {/* Client & Neighborhood */}
        <div>
          <div className="text-sm font-bold text-slate-800 truncate">
            {order.clientName || 'Cliente não identificado'}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-600 mt-0.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="font-semibold text-slate-700">{order.neighborhood || 'Bairro não informado'}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500 truncate text-[11px]">{order.address}</span>
          </div>
        </div>

        {/* Pairing / Smart Batch Tag */}
        {pairingInfo && currentColumn !== 'delivered' && (
          <div className={`p-1.5 px-2 rounded-lg text-[11px] flex items-center gap-1.5 border ${
            pairingInfo.type === 'urgent'
              ? 'bg-rose-500/15 border-rose-200 text-rose-700'
              : 'bg-emerald-500/15 border-emerald-200 text-emerald-700'
          }`}>
            <span className="font-black text-xs shrink-0">{pairingInfo.badge}</span>
            <span className="text-[10px] text-slate-600 truncate">{pairingInfo.desc}</span>
          </div>
        )}

        {/* Items Summary */}
        {order.itemsSummary && (
          <div className="text-xs text-slate-600 bg-slate-50/60 p-2 rounded-lg border border-slate-200/80 line-clamp-2">
            {order.itemsSummary}
          </div>
        )}

        {/* Financial & Payment Badge */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-900">
              {order.total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <PaymentBadge method={order.paymentMethod} changeFor={order.changeFor} total={order.total} size="xs" />
          </div>

          <div className="flex items-center gap-1">
            {onOpenThermalTicket && (
              <button
                type="button"
                onClick={() => onOpenThermalTicket(order)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                title="Imprimir comanda térmica"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            )}
            {onSelectOrderForTracking && (
              <button
                type="button"
                onClick={() => onSelectOrderForTracking(order)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-blue-700 transition-colors cursor-pointer"
                title="Ver no mapa"
              >
                <MapPin className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Motoboy assigned in Transit / Route */}
        {order.assignedMotoboyName && currentColumn === 'dispatched' && (
          <div className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-500/10 p-1.5 rounded-lg border border-indigo-200 font-medium">
            <Bike className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="truncate">Na rua com: <strong>{order.assignedMotoboyName}</strong></span>
          </div>
        )}

        {/* Operational Quick Actions per Column */}
        <div className="pt-1 flex items-center gap-1.5">
          {currentColumn === 'pending' && (
            <>
              <button
                type="button"
                onClick={() => onUpdateOrderStatus(order.id, 'preparing')}
                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Iniciar Preparo</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateOrderStatus(order.id, 'ready_at_counter')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                title="Pular direto para pronto na bancada"
              >
                Pronto ➔
              </button>
            </>
          )}

          {currentColumn === 'preparing' && (
            <button
              type="button"
              onClick={() => onUpdateOrderStatus(order.id, 'ready_at_counter')}
              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Pronto p/ Entrega</span>
            </button>
          )}

          {currentColumn === 'ready' && (
            <div className="w-full space-y-1.5">
              {availableMotoboys.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const nextDriver = availableMotoboys[0];
                    onAssignOrderToMotoboy(order.id, nextDriver.id);
                  }}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>Despachar com {availableMotoboys[0].name.split(' ')[0]}</span>
                </button>
              ) : (
                <div
                  className="text-[11px] text-amber-700 bg-amber-500/10 p-1.5 rounded-lg border border-amber-200 flex items-center justify-center gap-1.5 font-semibold cursor-help"
                  title="Pedido na fila prioritária. Nenhum motoboy livre no pátio da loja no momento. Será o primeiro a sair quando um entregador chegar."
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Aguardando motoboy no pátio (Fila 1)</span>
                </div>
              )}
            </div>
          )}

          {currentColumn === 'dispatched' && (
            <button
              type="button"
              onClick={() => onUpdateOrderStatus(order.id, 'delivered')}
              className="w-full py-1.5 bg-slate-100 hover:bg-emerald-700 text-slate-700 hover:text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Confirmar Entrega</span>
            </button>
          )}

          {currentColumn === 'delivered' && (
            <div className="w-full text-center text-[11px] text-slate-500 py-1">
              Entregue com sucesso
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* KANBAN TOOLBAR */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Store Selector Tabs & View Mode Toggle */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 mr-1 hidden sm:inline">Filtrar:</span>
          <button
            type="button"
            onClick={() => onSetStoreFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              storeFilter === 'all'
                ? 'bg-slate-100 text-slate-950 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas ({orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'failed' && !isTakeoutOrder(o)).length})
          </button>
          <button
            type="button"
            onClick={() => onSetStoreFilter('hope_pizza')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              storeFilter === 'hope_pizza'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-rose-700 hover:bg-slate-200 border border-rose-200'
            }`}
          >
            <span>🍕</span>
            <span>Hope Pizza</span>
          </button>
          <button
            type="button"
            onClick={() => onSetStoreFilter('hope_burger')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              storeFilter === 'hope_burger'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-amber-700 hover:bg-slate-200 border border-amber-200'
            }`}
          >
            <span>🍔</span>
            <span>Hope Burger</span>
          </button>

          {/* Toggle de Densidade: Modo Alta Demanda (200 pedidos) vs Cards */}
          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />
          <div className="flex items-center bg-slate-50 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewDensity('compact')}
              className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewDensity === 'compact'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Visão compacta em linhas de alta densidade (ideal para mais de 100 pedidos)"
            >
              <List className="w-3.5 h-3.5" />
              <span>Compacto (200+)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewDensity('detailed')}
              className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewDensity === 'detailed'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Visão clássica em cards detalhados"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>
        </div>

        {/* Right: Search, Sync & Actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente, nº ou bairro (tecle /)..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-200"
            />
          </div>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-slate-200"
            title="Sincronizar com Cardápio Web (status da loja e pedidos)"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span className="hidden md:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar CW'}</span>
          </button>

          {onOpenNewOrderModal && (
            <button
              type="button"
              onClick={onOpenNewOrderModal}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Novo Pedido</span>
            </button>
          )}
        </div>
      </div>

      {/* NOTIFICAÇÃO TOAST DE PROTEÇÃO DE DESPACHO */}
      {dispatchBlockedToast && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-3 flex items-center justify-between gap-3 text-slate-900 text-xs font-bold shadow-lg animate-bounce">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" />
            <span>{dispatchBlockedToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setDispatchBlockedToast(null)}
            className="text-rose-700 hover:text-slate-900 px-2 py-0.5 rounded bg-rose-50 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* AVISO DE GARGALO DE FROTA E ATRASO OPERACIONAL */}
      <FleetBottleneckBanner
        orders={orders}
        motoboys={motoboys}
        shift={shift}
        onFilterBottleneck={(filter) => setBottleneckFilter(filter as any)}
        onSelectOrders={(orderIds) => {
          setSelectedReadyIds(orderIds);
          setBottleneckFilter('all');
        }}
      />

      {/* BARRA ANTI-GARGALO E FILA OPERACIONAL (Alta Eficiência para 200 Pedidos) */}
      {shift.isOpen && (
        <div className="bg-white/90 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
          {/* Filtros rápidos de gargalo */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] mr-1 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-600" /> Gargalos:
            </span>

            <button
              type="button"
              onClick={() => setBottleneckFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-xs ${
                bottleneckFilter === 'all'
                  ? 'bg-slate-200 text-slate-900'
                  : 'bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200'
              }`}
            >
              Todos ({baseShiftOrders.length})
            </button>

            {delayedPrepCount > 0 && (
              <button
                type="button"
                onClick={() => setBottleneckFilter(bottleneckFilter === 'delayed_prep' ? 'all' : 'delayed_prep')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                  bottleneckFilter === 'delayed_prep'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-50'
                }`}
                title="Filtrar pedidos com mais de 25 min em preparo ou novos"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>🚨 Atrasados Cozinha ({delayedPrepCount})</span>
              </button>
            )}

            {coolingCounterCount > 0 && (
              <button
                type="button"
                onClick={() => setBottleneckFilter(bottleneckFilter === 'cooling_counter' ? 'all' : 'cooling_counter')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                  bottleneckFilter === 'cooling_counter'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50'
                }`}
                title="Filtrar pedidos prontos há mais de 8 min sem motoboy"
              >
                <span>⚠️ Balcão Esfriando ({coolingCounterCount})</span>
              </button>
            )}

            {smartReadyBatches.length > 0 && (
              <button
                type="button"
                onClick={() => setBottleneckFilter(bottleneckFilter === 'batches' ? 'all' : 'batches')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                  bottleneckFilter === 'batches'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                }`}
                title="Filtrar pedidos prontos que seguem o mesmo caminho/corredor com tempo compatível"
              >
                <Zap className="w-3 h-3" />
                <span>⚡ Lotes no Mesmo Trajeto ({smartReadyBatches.length})</span>
              </button>
            )}
          </div>

          {/* Fila de motoboys no balcão (FIFO) */}
          <div className="flex items-center gap-1.5 text-xs overflow-x-auto py-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-emerald-600" /> Fila Balcão:
            </span>
            {availableMotoboys.length === 0 ? (
              <span className="text-slate-400 text-[11px] italic">Nenhum motoboy livre no pátio</span>
            ) : (
              availableMotoboys.map((m, idx) => (
                <span
                  key={m.id}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold shrink-0 border ${
                    idx === 0
                      ? 'bg-emerald-500/20 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                  title={`Posição ${idx + 1} na fila`}
                >
                  {idx + 1}º {m.name.split(' ')[0]}
                </span>
              ))
            )}
          </div>
        </div>
      )}

      {/* STRIP DE DESPACHO INTELIGENTE NO MESMO TRAJETO (Corredores viários com tempos estritamente sincronizados) */}
      {smartReadyBatches.length > 0 && (
        <div
          className={`border rounded-xl p-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-xs ${
            availableMotoboys.length > 0
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                availableMotoboys.length > 0
                  ? 'bg-emerald-400 animate-ping'
                  : 'bg-amber-400'
              }`}
            />
            <div>
              <span
                className={`font-black uppercase tracking-wide flex items-center gap-1.5 ${
                  availableMotoboys.length > 0 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-700 fill-amber-300" />
                Despacho Inteligente no Mesmo Trajeto ({smartReadyBatches.length}{' '}
                {smartReadyBatches.length === 1 ? 'lote compatível' : 'lotes compatíveis'})
                {availableMotoboys.length === 0 && (
                  <span className="text-[10px] lowercase font-normal bg-amber-500/20 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                    aguardando retorno ao pátio
                  </span>
                )}
              </span>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {availableMotoboys.length > 0
                  ? 'Pedidos no mesmo caminho com horários alinhados (diferença máx. 8m). Jamais junta pedido novo com pedido antigo.'
                  : 'Lotes pré-organizados por corredor viário. Despacho protegido até que o próximo motoboy chegue à loja.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {smartReadyBatches.slice(0, 3).map((batch) => (
              <button
                key={batch.id}
                type="button"
                onClick={() => handleDispatchBatchOrders(batch.orders.map((o) => o.id))}
                className={`px-3 py-1.5 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex flex-col items-start gap-0.5 border ${
                  availableMotoboys.length > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-200'
                    : 'bg-slate-100 hover:bg-slate-750 border-amber-200 text-amber-700'
                }`}
                title={
                  availableMotoboys.length > 0
                    ? `Despachar ${batch.orders.length} pedidos (${batch.neighborhoodSummary}) para ${availableMotoboys[0].name}. Esperas: ${batch.orders.map((o) => getOrderWaitMinutes(o) + 'm').join(', ')}`
                    : `Lote pronto (${batch.orders.length} pedidos em ${batch.corridorName}). Clique para tentar despachar (aguardando motoboy no pátio).`
                }
              >
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-700 fill-amber-300" />
                  <span>
                    {batch.corridorName} ({batch.orders.length}){' '}
                    {availableMotoboys.length > 0
                      ? `➔ ${availableMotoboys[0].name.split(' ')[0]}`
                      : '➔ (Aguardando Motoboy)'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-600 font-medium">
                  {batch.interOrderDistanceKm}km entre entregas · Δt {batch.timeSpreadMinutes}m
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STATUS BANNER QUANDO A LOJA ESTÁ FECHADA */}
      {!shift.isOpen && (
        <div className="bg-white/90 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0 animate-pulse" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-rose-700 uppercase tracking-wider">
                  Loja Fechada no Cardápio Web
                </span>
                <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Abertura Automática às 18:00
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {shift.cardapioWebStatus?.pizza?.reason || shift.cardapioWebStatus?.burger?.reason || 'Fora do horário de expediente (18:00 às 23:00)'}. Assim que a loja abrir no Cardápio Web, o Rota Fácil iniciará a esteira em tempo real.
              </p>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Monitoramento em 2º plano ativo</span>
          </div>
        </div>
      )}

      {/* KANBAN BOARD COLUMNS (5 Classic Delivery Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 items-start">
        {/* COLUNA 1: NOVOS / AGUARDANDO */}
        <div className="bg-slate-50/60 rounded-2xl border border-slate-200 flex flex-col max-h-[82vh]">
          <div className="p-3 border-b border-slate-200/80 bg-white/80 rounded-t-2xl flex items-center justify-between border-t-4 border-t-amber-500">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  1. Novos / Aguardando
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Entraram no sistema</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-700 border border-amber-200">
              {pendingOrders.length}
            </span>
          </div>

          <div className="p-2.5 space-y-2 overflow-y-auto flex-1">
            {pendingOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 font-medium">
                Nenhum pedido aguardando
              </div>
            ) : (
              pendingOrders.map((ord) =>
                viewDensity === 'compact' ? renderOrderRow(ord, 'pending') : renderOrderCard(ord, 'pending')
              )
            )}
          </div>
        </div>

        {/* COLUNA 2: EM PREPARO / COZINHA */}
        <div className="bg-slate-50/60 rounded-2xl border border-slate-200 flex flex-col max-h-[82vh]">
          <div className="p-3 border-b border-slate-200/80 bg-white/80 rounded-t-2xl flex items-center justify-between border-t-4 border-t-blue-500">
            <div>
              <div className="flex items-center gap-2">
                <ChefHat className="w-3.5 h-3.5 text-blue-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  2. Na Cozinha
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Em forno ou chapa</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-500/20 text-blue-700 border border-blue-200">
              {preparingOrders.length}
            </span>
          </div>

          <div className="p-2.5 space-y-2 overflow-y-auto flex-1">
            {preparingOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 font-medium">
                Cozinha livre
              </div>
            ) : (
              preparingOrders.map((ord) =>
                viewDensity === 'compact' ? renderOrderRow(ord, 'preparing') : renderOrderCard(ord, 'preparing')
              )
            )}
          </div>
        </div>

        {/* COLUNA 3: PRONTOS P/ ENTREGA */}
        <div className="bg-slate-50/60 rounded-2xl border border-slate-200 flex flex-col max-h-[82vh]">
          <div className="p-3 border-b border-slate-200/80 bg-white/80 rounded-t-2xl flex items-center justify-between border-t-4 border-t-emerald-500">
            <div>
              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-emerald-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  3. Prontos p/ Entrega
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Aguardando motoboy</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-700 border border-emerald-200">
              {readyOrders.length}
            </span>
          </div>

          <div className="p-2.5 space-y-2 overflow-y-auto flex-1">
            {readyOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 font-medium">
                Nenhum pedido na bancada
              </div>
            ) : (
              readyOrders.map((ord) =>
                viewDensity === 'compact' ? renderOrderRow(ord, 'ready') : renderOrderCard(ord, 'ready')
              )
            )}
          </div>
        </div>

        {/* COLUNA 4: EM ROTA */}
        <div className="bg-slate-50/60 rounded-2xl border border-slate-200 flex flex-col max-h-[82vh]">
          <div className="p-3 border-b border-slate-200/80 bg-white/80 rounded-t-2xl flex items-center justify-between border-t-4 border-t-indigo-500">
            <div>
              <div className="flex items-center gap-2">
                <Bike className="w-3.5 h-3.5 text-indigo-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  4. Em Rota
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Na rua com motoboy</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-700 border border-indigo-200">
              {dispatchedOrders.length}
            </span>
          </div>

          <div className="p-2.5 space-y-2 overflow-y-auto flex-1">
            {dispatchedOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 font-medium">
                Nenhum motoboy na rua
              </div>
            ) : (
              dispatchedOrders.map((ord) =>
                viewDensity === 'compact' ? renderOrderRow(ord, 'dispatched') : renderOrderCard(ord, 'dispatched')
              )
            )}
          </div>
        </div>

        {/* COLUNA 5: ENTREGUES HOJE */}
        <div className="bg-slate-50/60 rounded-2xl border border-slate-200 flex flex-col max-h-[82vh]">
          <div className="p-3 border-b border-slate-200/80 bg-white/80 rounded-t-2xl flex items-center justify-between border-t-4 border-t-slate-600">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">
                  5. Concluídos Hoje
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Entregues com sucesso</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-200">
              {deliveredOrders.length}
            </span>
          </div>

          <div className="p-2.5 space-y-2 overflow-y-auto flex-1">
            {deliveredOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 font-medium">
                Nenhuma entrega finalizada hoje
              </div>
            ) : (
              deliveredOrders.map((ord) =>
                viewDensity === 'compact' ? renderOrderRow(ord, 'delivered') : renderOrderCard(ord, 'delivered')
              )
            )}
          </div>
        </div>
      </div>

      {/* BARRA FLUTUANTE DE DESPACHO EM MASSA (Quando o operador marca checkboxes na coluna Prontos) */}
      {selectedReadyIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-50/95 border-2 border-emerald-200 p-3 px-5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 text-slate-900 w-[92%] max-w-xl animate-slideUp">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span className="font-black text-xs sm:text-sm text-emerald-700 uppercase tracking-wide">
              🎒 {selectedReadyIds.length} {selectedReadyIds.length === 1 ? 'pedido selecionado' : 'pedidos selecionados'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {availableMotoboys.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedTargetMotoboyId || availableMotoboys[0]?.id || ''}
                  onChange={(e) => setSelectedTargetMotoboyId(e.target.value)}
                  aria-label="Selecionar motoboy para despacho em lote"
                  className="bg-white border border-slate-200 text-xs text-slate-900 rounded-xl px-2.5 py-2 font-bold focus:outline-hidden focus:border-emerald-200"
                >
                  {availableMotoboys.map((m, i) => (
                    <option key={m.id} value={m.id}>
                      {i === 0 ? `⭐ 1º da fila: ${m.name}` : `${i + 1}º: ${m.name}`}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const targetId = selectedTargetMotoboyId || availableMotoboys[0]?.id;
                    if (targetId) {
                      handleDispatchBatchOrders(selectedReadyIds, targetId);
                    }
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5 uppercase tracking-wide border border-emerald-200"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-700 fill-amber-300 shrink-0" />
                  <span>Despachar</span>
                </button>
              </div>
            ) : (
              <span className="text-xs text-amber-700 bg-amber-500/20 px-2.5 py-1.5 rounded-xl border border-amber-200">
                Sem motoboy livre no pátio
              </span>
            )}

            <button
              type="button"
              onClick={() => setSelectedReadyIds([])}
              className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

