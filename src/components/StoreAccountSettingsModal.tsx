import React, { useState, useEffect } from 'react';
import { StoreShift } from '../types';
import { geocodeAddress } from '../utils/geoUtils';
import {
  Building2,
  Phone,
  MapPin,
  Lock,
  X,
  Save,
  CheckCircle2,
  Eye,
  EyeOff,
  Navigation,
  ShieldCheck,
  Sparkles,
  Search,
} from 'lucide-react';

interface StoreAccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: StoreShift;
  onSaveSettings: (updatedShift: StoreShift) => void;
  onClearAllData?: () => void;
}

export const StoreAccountSettingsModal: React.FC<StoreAccountSettingsModalProps> = ({
  isOpen,
  onClose,
  shift,
  onSaveSettings,
  onClearAllData,
}) => {
  const [storeName, setStoreName] = useState(shift.storeName || '');
  const [storePhone, setStorePhone] = useState(shift.storePhone || '');
  const [storeAddress, setStoreAddress] = useState(shift.storeAddress || '');
  const [storeLat, setStoreLat] = useState<number>(shift.storeLat || -26.9153287);
  const [storeLng, setStoreLng] = useState<number>(shift.storeLng || -49.1223501);
  const [adminPassword, setAdminPassword] = useState(shift.adminPassword || '123');

  const [showPassword, setShowPassword] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeSuccess, setGeocodeSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStoreName(shift.storeName || '');
      setStorePhone(shift.storePhone || '');
      setStoreAddress(shift.storeAddress || '');
      setStoreLat(shift.storeLat || -26.9153287);
      setStoreLng(shift.storeLng || -49.1223501);
      setAdminPassword(shift.adminPassword || '123');
      setIsSaved(false);
      setGeocodeSuccess(false);
    }
  }, [isOpen, shift]);

  if (!isOpen) return null;

  const handleGeocodeStore = async () => {
    if (!storeAddress.trim() || isGeocoding) return;
    setIsGeocoding(true);
    setGeocodeSuccess(false);
    try {
      const result = await geocodeAddress(storeAddress);
      if (result && typeof result.lat === 'number' && typeof result.lng === 'number') {
        setStoreLat(result.lat);
        setStoreLng(result.lng);
        setGeocodeSuccess(true);
      }
    } catch (err) {
      console.warn('Geocoding error:', err);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;

    let finalLat = Number(storeLat) || -26.9153287;
    let finalLng = Number(storeLng) || -49.1223501;

    // If storeAddress was provided and coordinates haven't been geocoded yet, try geocoding
    if (storeAddress.trim() && (!storeLat || storeLat === -26.9388)) {
      try {
        const geoRes = await geocodeAddress(storeAddress);
        if (geoRes && typeof geoRes.lat === 'number' && typeof geoRes.lng === 'number') {
          finalLat = geoRes.lat;
          finalLng = geoRes.lng;
          setStoreLat(finalLat);
          setStoreLng(finalLng);
        }
      } catch (err) {
        console.warn('Auto geocode fallback:', err);
      }
    }

    const updated: StoreShift = {
      ...shift,
      storeName: storeName.trim(),
      storePhone: storePhone.trim(),
      storeAddress: storeAddress.trim(),
      storeLat: finalLat,
      storeLng: finalLng,
      adminPassword: adminPassword.trim() || '123',
    };

    onSaveSettings(updated);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-800 text-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-700 overflow-hidden my-8">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-800 text-white border border-slate-700 flex items-center justify-center font-bold shadow-2xs">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base tracking-tight flex items-center gap-2">
                Configurações da Conta & Loja
              </h3>
              <p className="text-xs text-slate-400">
                Personalize os dados da sua empresa, endereço e senha
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Saved Toast Alert */}
          {isSaved && (
            <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 p-3.5 rounded-2xl flex items-center gap-3 text-xs font-bold animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Dados da loja e acesso atualizados com sucesso! Todo o sistema se adaptou automaticamente.</span>
            </div>
          )}

          {/* Nome da Loja */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              Nome da Loja / Estabelecimento
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ex: Hope Burger"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Aparece no cabeçalho do painel, comandas impressas, mensagens e tela de rastreio dos clientes.
            </p>
          </div>

          {/* Telefone / WhatsApp */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              Telefone / WhatsApp Comercial
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                placeholder="Ex: (47) 99887-6655"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Endereço Padrão da Loja */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                Endereço Completo da Loja
              </label>
              <button
                type="button"
                onClick={handleGeocodeStore}
                disabled={isGeocoding || !storeAddress.trim()}
                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 active:scale-95 text-emerald-400 font-bold text-[10px] rounded-lg border border-slate-600 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Search className="w-3 h-3" />
                <span>{isGeocoding ? 'Localizando...' : 'Localizar no Mapa'}</span>
              </button>
            </div>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                placeholder="Ex: Rua dos Caçadores, 653, Blumenau - SC"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Endereço central da loja para calcular partidas e centralizar no mapa.
            </p>
          </div>

          {/* Latitude & Longitude */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-400">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={storeLat}
                onChange={(e) => setStoreLat(parseFloat(e.target.value) || -26.9388)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-400">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={storeLng}
                onChange={(e) => setStoreLng(parseFloat(e.target.value) || -49.1082)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Senha de Administrador da Loja */}
          <div className="space-y-1.5 pt-2 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Senha de Acesso (Admin)
              </label>
              <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                Login Padrão: admin
              </span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Informe a nova senha de acesso da loja"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Esta senha será exigida no login do perfil Loja (Admin).
            </p>
          </div>

          {/* Danger Zone: Clear Data */}
          {onClearAllData && (
            <div className="pt-3 border-t border-slate-700">
              <div className="bg-rose-950/40 border border-rose-800/60 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <span className="font-extrabold text-xs text-rose-300 block">🧹 Zerar Todo o Banco de Dados</span>
                  <span className="text-[11px] text-slate-400">Apaga todos os pedidos e motoboys salvos para começar do zero.</span>
                </div>
                <button
                  type="button"
                  onClick={onClearAllData}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all shrink-0 cursor-pointer"
                >
                  Limpar Dados (Reset 100%)
                </button>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-700 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Salvar Alterações
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
