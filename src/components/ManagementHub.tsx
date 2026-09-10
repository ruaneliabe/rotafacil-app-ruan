import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CalendarDays, Receipt, RotateCw, Webhook } from 'lucide-react';
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

const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const safeDate = (value: unknown): Date | null => { if (!value) return null; const d = new Date(value as any); return Number.isNaN(d.getTime()) ? null : d; };
const safeDateKey = (value: unknown) => { if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value; const d = safeDate(value); return d ? localDateKey(d) : ''; };
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, amount: number) => { const next = new Date(date); next.setDate(next.getDate()+amount); return next; };
const mondayOfWeek = (date: Date) => { const d=startOfDay(date); const day=d.getDay()||7; d.setDate(d.getDate()-day+1); return d; };

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

export const ManagementHub: React.FC<ManagementHubProps> = ({shift,orders,motoboys,onOpenSettlementModal,onOpenHistoryModal,onOpenIntegrationsModal,onSyncCardapioWeb,isSyncingCw}) => {
  const [subTab,setSubTab]=useState<'financeiro'|'integracoes'>('financeiro');
  const [period,setPeriod]=useState<PeriodKey>('today');
  const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
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
      const o=order as any; const original=safeDate(o.cardapioWebCreatedAt||o.externalCreatedAt||o.orderCreatedAt||o.sourceCreatedAt||o.originalCreatedAt||o.created_at);
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

  const payout=useMemo(()=>{
    const byId=new Map(motoboys.map(m=>[m.id,m])); const days=new Set<string>(); let perDelivery=0;
    delivered.forEach(o=>{if(!o.assignedMotoboyId)return;const m=byId.get(o.assignedMotoboyId) as any;if(!m)return;perDelivery+=Number(m.perDeliveryFee||0);const day=period==='today'?todayKey:historicalDateKey(o);if(day)days.add(`${day}|${m.id}`)});
    let fixed=0;days.forEach(entry=>{const id=entry.split('|')[1];fixed+=Number((byId.get(id) as any)?.fixedFee||0)});return fixed+perDelivery;
  },[delivered,motoboys,period,todayKey]);

  const fmt=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit'});const endInclusive=addDays(periodInfo.end,-1);const dateCaption=localDateKey(periodInfo.start)===localDateKey(endInclusive)?fmt.format(periodInfo.start):`${fmt.format(periodInfo.start)} a ${fmt.format(endInclusive)}`;

  return <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-5 shadow-sm">
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-200"><div><div className="flex items-center gap-2 flex-wrap"><h3 className="font-semibold text-lg text-slate-900">Central financeira</h3><span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${shift.isOpen?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-slate-50 text-slate-500 border-slate-200'}`}>{shift.isOpen?'● Operação aberta':'○ Operação fechada'}</span></div><p className="text-xs text-slate-500 mt-1">Faturamento, entregas, repasses e relatórios em um só lugar.</p></div><div className="flex items-center gap-2 flex-wrap"><button onClick={onOpenSettlementModal} className="px-3.5 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"><Receipt className="w-4 h-4"/>Acerto dos motoboys</button><button onClick={onOpenHistoryModal} className="px-3.5 py-2 bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-violet-600"/>Relatórios & histórico</button><button onClick={onOpenIntegrationsModal} className="px-3 py-2 bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5"><Webhook className="w-3.5 h-3.5 text-blue-600"/>Integrações</button></div></div>
    <div className="flex items-center gap-1 border-b border-slate-200"><button onClick={()=>setSubTab('financeiro')} className={`px-3 py-2.5 text-xs font-semibold border-b-2 ${subTab==='financeiro'?'border-violet-600 text-violet-700':'border-transparent text-slate-500'}`}>Financeiro</button><button onClick={()=>setSubTab('integracoes')} className={`px-3 py-2.5 text-xs font-semibold border-b-2 ${subTab==='integracoes'?'border-violet-600 text-violet-700':'border-transparent text-slate-500'}`}>Conexões</button></div>
    {subTab==='financeiro'&&<div className="space-y-4"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-white border border-slate-200 grid place-items-center"><CalendarDays className="w-4 h-4 text-violet-600"/></div><div><p className="text-xs font-semibold text-slate-800">Período</p><p className="text-[10px] text-slate-500">{periodInfo.label} · {dateCaption}</p></div></div><div className="inline-flex flex-wrap gap-1 bg-white border border-slate-200 rounded-lg p-1">{([['today','Hoje'],['yesterday','Ontem'],['last7','Últimos 7 dias'],['lastWeek','Semana passada']] as [PeriodKey,string][]).map(([k,l])=><button key={k} onClick={()=>setPeriod(k)} className={`h-8 px-3 rounded-md text-[11px] font-semibold ${period===k?'bg-slate-900 text-white':'text-slate-500 hover:bg-slate-50'}`}>{l}</button>)}</div></div>
      {period==='today'&&!hasTodayOperation&&<div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-3 text-xs text-blue-800"><b>O turno de hoje ainda não foi aberto.</b><div className="text-[10px] mt-1 text-blue-700">Por isso o financeiro de Hoje começa zerado. Pedidos antigos ou apenas sincronizados não entram neste total.</div></div>}
      {undatedLegacy>0&&period!=='today'&&<div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3"><AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5"/><div><p className="text-xs font-semibold text-amber-900">Alguns pedidos antigos não possuem data original confiável.</p><p className="text-[10px] text-amber-700 mt-0.5">{undatedLegacy} registro(s) ficam fora dos períodos históricos para não distorcer os números.</p></div></div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm"><span className="text-[11px] font-semibold text-slate-500 block">Faturamento</span><span className="text-2xl font-semibold tracking-tight text-emerald-600 mt-1 block">{money(revenue)}</span><span className="text-[10px] text-slate-400 mt-1 block">{valid.length} pedido(s) no período</span></div><div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm"><span className="text-[11px] font-semibold text-slate-500 block">Entregas concluídas</span><span className="text-2xl font-semibold tracking-tight text-slate-900 mt-1 block">{delivered.length}</span><span className="text-[10px] text-slate-400 mt-1 block">{active.length} ainda em andamento</span></div><div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm"><span className="text-[11px] font-semibold text-slate-500 block">Repasse estimado da frota</span><span className="text-2xl font-semibold tracking-tight text-amber-700 mt-1 block">{money(payout)}</span><span className="text-[10px] text-slate-400 mt-1 block">Arranque + corridas concluídas</span></div></div>
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3"><div><h4 className="text-sm font-semibold text-slate-900">Acerto de caixa e diárias</h4><p className="text-xs text-slate-500">Consulte o que está em aberto e o que já foi quitado por entregador.</p></div><button onClick={onOpenSettlementModal} className="px-4 py-2 bg-slate-100 text-slate-800 font-semibold text-xs rounded-lg border border-slate-200">Abrir folha de acerto</button></div>
    </div>}
    {subTab==='integracoes'&&<div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3"><div className="flex justify-between"><div><h4 className="font-semibold text-sm text-slate-900">Cardápio Web</h4><span className="text-[11px] text-slate-500">Integração oficial via API</span></div><span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${shift.cardapioWebStatus?.isOpen?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-rose-50 text-rose-700 border-rose-200'}`}>{shift.cardapioWebStatus?.isOpen?'● Conectado':'○ Fechado'}</span></div><button onClick={()=>onSyncCardapioWeb(true)} disabled={isSyncingCw} className="w-full py-2 px-3 bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex justify-center gap-1.5"><RotateCw className={`w-3.5 h-3.5 ${isSyncingCw?'animate-spin':''}`}/>{isSyncingCw?'Sincronizando...':'Sincronizar pedidos agora'}</button></div><div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200"><h4 className="font-semibold text-sm text-slate-900">iFood & outros canais</h4><p className="text-[11px] text-slate-500 mt-1">Webhooks e integrações</p><button onClick={onOpenIntegrationsModal} className="w-full mt-3 py-2 px-3 bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-200">Configurar integrações</button></div></div>}
  </div>;
};
