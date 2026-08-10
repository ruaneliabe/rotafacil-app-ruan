import React from 'react';
import { Order, StoreShift, Motoboy } from '../types';
import { Printer, Share2, X, ExternalLink, CheckCircle2, DollarSign, MapPin, Bike, User } from 'lucide-react';


const logoImg = '/hope-burger-logo.jpg';

interface ThermalTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  shift: StoreShift;
  motoboy?: Motoboy | null;
}

export const ThermalTicketModal: React.FC<ThermalTicketModalProps> = ({
  isOpen,
  onClose,
  order,
  shift,
  motoboy,
}) => {
  if (!isOpen || !order) return null;

  const trackingUrl = `${window.location.origin}/?rastreio=${order.trackingCode || order.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(trackingUrl);
    alert('Link de rastreio exclusivo do cliente copiado para a área de transferência! 🔗');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Comanda #${order.codeNumber} - Rota Fácil Delivery</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 280px;
              margin: 0 auto;
              padding: 10px;
              font-size: 12px;
              color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #000; margin: 8px 0; }
            .flex { display: flex; justify-content: space-between; }
            .title { font-size: 16px; font-weight: bold; }
            .big-code { font-size: 22px; font-weight: bold; margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="title">${(shift.storeName || 'ROTA FÁCIL DELIVERY').toUpperCase()}</div>
            <div>${shift.storeAddress || 'Lanchonete & Delivery'}</div>
            <div>${shift.storePhone ? `Fone / WhatsApp: ${shift.storePhone}` : 'WhatsApp / Pedidos'}</div>
            <div class="line"></div>
            <div class="big-code">PEDIDO #${order.codeNumber}</div>
            <div>CANAL: <span class="bold">${(order.originChannel || 'WHATSAPP').toUpperCase()}</span></div>
            <div>Data/Hora: ${order.createdAt}</div>
          </div>

          <div class="line"></div>
          <div><span class="bold">CLIENTE:</span> ${order.clientName}</div>
          <div><span class="bold">FONE:</span> ${order.clientPhone}</div>
          <div><span class="bold">ENDEREÇO:</span> ${order.address}</div>
          <div><span class="bold">BAIRRO:</span> ${order.neighborhood}</div>

          <div class="line"></div>
          <div class="bold">ITENS DO PEDIDO:</div>
          <div style="margin-top: 4px;">${order.itemsSummary}</div>

          <div class="line"></div>
          <div class="flex"><span>Subtotal:</span> <span>R$ ${order.subtotal.toFixed(2)}</span></div>
          <div class="flex"><span>Taxa de Entrega:</span> <span>R$ ${order.deliveryFee.toFixed(2)}</span></div>
          <div class="flex bold" style="font-size: 14px; margin-top: 4px;">
            <span>TOTAL:</span> <span>R$ ${order.total.toFixed(2)}</span>
          </div>
          <div class="flex">
            <span>Forma Pagto:</span>
            <span class="bold">${order.paymentMethod.toUpperCase()}</span>
          </div>
          ${
            order.changeFor
              ? `<div class="flex"><span>Troco para:</span> <span>R$ ${order.changeFor.toFixed(2)}</span></div>`
              : ''
          }

          <div class="line"></div>
          <div><span class="bold">MOTOBOY / ENTREGADOR:</span> ${motoboy ? motoboy.name : order.assignedMotoboyName || 'A definir'}</div>
          <div><span class="bold">CÓD. RASTREIO:</span> ${order.trackingCode || 'RF-ONLINE'}</div>

          <div class="line"></div>
          <div class="center" style="font-size: 10px; margin-top: 10px;">
            Acompanhe seu pedido em tempo real!<br/>
            Obrigado pela preferência! 🛵
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleSendWhatsAppClient = () => {
    const cleanPhone = order.clientPhone.replace(/\D/g, '');
    const msg = `Olá *${order.clientName}*! 🛵 Seu pedido *#${order.codeNumber}* do *${shift.storeName || 'Rota Fácil Delivery'}* foi preparado com carinho e está a caminho!\n\n🛵 *Entregador:* ${motoboy ? motoboy.name : order.assignedMotoboyName || 'Entregador'}\n📍 *Endereço:* ${order.address}\n💰 *Total:* R$ ${order.total.toFixed(2)} (${order.paymentMethod})\n\n🔗 *Acompanhe no mapa em tempo real:* ${trackingUrl}`;

    const url = cleanPhone
      ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-purple-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 text-slate-100 rounded-3xl max-w-md w-full shadow-2xl border-2 border-pink-500/50 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-purple-900 to-pink-900 border-b border-purple-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-yellow-400" />
            <h3 className="font-black text-white text-base">Comanda Térmica de Entrega</h3>
          </div>
          <button onClick={onClose} className="p-1 text-purple-300 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thermal Receipt Preview Box */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div className="bg-amber-50 text-slate-900 p-5 rounded-2xl shadow-inner font-mono text-xs border border-amber-200/80 space-y-3">
            {/* Store Banner */}
            <div className="text-center border-b border-dashed border-slate-400 pb-3 space-y-1">
              <img
                src={logoImg}
                alt="Hope Logo"
                className="w-12 h-12 rounded-xl mx-auto border border-amber-400 shadow-xs"
              />
              <div className="font-extrabold text-sm uppercase">{shift.storeName || 'ROTA FÁCIL DELIVERY'}</div>
              <div className="text-[10px] text-slate-600">{shift.storeAddress || 'Lanchonete & Delivery'}</div>
              <div className="font-bold text-lg text-purple-950 mt-1">PEDIDO #{order.codeNumber}</div>
              <div className="text-[10px] text-slate-500">Horário: {order.createdAt}</div>
            </div>

            {/* Client Info */}
            <div className="space-y-1 border-b border-dashed border-slate-400 pb-3 text-[11px]">
              <div><strong className="text-purple-900">CLIENTE:</strong> {order.clientName}</div>
              <div><strong className="text-purple-900">FONE:</strong> {order.clientPhone}</div>
              <div><strong className="text-purple-900">ENDEREÇO:</strong> {order.address}</div>
              <div><strong className="text-purple-900">BAIRRO:</strong> {order.neighborhood}</div>
            </div>

            {/* Items */}
            <div className="space-y-1 border-b border-dashed border-slate-400 pb-3">
              <strong className="text-purple-900 block text-[11px]">ITENS DO PEDIDO:</strong>
              <div className="text-slate-800 text-[11px] whitespace-pre-wrap">{order.itemsSummary}</div>
            </div>

            {/* Financial Totals */}
            <div className="space-y-1 border-b border-dashed border-slate-400 pb-3 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>R$ {order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxa Entrega:</span>
                <span>R$ {order.deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-purple-950 pt-1">
                <span>TOTAL A PAGAR:</span>
                <span>R$ {order.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-purple-900">
                <span>Forma de Pagamento:</span>
                <span>{order.paymentMethod.toUpperCase()}</span>
              </div>
              {order.changeFor ? (
                <div className="flex justify-between text-pink-700 font-bold">
                  <span>Levar troco para:</span>
                  <span>R$ {order.changeFor.toFixed(2)}</span>
                </div>
              ) : null}
            </div>

            {/* Motoboy & Tracking */}
            <div className="text-[10px] text-slate-700 space-y-0.5">
              <div><strong>ENTREGADOR:</strong> {motoboy ? motoboy.name : order.assignedMotoboyName || 'A definir'}</div>
              <div><strong>CÓD. RASTREIO:</strong> {order.trackingCode || 'HOPE-ONLINE'}</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-950 border-t border-purple-800/60 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
            title="Copiar link de rastreio para o cliente"
          >
            <ExternalLink className="w-4 h-4 text-amber-400" /> Copiar Link Rastreio
          </button>

          <button
            type="button"
            onClick={handleSendWhatsAppClient}
            className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-4 h-4" /> Enviar Whats ao Cliente
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 bg-gradient-to-r from-pink-500 to-yellow-500 hover:opacity-95 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
          >
            <Printer className="w-4 h-4" /> Imprimir Comanda (80mm)
          </button>
        </div>
      </div>
    </div>
  );
};
