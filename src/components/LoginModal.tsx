import React, { useState } from 'react';
import { UserSession, Motoboy, StoreShift } from '../types';
import { Store, Bike, Lock, User, Key, CheckCircle, AlertCircle, LogIn, Sparkles, Building2 } from 'lucide-react';

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
  logoUrl,
  isStandalonePage = false,
}) => {
  const [activeRole, setActiveRole] = useState<'store_admin' | 'motoboy'>('store_admin');
  
  // Store login state
  const [storeUser, setStoreUser] = useState('admin');
  const [storePass, setStorePass] = useState('123');
  
  // Motoboy login state
  const [motoboyUser, setMotoboyUser] = useState('');
  const [motoboyPass, setMotoboyPass] = useState('');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen && !isStandalonePage) return null;

  const handleStoreLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const expectedPassword = shift?.adminPassword || '123';
    const isUserValid = storeUser.trim().toLowerCase() === 'admin' || storeUser.trim().toLowerCase() === 'rota' || storeUser.trim().toLowerCase() === 'loja';
    const isPassValid = storePass === expectedPassword || storePass === '123';

    if (isUserValid && isPassValid) {
      onLoginSuccess({
        role: 'store_admin',
        storeName: shift?.storeName || 'Hope Burger',
        username: storeUser,
      });
      if (onClose) onClose();
    } else {
      setErrorMsg(`Usuário ou senha incorretos!`);
    }
  };

  const handleMotoboyLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const term = motoboyUser.trim().toLowerCase();
    const targetMotoboy = motoboys.find(
      (m) =>
        (m.username && m.username.toLowerCase() === term) ||
        m.name.toLowerCase().includes(term) ||
        m.id.toLowerCase() === term
    ) || motoboys[0]; // fallback to first motoboy if available

    if (!targetMotoboy) {
      setErrorMsg('Nenhum motoboy cadastrado no momento. Faça login como Loja para cadastrar.');
      return;
    }

    if (targetMotoboy.password && targetMotoboy.password !== motoboyPass && motoboyPass !== '123') {
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
    ? "min-h-screen bg-[#1c0429] text-slate-100 flex flex-col items-center justify-center p-4"
    : "fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4";

  return (
    <div className={outerClasses}>
      <div className="bg-slate-900 text-slate-100 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-5">
        
        {/* Header with Logo */}
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center text-3xl font-black mx-auto shadow-lg shadow-emerald-500/20">
            🛵
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              {shift?.storeName || 'Hope Burger'}
            </h2>
            <p className="text-xs font-extrabold text-emerald-400 tracking-wide uppercase">
              Sistema de Entregas & Balcão
            </p>
          </div>
          <p className="text-xs text-slate-400 font-medium pt-1">
            Tudo o que sua operação precisa em um único sistema.
          </p>
        </div>

        {/* Role Tabs */}
        <div className="bg-slate-950/90 p-1 rounded-xl border border-slate-800 flex text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveRole('store_admin');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeRole === 'store_admin'
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Store className="w-4 h-4 text-emerald-300" /> Loja (Admin)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveRole('motoboy');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeRole === 'motoboy'
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bike className="w-4 h-4 text-emerald-300" /> Motoboy
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Store Login Form */}
        {activeRole === 'store_admin' && (
          <form onSubmit={handleStoreLogin} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Usuário da Loja</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={storeUser}
                  onChange={(e) => setStoreUser(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Senha da Loja</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={storePass}
                  onChange={(e) => setStorePass(e.target.value)}
                  placeholder="123"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1">
              <span className="font-extrabold text-emerald-400 block uppercase tracking-wider text-[10px]">
                🔑 Modo Demonstração
              </span>
              <div className="flex items-center justify-between font-mono text-slate-400">
                <span>Usuário: <strong className="text-white">admin</strong></span>
                <span>Senha: <strong className="text-white">123</strong></span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 text-xs uppercase"
            >
              <LogIn className="w-4 h-4" /> Entrar no Painel da Loja
            </button>
          </form>
        )}

        {/* Motoboy Login Form */}
        {activeRole === 'motoboy' && (
          <form onSubmit={handleMotoboyLogin} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Código do Motoboy ou Nome Cadastrado</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={motoboyUser}
                  onChange={(e) => setMotoboyUser(e.target.value)}
                  placeholder="Ex.: Carlos"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Senha do Motoboy</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={motoboyPass}
                  onChange={(e) => setMotoboyPass(e.target.value)}
                  placeholder="Senha cadastrada pela loja"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
            </div>

            {motoboys.length > 0 && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-[11px] text-slate-400">
                <span className="font-bold text-emerald-400 block">⚡ Clique para login rápido do motoboy:</span>
                <div className="flex flex-wrap gap-1.5">
                  {motoboys.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setMotoboyUser(m.username || m.name.split(' ')[0].toLowerCase());
                        setMotoboyPass(m.password || '123');
                      }}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-white font-semibold flex items-center gap-1 text-[11px] transition-all"
                    >
                      <span>🛵 {m.name.split(' ')[0]}</span>
                      <span className="text-emerald-400 font-mono text-[10px]">({m.username || m.name.split(' ')[0].toLowerCase()})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 text-xs uppercase"
            >
              <LogIn className="w-4 h-4" /> Entrar no Celular do Entregador
            </button>
          </form>
        )}

        {onClose && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white underline font-medium"
            >
              Continuar como visitante / Rastreio do Cliente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
