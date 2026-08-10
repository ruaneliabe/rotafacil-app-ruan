import React, { useState } from 'react';
import { Order, Motoboy, StoreShift } from '../types';
import {
  X,
  MapPin,
  Navigation,
  Copy,
  ExternalLink,
  CheckCircle2,
  Clock,
  Phone,
  User,
  ShoppingBag,
  Bike,
  Share2
} from 'lucide-react';
import { RouteMap } from './RouteMap';

interface OrderTrackingModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  motoboy?: Motoboy | null;
  shift: StoreShift;
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  order,
  isOpen,
  onClose,
  motoboy,
  shift,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !order) return null;

  const trackingUrl = `${window.location.origin}/?rastreio=${order.trackingCode || order.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = trackingUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleOpenGoogleMaps = () => {
    const query = encodeURIComponent(`${order.address}, ${order.neighborhood}, Blumenau`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(url, '_blank');
  };

  const handleOpenWaze = () => {
    const query = encodeURIComponent(`${order.address}, ${order.neighborhood}`);
    const url = `https://www.waze.com/ul?q=${query}&navigate=yes`;
    window.open(url, '_blank');
  };

  const handleSendWhatsAppClient = () => {
    const cleanPhone = order.clientPhone ? order.clientPhone.replace(/\D/g, '') : '';
    const msg = `Olá *${order.clientName}*! 🛵 Seu pedido *#${order.codeNumber}* (${shift.storeName || 'Delivery'}) está em andamento!\n\n📍 *Acompanhe no mapa em tempo real:* ${trackingUrl}`;
    const url = cleanPhone
      ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleOpenTrackingTab = () => {
    window.open(trackingUrl, '_blank');
  };

  const formattedCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black">
              <MapPin className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <span>Rastreio e Mapa do Pedido</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  #{order.codeNumber}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {order.clientName} • {order.neighborhood}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Map */}
          <div className="h-[280px] w-full rounded-2xl overflow-hidden border border-slate-800 shadow-md">
            <RouteMap
              origin={{
                name: shift.storeName || 'Hope Burger',
                address: shift.storeAddress || 'Rua dos Caçadores, 653',
                lat: shift.storeLat || -26.91530418395996,
                lng: shift.storeLng || -49.1146354675293,
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
                  title: `${order.clientName} (#${order.codeNumber})`,
                  address: order.address,
                  lat: order.lat || -26.91530418395996,
                  lng: order.lng || -49.1146354675293,
                  status: order.status === 'delivered' ? 'delivered' : 'in_transit',
                  priority: 'high',
                  recipientName: order.clientName,
                },
              ]}
            />
          </div>

          {/* Quick Map Actions (Google Maps / Waze) */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleOpenWaze}
              className="py-3 px-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Navigation className="w-4 h-4 fill-current" />
              <span>Navegar no Waze</span>
            </button>

            <button
              onClick={handleOpenGoogleMaps}
              className="py-3 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
              <span>Abrir no Google Maps</span>
            </button>
          </div>

          {/* Address & Order Details */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span className="uppercase tracking-wider text-[10px] text-amber-400">Endereço de Entrega</span>
              <span>Total: {formattedCurrency(order.total)} ({order.paymentMethod.toUpperCase()})</span>
            </div>

            <p className="text-sm font-black text-white leading-snug">
              {order.address}
            </p>
            <p className="text-xs text-slate-400">
              Bairro: <strong className="text-slate-200">{order.neighborhood}</strong> • Cidade: Blumenau / SC
            </p>

            {order.clientPhone && (
              <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  {order.clientName}
                </span>
                <a
                  href={`tel:${order.clientPhone}`}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold flex items-center gap-1 text-[11px]"
                >
                  <Phone className="w-3 h-3 text-emerald-400" /> {order.clientPhone}
                </a>
              </div>
            )}
          </div>

          {/* Customer Tracking Link Section */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 space-y-2.5">
            <span className="text-[11px] font-black uppercase text-emerald-400 tracking-wider block">
              🔗 Link Exclusivo de Rastreio do Cliente
            </span>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={trackingUrl}
                className="flex-1 px-3 py-2 bg-slate-900 text-slate-300 rounded-xl text-xs font-mono border border-slate-800 focus:outline-none"
              />

              <button
                onClick={handleCopyLink}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  copied
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                }`}
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>

              <button
                onClick={handleSendWhatsAppClient}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                title="Enviar Link de Rastreio no WhatsApp do Cliente"
              >
                <Share2 className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={handleOpenTrackingTab}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                title="Abrir Rastreio em Nova Aba"
              >
                <ExternalLink className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Abrir Aba</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
