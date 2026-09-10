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
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { geocodeAddress } from '../utils/geoUtils';
import { saveStoreAccountToCloud, getStoreAccountFromCloud, upgradeStoreCredentialsToHash, upgradeMotoboyPasswordToHash } from '../lib/firebase';
import { verifyCredential } from '../lib/passwordSecurity';
import { DEFAULT_MASTER_USERNAME, DEFAULT_MASTER_PASSWORD } from '../lib/masterCredentials';

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

    if (shiftStoreUser && shiftStoreUser === inputUser) {
      const shiftCheck = await verifyCredential(inputPass, {
        passwordHash: shift?.adminPasswordHash,
        passwordSalt: shift?.adminPasswordSalt,
        legacyPlainPassword: shift?.adminPassword,
      });
      if (shiftCheck.valid) {
        if (shiftCheck.needsUpgrade) {
          // Conta antiga (senha em texto puro): migra para hash em segundo
          // plano, sem atrasar nem afetar o login que já foi liberado.
          upgradeStoreCredentialsToHash(inputUser, inputPass);
        }
        onLoginSuccess({
          role: 'store_admin',
          storeName: shift?.storeName || 'Minha Loja',
          username: inputUser,
        });
        if (onClose) onClose();
        return;
      }
    }

    try {
      const cloudAccount = await getStoreAccountFromCloud(inputUser);
      if (cloudAccount) {
        const cloudCheck = await verifyCredential(inputPass, {
          passwordHash: cloudAccount.passwordHash,
          passwordSalt: cloudAccount.passwordSalt,
          legacyPlainPassword: cloudAccount.password,
        });
        if (cloudCheck.valid) {
          if (cloudCheck.needsUpgrade) {
            upgradeStoreCredentialsToHash(cloudAccount.username, inputPass);
          }
          onLoginSuccess({
            role: 'store_admin',
            storeName: cloudAccount.storeName,
            username: cloudAccount.username,
          });
          if (onClose) onClose();
          return;
        }
      }
    } catch (err) {
      console.warn('Erro ao autenticar loja no Firestore:', err);
    }

    if (inputUser === (shift?.masterUsername || DEFAULT_MASTER_USERNAME) && inputPass === (shift?.masterPassword || DEFAULT_MASTER_PASSWORD)) {
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
      const existingAccount = await getStoreAccountFromCloud(username);
      if (existingAccount) {
        setErrorMsg('Esse nome de usuário já está em uso. Escolha outro ou faça login na aba "Entrar".');
        setIsSubmittingSignup(false);
        return;
      }

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
  const handleMotoboyLogin = async (e: React.FormEvent) => {
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

    const check = await verifyCredential(motoboyPass, {
      passwordHash: targetMotoboy.passwordHash,
      passwordSalt: targetMotoboy.passwordSalt,
      legacyPlainPassword: targetMotoboy.password,
    });

    if (!check.valid) {
      setErrorMsg('Senha incorreta.');
      return;
    }

    if (check.needsUpgrade) {
      upgradeMotoboyPasswordToHash(targetMotoboy.id, motoboyPass);
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

    const expectedUser = (shift?.masterUsername || DEFAULT_MASTER_USERNAME).trim().toLowerCase();
    const expectedPass = shift?.masterPassword || DEFAULT_MASTER_PASSWORD;

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
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 1600 900"
        aria-hidden="true"
      >
        <path d="M-40,830 Q260,690 420,540 T760,340 T1120,170 T1560,40" fill="none" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="7 11" />
        <path d="M1640,760 Q1360,630 1180,480 T840,280 T480,110 T-60,-30" fill="none" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="7 11" />
        <circle cx="1560" cy="40" r="7" fill="#10B981" />
        <circle cx="-40" cy="830" r="7" fill="#F5B942" />
        <circle cx="-60" cy="-30" r="7" fill="#10B981" />
        <circle cx="1640" cy="760" r="7" fill="#F5B942" />
      </svg>

      <div className="w-full max-w-[1040px] bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden grid md:grid-cols-2 relative z-10">

        {/* Painel de identidade — compacto no celular, completo no desktop */}
        <div className="px-5 py-4 sm:px-6 md:p-10 md:border-r border-b md:border-b-0 border-slate-800 flex items-center justify-between md:flex-col md:items-stretch gap-4 md:gap-8">
          <div className="flex items-center gap-2 md:block">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span className="hidden md:inline text-xs text-slate-400">Painel operacional</span>
            <h1 className="text-base md:text-3xl font-extrabold text-white tracking-tight md:mt-3">
              Rota Fácil
            </h1>
          </div>

          <svg viewBox="0 0 260 140" className="hidden md:block w-full h-auto" aria-hidden="true">
            <circle cx="20" cy="118" r="6" fill="#F5B942" />
            <path
              d="M20,118 Q70,108 100,78 T180,38 T230,14"
              fill="none"
              stroke="#334155"
              strokeWidth="2"
              strokeDasharray="5 6"
            />
            <circle cx="100" cy="78" r="3.5" fill="#64748B" />
            <circle cx="180" cy="38" r="3.5" fill="#64748B" />
            <circle cx="230" cy="14" r="5" fill="#10B981" />
          </svg>

          <div className="hidden md:flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-500">Rotas, entregadores e pedidos em um só lugar</span>
          </div>
        </div>

        {/* Painel de acesso */}
        <div className="p-6 sm:p-8 md:p-10 space-y-5">

          {/* Seletor de Abas (sublinhado) */}
          <div className="flex gap-5 border-b border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('store_login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`pb-2.5 -mb-px flex items-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
                activeTab === 'store_login'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
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
              className={`pb-2.5 -mb-px flex items-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
                activeTab === 'store_signup'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
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
              className={`pb-2.5 -mb-px flex items-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
                activeTab === 'motoboy'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
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
                    className="w-full pl-10 pr-3 py-2.5 bg-transparent border-0 border-b border-slate-700 rounded-none text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-normal transition-colors text-xs"
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
                    className="w-full pl-10 pr-10 py-2.5 bg-transparent border-0 border-b border-slate-700 rounded-none text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-normal transition-colors text-xs"
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
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer shadow-sm mt-2"
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
                    className="w-full pl-9 pr-3 py-2 bg-transparent border-0 border-b border-slate-700 rounded-none text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-normal text-xs"
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
                    className="w-full pl-9 pr-3 py-2 bg-transparent border-0 border-b border-slate-700 rounded-none text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-normal text-xs"
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
                    className="w-full pl-9 pr-3 py-2 bg-transparent border-0 border-b border-slate-700 rounded-none text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-normal text-xs"
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
                      className="w-full pl-9 pr-3 py-2 bg-transparent border-0 border-b border-slate-700 rounded-none text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-normal text-xs"
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
                      className="w-full pl-9 pr-3 py-2 bg-transparent border-0 border-b border-slate-700 rounded-none text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-normal text-xs"
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
                    className="w-full pl-9 pr-3 py-2 bg-transparent border-0 border-b border-slate-700 rounded-none text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-normal text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingSignup}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50 mt-2"
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
                    className="w-full pl-10 pr-3 py-2.5 bg-transparent border-0 border-b border-slate-700 rounded-none text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-normal transition-colors text-xs"
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
                    className="w-full pl-10 pr-10 py-2.5 bg-transparent border-0 border-b border-slate-700 rounded-none text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-normal transition-colors text-xs"
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
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer mt-2"
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
                    className="w-full pl-10 pr-3 py-2.5 bg-transparent border-0 border-b border-slate-700 rounded-none text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-normal transition-colors text-xs"
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
                    className="w-full pl-10 pr-10 py-2.5 bg-transparent border-0 border-b border-slate-700 rounded-none text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-normal transition-colors text-xs"
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
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer mt-2"
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
