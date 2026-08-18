import React, { useState } from 'react';
import { UserSession, Motoboy, StoreShift, StoreAccount } from '../types';
import {
  Store,
  Bike,
  Lock,
  User,
  AlertCircle,
  LogIn,
  Crown,
  Building2,
  Phone,
  MapPin,
  CheckCircle2,
  Search,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
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
  const [showStorePass, setShowStorePass] = useState(false);

  // Store Signup State
  const [signupStoreName, setSignupStoreName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupAddress, setSignupAddress] = useState('');
  const [signupUser, setSignupUser] = useState('');
  const [signupPass, setSignupPass] = useState('');
  const [signupPassConfirm, setSignupPassConfirm] = useState('');
  const [showSignupPass, setShowSignupPass] = useState(false);
  const [signupLat, setSignupLat] = useState<number>(-26.9194);
  const [signupLng, setSignupLng] = useState<number>(-49.0661);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSubmittingSignup, setIsSubmittingSignup] = useState(false);

  // Motoboy Login State
  const [motoboyUser, setMotoboyUser] = useState('');
  const [motoboyPass, setMotoboyPass] = useState('');
  const [showMotoboyPass, setShowMotoboyPass] = useState(false);

  // Master Login State
  const [masterUser, setMasterUser] = useState('');
  const [masterPass, setMasterPass] = useState('');
  const [showMasterPass, setShowMasterPass] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen && !isStandalonePage) return null;

  // 1. Store Login
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

    const shiftStoreUser = (shift?.storeUsername || '').trim().toLowerCase();
    const shiftAdminPass = shift?.adminPassword || '';

    if (shiftStoreUser && shiftStoreUser === inputUser && shiftAdminPass === inputPass) {
      onLoginSuccess({
        role: 'store_admin',
        storeName: shift?.storeName || 'Minha Loja',
        username: inputUser,
      });
      if (onClose) onClose();
      return;
    }

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

    if (shift?.setupRequired && inputUser === 'admin' && inputPass === (shift.adminPassword || 'admin123')) {
      onLoginSuccess({
        role: 'store_admin',
        storeName: shift?.storeName || 'Configure sua loja',
        username: inputUser,
      });
      if (onClose) onClose();
      return;
    }

    setErrorMsg('Usuário ou senha da loja incorretos.');
  };

  // 2. Geocode & Signup
  const handleGeocodeSignupAddress = async () => {
    if (!signupAddress.trim()) return;
    setIsGeocoding(true);
    setErrorMsg(null);
    try {
      const geo = await geocodeAddress(signupAddress.trim());
      if (geo && typeof geo.lat === 'number' && typeof geo.lng === 'number') {
        setSignupLat(Number(geo.lat.toFixed(6)));
        setSignupLng(Number(geo.lng.toFixed(6)));
        setSuccessMsg(`Localização encontrada: ${geo.name || geo.address}`);
      } else {
        setErrorMsg('Endereço não localizado automaticamente. Você pode prosseguir e ajustar depois.');
      }
    } catch {
      setErrorMsg('Não foi possível geolocalizar agora. Você pode salvar e ajustar nas configurações.');
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
      setErrorMsg('O usuário deve ter no mínimo 3 caracteres.');
      return;
    }
    if (!password || password.length < 4) {
      setErrorMsg('A senha deve ter no mínimo 4 caracteres.');
      return;
    }
    if (password !== signupPassConfirm) {
      setErrorMsg('As senhas não coincidem.');
      return;
    }

    setIsSubmittingSignup(true);

    try {
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
      setErrorMsg('Erro ao cadastrar: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setIsSubmittingSignup(false);
    }
  };

  // 3. Motoboy Login
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
      setErrorMsg('Entregador não encontrado. Verifique o usuário informado.');
      return;
    }

    if (!targetMotoboy.password || targetMotoboy.password !== motoboyPass) {
      setErrorMsg('Senha incorreta.');
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

  // 4. Master Login
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
        storeName: shift?.storeName || 'Rota Fácil Master',
        username: inputUser,
        isMaster: true,
      });
      if (onClose) onClose();
    } else {
      setErrorMsg('Credenciais Master inválidas.');
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      {/* Container Central Clean */}
      <div className="w-full max-w-[420px]">
        {/* Card Principal */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl space-y-6">
          
          {/* Cabeçalho */}
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center text-xl shadow-inner mb-3">
              🛵
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Rota Fácil Delivery
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              {shift?.storeName && shift.storeName !== 'Configure sua loja'
                ? shift.storeName
                : 'Gestão de Entregas e Balcão'}
            </p>
          </div>

          {/* Seletor de Abas (Minimalista) */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('store_login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'store_login'
                  ? 'bg-slate-800 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>
            
            <button
              type="button"
              onClick={() => {
                setActiveTab('store_signup');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'store_signup'
                  ? 'bg-slate-800 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Cadastrar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('motoboy');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'motoboy'
                  ? 'bg-slate-800 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Entregador</span>
            </button>
          </div>

          {/* Mensagens de Alerta */}
          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 text-red-300 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 rounded-xl text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. LOGIN DA LOJA */}
          {activeTab === 'store_login' && (
            <form onSubmit={handleStoreLogin} autoComplete="off" className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 block text-xs">Usuário da Loja</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    name="store-user"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={storeUser}
                    onChange={(e) => setStoreUser(e.target.value)}
                    placeholder="ex: hopeburger"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 font-normal transition-colors text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 block text-xs">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showStorePass ? 'text' : 'password'}
                    name="store-pass"
                    autoComplete="new-password"
                    required
                    value={storePass}
                    onChange={(e) => setStorePass(e.target.value)}
                    placeholder="Sua senha de acesso"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 font-normal transition-colors text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStorePass(!showStorePass)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showStorePass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer shadow-sm mt-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Entrar no Painel</span>
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('store_signup');
                    setErrorMsg(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Não possui conta? Cadastre sua loja</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </form>
          )}

          {/* 2. CADASTRO DE LOJA */}
          {activeTab === 'store_signup' && (
            <form onSubmit={handleStoreSignup} autoComplete="off" className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block text-xs">Nome do Estabelecimento</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={signupStoreName}
                    onChange={(e) => setSignupStoreName(e.target.value)}
                    placeholder="Ex: Hope Burger"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 font-normal text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block text-xs">WhatsApp / Contato</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 font-normal text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300 block text-xs">Endereço da Loja</label>
                  <button
                    type="button"
                    onClick={handleGeocodeSignupAddress}
                    disabled={isGeocoding || !signupAddress.trim()}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Search className="w-3 h-3" />
                    <span>{isGeocoding ? 'Buscando...' : 'Localizar'}</span>
                  </button>
                </div>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={signupAddress}
                    onChange={(e) => setSignupAddress(e.target.value)}
                    placeholder="Rua, Número, Bairro, Cidade"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 font-normal text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block text-xs">Usuário</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      autoCapitalize="none"
                      spellCheck={false}
                      value={signupUser}
                      onChange={(e) => setSignupUser(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      placeholder="usuario"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 font-normal text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block text-xs">Senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type={showSignupPass ? 'text' : 'password'}
                      required
                      value={signupPass}
                      onChange={(e) => setSignupPass(e.target.value)}
                      placeholder="Mín. 4 dígitos"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 font-normal text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block text-xs">Confirmar Senha</label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type={showSignupPass ? 'text' : 'password'}
                    required
                    value={signupPassConfirm}
                    onChange={(e) => setSignupPassConfirm(e.target.value)}
                    placeholder="Repita sua senha"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 font-normal text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingSignup}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50 mt-2"
              >
                <span>{isSubmittingSignup ? 'Cadastrando...' : 'Concluir Cadastro'}</span>
              </button>
            </form>
          )}

          {/* 3. LOGIN MOTOBOY */}
          {activeTab === 'motoboy' && (
            <form onSubmit={handleMotoboyLogin} autoComplete="off" className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 block text-xs">Usuário do Entregador</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    name="driver-user"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={motoboyUser}
                    onChange={(e) => setMotoboyUser(e.target.value)}
                    placeholder="Nome de usuário cadastrado"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 font-normal transition-colors text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 block text-xs">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showMotoboyPass ? 'text' : 'password'}
                    name="driver-pass"
                    autoComplete="new-password"
                    required
                    value={motoboyPass}
                    onChange={(e) => setMotoboyPass(e.target.value)}
                    placeholder="Senha do entregador"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 font-normal transition-colors text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMotoboyPass(!showMotoboyPass)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showMotoboyPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer mt-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Acessar Entregador</span>
              </button>
            </form>
          )}

          {/* 4. LOGIN MASTER */}
          {activeTab === 'master' && (
            <form onSubmit={handleMasterLogin} autoComplete="off" className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 block text-xs">Usuário Master</label>
                <div className="relative">
                  <Crown className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={masterUser}
                    onChange={(e) => setMasterUser(e.target.value)}
                    placeholder="ruan"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 font-normal transition-colors text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 block text-xs">Senha Master</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showMasterPass ? 'text' : 'password'}
                    required
                    value={masterPass}
                    onChange={(e) => setMasterPass(e.target.value)}
                    placeholder="••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 font-normal transition-colors text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPass(!showMasterPass)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showMasterPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer mt-2"
              >
                <Crown className="w-4 h-4" />
                <span>Entrar como Master</span>
              </button>
            </form>
          )}

          {/* Rodapé Discreto */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 text-[11px] text-slate-500">
            <button
              type="button"
              onClick={() => {
                setActiveTab(activeTab === 'master' ? 'store_login' : 'master');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="hover:text-slate-400 cursor-pointer transition-colors"
            >
              {activeTab === 'master' ? '← Voltar ao Login' : 'Acesso Master'}
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="hover:text-slate-400 cursor-pointer transition-colors"
              >
                Rastreio de Pedido
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
