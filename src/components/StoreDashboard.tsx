import React from 'react';
import { StoreDashboard as LegacyStoreDashboard } from './StoreDashboardLegacy';
import { TeamManagementPanel } from './TeamManagementPanel';
import { OperationManagementEnhancer } from './OperationManagementEnhancer';
import { DashboardUiBehaviorFixes } from './DashboardUiBehaviorFixes';

export const StoreDashboard: React.FC<any> = (props) => {
  return (
    <>
      <LegacyStoreDashboard {...props} />
      <TeamManagementPanel {...props} />
      <OperationManagementEnhancer {...props} />
      <DashboardUiBehaviorFixes />
    </>
  );
};