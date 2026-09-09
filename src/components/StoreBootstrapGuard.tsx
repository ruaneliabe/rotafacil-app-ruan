import { useLayoutEffect } from 'react';
import { subscribeToShift } from '../lib/firebase';

/**
 * Prevents the initial placeholder shift (setupRequired=true) from flashing the
 * account setup modal before Firestore returns the real configured store.
 * Genuine first setup still appears as soon as the authoritative shift arrives.
 */
export function StoreBootstrapGuard() {
  useLayoutEffect(() => {
    const style = document.createElement('style');
    style.id = 'rota-facil-store-bootstrap-guard';
    style.textContent = `
      body[data-rota-store-loading="1"] #root > div .fixed.inset-0.z-50 {
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
    document.body.setAttribute('data-rota-store-loading', '1');

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      document.body.removeAttribute('data-rota-store-loading');
      style.remove();
    };

    const unsubscribe = subscribeToShift(() => finish());
    // Never leave the interface hidden if Firestore is temporarily unavailable.
    const fallback = window.setTimeout(finish, 2500);

    return () => {
      unsubscribe();
      window.clearTimeout(fallback);
      finish();
    };
  }, []);

  return null;
}
