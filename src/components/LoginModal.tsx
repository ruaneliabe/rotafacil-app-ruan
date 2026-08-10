import React, { useState } from 'react';
import { UserSession, Motoboy, StoreShift } from '../types';
import { Store, Bike, Lock, User, AlertCircle, LogIn } from 'lucide-react';

interface LoginModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onLoginSuccess: (session: UserSession) => void;
  motoboys: Motoboy[];
  shift?: StoreShift;
  logoUrl?: string;
  isStandalonePage?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen = true,
  onClose,
  onLoginSuccess,
  motoboys,
  shift,
  isStandalonePage = false,
}) => {
  const [activeRole, setActiveRole] = useState<'store_admin' | 'motoboy'>('store_admin');

  // Never prefill credentials. Each login starts blank.
  const [storeUser, setStoreUser] = useState('');
  const [storePass, setStorePass] = useState('');
  const [motoboyUser, setMotoboyUser] = useState('');
  const [motoboyPass, setMotoboyPass] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen && !isStandalonePage) return null;

  const handleStoreLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const expectedPassword = shift?.adminPassword || 'hope2026';
    const isUserValid = storeUser.trim().toLowerCase() === 'admin';
    const isPassValid = storePass === expectedPassword;

    if (isUserValid && isPassValid) {
      onLoginSuccess({
        role: 'store_admin',
        storeName: shift?.storeName || 'Hope Burger',
        username: storeUser,
      });
      if (onClose) onClose();
    } else {
      setErrorMsg('Usuário ou senha incorretos!');
    }
  };

  const handleMotoboyLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const term = motoboyUser.trim().toLowerCase();
    const targetMotoboy = motoboys.find(
      (m) =>
        (m.username && m.username.trim().toLowerCase() === term) ||
        m.name.trim().toLowerCase() === term ||
        m.id.trim().toLowerCase() === term
    );

    if (!targetMotoboy) {
      setErrorMsg('Usuário de motoboy não encontrado. Confira o login cadastrado pela loja.');
      return;
    }

    if (!targetMotoboy.password || targetMotoboy.password !== motoboyPass) {
      setErrorMsg('Senha incorreta para este entregador.');
      return;
    }

    onLoginSuccess({
      role: 'motoboy',
      motoboyId: targetMotoboy.id,
      motoboyName: targetMotoboy.name,
      username: targetMotoboy.username || motoboyUser,
    });
    if (onClose) onClose();
  };

  const outerClasses = isStandalonePage
    ? 'min-h-screen bg-slate-100 text-slate-900 flex flex-col items-center justify-center p-4'
    : 'fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4';

  return (
    <div className={outerClasses}>
      <div className="bg-white text-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5">
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-3xl font-black mx-auto shadow-md">🛵</div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{shift?.storeName || 'Hope Burger'}</h2>
            <p className="text-xs font-extrabold text-slate-600 tracking-wide uppercase">Sistema de Entregas & Balcão</p>
          </div>
          <p className="text-xs text-slate-500 font-medium pt-1">Tudo o que sua operação precisa em um único sistema.</p>
        </div>

        <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex text-xs font-semibold">
          <button type="button" onClick={() => { setActiveRole('store_admin'); setErrorMsg(null); setStoreUser(''); setStorePass(''); }} className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeRole === 'store_admin' ? 'bg-slate-900 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}>
            <Store className="w-4 h-4" /> Loja (Admin)
          </button>
          <button type="button" onClick={() => { setActiveRole('motoboy'); setErrorMsg(null); setMotoboyUser(''); setMotoboyPass(''); }} className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeRole === 'motoboy' ? 'bg-slate-900 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}>
            <Bike className="w-4 h-4" /> Motoboy
          </button>
        </div>

        {errorMsg && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-600 shrink-0" /><span>{errorMsg}</span></div>}

        {activeRole === 'store_admin' && (
          <form onSubmit={handleStoreLogin} autoComplete="off" className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Usuário da Loja</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input type="text" name="store-login-user" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={storeUser} onChange={(e) => setStoreUser(e.target.value)} placeholder="Digite seu usuário" className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Senha da Loja</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input type="password" name="store-login-secret" autoComplete="new-password" required value={storePass} onChange={(e) => setStorePass(e.target.value)} placeholder="Digite sua senha" className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium" />
              </div>
            </div>
            <button type="submit" className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 text-xs uppercase cursor-pointer"><LogIn className="w-4 h-4" /> Entrar no Painel da Loja</button>
          </form>
        )}

        {activeRole === 'motoboy' && (
          <form onSubmit={handleMotoboyLogin} autoComplete="off" className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Usuário do Motoboy</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input type="text" name="driver-login-user" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={motoboyUser} onChange={(e) => setMotoboyUser(e.target.value)} placeholder="Digite seu usuário" className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Senha do Motoboy</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input type="password" name="driver-login-secret" autoComplete="new-password" required value={motoboyPass} onChange={(e) => setMotoboyPass(e.target.value)} placeholder="Digite sua senha" className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium" />
              </div>
            </div>
            <button type="submit" className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 text-xs uppercase cursor-pointer"><LogIn className="w-4 h-4" /> Entrar no Celular do Entregador</button>
          </form>
        )}

        {onClose && <div className="pt-2 text-center"><button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-700 underline font-medium">Continuar como visitante / Rastreio do Cliente</button></div>}
      </div>
    </div>
  );
};
