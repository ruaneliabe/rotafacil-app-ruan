import { useEffect } from 'react';

const publish = (detail: Record<string, unknown>) => {
  window.dispatchEvent(new CustomEvent('rota:cardapio-web-health', { detail }));
};

const SYNC_INTERVAL_MS = 60_000;
const MIN_SYNC_GAP_MS = 45_000;

/** Read-only reconciliation. Cardápio Web remains authoritative during the pilot. */
export function CardapioWebShadowSyncBridge() {
  useEffect(() => {
    let stopped = false;
    let running = false;
    let lastOkAt = 0;
    let lastAttemptAt = 0;

    const post = async (url: string) => {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error(`${url}:${response.status}`);
      return response;
    };

    const runSync = async (force = false) => {
      if (stopped || running || document.visibilityState === 'hidden') return;

      const now = Date.now();
      if (!force && now - lastAttemptAt < MIN_SYNC_GAP_MS) return;
      lastAttemptAt = now;

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

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void runSync();
    };

    // Pequeno atraso inicial evita rajadas enquanto a aplicação ainda monta/login restaura.
    const initialTimer = window.setTimeout(() => void runSync(true), 3_000);
    const interval = window.setInterval(() => void runSync(), SYNC_INTERVAL_MS);
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
