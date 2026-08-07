import React, { useState, useRef } from 'react';
import { Stop } from '../types';
import { X, Camera, CheckCircle2, RotateCcw, Upload, FileText, User } from 'lucide-react';

interface ProofOfDeliveryModalProps {
  isOpen: boolean;
  stop: Stop | null;
  onClose: () => void;
  onSaveProof: (stopId: string, proofData: { proofPhoto?: string; signature?: string; recipientDoc?: string }) => void;
}

export const ProofOfDeliveryModal: React.FC<ProofOfDeliveryModalProps> = ({
  isOpen,
  stop,
  onClose,
  onSaveProof,
}) => {
  if (!isOpen || !stop) return null;

  const [photoUrl, setPhotoUrl] = useState<string>(stop.proofPhoto || '');
  const [recipientDoc, setRecipientDoc] = useState<string>(stop.recipientDoc || '');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // File upload reader
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Canvas Signature logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a'; // slate-900

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    let signatureData: string | undefined = undefined;
    const canvas = canvasRef.current;
    if (canvas) {
      signatureData = canvas.toDataURL();
    }

    onSaveProof(stop.id, {
      proofPhoto: photoUrl,
      signature: signatureData,
      recipientDoc,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-300" />
            <div>
              <h3 className="font-bold text-base">Comprovante de Entrega Digital</h3>
              <p className="text-xs text-emerald-100">{stop.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-emerald-200 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Recipient document */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do Recebedor / Documento (CPF ou RG)
            </label>
            <input
              type="text"
              placeholder="Ex: Carlos Eduardo (CPF: 123.456.789-00)"
              value={recipientDoc}
              onChange={(e) => setRecipientDoc(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Photo capture / upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Foto do Pacote ou Comprovante
            </label>
            {photoUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-48 bg-slate-900 flex items-center justify-center">
                <img src={photoUrl} alt="Comprovante" className="max-h-48 object-contain" />
                <button
                  type="button"
                  onClick={() => setPhotoUrl('')}
                  className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-white rounded-lg hover:bg-slate-900 text-xs font-semibold"
                >
                  Remover Foto
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-50 transition-all">
                <Camera className="w-8 h-8 text-slate-400 mb-1" />
                <span className="text-xs font-semibold text-slate-700">Tirar foto ou Anexar Imagem</span>
                <span className="text-[11px] text-slate-400 mt-0.5">JPEG, PNG ou WEBP</span>
                <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
              </label>
            )}
          </div>

          {/* Canvas Digital Signature */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Assinatura Digital do Cliente
              </label>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 hover:underline"
              >
                <RotateCcw className="w-3 h-3" /> Limpar Assinatura
              </button>
            </div>
            <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50 touch-none">
              <canvas
                ref={canvasRef}
                width={400}
                height={120}
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseMove={draw}
                onTouchStart={startDrawing}
                onTouchEnd={stopDrawing}
                onTouchMove={draw}
                className="w-full h-28 cursor-crosshair bg-white"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-600/30 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirmar & Marcar Entregue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
