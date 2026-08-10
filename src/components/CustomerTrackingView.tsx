import React, { useState, useEffect } from 'react';
import { Order, Motoboy, StoreShift } from '../types';
import {
  Bike,
  MapPin,
  Phone,
  Clock,
  CheckCircle2,
  Store,
  ChevronRight,
  MessageSquare,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { RouteMap } from './RouteMap';

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
  const [estimatedETA, setEstimatedETA] = useState<number>(order.estimatedMinutes || 30);

  useEffect(() => {
    // Dynamic countdown for realism
    const interval = setInterval(() => {
      setEstimatedETA((prev) => (prev > 1 ? prev - 1 : 1));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const formattedCurrency = (val: number | undefined | null) => {
    const safeVal = typeof val === 'number' && !isNaN(val) ? val : 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeVal);
  };

  // Calculate route stop queue position for this motoboy
  const motoboyOrders = (allOrders || [])
    .filter(
      (o) =>
        (o.assignedMotoboyId && motoboy?.id && o.assignedMotoboyId === motoboy.id) ||
        (o.assignedMotoboyName && motoboy?.name && o.assignedMotoboyName.toLowerCase() === motoboy.name.toLowerCase())
    )
    .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')
    .sort((a, b) => (a.routeSequence || 99) - (b.routeSequence || 99));

  const stopsAhead = motoboyOrders.findIndex((o) => o.id === order.id);

  const getStatusStep = () => {
    switch (order.status) {
      case 'pending':
      case 'preparing':
        return 1;
      case 'ready_at_counter':
      case 'picked_up':
        return 2;
      case 'in_transit':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 1;
    }
  };

  const currentStep = getStatusStep();

  return (
    <div className="max-w-xl mx-auto bg-slate-50 min-h-screen border-x border-slate-200 font-sans pb-12">
      {/* Header Bar */}
      <div className="bg-[#1e4d3b] text-white p-4 sticky top-0 z-50 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white font-black flex items-center justify-center text-lg shadow-inner">
            🍔
          </div>
          <div>
            <h2 className="font-extrabold text-sm">{shift.storeName || 'Hope Burger'}</h2>
            <p className="text-[11px] text-emerald-200">Rastreio em Tempo Real • #{order.codeNumber}</p>
          </div>
        </div>

        {isOperator && onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Voltar ao Painel
          </button>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* Live Status Indicator & ETA */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs text-center space-y-4">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold">
              <Clock className="w-4 h-4 text-emerald-600" />
              {order.status === 'delivered'
                ? 'Pedido Entregue!'
                : `Previsão de entrega: ~${estimatedETA} min`}
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-200 text-[11px] font-extrabold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Atualização ao Vivo</span>
            </div>
          </div>

          <div>
            <h1 className="text-xl font-black text-slate-900 leading-snug">
              {order.status === 'delivered'
                ? 'Seu pedido foi entregue! Bom apetite! 😋'
                : order.status === 'in_transit'
                ? 'O entregador está a caminho do seu endereço! 🛵💨'
                : stopsAhead > 0
                ? 'O entregador já está com seu pedido na bag! 🎒'
                : order.status === 'picked_up'
                ? 'O entregador já retirou seu pedido na loja e iniciará a rota em instantes! 🎒'
                : order.status === 'ready_at_counter'
                ? 'Seu pedido está pronto e preparado para a saída do entregador! 📦'
                : 'Seu pedido está sendo preparado na cozinha! 🔥'}
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-mono">Código de Rastreio: {order.trackingCode}</p>

            {/* Sub-banner for queue status ahead */}
            {stopsAhead > 0 && order.status !== 'delivered' && order.status !== 'in_transit' && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs text-left space-y-1 font-medium">
                <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                  📍 Entrega antecedente em andamento
                </span>
                <p className="text-amber-800 leading-relaxed">
                  O entregador <strong>{motoboy?.name || 'da loja'}</strong> está realizando{' '}
                  <strong>{stopsAhead} {stopsAhead === 1 ? 'entrega' : 'entregas'}</strong> na sua frente. Assim que ele concluir a parada anterior, a rota para o seu endereço será iniciada!
                </p>
              </div>
            )}
          </div>

          {/* Stepper Progress */}
          <div className="grid grid-cols-4 gap-1.5 pt-2">
            <div className={`h-2 rounded-full ${currentStep >= 1 ? 'bg-emerald-600' : 'bg-slate-200'}`} />
            <div className={`h-2 rounded-full ${currentStep >= 2 ? 'bg-emerald-600' : 'bg-slate-200'}`} />
            <div className={`h-2 rounded-full ${currentStep >= 3 ? 'bg-emerald-600' : 'bg-slate-200'}`} />
            <div className={`h-2 rounded-full ${currentStep >= 4 ? 'bg-emerald-600' : 'bg-slate-200'}`} />
          </div>

          <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1">
            <span className={currentStep >= 1 ? 'text-emerald-700 font-extrabold' : ''}>Preparo</span>
            <span className={currentStep >= 2 ? 'text-emerald-700 font-extrabold' : ''}>Pronto</span>
            <span className={currentStep >= 3 ? 'text-emerald-700 font-extrabold' : ''}>Em trânsito</span>
            <span className={currentStep >= 4 ? 'text-emerald-700 font-extrabold' : ''}>Entregue</span>
          </div>
        </div>

        {/* Motoboy Card (If assigned) */}
        {motoboy && (order.status === 'in_transit' || order.status === 'picked_up' || stopsAhead >= 0) && order.status !== 'delivered' && (
          <div className="bg-white rounded-3xl p-4 border border-emerald-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-emerald-800 uppercase">
                Seu Entregador Dedicado
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {order.status === 'in_transit' ? 'A caminho' : 'Na Bag / Em rota'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#1e4d3b] text-white flex items-center justify-center font-bold text-xl shrink-0">
                🛵
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-sm text-slate-900">{motoboy.name}</h3>
                <p className="text-xs text-slate-500">
                  {motoboy.vehicleModel} • Placa: {motoboy.plate}
                </p>
              </div>

              {motoboy.phone && (
                <a
                  href={`https://wa.me/55${motoboy.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${motoboy.name}! Sou o cliente do pedido #${order.codeNumber}.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm shrink-0 transition-all cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-100" />
                  <span>Falar no WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Map Display */}
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs space-y-2 p-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-extrabold text-slate-800">
              Mapa de Acompanhamento Ao Vivo
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              🗺️ Rota estimada ao seu endereço
            </span>
          </div>
          <div className="h-[280px] rounded-2xl overflow-hidden">
            <RouteMap
              origin={{
                name: shift.storeName,
                address: shift.storeAddress,
                lat: shift.storeLat,
                lng: shift.storeLng,
              }}
              motoboyName={motoboy?.name}
              motoboyVehicle={motoboy ? `${motoboy.vehicleModel} (${motoboy.plate})` : undefined}
              motoboyLat={motoboy?.currentLat}
              motoboyLng={motoboy?.currentLng}
              showMotoboyMarker={Boolean(motoboy && (order.status === 'in_transit' || order.status === 'picked_up'))}
              stops={[
                {
                  id: order.id,
                  orderIndex: 1,
                  title: `Seu Endereço (${order.clientName})`,
                  address: order.address,
                  lat: order.lat,
                  lng: order.lng,
                  status: order.status === 'delivered' ? 'delivered' : 'in_transit',
                  priority: 'high',
                  recipientName: order.clientName,
                },
              ]}
            />
          </div>
        </div>

        {/* Order Details Breakdown */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
            <span>Detalhes do Pedido #{order.codeNumber}</span>
            <span className="text-xs font-normal text-slate-500">{order.createdAt}</span>
          </h3>

          <div className="space-y-2 text-xs">
            {order.items && order.items.length > 0 ? (
              order.items.map((item, idx) => {
                const rawPrice = typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0;
                const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
                const itemTotal = rawPrice * qty;
                return (
                  <div key={item.id || idx} className="flex items-start justify-between py-1.5 border-b border-slate-100 text-xs">
                    <div>
                      <div className="font-semibold text-slate-800">
                        {qty}x {item.name}
                      </div>
                      {item.observations && (
                        <div className="text-[11px] text-amber-700 italic mt-0.5">Obs: {item.observations}</div>
                      )}
                    </div>
                    <span className="font-bold text-slate-900">{formattedCurrency(itemTotal)}</span>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 text-xs">
                <span className="text-slate-700 font-semibold">{order.itemsSummary || 'Itens do pedido'}</span>
                <span className="font-bold text-slate-900">
                  {formattedCurrency(
                    order.subtotal && !isNaN(order.subtotal) ? order.subtotal : (order.total || 0)
                  )}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between py-1 border-t border-slate-100 text-slate-500">
              <span>Taxa de Entrega</span>
              <span>{formattedCurrency(order.deliveryFee)}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-slate-200 text-sm font-black text-[#1e4d3b]">
              <span>Total a pagar</span>
              <span>{formattedCurrency(order.total)}</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Forma de Pagamento:</span>
              <span className="uppercase text-slate-900 font-bold">{order.paymentMethod}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
