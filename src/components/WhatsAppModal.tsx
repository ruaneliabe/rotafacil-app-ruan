import React, { useState } from 'react';
import { LocationPoint, Stop, RouteSummary } from '../types';
import { generateWhatsAppMessage } from '../utils/geoUtils';
import { X, Share2, Copy, Check, ExternalLink } from 'lucide-react';

interface WhatsAppModalProps {
  isOpen: boolean;
  origin: LocationPoint;
  stops: Stop[];
  summary: RouteSummary;
  onClose: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  origin,
  stops,
  summary,
  onClose,
}) => {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  const messageText = generateWhatsAppMessage(origin, stops, summary);

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    const encoded = encodeURIComponent(messageText);
    const targetUrl = cleanedPhone
      ? `https://wa.me/55${cleanedPhone}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(targetUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-emerald-200" />
            <h3 className="font-bold text-base">Enviar Rota via WhatsApp</h3>
          </div>
          <button onClick={onClose} className="p-1 text-emerald-200 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Telefone do Entregador (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: 11999998888 (com DDD)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Prévia da Mensagem</label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado!' : 'Copiar Texto'}
              </button>
            </div>
            <pre className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
              {messageText}
            </pre>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              Fechar
            </button>
            <button
              onClick={handleSendWhatsApp}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-600/30 flex items-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir no WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
