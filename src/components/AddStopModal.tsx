import React, { useState } from 'react';
import { Stop, PriorityLevel, LocationPoint } from '../types';
import { geocodeAddress } from '../utils/geoUtils';
import { X, MapPin, Search, Loader2, User, Phone, DollarSign, FileText } from 'lucide-react';

interface AddStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStop: (stop: Omit<Stop, 'id' | 'orderIndex' | 'status'>) => void;
  isOriginMode?: boolean;
  onUpdateOrigin?: (point: LocationPoint) => void;
  currentOrigin?: LocationPoint;
}

export const AddStopModal: React.FC<AddStopModalProps> = ({
  isOpen,
  onClose,
  onAddStop,
  isOriginMode = false,
  onUpdateOrigin,
  currentOrigin,
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState(isOriginMode ? currentOrigin?.name || 'Depósito Central' : '');
  const [address, setAddress] = useState(isOriginMode ? currentOrigin?.address || '' : '');
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [valueToReceive, setValueToReceive] = useState<string>('18.00');
  const [notes, setNotes] = useState('');
  const [deliveryWindow, setDeliveryWindow] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      setErrorMsg('Por favor, digite um endereço ou CEP válido.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const geoResult = await geocodeAddress(address);
      if (!geoResult) {
        setErrorMsg('Endereço não encontrado. Tente incluir número, bairro e cidade.');
        setIsLoading(false);
        return;
      }

      if (isOriginMode && onUpdateOrigin) {
        onUpdateOrigin({
          name: title || 'Ponto de Partida',
          address: geoResult.address,
          lat: geoResult.lat,
          lng: geoResult.lng,
          cep: geoResult.cep,
        });
      } else {
        onAddStop({
          title: title || recipientName || 'Entrega',
          recipientName: recipientName.trim(),
          phone: phone.trim(),
          address: geoResult.address,
          cep: geoResult.cep,
          lat: geoResult.lat,
          lng: geoResult.lng,
          priority,
          valueToReceive: parseFloat(valueToReceive) || 0,
          notes: notes.trim(),
          deliveryWindow: deliveryWindow.trim(),
        });
      }

      setIsLoading(false);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao buscar coordenadas. Tente novamente.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <MapPin className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base">
              {isOriginMode ? 'Alterar Ponto de Partida (Depósito)' : 'Adicionar Nova Entrega'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isOriginMode ? 'Nome do Local' : 'Identificação da Parada'}
            </label>
            <input
              type="text"
              placeholder={isOriginMode ? 'Ex: Galpão Mooca' : 'Ex: Farmácia Central'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Endereço Completo ou CEP *
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Ex: 01310-100 ou Av. Paulista 1000, São Paulo - SP"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Suporta busca direta por CEP (ex: 01310-100) ou endereço de rua.
            </span>
          </div>

          {!isOriginMode && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Cliente</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Ex: João da Silva"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="(11) 99999-8888"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Prioridade</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                    className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high font-bold">Urgente 🔴</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Valor a Receber (R$)</label>
                  <input
                    type="number"
                    step="0.50"
                    placeholder="18.00"
                    value={valueToReceive}
                    onChange={(e) => setValueToReceive(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Janela de Horário</label>
                  <input
                    type="text"
                    placeholder="14:00 - 16:00"
                    value={deliveryWindow}
                    onChange={(e) => setDeliveryWindow(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Observações de Entrega</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Deixar com a portaria, bloco B apto 42."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Buscando Endereço...
                </>
              ) : isOriginMode ? (
                'Salvar Origem'
              ) : (
                'Adicionar Parada'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
