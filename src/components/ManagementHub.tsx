import React, { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Receipt, RotateCw, Webhook } from 'lucide-react';
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

const localDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDateKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const orderDateKey = (order: Order) => {
  if (order.deliveredDate) return order.deliveredDate;
  if (order.createdDate) return order.createdDate;
  const source = order.deliveredTimestamp ? new Date(order.deliveredTimestamp) : new Date(order.deliveredAt || order.createdAt);
  return Number.isNaN(source.getTime()) ? '' : localDateKey(source);
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};
const mondayOfWeek = (date: Date) => {
  const d = startOfDay(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
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
}) => {
  const [subTab, setSubTab] = useState<'financeiro' | 'integracoes'>('financeiro');
  const [period, setPeriod] = useState<PeriodKey>('today');
  const formattedCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

  const periodInfo = useMemo(() => {
    const today = startOfDay(new Date());
    let start = today;
    let end = addDays(today, 1);
    let label = 'Hoje';

    if (period === 'yesterday') {
      start = addDays(today, -1);
      end = today;
      label = 'Ontem';
    } else if (period === 'last7') {
      start = addDays(today, -6);
      end = addDays(today, 1);
      label = 'Últimos 7 dias';
    } else if (period === 'lastWeek') {
      const thisMonday = mondayOfWeek(today);
      start = addDays(thisMonday, -7);
      end = thisMonday;
      label = 'Semana passada';
    }

    return { start, end, label };
  }, [period]);

  const selectedOrders = useMemo(
    () =>
      orders.filter((order) => {
        const key = orderDateKey(order);
        if (!key) return false;
        const date = parseDateKey(key);
        return date >= periodInfo.start && date < periodInfo.end;
      }),
    [orders, periodInfo]
  );

  const validOrders = selectedOrders.filter((o) => o.status !== 'cancelled');
  const deliveredOrders = selectedOrders.filter((o) => o.status === 'delivered');
  const activeOrders = selectedOrders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
  const totalRevenue = validOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);

  const estimatedFleetPayout = useMemo(() => {
    const motoboyById = new Map(motoboys.map((m) => [m.id, m]));
    const activeDriverDays = new Set<string>();
    let perDelivery = 0;

    deliveredOrders.forEach((order) => {
      if (!order.assignedMotoboyId) return;
      const motoboy = motoboyById.get(order.assignedMotoboyId);
      if (!motoboy) return;
      perDelivery += Number(motoboy.perDeliveryFee || 0);
      const day = orderDateKey(order);
      if (day) activeDriverDays.add(`${day}:${motoboy.id}`);
    });

    let fixed = 0;
    activeDriverDays.forEach((entry) => {
      const id = entry.split(':').slice(1).join(':');
      fixed += Number(motoboyById.get(id)?.fixedFee || 0);
    });

    return fixed + perDelivery;
  }, [deliveredOrders, motoboys]);

  const dateCaption = (() => {
    const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
    const endInclusive = addDays(periodInfo.end, -1);
    if (localDateKey(periodInfo.start) === localDateKey(endInclusive)) return fmt.format(periodInfo.start);
    return `${fmt.format(periodInfo.start)} a ${fmt.format(endInclusive)}`;
  })();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-5 shadow-sm">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-lg text-slate-900">Central financeira</h3>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${shift.isOpen ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
              {shift.isOpen ? '● Operação aberta' : '○ Operação fechada'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Faturamento, entregas, repasses e relatórios em um só lugar.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={onOpenSettlementModal} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5"><Receipt className="w-4 h-4" />Acerto dos motoboys</button>
          <button type="button" onClick={onOpenHistoryModal} className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-violet-600" />Relatórios & histórico</button>
          <button type="button" onClick={onOpenIntegrationsModal} className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 flex items-center gap-1.5"><Webhook className="w-3.5 h-3.5 text-blue-600" />Integrações</button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200">
        <button type="button" onClick={() => setSubTab('financeiro')} className={`px-3 py-2.5 text-xs font-semibold border-b-2 ${subTab === 'financeiro' ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500'}`}>Financeiro</button>
        <button type="button" onClick={() => setSubTab('integracoes')} className={`px-3 py-2.5 text-xs font-semibold border-b-2 ${subTab === 'integracoes' ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500'}`}>Conexões</button>
      </div>

      {subTab === 'financeiro' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 grid place-items-center shrink-0"><CalendarDays className="w-4 h-4 text-violet-600" /></div>
              <div><p className="text-xs font-semibold text-slate-800">Período</p><p className="text-[10px] text-slate-500">{periodInfo.label} · {dateCaption}</p></div>
            </div>
            <div className="inline-flex flex-wrap gap-1 bg-white border border-slate-200 rounded-lg p-1">
              {([
                ['today', 'Hoje'],
                ['yesterday', 'Ontem'],
                ['last7', 'Últimos 7 dias'],
                ['lastWeek', 'Semana passada'],
              ] as [PeriodKey, string][]).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setPeriod(key)} className={`h-8 px-3 rounded-md text-[11px] font-semibold transition ${period === key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 block">Faturamento</span>
              <span className="text-2xl font-semibold tracking-tight text-emerald-600 mt-1 block">{formattedCurrency(totalRevenue)}</span>
              <span className="text-[10px] text-slate-400 mt-1 block">{validOrders.length} pedido(s) no período</span>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 block">Entregas concluídas</span>
              <span className="text-2xl font-semibold tracking-tight text-slate-900 mt-1 block">{deliveredOrders.length}</span>
              <span className="text-[10px] text-slate-400 mt-1 block">{activeOrders.length} ainda em andamento no período</span>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 block">Repasse estimado da frota</span>
              <span className="text-2xl font-semibold tracking-tight text-amber-700 mt-1 block">{formattedCurrency(estimatedFleetPayout)}</span>
              <span className="text-[10px] text-slate-400 mt-1 block">Arranque + corridas concluídas no período</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div><h4 className="text-sm font-semibold text-slate-900">Acerto de caixa e diárias</h4><p className="text-xs text-slate-500">Consulte o que está em aberto e o que já foi quitado por entregador.</p></div>
            <button type="button" onClick={onOpenSettlementModal} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg border border-slate-200">Abrir folha de acerto</button>
          </div>
        </div>
      )}

      {subTab === 'integracoes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
            <div className="flex justify-between"><div><h4 className="font-semibold text-sm text-slate-900">Cardápio Web</h4><span className="text-[11px] text-slate-500">Integração oficial via API</span></div><span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${shift.cardapioWebStatus?.isOpen ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{shift.cardapioWebStatus?.isOpen ? '● Conectado' : '○ Fechado'}</span></div>
            <button type="button" onClick={() => onSyncCardapioWeb(true)} disabled={isSyncingCw} className="w-full py-2 px-3 bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex justify-center gap-1.5"><RotateCw className={`w-3.5 h-3.5 ${isSyncingCw ? 'animate-spin' : ''}`} />{isSyncingCw ? 'Sincronizando...' : 'Sincronizar pedidos agora'}</button>
          </div>
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3"><div><h4 className="font-semibold text-sm text-slate-900">iFood & outros canais</h4><span className="text-[11px] text-slate-500">Webhooks e integrações</span></div><button type="button" onClick={onOpenIntegrationsModal} className="w-full py-2 px-3 bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-200">Configurar integrações</button></div>
        </div>
      )}
    </div>
  );
};
