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
    let bestCandidate: HTMLElement | null = null;

    for (let i = 0; i < 8 && node; i += 1) {
      const text = normalize(node.textContent);
      const rect = node.getBoundingClientRect();
      const looksLikeOperationCard =
        text.includes('Operação') &&
        rect.width > 80 && rect.width <= 260 &&
        rect.height > 35 && rect.height <= 220;

      if (looksLikeOperationCard) bestCandidate = node;

      if (node.tagName === 'ASIDE' || rect.width > 300) break;
      node = node.parentElement;
    }

    const target = bestCandidate || button.parentElement;
    if (target) {
      target.style.setProperty('display', 'none', 'important');
      target.dataset.hiddenDuplicateOperation = 'true';
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
