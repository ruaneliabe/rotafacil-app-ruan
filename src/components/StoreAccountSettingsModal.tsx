import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Building2, CheckCircle2, Eye, EyeOff, Lock, MapPin, Navigation, Phone, Save, Search, ShieldCheck, User, X } from 'lucide-react';
import { StoreShift } from '../types';
import { geocodeAddress } from '../utils/geoUtils';
import { hashPassword } from '../lib/passwordSecurity';

interface StoreAccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: StoreShift;
  onSaveSettings: (updatedShift: StoreShift) => void;
  onActivateRealPilot?: () => void;
  firstSetup?: boolean;
}

const StoreLocationPickerMap: React.FC<{ lat:number; lng:number; onChangeCoords:(lat:number,lng:number)=>void }> = ({lat,lng,onChangeCoords}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map|null>(null);
  const markerRef = useRef<L.Marker|null>(null);
  const [isGettingGps,setIsGettingGps] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const validLat = Number.isFinite(lat) ? lat : -26.91530418395996;
    const validLng = Number.isFinite(lng) ? lng : -49.1146354675293;
    if (!mapRef.current) {
      const map = L.map(containerRef.current,{center:[validLat,validLng],zoom:16,zoomControl:true});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap',maxZoom:19}).addTo(map);
      const icon = L.divIcon({className:'custom-store-pin',html:'<div style="background:#7c3aed;color:white;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 4px 14px rgba(15,23,42,.25);font-size:17px">🏪</div>',iconSize:[34,34],iconAnchor:[17,17]});
      const marker = L.marker([validLat,validLng],{icon,draggable:true}).addTo(map);
      marker.on('dragend',()=>{const p=marker.getLatLng();onChangeCoords(p.lat,p.lng)});
      map.on('click',(e:L.LeafletMouseEvent)=>{marker.setLatLng(e.latlng);onChangeCoords(e.latlng.lat,e.latlng.lng)});
      mapRef.current=map; markerRef.current=marker;
      window.setTimeout(()=>map.invalidateSize(),150);
    } else {
      mapRef.current.setView([validLat,validLng],mapRef.current.getZoom());
      markerRef.current?.setLatLng([validLat,validLng]);
    }
  },[lat,lng,onChangeCoords]);

  const useGps = () => {
    if (!navigator.geolocation) return;
    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition((pos)=>{
      setIsGettingGps(false);
      const {latitude,longitude}=pos.coords;
      onChangeCoords(latitude,longitude);
      mapRef.current?.setView([latitude,longitude],17);
      markerRef.current?.setLatLng([latitude,longitude]);
    },()=>setIsGettingGps(false),{enableHighAccuracy:true,timeout:8000});
  };

  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-xs font-semibold text-slate-800">Localização no mapa</p><p className="text-[10px] text-slate-500">Clique ou arraste o pino para ajustar.</p></div>
      <button type="button" onClick={useGps} disabled={isGettingGps} className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 disabled:opacity-50"><Navigation className="w-3.5 h-3.5 text-violet-600"/>{isGettingGps?'Localizando...':'Usar GPS atual'}</button>
    </div>
    <div ref={containerRef} className="w-full h-48 rounded-xl border border-slate-200 overflow-hidden shadow-sm z-0"/>
  </div>;
};

export const StoreAccountSettingsModal: React.FC<StoreAccountSettingsModalProps> = ({isOpen,onClose,shift,onSaveSettings,firstSetup=false}) => {
  const initialStoreName = firstSetup && shift.storeName==='Configure sua loja' ? '' : (shift.storeName||'');
  const [storeName,setStoreName]=useState(initialStoreName);
  const [storePhone,setStorePhone]=useState(shift.storePhone||'');
  const [storeAddress,setStoreAddress]=useState(shift.storeAddress||'');
  const [storeLat,setStoreLat]=useState<number>(shift.storeLat||-26.91530418395996);
  const [storeLng,setStoreLng]=useState<number>(shift.storeLng||-49.1146354675293);
  const [storeUsername,setStoreUsername]=useState(shift.storeUsername||'');
  const [adminPassword,setAdminPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [isSaved,setIsSaved]=useState(false);
  const [isGeocoding,setIsGeocoding]=useState(false);
  const [formError,setFormError]=useState('');

  useEffect(()=>{if(!isOpen)return;setStoreName(firstSetup&&shift.storeName==='Configure sua loja'?'':shift.storeName||'');setStorePhone(shift.storePhone||'');setStoreAddress(shift.storeAddress||'');setStoreLat(shift.storeLat||-26.91530418395996);setStoreLng(shift.storeLng||-49.1146354675293);setStoreUsername(shift.storeUsername||'');setAdminPassword('');setIsSaved(false);setFormError('')},[isOpen,shift,firstSetup]);
  if(!isOpen)return null;

  const locate = async()=>{if(!storeAddress.trim()||isGeocoding)return;setIsGeocoding(true);try{const r=await geocodeAddress(storeAddress);if(r&&Number.isFinite(r.lat)&&Number.isFinite(r.lng)){setStoreLat(r.lat);setStoreLng(r.lng)}}finally{setIsGeocoding(false)}};
  const submit = async(e:React.FormEvent)=>{e.preventDefault();setFormError('');if(!storeName.trim()){setFormError('Informe o nome da loja.');return}if(!storePhone.trim()){setFormError('Informe o telefone ou WhatsApp comercial.');return}if(!storeAddress.trim()){setFormError('Informe o endereço completo da loja.');return}if(adminPassword.trim()&&adminPassword.trim().length<4){setFormError('A nova senha precisa ter pelo menos 4 caracteres.');return}
    let passwordUpdate:Partial<StoreShift>={};if(adminPassword.trim()){const {hash,salt}=await hashPassword(adminPassword.trim());passwordUpdate={adminPasswordHash:hash,adminPasswordSalt:salt,adminPassword:undefined}}
    onSaveSettings({...shift,storeName:storeName.trim(),storePhone:storePhone.trim(),storeAddress:storeAddress.trim(),storeLat:Number(storeLat),storeLng:Number(storeLng),storeUsername:storeUsername.trim().toLowerCase().replace(/\s+/g,''),setupRequired:false,...passwordUpdate});setIsSaved(true);window.setTimeout(()=>{setIsSaved(false);onClose()},650)};

  const inputClass='w-full h-10 pl-10 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100';
  const labelClass='block text-[11px] font-semibold text-slate-600 mb-1.5';

  return <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
    <div className="bg-white text-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 border border-violet-100 grid place-items-center"><Building2 className="w-4.5 h-4.5"/></div><div><h3 className="font-semibold text-base text-slate-950">Configurações da loja</h3><p className="text-[11px] text-slate-500 mt-0.5">Dados comerciais, endereço e acesso ao painel.</p></div></div>
        {!firstSetup&&<button type="button" onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="w-4 h-4"/></button>}
      </div>
      <form onSubmit={submit} className="p-5 space-y-4">
        {isSaved&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-800"><CheckCircle2 className="w-4 h-4"/>Alterações salvas com sucesso.</div>}
        <div><label className={labelClass}>Nome da loja / estabelecimento</label><div className="relative"><Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3"/><input required value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="Ex: Hope Burger e Pizza" className={inputClass}/></div></div>
        <div><label className={labelClass}>Telefone / WhatsApp comercial</label><div className="relative"><Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3"/><input required value={storePhone} onChange={e=>setStorePhone(e.target.value)} placeholder="(47) 99999-9999" className={inputClass}/></div></div>
        <div><div className="flex items-end justify-between gap-3 mb-1.5"><label className="text-[11px] font-semibold text-slate-600">Endereço completo da loja</label><button type="button" onClick={locate} disabled={isGeocoding||!storeAddress.trim()} className="text-[10px] font-semibold text-violet-700 hover:text-violet-900 disabled:opacity-40 flex items-center gap-1"><Search className="w-3 h-3"/>{isGeocoding?'Localizando...':'Localizar no mapa'}</button></div><div className="relative"><MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3"/><input required value={storeAddress} onChange={e=>setStoreAddress(e.target.value)} placeholder="Rua, número, bairro, cidade" className={inputClass}/></div></div>
        <StoreLocationPickerMap lat={storeLat} lng={storeLng} onChangeCoords={(a,b)=>{setStoreLat(Number(a.toFixed(6)));setStoreLng(Number(b.toFixed(6)))}}/>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-violet-600"/><div><p className="text-xs font-semibold text-slate-800">Acesso da loja</p><p className="text-[10px] text-slate-500">Altere usuário ou senha somente quando necessário.</p></div></div><div className="grid sm:grid-cols-2 gap-3"><div><label className={labelClass}>Usuário</label><div className="relative"><User className="w-4 h-4 text-slate-400 absolute left-3 top-3"/><input value={storeUsername} onChange={e=>setStoreUsername(e.target.value.toLowerCase().replace(/\s+/g,''))} className={inputClass}/></div></div><div><label className={labelClass}>Nova senha</label><div className="relative"><Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3"/><input type={showPassword?'text':'password'} value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} placeholder="Deixe em branco para manter" className={`${inputClass} pr-10`}/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-3 text-slate-400">{showPassword?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button></div></div></div></div>
        {formError&&<div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{formError}</div>}
        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">{!firstSetup&&<button type="button" onClick={onClose} className="h-10 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700">Cancelar</button>}<button type="submit" className="h-10 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-2"><Save className="w-4 h-4"/>{firstSetup?'Concluir cadastro':'Salvar alterações'}</button></div>
      </form>
    </div>
  </div>;
};

export default StoreAccountSettingsModal;
