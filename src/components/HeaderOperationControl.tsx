import React, { useEffect } from 'react';

interface Props {
  operationOpen: boolean;
  saving: boolean;
  onToggle: () => void;
}

export const HeaderOperationControl: React.FC<Props> = ({ operationOpen, saving, onToggle }) => {
  useEffect(() => {
    const mount = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
      const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

      const cardapioButton = buttons.find((button) => normalize(button.textContent || '').includes('cardapio web'));
      const orderButton = buttons.find((button) => {
        const text = normalize(button.textContent || '');
        return text === 'pedido' || text.includes('novo pedido') || text.includes('+ pedido');
      });
      const actionAnchor = cardapioButton?.parentElement || orderButton?.parentElement || null;

      let host = document.querySelector<HTMLElement>('[data-header-operation-control="true"]');
      if (!host) {
        host = document.createElement('span');
        host.dataset.headerOperationControl = 'true';
      }

      if (actionAnchor) {
        if (host.parentElement !== actionAnchor) {
          host.remove();
          host.className = 'inline-flex';
          host.style.cssText = '';
          actionAnchor.insertBefore(host, actionAnchor.firstChild);
        }
      } else if (!host.isConnected) {
        // Fallback: keep the operation control visible even if the dashboard header changes.
        host.className = 'fixed z-[90] inline-flex';
        host.style.top = '76px';
        host.style.right = '16px';
        document.body.appendChild(host);
      }

      host.innerHTML = '';
      const button = document.createElement('button');
      button.type = 'button';
      button.disabled = saving;
      button.dataset.rotaOperationToggle = 'true';
      button.setAttribute('aria-label', operationOpen ? 'Fechar loja' : 'Abrir loja');
      button.onclick = onToggle;
      button.textContent = saving ? 'Aguarde...' : operationOpen ? 'Fechar loja' : 'Abrir loja';
      button.className = operationOpen
        ? 'inline-flex h-10 items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 text-[12px] font-black text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60'
        : 'inline-flex h-10 items-center justify-center rounded-xl border border-violet-600 bg-violet-600 px-4 text-[12px] font-black text-white shadow-sm transition hover:bg-violet-500 disabled:opacity-60';
      host.appendChild(button);
    };

    mount();
    const observer = new MutationObserver(() => window.requestAnimationFrame(mount));
    observer.observe(document.body, { childList: true, subtree: true });
    const retry = window.setInterval(mount, 1500);

    return () => {
      observer.disconnect();
      window.clearInterval(retry);
      document.querySelector('[data-header-operation-control="true"]')?.remove();
    };
  }, [operationOpen, saving, onToggle]);

  return null;
};
