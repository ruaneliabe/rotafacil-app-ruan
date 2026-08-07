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
  onBackToDashboard: () => void;
}

export const CustomerTrackingView: React.FC<CustomerTrackingViewProps> = ({
  order,
  motoboy,
  shift,
  onBackToDashboard,
}) => {
  const [estimatedETA, setEstimatedETA] = useState<number>(order.estimatedMinutes);

  useEffect(() => {
    // Simulate countdown for realism
    const interval = setInterval(() => {
      setEstimatedETA((prev) => (prev > 1 ? prev - 1 : 1));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const formattedCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

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
          <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white font-black flex items-center justify-center text-lg">
            🍔
          </div>
          <div>
            <h2 className="font-extrabold text-sm">{shift.storeName}</h2>
            <p className="text-[11px] text-emerald-200">Rastreio em Tempo Real • #{order.codeNumber}</p>
          </div>
        </div>

        <button
          onClick={onBackToDashboard}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
        >
          Voltar ao Painel
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Status Card Banner */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold">
            <Clock className="w-4 h-4 text-emerald-600" />
            {order.status === 'delivered'
              ? 'Pedido Entregue!'
              : `Previsão de entrega: ~${estimatedETA} min`}
          </div>

          <div>
            <h1 className="text-xl font-black text-slate-900">
              {order.status === 'delivered'
                ? 'Seu pedido foi entregue! Bom apetite! 😋'
                : order.status === 'in_transit'
                ? 'O entregador está a caminho do seu endereço! 🛵💨'
                : order.status === 'picked_up'
                ? 'O entregador já retirou seu pedido na loja e iniciará a rota de entrega em instantes! 🎒'
                : order.status === 'ready_at_counter'
                ? 'Seu pedido está pronto e preparado para a saída do entregador! 📦'
                : 'Seu pedido está sendo preparado na cozinha! 🔥'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">Código de Rastreio: {order.trackingCode}</p>
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
        {motoboy && order.status === 'in_transit' && (
          <div className="bg-white rounded-3xl p-4 border border-emerald-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-emerald-800 uppercase">
                Seu Entregador Dedicado
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                A caminho
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

              <a
                href={`https://wa.me/55${motoboy.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Falar
              </a>
            </div>
          </div>
        )}

        {/* Map Display */}
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs space-y-2 p-3">
          <span className="text-xs font-extrabold text-slate-800 block px-1">
            Mapa de Acompanhamento Ao Vivo
          </span>
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
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600 font-medium">{order.itemsSummary}</span>
              <span className="font-bold text-slate-900">{formattedCurrency(order.subtotal)}</span>
            </div>

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
              <span className="uppercase text-slate-900">{order.paymentMethod}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
