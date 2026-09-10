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

    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest('button');
      if (!button) return;

      const label = button.textContent?.trim() || '';

      if (label === 'Novo despacho' && button.closest('[data-operation-enhanced-modal="true"]')) {
        event.preventDefault();
        event.stopPropagation();

        const modal = button.closest('[data-operation-enhanced-modal="true"]');
        const closeButton = Array.from(modal?.querySelectorAll<HTMLButtonElement>('button') || []).find((candidate) =>
          candidate.title === 'Fechar gestão de entrega'
        );

        closeButton?.click();
        window.setTimeout(openGlobalOrderModal, 300);
        return;
      }

      if (label === 'Atribuir' && button.closest('[data-operation-enhanced-modal="true"]')) {
        event.preventDefault();
        event.stopPropagation();
        return;
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

    sync();
    document.addEventListener('click', onClick, true);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    return () => {
      document.removeEventListener('click', onClick, true);
      observer.disconnect();
    };
  }, []);

  return null;
};
