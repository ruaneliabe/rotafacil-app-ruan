import { useEffect, useRef } from 'react';
import { subscribeToShift } from '../lib/firebase';
import { StoreShift } from '../types';

export function CardapioWebShadowSyncBridge() {
  const shiftRef = useRef<StoreShift | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToShift((shift) => {
      shiftRef.current = shift;
    });

    let stopped = false;

    const runSync = async () => {
      const shift = shiftRef.current as any;
      const branches = (shift?.branches || [])
        .map((branch: any) => ({
          id: branch?.id,
          token: branch?.integrations?.cardapioWeb?.accountId,
        }))
        .filter((branch: any) =>
          ['hope_pizza', 'hope_burger'].includes(String(branch.id)) &&
          typeof branch.token === 'string' &&
          branch.token.trim().length > 10
        );

      if (stopped || branches.length === 0) return;

      try {
        await fetch('/api/cardapio-web-shadow-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branches }),
        });
      } catch (error) {
        console.warn('Falha na sincronização shadow do Cardápio Web:', error);
      }
    };

    const initialTimer = window.setTimeout(runSync, 1200);
    const interval = window.setInterval(runSync, 5000);

    return () => {
      stopped = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return null;
}
