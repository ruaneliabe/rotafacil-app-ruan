import React from 'react';
import { StoreDashboard as LegacyStoreDashboard } from './StoreDashboardLegacy';
import { TeamManagementPanel } from './TeamManagementPanel';
import { OperationManagementEnhancer } from './OperationManagementEnhancer';
import { SingleOrderActionEnhancer } from './SingleOrderActionEnhancer';

export const StoreDashboard: React.FC<any> = (props) => {
  return (
    <>
      <LegacyStoreDashboard {...props} />
      <TeamManagementPanel {...props} />
      <OperationManagementEnhancer {...props} />
      <SingleOrderActionEnhancer />
    </>
  );
};