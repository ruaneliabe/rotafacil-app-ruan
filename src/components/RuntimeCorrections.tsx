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

    // Give the store's main section navigation enough visual weight to read as navigation,
    // rather than as a tiny secondary filter bar.
    const style = document.createElement('style');
    style.id = 'rota-facil-runtime-navigation';
    style.textContent = `
      .runtime-primary-tabs {
        width: 100%;
        gap: 8px !important;
        padding: 4px !important;
      }

      .runtime-primary-tab {
        min-height: 46px !important;
        padding: 0 18px !important;
        border-radius: 10px !important;
        font-size: 13px !important;
        font-weight: 700 !important;
        letter-spacing: -0.01em;
        gap: 8px !important;
        white-space: nowrap;
      }

      .runtime-primary-tab::before {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 7px;
        background: rgba(51, 65, 85, 0.75);
        font-size: 12px;
        line-height: 1;
        flex: 0 0 auto;
      }

      .runtime-primary-tab[data-runtime-tab='operacao']::before { content: '⚡'; }
      .runtime-primary-tab[data-runtime-tab='equipe']::before { content: '👥'; }
      .runtime-primary-tab[data-runtime-tab='financeiro']::before { content: '💰'; }
      .runtime-primary-tab[data-runtime-tab='historico']::before { content: '◷'; }

      .runtime-primary-tab.bg-slate-800 {
        box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.28), 0 4px 12px rgba(0, 0, 0, 0.18) !important;
      }

      .runtime-primary-tab.bg-slate-800::before {
        background: rgba(59, 130, 246, 0.18);
      }

      .runtime-inline-complete-delivery {
        width: 100%;
        min-height: 52px;
        margin-top: 10px;
        margin-bottom: 8px;
        border-radius: 16px;
        border: 1px solid rgb(110 231 183);
        background: rgb(16 185 129);
        color: rgb(2 6 23);
        font-size: 14px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .01em;
        box-shadow: 0 8px 20px rgba(16, 185, 129, .18);
        cursor: pointer;
      }

      .runtime-inline-complete-delivery:active {
        transform: scale(.98);
      }

      @media (min-width: 900px) {
        .runtime-primary-tabs {
          max-width: 610px;
        }
      }

      @media (max-width: 640px) {
        .runtime-primary-tab {
          min-height: 44px !important;
          padding: 0 13px !important;
          font-size: 12px !important;
        }
      }
    `;
    document.head.appendChild(style);

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

      // Upgrade the store dashboard section navigation.
      const tabDefinitions = [
        { label: 'Operação', key: 'operacao' },
        { label: 'Equipe', key: 'equipe' },
        { label: 'Financeiro', key: 'financeiro' },
        { label: 'Histórico', key: 'historico' },
      ];
      const tabButtons = tabDefinitions
        .map(({ label, key }) => {
          const button = buttons.find((candidate) => candidate.textContent?.trim().startsWith(label));
          if (button) {
            button.classList.add('runtime-primary-tab');
            button.setAttribute('data-runtime-tab', key);
          }
          return button;
        })
        .filter(Boolean) as HTMLButtonElement[];

      if (tabButtons.length === tabDefinitions.length) {
        const parent = tabButtons[0].parentElement;
        if (parent && tabButtons.every((button) => button.parentElement === parent)) {
          parent.classList.add('runtime-primary-tabs');
        }
      }

      // Keep only the sticky one-handed arrival CTA when both arrival copies are rendered.
      if (arrivalButtons.length > 1) {
        arrivalButtons.forEach((button) => {
          if (!button.closest('.fixed')) {
            (button as HTMLElement).style.display = 'none';
          }
        });
      }

      // "Concluir entrega" belongs to the order card, not to a detached floating card.
      // We keep React's original handler as the source of truth and forward the inline
      // button click to it. This avoids duplicating delivery business logic.
      const floatingCompleteButton = buttons.find(
        (button) =>
          button.textContent?.trim().toLowerCase() === 'concluir entrega' &&
          Boolean(button.closest('.fixed'))
      ) as HTMLButtonElement | undefined;

      const existingInlineComplete = document.querySelector<HTMLButtonElement>('[data-runtime-inline-complete-delivery="1"]');

      if (floatingCompleteButton) {
        const floatingContainer = floatingCompleteButton.closest('.fixed') as HTMLElement | null;
        if (floatingContainer) floatingContainer.style.display = 'none';

        const detailsButton = buttons.find((button) => {
          const text = button.textContent?.trim().toLowerCase() || '';
          return text.includes('ver detalhes') || text.includes('ocultar detalhes');
        });
        const detailsWrapper = detailsButton?.parentElement;
        const orderContent = detailsWrapper?.parentElement;

        if (orderContent && detailsWrapper && !existingInlineComplete) {
          const inlineButton = document.createElement('button');
          inlineButton.type = 'button';
          inlineButton.setAttribute('data-runtime-inline-complete-delivery', '1');
          inlineButton.className = 'runtime-inline-complete-delivery';
          inlineButton.innerHTML = '✓ &nbsp; Concluir entrega';
          inlineButton.onclick = () => floatingCompleteButton.click();
          orderContent.insertBefore(inlineButton, detailsWrapper);
        }
      } else if (existingInlineComplete) {
        existingInlineComplete.remove();
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
      style.remove();
    };
  }, []);

  return null;
}
