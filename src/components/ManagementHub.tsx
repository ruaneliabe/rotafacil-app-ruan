import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  Landmark,
  Receipt,
  RotateCw,
  Store,
  TrendingUp,
  UsersRound,
  WalletCards,
  Webhook,
} from 'lucide-react';
import { Motoboy, Order, StoreShift } from '../types';

interface ManagementHubProps {
  shift: StoreShift;
  orders: Order[];
  motoboys: Motoboy[];
  onOpenSettlementModal: () => void;
  onOpenHistoryModal: () => void;
  onOpenIntegrationsModal: () => void;
  onSyncCardapioWeb: (force?: boolean) => void;
  isSyncingCw: boolean;
  onToggleShift: () => void;
}

type PeriodKey = 'today' | 'yesterday' | 'last7' | 'lastWeek';
type HubTab = 'financeiro' | 'integracoes';

const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const safeDate = (value: unknown): Date | null => { if (!value) return null; const d = new Date(value as any); return Number.isNaN(d.getTime()) ? null : d; };
const safeDateKey = (value: unknown) => { if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value; const d = safeDate(value); return d ? localDateKey(d) : ''; };
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, amount: number) => { const next = new Date(date); next.setDate(next.getDate()+amount); return next; };
const mondayOfWeek = (date: Date) => { const d=startOfDay(date); const day=d.getDay()||7; d.setDate(d.getDate()-day+1); return d; };
const money = (v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);

const externalDateKey = (order: Order) => {
  const o = order as any;
  for (const value of [o.cardapioWebCreatedAt,o.externalCreatedAt,o.orderCreatedAt,o.sourceCreatedAt,o.originalCreatedAt,o.created_at]) {
    const key = safeDateKey(value); if (key) return key;
  }
  return '';
};

const historicalDateKey = (order: Order) => {
  for (const value of [order.deliveredDate,order.deliveredTimestamp,order.shiftDate,externalDateKey(order),order.createdTimestamp]) {
    const key=safeDateKey(value); if(key) return key;
  }
  if (order.originChannel === 'cardapio_web') return '';
  return safeDateKey(order.createdDate) || safeDateKey(order.deliveredAt) || safeDateKey(order.createdAt);
};

const orderHour = (order: Order) => {
  const value = order.deliveredTimestamp || order.createdTimestamp || order.deliveredAt || order.createdAt;
  const date = safeDate(value);
  return date ? date.getHours() : null;
};

const paymentLabel = (method?: string) => {
  const value = String(method || '').toLowerCase();
  if (value.includes('pix')) return 'Pix';
  if (value.includes('card') || value.includes('cart')) return 'Cartão';
  if (value.includes('cash') || value.includes('dinheiro')) return 'Dinheiro';
  return 'Outros';
};

export const ManagementHub: React.FC<ManagementHubProps> = ({
  shift,
  orders,
  motoboys,
  onOpenSettlementModal,
  onOpenHistoryModal,
  onOpenIntegrationsModal,
  onSyncCardapioWeb,
  isSyncingCw,
  onToggleShift,
}) => {
  const [subTab,setSubTab]=useState<HubTab>('financeiro');
  const [period,setPeriod]=useState<PeriodKey>('today');
  const [driverSearch,setDriverSearch]=useState('');
  const [settlementFilter,setSettlementFilter]=useState<'all'|'pending'|'paid'>('all');

  const todayKey=localDateKey();
  const shiftDay=shift.shiftDate || safeDateKey(shift.openedTimestamp);
  const hasTodayOperation=shiftDay===todayKey;
  const openedAtMs=Number(shift.openedTimestamp)||0;

  const periodInfo=useMemo(()=>{
    const today=startOfDay(new Date()); let start=today,end=addDays(today,1),label='Hoje';
    if(period==='yesterday'){start=addDays(today,-1);end=today;label='Ontem'}
    else if(period==='last7'){start=addDays(today,-6);end=addDays(today,1);label='Últimos 7 dias'}
    else if(period==='lastWeek'){const monday=mondayOfWeek(today);start=addDays(monday,-7);end=monday;label='Semana passada'}
    return {start,end,label};
  },[period]);

  const belongsToTodayOperation=(order:Order)=>{
    if(!hasTodayOperation) return false;
    if(shift.shiftId && order.shiftId && order.shiftId===shift.shiftId) return true;
    if(order.shiftDate===todayKey) return true;
    const originalKey=externalDateKey(order);
    if(originalKey===todayKey){
      if(!openedAtMs) return true;
      const o=order as any;
      const original=safeDate(o.cardapioWebCreatedAt||o.externalCreatedAt||o.orderCreatedAt||o.sourceCreatedAt||o.originalCreatedAt||o.created_at);
      return !original || original.getTime()>=openedAtMs;
    }
    for(const value of [order.createdTimestamp,order.deliveredTimestamp]){
      const n=Number(value)||0;
      if(n && localDateKey(new Date(n))===todayKey && (!openedAtMs || n>=openedAtMs)) return true;
    }
    if(order.originChannel!=='cardapio_web' && order.createdDate===todayKey) return true;
    return false;
  };

  const selectedOrders=useMemo(()=>orders.filter(order=>{
    if(period==='today') return belongsToTodayOperation(order);
    const key=historicalDateKey(order); if(!key) return false;
    const [y,m,d]=key.split('-').map(Number); const date=new Date(y,m-1,d);
    return date>=periodInfo.start && date<periodInfo.end;
  }),[orders,period,periodInfo,shift.shiftId,shift.shiftDate,shift.openedTimestamp,hasTodayOperation]);

  const undatedLegacy=useMemo(()=>orders.filter(o=>o.originChannel==='cardapio_web'&&!historicalDateKey(o)).length,[orders]);
  const valid=selectedOrders.filter(o=>o.status!=='cancelled');
  const delivered=selectedOrders.filter(o=>o.status==='delivered');
  const active=selectedOrders.filter(o=>!['delivered','cancelled'].includes(o.status));
  const revenue=valid.reduce((s,o)=>s+Number(o.total||0),0);
  const avgTicket=valid.length ? revenue/valid.length : 0;

  const payout=useMemo(()=>{
    const byId=new Map(motoboys.map(m=>[m.id,m]));
    const days=new Set<string>();
    let perDelivery=0;
    delivered.forEach(o=>{
      if(!o.assignedMotoboyId)return;
      const m=byId.get(o.assignedMotoboyId) as any;
      if(!m)return;
      perDelivery+=Number(m.perDeliveryFee||0);
      const day=period==='today'?todayKey:historicalDateKey(o);
      if(day)days.add(`${day}|${m.id}`);
    });
    let fixed=0;
    days.forEach(entry=>{const id=entry.split('|')[1];fixed+=Number((byId.get(id) as any)?.fixedFee||0)});
    return fixed+perDelivery;
  },[delivered,motoboys,period,todayKey]);

  const storeRevenue = useMemo(() => {
    const map = new Map<string, number>();
    valid.forEach((o) => {
      const name = o.storeName || (o.storeBranch === 'hope_pizza' ? 'Hope Pizza' : o.storeBranch === 'hope_burger' ? 'Hope Burger' : shift.storeName || 'Loja principal');
      map.set(name, (map.get(name) || 0) + Number(o.total || 0));
    });
    return Array.from(map.entries()).sort((a,b)=>b[1]-a[1]);
  }, [valid, shift.storeName]);

  const paymentTotals = useMemo(() => {
    const base: Record<string, number> = { Pix: 0, Cartão: 0, Dinheiro: 0, Outros: 0 };
    valid.forEach((o) => { base[paymentLabel(o.paymentMethod)] += Number(o.total || 0); });
    return Object.entries(base).sort((a,b)=>b[1]-a[1]);
  }, [valid]);

  const hourly = useMemo(() => {
    const hours = Array.from({length:15},(_,i)=>i+8);
    return hours.map((hour)=>{
      const bucket = valid.filter((o)=>orderHour(o)===hour);
      return { hour, revenue: bucket.reduce((s,o)=>s+Number(o.total||0),0), deliveries: bucket.filter((o)=>o.status==='delivered').length };
    });
  }, [valid]);
  const maxHourlyRevenue = Math.max(1, ...hourly.map((h)=>h.revenue));
  const maxHourlyDeliveries = Math.max(1, ...hourly.map((h)=>h.deliveries));

  const settlementRows = useMemo(() => {
    return motoboys.map((m) => {
      const driverOrders = delivered.filter((o)=>o.assignedMotoboyId===m.id);
      const deliveryTotal = driverOrders.length * Number(m.perDeliveryFee || 0);
      const fixed = driverOrders.length > 0 ? Number(m.fixedFee || 0) : 0;
      const total = fixed + deliveryTotal;
      const paid = total > 0 && Boolean((m as any).settlementPaidAt);
      return { m, deliveries: driverOrders.length, total, paid };
    }).filter((row)=>row.deliveries>0 || row.total>0);
  }, [motoboys, delivered]);

  const pendingTotal = settlementRows.filter((r)=>!r.paid).reduce((s,r)=>s+r.total,0);
  const pendingCount = settlementRows.filter((r)=>!r.paid).length;
  const filteredSettlements = settlementRows.filter(({m,paid}) => {
    const q = driverSearch.trim().toLowerCase();
    if (q && !m.name.toLowerCase().includes(q)) return false;
    if (settlementFilter === 'pending' && paid) return false;
    if (settlementFilter === 'paid' && !paid) return false;
    return true;
  });

  const fmt=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit'});
  const endInclusive=addDays(periodInfo.end,-1);
  const dateCaption=localDateKey(periodInfo.start)===localDateKey(endInclusive)?fmt.format(periodInfo.start):`${fmt.format(periodInfo.start)} a ${fmt.format(endInclusive)}`;
  const operationMinutes = shift.isOpen && openedAtMs ? Math.max(0, Math.round((Date.now()-openedAtMs)/60000)) : 0;
  const operationDuration = `${Math.floor(operationMinutes/60)}h ${operationMinutes%60}min`;
  const storeBalance = revenue - payout;

  const kpis = [
    { label:'Faturamento (entregas)', value:money(revenue), helper:`${valid.length} pedido${valid.length===1?'':'s'} no período`, icon:CircleDollarSign, tone:'emerald' },
    { label:'Entregas concluídas', value:String(delivered.length), helper:`${active.length} ainda em andamento`, icon:CheckCircle2, tone:'blue' },
    { label:'Repasse da frota', value:money(payout), helper:'Arranque + corridas', icon:Receipt, tone:'amber' },
    { label:'Ticket médio', value:money(avgTicket), helper:'Média por pedido', icon:TrendingUp, tone:'violet' },
    { label:'Pendente de acerto', value:money(pendingTotal), helper:`${pendingCount} motoboy${pendingCount===1?'':'s'}`, icon:WalletCards, tone:'rose' },
  ] as const;

  const toneClasses: Record<string,string> = {
    emerald:'bg-emerald-50 text-emerald-600',
    blue:'bg-blue-50 text-blue-600',
    amber:'bg-amber-50 text-amber-600',
    violet:'bg-violet-50 text-violet-600',
    rose:'bg-rose-50 text-rose-600',
  };

  return <div className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black tracking-tight text-slate-950">Central financeira</h3>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${shift.isOpen?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-slate-200 bg-slate-50 text-slate-500'}`}>
              <span className={`h-2 w-2 rounded-full ${shift.isOpen?'bg-emerald-500':'bg-slate-400'}`} />
              {shift.isOpen?'Operação em andamento':'Operação fechada'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Acompanhe faturamento, entregas, repasses e acerto da equipe em um só lugar.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {([['today','Hoje'],['yesterday','Ontem'],['last7','7 dias'],['lastWeek','Semana passada']] as [PeriodKey,string][]).map(([key,label])=><button key={key} onClick={()=>setPeriod(key)} className={`h-8 rounded-lg px-3 text-[11px] font-black transition ${period===key?'bg-white text-slate-900 shadow-sm':'text-slate-500 hover:text-slate-800'}`}>{label}</button>)}
          </div>
          <button onClick={onOpenHistoryModal} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><BarChart3 className="h-4 w-4 text-violet-600" />Relatórios</button>
          <button onClick={onOpenIntegrationsModal} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><Webhook className="h-4 w-4 text-blue-600" />Conexões</button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1 border-b border-slate-200">
        <button onClick={()=>setSubTab('financeiro')} className={`border-b-2 px-3 py-2 text-xs font-black ${subTab==='financeiro'?'border-violet-600 text-violet-700':'border-transparent text-slate-500'}`}>Visão geral</button>
        <button onClick={()=>setSubTab('integracoes')} className={`border-b-2 px-3 py-2 text-xs font-black ${subTab==='integracoes'?'border-violet-600 text-violet-700':'border-transparent text-slate-500'}`}>Integrações</button>
      </div>
    </div>

    {subTab==='financeiro' && <>
      {period==='today'&&!hasTodayOperation&&<div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800"><b>O turno de hoje ainda não foi aberto.</b><span className="ml-1 text-blue-700">O financeiro de hoje começa zerado para não misturar com pedidos antigos.</span></div>}
      {undatedLegacy>0&&period!=='today'&&<div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600"/><div><p className="text-xs font-black text-amber-900">Alguns pedidos antigos não têm data original confiável.</p><p className="mt-0.5 text-[10px] text-amber-700">{undatedLegacy} registro(s) ficam fora dos períodos históricos para não distorcer os números.</p></div></div>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {kpis.map(({label,value,helper,icon:Icon,tone})=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneClasses[tone]}`}><Icon className="h-5 w-5"/></span><div className="min-w-0"><p className="text-xs font-bold text-slate-600">{label}</p><p className={`mt-1 truncate text-2xl font-black tracking-tight ${tone==='rose'?'text-rose-600':'text-slate-950'}`}>{value}</p><p className="mt-1 text-[10px] text-slate-500">{helper}</p></div></div></div>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)_minmax(280px,.65fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><div><h4 className="text-sm font-black text-slate-900">Faturamento e entregas</h4><p className="mt-0.5 text-[10px] text-slate-500">Movimento por hora no período selecionado.</p></div><span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-black text-slate-600">{periodInfo.label} · {dateCaption}</span></div>
          <div className="mt-5 h-[250px] rounded-xl border border-slate-100 bg-slate-50/40 px-3 pb-3 pt-5">
            <div className="flex h-full items-end gap-2">
              {hourly.map((item)=><div key={item.hour} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div className="relative flex flex-1 items-end justify-center">
                  <div className="w-full max-w-7 rounded-t-md bg-emerald-400/80" style={{height:`${Math.max(3,(item.revenue/maxHourlyRevenue)*100)}%`}} title={`${item.hour}h · ${money(item.revenue)}`} />
                  <div className="absolute left-1/2 w-2 -translate-x-1/2 rounded-full bg-violet-600" style={{bottom:`${Math.max(3,(item.deliveries/maxHourlyDeliveries)*92)}%`,height:8}} title={`${item.deliveries} entregas`} />
                </div>
                <span className="mt-2 text-center text-[9px] font-bold text-slate-400">{item.hour}h</span>
              </div>)}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-[10px] font-bold text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400"/>Faturamento</span><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-600"/>Entregas</span></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2"><Store className="h-4 w-4 text-violet-600"/><h4 className="text-sm font-black text-slate-900">Faturamento por loja</h4></div>
          <div className="mt-5 flex items-center justify-center">
            <div className="grid h-36 w-36 place-items-center rounded-full" style={{background:`conic-gradient(#8b5cf6 0 ${revenue?((storeRevenue[0]?.[1]||0)/revenue)*360:0}deg,#fb923c ${revenue?((storeRevenue[0]?.[1]||0)/revenue)*360:0}deg 360deg)`}}>
              <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center"><div><p className="text-sm font-black text-slate-950">{money(revenue)}</p><p className="text-[9px] text-slate-400">Total</p></div></div>
            </div>
          </div>
          <div className="mt-4 space-y-2.5">{storeRevenue.length?storeRevenue.slice(0,4).map(([name,value],i)=><div key={name} className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${i===0?'bg-violet-500':i===1?'bg-orange-400':'bg-slate-300'}`}/><span className="truncate text-[11px] font-bold text-slate-700">{name}</span></div><div className="text-right"><p className="text-[11px] font-black text-slate-900">{money(value)}</p><p className="text-[9px] text-slate-400">{revenue?Math.round((value/revenue)*100):0}%</p></div></div>):<p className="py-10 text-center text-xs text-slate-400">Sem faturamento no período.</p>}</div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-violet-600"/><h4 className="text-sm font-black text-slate-900">Formas de pagamento</h4></div>
          <div className="mt-4 divide-y divide-slate-100">{paymentTotals.map(([label,value])=><div key={label} className="flex items-center justify-between gap-3 py-3"><div className="flex items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-lg ${label==='Pix'?'bg-emerald-50 text-emerald-600':label==='Cartão'?'bg-violet-50 text-violet-600':label==='Dinheiro'?'bg-blue-50 text-blue-600':'bg-slate-100 text-slate-500'}`}>{label==='Pix'?<CircleDollarSign className="h-4 w-4"/>:label==='Cartão'?<CreditCard className="h-4 w-4"/>:label==='Dinheiro'?<Landmark className="h-4 w-4"/>:<WalletCards className="h-4 w-4"/>}</span><span className="text-[11px] font-bold text-slate-700">{label}</span></div><div className="text-right"><p className="text-[11px] font-black text-slate-900">{money(value)}</p><p className="text-[9px] text-slate-400">{revenue?Math.round((value/revenue)*100):0}%</p></div></div>)}</div>
        </section>
      </div>

      <div className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${shift.isOpen?'border-blue-200 bg-blue-50':'border-slate-200 bg-slate-50'}`}>
        <div><p className={`text-xs font-black ${shift.isOpen?'text-blue-900':'text-slate-700'}`}>{shift.isOpen?`Turno de hoje em andamento${openedAtMs?` há ${operationDuration}`:''}`:'Operação fechada'}</p><p className={`mt-0.5 text-[10px] ${shift.isOpen?'text-blue-700':'text-slate-500'}`}>Os valores são atualizados conforme as entregas são concluídas.</p></div>
        <button onClick={onToggleShift} className={`h-9 rounded-lg px-4 text-[11px] font-black text-white ${shift.isOpen?'bg-rose-600 hover:bg-rose-500':'bg-emerald-600 hover:bg-emerald-500'}`}>{shift.isOpen?'Encerrar turno':'Abrir turno'}</button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div><h4 className="text-sm font-black text-slate-900">Acerto dos motoboys</h4><p className="mt-0.5 text-[10px] text-slate-500">Confira o valor de cada entregador e finalize o repasse diário.</p></div>
            <div className="flex flex-wrap items-center gap-2"><input value={driverSearch} onChange={(e)=>setDriverSearch(e.target.value)} placeholder="Buscar motoboy..." className="h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-300"/><select value={settlementFilter} onChange={(e)=>setSettlementFilter(e.target.value as any)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"><option value="all">Todos os status</option><option value="pending">Pendentes</option><option value="paid">Pagos</option></select><button onClick={onOpenSettlementModal} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-[11px] font-black text-white"><FileText className="h-4 w-4"/>Abrir folha de acerto</button></div>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">#</th><th className="px-3 py-3">Motoboy</th><th className="px-3 py-3">Entregas</th><th className="px-3 py-3">Total a receber</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredSettlements.slice(0,8).map(({m,deliveries,total,paid},i)=><tr key={m.id} className="hover:bg-slate-50"><td className="px-4 py-3 text-xs font-bold text-slate-500">{i+1}</td><td className="px-3 py-3"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${m.status==='offline'?'bg-slate-300':'bg-emerald-500'}`}/><span className="text-xs font-black text-slate-900">{m.name}</span></div></td><td className="px-3 py-3 text-xs font-bold text-slate-700">{deliveries}</td><td className="px-3 py-3 text-xs font-black text-slate-900">{money(total)}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${paid?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{paid?'Pago':'Pendente'}</span></td><td className="px-3 py-3 text-right"><button onClick={onOpenSettlementModal} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[10px] font-black text-violet-700">{paid?'Ver':'Acertar'}</button></td></tr>)}{filteredSettlements.length===0&&<tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">Nenhum acerto encontrado para o período.</td></tr>}</tbody></table></div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-violet-600"/><h4 className="text-sm font-black text-slate-900">Resumo do período</h4></div><div className="mt-4 space-y-2.5 text-[11px]">{[['Período',`${periodInfo.label} · ${dateCaption}`],['Total de pedidos',String(selectedOrders.length)],['Entregas concluídas',String(delivered.length)],['Cancelamentos',String(selectedOrders.filter((o)=>o.status==='cancelled').length)],['Faturamento bruto',money(revenue)],['Repasses da frota',money(payout)]].map(([a,b])=><div key={a} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2"><span className="text-slate-500">{a}</span><strong className="text-right text-slate-900">{b}</strong></div>)}<div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2"><span className="font-bold text-emerald-700">Saldo da loja</span><strong className="text-emerald-700">{money(storeBalance)}</strong></div></div></div>
          <button onClick={onOpenHistoryModal} className="group w-full rounded-2xl border border-violet-100 bg-violet-50 p-4 text-left shadow-sm transition hover:bg-violet-100"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-sm font-black text-violet-800"><BarChart3 className="h-4 w-4"/>Relatórios & histórico</div><p className="mt-1 text-[10px] leading-relaxed text-violet-700">Consulte turnos anteriores e relatórios detalhados da operação.</p></div><ChevronRight className="h-5 w-5 text-violet-500 transition group-hover:translate-x-0.5"/></div></button>
        </aside>
      </div>
    </>}

    {subTab==='integracoes'&&<div className="grid grid-cols-1 gap-3 md:grid-cols-2"><div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex justify-between"><div><h4 className="text-sm font-black text-slate-900">Cardápio Web</h4><span className="text-[11px] text-slate-500">Integração oficial via API</span></div><span className={`rounded-full border px-2 py-1 text-[10px] font-black ${shift.cardapioWebStatus?.isOpen?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-rose-200 bg-rose-50 text-rose-700'}`}>{shift.cardapioWebStatus?.isOpen?'● Conectado':'○ Fechado'}</span></div><button onClick={()=>onSyncCardapioWeb(true)} disabled={isSyncingCw} className="flex w-full justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700"><RotateCw className={`h-3.5 w-3.5 ${isSyncingCw?'animate-spin':''}`}/>{isSyncingCw?'Sincronizando...':'Sincronizar pedidos agora'}</button></div><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h4 className="text-sm font-black text-slate-900">iFood & outros canais</h4><p className="mt-1 text-[11px] text-slate-500">Webhooks, canais e integrações adicionais.</p><button onClick={onOpenIntegrationsModal} className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">Configurar integrações</button></div></div>}
  </div>;
};
