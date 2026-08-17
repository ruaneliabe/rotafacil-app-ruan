import React, { useState } from 'react';
import { Motoboy } from '../types';
import { X, Shield } from 'lucide-react';

interface AddMotoboyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMotoboy: (motoboy: Omit<Motoboy, 'id' | 'status' | 'activeOrdersCount' | 'totalEarnedToday'>) => void;
}

export const AddMotoboyModal: React.FC<AddMotoboyModalProps> = ({
  isOpen,
  onClose,
  onAddMotoboy,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [plate, setPlate] = useState('');
  const [arranqueInput, setArranqueInput] = useState('0');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setPhone('');
    setUsername('');
    setPassword('');
    setVehicleModel('');
    setPlate('');
    setArranqueInput('0');
    setErrorText(null);
    setIsSubmitting(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    const cleanName = name.trim();
    const cleanUser = username.trim().toLowerCase().replace(/\s+/g, '');
    const cleanPass = password.trim();

    if (!cleanName) {
      setErrorText('Informe o nome do motoboy.');
      return;
    }
    if (!cleanUser || cleanUser.length < 2) {
      setErrorText('O usuário de login deve ter pelo menos 2 caracteres.');
      return;
    }
    if (!cleanPass || cleanPass.length < 3) {
      setErrorText('A senha de login deve ter pelo menos 3 caracteres.');
      return;
    }

    setIsSubmitting(true);
    const parsedArranque = parseFloat(arranqueInput.replace(',', '.')) || 0;

    try {
      onAddMotoboy({
        name: cleanName,
        phone: phone.trim(),
        username: cleanUser,
        password: cleanPass,
        vehicleModel: vehicleModel.trim(),
        plate: plate.trim().toUpperCase(),
        fixedFee: parsedArranque,
        perDeliveryFee: 0,
        currentLat: 0,
        currentLng: 0,
      });

      resetForm();
      onClose();
    } catch (err: any) {
      setErrorText('Erro ao salvar: ' + (err?.message || 'Tente novamente.'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-lg text-slate-900">Cadastrar Novo Motoboy</h3>
            <p className="text-xs text-slate-500">O cadastro não coloca o entregador na fila automaticamente.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorText && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Nome do Entregador *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Gabriel Santos" autoComplete="off" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs text-slate-900 placeholder:text-slate-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Telefone / WhatsApp</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(47) 99999-9999" autoComplete="off" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs text-slate-900 placeholder:text-slate-400" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Placa do Veículo</label>
              <input type="text" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABC-1E23" autoComplete="off" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs text-slate-900 placeholder:text-slate-400" />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Veículo</label>
            <input type="text" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="Ex: Honda CG 160" autoComplete="off" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs text-slate-900 placeholder:text-slate-400" />
          </div>

          <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-200 space-y-2">
            <div className="flex items-center gap-1.5 text-purple-900 font-extrabold text-xs">
              <Shield className="w-4 h-4 text-purple-600" />
              <span>Login do Motoboy no Celular</span>
            </div>
            <p className="text-[11px] text-purple-700 font-medium leading-tight">Entrar no aplicativo apenas autentica o motoboy. Ele só entra na fila quando iniciar o expediente.</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-purple-900 block mb-1">Usuário *</label>
                <input type="text" name="new-driver-user" autoComplete="off" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ex: ruan" className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-xs text-slate-900 placeholder:text-slate-400" />
              </div>
              <div>
                <label className="font-bold text-purple-900 block mb-1">Senha *</label>
                <input type="password" name="new-driver-secret" autoComplete="new-password" required minLength={4} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mín. 4 caracteres" className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-xs text-slate-900 placeholder:text-slate-400" />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <label className="font-bold text-slate-700 block mb-1">Valor fixo / diária (R$)</label>
            <input type="text" inputMode="decimal" value={arranqueInput} onChange={(e) => setArranqueInput(e.target.value)} placeholder="0,00" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-extrabold text-sm text-slate-900 placeholder:text-slate-400" />
            <p className="text-[10px] text-slate-400 mt-1">Deixe 0 se não houver valor fixo. O cadastro começa com R$ 0,00 ganho.</p>
          </div>

          <button type="submit" className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black rounded-xl transition-all shadow-md text-xs uppercase tracking-wide cursor-pointer flex items-center justify-center gap-2">
            <span>🛵</span><span>Salvar Motoboy</span>
          </button>
        </form>
      </div>
    </div>
  );
};
