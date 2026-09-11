import React, { useEffect } from 'react';

const normalize = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();

const hideDuplicateOperationControls = () => {
  const keep = document.querySelector<HTMLElement>('[data-rota-operation-card="true"]');
  if (!keep) return;

  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter((button) => {
    const text = normalize(button.textContent).toUpperCase();
    return text === 'ENCERRAR TURNO' || text === 'ABRIR TURNO';
  });

  buttons.forEach((button) => {
    if (keep.contains(button)) return;

    let node: HTMLElement | null = button.parentElement;
    let candidate: HTMLElement | null = null;
    for (let i = 0; i < 5 && node; i += 1) {
      candidate = node;
      if (normalize(node.textContent).includes('Operação')) break;
      node = node.parentElement;
    }

    if (candidate) {
      candidate.style.display = 'none';
      candidate.dataset.hiddenDuplicateOperation = 'true';
    }
  });
};

const installOldestToggle = () => {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((item) => {
    const text = normalize(item.textContent);
    return text === 'Ver mais antigos' || text === 'Mostrar todos';
  });
  const list = document.getElementById('loose-order-list');
  if (!button || !list || button.dataset.oldestToggleBound === 'true') return;

  button.dataset.oldestToggleBound = 'true';
  button.dataset.showingOldest = 'false';

  button.addEventListener('click', () => {
    window.setTimeout(() => {
      const rows = Array.from(list.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
      const showingOldest = button.dataset.showingOldest === 'true';

      if (!showingOldest) {
        rows.forEach((row, index) => {
          row.style.display = index < 5 ? '' : 'none';
        });
        button.dataset.showingOldest = 'true';
        button.textContent = 'Mostrar todos';
        list.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        rows.forEach((row) => { row.style.display = ''; });
        button.dataset.showingOldest = 'false';
        button.textContent = 'Ver mais antigos';
      }
    }, 0);
  });
};

const sync = () => {
  hideDuplicateOperationControls();
  installOldestToggle();
};

export const DispatchUiFixes: React.FC = () => {
  useEffect(() => {
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
};
