import React, { useState } from 'react';
import {
  Package,
  Plus,
  MapPin,
  Printer,
  Bike,
  Zap,
} from 'lucide-react';
import { Order, Motoboy, StoreShift } from '../types';
import { RouteMap } from './RouteMap';

interface OperationDispatchViewProps {
  orders: Order[];
  motoboys: Motoboy[];
  shift: StoreShift;
  activeOrders: Order[];
  unassignedOrders: Order[];
  motoboysAvailable: Motoboy[];
  selectedOrderIds: string[];
  setSelectedOrderIds: (ids: string[]) => void;
  selectedMotoboyId: string | null;
  setSelectedMotoboyId: (id: string | null) => void;
  onAssignOrderToMotoboy: (orderId: string, motoboyId: string) => void;
  onAssignBatchToMotoboy?: (orderIds: string[], motoboyId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onUpdateMotoboyStatus?: (motoboyId: string, status: Motoboy['status']) => void;
  onOpenNewOrderModal: () => void;
  onOpenMotoboyModal: () => void;
  onSelectOrderForTracking: (order: Order) => void;
  setIsRouteModalOpen: (open: boolean) => void;
  setTicketOrder: (order: Order) => void;
  setIsTicketOpen: (open: boolean) => void;
  handleCallCounter: (motoboyId: string, motoboyName: string) => void;
  triggerActionToast: (msg: string) => void;
  setActiveTab: (tab: any) => void;
  getMotoboyLoad: (motoboyId: string) => number;
  assignOrderRespectingLoad: (orderId: string, motoboyId: string) => void;
}

export const OperationDispatchView: React.FC<OperationDispatchViewProps> = ({
  orders,
  motoboys,
  shift,
  activeOrders,
  unassignedOrders,
  motoboysAvailable,
  selectedOrderIds,
  setSelectedOrderIds,
  selectedMotoboyId,
  setSelectedMotoboyId,
  onAssignOrderToMotoboy,
  onAssignBatchToMotoboy,
  onUpdateOrderStatus,
  onUpdateMotoboyStatus,
  onOpenNewOrderModal,
  onOpenMotoboyModal,
  onSelectOrderForTracking,
  setIsRouteModalOpen,
  setTicketOrder,
  setIsTicketOpen,
  handleCallCounter,
  triggerActionToast,
  setActiveTab,
  getMotoboyLoad,
  assignOrderRespectingLoad,
}) => {
  const [orderSort, setOrderSort] = useState<'time' | 'value' | 'neighborhood'>('time');
  const [isCompactMode, setIsCompactMode] = useState<boolean>(false);

  const formattedCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getOrderDisplayCode = (ord: Order) => {
    if (ord.displayCode) return ord.displayCode;
    const isBurger = ord.storeBranch === 'hope_burger' || ord.storeName?.toLowerCase().includes('burger');
    const isPizza = ord.storeBranch === 'hope_pizza' || ord.storeName?.toLowerCase().includes('pizz');
    if (isBurger) return `HB-${ord.codeNumber}`;
    if (isPizza) return `HP-${ord.codeNumber}`;
    return `#${ord.codeNumber}`;
  };

  const renderChannelBadge = (channel?: string) => {
    switch (channel) {
      case 'ifood':
        return (
          <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
            iFood
          </span>
        );
      case 'cardapio_web':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
            Cardápio
          </span>
        );
      case 'pdv':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
            PDV
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
            WhatsApp
          </span>
        );
    }
  };

  const getPaymentLabel = (method?: string) => {
    switch (method) {
      case 'pix':
        return '🟢 PIX';
      case 'card_machine':
        return '💳 Cartão (Máquina)';
      case 'cash':
        return '💵 Dinheiro';
      case 'online':
        return '✅ Pago Online';
      default:
        return '💵 A Cobrar';
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner quando não há nenhum pedido na operação */}
      {unassignedOrders.length === 0 && activeOrders.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-3">
          <Package className="w-10 h-10 text-emerald-400 mx-auto" />
          <div>
            <p className="font-bold text-white text-sm">Nenhum pedido ativo no momento</p>
            <p className="text-xs text-slate-400 mt-0.5">Aguardando novos pedidos chegarem ou lance um pedido manualmente.</p>
          </div>
          <button
            type="button"
            onClick={onOpenNewOrderModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Criar primeiro pedido
          </button>
        </div>
      )}

      {/* GRID OPERACIONAL DIRETO: 2 COLUNAS (FILOSOFIA CARDÁPIO WEB / PDV) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ============================================================== */}
        {/* COLUNA ESQUERDA: PEDIDOS A DESPACHAR (PROTAGONISTA - ~65%)      */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 xl:col-span-8 min-w-0 bg-slate-900 rounded-xl p-3 sm:p-4 border border-slate-800 space-y-3 shadow-xs">
          {/* Barra de Ações e Filtro de Pedidos */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-sm text-white flex items-center gap-1.5">
                <span>📦 Pedidos a Despachar</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {unassignedOrders.length}
                </span>
              </h3>

              {/* Alternador Detalhado / Compacto */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setIsCompactMode(false)}
                  className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    !isCompactMode ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Detalhado
                </button>
                <button
                  type="button"
                  onClick={() => setIsCompactMode(true)}
                  className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    isCompactMode ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Compacto
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              {/* Ordenação */}
              <select
                value={orderSort}
                onChange={(e) => setOrderSort(e.target.value as any)}
                className="bg-slate-950 text-slate-300 font-bold px-2 py-1 rounded-lg border border-slate-800 focus:outline-none cursor-pointer"
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
                  className="text-xs font-bold text-slate-400 hover:text-white underline cursor-pointer"
                >
                  {selectedOrderIds.length === unassignedOrders.length ? 'Desmarcar' : 'Selecionar todos'}
                </button>
              )}
            </div>
          </div>

          {/* Barra de Ação em Lote (Quando houver pedidos selecionados) */}
          {selectedOrderIds.length > 0 && (
            <div className="bg-blue-950/40 border border-blue-500/40 p-2.5 rounded-xl flex items-center justify-between gap-2 flex-wrap animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-200">
                <span>✓ {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'pedido selecionado' : 'pedidos selecionados'}</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {motoboysAvailable.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onAssignBatchToMotoboy) {
                        onAssignBatchToMotoboy(selectedOrderIds, motoboysAvailable[0].id);
                      } else {
                        selectedOrderIds.forEach((id) => onAssignOrderToMotoboy(id, motoboysAvailable[0].id));
                      }
                      triggerActionToast(`🚀 ${selectedOrderIds.length} pedidos despachados para ${motoboysAvailable[0].name.split(' ')[0]}!`);
                      setSelectedOrderIds([]);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Despachar para {motoboysAvailable[0].name.split(' ')[0]} (1º da fila)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsRouteModalOpen(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-lg cursor-pointer"
                >
                  Organizar rota em lote
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOrderIds([])}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer px-1"
                >
                  Limpar seleção
                </button>
              </div>
            </div>
          )}

          {/* Lista dos Pedidos Não Atribuídos */}
          <div className="space-y-2">
            {unassignedOrders.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-800 rounded-xl space-y-1">
                <p className="font-bold text-slate-300">Nenhum pedido aguardando despacho.</p>
                <p className="text-slate-500">Todos os pedidos prontos já foram atribuídos a motoboys.</p>
              </div>
            )}

            {[...unassignedOrders]
              .sort((a, b) => {
                if (orderSort === 'time') return a.createdAt - b.createdAt;
                if (orderSort === 'value') return (b.total || 0) - (a.total || 0);
                return (a.neighborhood || '').localeCompare(b.neighborhood || '');
              })
              .map((ord) => {
                const isSelected = selectedOrderIds.includes(ord.id);
                const elapsedMin = Math.floor((Date.now() - ord.createdAt) / 60000);
                const isDelayed = elapsedMin >= 20;

                return (
                  <div
                    key={ord.id}
                    className={`rounded-xl border transition-all p-3 space-y-2.5 ${
                      isSelected
                        ? 'bg-slate-800/90 border-blue-500/80 ring-1 ring-blue-500/50'
                        : isDelayed
                        ? 'bg-slate-950/70 border-rose-500/40 hover:border-rose-500/60'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Linha 1: Identificação + Cliente + Tempo */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              setSelectedOrderIds(selectedOrderIds.filter((id) => id !== ord.id));
                            } else {
                              setSelectedOrderIds([...selectedOrderIds, ord.id]);
                            }
                          }}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                        <span className="text-base font-black text-white tracking-tight">
                          {getOrderDisplayCode(ord)}
                        </span>
                        <span className="text-xs font-bold text-slate-300">
                          {ord.clientName}
                        </span>
                        {renderChannelBadge(ord.channel)}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                            isDelayed
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          🕒 há {elapsedMin} min
                        </span>
                      </div>
                    </div>

                    {/* Linha 2: Endereço completo + Bairro destacado */}
                    <div className="text-xs text-slate-300 flex items-start gap-1.5 leading-relaxed">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-white font-medium">{ord.address}</span>
                        {ord.neighborhood && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px] font-bold border border-slate-700">
                            {ord.neighborhood}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Se não for modo compacto e houver itens, exibir itens */}
                    {!isCompactMode && ord.items && ord.items.length > 0 && (
                      <p className="text-[11px] text-slate-400 font-normal line-clamp-1">
                        🛍️ {ord.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                      </p>
                    )}

                    {/* Linha 3: Total + Pagamento + Ações de Despacho */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-emerald-400">
                          {formattedCurrency(ord.total || 0)}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {getPaymentLabel(ord.paymentMethod)}
                        </span>
                        {ord.notes && (
                          <span className="text-[11px] text-amber-300/90 font-medium truncate max-w-xs" title={ord.notes}>
                            📝 {ord.notes}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Botão de Despacho Rápido para o 1º da fila */}
                        {motoboysAvailable.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => assignOrderRespectingLoad(ord.id, motoboysAvailable[0].id)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                            title={`Despachar imediatamente para ${motoboysAvailable[0].name}`}
                          >
                            <span>🚀 Despachar p/ {motoboysAvailable[0].name.split(' ')[0]}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-amber-400 bg-amber-950/60 px-2 py-1 rounded border border-amber-500/30 font-medium">
                            Sem motoboy livre
                          </span>
                        )}

                        {/* Dropdown para escolher outro motoboy */}
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              assignOrderRespectingLoad(ord.id, e.target.value);
                            }
                          }}
                          defaultValue=""
                          className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg cursor-pointer border border-slate-700 focus:outline-none"
                        >
                          <option value="" disabled className="bg-slate-900 text-slate-400">
                            Outro motoboy...
                          </option>
                          {motoboys.map((m) => (
                            <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                              {m.name.split(' ')[0]} ({m.status === 'available' ? 'Livre' : m.status === 'delivering' ? 'Em rota' : m.status})
                            </option>
                          ))}
                        </select>

                        {/* Botão Imprimir Comanda Térmica */}
                        <button
                          type="button"
                          onClick={() => {
                            setTicketOrder(ord);
                            setIsTicketOpen(true);
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-all cursor-pointer"
                          title="Imprimir comanda térmica"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* COLUNA DIREITA: FILA NO PÁTIO + MAPA COMPACTO DE APOIO (~35%)   */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 xl:col-span-4 min-w-0 space-y-4">
          {/* CARD 1: Fila no Pátio (Entregadores) */}
          <div className="bg-slate-900 rounded-xl p-3 sm:p-4 border border-slate-800 space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-black text-sm text-white flex items-center gap-1.5">
                  <span>🛵 Fila no Pátio</span>
                  <span className="text-xs font-bold text-emerald-400">
                    ({motoboysAvailable.length} livres)
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Ordem de chegada para recebimento de pedidos.
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenMotoboyModal}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold border border-slate-700 transition-all cursor-pointer"
              >
                + Cadastrar
              </button>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {motoboys.length === 0 && (
                <div className="p-4 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
                  <Bike className="w-6 h-6 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-300 font-bold">Nenhum motoboy na equipe</p>
                  <button
                    type="button"
                    onClick={onOpenMotoboyModal}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Cadastrar motoboy
                  </button>
                </div>
              )}

              {/* Motoboys Ordenados: Livres primeiro (1º, 2º...), depois Em Rota, Retornando, Pausados */}
              {[...motoboys]
                .sort((a, b) => {
                  if (a.status === 'available' && b.status !== 'available') return -1;
                  if (a.status !== 'available' && b.status === 'available') return 1;
                  if (a.status === 'returning_to_store' && b.status !== 'returning_to_store') return -1;
                  if (a.status !== 'returning_to_store' && b.status === 'returning_to_store') return 1;
                  return (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0);
                })
                .map((m) => {
                  const isAvail = m.status === 'available';
                  const isReturning = m.status === 'returning_to_store';
                  const isDelivering = m.status === 'delivering';
                  const isPaused = m.status === 'busy';

                  const availableList = motoboys.filter((x) => x.status === 'available').sort((a, b) => (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0));
                  const queuePos = isAvail ? availableList.findIndex((x) => x.id === m.id) + 1 : null;
                  const mOrders = orders.filter((o) => o.assignedMotoboyId === m.id && o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'failed');

                  return (
                    <div
                      key={m.id}
                      className={`p-2.5 rounded-xl border transition-all space-y-1.5 ${
                        isAvail && queuePos === 1
                          ? 'bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/30'
                          : isAvail
                          ? 'bg-slate-950/60 border-slate-800'
                          : isReturning
                          ? 'bg-amber-950/25 border-amber-500/40'
                          : 'bg-slate-950/40 border-slate-850 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {queuePos ? (
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                              queuePos === 1 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                            }`}>
                              {queuePos}º
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">
                              {isDelivering ? '🔵' : isReturning ? '🟠' : '⚪'}
                            </span>
                          )}
                          <span className="font-bold text-xs text-white">{m.name}</span>
                        </div>

                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${
                            isAvail
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : isReturning
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : isDelivering
                              ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {isAvail ? 'Livre no Pátio' : isReturning ? 'Retornando' : isDelivering ? 'Em rota' : isPaused ? 'Pausado' : 'Offline'}
                        </span>
                      </div>

                      {/* Detalhe do Motoboy & Ações Rápidas */}
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                        <span>
                          {isAvail ? (
                            `Na fila há ${m.joinedQueueAt ? Math.max(0, Math.floor((Date.now() - m.joinedQueueAt) / 60000)) : 0} min`
                          ) : isDelivering ? (
                            `${mOrders.length} ${mOrders.length === 1 ? 'parada' : 'paradas'} restante(s)`
                          ) : isReturning ? (
                            'Voltando para a loja'
                          ) : (
                            'Indisponível'
                          )}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isAvail && (
                            <button
                              type="button"
                              onClick={() => handleCallCounter(m.id, m.name)}
                              className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[10px] font-bold cursor-pointer"
                              title="Chamar motoboy no balcão"
                            >
                              🛎️ Chamar
                            </button>
                          )}

                          {mOrders.length > 0 && isAvail && (
                            <button
                              type="button"
                              onClick={() => {
                                mOrders.forEach((o) => {
                                  if (o.status !== 'in_transit') onUpdateOrderStatus(o.id, 'in_transit');
                                });
                                if (onUpdateMotoboyStatus) onUpdateMotoboyStatus(m.id, 'delivering');
                                triggerActionToast(`🛵 ${m.name.split(' ')[0]} liberado para saída!`);
                              }}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold cursor-pointer"
                            >
                              Liberar saída
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* CARD 2: Mapa Compacto de Apoio (Ferramenta secundária) */}
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 space-y-2 shadow-xs">
            <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-800">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                Mapa de Apoio (Blumenau)
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('mapa')}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
              >
                Ampliar mapa ↗
              </button>
            </div>

            <div className="h-60 rounded-lg overflow-hidden border border-slate-800 relative">
              <RouteMap
                origin={{
                  lat: (shift as any)?.storeLat && !isNaN((shift as any).storeLat) ? (shift as any).storeLat : -26.9194,
                  lng: (shift as any)?.storeLng && !isNaN((shift as any).storeLng) ? (shift as any).storeLng : -49.0661,
                  title: (shift as any)?.storeName || 'Hope Burger & Pizza',
                }}
                motoboysList={motoboys}
                stops={activeOrders
                  .filter((ord) => {
                    if (ord.address?.toLowerCase().includes('retirada') || ord.neighborhood?.toLowerCase() === 'balcão') return false;
                    if (typeof ord.lat !== 'number' || isNaN(ord.lat) || ord.lat === 0) return false;
                    if (typeof ord.lng !== 'number' || isNaN(ord.lng) || ord.lng === 0) return false;
                    return true;
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
                  }))}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationDispatchView;
