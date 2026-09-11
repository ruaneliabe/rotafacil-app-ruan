import React, { useEffect } from 'react';

const normalize = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();

const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const hideDuplicateOperationControls = () => {
  const keep = document.querySelector<HTMLElement>('[data-rota-operation-card="true"]');
  if (!keep) return;
  const keepRect = keep.getBoundingClientRect();

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
        /operaç|turno|andamento|aberta|fechada/i.test(text) &&
        rect.width > 80 && rect.width <= 280 &&
        rect.height > 35 && rect.height <= 240;

      if (looksLikeOperationCard) bestCandidate = node;
      if (node.tagName === 'ASIDE' || rect.width > 320) break;
      node = node.parentElement;
    }

    const target = bestCandidate || button.parentElement;
    if (target) {
      target.style.setProperty('display', 'none', 'important');
      target.dataset.hiddenDuplicateOperation = 'true';
    }
  });

  Array.from(document.querySelectorAll<HTMLElement>('div,section')).forEach((element) => {
    if (element === keep || keep.contains(element) || element.contains(keep)) return;
    if (element.dataset.hiddenDuplicateOperation === 'true') return;

    const rect = element.getBoundingClientRect();
    if (rect.left > 220 || rect.width < 90 || rect.width > 280 || rect.height < 40 || rect.height > 240) return;
    if (!overlaps(rect, keepRect)) return;

    const text = normalize(element.textContent);
    if (!/operaç|turno|andamento|aberta|fechada/i.test(text)) return;

    element.style.setProperty('display', 'none', 'important');
    element.dataset.hiddenDuplicateOperation = 'true';
  });
};

const hideObsoleteDensitySwitch = () => {
  const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) => normalize(button.textContent) === 'Cards');
  const compact = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) => normalize(button.textContent) === 'Compacto');
  if (!cards && !compact) return;

  const common = cards?.parentElement && compact?.parentElement && cards.parentElement === compact.parentElement
    ? cards.parentElement
    : null;

  if (common) {
    common.style.setProperty('display', 'none', 'important');
    common.dataset.hiddenDensitySwitch = 'true';
    return;
  }

  if (cards) cards.style.setProperty('display', 'none', 'important');
  if (compact) compact.style.setProperty('display', 'none', 'important');
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
  hideObsoleteDensitySwitch();
  installOldestToggle();
};

export const DispatchUiFixes: React.FC = () => {
  useEffect(() => {
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    const timer = window.setInterval(sync, 600);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return null;
};
