import React, { useState } from 'react';
import { Stop } from '../types';
import { geocodeAddress } from '../utils/geoUtils';
import { X, FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportStops: (newStops: Omit<Stop, 'id' | 'orderIndex' | 'status'>[]) => void;
}

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
  onImportStops,
}) => {
  if (!isOpen) return null;

  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleImport = async () => {
    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: lines.length });

    const imported: Omit<Stop, 'id' | 'orderIndex' | 'status'>[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      setProgress({ current: i + 1, total: lines.length });

      try {
        const result = await geocodeAddress(line);
        if (result) {
          imported.push({
            title: `Entrega #${i + 1}`,
            address: result.address,
            cep: result.cep,
            lat: result.lat,
            lng: result.lng,
            priority: 'medium',
            valueToReceive: 18.0,
          });
        }
      } catch (err) {
        console.warn('Failed line:', line, err);
      }
    }

    setIsProcessing(false);
    if (imported.length > 0) {
      onImportStops(imported);
      setRawText('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">Importação em Lote por CEP ou Endereço</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600">
            Cole abaixo a sua lista de endereços ou CEPs (um por linha). O sistema vai localizar e adicionar todos à sua rota automaticamente!
          </p>

          <textarea
            rows={8}
            placeholder={`Exemplo:\n01310-100\nRua Augusta 1500, São Paulo\n01207-000\nAv. Brigadeiro Faria Lima 1800`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            disabled={isProcessing}
            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
          />

          {isProcessing && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-700 font-medium">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Processando endereços...
              </span>
              <span>
                {progress.current} / {progress.total}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={isProcessing || !rawText.trim()}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-600/30 disabled:opacity-50"
            >
              Processar Lista
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
