import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Calendar, 
  User, 
  Download, 
  Printer, 
  CheckCircle2, 
  DollarSign, 
  Bike, 
  MapPin, 
  Clock, 
  CreditCard,
  ChevronDown,
  FileSpreadsheet,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { Order, Motoboy } from '../types';

interface DeliveryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  motoboys: Motoboy[];
  storeName?: string;
}

export const DeliveryHistoryModal: React.FC<DeliveryHistoryModalProps> = ({
  isOpen,
  onClose,
  orders,
  motoboys,
  storeName = 'Rota Fácil Delivery'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMotoboyId, setSelectedMotoboyId] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'yesterday' | '7days' | 'month' | 'all'>('today');
  const [selectedPayment, setSelectedPayment] = useState<string>('all');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);

  if (!isOpen) return null;

  // Filter only completed/delivered or cancelled orders for history
  const deliveredOrders = useMemo(() => {
    return orders.filter(o => o.status === 'delivered' || o.status === 'cancelled');
  }, [orders]);

  // Apply period, motoboy, search, and payment filters
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    return deliveredOrders.filter(o => {
      // Status filter: only delivered for metrics
      if (o.status !== 'delivered') return false;

      // Date filtering
      const orderDateStr = o.deliveredAt ? o.deliveredAt.split('T')[0] : (o.createdAt ? o.createdAt.split('T')[0] : '');
      const orderDateObj = new Date(o.deliveredAt || o.createdAt);

      if (selectedPeriod === 'today' && orderDateStr !== todayStr) return false;
      if (selectedPeriod === 'yesterday' && orderDateStr !== yesterdayStr) return false;
      if (selectedPeriod === '7days' && orderDateObj < sevenDaysAgo) return false;
      if (selectedPeriod === 'month') {
        if (orderDateObj.getMonth() !== now.getMonth() || orderDateObj.getFullYear() !== now.getFullYear()) {
          return false;
        }
      }

      // Motoboy filter
      if (selectedMotoboyId !== 'all' && o.assignedMotoboyId !== selectedMotoboyId) {
        return false;
      }

      // Payment filter
      if (selectedPayment !== 'all' && o.paymentMethod !== selectedPayment) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const codeStr = `#${o.codeNumber}`.toLowerCase();
        const client = o.clientName.toLowerCase();
        const phone = o.clientPhone.toLowerCase();
        const address = o.address.toLowerCase();
        const neighborhood = (o.neighborhood || '').toLowerCase();
        const motoboy = (o.assignedMotoboyName || '').toLowerCase();

        return codeStr.includes(term) ||
          client.includes(term) ||
          phone.includes(term) ||
          address.includes(term) ||
          neighborhood.includes(term) ||
          motoboy.includes(term);
      }

      return true;
    });
  }, [deliveredOrders, selectedPeriod, selectedMotoboyId, selectedPayment, searchTerm]);

  // Aggregate metrics
  const totalDeliveries = filteredOrders.length;
  const totalSalesRevenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalDeliveryFees = filteredOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
  const avgDeliveryFee = totalDeliveries > 0 ? totalDeliveryFees / totalDeliveries : 0;

  // Breakdown by Motoboy
  const motoboyStats = useMemo(() => {
    const statsMap: Record<string, {
      motoboy: Motoboy | null;
      id: string;
      name: string;
      count: number;
      totalFees: number;
      totalSales: number;
      fixedFee: number;
      perDeliveryFee: number;
      calculatedPayout: number;
    }> = {};

    filteredOrders.forEach(o => {
      const mbId = o.assignedMotoboyId || 'unassigned';
      const mbName = o.assignedMotoboyName || 'Não Informado';

      if (!statsMap[mbId]) {
        const matchedMb = motoboys.find(m => m.id === mbId) || null;
        const fixed = matchedMb?.fixedFee || 0;
        const perDelivery = matchedMb?.perDeliveryFee || 0;

        statsMap[mbId] = {
          motoboy: matchedMb,
          id: mbId,
          name: mbName,
          count: 0,
          totalFees: 0,
          totalSales: 0,
          fixedFee: fixed,
          perDeliveryFee: perDelivery,
          calculatedPayout: fixed, // starts with daily fixed fee
        };
      }

      statsMap[mbId].count += 1;
      statsMap[mbId].totalFees += (o.deliveryFee || 0);
      statsMap[mbId].totalSales += (o.total || 0);
      statsMap[mbId].calculatedPayout += statsMap[mbId].perDeliveryFee;
    });

    return Object.values(statsMap);
  }, [filteredOrders, motoboys]);

  // Total payout to motoboys in selected filter
  const totalMotoboyPayout = useMemo(() => {
    return motoboyStats.reduce((sum, s) => sum + s.calculatedPayout, 0);
  }, [motoboyStats]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert('Nenhum pedido encontrado para exportar.');
      return;
    }

    const headers = [
      'Pedido',
      'Data/Hora Entrega',
      'Cliente',
      'Telefone',
      'Endereço',
      'Bairro',
      'Motoboy',
      'Pagamento',
      'Subtotal (R$)',
      'Taxa Entrega (R$)',
      'Total (R$)'
    ];

    const rows = filteredOrders.map(o => [
      `"#${o.codeNumber}"`,
      `"${o.deliveredAt ? new Date(o.deliveredAt).toLocaleString('pt-BR') : new Date(o.createdAt).toLocaleString('pt-BR')}"`,
      `"${o.clientName.replace(/"/g, '""')}"`,
      `"${o.clientPhone}"`,
      `"${o.address.replace(/"/g, '""')}"`,
      `"${(o.neighborhood || '').replace(/"/g, '""')}"`,
      `"${(o.assignedMotoboyName || 'N/A').replace(/"/g, '""')}"`,
      `"${o.paymentMethod.toUpperCase()}"`,
      (o.subtotal || 0).toFixed(2).replace('.', ','),
      (o.deliveryFee || 0).toFixed(2).replace('.', ','),
      (o.total || 0).toFixed(2).replace('.', ',')
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_entregas_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  const getPaymentBadge = (method: string) => {
    switch (method) {
      case 'pix':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-teal-950/80 text-teal-300 border border-teal-500/30">PIX</span>;
      case 'cartao_maquininha':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-950/80 text-blue-300 border border-blue-500/30">Cartão</span>;
      case 'dinheiro':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-500/30">Dinheiro</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300">{method}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 md:p-6 overflow-y-auto print:p-0 print:bg-white print:text-slate-900 print:static">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:bg-white print:text-slate-900">
        
        {/* Header (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                Histórico & Relatórios de Entregas
                <span className="text-xs font-extrabold px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  {totalDeliveries} {totalDeliveries === 1 ? 'concluída' : 'concluídas'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Resumo financeiro, controle de entregas e fechamento por motoboy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
              title="Exportar dados em formato CSV para Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Exportar Excel (CSV)</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
              title="Imprimir relatório completo"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              <span>Imprimir / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Header Visible ONLY during printing */}
        <div className="hidden print:block p-6 border-b border-slate-300">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black text-slate-900">{storeName}</h1>
              <p className="text-sm text-slate-600">Relatório de Entregas & Produtividade dos Motoboys</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Gerado em: {new Date().toLocaleString('pt-BR')}</p>
              <p>Filtro: {selectedPeriod.toUpperCase()} | Motoboy: {selectedMotoboyId === 'all' ? 'Todos' : motoboys.find(m => m.id === selectedMotoboyId)?.name || 'Específico'}</p>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar (Hidden on print) */}
        <div className="px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center gap-3 print:hidden">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por #pedido, cliente, rua, bairro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Period Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl text-xs">
            <button
              onClick={() => setSelectedPeriod('today')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedPeriod === 'today' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setSelectedPeriod('yesterday')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedPeriod === 'yesterday' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ontem
            </button>
            <button
              onClick={() => setSelectedPeriod('7days')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedPeriod === '7days' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              7 Dias
            </button>
            <button
              onClick={() => setSelectedPeriod('month')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedPeriod === 'month' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Este Mês
            </button>
            <button
              onClick={() => setSelectedPeriod('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedPeriod === 'all' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos
            </button>
          </div>

          {/* Motoboy Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedMotoboyId}
              onChange={(e) => setSelectedMotoboyId(e.target.value)}
              className="appearance-none bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">🛵 Todos os Motoboys</option>
              {motoboys.map((mb) => (
                <option key={mb.id} value={mb.id}>
                  🛵 {mb.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Payment Method Filter */}
          <div className="relative">
            <select
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value)}
              className="appearance-none bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">💳 Todos Pagamentos</option>
              <option value="pix">💚 PIX</option>
              <option value="cartao_maquininha">💳 Cartão Maquininha</option>
              <option value="dinheiro">💵 Dinheiro</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4">
            <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl print:bg-slate-100 print:border-slate-300">
              <div className="flex items-center justify-between text-slate-400 print:text-slate-600 mb-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wide">Total Entregas</span>
                <Bike className="w-4 h-4 text-emerald-400 print:text-slate-800" />
              </div>
              <div className="text-2xl font-black text-white print:text-slate-900">{totalDeliveries}</div>
              <p className="text-[10px] text-slate-500 print:text-slate-600 mt-1">Concluídas com sucesso</p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl print:bg-slate-100 print:border-slate-300">
              <div className="flex items-center justify-between text-slate-400 print:text-slate-600 mb-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wide">Faturamento Total</span>
                <DollarSign className="w-4 h-4 text-emerald-400 print:text-slate-800" />
              </div>
              <div className="text-2xl font-black text-emerald-400 print:text-slate-900">
                R$ {totalSalesRevenue.toFixed(2).replace('.', ',')}
              </div>
              <p className="text-[10px] text-slate-500 print:text-slate-600 mt-1">Vendas dos pedidos em rota</p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl print:bg-slate-100 print:border-slate-300">
              <div className="flex items-center justify-between text-slate-400 print:text-slate-600 mb-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wide">Taxas de Entrega</span>
                <TrendingUp className="w-4 h-4 text-blue-400 print:text-slate-800" />
              </div>
              <div className="text-2xl font-black text-blue-400 print:text-slate-900">
                R$ {totalDeliveryFees.toFixed(2).replace('.', ',')}
              </div>
              <p className="text-[10px] text-slate-500 print:text-slate-600 mt-1">Média R$ {avgDeliveryFee.toFixed(2).replace('.', ',')} / entrega</p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl print:bg-slate-100 print:border-slate-300">
              <div className="flex items-center justify-between text-slate-400 print:text-slate-600 mb-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wide">Repasse aos Motoboys</span>
                <Receipt className="w-4 h-4 text-amber-400 print:text-slate-800" />
              </div>
              <div className="text-2xl font-black text-amber-400 print:text-slate-900">
                R$ {totalMotoboyPayout.toFixed(2).replace('.', ',')}
              </div>
              <p className="text-[10px] text-slate-500 print:text-slate-600 mt-1">Diárias + Taxas por corrida</p>
            </div>
          </div>

          {/* Motoboy Productivity Breakdown Table */}
          {motoboyStats.length > 0 && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 print:bg-white print:border-slate-300">
              <h3 className="text-sm font-black text-white print:text-slate-900 mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                Resumo de Produtividade & Fechamento por Motoboy
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 print:text-slate-900">
                  <thead className="bg-slate-900 print:bg-slate-200 text-slate-400 print:text-slate-800 uppercase font-black">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Motoboy</th>
                      <th className="py-2.5 px-3 text-center">Entregas</th>
                      <th className="py-2.5 px-3 text-right">Taxas Arrecadadas</th>
                      <th className="py-2.5 px-3 text-right">Diária Fixa</th>
                      <th className="py-2.5 px-3 text-right">Comissão / Corrida</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Valor a Pagar ao Motoboy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 print:divide-slate-200 font-medium">
                    {motoboyStats.map((stat) => (
                      <tr key={stat.id} className="hover:bg-slate-900/40 print:hover:bg-transparent">
                        <td className="py-3 px-3 font-bold text-white print:text-slate-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          {stat.name}
                        </td>
                        <td className="py-3 px-3 text-center font-black text-emerald-400 print:text-slate-900">
                          {stat.count} {stat.count === 1 ? 'corrida' : 'corridas'}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-200 print:text-slate-900 font-bold">
                          R$ {stat.totalFees.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-400 print:text-slate-700">
                          R$ {stat.fixedFee.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-400 print:text-slate-700">
                          R$ {(stat.perDeliveryFee * stat.count).toFixed(2).replace('.', ',')} (R$ {stat.perDeliveryFee.toFixed(2)}/un)
                        </td>
                        <td className="py-3 px-3 text-right font-black text-amber-400 print:text-slate-900 text-sm">
                          R$ {stat.calculatedPayout.toFixed(2).replace('.', ',')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Orders Detailed Table */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 print:bg-white print:border-slate-300">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-white print:text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Listagem Detalhada dos Pedidos Entregues
              </h3>
              <span className="text-xs text-slate-500 print:text-slate-600 font-medium">
                Exibindo {filteredOrders.length} registros
              </span>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl text-slate-500">
                <Bike className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                <p className="text-sm font-bold">Nenhum pedido entregue encontrado com os filtros selecionados.</p>
                <p className="text-xs mt-1 text-slate-600">Tente alterar o período de data ou o motoboy selecionado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 print:text-slate-900">
                  <thead className="bg-slate-900 print:bg-slate-200 text-slate-400 print:text-slate-800 uppercase font-black">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Código</th>
                      <th className="py-2.5 px-3">Data & Hora</th>
                      <th className="py-2.5 px-3">Cliente & Endereço</th>
                      <th className="py-2.5 px-3">Motoboy</th>
                      <th className="py-2.5 px-3 text-center">Pagamento</th>
                      <th className="py-2.5 px-3 text-right">Taxa</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                      <th className="py-2.5 px-3 text-center rounded-r-lg print:hidden">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 print:divide-slate-200 font-medium">
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-900/40 print:hover:bg-transparent">
                        <td className="py-3 px-3 font-black text-emerald-400 print:text-slate-900">
                          #{o.codeNumber}
                        </td>
                        <td className="py-3 px-3 text-slate-400 print:text-slate-700 whitespace-nowrap">
                          {o.deliveredAt ? (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-500" />
                              {new Date(o.deliveredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                          )}
                          <div className="text-[10px] text-slate-600 print:text-slate-500">
                            {new Date(o.deliveredAt || o.createdAt).toLocaleDateString('pt-BR')}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-white print:text-slate-900">{o.clientName}</div>
                          <div className="text-[11px] text-slate-400 print:text-slate-700 truncate max-w-[240px]">
                            {o.address} ({o.neighborhood})
                          </div>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-200 print:text-slate-900 whitespace-nowrap">
                          {o.assignedMotoboyName ? (
                            <span className="flex items-center gap-1.5">
                              <Bike className="w-3.5 h-3.5 text-emerald-400" />
                              {o.assignedMotoboyName}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-normal">S/ Motoboy</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {getPaymentBadge(o.paymentMethod)}
                          {o.paymentMethod === 'dinheiro' && o.changeFor && (
                            <div className="text-[10px] text-amber-400 font-extrabold mt-0.5">
                              Troco R$ {(o.changeFor - o.total).toFixed(2).replace('.', ',')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-300 print:text-slate-900 font-bold whitespace-nowrap">
                          R$ {(o.deliveryFee || 0).toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-emerald-400 print:text-slate-900 whitespace-nowrap">
                          R$ {(o.total || 0).toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-3 px-3 text-center print:hidden">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderDetails(o)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                          >
                            Ver itens
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Modal footer summary / status (Hidden when printing) */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 print:hidden">
          <span>Exibindo histórico de pedidos entregues.</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>

      {/* Item Details Nested Modal */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="font-black text-white text-base">Pedido #{selectedOrderDetails.codeNumber}</h4>
                <p className="text-xs text-slate-400">{selectedOrderDetails.clientName} • {selectedOrderDetails.clientPhone}</p>
              </div>
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block font-bold mb-1">Endereço de Entrega:</span>
                <p className="text-slate-200">{selectedOrderDetails.address}</p>
                <p className="text-emerald-400 font-bold mt-1">Bairro: {selectedOrderDetails.neighborhood}</p>
              </div>

              {selectedOrderDetails.items && selectedOrderDetails.items.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="text-slate-400 font-bold block">Itens do Pedido:</span>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {selectedOrderDetails.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between p-2 bg-slate-950/60 rounded-lg text-slate-200">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="font-bold">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-950 rounded-lg text-slate-300">
                  <span className="text-slate-400 font-bold">Resumo:</span> {selectedOrderDetails.itemsSummary}
                </div>
              )}

              <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-sm font-black">
                <span className="text-slate-400">Total Pago:</span>
                <span className="text-emerald-400">R$ {selectedOrderDetails.total.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedOrderDetails(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
