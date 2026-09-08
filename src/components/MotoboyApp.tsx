import React,{useEffect,useMemo,useRef,useState}from'react';
import{Motoboy,Order,StoreShift}from'../types';
import{RouteMap}from'./RouteMap';
import{saveMotoboyLocationToCloud}from'../lib/firebase';
import{ArrowDown,ArrowUp,CheckCircle2,Clock3,DollarSign,History,LogOut,MapPin,Navigation,Package,Phone,Route,ShoppingBag,X,Map,Bike}from'lucide-react';

interface P{motoboys:Motoboy[];orders:Order[];shift:StoreShift;onUpdateOrderStatus:(id:string,s:Order['status'])=>void;onSimulateArrival:(o:Order)=>void;onReorderMotoboyRoute?:(id:string,ids:string[])=>void;onConfirmArrivalAtStore?:(id:string)=>void;onUpdateMotoboyStatus?:(id:string,s:Motoboy['status'])=>void;initialMotoboyId?:string;isLockedToMotoboy?:boolean;onLogout?:()=>void}
type Tab='orders'|'route'|'history';
type NavRequest={from?:string;fullRoute:boolean;startWholeRoute?:boolean;startOrderId?:string}|null;

const money=(v=0)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const routeStatus=(o:Order)=>['picked_up','in_transit','dispatched'].includes(o.status);
const isFinalized=(o:Order)=>{
  const anyOrder=o as any;
  return o.status==='delivered'||o.status==='cancelled'||Boolean(o.deliveredTimestamp)||Boolean(o.deliveredAt)||Boolean(o.deliveredDate)||anyOrder.closedInCardapioWeb===true||Boolean(anyOrder.closedAt);
};
const isDelivered=(o:Order)=>{
  const anyOrder=o as any;
  return o.status==='delivered'||Boolean(o.deliveredTimestamp)||Boolean(o.deliveredAt)||Boolean(o.deliveredDate)||anyOrder.closedInCardapioWeb===true||Boolean(anyOrder.closedAt);
};

export const MotoboyApp:React.FC<P>=({motoboys,orders,shift,onUpdateOrderStatus,onSimulateArrival,onReorderMotoboyRoute,onConfirmArrivalAtStore,onUpdateMotoboyStatus,initialMotoboyId,isLockedToMotoboy=false,onLogout})=>{
  const[tab,setTab]=useState<Tab>('orders');
  const[gps,setGps]=useState<{lat:number;lng:number}|null>(null);
  const[arrived,setArrived]=useState<Record<string,boolean>>({});
  const[orderIds,setOrderIds]=useState<string[]>([]);
  const[showMap,setShowMap]=useState(false);
  const[navRequest,setNavRequest]=useState<NavRequest>(null);
  const wake=useRef<any>(null);

  const driver=useMemo(()=>initialMotoboyId?motoboys.find(m=>m.id===initialMotoboyId):isLockedToMotoboy?undefined:motoboys[0],[motoboys,initialMotoboyId,isLockedToMotoboy]);
  const mine=(o:Order)=>!!driver&&o.assignedMotoboyId===driver.id;

  // Finalized orders must never return to the active courier workload even if an
  // external sync later sends an older transient status such as dispatched.
  const assigned=useMemo(()=>orders.filter(o=>mine(o)&&!isFinalized(o)).sort((a,b)=>(a.routeSequence||999)-(b.routeSequence||999)),[orders,driver?.id]);
  const preparing=assigned.filter(o=>['pending','preparing'].includes(o.status));
  const ready=assigned.filter(o=>o.status==='ready_at_counter');
  const raw=assigned.filter(routeStatus);

  useEffect(()=>{
    const ids=raw.map(o=>o.id);
    setOrderIds(prev=>[...prev.filter(id=>ids.includes(id)),...ids.filter(id=>!prev.includes(id))]);
  },[raw.map(o=>o.id).join('|')]);

  const route=useMemo(()=>{const map=new globalThis.Map(raw.map(o=>[o.id,o]));return[...orderIds.map(id=>map.get(id)).filter(Boolean)as Order[],...raw.filter(o=>!orderIds.includes(o.id))]},[raw,orderIds]);
  const activeRun=driver?.status==='delivering'&&route.length>0;
  const inQueue=driver?.status==='available';
  const returning=driver?.status==='returning_to_store';
  const current=route.find(o=>['in_transit','dispatched'].includes(o.status))||route[0];
  const completed=orders.filter(o=>mine(o)&&isDelivered(o));
  const earned=completed.reduce((s,o)=>s+(o.deliveryFee||0),0);

  useEffect(()=>{if(!driver||!navigator.geolocation)return;const ok=(p:GeolocationPosition)=>{const lat=+p.coords.latitude.toFixed(6),lng=+p.coords.longitude.toFixed(6);setGps({lat,lng});saveMotoboyLocationToCloud(driver.id,lat,lng)};navigator.geolocation.getCurrentPosition(ok,()=>{},{enableHighAccuracy:true});const id=navigator.geolocation.watchPosition(ok,()=>{},{enableHighAccuracy:true,maximumAge:4000});return()=>navigator.geolocation.clearWatch(id)},[driver?.id]);
  useEffect(()=>{(async()=>{try{if('wakeLock'in navigator)wake.current=await(navigator as any).wakeLock.request('screen')}catch{}})();return()=>{try{wake.current?.release?.()}catch{}}},[]);

  const persist=(ids:string[])=>{setOrderIds(ids);if(driver)onReorderMotoboyRoute?.(driver.id,ids)};
  const move=(i:number,d:-1|1)=>{if(activeRun)return;const a=route.map(o=>o.id),j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];persist(a)};
  const addr=(o:Order)=>o.lat&&o.lng?`${o.lat},${o.lng}`:o.address;
  const remaining=(from?:string)=>{if(!from)return route;const i=route.findIndex(o=>o.id===from);return i>=0?route.slice(i):route};
  const beginRequestedNavigation=()=>{if(!navRequest)return;if(navRequest.startWholeRoute){route.forEach((o,i)=>onUpdateOrderStatus(o.id,i===0?'in_transit':'picked_up'));if(driver)onUpdateMotoboyStatus?.(driver.id,'delivering')}else if(navRequest.startOrderId){onUpdateOrderStatus(navRequest.startOrderId,'in_transit')}};
  const openGoogle=()=>{if(!navRequest)return;const r=navRequest.fullRoute?remaining(navRequest.from):remaining(navRequest.from).slice(0,1);if(!r.length)return;beginRequestedNavigation();const destination=encodeURIComponent(addr(r[r.length-1])),wp=r.slice(0,-1).map(addr).join('|'),origin=gps?`&origin=${encodeURIComponent(`${gps.lat},${gps.lng}`)}`:'';const url=`https://www.google.com/maps/dir/?api=1${origin}&destination=${destination}${wp?`&waypoints=${encodeURIComponent(wp)}`:''}&travelmode=driving`;setNavRequest(null);window.location.href=url};
  const openWaze=()=>{if(!navRequest)return;const target=remaining(navRequest.from)[0];if(!target)return;beginRequestedNavigation();const dest=target.lat&&target.lng?`ll=${target.lat},${target.lng}`:`q=${encodeURIComponent(target.address)}`;setNavRequest(null);window.location.href=`https://waze.com/ul?${dest}&navigate=yes`};
  const chooseNav=(req:NonNullable<NavRequest>)=>setNavRequest(req);

  const pickupAll=()=>{ready.forEach(o=>onUpdateOrderStatus(o.id,'picked_up'));setOrderIds(prev=>[...prev,...ready.map(o=>o.id).filter(id=>!prev.includes(id))]);setTab('route')};
  const startRoute=()=>route.length&&chooseNav({fullRoute:true,startWholeRoute:true});
  const startNext=(o:Order)=>chooseNav({from:o.id,fullRoute:true,startOrderId:o.id});
  const arrive=(o:Order)=>{setArrived(a=>({...a,[o.id]:true}));onSimulateArrival(o)};
  const finish=(o:Order)=>{onUpdateOrderStatus(o.id,'delivered');setArrived(a=>{const n={...a};delete n[o.id];return n})};
  const markReturning=()=>{if(driver)onUpdateMotoboyStatus?.(driver.id,'returning_to_store');setTab('orders')};
  const enterQueue=()=>{if(driver){onConfirmArrivalAtStore?.(driver.id);onUpdateMotoboyStatus?.(driver.id,'available')}setTab('orders')};

  if(!driver)return <div className="bg-white rounded-2xl p-8 text-center"><h3>Entregador não encontrado</h3><button onClick={onLogout} className="mt-4 bg-slate-900 text-white p-3 rounded-xl">Voltar</button></div>;

  const routeStops=route.map((o,i)=>({id:o.id,orderIndex:i+1,title:`#${o.codeNumber}`,address:o.address,neighborhood:o.neighborhood,lat:o.lat,lng:o.lng,status:o.status==='in_transit'?'in_transit':'pending',priority:'high' as const,recipientName:o.clientName}));
  const statusText=activeRun?'Em rota':returning?'Retornando para a loja':inQueue?(ready.length?'Pedidos prontos para retirada':preparing.length?'Aguardando cozinha':'Na fila'):'Fora da fila';

  return <div className="w-full max-w-md mx-auto bg-slate-100 text-slate-900 min-h-[720px] rounded-2xl overflow-hidden">
    <header className="bg-slate-950 text-white p-4 flex justify-between"><div><b>{driver.name}</b><p className="text-[11px] text-slate-400">{statusText}</p></div><button onClick={onLogout}><LogOut className="w-4 h-4"/></button></header>
    <div className="grid grid-cols-3 gap-2 p-3 bg-white"><div className="text-center"><ShoppingBag className="w-4 h-4 mx-auto"/><b>{route.length}</b><p className="text-[9px]">na rota</p></div><div className="text-center"><Package className="w-4 h-4 mx-auto"/><b>{completed.length}</b><p className="text-[9px]">entregues</p></div><div className="text-center"><DollarSign className="w-4 h-4 mx-auto"/><b>{money(earned)}</b><p className="text-[9px]">hoje</p></div></div>
    <nav className="grid grid-cols-3 gap-1 p-2">{([['orders',`Pedidos (${inQueue?preparing.length+ready.length:0})`],['route',`Minha rota (${route.length})`],['history','Histórico']]as[Tab,string][]).map(([id,l])=><button key={id} onClick={()=>setTab(id)} className={`p-2 rounded-lg text-xs ${tab===id?'bg-slate-950 text-white':'bg-white'}`}>{l}</button>)}</nav>
    <main className="p-3 space-y-3">
      {tab==='orders'&&<>
        {!inQueue&&returning&&<section className="bg-white rounded-xl border p-5 text-center"><Bike className="w-9 h-9 mx-auto text-violet-600"/><h3 className="font-semibold mt-3">Retornando para a loja</h3><p className="text-xs text-slate-500 mt-1">Enquanto estiver retornando, novos pedidos reservados não ficam poluindo sua tela.</p><button onClick={enterQueue} className="w-full mt-4 py-3.5 bg-violet-600 text-white rounded-xl font-medium">Entrar na fila</button></section>}
        {!inQueue&&!returning&&driver.status==='delivering'&&route.length===0&&<section className="bg-white rounded-xl border p-5 text-center"><CheckCircle2 className="w-9 h-9 mx-auto text-emerald-600"/><h3 className="font-semibold mt-3">Rota concluída</h3><p className="text-xs text-slate-500 mt-1">Todas as entregas foram finalizadas.</p><button onClick={markReturning} className="w-full mt-4 py-3.5 bg-slate-950 text-white rounded-xl font-medium"><Bike className="w-4 h-4 inline mr-2"/>Estou retornando</button></section>}
        {inQueue&&<><section className="bg-white rounded-xl border"><div className="p-3 border-b"><b className="text-sm">Preparando</b><p className="text-[10px] text-slate-500">Já reservados para você</p></div><div className="p-2 space-y-2">{preparing.length?preparing.map(o=><div key={o.id} className="p-3 bg-amber-50 rounded-lg"><b>#{o.codeNumber} • {o.clientName}</b><p className="text-[10px] text-slate-500">{o.neighborhood||o.address}</p><p className="text-[10px] text-amber-700 mt-2"><Clock3 className="w-3 h-3 inline"/> Aguardando a loja marcar como pronto</p></div>):<p className="text-xs text-center text-slate-400 p-5">Nenhum em preparo.</p>}</div></section><section className="bg-white rounded-xl border"><div className="p-3 border-b"><b className="text-sm">Prontos para retirada ({ready.length})</b><p className="text-[10px] text-slate-500">Confira a carga antes de sair</p></div><div className="p-2 space-y-2">{ready.map(o=><div key={o.id} className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg"><b>#{o.codeNumber} • {o.clientName}</b><p className="text-[10px] text-slate-500">{o.address}</p></div>)}{ready.length>0&&<button onClick={pickupAll} className="w-full py-3.5 bg-amber-400 text-slate-950 rounded-lg font-medium"><CheckCircle2 className="w-4 h-4 inline mr-2"/>Confirmar retirada dos {ready.length} pedidos</button>}</div></section></>}
      </>}

      {tab==='route'&&(route.length?<><section className="bg-slate-950 text-white rounded-xl p-3"><div className="flex justify-between"><div><b>{activeRun?'ROTA EM ANDAMENTO':'PRÓXIMA ROTA'} — {driver.name}</b><p className="text-[10px] text-slate-400">{activeRun?'Sequência bloqueada durante a rota':'Defina 1ª, 2ª, 3ª parada...'}</p></div><Route className="w-5 h-5"/></div><div className="space-y-2 mt-3">{route.map((o,i)=><div key={o.id} className={`border rounded-lg p-2 flex gap-2 items-center ${current?.id===o.id?'bg-violet-950/30 border-violet-500':'bg-slate-900 border-slate-800'}`}><span className="w-7 h-7 grid place-items-center bg-slate-800 rounded-full text-xs">{i+1}</span><div className="flex-1 min-w-0"><p className="text-xs">#{o.codeNumber} → {o.neighborhood||o.address}</p></div>{!activeRun&&<><button disabled={!i} onClick={()=>move(i,-1)}><ArrowUp className="w-4 h-4"/></button><button disabled={i===route.length-1} onClick={()=>move(i,1)}><ArrowDown className="w-4 h-4"/></button></>}</div>)}</div>{!activeRun?<button onClick={startRoute} className="w-full mt-3 py-3.5 bg-violet-600 rounded-lg"><Navigation className="w-4 h-4 inline mr-2"/>Iniciar rota e navegar</button>:<button onClick={()=>chooseNav({from:current?.id,fullRoute:true})} className="w-full mt-3 py-3 bg-sky-600 rounded-lg"><Navigation className="w-4 h-4 inline mr-2"/>Abrir navegação</button>}<button onClick={()=>setShowMap(true)} className="w-full mt-2 py-2.5 border border-slate-700 bg-slate-900 hover:bg-slate-800 rounded-lg text-xs text-slate-300"><Map className="w-4 h-4 inline mr-2"/>Ver rota no mapa</button></section>
        {current&&<article className="bg-white border border-violet-300 rounded-xl overflow-hidden"><div className="p-3 flex justify-between bg-slate-950 text-white"><div><b className="text-xs">ENTREGA ATUAL</b><p className="text-[10px] text-slate-400">Próxima parada</p></div><b>#{current.codeNumber}</b></div><div className="p-3"><p className="text-[10px] text-slate-500 uppercase">{current.neighborhood}</p><h3 className="text-lg font-semibold mt-1">{current.street||current.address}</h3><p className="text-xs text-slate-500 mt-1">{current.clientName}</p>{current.status==='picked_up'&&activeRun?<button onClick={()=>startNext(current)} className="w-full mt-3 py-3 bg-violet-600 text-white rounded-lg"><Navigation className="w-4 h-4 inline mr-2"/>Iniciar próxima parada</button>:!arrived[current.id]?<button onClick={()=>arrive(current)} className="w-full mt-3 py-3 bg-slate-950 text-white rounded-lg"><MapPin className="w-4 h-4 inline mr-1"/>Confirmar chegada</button>:<button onClick={()=>finish(current)} className="w-full mt-3 py-3 bg-emerald-600 text-white rounded-lg"><CheckCircle2 className="w-4 h-4 inline mr-1"/>Confirmar entrega</button>}<div className="grid grid-cols-2 gap-2 mt-2"><button onClick={()=>chooseNav({from:current.id,fullRoute:false})} className="py-2.5 bg-sky-600 text-white rounded-lg text-sm"><Navigation className="w-4 h-4 inline mr-1"/>Navegar</button>{current.clientPhone?<a href={`tel:${current.clientPhone.replace(/\D/g,'')}`} className="py-2.5 bg-slate-800 text-white rounded-lg text-center text-sm"><Phone className="w-4 h-4 inline mr-1"/>Ligar</a>:<div className="py-2.5 bg-slate-200 rounded-lg text-center text-sm text-slate-500">Sem telefone</div>}</div></div></article>}
        {route.length>1&&<section className="bg-white border rounded-xl overflow-hidden"><div className="px-3 py-2.5 border-b"><b className="text-sm">Próximas paradas</b></div><div className="divide-y">{route.slice(1).map((o,i)=><div key={o.id} className="p-3 flex items-center gap-3"><span className="w-7 h-7 rounded-full bg-slate-100 grid place-items-center text-xs text-slate-500">{i+2}</span><div className="min-w-0"><p className="text-xs font-medium">#{o.codeNumber} • {o.clientName}</p><p className="text-[10px] text-slate-500 truncate">{o.neighborhood||o.address}</p></div></div>)}</div></section>}</>:<div className="bg-white rounded-xl p-8 text-center"><Route className="mx-auto"/><p className="mt-2">Sua rota está vazia.</p>{driver.status==='delivering'&&<button onClick={markReturning} className="w-full mt-4 py-3 bg-slate-950 text-white rounded-xl">Estou retornando</button>}{returning&&<button onClick={enterQueue} className="w-full mt-4 py-3 bg-violet-600 text-white rounded-xl">Entrar na fila</button>}</div>)}

      {tab==='history'&&<section className="bg-white rounded-xl p-3"><p className="text-sm"><History className="w-4 h-4 inline"/> Entregas de hoje</p>{completed.map(o=><div key={o.id} className="border-t mt-2 pt-2 text-xs">#{o.codeNumber} • {o.clientName}</div>)}</section>}
    </main>

    {showMap&&<div className="fixed inset-0 z-[100] bg-black/80 p-3 flex items-center justify-center"><div className="w-full max-w-md h-[78vh] bg-white rounded-2xl overflow-hidden flex flex-col"><div className="p-3 bg-slate-950 text-white flex justify-between items-center"><div><b className="text-sm">Mapa da rota</b><p className="text-[10px] text-slate-400">{route.length} parada(s) na sequência definida</p></div><button onClick={()=>setShowMap(false)} className="w-8 h-8 grid place-items-center bg-slate-900 rounded-lg"><X className="w-4 h-4"/></button></div><div className="flex-1 min-h-0"><RouteMap origin={{name:shift.storeName||'Loja',address:shift.storeAddress,lat:shift.storeLat,lng:shift.storeLng}} motoboyName={driver.name} showMotoboyMarker motoboyLat={gps?.lat||driver.currentLat} motoboyLng={gps?.lng||driver.currentLng} stops={routeStops}/></div><div className="p-3 border-t"><button onClick={()=>{setShowMap(false);chooseNav({from:current?.id,fullRoute:true})}} className="w-full py-3 bg-violet-600 text-white rounded-lg"><Navigation className="w-4 h-4 inline mr-2"/>Abrir navegação</button></div></div></div>}

    {navRequest&&<div className="fixed inset-0 z-[120] bg-black/70 p-4 flex items-end sm:items-center justify-center"><div className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-2xl"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Como quer navegar?</h3><p className="text-xs text-slate-500 mt-1">A navegação abre fora do Rota Fácil. Depois é só voltar ao app para confirmar chegada e entrega.</p></div><button onClick={()=>setNavRequest(null)} className="w-8 h-8 grid place-items-center rounded-lg bg-slate-100"><X className="w-4 h-4"/></button></div><div className="space-y-2 mt-4"><button onClick={openGoogle} className="w-full py-3.5 rounded-xl bg-[#4285F4] text-white font-medium">Google Maps {navRequest.fullRoute?'• rota completa':'• próxima parada'}</button><button onClick={openWaze} className="w-full py-3.5 rounded-xl bg-[#33CCFF] text-slate-950 font-medium">Waze • próxima parada</button></div><p className="text-[10px] text-slate-400 text-center mt-3">No Waze, a próxima parada abre individualmente; ao concluir, o app libera a seguinte.</p></div></div>}
  </div>
};
export default MotoboyApp;
