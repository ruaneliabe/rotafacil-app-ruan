import { useEffect } from 'react';

const publish = (detail: Record<string, unknown>) => {
  window.dispatchEvent(new CustomEvent('rota:cardapio-web-health', { detail }));
};

/** Read-only reconciliation. Cardápio Web remains authoritative during the pilot. */
export function CardapioWebShadowSyncBridge() {
  useEffect(() => {
    let stopped = false;
    let running = false;
    let lastOkAt = 0;

    const post = async (url: string) => {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error(`${url}:${response.status}`);
      return response;
    };

    const runSync = async () => {
      if (stopped || running || document.visibilityState === 'hidden') return;
      running = true;
      publish({ state: 'syncing', lastOkAt });
      try {
        await post('/api/sync-cardapio-web');
        if (!stopped) await post('/api/reconcile-cardapio-web-couriers');
        if (!stopped) await post('/api/reconcile-cardapio-web-completed');
        lastOkAt = Date.now();
        publish({ state: 'ok', lastOkAt });
      } catch (error) {
        console.warn('Falha na reconciliação de status do Cardápio Web:', error);
        publish({ state: 'error', lastOkAt });
      } finally {
        running = false;
      }
    };

    const onVisibilityChange = () => document.visibilityState === 'visible' && runSync();
    const initialTimer = window.setTimeout(runSync, 500);
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
