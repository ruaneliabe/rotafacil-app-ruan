import React, { useState } from 'react';
import { Stop, LocationPoint, StopStatus } from '../types';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  MoveUp,
  MoveDown,
  Trash2,
  Camera,
  ExternalLink,
  MapPin,
  Search,
  Filter,
  Phone,
  DollarSign,
  User,
  Home,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '../utils/geoUtils';

interface StopListProps {
  origin: LocationPoint;
  stops: Stop[];
  selectedStopId?: string | null;
  onSelectStop: (stop: Stop) => void;
  onUpdateStatus: (stopId: string, status: StopStatus) => void;
  onMoveStop: (index: number, direction: 'up' | 'down') => void;
  onDeleteStop: (stopId: string) => void;
  onOpenProofModal: (stop: Stop) => void;
  onEditOrigin: () => void;
}

export const StopList: React.FC<StopListProps> = ({
  origin,
  stops,
  selectedStopId,
  onSelectStop,
  onUpdateStatus,
  onMoveStop,
  onDeleteStop,
  onOpenProofModal,
  onEditOrigin,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredStops = stops.filter((stop) => {
    const matchesSearch =
      stop.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stop.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (stop.recipientName && stop.recipientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (stop.cep && stop.cep.includes(searchTerm));

    const matchesFilter = filterStatus === 'all' || stop.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* 1. Origin Depot Header Card */}
      <div className="p-3.5 bg-indigo-900 text-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-800 text-white flex items-center justify-center shrink-0 border border-indigo-700">
            <Home className="w-5 h-5 text-indigo-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-indigo-300">Ponto de Partida</span>
            </div>
            <h3 className="font-bold text-sm text-white truncate">{origin.name || 'Depósito Central'}</h3>
            <p className="text-xs text-indigo-200 truncate">{origin.address}</p>
          </div>
        </div>
        <button
          onClick={onEditOrigin}
          className="px-2.5 py-1.5 bg-indigo-800 hover:bg-indigo-700 text-indigo-100 rounded-lg text-xs font-semibold transition-all shrink-0 border border-indigo-700"
        >
          Alterar
        </button>
      </div>

      {/* 2. Controls & Search */}
      <div className="p-3 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row items-center gap-2">
        <div className="relative w-full sm:flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por cliente, endereço, CEP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 font-medium placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Todas ({stops.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setFilterStatus('delivered')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === 'delivered'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Entregues
          </button>
        </div>
      </div>

      {/* 3. Stop List Scrollable */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredStops.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <MapPin className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Nenhuma entrega encontrada</p>
            <p className="text-xs text-slate-400">Adicione novas paradas ou limpe seus filtros de busca.</p>
          </div>
        ) : (
          filteredStops.map((stop, idx) => {
            const isSelected = stop.id === selectedStopId;
            const originalIndex = stops.findIndex((s) => s.id === stop.id);

            return (
              <div
                key={stop.id}
                onClick={() => onSelectStop(stop)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/40 shadow-xs'
                    : stop.status === 'delivered'
                    ? 'border-emerald-200 bg-emerald-50/20 opacity-90'
                    : stop.status === 'failed'
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-slate-200/90 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Stop Number Badge */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        stop.status === 'delivered'
                          ? 'bg-emerald-500 text-white'
                          : stop.status === 'in_transit'
                          ? 'bg-blue-600 text-white'
                          : stop.status === 'failed'
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-800 text-white'
                      }`}
                    >
                      {stop.status === 'delivered' ? '✓' : stop.orderIndex}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-sm truncate">{stop.title}</h4>
                        {stop.priority === 'high' && (
                          <span className="px-1.5 py-0.2 text-[10px] font-bold uppercase bg-rose-100 text-rose-700 rounded">
                            Urgente
                          </span>
                        )}
                        {stop.deliveryWindow && (
                          <span className="px-1.5 py-0.2 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
                            🕒 {stop.deliveryWindow}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">{stop.address}</p>
                    </div>
                  </div>

                  {/* Move Up/Down Buttons */}
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveStop(originalIndex, 'up');
                      }}
                      disabled={originalIndex === 0}
                      className="p-1 hover:bg-slate-100 text-slate-500 disabled:opacity-30 rounded"
                      title="Mover para cima"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveStop(originalIndex, 'down');
                      }}
                      disabled={originalIndex === stops.length - 1}
                      className="p-1 hover:bg-slate-100 text-slate-500 disabled:opacity-30 rounded"
                      title="Mover para baixo"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Additional Info Row */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3 text-slate-600">
                    {stop.recipientName && (
                      <span className="flex items-center gap-1 text-[11px]">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {stop.recipientName}
                      </span>
                    )}
                    {stop.phone && (
                      <a
                        href={`tel:${stop.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {stop.phone}
                      </a>
                    )}
                    {stop.valueToReceive && stop.valueToReceive > 0 && (
                      <span className="flex items-center gap-0.5 font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
                        💰 {formatCurrency(stop.valueToReceive)}
                      </span>
                    )}
                  </div>

                  {/* Navigation & Action Links */}
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-semibold transition-all flex items-center gap-1"
                    >
                      Waze
                    </a>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-2 py-0.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-[11px] font-semibold transition-all flex items-center gap-1"
                    >
                      Maps
                    </a>
                  </div>
                </div>

                {/* Status Selector & Proof trigger */}
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(stop.id, 'pending');
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                        stop.status === 'pending'
                          ? 'bg-amber-100 text-amber-800 font-bold'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      Pendente
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(stop.id, 'in_transit');
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                        stop.status === 'in_transit'
                          ? 'bg-blue-100 text-blue-800 font-bold'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      Em Trânsito
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(stop.id, 'delivered');
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                        stop.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-800 font-bold'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      Entregue
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProofModal(stop);
                      }}
                      className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
                        stop.proofPhoto || stop.signature
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                      title="Comprovante de entrega (Foto/Assinatura)"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {stop.proofPhoto || stop.signature ? 'Comprovante ✓' : 'Comprovante'}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteStop(stop.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Remover parada"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
