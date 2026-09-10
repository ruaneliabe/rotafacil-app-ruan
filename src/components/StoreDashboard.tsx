import React from 'react';
import { StoreDashboard as LegacyStoreDashboard } from './StoreDashboardLegacy';
import { TeamManagementPanel } from './TeamManagementPanel';
import { OperationManagementEnhancer } from './OperationManagementEnhancer';
import { DashboardUiBehaviorFixes } from './DashboardUiBehaviorFixes';
import { CounterCallBridge } from './CounterCallBridge';

export const StoreDashboard: React.FC<any> = (props) => {
  return (
    <>
      <LegacyStoreDashboard {...props} />
      <TeamManagementPanel {...props} />
      <OperationManagementEnhancer {...props} />
      <DashboardUiBehaviorFixes />
      <CounterCallBridge motoboys={props.motoboys || []} />
    </>
  );
};