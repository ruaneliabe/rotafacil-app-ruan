import React, { useMemo, useState } from 'react';
import { X, Search, Bike, DollarSign, FileSpreadsheet, Printer } from 'lucide-react';
import { Order, Motoboy } from '../types';
import { getPaymentMethodLabel } from '../utils/paymentUtils';

interface DeliveryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  motoboys: Motoboy[];
  storeName?: string;
}

type Period = 'today' | 'yesterday' | '7days' | 'month' | 'all';

const dateOf = (order: Order) => new Date(order.deliveredTimestamp || order.deliveredAt || order.createdAt);
const money = (value = 0) => `R$ ${value.toFixed(2).replace('.', ',')}`;

export const DeliveryHistoryModal: React.FC<DeliveryHistoryModalProps> = ({
  isOpen, onClose, orders, motoboys, storeName = 'Rota Fácil Delivery'
}) => {
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('today');
  const [motoboyId, setMotoboyId] = useState('all');

  // Hooks must always run in the same order. The previous component returned before
  // these hooks while closed, which crashed React when the report was opened.
  const delivered = useMemo(() => orders.filter(o => o.status === 'delivered'), [orders]);

  const filtered = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startYesterday = new Date(startToday); startYesterday.setDate(startYesterday.getDate() - 1);
    const start7 = new Date(startToday); start7.setDate(start7.getDate() - 6);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const term = search.trim().toLowerCase();

    return delivered.filter(order => {
      const d = dateOf(order);
      if (period === 'today' && d < startToday) return false;
      if (period === 'yesterday' && (d < startYesterday || d >= startToday)) return false;
      if (period === '7days' && d < start7) return false;
      if (period === 'month' && d < startMonth) return false;
      if (motoboyId !== 'all' && order.assignedMotoboyId !== motoboyId) return false;
      if (!term) return true;
      return [order.codeNumber, order.clientName, order.address, order.neighborhood, order.assignedMotoboyName]
        .some(v => String(v || '').toLowerCase().includes(term));
    });
  }, [delivered, period, motoboyId, search]);

  const stats = useMemo(() => {
    const total = filtered.reduce((sum, o) => sum + (o.total || 0), 0);
    const fees = filtered.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
    return { count: filtered.length, total, fees };
  }, [filtered]);

  if (!isOpen) return null;

  const exportCsv = () => {
    const header = ['Pedido','Data','Cliente','Endereco','Motoboy','Pagamento','Taxa','Total'];
    const rows = filtered.map(o => [
      o.codeNumber,
      dateOf(o).toLocaleString('pt-BR'),
      o.clientName,
      o.address,
      o.assignedMotoboyName || '',
      getPaymentMethodLabel(o.paymentMethod),
      (o.deliveryFee || 0).toFixed(2).replace('.', ','),
      (o.total || 0).toFixed(2).replace('.', ',')
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    const blob = new Blob(['\uFEFF' + [header.join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `relatorio-entregas-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 md:p-6 flex items-center justify-center print:static print:bg-white print:p-0">
      <section className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl flex flex-col print:max-h-none print:border-0 print:bg-white">
        <header className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4 print:border-slate-300">
          <div><h2 className="text-lg font-bold text-white print:text-black">Relatórios & Histórico</h2><p className="text-xs text-slate-400">{storeName} · entregas concluídas</p></div>
          <div className="flex items-center gap-2 print:hidden">
            <button onClick={exportCsv} className="px-3 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 flex gap-2 items-center hover:bg-slate-800"><FileSpreadsheet size={15}/> Exportar CSV</button>
            <button onClick={() => window.print()} className="px-3 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 flex gap-2 items-center hover:bg-slate-800"><Printer size={15}/> Imprimir</button>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18}/></button>
          </div>
        </header>

        <div className="p-5 overflow-y-auto space-y-5">
          <div className="flex flex-wrap gap-2 items-center print:hidden">
            <div className="relative flex-1 min-w-[220px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pedido, cliente, endereço..." className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-violet-500"/></div>
            {(['today','yesterday','7days','month','all'] as Period[]).map(p => <button key={p} onClick={()=>setPeriod(p)} className={`px-3 py-2 rounded-lg text-xs font-semibold border ${period===p?'bg-violet-600 border-violet-500 text-white':'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>{p==='today'?'Hoje':p==='yesterday'?'Ontem':p==='7days'?'7 dias':p==='month'?'Este mês':'Todos'}</button>)}
            <select value={motoboyId} onChange={e=>setMotoboyId(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"><option value="all">Todos os motoboys</option>{motoboys.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-xs text-slate-400 flex items-center gap-2"><Bike size={15}/> Entregas</div><strong className="block text-2xl text-white mt-2">{stats.count}</strong></div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-xs text-slate-400 flex items-center gap-2"><DollarSign size={15}/> Valor dos pedidos</div><strong className="block text-2xl text-emerald-400 mt-2">{money(stats.total)}</strong></div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-xs text-slate-400">Taxas de entrega</div><strong className="block text-2xl text-sky-400 mt-2">{money(stats.fees)}</strong></div>
          </div>

          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-sm font-semibold text-white">Entregas concluídas</div>
            {filtered.length === 0 ? <div className="py-14 text-center text-sm text-slate-500">Nenhuma entrega encontrada neste período.</div> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-900/70 text-slate-400"><tr><th className="p-3 text-left">Pedido</th><th className="p-3 text-left">Data</th><th className="p-3 text-left">Cliente</th><th className="p-3 text-left">Motoboy</th><th className="p-3 text-right">Taxa</th><th className="p-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-800">{filtered.map(o=><tr key={o.id} className="text-slate-200"><td className="p-3 font-bold">#{o.codeNumber}</td><td className="p-3 whitespace-nowrap">{dateOf(o).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</td><td className="p-3"><div className="font-medium">{o.clientName}</div><div className="text-slate-500 max-w-[330px] truncate">{o.address}</div></td><td className="p-3">{o.assignedMotoboyName || '—'}</td><td className="p-3 text-right">{money(o.deliveryFee || 0)}</td><td className="p-3 text-right font-bold text-emerald-400">{money(o.total || 0)}</td></tr>)}</tbody></table></div>}
          </div>
        </div>
      </section>
    </div>
  );
};
