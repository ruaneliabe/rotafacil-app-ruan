import React, { useState, useEffect } from 'react';
import { StoreShift } from '../types';
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
} from 'lucide-react';

interface StoreAccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: StoreShift;
  onSaveSettings: (updatedShift: StoreShift) => void;
}

export const StoreAccountSettingsModal: React.FC<StoreAccountSettingsModalProps> = ({
  isOpen,
  onClose,
  shift,
  onSaveSettings,
}) => {
  const [storeName, setStoreName] = useState(shift.storeName || '');
  const [storePhone, setStorePhone] = useState(shift.storePhone || '');
  const [storeAddress, setStoreAddress] = useState(shift.storeAddress || '');
  const [storeLat, setStoreLat] = useState<number>(shift.storeLat || -26.9388);
  const [storeLng, setStoreLng] = useState<number>(shift.storeLng || -49.1082);
  const [adminPassword, setAdminPassword] = useState(shift.adminPassword || '123');

  const [showPassword, setShowPassword] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStoreName(shift.storeName || '');
      setStorePhone(shift.storePhone || '');
      setStoreAddress(shift.storeAddress || '');
      setStoreLat(shift.storeLat || -26.9388);
      setStoreLng(shift.storeLng || -49.1082);
      setAdminPassword(shift.adminPassword || '123');
      setIsSaved(false);
    }
  }, [isOpen, shift]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;

    const updated: StoreShift = {
      ...shift,
      storeName: storeName.trim(),
      storePhone: storePhone.trim(),
      storeAddress: storeAddress.trim(),
      storeLat: Number(storeLat) || -26.9388,
      storeLng: Number(storeLng) || -49.1082,
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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 text-slate-100 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-800 overflow-hidden my-8">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shadow-xs">
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
            <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-2xl flex items-center gap-3 text-xs font-bold animate-fadeIn">
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
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ex: Hope Burger"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Aparece no cabeçalho do painel, comandas impressas, mensagens e tela de rastreio dos clientes.
            </p>
          </div>

          {/* Telefone / WhatsApp */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              Telefone / WhatsApp Comercial
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                placeholder="Ex: (47) 99887-6655"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Endereço Padrão da Loja */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              Endereço Completo (Ponto de Origem)
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                placeholder="Ex: R. dos Caçadores, 653 - Velha Central, Blumenau - SC"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Endereço onde a loja está localizada para cálculo de rotas e partidas.
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
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
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
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Senha de Administrador da Loja */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Senha de Acesso (Admin)
              </label>
              <span className="text-[10px] text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded">
                Login Padrão: admin
              </span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Informe a nova senha de acesso da loja"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Esta senha será exigida no login do perfil Loja (Admin).
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
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
