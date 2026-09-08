import { useEffect } from 'react';

/**
 * Read-only reconciliation with Cardápio Web.
 * The server endpoint owns the existing store credentials; the browser only triggers it.
 * This keeps Cardápio Web authoritative during the pilot without sending any Rota Fácil
 * action back to Cardápio Web.
 */
export function CardapioWebShadowSyncBridge() {
  useEffect(() => {
    let stopped = false;
    let running = false;

    const runSync = async () => {
      if (stopped || running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        const response = await fetch('/api/sync-cardapio-web', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          console.warn('Falha na reconciliação de status do Cardápio Web:', response.status);
        }
      } catch (error) {
        console.warn('Falha na reconciliação de status do Cardápio Web:', error);
      } finally {
        running = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') runSync();
    };

    const initialTimer = window.setTimeout(runSync, 800);
    const interval = window.setInterval(runSync, 5000);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopped = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return null;
}
