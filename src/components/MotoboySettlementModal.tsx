import React, { useState } from 'react';
import { Motoboy, Order } from '../types';
import { DollarSign, CheckCircle2, Printer, X, Bike, AlertCircle, FileText, Download } from 'lucide-react';

const logoImg = '/src/assets/images/hope_burger_logo_1786042748845.jpg';

interface MotoboySettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  motoboys: Motoboy[];
  orders: Order[];
}

export const MotoboySettlementModal: React.FC<MotoboySettlementModalProps> = ({
  isOpen,
  onClose,
  motoboys,
  orders,
}) => {
  const [selectedMotoboyId, setSelectedMotoboyId] = useState<string>(
    motoboys[0]?.id || ''
  );
  const [isSettled, setIsSettled] = useState(false);

  if (!isOpen) return null;

  const currentMotoboy = motoboys.find((m) => m.id === selectedMotoboyId) || motoboys[0];

  // Delivered orders by this motoboy
  const motoboyOrders = orders.filter((o) => {
    if (o.status !== 'delivered') return false;
    if (!currentMotoboy) return false;
    const assignedId = (o.assignedMotoboyId || '').toLowerCase().trim();
    const assignedName = (o.assignedMotoboyName || '').toLowerCase().trim();
    const mId = (currentMotoboy.id || '').toLowerCase().trim();
    const mName = (currentMotoboy.name || '').toLowerCase().trim();
    const mUsername = (currentMotoboy.username || '').toLowerCase().trim();

    return (
      (mId && assignedId === mId) ||
      (mName && assignedName === mName) ||
      (mUsername && assignedId === mUsername) ||
      (mName && assignedId === mName) ||
      (mName && assignedName.includes(mName))
    );
  });

  const cashOrders = motoboyOrders.filter(
    (o) => o.paymentMethod.toLowerCase() === 'dinheiro'
  );

  const cardPixOrders = motoboyOrders.filter(
    (o) => o.paymentMethod.toLowerCase() !== 'dinheiro'
  );

  // Total cash collected by motoboy from clients
  const totalCashCollected = cashOrders.reduce((sum, o) => sum + o.total, 0);

  // Earnings: Fixed daily + delivery fees
  const deliveryCommission = motoboyOrders.length * (currentMotoboy?.perDeliveryFee || 6.5);
  const fixedDailyFee = currentMotoboy?.fixedFee || 40.0;
  const totalEarnings = fixedDailyFee + deliveryCommission;

  // Net calculation:
  // If motoboy collected cash: Motoboy owes Cash Collected minus Total Earnings to the store (or store pays motoboy if earnings > cash)
  const netDifference = totalCashCollected - totalEarnings;

  const handlePrintSettlement = () => {
    const printWindow = window.open('', '_blank', 'width=450,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Acerto de Caixa - ${currentMotoboy?.name}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; font-size: 13px; color: #111; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            .title { font-size: 18px; font-weight: bold; }
            .row { display: flex; justify-content: space-between; margin: 6px 0; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #ccc; margin: 10px 0; }
            .box { background: #f4f4f4; padding: 10px; border-radius: 8px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">HOPE BURGER & PIZZAS</div>
            <div>FECHAMENTO & ACERTO DE CAIXA DE ENTREGADOR</div>
            <div>Data: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</div>
          </div>

          <div><span class="bold">Entregador:</span> ${currentMotoboy?.name}</div>
          <div><span class="bold">Veículo:</span> ${currentMotoboy?.vehicleModel} (${currentMotoboy?.plate})</div>
          <div><span class="bold">Total de Entregas Realizadas:</span> ${motoboyOrders.length}</div>

          <div class="line"></div>
          <div class="bold">RESUMO DE VALORES:</div>
          <div class="row"><span>Arranque:</span><span>R$ ${fixedDailyFee.toFixed(2)}</span></div>
          <div class="row"><span>Comissão de Entregas (${motoboyOrders.length}x):</span><span>R$ ${deliveryCommission.toFixed(2)}</span></div>
          <div class="row bold"><span>Total a Receber pelo Entregador:</span><span>R$ ${totalEarnings.toFixed(2)}</span></div>

          <div class="line"></div>
          <div class="bold">VALORES RECOLHIDOS DO CLIENTE:</div>
          <div class="row"><span>Em Dinheiro (Espécie):</span><span>R$ ${totalCashCollected.toFixed(2)}</span></div>
          <div class="row"><span>Cartão / Pix:</span><span>R$ ${cardPixOrders.reduce((acc, o) => acc + o.total, 0).toFixed(2)}</span></div>

          <div class="box">
            <div class="row bold" style="font-size: 16px;">
              <span>${netDifference >= 0 ? 'MOTOBOY ENTREGA AO BALCÃO:' : 'LOJA PAGA AO MOTOBOY:'}</span>
              <span>R$ ${Math.abs(netDifference).toFixed(2)}</span>
            </div>
          </div>

          <div style="margin-top: 40px; display: flex; justify-content: space-between;">
            <div style="border-top: 1px solid #000; width: 45%; text-align: center; padding-top: 5px;">Assinatura Loja</div>
            <div style="border-top: 1px solid #000; width: 45%; text-align: center; padding-top: 5px;">Assinatura Entregador</div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 text-slate-100 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Hope Logo" className="w-9 h-9 rounded-xl border border-slate-700 object-cover" />
            <div>
              <h3 className="font-extrabold text-white text-base">Fechamento & Acerto de Caixa</h3>
              <p className="text-xs text-slate-400 font-medium">Prestação de contas diária do entregador</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* Motoboy Selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 block text-xs">Selecione o Entregador:</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {motoboys.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedMotoboyId(m.id);
                    setIsSettled(false);
                  }}
                  className={`p-2.5 rounded-xl border font-bold text-left transition-all cursor-pointer ${
                    m.id === currentMotoboy?.id
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className="truncate font-extrabold">{m.name}</div>
                  <div className="text-[10px] opacity-80 font-normal">
                    {orders.filter((o) => o.assignedMotoboyId === m.id && o.status === 'delivered').length} entregas
                  </div>
                </button>
              ))}
            </div>
          </div>

          {currentMotoboy && (
            <div className="space-y-4">
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400">Entregas Concluídas</span>
                  <div className="text-xl font-extrabold text-white">{motoboys.length > 0 ? motoboyOrders.length : 0} pedidos</div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-emerald-400">Ganho Total Motoboy</span>
                  <div className="text-xl font-extrabold text-emerald-400">R$ {totalEarnings.toFixed(2)}</div>
                  <span className="text-[10px] text-slate-400 block">Arranque: R$ {fixedDailyFee} + Taxas</span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-amber-400">Dinheiro Em Mãos</span>
                  <div className="text-xl font-extrabold text-amber-300">R$ {totalCashCollected.toFixed(2)}</div>
                  <span className="text-[10px] text-slate-400 block">{cashOrders.length} pedidos em espécie</span>
                </div>
              </div>

              {/* Net Settlement Balance Card */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-300 uppercase tracking-wide">
                    RESULTADO FINAL DO ACERTO:
                  </span>
                  {isSettled && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-slate-950">
                      ✓ Caixa Quitado
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-baseline justify-between gap-2">
                  <div>
                    <h4 className="text-base font-extrabold text-white">
                      {netDifference >= 0
                        ? `Motoboy DEVE entregar no balcão:`
                        : `Loja DEVE pagar ao motoboy:`}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {netDifference >= 0
                        ? 'O motoboy recolheu mais dinheiro em espécie do que tem a receber em arranque/taxas.'
                        : 'O motoboy tem mais arranque/taxas a receber do que recolheu em dinheiro.'}
                    </p>
                  </div>
                  <div className="text-2xl font-black text-amber-400 shrink-0">
                    R$ {Math.abs(netDifference).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Order List Table */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <span className="font-bold text-xs text-slate-300 block">
                  Detalhamento das Entregas de {currentMotoboy.name}:
                </span>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {motoboyOrders.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">
                      Nenhuma entrega finalizada ainda por este motoboy hoje.
                    </div>
                  ) : (
                    motoboyOrders.map((o) => (
                      <div
                        key={o.id}
                        className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-white">#{o.codeNumber} - {o.clientName}</span>
                          <span className="text-[11px] text-slate-400 block">{o.address} ({o.neighborhood})</span>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-emerald-400 block">R$ {o.total.toFixed(2)}</span>
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            {o.paymentMethod}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => {
              setIsSettled(true);
            }}
            className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" /> Marcar Caixa como Quitado
          </button>

          <button
            type="button"
            onClick={handlePrintSettlement}
            className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-extrabold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4 text-slate-300" /> Imprimir Comprovante
          </button>
        </div>
      </div>
    </div>
  );
};
