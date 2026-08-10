import { useEffect } from 'react';
import { subscribeToMotoboys } from '../lib/firebase';

/**
 * Small compatibility layer for the current production UI.
 * Keeps high-risk visual fixes isolated while the operational state remains in Firestore.
 */
export function RuntimeCorrections() {
  useEffect(() => {
    let logoutInProgress = false;

    const clearMotoboySessionAndReturnToLogin = () => {
      if (logoutInProgress) return;
      logoutInProgress = true;

      try {
        localStorage.removeItem('rota_facil_session');
        localStorage.removeItem('rota_facil_active_motoboy_id');
        sessionStorage.removeItem('rota_facil_session');
        sessionStorage.removeItem('rota_facil_active_motoboy_id');
      } catch {
        // Storage may be unavailable in some private-browser modes.
      }

      window.location.replace(`${window.location.origin}${window.location.pathname}?login=1&t=${Date.now()}`);
    };

    // Global access guard. This runs independently from App/MotoboyApp rendering.
    // If a logged-in driver is removed (individually or via "Remover todos"),
    // Firestore is authoritative and the stale phone session is destroyed immediately.
    const unsubscribeSessionGuard = subscribeToMotoboys((cloudMotoboys) => {
      if (logoutInProgress) return;

      try {
        const rawSession = localStorage.getItem('rota_facil_session');
        if (!rawSession) return;

        const savedSession = JSON.parse(rawSession) as {
          role?: string;
          motoboyId?: string;
        };

        if (savedSession.role !== 'motoboy' || !savedSession.motoboyId) return;

        const currentDriver = cloudMotoboys.find((m) => m.id === savedSession.motoboyId) as
          | (typeof cloudMotoboys[number] & { accessRevokedAt?: number | null })
          | undefined;

        if (!currentDriver || Boolean(currentDriver.accessRevokedAt)) {
          clearMotoboySessionAndReturnToLogin();
        }
      } catch (err) {
        console.warn('Falha ao validar sessão global do motoboy:', err);
      }
    });

    const applyUiCorrections = () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const arrivalButtons = buttons.filter(
        (button) => button.textContent?.trim().toLowerCase() === 'cheguei ao local'
      );

      // Keep only the sticky one-handed CTA when both copies are rendered.
      if (arrivalButtons.length > 1) {
        arrivalButtons.forEach((button) => {
          if (!button.closest('.fixed')) {
            (button as HTMLElement).style.display = 'none';
          }
        });
      }

      // Paid orders: make it explicit that the delivery fee is the driver's earning,
      // not an amount to charge the customer.
      const elements = Array.from(document.querySelectorAll('span,div'));
      elements.forEach((element) => {
        const text = element.textContent?.trim() || '';
        if (!text.includes('Não cobrar')) return;
        const row = element.closest('.flex');
        if (!row) return;
        const candidates = Array.from(row.querySelectorAll('span'));
        const fee = candidates.find((span) => /^\+\s*R\$/.test(span.textContent?.trim() || ''));
        if (fee && !fee.textContent?.includes('Ganho')) {
          fee.textContent = `Ganho: ${fee.textContent?.trim()}`;
        }
      });

      // Store header wording: a driver can be active but not be in the queue.
      Array.from(document.querySelectorAll('span,p,div')).forEach((element) => {
        if (element.children.length > 0) return;
        const text = element.textContent || '';
        if (/\b1 motoboys ativos\b/i.test(text)) {
          element.textContent = text.replace(/1 motoboys ativos/i, '1 motoboy em operação');
        } else if (/\b(\d+) motoboys ativos\b/i.test(text)) {
          element.textContent = text.replace(/(\d+) motoboys ativos/i, '$1 motoboys em operação');
        }
      });
    };

    applyUiCorrections();
    const observer = new MutationObserver(applyUiCorrections);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    // Force a fresh daily snapshot shortly after midnight so "Hoje" becomes zero
    // even if no new Firestore event happens exactly at the date change.
    const now = new Date();
    const nextDay = new Date(now);
    nextDay.setHours(24, 0, 2, 0);
    const midnightTimer = window.setTimeout(() => window.location.reload(), nextDay.getTime() - now.getTime());

    return () => {
      unsubscribeSessionGuard();
      observer.disconnect();
      window.clearTimeout(midnightTimer);
    };
  }, []);

  return null;
}
