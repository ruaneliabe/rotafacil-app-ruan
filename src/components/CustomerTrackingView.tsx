import React, { useMemo } from 'react';
import { Order, Motoboy, StoreShift } from '../types';
import { Clock, CheckCircle2, MessageSquare } from 'lucide-react';
import { RouteMap } from './RouteMap';
import { calculateDistanceKm } from '../utils/geoUtils';

interface CustomerTrackingViewProps {
  order: Order;
  motoboy?: Motoboy | null;
  shift: StoreShift;
  allOrders?: Order[];
  onBackToDashboard?: () => void;
  isOperator?: boolean;
}

export const CustomerTrackingView: React.FC<CustomerTrackingViewProps> = ({
  order,
  motoboy,
  shift,
  allOrders = [],
  onBackToDashboard,
  isOperator = false,
}) => {
  const hasLiveGps = Boolean(
    motoboy &&
    typeof motoboy.currentLat === 'number' && motoboy.currentLat !== 0 &&
    typeof motoboy.currentLng === 'number' && motoboy.currentLng !== 0 &&
    typeof motoboy.locationUpdatedAt === 'number' &&
    Date.now() - motoboy.locationUpdatedAt <= 30000
  );

  const estimatedETA = useMemo(() => {
    if (order.status === 'delivered') return 0;
    if (order.status === 'in_transit' && hasLiveGps && motoboy) {
      const distanceKm = calculateDistanceKm(motoboy.currentLat, motoboy.currentLng, order.lat, order.lng);
      return Math.max(2, Math.round((distanceKm / 25) * 60 + 2));
    }
    return Math.max(1, order.estimatedMinutes || 30);
  }, [order.status, order.estimatedMinutes, order.lat, order.lng, hasLiveGps, motoboy?.currentLat, motoboy?.currentLng]);

  const formattedCurrency = (val: number | undefined | null) => {
    const safeVal = typeof val === 'number' && !isNaN(val) ? val : 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeVal);
  };

  const motoboyOrders = (allOrders || [])
    .filter(
      (o) =>
        o.assignedMotoboyId && motoboy?.id && o.assignedMotoboyId === motoboy.id
    )
    .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')
    .sort((a, b) => (a.routeSequence || 99) - (b.routeSequence || 99));

  const stopsAhead = motoboyOrders.findIndex((o) => o.id === order.id);

  const getStatusStep = () => {
    switch (order.status) {
      case 'pending':
      case 'preparing': return 1;
      case 'ready_at_counter':
      case 'picked_up': return 2;
      case 'in_transit': return 3;
      case 'delivered': return 4;
      default: return 1;
    }
  };

  const currentStep = getStatusStep();
  const isInTransit = order.status === 'in_transit';
  const routeStartsAtDriver = order.status === 'in_transit' && hasLiveGps && motoboy;
  const waitingForDriverGps = order.status === 'in_transit' && Boolean(motoboy) && !hasLiveGps;
  const isPaid = order.paymentMethod === 'pix' || order.originChannel === 'ifood' || order.originChannel === 'cardapio_web';
  const paymentLabel = order.paymentMethod === 'pix'
    ? 'Pix'
    : order.paymentMethod === 'cartao_maquininha'
      ? 'Cartão na maquininha'
      : 'Dinheiro';
  const driverStageLabel = order.status === 'in_transit'
    ? 'A caminho'
    : order.status === 'picked_up'
      ? 'Pedido retirado'
      : order.status === 'ready_at_counter'
        ? 'Chamado para retirada'
        : 'Reservado para sua entrega';

  return (
    <div className="max-w-xl mx-auto bg-slate-50 min-h-screen border-x border-slate-200 font-sans pb-[calc(4rem+env(safe-area-inset-bottom))] overflow-x-hidden">
      <div className="bg-[#1e4d3b] text-white px-3 py-3 sm:p-4 sticky top-0 z-50 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white font-black flex items-center justify-center text-lg shadow-inner">🍔</div>
          <div>
            <h2 className="font-extrabold text-sm">{shift.storeName || 'Hope Burger'}</h2>
            <p className="text-[11px] text-emerald-200">Rastreio em Tempo Real • #{order.codeNumber}</p>
          </div>
        </div>
        {isOperator && onBackToDashboard && (
          <button onClick={onBackToDashboard} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer">Voltar ao Painel</button>
        )}
      </div>

      <div className="p-3 sm:p-4 space-y-4 sm:space-y-5">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs text-center space-y-4">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold">
              <Clock className="w-4 h-4 text-emerald-600" />
              {order.status === 'delivered' ? 'Pedido Entregue!' : `Previsão de entrega: ~${estimatedETA} min`}
            </div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-extrabold ${isInTransit && hasLiveGps ? 'bg-emerald-500/10 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
              <span className="relative flex h-2 w-2"><span className={`relative inline-flex rounded-full h-2 w-2 ${isInTransit && hasLiveGps ? 'bg-emerald-500' : 'bg-amber-500'}`}></span></span>
              <span>{isInTransit ? (hasLiveGps ? 'GPS ao vivo' : 'Aguardando GPS do entregador') : 'Rastreio ao vivo após a saída'}</span>
            </div>
          </div>

          <div>
            <h1 className="text-xl font-black text-slate-900 leading-snug">
              {order.status === 'delivered' ? 'Seu pedido foi entregue! Bom apetite! 😋' : order.status === 'in_transit' ? 'O entregador está a caminho do seu endereço! 🛵💨' : stopsAhead > 0 ? 'O entregador já está com seu pedido na bag! 🎒' : order.status === 'picked_up' ? 'O entregador já retirou seu pedido na loja e iniciará a rota em instantes! 🎒' : order.status === 'ready_at_counter' ? 'Seu pedido está pronto e preparado para a saída do entregador! 📦' : 'Seu pedido está sendo preparado na cozinha! 🔥'}
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-mono">Código de Rastreio: {order.trackingCode}</p>
            {waitingForDriverGps && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-left">
                <p className="text-xs font-extrabold text-amber-950">📍 Localização temporariamente indisponível</p>
                <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">O pedido está em trânsito, mas o celular do entregador ainda não enviou uma posição GPS. A localização aparecerá automaticamente assim que o sinal estiver disponível.</p>
              </div>
            )}
            {stopsAhead > 0 && order.status !== 'delivered' && order.status !== 'in_transit' && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs text-left space-y-1 font-medium">
                <span className="font-extrabold text-amber-950">📍 Entrega antecedente em andamento</span>
                <p className="text-amber-800 leading-relaxed">O entregador <strong>{motoboy?.name || 'da loja'}</strong> está realizando <strong>{stopsAhead} {stopsAhead === 1 ? 'entrega' : 'entregas'}</strong> na sua frente.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5 pt-2">
            {[1,2,3,4].map((step) => <div key={step} className={`h-2 rounded-full ${currentStep >= step ? 'bg-emerald-600' : 'bg-slate-200'}`} />)}
          </div>
          <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1">
            <span className={currentStep >= 1 ? 'text-emerald-700 font-extrabold' : ''}>Preparo</span><span className={currentStep >= 2 ? 'text-emerald-700 font-extrabold' : ''}>Pronto</span><span className={currentStep >= 3 ? 'text-emerald-700 font-extrabold' : ''}>Em trânsito</span><span className={currentStep >= 4 ? 'text-emerald-700 font-extrabold' : ''}>Entregue</span>
          </div>
        </div>

        {motoboy && (order.status === 'in_transit' || order.status === 'picked_up' || stopsAhead >= 0) && order.status !== 'delivered' && (
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 border border-emerald-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-extrabold text-emerald-800 uppercase">Entregador vinculado</span><span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">{driverStageLabel}</span></div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-[#1e4d3b] text-white flex items-center justify-center font-bold text-xl shrink-0">🛵</div>
                <div className="min-w-0 flex-1"><h3 className="font-extrabold text-sm text-slate-900 truncate">{motoboy.name}</h3><p className="text-xs text-slate-500 leading-relaxed">{motoboy.vehicleModel} • Placa: {motoboy.plate}</p></div>
              </div>
              {motoboy.phone && <a href={`https://wa.me/55${motoboy.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${motoboy.name}! Sou o cliente do pedido #${order.codeNumber}.`)}`} target="_blank" rel="noreferrer" className="w-full sm:w-auto px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm"><MessageSquare className="w-4 h-4" /><span>Falar no WhatsApp</span></a>}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs space-y-2 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-1 gap-0.5 sm:gap-2"><span className="text-xs font-extrabold text-slate-800">{isInTransit ? 'Acompanhamento ao vivo' : 'Previsão da rota'}</span><span className="text-[10px] text-slate-500 font-medium sm:text-right">🗺️ {routeStartsAtDriver ? 'Rota a partir do GPS atual' : waitingForDriverGps ? 'Aguardando localização do entregador' : 'Trajeto estimado da loja ao seu endereço'}</span></div>
          <div className="h-[220px] sm:h-[280px] rounded-2xl overflow-hidden relative">
            <RouteMap
              origin={routeStartsAtDriver ? { name: motoboy!.name, address: 'Posição atual do entregador', lat: motoboy!.currentLat, lng: motoboy!.currentLng } : { name: shift.storeName, address: shift.storeAddress, lat: shift.storeLat, lng: shift.storeLng }}
              motoboyName={motoboy?.name}
              motoboyVehicle={motoboy ? `${motoboy.vehicleModel} (${motoboy.plate})` : undefined}
              motoboyLat={hasLiveGps ? motoboy?.currentLat : undefined}
              motoboyLng={hasLiveGps ? motoboy?.currentLng : undefined}
              showMotoboyMarker={Boolean(motoboy && hasLiveGps && (order.status === 'in_transit' || order.status === 'picked_up'))}
              stops={[{ id: order.id, orderIndex: 1, title: `Seu Endereço (${order.clientName})`, address: order.address, lat: order.lat, lng: order.lng, status: order.status === 'delivered' ? 'delivered' : (order.status === 'in_transit' && hasLiveGps ? 'in_transit' : 'pending'), priority: 'high', recipientName: order.clientName }]}
            />
            {waitingForDriverGps && (
              <div className="absolute bottom-3 left-3 right-3 z-30 bg-slate-950/90 backdrop-blur-md border border-amber-400/50 rounded-xl px-3 py-2.5 shadow-xl flex items-start gap-2 pointer-events-none">
                <span className="text-amber-400 text-base">📍</span>
                <div>
                  <p className="text-[11px] font-extrabold text-white">Aguardando localização do entregador</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">A rota ao vivo será exibida assim que o celular do entregador enviar o GPS.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between gap-3"><span>Detalhes do Pedido #{order.codeNumber}</span><span className="text-xs font-normal text-slate-500 shrink-0">{order.createdAt}</span></h3>
          <div className="space-y-2 text-xs">
            {order.items && order.items.length > 0 ? order.items.map((item, idx) => {
              const rawPrice = typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0;
              const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
              return <div key={item.id || idx} className="flex items-start justify-between py-1.5 border-b border-slate-100 text-xs"><div><div className="font-semibold text-slate-800">{qty}x {item.name}</div>{item.observations && <div className="text-[11px] text-amber-700 italic mt-0.5">Obs: {item.observations}</div>}</div><span className="font-bold text-slate-900">{formattedCurrency(rawPrice * qty)}</span></div>;
            }) : <div className="flex items-center justify-between py-1.5 border-b border-slate-100 text-xs"><span className="text-slate-700 font-semibold">{order.itemsSummary || 'Itens do pedido'}</span><span className="font-bold text-slate-900">{formattedCurrency(order.subtotal && !isNaN(order.subtotal) ? order.subtotal : (order.total || 0))}</span></div>}
            <div className="flex items-center justify-between py-1 border-t border-slate-100 text-slate-500"><span>Taxa de Entrega</span><span>{formattedCurrency(order.deliveryFee)}</span></div>
            <div className="flex items-center justify-between py-2 border-t border-slate-200 text-sm font-black text-[#1e4d3b]"><span>{isPaid ? 'Total do pedido' : 'Valor a cobrar na entrega'}</span><span>{formattedCurrency(order.total)}</span></div>
            <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold ${isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-950'}`}>
              <span>{isPaid ? '✓ Pagamento confirmado' : 'Pagamento na entrega'}</span>
              <span className="font-extrabold text-right">{isPaid ? `${paymentLabel} · Nada a cobrar` : paymentLabel}</span>
            </div>
            {!isPaid && order.paymentMethod === 'dinheiro' && order.changeFor && order.changeFor > order.total && (
              <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 font-bold">Levar troco para {formattedCurrency(order.changeFor)}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
