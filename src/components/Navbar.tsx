import React from 'react';
import { RouteSummary, RouteConfig } from '../types';
import {
  Zap,
  Plus,
  FileSpreadsheet,
  Share2,
  Settings,
  History,
  Navigation,
  CheckCircle2,
  Clock,
  Gauge,
  DollarSign,
  Fuel,
} from 'lucide-react';
import { formatCurrency, formatDuration } from '../utils/geoUtils';

interface NavbarProps {
  summary: RouteSummary;
  config: RouteConfig;
  onOptimize: () => void;
  onAddStop: () => void;
  onBatchImport: () => void;
  onOpenWhatsApp: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onLoadDemo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  summary,
  config,
  onOptimize,
  onAddStop,
  onBatchImport,
  onOpenWhatsApp,
  onOpenSettings,
  onOpenHistory,
  onLoadDemo,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Navigation className="w-5 h-5 -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Rota Fácil</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 uppercase">
                  v2.0 PRO
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Otimizador Inteligente de Entregas</p>
            </div>
          </div>

          {/* Quick Demo button on mobile */}
          <button
            onClick={onLoadDemo}
            className="md:hidden text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100"
          >
            Carregar Exemplo
          </button>
        </div>

        {/* Top Summary Stats Bar */}
        <div className="hidden lg:flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/60 text-xs">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <div>
              <span className="text-slate-400 block text-[10px]">Entregas</span>
              <span className="font-bold text-slate-800">
                {summary.completedStopsCount} / {summary.totalStopsCount}
              </span>
            </div>
          </div>
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-indigo-600" />
            <div>
              <span className="text-slate-400 block text-[10px]">Distância</span>
              <span className="font-bold text-slate-800">{summary.totalDistanceKm} km</span>
            </div>
          </div>
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            <div>
              <span className="text-slate-400 block text-[10px]">Tempo Total</span>
              <span className="font-bold text-slate-800">{formatDuration(summary.totalDurationMinutes)}</span>
            </div>
          </div>
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex items-center gap-1.5">
            <Fuel className="w-4 h-4 text-rose-500" />
            <div>
              <span className="text-slate-400 block text-[10px]">Combustível</span>
              <span className="font-bold text-slate-800">{formatCurrency(summary.estimatedFuelCost)}</span>
            </div>
          </div>
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <div>
              <span className="text-slate-400 block text-[10px]">Lucro Est.</span>
              <span className="font-bold text-emerald-700">{formatCurrency(summary.netProfit)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={onOptimize}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm shadow-indigo-600/30 whitespace-nowrap"
            title="Reorganiza a ordem das paradas para fazer o menor caminho"
          >
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
            Otimizar Rota
          </button>

          <button
            onClick={onAddStop}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-3 py-2 rounded-xl transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Nova Parada
          </button>

          <button
            onClick={onBatchImport}
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs px-2.5 py-2 rounded-xl transition-all whitespace-nowrap"
            title="Importar lista de CEPs ou endereços"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Lote
          </button>

          <button
            onClick={onOpenWhatsApp}
            className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium text-xs px-2.5 py-2 rounded-xl transition-all border border-emerald-200/60 whitespace-nowrap"
            title="Enviar roteiro via WhatsApp"
          >
            <Share2 className="w-4 h-4" />
            WhatsApp
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            title="Configurações de Veículo & Custos"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenHistory}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            title="Histórico de Rotas Salvas"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
