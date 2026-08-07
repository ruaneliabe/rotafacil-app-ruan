import React, { useState } from 'react';
import { RouteConfig, TransportMode } from '../types';
import { X, Settings, Fuel, Bike, Car, Truck, DollarSign, Gauge } from 'lucide-react';

interface RouteSettingsModalProps {
  isOpen: boolean;
  config: RouteConfig;
  onClose: () => void;
  onSaveConfig: (newConfig: RouteConfig) => void;
}

export const RouteSettingsModal: React.FC<RouteSettingsModalProps> = ({
  isOpen,
  config,
  onClose,
  onSaveConfig,
}) => {
  if (!isOpen) return null;

  const [transportMode, setTransportMode] = useState<TransportMode>(config.transportMode);
  const [fuelConsumptionKmL, setFuelConsumptionKmL] = useState(config.fuelConsumptionKmL.toString());
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState(config.fuelPricePerLiter.toString());
  const [pricePerDelivery, setPricePerDelivery] = useState(config.pricePerDelivery.toString());
  const [fixedDailyCost, setFixedDailyCost] = useState(config.fixedDailyCost.toString());

  const handleModeChange = (mode: TransportMode) => {
    setTransportMode(mode);
    if (mode === 'moto') {
      setFuelConsumptionKmL('35');
    } else if (mode === 'car') {
      setFuelConsumptionKmL('12');
    } else if (mode === 'truck') {
      setFuelConsumptionKmL('6');
    } else {
      setFuelConsumptionKmL('999'); // Bicycle / Foot
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      ...config,
      transportMode,
      fuelConsumptionKmL: parseFloat(fuelConsumptionKmL) || 30,
      fuelPricePerLiter: parseFloat(fuelPricePerLiter) || 5.95,
      pricePerDelivery: parseFloat(pricePerDelivery) || 15.0,
      fixedDailyCost: parseFloat(fixedDailyCost) || 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base">Configurações de Veículo & Custos</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Transport Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Meio de Transporte</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleModeChange('moto')}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  transportMode === 'moto'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-xl">🛵</span>
                <span className="text-xs">Moto</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('car')}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  transportMode === 'car'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Car className="w-5 h-5" />
                <span className="text-xs">Carro</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('truck')}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  transportMode === 'truck'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Truck className="w-5 h-5" />
                <span className="text-xs">Caminhão</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Preço do Combustível (R$/L)</label>
              <div className="relative">
                <Fuel className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="number"
                  step="0.01"
                  value={fuelPricePerLiter}
                  onChange={(e) => setFuelPricePerLiter(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Autonomia (km por Litro)</label>
              <div className="relative">
                <Gauge className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="number"
                  step="1"
                  value={fuelConsumptionKmL}
                  onChange={(e) => setFuelConsumptionKmL(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Preço Padrão por Entrega (R$)</label>
              <input
                type="number"
                step="0.50"
                value={pricePerDelivery}
                onChange={(e) => setPricePerDelivery(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Custo Fixo Diário (R$)</label>
              <input
                type="number"
                step="1.00"
                value={fixedDailyCost}
                onChange={(e) => setFixedDailyCost(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-indigo-600/30"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
