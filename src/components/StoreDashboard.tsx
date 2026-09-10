import React from 'react';
import { StoreDashboard as LegacyStoreDashboard } from './StoreDashboardLegacy';
import { TeamManagementPanel } from './TeamManagementPanel';

export const StoreDashboard: React.FC<any> = (props) => {
  return (
    <>
      <LegacyStoreDashboard {...props} />
      <TeamManagementPanel {...props} />
    </>
  );
};