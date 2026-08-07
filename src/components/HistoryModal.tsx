import React, { useState, useEffect } from 'react';
import { SavedRoute, Stop, RouteConfig, RouteSummary } from '../types';
import { X, History, Save, Trash2, ArrowRight, Calendar, MapPin, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDuration } from '../utils/geoUtils';

interface HistoryModalProps {
  isOpen: boolean;
  currentStops: Stop[];
  currentConfig: RouteConfig;
  currentSummary: RouteSummary;
  onClose: () => void;
  onLoadSavedRoute: (savedRoute: SavedRoute) => void;
}

const LOCAL_STORAGE_KEY = 'rota_facil_saved_routes_v1';

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  currentStops,
  currentConfig,
  currentSummary,
  onClose,
  onLoadSavedRoute,
}) => {
  if (!isOpen) return null;

  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [newTitle, setNewTitle] = useState('');

  // Load saved routes on mount
  useEffect(() => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (data) {
        setSavedRoutes(JSON.parse(data));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStops.length === 0) return;

    const titleToSave = newTitle.trim() || `Rota ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    const newSaved: SavedRoute = {
      id: 'route-' + Date.now(),
      title: titleToSave,
      createdAt: new Date().toISOString(),
      stops: currentStops,
      config: currentConfig,
      summary: currentSummary,
    };

    const updated = [newSaved, ...savedRoutes];
    setSavedRoutes(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    setNewTitle('');
  };

  const handleDeleteRoute = (id: string) => {
    const updated = savedRoutes.filter((r) => r.id !== id);
    setSavedRoutes(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base">Histórico de Rotas Salvas</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Save current route form */}
          <form onSubmit={handleSaveCurrent} className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-indigo-900">Salvar Rota Atual no Histórico</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nome da rota (ex: Entregas Z/Sul Terça-Feira)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-white rounded-lg border border-indigo-200 text-xs font-medium text-slate-800 focus:outline-none"
              />
              <button
                type="submit"
                disabled={currentStops.length === 0}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> Salvar
              </button>
            </div>
          </form>

          {/* Saved routes list */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase">Rotas Salvas</h4>
            {savedRoutes.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Nenhuma rota salva no histórico ainda.</p>
            ) : (
              savedRoutes.map((route) => (
                <div
                  key={route.id}
                  className="p-3 rounded-xl border border-slate-200/80 bg-white hover:border-indigo-300 transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <h5 className="font-bold text-slate-800 text-sm truncate">{route.title}</h5>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                      <span>📦 {route.stops.length} entregas</span>
                      <span>🛣️ {route.summary.totalDistanceKm} km</span>
                      <span>💰 {formatCurrency(route.summary.netProfit)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        onLoadSavedRoute(route);
                        onClose();
                      }}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs flex items-center gap-1"
                    >
                      Carregar <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteRoute(route.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
