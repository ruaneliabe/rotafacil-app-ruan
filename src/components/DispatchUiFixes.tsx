import React, { useEffect } from 'react';

const normalize = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();

const hideDuplicateOperationControls = () => {
  const keep = document.querySelector<HTMLElement>('[data-rota-operation-card="true"]');
  const headerControl = document.querySelector<HTMLElement>('[data-header-operation-control="true"]');

  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter((button) => {
    const text = normalize(button.textContent).toUpperCase();
    return text === 'ENCERRAR TURNO' || text === 'ABRIR TURNO';
  });

  buttons.forEach((button) => {
    if ((keep && keep.contains(button)) || (headerControl && headerControl.contains(button))) return;

    let node: HTMLElement | null = button.parentElement;
    let bestCandidate: HTMLElement | null = null;

    for (let i = 0; i < 6 && node; i += 1) {
      const text = normalize(node.textContent);
      const rect = node.getBoundingClientRect();
      const looksLikeOperationCard =
        /operaç|turno|andamento|aberta|fechada/i.test(text) &&
        rect.width > 80 && rect.width <= 230 &&
        rect.height > 35 && rect.height <= 170;

      if (looksLikeOperationCard) bestCandidate = node;
      if (node.tagName === 'ASIDE' || rect.height > 220 || rect.width > 280) break;
      node = node.parentElement;
    }

    const target = bestCandidate || button.parentElement;
    if (target && target.dataset.hiddenDuplicateOperation !== 'true') {
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
    const rows = Array.from(list.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    const showingOldest = button.dataset.showingOldest === 'true';

    if (!showingOldest) {
      rows.forEach((row, index) => { row.style.display = index < 5 ? '' : 'none'; });
      button.dataset.showingOldest = 'true';
      button.textContent = 'Mostrar todos';
      list.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      rows.forEach((row) => { row.style.display = ''; });
      button.dataset.showingOldest = 'false';
      button.textContent = 'Ver mais antigos';
    }
  });
};

const sync = () => {
  hideDuplicateOperationControls();
  installOldestToggle();
};

export const DispatchUiFixes: React.FC = () => {
  useEffect(() => {
    let scheduled = 0;
    const scheduleSync = () => {
      if (scheduled) return;
      scheduled = window.requestAnimationFrame(() => {
        scheduled = 0;
        sync();
      });
    };

    sync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (scheduled) window.cancelAnimationFrame(scheduled);
    };
  }, []);

  return null;
};
