import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
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
  User,
} from 'lucide-react';

interface StoreAccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: StoreShift;
  onSaveSettings: (updatedShift: StoreShift) => void;
  onActivateRealPilot?: () => void;
  firstSetup?: boolean;
}

const StoreLocationPickerMap: React.FC<{
  lat: number;
  lng: number;
  onChangeCoords: (lat: number, lng: number) => void;
}> = ({ lat, lng, onChangeCoords }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isGettingGps, setIsGettingGps] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const validLat = typeof lat === 'number' && !isNaN(lat) ? lat : -26.91530418395996;
    const validLng = typeof lng === 'number' && !isNaN(lng) ? lng : -49.1146354675293;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [validLat, validLng],
        zoom: 16,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const storeIcon = L.divIcon({
        className: 'custom-store-pin',
        html: `
          <div style="
            background-color: #059669;
            color: white;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            font-size: 18px;
          ">
            🏪
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([validLat, validLng], { icon: storeIcon, draggable: true }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChangeCoords(pos.lat, pos.lng);
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat: newLat, lng: newLng } = e.latlng;
        marker.setLatLng([newLat, newLng]);
        onChangeCoords(newLat, newLng);
      });

      mapRef.current = map;
      markerRef.current = marker;

      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    } else {
      mapRef.current.setView([validLat, validLng], mapRef.current.getZoom());
      if (markerRef.current) {
        markerRef.current.setLatLng([validLat, validLng]);
      }
    }
  }, [lat, lng, onChangeCoords]);

  const handleUseCurrentGps = () => {
    if (!('geolocation' in navigator)) return;
    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGettingGps(false);
        const { latitude, longitude } = pos.coords;
        onChangeCoords(latitude, longitude);
        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([latitude, longitude], 17);
          markerRef.current.setLatLng([latitude, longitude]);
        }
      },
      (err) => {
        setIsGettingGps(false);
        console.warn('GPS store location error:', err);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-2 mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-300">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <MapPin className="w-3.5 h-3.5" /> Pino da Loja no Mapa (Clique ou Arraste)
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUseCurrentGps}
            disabled={isGettingGps}
            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold rounded shadow-xs transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
          >
            <Navigation className="w-3 h-3" />
            {isGettingGps ? 'Pegando GPS...' : 'Usar Meu GPS Atual'}
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="w-full h-48 rounded-xl border border-slate-700 overflow-hidden shadow-inner z-0"
      />
    </div>
  );
};

export const StoreAccountSettingsModal: React.FC<StoreAccountSettingsModalProps> = ({
  isOpen,
  onClose,
  shift,
  onSaveSettings,
  onActivateRealPilot,
  firstSetup = false,
}) => {
  const initialStoreName = firstSetup && shift.storeName === 'Configure sua loja' ? '' : (shift.storeName || '');
  const [storeName, setStoreName] = useState(initialStoreName);
  const [storePhone, setStorePhone] = useState(shift.storePhone || '');
  const [storeAddress, setStoreAddress] = useState(shift.storeAddress || '');
  const [storeLat, setStoreLat] = useState<number>(shift.storeLat || -26.91530418395996);
  const [storeLng, setStoreLng] = useState<number>(shift.storeLng || -49.1146354675293);
  const [storeUsername, setStoreUsername] = useState(shift.storeUsername || '');
  const [adminPassword, setAdminPassword] = useState(shift.adminPassword || '');

  const [showPassword, setShowPassword] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeSuccess, setGeocodeSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStoreName(firstSetup && shift.storeName === 'Configure sua loja' ? '' : (shift.storeName || ''));
      setStorePhone(shift.storePhone || '');
      setStoreAddress(shift.storeAddress || '');
      setStoreLat(shift.storeLat || -26.91530418395996);
      setStoreLng(shift.storeLng || -49.1146354675293);
      setStoreUsername(shift.storeUsername || '');
      setAdminPassword(shift.adminPassword || '');
      setIsSaved(false);
      setGeocodeSuccess(false);
      setFormError('');
    }
  }, [isOpen, shift, firstSetup]);

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
    setFormError('');
    if (!storeName.trim() || storeName.trim() === 'Configure sua loja') {
      setFormError('Informe o nome real da loja.');
      return;
    }
    if (!storePhone.trim()) {
      setFormError('Informe o telefone ou WhatsApp comercial.');
      return;
    }
    if (!storeAddress.trim()) {
      setFormError('Informe o endereço completo da loja.');
      return;
    }
    if (adminPassword.trim() && adminPassword.trim().length < 4) {
      setFormError('A senha precisa ter pelo menos 4 caracteres.');
      return;
    }

    let finalLat = Number(storeLat) || -26.91530418395996;
    let finalLng = Number(storeLng) || -49.1082;

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
      storeUsername: storeUsername.trim().toLowerCase().replace(/\s+/g, '') || shift.storeUsername || '',
      adminPassword: adminPassword.trim() || shift.adminPassword || '',
      setupRequired: false,
    };

    onSaveSettings(updated);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto selection:bg-emerald-600 selection:text-white">
      <div className="bg-slate-900 text-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-800 overflow-hidden my-8">
        
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base tracking-tight flex items-center gap-2">
                Configurações da Conta & Loja
              </h3>
              <p className="text-xs text-slate-400">
                Personalize os dados da sua empresa, endereço e credenciais de acesso
              </p>
            </div>
          </div>
          {!firstSetup && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
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
                placeholder="Ex: Hope Burger, Pizzaria do Zé..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
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
                required
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                placeholder="Ex: (47) 99887-6655"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
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
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-400 font-bold text-[10px] rounded-lg border border-slate-700 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
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
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Endereço central da loja para calcular partidas e centralizar no mapa.
            </p>
          </div>

          {/* Latitude & Longitude + Map Picker */}
          <div className="space-y-3 pt-1">
            <StoreLocationPickerMap
              lat={storeLat}
              lng={storeLng}
              onChangeCoords={(newLat, newLng) => {
                setStoreLat(Number(newLat.toFixed(6)));
                setStoreLng(Number(newLng.toFixed(6)));
              }}
            />
          </div>

          {/* Credenciais de Acesso da Loja (Usuário e Senha) */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Credenciais de Acesso da Loja
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-300">
                  Usuário da Loja
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={storeUsername}
                    onChange={(e) => setStoreUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="Ex: hopeburger"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-300">
                  Senha da Loja
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Nova senha"
                    className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Esses serão os dados usados para acessar o painel da sua loja.
            </p>
          </div>

          {formError && (
            <div role="alert" className="bg-rose-500/15 border border-rose-500/40 text-rose-200 p-3.5 rounded-2xl text-xs font-bold">
              ⚠️ {formError}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            {!firstSetup && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs font-extrabold rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {firstSetup ? 'Concluir cadastro da loja' : 'Salvar Alterações'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
