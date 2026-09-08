import React, { useState } from 'react';
import {
  AlertTriangle,
  Bike,
  Clock,
  Copy,
  Check,
  Flame,
  MessageSquare,
  ShieldCheck,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Order, Motoboy, StoreShift } from '../types';
import { calculateRoadDistanceKm } from '../utils/geoUtils';

interface FleetBottleneckBannerProps {
  orders: Order[];
  motoboys: Motoboy[];
  shift: StoreShift;
  onFilterBottleneck?: (filterType: 'delayed_prep' | 'cooling_counter' | 'all') => void;
  onSelectOrders?: (orderIds: string[]) => void;
}

export const FleetBottleneckBanner: React.FC<FleetBottleneckBannerProps> = ({
  orders,
  motoboys,
  shift,
  onFilterBottleneck,
  onSelectOrders,
}) => {
  const [copiedText, setCopiedText] = useState(false);
  const [showQueueDetails, setShowQueueDetails] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);

  if (!shift.isOpen) return null;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const getOrderWaitMinutes = (o: Order) => {
    const [h, m] = (o.createdAt || '00:00').split(':').map(Number);
    const ordMinutes = (h || 0) * 60 + (m || 0);
    let diff = nowMinutes - ordMinutes;
    if (diff < 0) diff += 24 * 60;
    return diff;
  };

  const isTakeoutOrder = (o: Order) => {
    const addr = (o.address || '').toLowerCase();
    const neigh = (o.neighborhood || '').toLowerCase();
    return addr.includes('retirada') || addr.includes('balcão') || neigh.includes('balcão') || (o as any).order_type === 'takeout';
  };

  // Pedidos ativos não entregues e não retiradas
  const activeDeliveryOrders = orders.filter(
    (o) =>
      o.status !== 'delivered' &&
      o.status !== 'cancelled' &&
      o.status !== 'failed' &&
      !isTakeoutOrder(o)
  );

  // Pedidos no balcão prontos sem motoboy
  const readyOrders = activeDeliveryOrders.filter((o) => o.status === 'ready_at_counter');
  // Pedidos esfriando no balcão (>= 8 minutos aguardando saída)
  const coolingCounterOrders = readyOrders.filter((o) => getOrderWaitMinutes(o) >= 8);
  // Pedidos com atraso crítico de espera total (>= 25 minutos)
  const criticalDelayedOrders = activeDeliveryOrders.filter(
    (o) => (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready_at_counter') && getOrderWaitMinutes(o) >= 25
  );

  // Motoboys livres no pátio da loja
  const availableMotoboys = motoboys.filter((m) => m.status === 'available');
  // Motoboys retornando para a loja
  const returningMotoboys = motoboys.filter((m) => m.status === 'returning_to_store');
  // Motoboys em rota na rua
  const inTransitMotoboys = motoboys.filter((m) => m.status === 'delivering' || m.status === 'on_delivery');
  const offlineMotoboys = motoboys.filter((m) => m.status === 'offline');

  // Próximo motoboy previsto para chegar
  const storeLat = shift.storeLat || -26.915304;
  const storeLng = shift.storeLng || -49.114635;

  const nextReturning = returningMotoboys
    .map((mb) => {
      const dist = calculateRoadDistanceKm(
        mb.currentLat || storeLat,
        mb.currentLng || storeLng,
        storeLat,
        storeLng
      );
      const etaMin = Math.max(1, Math.round((dist / 25) * 60));
      return { mb, dist, etaMin };
    })
    .sort((a, b) => a.etaMin - b.etaMin)[0];

  // Identificar se a operação está em estado de GARGALO REAL:
  // 1. Tem pedidos atrasados ou prontos no balcão E ZERO motoboys livres no pátio
  // 2. Ou pedidos prontos/atrasados excedem drasticamente a capacidade de motoboys livres
  const isZeroDriversAtStore = availableMotoboys.length === 0 && (readyOrders.length > 0 || criticalDelayedOrders.length > 0);
  const isHighDemandBottleneck =
    (criticalDelayedOrders.length >= 3 || coolingCounterOrders.length >= 3) &&
    availableMotoboys.length <= 1;

  if (!isZeroDriversAtStore && !isHighDemandBottleneck) {
    return null;
  }

  // Fila prioritária de saída (mais antigos primeiro para sair com o próximo motoboy)
  const exitPriorityQueue = [...activeDeliveryOrders]
    .filter((o) => o.status === 'ready_at_counter' || o.status === 'preparing')
    .sort((a, b) => getOrderWaitMinutes(b) - getOrderWaitMinutes(a));

  const getOrderDisplayCode = (ord: Order) => {
    if (ord.displayCode) return ord.displayCode;
    const isBurger = ord.storeBranch === 'hope_burger' || ord.storeName?.toLowerCase().includes('burger');
    const isPizza = ord.storeBranch === 'hope_pizza' || ord.storeName?.toLowerCase().includes('pizz');
    if (isBurger) return `HB-${ord.codeNumber}`;
    if (isPizza) return `HP-${ord.codeNumber}`;
    return `#${ord.codeNumber}`;
  };

  const whatsappMessageTemplate = `Olá! Tudo bem? 🛵✨

Informamos que nesta noite estamos com uma alta demanda de pedidos na cozinha e em rota na nossa região.

Para garantir que seu pedido chegue quentinho e com máxima qualidade, o tempo de entrega pode levar alguns minutinhos adicionais além da média habitual.

Seu pedido já está em prioridade máxima na nossa esteira e será despachado assim que o entregador retornar à loja.

Agradecemos imensamente pela paciência e preferência! 🙏🍔🍕`;

  const handleCopyWhatsapp = () => {
    try {
      navigator.clipboard.writeText(whatsappMessageTemplate);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 3000);
    } catch {
      // fallback
    }
  };

  return (
    <div
      id="fleet-bottleneck-warning-banner"
      className="bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-rose-950/30 border-2 border-amber-500/60 rounded-2xl p-3.5 sm:p-4 text-slate-100 shadow-md space-y-3 animate-fade-in"
    >
      {/* Header do Alerta */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2.5 border-b border-amber-500/20">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                ⚠️ Alerta de Gargalo de Frota & Atraso
              </span>
              <span className="text-[11px] text-rose-300 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">
                {criticalDelayedOrders.length} em atraso crítico (+25m)
              </span>
              <span className="text-[11px] text-amber-200 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                {coolingCounterOrders.length} esfriando no balcão (+8m)
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              A loja tem <strong>{readyOrders.length} pedidos prontos</strong> para sair, mas{' '}
              <strong className="text-amber-300">
                {availableMotoboys.length === 0
                  ? 'nenhum motoboy disponível no pátio'
                  : `apenas ${availableMotoboys.length} motoboy livre`}
              </strong>{' '}
              ({inTransitMotoboys.length} entregadores na rua).
            </p>
          </div>
        </div>

        {/* Status de Retorno do Próximo Entregador */}
        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 shrink-0 flex items-center gap-3">
          <Bike className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Previsão de Retorno</span>
            {nextReturning ? (
              <span className="font-extrabold text-emerald-300">
                {nextReturning.mb.name.split(' ')[0]} em ~{nextReturning.etaMin} min ({nextReturning.dist} km)
              </span>
            ) : returningMotoboys.length > 0 ? (
              <span className="font-extrabold text-blue-300">
                {returningMotoboys[0].name.split(' ')[0]} retornando à loja
              </span>
            ) : inTransitMotoboys.length > 0 ? (
              <span className="font-semibold text-slate-300">
                {inTransitMotoboys.length} motoboy(s) finalizando entregas na rua
              </span>
            ) : (
              <span className="font-bold text-rose-400">Nenhum motoboy ativo em rota</span>
            )}
          </div>
        </div>
      </div>

      {/* Regra de Proteção Operacional Anti-Despacho sem Motoboy */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-slate-300">
            <strong className="text-emerald-300 font-bold">Despacho Protegido Ativo:</strong> Nenhum pedido é despachado automaticamente sem motoboy presente no pátio. Isso evita pedidos marcados como entregues por engano ou extravios.
          </span>
        </div>

        {/* Ações Rápidas */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {onFilterBottleneck && (
            <button
              type="button"
              onClick={() => onFilterBottleneck('delayed_prep')}
              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1"
            >
              <Flame className="w-3 h-3 text-amber-300" />
              <span>Ver Atrasados ({criticalDelayedOrders.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowWhatsappModal(true)}
            className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 border border-emerald-500/40"
            title="Copiar mensagem amigável para envio a clientes que perguntarem sobre atraso"
          >
            <MessageSquare className="w-3 h-3" />
            <span>Avisar Clientes (WhatsApp)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQueueDetails((prev) => !prev)}
            className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg border border-slate-700 cursor-pointer flex items-center gap-1"
          >
            <span>Fila de Saída ({exitPriorityQueue.length})</span>
            {showQueueDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Detalhes da Fila de Saída Prioritária (Quando o próximo motoboy chegar) */}
      {showQueueDetails && exitPriorityQueue.length > 0 && (
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-400 font-bold text-[11px]">
            <span>
              🎯 Ordem de Saída para quando o próximo motoboy chegar (Mais antigos primeiro - FIFO):
            </span>
            {onSelectOrders && (
              <button
                type="button"
                onClick={() => onSelectOrders(exitPriorityQueue.slice(0, 4).map((o) => o.id))}
                className="text-amber-300 hover:underline font-bold cursor-pointer"
              >
                Selecionar Top 4 na Bag
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {exitPriorityQueue.slice(0, 8).map((ord, idx) => {
              const wait = getOrderWaitMinutes(ord);
              return (
                <div
                  key={ord.id}
                  className={`p-2 rounded-lg border flex flex-col justify-between gap-1 ${
                    wait >= 25
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-extrabold text-xs">
                    <span>
                      {idx + 1}º {getOrderDisplayCode(ord)}
                    </span>
                    <span className="text-[10px] bg-slate-800 px-1 rounded text-amber-300">
                      {wait}m espera
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {ord.neighborhood} · {ord.clientName}
                  </div>
                  <span className="text-[9px] font-bold uppercase text-emerald-400">
                    {ord.status === 'ready_at_counter' ? '✓ Pronto no balcão' : '🍳 Na cozinha'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal / Diálogo de Mensagem Pronta de Atraso para o WhatsApp */}
      {showWhatsappModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 max-w-lg w-full space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                <h4 className="font-extrabold text-sm text-white">
                  Comunicado de Atraso / Alta Demanda aos Clientes
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsappModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded bg-slate-800 cursor-pointer"
              >
                ✕ Fechar
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Copie o texto pronto abaixo para responder a clientes no WhatsApp ou iFood quando perguntarem sobre o tempo de entrega da noite:
            </p>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
              {whatsappMessageTemplate}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowWhatsappModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleCopyWhatsapp}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {copiedText ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Copiado com sucesso!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-white" />
                    <span>Copiar Mensagem</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
