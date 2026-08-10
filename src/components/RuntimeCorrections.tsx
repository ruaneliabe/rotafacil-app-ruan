import { useEffect } from 'react';

/**
 * Small compatibility layer for the current production UI.
 * Keeps high-risk visual fixes isolated while the operational state remains in Firestore.
 */
export function RuntimeCorrections() {
  useEffect(() => {
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
      observer.disconnect();
      window.clearTimeout(midnightTimer);
    };
  }, []);

  return null;
}
