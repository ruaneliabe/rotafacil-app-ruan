import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {RuntimeCorrections} from './components/RuntimeCorrections';
import {CardapioWebShadowSyncBridge} from './components/CardapioWebShadowSyncBridge';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RuntimeCorrections />
    <CardapioWebShadowSyncBridge />
    <App />
  </StrictMode>,
);
