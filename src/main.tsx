import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {RuntimeCorrections} from './components/RuntimeCorrections';
import {CardapioWebShadowSyncBridge} from './components/CardapioWebShadowSyncBridge';
import {CardapioWebTerminalCleanup} from './components/CardapioWebTerminalCleanup';
import {StoreBootstrapGuard} from './components/StoreBootstrapGuard';
import {LiveOperationGuard} from './components/LiveOperationGuard';
import {DispatchBoardProductionPatch} from './components/DispatchBoardProductionPatch';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreBootstrapGuard />
    <RuntimeCorrections />
    <CardapioWebShadowSyncBridge />
    <CardapioWebTerminalCleanup />
    <LiveOperationGuard />
    <DispatchBoardProductionPatch />
    <App />
  </StrictMode>,
);
