import React, { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { StoreDashboard as LegacyStoreDashboard } from './StoreDashboardLegacy';
import { TeamManagementPanel } from './TeamManagementPanel';
import { OperationManagementEnhancer } from './OperationManagementEnhancer';
import { DashboardUiBehaviorFixes } from './DashboardUiBehaviorFixes';
import { CounterCallBridge } from './CounterCallBridge';
import { db } from '../lib/firebase';
import { getBrazilDateKey, getBrazilTimeString } from '../utils/dateUtils';

export const StoreDashboard: React.FC<any> = (props) => {
  const cloudOpen = Boolean(props.shift?.isOpen);
  const [operationOpen, setOperationOpen] = useState(cloudOpen);
  const [savingOperation, setSavingOperation] = useState(false);

  useEffect(() => {
    if (!savingOperation) setOperationOpen(cloudOpen);
  }, [cloudOpen, savingOperation]);

  const handleToggleOperation = async () => {
    if (savingOperation) return;

    const nextOpen = !operationOpen;
    const previousOpen = operationOpen;
    const nowTimestamp = Date.now();
    const today = getBrazilDateKey();
    const nowTime = getBrazilTimeString();
    const sameDayOperation = Boolean(props.shift?.shiftId && props.shift?.shiftDate === today);

    setOperationOpen(nextOpen);
    setSavingOperation(true);

    try {
      if (nextOpen) {
        // Abrir novamente no mesmo dia = RETOMAR. Não zera faturamento,
        // pedidos, caixa nem estatísticas dos entregadores.
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
        // Fechar funciona como uma pausa operacional. Mantemos todos os
        // acumulados do dia intactos para uma possível retomada.
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
      setOperationOpen(previousOpen);
    } finally {
      setSavingOperation(false);
    }
  };

  // Enquanto o snapshot do Firestore confirma o write, todos os painéis usam
  // o mesmo estado otimista. Isso faz o botão e os filtros mudarem na hora.
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
    </>
  );
};
