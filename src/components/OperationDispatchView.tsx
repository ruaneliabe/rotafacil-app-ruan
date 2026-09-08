import React, { useMemo, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  Navigation,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { Motoboy, Order, Stop, StoreShift } from '../types';
import ReactiveRouteMap from './ReactiveRouteMap';

interface P {
  orders: Order[];
  motoboys: Motoboy[];
  shift: StoreShift;
  activeOrders: Order[];
  unassignedOrders: Order[];
  motoboysAvailable: Motoboy[];
  selectedOrderIds: string[];
  setSelectedOrderIds: (ids: string[]) => void;
  selectedMotoboyId: string | null;
  setSelectedMotoboyId: (id: string | null) => void;
  onAssignOrderToMotoboy: (orderId: string, motoboyId: string) => void;
  onAssignBatchToMotoboy?: (orderIds: string[], motoboyId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onUpdateMotoboyStatus?: (motoboyId: string, status: Motoboy['status']) => void;
  onOpenNewOrderModal: () => void;
  onOpenMotoboyModal: () => void;
  onSelectOrderForTracking: (order: Order) => void;
  setIsRouteModalOpen: (open: boolean) => void;
  setTicketOrder: (order: Order) => void;
  setIsTicketOpen: (open: boolean) => void;
  handleCallCounter: (motoboyId: string, motoboyName: string) => void;
  triggerActionToast: (msg: string) => void;
  setActiveTab: (tab: any) => void;
  getMotoboyLoad: (motoboyId: string) => number;
  assignOrderRespectingLoad: (orderId: string, motoboyId: string) => void;
}

type Stage = 'waiting' | 'preparing' | 'ready' | 'route';
type MapMode = 'all' | 'orders' | 'drivers';
type MapOrderFilter = 'all' | Stage;
type MapDriverFilter = 'all' | 'available' | 'delivering' | 'returning_to_store';

const money = (value = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const code = (order: Order) => order.displayCode || `#${order.codeNumber}`;
const route = (order: Order) => ['picked_up', 'in_transit', 'dispatched'].includes(order.status);
const stage = (order: Order): Stage =>
  route(order) ? 'route' : order.status === 'ready_at_counter' ? 'ready' : order.assignedMotoboyId ? 'preparing' : 'waiting';
const stamp = (order: Order) => order.createdTimestamp || Date.now();
const mins = (order: Order) => Math.max(0, Math.floor((Date.now() - stamp(order)) / 60000));
const readyMins = (order: Order) =>
  Math.max(0, Math.floor((Date.now() - ((order as any).readyAt || stamp(order))) / 60000));
const driverLabel = (m?: Motoboy) =>
  !m ? 'Indisponível' : m.status === 'available' ? 'Disponível' : m.status === 'delivering' ? 'Em entrega' : m.status === 'returning_to_store' ? 'Voltando' : m.status === 'offline' ? 'Offline' : 'Ocupado';

const distanceKm = (lat1?: number, lng1?: number, lat2?: number, lng2?: number) => {
  if (![lat1, lng1, lat2, lng2].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2! - lat1!);
  const dLng = toRad(lng2! - lng1!);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1!)) * Math.cos(toRad(lat2!)) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const returnEta = (m: Motoboy, shift: StoreShift) => {
  if (m.status === 'available') return 'na loja / disponível';
  if (m.status === 'delivering') return 'após finalizar a rota';
  if (m.status !== 'returning_to_store') return 'sem previsão';
  const km = distanceKm(m.currentLat, m.currentLng, shift.storeLat, shift.storeLng);
  if (km == null) return '~5–10 min';
  const minutes = Math.max(2, Math.round((km / 25) * 60));
  return `~${minutes} min (${km.toFixed(1)} km)`;
};

export const OperationDispatchView: React.FC<P> = (p) => {
  const {
    orders,
    motoboys,
    shift,
    activeOrders,
    onOpenNewOrderModal,
    onSelectOrderForTracking,
    onUpdateOrderStatus,
    assignOrderRespectingLoad,
    handleCallCounter,
    triggerActionToast,
    setActiveTab,
  } = p;

  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [batchDriver, setBatchDriver] = useState('');
  const [manage, setManage] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>('all');
  const [mapOrderFilter, setMapOrderFilter] = useState<MapOrderFilter>('all');
  const [mapDriverFilter, setMapDriverFilter] = useState<MapDriverFilter>('all');
  const [focusDriverId, setFocusDriverId] = useState<string | null>(null);

  const filtered = useMemo(
    () => activeOrders.filter((o) => !q || `${code(o)} ${o.clientName} ${o.address} ${o.neighborhood || ''}`.toLowerCase().includes(q.toLowerCase())),
    [activeOrders, q]
  );

  const g = useMemo(
    () => ({
      waiting: filtered.filter((o) => stage(o) === 'waiting').sort((a, b) => stamp(a) - stamp(b)),
      preparing: filtered.filter((o) => stage(o) === 'preparing'),
      ready: filtered.filter((o) => stage(o) === 'ready').sort((a, b) => readyMins(b) - readyMins(a)),
      route: filtered.filter((o) => stage(o) === 'route'),
    }),
    [filtered]
  );

  const returning = motoboys.filter((m) => m.status === 'returning_to_store');
  const oldW = g.waiting.filter((o) => mins(o) >= 15);
  const oldR = g.ready.filter((o) => readyMins(o) >= 10);

  const suggestions = useMemo(() => {
    const x = new Map<string, Order[]>();
    g.waiting.forEach((o) => {
      const k = o.neighborhood || 'Outros';
      x.set(k, [...(x.get(k) || []), o]);
    });
    return [...x.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 2);
  }, [g.waiting]);

  const mapOrders = useMemo(() => {
    return activeOrders.filter((o) => {
      if (['delivered', 'cancelled'].includes(o.status)) return false;
      if (!o.lat || !o.lng) return false;
      if (focusDriverId && o.assignedMotoboyId !== focusDriverId) return false;
      if (mapOrderFilter !== 'all' && stage(o) !== mapOrderFilter) return false;
      return true;
    });
  }, [activeOrders, focusDriverId, mapOrderFilter]);

  const mapDrivers = useMemo(() => {
    return motoboys.filter((m) => {
      if (m.status === 'offline') return false;
      if (focusDriverId && m.id !== focusDriverId) return false;
      if (mapDriverFilter !== 'all' && m.status !== mapDriverFilter) return false;
      return true;
    });
  }, [motoboys, focusDriverId, mapDriverFilter]);

  const stops: Stop[] = useMemo(
    () => mapOrders.map((o, i) => ({
      id: o.id,
      codeNumber: o.codeNumber,
      orderIndex: i + 1,
      title: `${code(o)} - ${o.clientName}`,
      recipientName: o.clientName,
      address: o.address,
      neighborhood: o.neighborhood,
      lat: o.lat,
      lng: o.lng,
      status: route(o) ? 'in_transit' : 'pending',
      priority: 'medium',
      motoboyId: o.assignedMotoboyId || undefined,
      motoboyName: o.assignedMotoboyName || undefined,
    } as Stop)),
    [mapOrders]
  );

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const batch = () => {
    if (!batchDriver || !selected.length) return;
    selected.forEach((id) => assignOrderRespectingLoad(id, batchDriver));
    triggerActionToast(`${selected.length} pedidos vinculados ao entregador.`);
    setSelected([]);
    setBatchDriver('');
  };

  const cols = [
    ['waiting', 'Aguardando motoboy', 'Aguardando vínculo', g.waiting],
    ['preparing', 'Preparando', 'Motoboy reservado', g.preparing],
    ['ready', 'Pronto / aguardando retirada', 'Prioridade da expedição', g.ready],
    ['route', 'Em entrega', 'Na rua agora', g.route],
  ] as [Stage, string, string, Order[]][];

  const Card = ({ o, s }: { o: Order; s: Stage }) => {
    const m = motoboys.find((x) => x.id === o.assignedMotoboyId);
    return (
      <div onClick={() => s === 'waiting' && toggle(o.id)} className={`rounded-lg border p-3 bg-[#111318] transition-colors ${s === 'waiting' ? 'cursor-pointer hover:border-slate-600' : ''} ${selected.includes(o.id) ? 'border-violet-500 bg-violet-950/10' : 'border-slate-800'}`}>
        {s === 'waiting' && <div className={`float-right w-4 h-4 rounded border flex items-center justify-center ${selected.includes(o.id) ? 'bg-violet-600 border-violet-500' : 'border-slate-600 bg-slate-900'}`}>{selected.includes(o.id) && <CheckCircle2 className="w-3 h-3 text-white" />}</div>}
        <div className="flex justify-between pr-2"><div><b className="text-sm text-white">{code(o)}</b><p className="text-xs text-slate-200 mt-1">{o.clientName}</p></div><b className="text-xs text-white">{money(o.total)}</b></div>
        <p className="text-[10px] text-slate-500 mt-2 flex gap-1"><MapPin className="w-3 h-3 shrink-0" />{o.address}</p>
        {s === 'waiting' && <p className={`text-[10px] mt-2 ${mins(o) >= 15 ? 'text-orange-300' : 'text-slate-400'}`}><Clock3 className="w-3 h-3 inline" /> Aguardando há {mins(o)} min</p>}
        {s === 'preparing' && <><p className="text-[10px] text-violet-300 mt-2">🛵 {o.assignedMotoboyName} • {driverLabel(m)}</p><button onClick={(e) => { e.stopPropagation(); onUpdateOrderStatus(o.id, 'ready_at_counter'); }} className="w-full mt-2 h-8 border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-md text-[11px] font-medium"><CheckCircle2 className="w-3 h-3 inline mr-1" />Marcar como pronto</button></>}
        {s === 'ready' && <><p className={`text-[10px] mt-2 ${readyMins(o) >= 10 ? 'text-red-300' : 'text-emerald-300'}`}>PRONTO HÁ {readyMins(o)} MIN</p><p className="text-[10px] text-violet-300">🛵 {o.assignedMotoboyName} • {driverLabel(m)}</p><p className="text-[10px] text-slate-500">Previsão: {m ? returnEta(m, shift) : 'sem previsão'}</p></>}
        {s === 'route' && <div className="mt-2 flex justify-between items-center"><span className="text-[10px] text-blue-300">{o.assignedMotoboyName || 'Em rota'}</span><button onClick={(e) => { e.stopPropagation(); onSelectOrderForTracking(o); }} className="h-7 px-2.5 border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-[10px] text-violet-300 rounded-md">Rastrear</button></div>}
      </div>
    );
  };

  return <div className="space-y-3">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div><h2 className="text-xl text-white">Pedidos & Despacho</h2><p className="text-xs text-slate-400">Prioridade para o que precisa de decisão agora.</p></div>
      <div className="flex gap-2"><div className="relative hidden md:block"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pedido, cliente, endereço..." className="bg-slate-950 border border-slate-700 rounded-md pl-9 pr-3 h-9 text-xs text-white outline-none focus:border-slate-500" /></div><button onClick={() => setManage(true)} className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 rounded-md text-xs flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5" />Gestão de entrega</button><button onClick={onOpenNewOrderModal} className="h-9 px-3.5 bg-violet-600 hover:bg-violet-500 text-white rounded-md text-xs flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Novo pedido</button></div>
    </div>

    <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 flex flex-wrap gap-5 text-xs"><span className="text-white"><b>{activeOrders.length}</b> ativos</span><span className="text-amber-300"><b>{g.waiting.length}</b> sem motoboy</span><span className="text-emerald-300"><b>{g.ready.length}</b> prontos</span><span className="text-orange-300"><b>{returning.length}</b> voltando</span></div>

    {(oldW.length > 0 || oldR.length > 0) && <div className="grid md:grid-cols-2 gap-2">{oldW.length > 0 && <div className="bg-orange-950/30 border border-orange-500/30 rounded-md p-2 text-xs text-orange-200">🟠 {oldW.length} aguardando motoboy há +15 min</div>}{oldR.length > 0 && <div className="bg-red-950/30 border border-red-500/30 rounded-md p-2 text-xs text-red-200">🔴 {oldR.slice(0, 3).map(code).join(', ')} pronto(s) há +10 min</div>}</div>}

    {suggestions.length > 0 && g.waiting.length >= 3 && <div className="bg-[#121126] border border-violet-500/25 rounded-lg p-3"><p className="text-[11px] text-slate-300 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-violet-400" /><b>Sugestões para próxima saída</b><span className="text-slate-600 ml-1">selecione um grupo</span></p><div className="mt-2 flex gap-2 flex-wrap">{suggestions.map(([b, os]) => <button key={b} onClick={() => setSelected(os.slice(0, 3).map((o) => o.id))} className="group h-8 bg-slate-950 hover:bg-slate-900 border border-slate-700 hover:border-violet-500/50 rounded-md px-3 text-[11px] text-slate-300 flex items-center gap-2"><span><b className="text-slate-100">{b}</b> · {os.slice(0, 3).map(code).join(' + ')}</span><ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-violet-400" /></button>)}</div></div>}

    {selected.length > 0 && <div className="sticky top-2 z-30 bg-[#151126] border border-violet-500/40 rounded-lg px-3 py-2.5 flex items-center gap-2 shadow-lg"><b className="text-xs text-white">{selected.length} pedido(s) selecionado(s)</b><select value={batchDriver} onChange={(e) => setBatchDriver(e.target.value)} className="ml-auto h-8 min-w-[190px] bg-slate-950 border border-slate-700 text-slate-200 rounded-md px-2 text-[11px] outline-none"><option value="">Escolher motoboy...</option>{motoboys.filter((m) => m.status !== 'offline').map((m) => <option key={m.id} value={m.id}>{m.name} — {driverLabel(m)}</option>)}</select><button disabled={!batchDriver} onClick={batch} className="h-8 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-md px-3 text-[11px] font-medium">Vincular ao motoboy</button><button onClick={() => setSelected([])} className="w-8 h-8 grid place-items-center border border-slate-700 hover:bg-slate-800 rounded-md"><X className="w-3.5 h-3.5 text-slate-400" /></button></div>}

    <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_.75fr_1.35fr_.75fr] gap-3">{cols.map(([id, title, sub, items]) => <section key={id} className="bg-[#0d1016] border border-slate-800 rounded-xl overflow-hidden"><div className="p-3 border-b border-slate-800 flex justify-between"><div><h3 className="text-sm text-white">{title}</h3><p className="text-[10px] text-slate-500">{sub}</p></div><b className="text-slate-300">{items.length}</b></div><div className="p-2 space-y-2 max-h-[610px] overflow-y-auto min-h-[180px]">{items.length ? items.map((o) => <Card key={o.id} o={o} s={id} />) : <div className="h-32 grid place-items-center text-xs text-slate-600">Nenhum pedido</div>}</div></section>)}</div>

    {manage && <div className="fixed inset-0 z-[80] bg-black/80 p-4 flex items-center justify-center">
      <div className="w-full max-w-[1500px] h-[88vh] bg-[#0b0d12] border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
          <div><h3 className="text-white">Gestão de entrega</h3><p className="text-[10px] text-slate-500">Somente operação ativa. Pedidos finalizados não aparecem no mapa.</p></div>
          <button onClick={() => setManage(false)} className="w-8 h-8 grid place-items-center rounded-md hover:bg-slate-800"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        <div className="px-4 py-2 border-b border-slate-800 flex flex-wrap gap-2 items-center">
          <span className="text-[10px] text-slate-500 mr-1">Mostrar:</span>
          {([['all', 'Tudo'], ['orders', 'Só pedidos'], ['drivers', 'Só motoboys']] as [MapMode, string][]).map(([id, label]) => <button key={id} onClick={() => setMapMode(id)} className={`h-7 px-2.5 rounded-md border text-[10px] ${mapMode === id ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-400'}`}>{label}</button>)}
          {mapMode !== 'drivers' && <><span className="w-px h-5 bg-slate-800 mx-1" /><span className="text-[10px] text-slate-500">Pedidos:</span>{([['all', 'Todos ativos'], ['waiting', 'Aguardando'], ['preparing', 'Preparando'], ['ready', 'Prontos'], ['route', 'Em entrega']] as [MapOrderFilter, string][]).map(([id, label]) => <button key={id} onClick={() => setMapOrderFilter(id)} className={`h-7 px-2.5 rounded-md border text-[10px] ${mapOrderFilter === id ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>{label}</button>)}</>}
          {mapMode !== 'orders' && <><span className="w-px h-5 bg-slate-800 mx-1" /><span className="text-[10px] text-slate-500">Motoboys:</span>{([['all', 'Todos'], ['available', 'Disponíveis'], ['delivering', 'Em entrega'], ['returning_to_store', 'Voltando']] as [MapDriverFilter, string][]).map(([id, label]) => <button key={id} onClick={() => setMapDriverFilter(id)} className={`h-7 px-2.5 rounded-md border text-[10px] ${mapDriverFilter === id ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>{label}</button>)}</>}
          {focusDriverId && <button onClick={() => setFocusDriverId(null)} className="ml-auto h-7 px-2.5 rounded-md border border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-300">Limpar foco do motoboy</button>}
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_365px] flex-1 min-h-0">
          <div className="p-3 min-h-0">
            <ReactiveRouteMap
              origin={{ name: shift.storeName || 'Loja', address: shift.storeAddress || '', lat: shift.storeLat || -26.9194, lng: shift.storeLng || -49.0661 }}
              stops={mapMode === 'drivers' ? [] : stops}
              motoboysList={mapMode === 'orders' ? [] : mapDrivers}
              selectedMotoboyId={focusDriverId}
              onSelectMotoboy={(id: string | null) => setFocusDriverId(id)}
            />
          </div>

          <aside className="border-l border-slate-800 p-2 overflow-y-auto bg-[#0d1016]">
            <div className="px-1 pb-2"><p className="text-xs text-white">Entregadores</p><p className="text-[10px] text-slate-500">Clique em um motoboy para filtrar o mapa e os pedidos dele.</p></div>
            {motoboys.map((m) => {
              const active = activeOrders.filter((o) => o.assignedMotoboyId === m.id && !['delivered', 'cancelled'].includes(o.status));
              const inRoute = active.filter(route);
              const nextLoad = active.filter((o) => ['pending', 'preparing', 'ready_at_counter'].includes(o.status));
              const done = orders.filter((o) => o.assignedMotoboyId === m.id && o.status === 'delivered');
              const focused = focusDriverId === m.id;
              return <div key={m.id} className={`border rounded-xl p-3 mb-2 ${focused ? 'border-violet-500 bg-violet-950/15' : 'border-slate-800 bg-slate-950'}`}>
                <button onClick={() => setFocusDriverId(focused ? null : m.id)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-2"><div><b className="text-xs text-white">{m.name}</b><p className={`text-[10px] mt-0.5 ${m.status === 'returning_to_store' ? 'text-orange-300' : m.status === 'delivering' ? 'text-blue-300' : m.status === 'available' ? 'text-emerald-300' : 'text-slate-500'}`}>{driverLabel(m)}</p></div><Bike className="w-4 h-4 text-violet-400" /></div>
                  <div className="grid grid-cols-3 gap-1 mt-3"><div className="bg-slate-900 rounded-md p-2"><p className="text-[9px] text-slate-500">Em entrega</p><b className="text-xs text-blue-300">{inRoute.length}</b></div><div className="bg-slate-900 rounded-md p-2"><p className="text-[9px] text-slate-500">Próxima carga</p><b className="text-xs text-amber-300">{nextLoad.length}</b></div><div className="bg-slate-900 rounded-md p-2"><p className="text-[9px] text-slate-500">Finalizados</p><b className="text-xs text-emerald-300">{done.length}</b></div></div>
                  <p className="text-[10px] text-slate-400 mt-2"><Clock3 className="w-3 h-3 inline mr-1" />Retorno estimado: <span className="text-slate-200">{returnEta(m, shift)}</span></p>
                </button>

                {inRoute.length > 0 && <div className="mt-3 pt-2 border-t border-slate-800"><p className="text-[9px] uppercase tracking-wide text-slate-600">Rota atual</p>{inRoute.map((o, i) => <div key={o.id} className="flex items-center justify-between mt-1.5 text-[10px]"><span className="text-slate-300">{i + 1}º {code(o)} → {o.neighborhood || o.address}</span><button onClick={() => onSelectOrderForTracking(o)} className="text-violet-300">Rastrear</button></div>)}</div>}

                {nextLoad.length > 0 && <div className="mt-3 pt-2 border-t border-slate-800"><p className="text-[9px] uppercase tracking-wide text-slate-600">Reservados / próxima saída</p>{nextLoad.slice(0, 4).map((o) => <p key={o.id} className="text-[10px] text-slate-400 mt-1">{code(o)} • {stage(o) === 'ready' ? 'Pronto' : 'Preparando'} • {o.neighborhood || o.address}</p>)}</div>}

                {done.length > 0 && <div className="mt-3 pt-2 border-t border-slate-800"><p className="text-[9px] uppercase tracking-wide text-slate-600">Já concluídos</p><p className="text-[10px] text-slate-500 mt-1">{done.slice(-4).map(code).join(' • ')}</p></div>}

                {m.status === 'returning_to_store' && <button onClick={() => handleCallCounter(m.id, m.name)} className="w-full mt-3 h-8 border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 rounded-md text-[10px]">Chamar no balcão</button>}
              </div>;
            })}
          </aside>
        </div>

        <div className="px-3 py-2 border-t border-slate-800 flex items-center justify-between"><span className="text-[10px] text-slate-500">No mapa: {mapMode === 'drivers' ? 0 : stops.length} pedidos • {mapMode === 'orders' ? 0 : mapDrivers.length} motoboys</span><button onClick={() => { setManage(false); setActiveTab('mapa'); }} className="h-8 px-3 border border-slate-700 hover:bg-slate-800 rounded-md text-[11px] text-violet-300">Abrir mapa ao vivo ↗</button></div>
      </div>
    </div>}
  </div>;
};

export default OperationDispatchView;
