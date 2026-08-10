import React, { useState } from 'react';
import { Motoboy } from '../types';
import { X, Bike, Phone, DollarSign, User, Shield } from 'lucide-react';

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
  const [vehicleModel, setVehicleModel] = useState('Honda Titan 160');
  const [plate, setPlate] = useState('');
  const [arranqueInput, setArranqueInput] = useState('60.00');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const generatedUsername = username.trim() || name.trim().toLowerCase().split(' ')[0];
    const generatedPassword = password.trim() || '123';
    const parsedArranque = parseFloat(arranqueInput.replace(',', '.')) || 0;

    onAddMotoboy({
      name,
      phone: phone || '(41) 99999-0000',
      username: generatedUsername,
      password: generatedPassword,
      vehicleModel,
      plate: plate || 'ABC-1234',
      fixedFee: parsedArranque,
      perDeliveryFee: 0,
      currentLat: -25.432,
      currentLng: -49.272,
    });

    setName('');
    setPhone('');
    setUsername('');
    setPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-lg text-slate-900">Cadastrar Novo Motoboy</h3>
            <p className="text-xs text-slate-500">Adicione um entregador à equipe da loja</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Nome do Entregador *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Gabriel Santos"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Telefone / WhatsApp</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(41) 98888-7777"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Placa do Veículo</label>
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="ABC-1E23"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Login credentials section created by store */}
          <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-200 space-y-2">
            <div className="flex items-center gap-1.5 text-purple-900 font-extrabold text-xs">
              <Shield className="w-4 h-4 text-purple-600" />
              <span>Login do Motoboy no Celular</span>
            </div>
            <p className="text-[11px] text-purple-700 font-medium leading-tight">
              A loja define o usuário e a senha para o motoboy acessar o aplicativo no celular dele.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-purple-900 block mb-1">Usuário *</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: ruan"
                  className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-xs text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="font-bold text-purple-900 block mb-1">Senha *</label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ex: 123"
                  className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-xs font-mono text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Arranque Inicial (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={arranqueInput}
                onChange={(e) => setArranqueInput(e.target.value)}
                placeholder="Ex: 40.00"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-extrabold text-sm text-slate-900 placeholder:text-slate-400"
              />
              <p className="text-[10px] text-slate-400 mt-1">Valor fixo inicial a receber no acerto diário.</p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black rounded-xl transition-all shadow-md text-xs uppercase tracking-wide cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🛵</span>
              <span>Salvar & Cadastrar Motoboy</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
