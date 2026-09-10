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

const deliveredTime = (order: Order) => {
  if (order.deliveredAt) return order.deliveredAt;
  if (order.deliveredTimestamp) {
    return new Date(order.deliveredTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return '--:--';
};

export const DeliveredOrdersDashboard: React.FC<DeliveredOrdersDashboardProps> = ({ orders }) => {
  const [query, setQuery] = useState('');
  const today = getBrazilDateKey();

  const deliveredToday = useMemo(
    () => orders
      .filter((order) => order.status === 'delivered' && (order.deliveredDate === today || order.createdDate === today || order.shiftDate === today))
      .sort((a, b) => Number(b.deliveredTimestamp || b.createdTimestamp || 0) - Number(a.deliveredTimestamp || a.createdTimestamp || 0)),
    [orders, today]
  );

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return deliveredToday;
    return deliveredToday.filter((order) => `${orderCode(order)} ${order.clientName} ${order.assignedMotoboyName || ''} ${order.address || ''}`.toLowerCase().includes(normalized));
  }, [deliveredToday, query]);

  const revenue = deliveredToday.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const deliveryFees = deliveredToday.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0);
  const uniqueDrivers = new Set(deliveredToday.map((order) => order.assignedMotoboyId).filter(Boolean)).size;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><PackageCheck className="h-4 w-4" /></span>
            <div>
              <h3 className="text-[15px] font-black text-slate-950">Pedidos entregues hoje</h3>
              <p className="mt-0.5 text-[10px] text-slate-400">Resumo das entregas concluídas na operação de hoje.</p>
            </div>
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-white text-[9px] font-black uppercase tracking-wide text-slate-400">
              <tr><th className="px-4 py-2.5">Pedido</th><th className="px-4 py-2.5">Cliente</th><th className="px-4 py-2.5">Motoboy</th><th className="px-4 py-2.5">Horário</th><th className="px-4 py-2.5">Taxa</th><th className="px-4 py-2.5 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.slice(0, 8).map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3"><span className="font-black text-[12px] text-slate-950">{orderCode(order)}</span></td>
                  <td className="px-4 py-3"><p className="text-[11px] font-bold text-slate-700">{order.clientName}</p><p className="mt-0.5 max-w-[260px] truncate text-[9px] text-slate-400">{order.neighborhood || order.address}</p></td>
                  <td className="px-4 py-3 text-[11px] font-semibold text-slate-600">{order.assignedMotoboyName || '—'}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600"><Clock3 className="h-3 w-3 text-slate-400" />{deliveredTime(order)}</span></td>
                  <td className="px-4 py-3 text-[10px] font-semibold text-slate-600">{money(order.deliveryFee)}</td>
                  <td className="px-4 py-3 text-right text-[11px] font-black text-slate-950">{money(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length > 8 && <div className="border-t border-slate-100 px-4 py-2.5 text-center text-[10px] font-semibold text-slate-400">Mostrando 8 de {visible.length} entregas de hoje</div>}
        </div>
      ) : (
        <div className="flex min-h-[150px] flex-col items-center justify-center px-5 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-50 text-slate-300"><PackageCheck className="h-5 w-5" /></span>
          <p className="mt-3 text-[12px] font-black text-slate-600">Nenhum pedido entregue hoje</p>
          <p className="mt-1 text-[10px] text-slate-400">Quando uma entrega for concluída ela aparecerá aqui automaticamente.</p>
        </div>
      )}
    </section>
  );
};

export default DeliveredOrdersDashboard;
