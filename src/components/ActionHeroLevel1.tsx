import React from 'react';
import {
  Zap,
  Clock,
  MapPin,
  TrendingDown,
  AlertTriangle,
  Bike,
  Package,
  Plus,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Order, Motoboy, StoreShift } from '../types';
import { DispatchRecommendation } from '../utils/dispatchBrain';
import { getOrderWaitMinutes } from '../utils/routeCorridorUtils';

interface ActionHeroLevel1Props {
  orders: Order[];
  motoboys: Motoboy[];
  shift: StoreShift;
  recommendation?: DispatchRecommendation;
  secondaryRecommendations?: DispatchRecommendation[];
  onApplyRecommendation: (rec: DispatchRecommendation) => void;
  onDispatchSingleOrder?: (orderId: string, motoboyId: string) => void;
  onOpenNewOrderModal: () => void;
  onSelectOrders?: (orderIds: string[]) => void;
  onSwitchTab?: (tab: 'kanban' | 'operacao' | 'mapa' | 'equipe') => void;
}

export const ActionHeroLevel1: React.FC<ActionHeroLevel1Props> = ({
  orders,
  motoboys,
  shift,
  recommendation,
  secondaryRecommendations = [],
  onApplyRecommendation,
  onDispatchSingleOrder,
  onOpenNewOrderModal,
  onSelectOrders,
  onSwitchTab,
}) => {
  // 1. Números vitais imediatos
  const activeOrders = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  );
  const unassignedOrders = activeOrders.filter((o) => !o.assignedMotoboyId);
  const readyOrders = unassignedOrders.filter((o) => o.status === 'ready_at_counter');
  
  // Pedidos em atraso (+20 min desde o recebimento)
  const delayedOrders = unassignedOrders.filter((o) => getOrderWaitMinutes(o) >= 20);
  
  // Motoboys
  const availableMotoboys = motoboys.filter((m) => m.status === 'available');
  const returningMotoboys = motoboys.filter((m) => m.status === 'returning_to_store');
  const nextReturning = returningMotoboys[0];

  // Identificação do cenário de decisão
  const hasBottleneck = delayedOrders.length > 0 || (readyOrders.length >= 3 && availableMotoboys.length === 0);
  const isFleetEmpty = availableMotoboys.length === 0 && returningMotoboys.length > 0;
  const isEverythingCleared = unassignedOrders.length === 0;

  return (
    <section
      id="level-1-action-hero"
      aria-label="Nível 1 - Ação Imediata e Despacho Inteligente"
      className="space-y-3"
    >
      {/* 🔴 BARRA DE PULSO OPERACIONAL (O QUE ESTÁ ACONTECENDO AGORA) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Indicador 1: Pedidos Aguardando */}
        <button
          type="button"
          onClick={() => onSwitchTab?.('operacao')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            unassignedOrders.length > 0
              ? 'bg-rose-950/40 border-rose-500/40 hover:border-rose-400 text-rose-100 shadow-sm'
              : 'bg-slate-900/60 border-slate-800 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${unassignedOrders.length > 0 ? 'bg-rose-500 animate-ping' : 'bg-slate-600'}`} />
              Aguardando
            </span>
            <Package className="w-4 h-4 text-rose-400/70" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {unassignedOrders.length}
            </span>
            <span className="text-[11px] text-slate-300 font-medium">
              {readyOrders.length > 0 ? `(${readyOrders.length} prontos)` : 'pedidos'}
            </span>
          </div>
        </button>

        {/* Indicador 2: Motoboys Disponíveis no Pátio */}
        <button
          type="button"
          onClick={() => onSwitchTab?.('equipe')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            availableMotoboys.length > 0
              ? 'bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-400 text-emerald-100 shadow-sm'
              : 'bg-amber-950/30 border-amber-500/40 text-amber-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${availableMotoboys.length > 0 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              No Pátio
            </span>
            <Bike className="w-4 h-4 text-emerald-400/70" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {availableMotoboys.length}
            </span>
            <span className="text-[11px] text-slate-300 font-medium truncate">
              {availableMotoboys.length > 0
                ? `${availableMotoboys.length === 1 ? 'motoboy livre' : 'livres na fila'}`
                : nextReturning
                ? `${nextReturning.name.split(' ')[0]} volta ~${recommendation?.motoboyEtaMin || 5}m`
                : 'todos em rota'}
            </span>
          </div>
        </button>

        {/* Indicador 3: Pedidos Atrasados */}
        <button
          type="button"
          onClick={() => {
            if (delayedOrders.length > 0 && onSelectOrders) {
              onSelectOrders(delayedOrders.map((o) => o.id));
            }
            onSwitchTab?.('kanban');
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            delayedOrders.length > 0
              ? 'bg-amber-950/40 border-amber-500/50 hover:border-amber-400 text-amber-100 shadow-sm'
              : 'bg-slate-900/60 border-slate-800 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Atraso (+20m)
            </span>
            <Clock className="w-4 h-4 text-amber-400/70" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {delayedOrders.length}
            </span>
            <span className="text-[11px] text-slate-300 font-medium">
              {delayedOrders.length > 0 ? 'exigem prioridade' : 'em dia'}
            </span>
          </div>
        </button>

        {/* Indicador 4: Atalho Rápido para Novo Pedido */}
        <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/70 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Expedição
            </span>
            <span className="text-[10px] font-bold text-slate-500 font-mono">
              {activeOrders.length} ativos
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenNewOrderModal}
            className="w-full mt-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Novo Pedido</span>
          </button>
        </div>
      </div>

      {/* 🧠 O CORAÇÃO DO SISTEMA: "O ROTA FÁCIL DECIDE COMO DESPACHAR" */}
      {recommendation ? (
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 rounded-2xl border-2 border-emerald-500/50 shadow-2xl p-4 sm:p-5 relative overflow-hidden transition-all">
          {/* Luz sutil de destaque no fundo */}
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Cabeçalho da Decisão */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wide flex items-center gap-1.5 ${
                hasBottleneck
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}>
                {hasBottleneck ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                    <span>🚨 Gargalo Detectado</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>🧠 Melhor Rota Encontrada</span>
                  </>
                )}
              </span>

              <span className="text-xs text-slate-400 font-medium">
                Próxima ação recomendada pela inteligência de expedição
              </span>
            </div>

            {recommendation.estimatedSavingsMin && recommendation.estimatedSavingsMin > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-full shadow-xs self-start sm:self-auto">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                <span>Economia estimada: ~{recommendation.estimatedSavingsMin} min</span>
              </span>
            )}
          </div>

          {/* Corpo Principal da Recomendação */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            {/* Bloco Esquerda: O Entregador e o Trajeto */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center gap-2 flex-wrap text-sm sm:text-base">
                <span className="text-slate-400 font-semibold">Enviar</span>
                <span className="px-2.5 py-0.5 bg-slate-800 text-emerald-300 font-black rounded-lg border border-slate-700 flex items-center gap-1.5">
                  <Bike className="w-4 h-4 text-emerald-400" />
                  {recommendation.motoboyName}
                  {recommendation.motoboyStatus === 'returning_to_store' && (
                    <span className="text-[10px] text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/30">
                      volta em ~{recommendation.motoboyEtaMin}m
                    </span>
                  )}
                </span>
                <span className="text-slate-400 font-semibold">com</span>
                <span className="px-2.5 py-0.5 bg-emerald-950 text-emerald-200 font-black rounded-lg border border-emerald-500/40">
                  {recommendation.orders.length} {recommendation.orders.length === 1 ? 'pedido' : 'pedidos agrupados'}
                </span>
              </div>

              {/* Comandas e Trajeto dos Bairros */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {recommendation.orders.map((ord) => (
                    <span
                      key={ord.id}
                      className="px-2.5 py-1 bg-slate-800/90 text-white font-mono font-bold text-xs rounded-lg border border-slate-700/80 flex items-center gap-1.5"
                    >
                      <strong className="text-emerald-400">#{ord.codeNumber}</strong>
                      <span className="text-slate-300 text-[11px]">{ord.clientName.split(' ')[0]}</span>
                      <span className="text-[10px] text-slate-400">({ord.neighborhood})</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Trajeto Viário + Métricas de Rota */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="flex items-center gap-1.5 text-emerald-300 font-bold">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{recommendation.corridorLabel || recommendation.neighborhoodSummary}</span>
                </span>
                <span className="text-slate-600">•</span>
                <span>📏 {recommendation.totalDistanceKm} km</span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-300">⏱️ ~{recommendation.estimatedTripMin} min de rota</span>
              </div>

              {/* Racional Humano Curto */}
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                💡 {recommendation.rationale}
              </p>
            </div>

            {/* Bloco Direita: Ação de Despacho Imediata */}
            <div className="lg:col-span-5 flex flex-col justify-center space-y-2">
              {recommendation.waitSuggestion?.suggestWait ? (
                /* Cenário de Sincronização Cozinha ou Retorno */
                <div className="bg-amber-950/50 border-2 border-amber-500/50 rounded-xl p-3 space-y-2 text-amber-100">
                  <div className="flex items-center justify-between text-xs font-black text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Aguardar ~{recommendation.waitSuggestion.waitMinutes} min</span>
                    </span>
                    <span className="text-[10px] bg-emerald-950 border border-emerald-500/40 text-emerald-300 px-1.5 py-0.5 rounded">
                      Dentro do prazo
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-snug">
                    {recommendation.waitSuggestion.reason}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onApplyRecommendation(recommendation)}
                      className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer text-center"
                    >
                      Aguardar e Agrupar
                    </button>
                    {onDispatchSingleOrder && (
                      <button
                        type="button"
                        onClick={() => {
                          const readyId =
                            recommendation.waitSuggestion?.readyOrderId ||
                            recommendation.orders[0]?.id;
                          onDispatchSingleOrder(readyId, recommendation.motoboyId);
                        }}
                        className="py-2.5 px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer text-center"
                      >
                        Despachar #{recommendation.waitSuggestion?.readyOrderCode || recommendation.orders[0]?.codeNumber} agora
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Ação Direta de Despacho */
                <button
                  type="button"
                  onClick={() => onApplyRecommendation(recommendation)}
                  className={`w-full py-4 px-5 rounded-xl font-black text-sm uppercase tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xl active:scale-98 ${
                    recommendation.motoboyStatus === 'available'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-emerald-900/30'
                      : 'bg-amber-600 hover:bg-amber-500 text-white border border-amber-400 shadow-amber-900/30'
                  }`}
                >
                  <Zap className="w-5 h-5 fill-amber-300 text-amber-300" />
                  <span>
                    {recommendation.motoboyStatus === 'available'
                      ? 'Despachar Rota Agora'
                      : `Pré-vincular Rota (Motoboy a caminho)`}
                  </span>
                  <ArrowRight className="w-4 h-4 text-white/80 ml-1" />
                </button>
              )}

              {/* Dica de fila se houver múltiplos motoboys */}
              {availableMotoboys.length > 1 && (
                <p className="text-[11px] text-center text-slate-500">
                  {recommendation.motoboyName} é o 1º da fila do pátio (respeitando ordem de chegada).
                </p>
              )}
            </div>
          </div>
        </div>
      ) : isEverythingCleared ? (
        /* Estado Tranquilo: Sem pedidos pendentes */
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black text-lg shrink-0">
              ✓
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">
                Operação em dia! Nenhuma entrega pendente de despacho.
              </h4>
              <p className="text-xs text-slate-400">
                {availableMotoboys.length} entregador(es) livre(s) no pátio da loja aguardando novas saídas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenNewOrderModal}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Lançar Pedido</span>
          </button>
        </div>
      ) : isFleetEmpty ? (
        /* Cenário: Há pedidos prontos mas frota 100% na rua */
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-black text-lg shrink-0">
              🛵
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-200">
                Frota em Trânsito · {unassignedOrders.length} pedido(s) aguardando retorno
              </h4>
              <p className="text-xs text-amber-300/80">
                Nenhum motoboy livre no pátio. {nextReturning ? `${nextReturning.name} retorna em breve para assumir a 1ª saída prioritária.` : 'Todos em rota de entrega.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSwitchTab?.('kanban')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <span>Ver Fila no Kanban</span>
          </button>
        </div>
      ) : null}
    </section>
  );
};
