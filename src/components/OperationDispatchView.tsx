import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, MapPin, Package, Phone, Plus, Radio, Search, Wifi, WifiOff } from 'lucide-react';
import { Motoboy, Order, Stop, StoreShift } from '../types';
import ReactiveRouteMap from './ReactiveRouteMap';

interface OperationDispatchViewProps {
  orders: Order[]; motoboys: Motoboy[]; shift: StoreShift; activeOrders: Order[]; unassignedOrders: Order[]; motoboysAvailable: Motoboy[];
  selectedOrderIds: string[]; setSelectedOrderIds: (ids: string[]) => void; selectedMotoboyId: string | null; setSelectedMotoboyId: (id: string | null) => void;
  onAssignOrderToMotoboy: (orderId: string, motoboyId: string) => void; onAssignBatchToMotoboy?: (orderIds: string[], motoboyId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void; onUpdateMotoboyStatus?: (motoboyId: string, status: Motoboy['status']) => void;
  onOpenNewOrderModal: () => void; onOpenMotoboyModal: () => void; onSelectOrderForTracking: (order: Order) => void; setIsRouteModalOpen: (open: boolean) => void;
  setTicketOrder: (order: Order) => void; setIsTicketOpen: (open: boolean) => void; handleCallCounter: (motoboyId: string, motoboyName: string) => void;
  triggerActionToast: (msg: string) => void; setActiveTab: (tab: any) => void; getMotoboyLoad: (motoboyId: string) => number; assignOrderRespectingLoad: (orderId: string, motoboyId: string) => void;
}

type OrderFilter = 'all' | 'waiting' | 'preparing' | 'ready' | 'route';
const money = (value = 0) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const displayCode = (order: Order) => order.displayCode || `#${order.codeNumber}`;
const isRoute = (o: Order) => ['in_transit', 'dispatched', 'picked_up'].includes(o.status);
const isReady = (o: Order) => o.status === 'ready_at_counter';
const isPreparing = (o: Order) => Boolean(o.assignedMotoboyId) && !isRoute(o) && !isReady(o) && !['delivered', 'cancelled'].includes(o.status);
const orderStatusLabel = (o: Order) => isRoute(o) ? 'Em rota' : isReady(o) ? 'Pronto' : isPreparing(o) || o.status === 'preparing' ? 'Preparando' : 'Novo';
const driverStatusLabel = (m: Motoboy) => m.status === 'available' ? 'Disponível' : m.status === 'delivering' ? 'Em rota' : m.status === 'returning_to_store' ? 'Voltando' : (m.status === 'busy' || m.status === 'paused') ? 'Pausado' : 'Offline';
const ageLabel = (timestamp?: number) => { if (!timestamp) return 'sem atualização'; const s=Math.max(0,Math.floor((Date.now()-timestamp)/1000)); if(s<10)return'agora'; if(s<60)return`há ${s}s`; const m=Math.floor(s/60); if(m<60)return`há ${m} min`; return`há ${Math.floor(m/60)} h`; };
const orderTimestamp=(o?:Order)=>{if(!o)return 0;if(o.createdTimestamp&&Number.isFinite(o.createdTimestamp))return o.createdTimestamp;const t=String(o.createdAt||'').match(/^(\d{1,2}):(\d{2})/);if(!t)return 0;const d=o.createdDate||new Date().toISOString().slice(0,10);const p=new Date(`${d}T${String(t[1]).padStart(2,'0')}:${t[2]}:00`).getTime();return Number.isFinite(p)?p:0;};
const distanceMeters=(a?:number,b?:number,c?:number,d?:number)=>{if(![a,b,c,d].every(v=>typeof v==='number'))return Infinity;const r=6371000,p=Math.PI/180,x=Math.sin(((c!-a!)*p)/2)**2+Math.cos(a!*p)*Math.cos(c!*p)*Math.sin(((d!-b!)*p)/2)**2;return 2*r*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};

export const OperationDispatchView: React.FC<OperationDispatchViewProps> = (props) => {
  const { orders,motoboys,shift,activeOrders,unassignedOrders,motoboysAvailable,selectedMotoboyId,setSelectedMotoboyId,onOpenNewOrderModal,onOpenMotoboyModal,onSelectOrderForTracking,onUpdateOrderStatus,assignOrderRespectingLoad,setActiveTab,triggerActionToast }=props;
  const [query,setQuery]=useState('');
  const [orderFilter,setOrderFilter]=useState<OrderFilter>('all');
  const [selectedOrderId,setSelectedOrderId]=useState<string|null>(null);
  const [sideMode,setSideMode]=useState<'orders'|'drivers'>('orders');
  const [incomingBanner,setIncomingBanner]=useState<string|null>(null);
  const knownOrderIdsRef=useRef<Set<string>|null>(null);

  const cardapioOrders=useMemo(()=>orders.filter(o=>o.originChannel==='cardapio_web'),[orders]);
  const latestCardapioOrder=useMemo(()=>[...cardapioOrders].sort((a,b)=>orderTimestamp(b)-orderTimestamp(a))[0],[cardapioOrders]);
  useEffect(()=>{const ids=new Set(orders.map(o=>o.id));if(!knownOrderIdsRef.current){knownOrderIdsRef.current=ids;return;}const incoming=orders.find(o=>o.originChannel==='cardapio_web'&&!knownOrderIdsRef.current?.has(o.id));if(incoming){setIncomingBanner(`Pedido ${displayCode(incoming)} recebido agora`);const timer=window.setTimeout(()=>setIncomingBanner(null),7000);knownOrderIdsRef.current=ids;return()=>window.clearTimeout(timer);}knownOrderIdsRef.current=ids;},[orders]);
  useEffect(()=>{if(selectedOrderId&&!activeOrders.some(o=>o.id===selectedOrderId))setSelectedOrderId(null);},[activeOrders,selectedOrderId]);

  const counts=useMemo(()=>({
    waiting:activeOrders.filter(o=>!o.assignedMotoboyId&&!isRoute(o)&&!isReady(o)).length,
    preparing:activeOrders.filter(isPreparing).length,
    ready:activeOrders.filter(isReady).length,
    route:activeOrders.filter(isRoute).length,
  }),[activeOrders]);

  const visibleOrders=useMemo(()=>{const q=query.trim().toLowerCase();return activeOrders.filter(o=>{
    const matches=!q||`${displayCode(o)} ${o.clientName} ${o.address} ${o.neighborhood||''} ${o.assignedMotoboyName||''}`.toLowerCase().includes(q);
    if(!matches)return false;
    if(orderFilter==='waiting')return !o.assignedMotoboyId&&!isRoute(o)&&!isReady(o);
    if(orderFilter==='preparing')return isPreparing(o);
    if(orderFilter==='ready')return isReady(o);
    if(orderFilter==='route')return isRoute(o);
    return true;
  });},[activeOrders,query,orderFilter]);

  const mapStops:Stop[]=useMemo(()=>activeOrders.filter(o=>typeof o.lat==='number'&&o.lat!==0&&typeof o.lng==='number'&&o.lng!==0).map((o,index)=>({id:o.id,codeNumber:o.codeNumber,orderIndex:index+1,name:o.clientName,title:`${displayCode(o)} - ${o.clientName}`,recipientName:o.clientName,phone:o.clientPhone,address:o.address,neighborhood:o.neighborhood,lat:o.lat,lng:o.lng,status:isRoute(o)?'in_transit':'pending',priority:'medium',valueToReceive:o.total,motoboyId:o.assignedMotoboyId||undefined,motoboyName:o.assignedMotoboyName||undefined} as Stop)),[activeOrders]);
  const activeDrivers=motoboys.filter(m=>m.status!=='offline');
  const returningCount=motoboys.filter(m=>m.status==='returning_to_store').length;
  const isAtStore=(m:Motoboy)=>distanceMeters(m.currentLat,m.currentLng,shift.storeLat,shift.storeLng)<=150;
  const monitoredDrivers=activeDrivers.filter(m=>m.status!=='available'&&!isAtStore(m));
  const freshGpsDrivers=monitoredDrivers.filter(m=>m.locationUpdatedAt&&Date.now()-m.locationUpdatedAt<600000);
  const staleGpsDrivers=monitoredDrivers.filter(m=>!m.locationUpdatedAt||Date.now()-m.locationUpdatedAt>=600000);

  const assign=(order:Order,motoboyId:string)=>{
    if(order.assignedMotoboyId)return;
    assignOrderRespectingLoad(order.id,motoboyId);
    setSelectedOrderId(null);
    setSelectedMotoboyId(null);
    triggerActionToast('Motoboy vinculado. Pedido movido para Preparando.');
  };
  const markReady=(order:Order)=>{
    onUpdateOrderStatus(order.id,'ready_at_counter');
    setOrderFilter('ready');
    setSelectedOrderId(null);
    triggerActionToast(`${displayCode(order)} pronto para retirada.`);
  };

  const filters:[OrderFilter,string,number][]=[['all','Todos',activeOrders.length],['waiting','Aguardando',counts.waiting],['preparing','Preparando',counts.preparing],['ready','Prontos',counts.ready],['route','Em rota',counts.route]];

  return <div className="space-y-3">
    {incomingBanner&&<div className="bg-emerald-950/70 border border-emerald-500/40 text-emerald-100 rounded-xl px-4 py-3"><p className="text-sm font-semibold">✓ {incomingBanner}</p><p className="text-[11px] text-emerald-300/80">Sincronizado automaticamente.</p></div>}
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3"><div><h2 className="text-xl text-white">Central de Despacho</h2><p className="text-xs text-slate-400">Mapa, pedidos e entregadores no mesmo lugar.</p></div><div className="flex items-center gap-2"><div className="relative min-w-[300px] hidden md:block"><Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar pedido, cliente ou endereço..." className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white outline-none"/></div><button onClick={onOpenNewOrderModal} className="bg-violet-600 text-white rounded-lg px-4 py-2 text-xs flex items-center gap-1.5"><Plus className="w-4 h-4"/> Novo pedido</button></div></div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-2"><div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center gap-2.5"><Wifi className="w-4 h-4 text-emerald-400"/><div><p className="text-xs text-slate-100">Cardápio Web conectado</p><p className="text-[10px] text-slate-500">Último pedido: {latestCardapioOrder?ageLabel(orderTimestamp(latestCardapioOrder)):'aguardando'}</p></div></div><div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center gap-2.5"><Radio className="w-4 h-4 text-blue-400"/><div><p className="text-xs text-slate-100">GPS dos motoboys</p><p className="text-[10px] text-slate-500">{monitoredDrivers.length?`${freshGpsDrivers.length} recente • ${staleGpsDrivers.length} sem atualização`:'Sem motoboy em rota'}</p></div></div><div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center gap-2.5">{staleGpsDrivers.length?<WifiOff className="w-4 h-4 text-amber-400"/>:<Wifi className="w-4 h-4 text-emerald-400"/>}<div><p className="text-xs text-slate-100">Saúde da operação</p><p className="text-[10px] text-slate-500">{staleGpsDrivers.length?'Há GPS desatualizado':'Sem alerta de localização'}</p></div></div></div>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2"><p className="text-[10px] text-slate-500">Aguardando</p><strong className="text-lg text-amber-300">{counts.waiting}</strong></div><div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2"><p className="text-[10px] text-slate-500">Preparando</p><strong className="text-lg text-rose-300">{counts.preparing}</strong></div><div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2"><p className="text-[10px] text-slate-500">Prontos</p><strong className="text-lg text-emerald-300">{counts.ready}</strong></div><div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2"><p className="text-[10px] text-slate-500">Em rota</p><strong className="text-lg text-blue-300">{counts.route}</strong></div></div>

    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_350px] gap-3 dispatch-map-shell">
      <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col dispatch-map-shell"><div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto"><div className="flex items-center gap-1.5">{filters.map(([id,label,count])=><button key={id} onClick={()=>{setOrderFilter(id);setSelectedOrderId(null);}} className={`whitespace-nowrap px-3 py-1.5 rounded-lg border text-[11px] ${orderFilter===id?'bg-violet-600 border-violet-500 text-white':'bg-slate-950 border-slate-800 text-slate-400'}`}>{label} ({count})</button>)}</div><button onClick={()=>setActiveTab('mapa')} className="whitespace-nowrap text-[11px] text-violet-400">Abrir mapa completo ↗</button></div><div className="p-3 flex-1 min-h-0"><div className="w-full rounded-xl overflow-hidden border border-slate-800 dispatch-map-canvas"><ReactiveRouteMap origin={{name:shift.storeName||'Loja',address:shift.storeAddress||'',lat:shift.storeLat||-26.9194,lng:shift.storeLng||-49.0661}} stops={mapStops} motoboysList={activeDrivers} selectedStopId={selectedOrderId} selectedMotoboyId={selectedMotoboyId} onSelectStop={(stop:Stop)=>{const id=stop.id||null;setSelectedOrderId(current=>current===id?null:id);setSideMode('orders');}} onSelectMotoboy={(id:string|null)=>{setSelectedMotoboyId(id);setSideMode('drivers');}}/></div></div></section>

      <aside className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col dispatch-side-panel"><div className="grid grid-cols-2 border-b border-slate-800"><button onClick={()=>setSideMode('orders')} className={`py-2.5 text-xs ${sideMode==='orders'?'bg-slate-800 text-white':'text-slate-500'}`}>Pedidos ({visibleOrders.length})</button><button onClick={()=>setSideMode('drivers')} className={`py-2.5 text-xs ${sideMode==='drivers'?'bg-slate-800 text-white':'text-slate-500'}`}>Motoboys ({activeDrivers.length})</button></div>
      {sideMode==='orders'?<div className="flex-1 overflow-y-auto p-2 space-y-2">{visibleOrders.length===0&&<div className="h-full flex flex-col items-center justify-center text-center p-6"><Package className="w-9 h-9 text-slate-600 mb-2"/><p className="text-sm text-slate-300">Nenhum pedido nesta etapa</p></div>}{visibleOrders.map(order=>{const selected=selectedOrderId===order.id;const assigned=Boolean(order.assignedMotoboyId);return <div key={order.id} className={`rounded-xl border p-3 ${selected?'bg-violet-950/30 border-violet-500':'bg-slate-950/60 border-slate-800'}`}><button className="w-full text-left" onClick={()=>setSelectedOrderId(current=>current===order.id?null:order.id)}><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><strong className="text-sm text-white">{displayCode(order)}</strong><span className={`text-[9px] px-1.5 py-0.5 rounded ${isReady(order)?'bg-emerald-500/15 text-emerald-300':isRoute(order)?'bg-blue-500/15 text-blue-300':isPreparing(order)?'bg-amber-500/15 text-amber-300':'bg-rose-500/15 text-rose-300'}`}>{orderStatusLabel(order)}</span></div><span className="text-xs text-white">{money(order.total)}</span></div><p className="text-xs text-slate-200 mt-2">{order.clientName}</p><p className="text-[10px] text-slate-500 mt-1 flex gap-1"><MapPin className="w-3 h-3 text-rose-400 shrink-0"/><span>{order.address}</span></p>{assigned&&<p className="text-[10px] text-violet-300 mt-2">🛵 {order.assignedMotoboyName||'Motoboy vinculado'}</p>}</button>{selected&&<div className="mt-3 pt-3 border-t border-slate-800 space-y-2">{!assigned&&!isRoute(order)&&!isReady(order)&&<select defaultValue="" onChange={e=>{if(e.target.value)assign(order,e.target.value);}} className="w-full bg-violet-600 text-white rounded-lg px-3 py-2.5 text-xs outline-none"><option value="" disabled>Vincular motoboy...</option>{motoboys.map(m=><option key={m.id} value={m.id} className="bg-slate-900">{m.name} — {driverStatusLabel(m)}</option>)}</select>}{assigned&&isPreparing(order)&&<button onClick={()=>markReady(order)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-3 py-2.5 text-xs flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4"/> Marcar pronto para retirada</button>}{isReady(order)&&<div className="w-full bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 rounded-lg px-3 py-2.5 text-xs text-center">✓ Aguardando retirada por {order.assignedMotoboyName||'motoboy'}</div>}<button onClick={()=>onSelectOrderForTracking(order)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[10px] text-slate-200">Ver rastreio e detalhes</button></div>}</div>;})}</div>:<div className="flex-1 overflow-y-auto p-2 space-y-2"><div className="flex justify-end"><button onClick={onOpenMotoboyModal} className="text-[10px] text-violet-400">Gerenciar entregadores</button></div>{motoboys.map(m=>{const load=orders.filter(o=>o.assignedMotoboyId===m.id&&!['delivered','cancelled'].includes(o.status)).length;return <button key={m.id} onClick={()=>setSelectedMotoboyId(selectedMotoboyId===m.id?null:m.id)} className="w-full text-left rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="flex items-center justify-between"><div><p className="text-xs text-white">{m.name}</p><p className="text-[10px] text-slate-400">{driverStatusLabel(m)} • {load} pedido(s)</p></div>{m.phone&&<Phone className="w-3.5 h-3.5 text-slate-500"/>}</div></button>;})}</div>}
      <div className="border-t border-slate-800 px-3 py-2 grid grid-cols-3 gap-2 text-center"><div><p className="text-[9px] text-slate-500">Disponíveis</p><strong className="text-xs text-emerald-300">{motoboysAvailable.length}</strong></div><div><p className="text-[9px] text-slate-500">Em rota</p><strong className="text-xs text-blue-300">{motoboys.filter(m=>m.status==='delivering').length}</strong></div><div><p className="text-[9px] text-slate-500">Voltando</p><strong className="text-xs text-amber-300">{returningCount}</strong></div></div></aside>
    </div>
  </div>;
};
export default OperationDispatchView;
