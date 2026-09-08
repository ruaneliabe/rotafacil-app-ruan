import React, { useMemo, useState } from 'react';
import { Bike, ChevronRight, MapPin, Package, Phone, Plus, Printer, Search, UserRound } from 'lucide-react';
import { Order, Motoboy, StoreShift } from '../types';
import { RouteMap } from './RouteMap';

interface OperationDispatchViewProps {
  orders: Order[]; motoboys: Motoboy[]; shift: StoreShift; activeOrders: Order[]; unassignedOrders: Order[];
  motoboysAvailable: Motoboy[]; selectedOrderIds: string[]; setSelectedOrderIds: (ids: string[]) => void;
  selectedMotoboyId: string | null; setSelectedMotoboyId: (id: string | null) => void;
  onAssignOrderToMotoboy: (orderId: string, motoboyId: string) => void;
  onAssignBatchToMotoboy?: (orderIds: string[], motoboyId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onUpdateMotoboyStatus?: (motoboyId: string, status: Motoboy['status']) => void;
  onOpenNewOrderModal: () => void; onOpenMotoboyModal: () => void; onSelectOrderForTracking: (order: Order) => void;
  setIsRouteModalOpen: (open: boolean) => void; setTicketOrder: (order: Order) => void; setIsTicketOpen: (open: boolean) => void;
  handleCallCounter: (motoboyId: string, motoboyName: string) => void; triggerActionToast: (msg: string) => void;
  setActiveTab: (tab: any) => void; getMotoboyLoad: (motoboyId: string) => number;
  assignOrderRespectingLoad: (orderId: string, motoboyId: string) => void;
}

const money = (v = 0) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const displayCode = (o: Order) => o.displayCode || `#${o.codeNumber}`;

export const OperationDispatchView: React.FC<OperationDispatchViewProps> = (props) => {
  const { orders, motoboys, shift, activeOrders, unassignedOrders, motoboysAvailable, onOpenNewOrderModal,
    onOpenMotoboyModal, onSelectOrderForTracking, setTicketOrder, setIsTicketOpen, setActiveTab,
    assignOrderRespectingLoad, onUpdateOrderStatus, onUpdateMotoboyStatus, triggerActionToast } = props;
  const [selectedId, setSelectedId] = useState<string | null>(unassignedOrders[0]?.id || activeOrders[0]?.id || null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'ready' | 'route'>('all');

  const filtered = useMemo(() => activeOrders.filter((o) => {
    const q = query.trim().toLowerCase();
    const matchesQ = !q || `${displayCode(o)} ${o.clientName} ${o.address} ${o.neighborhood || ''}`.toLowerCase().includes(q);
    const matchesFilter = filter === 'all' || (filter === 'new' && ['pending','preparing'].includes(o.status)) ||
      (filter === 'ready' && ['ready_at_counter','picked_up'].includes(o.status)) || (filter === 'route' && o.status === 'in_transit');
    return matchesQ && matchesFilter;
  }), [activeOrders, query, filter]);

  const selected = activeOrders.find((o) => o.id === selectedId) || filtered[0] || null;
  const statusDot = (m: Motoboy) => m.status === 'available' ? 'bg-emerald-400' : m.status === 'delivering' ? 'bg-blue-400' : m.status === 'returning_to_store' ? 'bg-amber-400' : 'bg-slate-500';
  const statusText = (m: Motoboy) => m.status === 'available' ? 'Disponível na loja' : m.status === 'delivering' ? 'Em rota' : m.status === 'returning_to_store' ? 'Voltando' : m.status === 'busy' ? 'Pausado' : 'Offline';

  return <div className="space-y-3">
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-black text-white">Pedidos</h2>
        <p className="text-xs text-slate-400">Acompanhe e despache os pedidos em tempo real.</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative min-w-[280px] hidden md:block">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar pedido, cliente ou endereço..." className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-violet-500" />
        </div>
        <button onClick={onOpenNewOrderModal} className="bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2 text-xs font-black flex items-center gap-1.5"><Plus className="w-4 h-4"/> Novo pedido</button>
      </div>
    </div>

    <div className="flex gap-2 flex-wrap">
      {([
        ['all','Todos',activeOrders.length], ['new','Novos',activeOrders.filter(o=>['pending','preparing'].includes(o.status)).length],
        ['ready','Prontos',activeOrders.filter(o=>['ready_at_counter','picked_up'].includes(o.status)).length], ['route','Em rota',activeOrders.filter(o=>o.status==='in_transit').length]
      ] as const).map(([id,label,count]) => <button key={id} onClick={()=>setFilter(id)} className={`px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 ${filter===id?'bg-violet-600 border-violet-500 text-white':'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'}`}>{label}<span className="bg-black/25 px-1.5 py-0.5 rounded-md">{count}</span></button>)}
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
      <section className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden min-h-[610px]">
        <div className="px-3 py-3 border-b border-slate-800 flex items-center justify-between"><strong className="text-sm">Pedidos ({filtered.length})</strong><span className="text-[10px] text-slate-500">Mais recentes</span></div>
        <div className="p-2 space-y-2 max-h-[650px] overflow-y-auto">
          {filtered.length === 0 && <div className="py-20 text-center"><Package className="w-9 h-9 mx-auto text-slate-600 mb-3"/><p className="text-sm font-bold text-slate-300">Nenhum pedido</p><p className="text-xs text-slate-500 mt-1">Novos pedidos aparecerão aqui.</p></div>}
          {filtered.map((o) => <button key={o.id} onClick={()=>setSelectedId(o.id)} className={`w-full text-left rounded-xl border p-3 transition ${selected?.id===o.id?'bg-violet-950/35 border-violet-500 ring-1 ring-violet-500/20':'bg-slate-950/55 border-slate-800 hover:border-slate-700'}`}>
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><strong className="text-base text-white">{displayCode(o)}</strong><span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full px-2 py-0.5">{o.status==='in_transit'?'Em rota':'Novo'}</span></div><span className="text-[10px] text-slate-400">{new Date(o.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span></div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-200"><UserRound className="w-3.5 h-3.5"/>{o.clientName}</div>
            <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-400"><MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0"/><span className="line-clamp-2">{o.address}{o.neighborhood ? ` - ${o.neighborhood}`:''}</span></div>
            <div className="mt-2 flex items-center justify-between"><span className="text-[10px] text-slate-500">{o.channel==='cardapio_web'?'Recebido via Cardápio Web':'Pedido manual'}</span><strong className="text-sm text-white">{money(o.total)}</strong></div>
          </button>)}
        </div>
      </section>

      <section className="xl:col-span-6 bg-slate-900 border border-slate-800 rounded-xl min-h-[610px] overflow-hidden">
        {!selected ? <div className="h-[610px] flex flex-col items-center justify-center text-center"><Package className="w-12 h-12 text-slate-600 mb-3"/><strong className="text-slate-300">Nenhum pedido selecionado</strong><span className="text-xs text-slate-500 mt-1">Selecione um pedido para ver os detalhes.</span></div> : <>
          <div className="p-4 border-b border-slate-800 flex items-center justify-between"><div><div className="flex items-center gap-2"><h3 className="text-lg font-black">Pedido {displayCode(selected)}</h3><span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-black">{selected.status==='in_transit'?'EM ROTA':'NOVO'}</span></div><p className="text-[11px] text-slate-500 mt-1">Recebido {selected.channel==='cardapio_web'?'via Cardápio Web':'manualmente'}</p></div><button onClick={()=>{setTicketOrder(selected);setIsTicketOpen(true)}} className="border border-slate-700 bg-slate-950 rounded-lg p-2 text-slate-300 hover:text-white"><Printer className="w-4 h-4"/></button></div>
          <div className="p-4 space-y-4">
            <div><p className="text-xs font-black text-white mb-2">Cliente</p><div className="space-y-1.5 text-xs text-slate-300"><p className="font-bold text-white">{selected.clientName}</p>{selected.clientPhone && <p className="flex gap-2 items-center"><Phone className="w-3.5 h-3.5"/>{selected.clientPhone}</p>}<p className="flex gap-2 items-start"><MapPin className="w-3.5 h-3.5 text-violet-400 shrink-0"/>{selected.address}{selected.neighborhood ? ` - ${selected.neighborhood}`:''}</p>{selected.notes && <p className="text-slate-400">💬 {selected.notes}</p>}</div></div>
            <div className="border-t border-slate-800 pt-4"><p className="text-xs font-black mb-2">Itens do pedido ({selected.items?.length || 0})</p><div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">{selected.items?.length ? selected.items.map((it,i)=><div key={i} className="px-3 py-2 flex justify-between text-xs"><span>{it.quantity}x {it.name}</span><span className="text-slate-400">{it.price ? money(it.price * it.quantity):''}</span></div>):<div className="p-3 text-xs text-slate-500">Itens não informados pela integração.</div>}</div></div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3"><div className="flex justify-between text-xs text-slate-400"><span>Total</span><strong className="text-lg text-violet-400">{money(selected.total)}</strong></div><div className="mt-2 text-xs text-slate-400">Pagamento: <span className="text-slate-200 font-bold">{selected.paymentMethod || 'Não informado'}</span></div></div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
              <select defaultValue="" onChange={(e)=>{if(e.target.value) assignOrderRespectingLoad(selected.id,e.target.value)}} className="bg-violet-600 hover:bg-violet-500 text-white font-black rounded-lg px-4 py-3 text-sm outline-none cursor-pointer"><option value="" disabled>🛵 Despachar pedido...</option>{motoboys.map(m=><option className="bg-slate-900" key={m.id} value={m.id}>{m.name} — {statusText(m)}</option>)}</select>
              <button onClick={()=>onSelectOrderForTracking(selected)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-4 py-3 text-xs font-bold">Ver rastreio</button>
            </div>
          </div>
        </>}
      </section>

      <aside className="xl:col-span-3 space-y-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800"><strong className="text-sm flex gap-2 items-center"><Bike className="w-4 h-4 text-emerald-400"/>Entregadores ({motoboys.length})</strong><button onClick={onOpenMotoboyModal} className="text-[10px] border border-slate-700 rounded-lg px-2 py-1 text-slate-300">Gerenciar</button></div>
          <div className="divide-y divide-slate-800">{motoboys.length===0?<div className="py-8 text-center text-xs text-slate-500">Nenhum entregador cadastrado.</div>:motoboys.slice(0,5).map(m=>{const load=orders.filter(o=>o.assignedMotoboyId===m.id && !['delivered','cancelled','failed'].includes(o.status)).length;return <div key={m.id} className="py-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2 min-w-0"><div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-black text-slate-300">{m.name.charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="text-xs font-black truncate">{m.name}</p><p className="text-[10px] flex items-center gap-1 text-slate-400"><span className={`w-2 h-2 rounded-full ${statusDot(m)}`}/>{statusText(m)}</p><p className="text-[10px] text-slate-500 mt-0.5">{load} {load===1?'entrega':'entregas'} ativa(s)</p></div></div>{m.phone&&<a href={`tel:${m.phone}`} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"><Phone className="w-3.5 h-3.5"/></a>}</div>})}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between pb-2"><strong className="text-xs flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-emerald-400"/>Mapa de Entregas</strong><button onClick={()=>setActiveTab('mapa')} className="text-[10px] text-violet-400 font-bold">Ampliar mapa ↗</button></div>
          <div className="h-[300px] rounded-lg overflow-hidden border border-slate-800"><RouteMap origin={{lat:(shift as any)?.storeLat || -26.9194,lng:(shift as any)?.storeLng || -49.0661,title:(shift as any)?.storeName || 'Loja'}} motoboysList={motoboys} stops={activeOrders.filter(o=>typeof o.lat==='number'&&o.lat!==0&&typeof o.lng==='number'&&o.lng!==0).map((o,i)=>({id:o.id,codeNumber:o.codeNumber,orderIndex:i+1,title:`${displayCode(o)} - ${o.clientName}`,address:o.address,neighborhood:o.neighborhood,lat:o.lat,lng:o.lng,status:o.status==='in_transit'?'in_transit':'pending',priority:'medium',recipientName:o.clientName,phone:o.clientPhone,valueToReceive:o.total,motoboyId:o.assignedMotoboyId||undefined,motoboyName:o.assignedMotoboyName||undefined}))}/></div>
          <div className="pt-2 flex items-center justify-between text-[10px] text-slate-500"><span>{motoboys.filter(m=>m.status!=='offline').length} motoboys ativos</span><span className="text-emerald-400">● Atualizado agora</span></div>
        </div>
      </aside>
    </div>
  </div>;
};

export default OperationDispatchView;
