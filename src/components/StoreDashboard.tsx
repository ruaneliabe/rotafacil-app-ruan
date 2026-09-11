import React, { useEffect, useMemo, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2, PauseCircle, PlayCircle } from 'lucide-react';
import { StoreDashboard as LegacyStoreDashboard } from './StoreDashboardLegacy';
import { TeamManagementPanel } from './TeamManagementPanel';
import { OperationManagementEnhancer } from './OperationManagementEnhancer';
import { DashboardUiBehaviorFixes } from './DashboardUiBehaviorFixes';
import { SidebarPolish } from './SidebarPolish';
import { CounterCallBridge } from './CounterCallBridge';
import { db } from '../lib/firebase';
import { getBrazilDateKey, getBrazilTimeString } from '../utils/dateUtils';

export const StoreDashboard: React.FC<any> = (props) => {
  const cloudOpen = Boolean(props.shift?.isOpen);
  const [optimisticOpen, setOptimisticOpen] = useState<boolean | null>(null);
  const [savingOperation, setSavingOperation] = useState(false);
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const operationOpen = optimisticOpen ?? cloudOpen;

  const hydrationSignature = useMemo(() => {
    const shift = props.shift || {};
    const orders = props.orders || [];
    const motoboys = props.motoboys || [];
    return [
      shift.id || '',
      shift.storeName || '',
      shift.shiftId || '',
      shift.isOpen ? '1' : '0',
      orders.length,
      orders.map((o: any) => `${o.id}:${o.status}:${o.assignedMotoboyId || ''}`).join('|'),
      motoboys.length,
      motoboys.map((m: any) => `${m.id}:${m.status}`).join('|'),
    ].join('::');
  }, [props.shift, props.orders, props.motoboys]);

  useEffect(() => {
    setCloudHydrated(false);
    const timer = window.setTimeout(() => setCloudHydrated(true), 420);
    return () => window.clearTimeout(timer);
  }, [hydrationSignature]);

  useEffect(() => {
    if (optimisticOpen !== null && cloudOpen === optimisticOpen) {
      setOptimisticOpen(null);
    }
  }, [cloudOpen, optimisticOpen]);

  const handleToggleOperation = async () => {
    if (savingOperation) return;

    const nextOpen = !operationOpen;
    const nowTimestamp = Date.now();
    const today = getBrazilDateKey();
    const nowTime = getBrazilTimeString();
    const sameDayOperation = Boolean(props.shift?.shiftId && props.shift?.shiftDate === today);

    setOptimisticOpen(nextOpen);
    setSavingOperation(true);

    try {
      if (nextOpen) {
        await setDoc(
          doc(db, 'shifts', 'current_shift'),
          {
            isOpen: true,
            setupRequired: false,
            pilotMode: true,
            demoDataDisabled: true,
            shiftDate: today,
            shiftId: sameDayOperation
              ? props.shift.shiftId
              : `shift_${today}_${nowTimestamp}`,
            openedAt: sameDayOperation
              ? (props.shift.openedAt || nowTime)
              : nowTime,
            openedTimestamp: sameDayOperation
              ? (props.shift.openedTimestamp || nowTimestamp)
              : nowTimestamp,
            closedAt: null,
            closedTimestamp: null,
          },
          { merge: true }
        );
      } else {
        await setDoc(
          doc(db, 'shifts', 'current_shift'),
          {
            isOpen: false,
            closedAt: nowTime,
            closedTimestamp: nowTimestamp,
          },
          { merge: true }
        );
      }
    } catch (error) {
      console.error('Falha ao alterar estado da operação:', error);
      setOptimisticOpen(null);
      window.alert('Não foi possível alterar o estado da operação. Verifique sua conexão e tente novamente.');
    } finally {
      setSavingOperation(false);
    }
  };

  const effectiveShift = {
    ...(props.shift || {}),
    isOpen: operationOpen,
  };

  const dashboardProps = {
    ...props,
    shift: effectiveShift,
    onToggleShift: handleToggleOperation,
  };

  if (!cloudHydrated) {
    return (
      <div className="flex min-h-[calc(100vh-32px)] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-600">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">Sincronizando operação</p>
            <p className="mt-1 text-[11px] text-slate-500">Carregando pedidos, entregadores e status da loja...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <LegacyStoreDashboard {...dashboardProps} />
      <TeamManagementPanel {...dashboardProps} />
      <OperationManagementEnhancer {...dashboardProps} />
      <DashboardUiBehaviorFixes />
      <SidebarPolish />
      <CounterCallBridge motoboys={props.motoboys || []} />

      <div className="fixed bottom-[76px] left-[14px] z-[90] hidden w-[178px] lg:block">
        <div className={`overflow-hidden rounded-2xl border bg-white shadow-[0_8px_26px_rgba(15,23,42,.08)] ${operationOpen ? 'border-emerald-200' : 'border-slate-200'}`}>
          <div className="px-3 py-3">
            <div className="flex items-center gap-2.5">
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${operationOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                {savingOperation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : operationOpen ? (
                  <PauseCircle className="h-4 w-4" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${operationOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <p className="truncate text-[11px] font-black text-slate-900">
                    {operationOpen ? 'Operação aberta' : 'Operação fechada'}
                  </p>
                </div>
                <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-slate-500">
                  {operationOpen ? 'Em andamento' : 'Parado'}
                </span>
              </div>
            </div>

            <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
              {savingOperation
                ? 'Salvando alteração...'
                : operationOpen
                  ? 'Sincronizado com a operação da loja.'
                  : 'Pode abrir manualmente fora do horário.'}
            </p>
          </div>

          <div className="border-t border-slate-100 p-2.5">
            <button
              type="button"
              onClick={handleToggleOperation}
              disabled={savingOperation}
              className={`flex h-9 w-full items-center justify-center rounded-xl text-[10px] font-black transition disabled:cursor-wait disabled:opacity-60 ${
                operationOpen
                  ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  : 'bg-violet-600 text-white shadow-sm hover:bg-violet-500'
              }`}
            >
              {savingOperation ? 'AGUARDE' : operationOpen ? 'ENCERRAR TURNO' : 'ABRIR TURNO'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
