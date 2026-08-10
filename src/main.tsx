import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {RuntimeCorrections} from './components/RuntimeCorrections';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RuntimeCorrections />
    <App />
  </StrictMode>,
);
