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
      const cardapioButton = buttons.find((button) => (button.textContent || '').includes('Cardápio Web'));
      const actionAnchor = cardapioButton?.parentElement || buttons.find((button) => (button.textContent || '').includes('Novo pedido'))?.parentElement;
      if (!actionAnchor) return;

      let host = actionAnchor.querySelector<HTMLElement>('[data-header-operation-control="true"]');
      if (!host) {
        host = document.createElement('span');
        host.dataset.headerOperationControl = 'true';
        host.className = 'inline-flex';
        actionAnchor.insertBefore(host, actionAnchor.firstChild);
      }

      host.innerHTML = '';
      const button = document.createElement('button');
      button.type = 'button';
      button.disabled = saving;
      button.onclick = onToggle;
      button.textContent = saving ? 'Aguarde...' : operationOpen ? 'Encerrar turno' : 'Abrir turno';
      button.className = operationOpen
        ? 'inline-flex h-10 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-[12px] font-black text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-60'
        : 'inline-flex h-10 items-center justify-center rounded-xl border border-violet-500 bg-violet-600 px-4 text-[12px] font-black text-white transition hover:bg-violet-500 disabled:opacity-60';
      host.appendChild(button);
    };

    mount();
    const observer = new MutationObserver(() => window.requestAnimationFrame(mount));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelector('[data-header-operation-control="true"]')?.remove();
    };
  }, [operationOpen, saving, onToggle]);

  return null;
};
