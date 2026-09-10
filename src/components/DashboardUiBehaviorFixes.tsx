import React, { useEffect } from 'react';

const replaceTextInNode = (node: Node) => {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const value = child.textContent || '';
      if (value.includes('Pedido de teste')) {
        child.textContent = value.replace(/Pedido de teste/g, 'Pedido');
      }
    } else {
      replaceTextInNode(child);
    }
  });
};

const isTeamTabActive = () => {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
  const teamButton = buttons.find((button) => button.textContent?.trim().startsWith('Entregadores'));
  if (!teamButton) return false;

  return (
    teamButton.className.includes('bg-violet-50') ||
    teamButton.className.includes('text-violet-900') ||
    teamButton.getAttribute('aria-current') === 'page'
  );
};

const getLegacyManagementOverlay = () => {
  return Array.from(document.querySelectorAll<HTMLElement>('.fixed.inset-0')).find((overlay) => {
    if (overlay.matches('[data-operation-enhanced-modal="true"]')) return false;
    const heading = Array.from(overlay.querySelectorAll('h2, h3')).find((el) => el.textContent?.trim() === 'Gestão de entrega');
    return Boolean(heading);
  }) || null;
};

const findLegacyCloseButton = (overlay: HTMLElement | null) => {
  if (!overlay) return null;
  const buttons = Array.from(overlay.querySelectorAll<HTMLButtonElement>('button'));

  return (
    buttons.find((button) => {
      const title = `${button.title || ''} ${button.getAttribute('aria-label') || ''}`.toLowerCase();
      return title.includes('fechar') || title.includes('close');
    }) ||
    buttons.find((button) => Boolean(button.querySelector('svg.lucide-x, svg[data-lucide="x"]'))) ||
    buttons.find((button) => button.textContent?.trim() === '×') ||
    null
  );
};

const closeLegacyManagementState = () => {
  const overlay = getLegacyManagementOverlay();
  if (!overlay) return false;

  const closeButton = findLegacyCloseButton(overlay);
  if (closeButton) {
    closeButton.click();
    return true;
  }

  return false;
};

const hideUselessAssignButtons = () => {
  const modal = document.querySelector<HTMLElement>('[data-operation-enhanced-modal="true"]');
  if (!modal) return;

  modal.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    if (button.textContent?.trim() === 'Atribuir') {
      button.style.display = 'none';
    }
  });
};

const openGlobalOrderModal = () => {
  const globalOrderButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) => {
    if (button.closest('[data-operation-enhanced-modal="true"]')) return false;
    const label = button.textContent?.trim() || '';
    return label === 'Pedido' || label === '+ Pedido' || label === 'Novo pedido';
  });

  globalOrderButton?.click();
};

export const DashboardUiBehaviorFixes: React.FC = () => {
  useEffect(() => {
    let reopeningManagement = false;

    const sync = () => {
      const teamHost = document.querySelector<HTMLElement>('[data-team-panel-host="true"]');
      if (teamHost) {
        teamHost.style.display = isTeamTabActive() ? '' : 'none';
      }

      document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        if (button.textContent?.includes('Pedido de teste')) {
          replaceTextInNode(button);
          button.setAttribute('aria-label', 'Pedido');
          if (button.title?.includes('Pedido de teste')) button.title = 'Pedido';
        }
      });

      hideUselessAssignButtons();
    };

    const reopenAfterLegacyCloses = (button: HTMLButtonElement, attempt = 0) => {
      const staleLegacy = getLegacyManagementOverlay();
      if (!staleLegacy) {
        reopeningManagement = false;
        button.click();
        return;
      }

      if (attempt === 0) closeLegacyManagementState();

      if (attempt >= 12) {
        reopeningManagement = false;
        staleLegacy.style.display = 'none';
        return;
      }

      window.setTimeout(() => reopenAfterLegacyCloses(button, attempt + 1), 50);
    };

    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest('button');
      if (!button) return;

      const label = button.textContent?.trim() || '';
      const enhancedModal = button.closest('[data-operation-enhanced-modal="true"]');

      if (label === 'Novo despacho' && enhancedModal) {
        event.preventDefault();
        event.stopPropagation();

        const closeButton = Array.from(enhancedModal.querySelectorAll<HTMLButtonElement>('button')).find((candidate) =>
          candidate.title === 'Fechar gestão de entrega'
        );

        closeButton?.click();
        window.setTimeout(openGlobalOrderModal, 300);
        return;
      }

      if (label === 'Atribuir' && enhancedModal) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // If the previous hidden legacy modal was left mounted, React still thinks
      // management is open. Reset that state first, then replay the user's click.
      if (label === 'Gestão de entrega' && !enhancedModal && getLegacyManagementOverlay() && !reopeningManagement) {
        event.preventDefault();
        event.stopPropagation();
        (event as any).stopImmediatePropagation?.();
        reopeningManagement = true;
        reopenAfterLegacyCloses(button);
        return;
      }

      if (button.title === 'Fechar gestão de entrega' && enhancedModal) {
        // Let the enhanced modal close itself, then guarantee the hidden legacy
        // React modal is also closed so the next open always works.
        window.setTimeout(closeLegacyManagementState, 0);
        window.setTimeout(closeLegacyManagementState, 100);
      }

      if (label.startsWith('Entregadores')) {
        requestAnimationFrame(sync);
        return;
      }

      if (
        label.includes('Pedidos e despacho') ||
        label === 'Kanban' ||
        label === 'Financeiro' ||
        label.includes('Gestão e fechamento')
      ) {
        const teamHost = document.querySelector<HTMLElement>('[data-team-panel-host="true"]');
        if (teamHost) teamHost.style.display = 'none';
        requestAnimationFrame(sync);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!document.querySelector('[data-operation-enhanced-modal="true"]')) return;
      window.setTimeout(closeLegacyManagementState, 0);
      window.setTimeout(closeLegacyManagementState, 100);
    };

    sync();
    document.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown, true);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKeyDown, true);
      observer.disconnect();
    };
  }, []);

  return null;
};
