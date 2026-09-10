import React, { useState } from 'react';
import { Receipt, BarChart3, Webhook, RotateCw } from 'lucide-react';
import { Order, Motoboy, StoreShift } from '../types';

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

const localDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const orderDateKey = (order: Order) => {
  if (order.deliveredDate) return order.deliveredDate;
  if (order.createdDate) return order.createdDate;
  const source = order.deliveredTimestamp ? new Date(order.deliveredTimestamp) : new Date(order.deliveredAt || order.createdAt);
  return Number.isNaN(source.getTime()) ? '' : localDateKey(source);
};

export const ManagementHub: React.FC<ManagementHubProps> = ({
  shift, orders, motoboys, onOpenSettlementModal, onOpenHistoryModal,
  onOpenIntegrationsModal, onSyncCardapioWeb, isSyncingCw,
}) => {
  const [subTab, setSubTab] = useState<'financeiro' | 'integracoes'>('financeiro');
  const formattedCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const today = localDateKey();
  const todayOrders = orders.filter((o) => orderDateKey(o) === today);
  const activeOrders = todayOrders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
  const deliveredToday = todayOrders.filter((o) => o.status === 'delivered');
  const totalRevenue = todayOrders.reduce((acc, o) => o.status !== 'cancelled' ? acc + (o.total || 0) : acc, 0);
  const totalMotoboyCommission = motoboys.reduce((acc, m) => acc + ((m.statsDate === today || !m.statsDate) ? (m.totalEarnedToday || 0) : 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div><div className="flex items-center gap-2"><h3 className="font-black text-lg text-slate-900">⚙️ Central de Gestão</h3><span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${shift.isOpen?'bg-emerald-500/15 text-emerald-700 border-emerald-200':'bg-slate-100 text-slate-500 border-slate-200'}`}>{shift.isOpen?'● Turno Ativo':'○ Loja Fechada'}</span></div><p className="text-xs text-slate-500 mt-1">Fechamento de caixa, relatórios de entregas, diárias de motoboy e conexões com plataformas.</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={onOpenSettlementModal} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5"><Receipt className="w-4 h-4"/>Acerto dos Motoboys</button>
          <button type="button" onClick={onOpenHistoryModal} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-emerald-600"/>Relatórios & Histórico</button>
          <button type="button" onClick={onOpenIntegrationsModal} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-1.5"><Webhook className="w-3.5 h-3.5 text-blue-600"/>Integrações</button>
        </div>
      </div>
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button type="button" onClick={()=>setSubTab('financeiro')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${subTab==='financeiro'?'bg-slate-100 text-slate-900 border border-slate-200':'text-slate-500'}`}>💰 Financeiro & Turno</button>
        <button type="button" onClick={()=>setSubTab('integracoes')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${subTab==='integracoes'?'bg-slate-100 text-slate-900 border border-slate-200':'text-slate-500'}`}>🔌 Conexões (iFood / Cardápio Web)</button>
      </div>
      {subTab==='financeiro' && <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200"><span className="text-xs font-bold text-slate-500 block">Faturamento de Hoje</span><span className="text-2xl font-black text-emerald-600 mt-1 block">{formattedCurrency(totalRevenue)}</span><span className="text-[11px] text-slate-400 mt-1 block">{todayOrders.filter(o=>o.status!=='cancelled').length} pedidos do dia</span></div>
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200"><span className="text-xs font-bold text-slate-500 block">Entregas Concluídas Hoje</span><span className="text-2xl font-black text-slate-900 mt-1 block">{deliveredToday.length}</span><span className="text-[11px] text-slate-400 mt-1 block">{activeOrders.length} ainda em andamento</span></div>
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-800/40"><span className="text-xs font-bold text-amber-700 block">Repasse da Frota Hoje</span><span className="text-2xl font-black text-amber-700 mt-1 block">{formattedCurrency(totalMotoboyCommission)}</span><span className="text-[11px] text-amber-600/80 mt-1 block">Ganhos registrados dos motoboys</span></div>
        </div>
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3"><div><h4 className="text-sm font-bold text-slate-900">Acerto de Caixa e Diárias</h4><p className="text-xs text-slate-500">Confira o que está em aberto e o que já foi quitado por entregador.</p></div><button type="button" onClick={onOpenSettlementModal} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200">Abrir Folha de Acerto</button></div>
      </div>}
      {subTab==='integracoes' && <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3"><div className="flex justify-between"><div><h4 className="font-bold text-sm text-slate-900">Cardápio Web</h4><span className="text-[11px] text-slate-500">Integração oficial via API</span></div><span className={`px-2 py-0.5 rounded text-[10px] font-black border ${shift.cardapioWebStatus?.isOpen?'bg-emerald-500/15 text-emerald-700 border-emerald-200':'bg-rose-500/15 text-rose-700 border-rose-200'}`}>{shift.cardapioWebStatus?.isOpen?'● Conectado':'○ Fechado'}</span></div><button type="button" onClick={()=>onSyncCardapioWeb(true)} disabled={isSyncingCw} className="w-full py-2 px-3 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 flex justify-center gap-1.5"><RotateCw className={`w-3.5 h-3.5 ${isSyncingCw?'animate-spin':''}`}/>{isSyncingCw?'Sincronizando...':'Sincronizar Pedidos Agora'}</button></div>
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3"><div><h4 className="font-bold text-sm text-slate-900">iFood & Outros Canais</h4><span className="text-[11px] text-slate-500">Webhooks e integrações</span></div><button type="button" onClick={onOpenIntegrationsModal} className="w-full py-2 px-3 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200">Configurar Integrações</button></div>
      </div>}
    </div>
  );
};
