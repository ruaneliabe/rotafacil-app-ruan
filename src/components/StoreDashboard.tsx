import React from 'react';
import { StoreDashboard as LegacyStoreDashboard } from './StoreDashboardLegacy';
import { TeamManagementEnhancer } from './TeamManagementEnhancer';

export const StoreDashboard: React.FC<any> = (props) => {
  return (
    <>
      <LegacyStoreDashboard {...props} />
      <TeamManagementEnhancer {...props} />
    </>
  );
};
