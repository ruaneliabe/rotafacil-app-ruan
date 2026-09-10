import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, PackageCheck, Search, UserRound, WalletCards } from 'lucide-react';
import { Order } from '../types';
import { getBrazilDateKey } from '../utils/dateUtils';

interface DeliveredOrdersDashboardProps {
  orders: Order[];
}

const money = (value = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

const orderCode = (order: Order) => order.displayCode || `#${order.codeNumber}`;

const deliveryDateKey = (order: Order) => {
  const timestamp = Number(order.deliveredTimestamp || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '' : getBrazilDateKey(date);
};

const deliveredTime = (order: Order) => {
  const timestamp = Number(order.deliveredTimestamp || 0);
  if (timestamp > 0) {
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    }
  }
  return '--:--';
};

export const DeliveredOrdersDashboard: React.FC<DeliveredOrdersDashboardProps> = ({ orders }) => {
  const [query, setQuery] = useState('');
  const today = getBrazilDateKey();

  const currentShiftId = useMemo(() => {
    const withShift = orders
      .filter((order) => order.shiftId && order.createdDate === today)
      .sort((a, b) => Number(b.createdTimestamp || 0) - Number(a.createdTimestamp || 0));
    return withShift[0]?.shiftId || '';
  }, [orders, today]);

  const deliveredToday = useMemo(() => {
    return orders
      .filter((order) => {
        if (order.status !== 'delivered') return false;

        // Regra principal: o pedido precisa ter sido CRIADO hoje.
        // Isso evita que pedidos antigos encerrados/sincronizados hoje pelo Cardápio Web
        // apareçam no dashboard do dia atual.
        if (order.createdDate !== today) return false;

        // E a conclusão também precisa ter ocorrido hoje quando existe timestamp real.
        const deliveredDate = deliveryDateKey(order);
        if (deliveredDate && deliveredDate !== today) return false;

        // Quando temos turno atual, exige pertencer ao turno atual também.
        if (currentShiftId && order.shiftId) return order.shiftId === currentShiftId;

        return true;
      })
      .sort((a, b) => Number(b.deliveredTimestamp || 0) - Number(a.deliveredTimestamp || 0));
  }, [orders, today, currentShiftId]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return deliveredToday;
    return deliveredToday.filter((order) =>
      `${orderCode(order)} ${order.clientName} ${order.assignedMotoboyName || ''} ${order.address || ''}`
        .toLowerCase()
        .includes(normalized)
    );
  }, [deliveredToday, query]);

  const revenue = deliveredToday.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const deliveryFees = deliveredToday.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0);
  const uniqueDrivers = new Set(deliveredToday.map((order) => order.assignedMotoboyId).filter(Boolean)).size;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><PackageCheck className="h-4 w-4" /></span>
          <div>
            <h3 className="text-[15px] font-black text-slate-950">Pedidos entregues hoje</h3>
            <p className="mt-0.5 text-[10px] text-slate-400">Somente pedidos criados e entregues hoje.</p>
          </div>
        </div>
        <div className="relative w-full lg:w-[310px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pedido, cliente ou motoboy" className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[11px] outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-slate-100 bg-slate-50/60 p-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Entregues</span></div><p className="mt-2 text-xl font-black text-slate-950">{deliveredToday.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-violet-500" /><span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Faturamento</span></div><p className="mt-2 text-lg font-black text-slate-950">{money(revenue)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-amber-500" /><span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Taxas entrega</span></div><p className="mt-2 text-lg font-black text-slate-950">{money(deliveryFees)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-sky-500" /><span className="text-[9px] font-black uppercase tracking-wide text-slate-400">Motoboys</span></div><p className="mt-2 text-xl font-black text-slate-950">{uniqueDrivers}</p></div>
      </div>

      {visible.length ? (
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="sticky top-0 z-10 bg-white text-[9px] font-black uppercase tracking-wide text-slate-400 shadow-[0_1px_0_#f1f5f9]">
              <tr><th className="px-4 py-2.5">Pedido</th><th className="px-4 py-2.5">Cliente</th><th className="px-4 py-2.5">Motoboy</th><th className="px-4 py-2.5">Horário</th><th className="px-4 py-2.5">Taxa</th><th className="px-4 py-2.5 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3"><span className="text-[12px] font-black text-slate-950">{orderCode(order)}</span></td>
                  <td className="px-4 py-3"><p className="text-[11px] font-bold text-slate-700">{order.clientName}</p><p className="mt-0.5 max-w-[260px] truncate text-[9px] text-slate-400">{order.neighborhood || order.address}</p></td>
                  <td className="px-4 py-3 text-[11px] font-semibold text-slate-600">{order.assignedMotoboyName || '—'}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600"><Clock3 className="h-3 w-3 text-slate-400" />{deliveredTime(order)}</span></td>
                  <td className="px-4 py-3 text-[10px] font-semibold text-slate-600">{money(order.deliveryFee)}</td>
                  <td className="px-4 py-3 text-right text-[11px] font-black text-slate-950">{money(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex min-h-[150px] flex-col items-center justify-center px-5 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-50 text-slate-300"><PackageCheck className="h-5 w-5" /></span>
          <p className="mt-3 text-[12px] font-black text-slate-600">Nenhum pedido entregue hoje</p>
          <p className="mt-1 text-[10px] text-slate-400">Quando um pedido criado hoje for entregue, ele aparecerá aqui.</p>
        </div>
      )}
    </section>
  );
};

export default DeliveredOrdersDashboard;
