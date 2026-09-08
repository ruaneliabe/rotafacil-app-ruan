import React, { useState } from 'react';
import {
  DollarSign,
  Receipt,
  BarChart3,
  Webhook,
  RotateCw,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
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
  const [subTab, setSubTab] = useState<'financeiro' | 'integracoes'>('financeiro');

  const formattedCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const activeOrders = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'failed'
  );
  const deliveredToday = orders.filter((o) => o.status === 'delivered');
  const totalRevenue = shift.isOpen
    ? orders.reduce((acc, o) => (o.status !== 'cancelled' ? acc + (o.total || 0) : acc), 0)
    : 0;

  const totalMotoboyCommission = shift.isOpen
    ? motoboys.reduce((acc, m) => acc + (m.totalEarnedToday || 0), 0)
    : 0;

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 sm:p-6 space-y-6 shadow-xl">
      {/* Top Header of Management */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-black text-lg text-white tracking-tight flex items-center gap-2">
              <span>⚙️ Central de Gestão</span>
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                shift.isOpen
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {shift.isOpen ? '● Turno Ativo' : '○ Loja Fechada'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fechamento de caixa, relatórios de entregas, diárias de motoboy e conexões com plataformas.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenSettlementModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>Acerto dos Motoboys</span>
          </button>
          <button
            type="button"
            onClick={onOpenHistoryModal}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Relatórios & Histórico</span>
          </button>
          <button
            type="button"
            onClick={onOpenIntegrationsModal}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Webhook className="w-3.5 h-3.5 text-blue-400" />
            <span>Integrações</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setSubTab('financeiro')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            subTab === 'financeiro'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          💰 Financeiro & Turno
        </button>
        <button
          type="button"
          onClick={() => setSubTab('integracoes')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            subTab === 'integracoes'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🔌 Conexões (iFood / Cardápio Web)
        </button>
      </div>

      {subTab === 'financeiro' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-bold text-slate-400 block">Faturamento Bruto (Turno)</span>
              <span className="text-2xl font-black text-emerald-400 mt-1 block">
                {formattedCurrency(totalRevenue)}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {shift.isOpen ? `${orders.length} pedidos hoje` : 'Turno fechado'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-xs font-bold text-slate-400 block">Entregas Concluídas</span>
              <span className="text-2xl font-black text-white mt-1 block">
                {deliveredToday.length}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {activeOrders.length} ainda em andamento
              </span>
            </div>

            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40">
              <span className="text-xs font-bold text-amber-300 block">Repasse da Frota</span>
              <span className="text-2xl font-black text-amber-200 mt-1 block">
                {formattedCurrency(totalMotoboyCommission)}
              </span>
              <span className="text-[11px] text-amber-400/80 mt-1 block">
                Taxas de entrega + diárias
              </span>
            </div>
          </div>

          <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Acerto de Caixa e Diárias</h4>
                <p className="text-xs text-slate-400">
                  Faça o fechamento individual ou coletivo da taxa de cada motoboy com comprovante impresso.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenSettlementModal}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer shrink-0 transition-all"
            >
              Abrir Folha de Acerto
            </button>
          </div>
        </div>
      )}

      {subTab === 'integracoes' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Cardápio Web */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🌐</span>
                  <div>
                    <h4 className="font-bold text-sm text-white">Cardápio Web</h4>
                    <span className="text-[11px] text-slate-400">Integração oficial via API</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                  shift.cardapioWebStatus?.isOpen
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                }`}>
                  {shift.cardapioWebStatus?.isOpen ? '● Conectado' : '○ Fechado'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Os pedidos do Cardápio Web caem diretamente na fila do Rota Fácil e atualizam o status para o cliente automaticamente.
              </p>
              <button
                type="button"
                onClick={() => onSyncCardapioWeb(true)}
                disabled={isSyncingCw}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isSyncingCw ? 'animate-spin text-blue-400' : ''}`} />
                <span>{isSyncingCw ? 'Sincronizando pedidos...' : 'Sincronizar Pedidos Agora'}</span>
              </button>
            </div>

            {/* iFood / Webhooks */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔴</span>
                  <div>
                    <h4 className="font-bold text-sm text-white">iFood & Outros Canais</h4>
                    <span className="text-[11px] text-slate-400">Webhooks e impressoras virtuais</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  Ativo
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Configure captura de pedidos de canais terceiros ou integre novos pontos de venda.
              </p>
              <button
                type="button"
                onClick={onOpenIntegrationsModal}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Webhook className="w-3.5 h-3.5 text-blue-400" />
                <span>Configurar Webhooks</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
