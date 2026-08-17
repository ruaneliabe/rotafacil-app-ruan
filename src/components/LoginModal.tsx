import React, { useState } from 'react';
import { UserSession, Motoboy, StoreShift, StoreAccount } from '../types';
import {
  Store,
  Bike,
  Lock,
  User,
  AlertCircle,
  LogIn,
  Sparkles,
  Crown,
  Building2,
  Phone,
  MapPin,
  CheckCircle2,
  Search,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { geocodeAddress } from '../utils/geoUtils';
import { saveStoreAccountToCloud, getStoreAccountFromCloud } from '../lib/firebase';

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
  const [activeTab, setActiveTab] = useState<'store_login' | 'store_signup' | 'motoboy' | 'master'>('store_login');

  // Store Login State
  const [storeUser, setStoreUser] = useState('');
  const [storePass, setStorePass] = useState('');

  // Store Signup State (O cliente cria o usuário e senha dele)
  const [signupStoreName, setSignupStoreName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupAddress, setSignupAddress] = useState('');
  const [signupUser, setSignupUser] = useState('');
  const [signupPass, setSignupPass] = useState('');
  const [signupPassConfirm, setSignupPassConfirm] = useState('');
  const [signupLat, setSignupLat] = useState<number>(-26.9194);
  const [signupLng, setSignupLng] = useState<number>(-49.0661);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSubmittingSignup, setIsSubmittingSignup] = useState(false);

  // Motoboy Login State
  const [motoboyUser, setMotoboyUser] = useState('');
  const [motoboyPass, setMotoboyPass] = useState('');

  // Master Login State (Ruan / Dono da Plataforma)
  const [masterUser, setMasterUser] = useState('');
  const [masterPass, setMasterPass] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen && !isStandalonePage) return null;

  // 1. Cliente fazendo login na loja dele
  const handleStoreLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const inputUser = storeUser.trim().toLowerCase();
    const inputPass = storePass;

    if (!inputUser || !inputPass) {
      setErrorMsg('Informe o usuário e a senha da sua loja.');
      return;
    }

    // Check shift config first
    const shiftStoreUser = (shift?.storeUsername || '').trim().toLowerCase();
    const shiftAdminPass = shift?.adminPassword || '';

    // If matches current shift credentials
    if (shiftStoreUser && shiftStoreUser === inputUser && shiftAdminPass === inputPass) {
      onLoginSuccess({
        role: 'store_admin',
        storeName: shift?.storeName || 'Minha Loja',
        username: inputUser,
      });
      if (onClose) onClose();
      return;
    }

    // Check Firestore stores collection
    try {
      const cloudAccount = await getStoreAccountFromCloud(inputUser);
      if (cloudAccount && cloudAccount.password === inputPass) {
        onLoginSuccess({
          role: 'store_admin',
          storeName: cloudAccount.storeName,
          username: cloudAccount.username,
        });
        if (onClose) onClose();
        return;
      }
    } catch (err) {
      console.warn('Erro ao autenticar loja no Firestore:', err);
    }

    // Fallback: Check if master or admin matches
    if (inputUser === (shift?.masterUsername || 'ruan') && inputPass === (shift?.masterPassword || 'ruan123')) {
      onLoginSuccess({
        role: 'master_admin',
        storeName: shift?.storeName || 'Rota Fácil Master',
        username: inputUser,
        isMaster: true,
      });
      if (onClose) onClose();
      return;
    }

    // If default unconfigured store is still active and user is admin/admin123
    if (shift?.setupRequired && inputUser === 'admin' && inputPass === (shift.adminPassword || 'admin123')) {
      onLoginSuccess({
        role: 'store_admin',
        storeName: shift?.storeName || 'Configure sua loja',
        username: inputUser,
      });
      if (onClose) onClose();
      return;
    }

    setErrorMsg('Usuário ou senha da loja incorretos. Se ainda não tem cadastro, clique em "Cadastrar Loja".');
  };

  // 2. Cliente criando o usuário e senha da loja dele
  const handleGeocodeSignupAddress = async () => {
    if (!signupAddress.trim()) return;
    setIsGeocoding(true);
    setErrorMsg(null);
    try {
      const geo = await geocodeAddress(signupAddress.trim());
      if (geo && typeof geo.lat === 'number' && typeof geo.lng === 'number') {
        setSignupLat(Number(geo.lat.toFixed(6)));
        setSignupLng(Number(geo.lng.toFixed(6)));
        setSuccessMsg(`📍 Localização encontrada no mapa: ${geo.name || geo.address}`);
      } else {
        setErrorMsg('Endereço não localizado automaticamente no mapa. Você pode prosseguir e ajustar nas configurações.');
      }
    } catch {
      setErrorMsg('Não foi possível geolocalizar agora. Você pode salvar e ajustar depois.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleStoreSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const storeName = signupStoreName.trim();
    const phone = signupPhone.trim();
    const address = signupAddress.trim();
    const username = signupUser.trim().toLowerCase().replace(/\s+/g, '');
    const password = signupPass;

    if (!storeName) {
      setErrorMsg('Informe o nome da sua loja.');
      return;
    }
    if (!username || username.length < 3) {
      setErrorMsg('O usuário da loja deve ter pelo menos 3 caracteres (sem espaços).');
      return;
    }
    if (!password || password.length < 4) {
      setErrorMsg('A senha da loja deve ter pelo menos 4 caracteres.');
      return;
    }
    if (password !== signupPassConfirm) {
      setErrorMsg('A confirmação de senha não confere.');
      return;
    }

    setIsSubmittingSignup(true);

    try {
      // Create new store account
      const newAccount: StoreAccount = {
        id: username,
        username,
        password,
        storeName,
        storePhone: phone,
        storeAddress: address,
        storeLat: signupLat,
        storeLng: signupLng,
        createdAt: Date.now(),
      };

      await saveStoreAccountToCloud(newAccount);

      onLoginSuccess({
        role: 'store_admin',
        storeName: newAccount.storeName,
        username: newAccount.username,
      });

      if (onClose) onClose();
    } catch (err: any) {
      setErrorMsg('Erro ao cadastrar a loja: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setIsSubmittingSignup(false);
    }
  };

  // 3. Motoboy fazendo login
  const handleMotoboyLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const term = motoboyUser.trim().toLowerCase();
    const targetMotoboy = motoboys.find(
      (m) =>
        (m.username && m.username.trim().toLowerCase() === term) ||
        m.name.trim().toLowerCase() === term ||
        m.id.trim().toLowerCase() === term
    );

    if (!targetMotoboy) {
      setErrorMsg('Entregador não encontrado. Peça para a loja cadastrar seu usuário no painel.');
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

  // 4. Master Admin Login (Ruan / Dono)
  const handleMasterLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const expectedUser = (shift?.masterUsername || 'ruan').trim().toLowerCase();
    const expectedPass = shift?.masterPassword || 'ruan123';

    const inputUser = masterUser.trim().toLowerCase();
    const inputPass = masterPass;

    if (inputUser === expectedUser && inputPass === expectedPass) {
      onLoginSuccess({
        role: 'master_admin',
        storeName: shift?.storeName || 'Rota Fácil Master (Ruan)',
        username: inputUser,
        isMaster: true,
      });
      if (onClose) onClose();
    } else {
      setErrorMsg('Usuário ou senha Master incorretos!');
    }
  };

  const outerClasses = isStandalonePage
    ? 'min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white'
    : 'fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white';

  return (
    <div className={outerClasses}>
      <div className="bg-slate-900 text-slate-100 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-5">
        
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-black mx-auto shadow-lg shadow-blue-600/30">
            🛵
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Rota Fácil Delivery
            </h2>
            <p className="text-xs font-bold text-blue-400 tracking-wide uppercase">
              {shift?.storeName && shift.storeName !== 'Configure sua loja'
                ? shift.storeName
                : 'Sistema de Entregas & Balcão'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-950 p-1 rounded-2xl border border-slate-800 flex text-xs font-bold gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('store_login');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'store_login'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Store className="w-3.5 h-3.5" /> Entrar na Loja
          </button>
          
          <button
            type="button"
            onClick={() => {
              setActiveTab('store_signup');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'store_signup'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-900/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Criar Loja
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('motoboy');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'motoboy'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Bike className="w-3.5 h-3.5" /> Motoboy
          </button>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. ABA: ENTRAR NA LOJA (LOGIN DO CLIENTE) */}
        {activeTab === 'store_login' && (
          <form onSubmit={handleStoreLogin} autoComplete="off" className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Usuário da Loja</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  name="store-login-user"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={storeUser}
                  onChange={(e) => setStoreUser(e.target.value)}
                  placeholder="Ex: hopeburger ou o usuário que criou"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Senha da Loja</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  name="store-login-secret"
                  autoComplete="new-password"
                  required
                  value={storePass}
                  onChange={(e) => setStorePass(e.target.value)}
                  placeholder="Digite a senha da sua loja"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-xs uppercase cursor-pointer"
            >
              <LogIn className="w-4 h-4" /> Entrar no Painel da Loja
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('store_signup');
                  setErrorMsg(null);
                }}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <span>Ainda não tem conta? Criar Cadastro da Loja</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* 2. ABA: CADASTRAR NOVA LOJA (O CLIENTE CRIA O USUÁRIO E SENHA DELE) */}
        {activeTab === 'store_signup' && (
          <form onSubmit={handleStoreSignup} autoComplete="off" className="space-y-3.5 text-xs max-h-[65vh] overflow-y-auto pr-1">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium">
              ✨ <strong>Cadastro Rápido da Loja:</strong> Crie seu próprio usuário e senha para gerenciar suas entregas e equipe de motoboys.
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Nome da Sua Loja / Restaurante</label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={signupStoreName}
                  onChange={(e) => setSignupStoreName(e.target.value)}
                  placeholder="Ex: Hope Burger, Pizzaria do Zé..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">WhatsApp Comercial</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  placeholder="Ex: (47) 99887-6655"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-300 block">Endereço Completo da Loja</label>
                <button
                  type="button"
                  onClick={handleGeocodeSignupAddress}
                  disabled={isGeocoding || !signupAddress.trim()}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Search className="w-3 h-3" />
                  <span>{isGeocoding ? 'Localizando...' : 'Buscar no Mapa'}</span>
                </button>
              </div>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={signupAddress}
                  onChange={(e) => setSignupAddress(e.target.value)}
                  placeholder="Ex: Rua dos Caçadores, 653, Blumenau - SC"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <div className="space-y-1">
                <label className="font-bold text-slate-300 block">Escolha seu Usuário</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    autoCapitalize="none"
                    spellCheck={false}
                    value={signupUser}
                    onChange={(e) => setSignupUser(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="Ex: hopeburger"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 block">Escolha sua Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={signupPass}
                    onChange={(e) => setSignupPass(e.target.value)}
                    placeholder="Mínimo 4 dígitos"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Confirmar Senha</label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={signupPassConfirm}
                  onChange={(e) => setSignupPassConfirm(e.target.value)}
                  placeholder="Repita sua senha"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingSignup}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-xs uppercase cursor-pointer disabled:opacity-50 mt-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSubmittingSignup ? 'Criando Conta...' : 'Criar Minha Loja & Entrar'}</span>
            </button>
          </form>
        )}

        {/* 3. ABA: LOGIN DO MOTOBOY */}
        {activeTab === 'motoboy' && (
          <form onSubmit={handleMotoboyLogin} autoComplete="off" className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Usuário do Entregador</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  name="driver-login-user"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={motoboyUser}
                  onChange={(e) => setMotoboyUser(e.target.value)}
                  placeholder="Ex: carlos, motoboy1..."
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Senha do Entregador</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  name="driver-login-secret"
                  autoComplete="new-password"
                  required
                  value={motoboyPass}
                  onChange={(e) => setMotoboyPass(e.target.value)}
                  placeholder="Digite sua senha cadastrada pela loja"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 active:scale-98 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 text-xs uppercase cursor-pointer"
            >
              <LogIn className="w-4 h-4" /> Entrar no Celular do Entregador
            </button>
          </form>
        )}

        {/* 4. ABA: LOGIN MASTER (RUAN / DONO DA PLATAFORMA) */}
        {activeTab === 'master' && (
          <form onSubmit={handleMasterLogin} autoComplete="off" className="space-y-4 text-xs">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-medium">
              👑 <strong>Acesso Master Plataforma (Ruan):</strong> Controle total sobre todas as configurações, lojas e operações.
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Usuário Master</label>
              <div className="relative">
                <Crown className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={masterUser}
                  onChange={(e) => setMasterUser(e.target.value)}
                  placeholder="ruan"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300 block">Senha Master</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={masterPass}
                  onChange={(e) => setMasterPass(e.target.value)}
                  placeholder="ruan123"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 active:scale-98 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 text-xs uppercase cursor-pointer"
            >
              <Crown className="w-4 h-4" /> Entrar como Master Admin (Ruan)
            </button>
          </form>
        )}

        {/* Footer Master Link */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 text-[11px] text-slate-400">
          <button
            type="button"
            onClick={() => {
              setActiveTab(activeTab === 'master' ? 'store_login' : 'master');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-bold cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>{activeTab === 'master' ? 'Voltar para Loja' : 'Acesso Master (Ruan)'}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 underline font-medium cursor-pointer"
            >
              Rastreio do Cliente
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
