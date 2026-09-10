import React, { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2, PauseCircle, PlayCircle } from 'lucide-react';
import { StoreDashboard as LegacyStoreDashboard } from './StoreDashboardLegacy';
import { TeamManagementPanel } from './TeamManagementPanel';
import { OperationManagementEnhancer } from './OperationManagementEnhancer';
import { DashboardUiBehaviorFixes } from './DashboardUiBehaviorFixes';
import { CounterCallBridge } from './CounterCallBridge';
import { db } from '../lib/firebase';
import { getBrazilDateKey, getBrazilTimeString } from '../utils/dateUtils';

export const StoreDashboard: React.FC<any> = (props) => {
  const cloudOpen = Boolean(props.shift?.isOpen);
  const [optimisticOpen, setOptimisticOpen] = useState<boolean | null>(null);
  const [savingOperation, setSavingOperation] = useState(false);
  const operationOpen = optimisticOpen ?? cloudOpen;

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

  return (
    <>
      <LegacyStoreDashboard {...dashboardProps} />
      <TeamManagementPanel {...dashboardProps} />
      <OperationManagementEnhancer {...dashboardProps} />
      <DashboardUiBehaviorFixes />
      <CounterCallBridge motoboys={props.motoboys || []} />

      <div className="fixed bottom-[82px] left-[14px] z-[90] hidden w-[166px] lg:block">
        <button
          type="button"
          onClick={handleToggleOperation}
          disabled={savingOperation}
          className={`group w-full rounded-2xl border bg-white p-3 text-left shadow-[0_8px_30px_rgba(15,23,42,.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_34px_rgba(15,23,42,.12)] disabled:cursor-wait disabled:opacity-70 ${
            operationOpen ? 'border-emerald-200' : 'border-slate-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${operationOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
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
                <span className="text-[11px] font-black leading-tight text-slate-900">
                  {operationOpen ? 'Operação aberta' : 'Operação fechada'}
                </span>
              </div>
              <p className="mt-1 text-[9px] leading-snug text-slate-500">
                {savingOperation
                  ? 'Salvando alteração...'
                  : operationOpen
                    ? 'Clique para pausar a loja'
                    : 'Clique para iniciar a operação'}
              </p>
            </div>
          </div>

          <div className={`mt-3 flex h-8 items-center justify-center rounded-lg text-[10px] font-black transition ${
            operationOpen
              ? 'bg-slate-950 text-white group-hover:bg-slate-800'
              : 'bg-violet-600 text-white group-hover:bg-violet-500'
          }`}>
            {savingOperation ? 'AGUARDE' : operationOpen ? 'PAUSAR' : 'ABRIR LOJA'}
          </div>
        </button>
      </div>
    </>
  );
};
