import { useEffect } from 'react';

/**
 * Read-only reconciliation with Cardápio Web.
 * The server owns the existing store credentials; the browser only triggers it.
 * Cardápio Web remains authoritative during the pilot and no Rota Fácil action is sent back.
 */
export function CardapioWebShadowSyncBridge() {
  useEffect(() => {
    let stopped = false;
    let running = false;

    const post = async (url: string) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) console.warn(`Falha na reconciliação Cardápio Web (${url}):`, response.status);
    };

    const runSync = async () => {
      if (stopped || running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        // Primeiro mantém a sincronização normal. Depois revisa especificamente pedidos
        // que continuam em rota e força o webhook existente a consultar o detalhe remoto.
        await post('/api/sync-cardapio-web');
        if (!stopped) await post('/api/reconcile-cardapio-web-completed');
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
