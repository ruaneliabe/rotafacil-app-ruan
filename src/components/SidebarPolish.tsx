import React, { useEffect } from 'react';

const navLabels = ['Pedidos e despacho', 'Kanban', 'Entregadores', 'Financeiro', 'Gestão e fechamento', 'Configurações', 'Configuração da loja'];

const findButton = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
    (button.textContent?.trim() || '').includes(label)
  ) || null;

const ensureSectionLabel = (target: HTMLElement | null, key: string, text: string) => {
  if (!target?.parentElement) return;
  const parent = target.parentElement;
  if (parent.querySelector(`[data-sidebar-section="${key}"]`)) return;

  const label = document.createElement('div');
  label.dataset.sidebarSection = key;
  label.textContent = text;
  label.className = 'px-3 pb-2 pt-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400';
  parent.insertBefore(label, target);
};

const polishButton = (button: HTMLButtonElement | null) => {
  if (!button) return;
  button.dataset.sidebarPolished = 'true';
  button.style.width = '100%';
  button.style.minHeight = '42px';
  button.style.borderRadius = '12px';
  button.style.border = '1px solid transparent';
  button.style.boxShadow = 'none';
  button.style.margin = '1px 0';
  button.style.padding = '0 12px';
  button.style.justifyContent = 'flex-start';
  button.style.gap = '10px';
  button.style.transition = 'background-color .16s ease,color .16s ease,border-color .16s ease';

  const classes = button.className;
  const active =
    classes.includes('bg-violet') ||
    classes.includes('text-violet-9') ||
    button.getAttribute('aria-current') === 'page';

  if (active) {
    button.style.background = 'linear-gradient(90deg, rgba(124,58,237,.12), rgba(124,58,237,.06))';
    button.style.color = '#6d28d9';
    button.style.borderColor = 'rgba(124,58,237,.08)';
  } else {
    button.style.background = 'transparent';
    button.style.color = '#475569';
  }
};

const renameStoreSettings = () => {
  const button = findButton('Configurações') || findButton('Configuração da loja');
  if (!button) return null;
  const textNodes = Array.from(button.querySelectorAll<HTMLElement>('span,p,div')).filter((node) => (node.textContent || '').trim() === 'Configurações');
  if (textNodes.length) textNodes.forEach((node) => { node.textContent = 'Configuração da loja'; });
  else if ((button.textContent || '').trim() === 'Configurações') {
    const text = Array.from(button.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && (node.textContent || '').trim() === 'Configurações');
    if (text) text.textContent = ' Configuração da loja';
  }
  button.setAttribute('aria-label', 'Configuração da loja');
  return button;
};

const hideStoreLayerToggle = () => {
  const modal = document.querySelector<HTMLElement>('[data-operation-enhanced-modal="true"]');
  if (!modal) return;

  const storeToggle = Array.from(modal.querySelectorAll<HTMLButtonElement>('button')).find((button) => {
    const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
    return text === 'Loja' || text.startsWith('Loja Hope');
  });

  if (storeToggle) storeToggle.style.display = 'none';
};

const hideLegacyOperationCard = () => {
  const official = document.querySelector<HTMLElement>('[data-rota-operation-card="true"]');

  Array.from(document.querySelectorAll<HTMLButtonElement>('button')).forEach((button) => {
    if (official?.contains(button)) return;

    const label = (button.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (!['ENCERRAR TURNO', 'ABRIR TURNO', 'ABRIR LOJA'].some((text) => label.includes(text))) return;

    const buttonRect = button.getBoundingClientRect();
    if (buttonRect.left > 240) return;

    let node: HTMLElement | null = button.parentElement;
    let bestCandidate: HTMLElement | null = null;

    for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      if (official?.contains(node)) break;

      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      const rect = node.getBoundingClientRect();
      const hasStatus = /Operação (aberta|fechada)/i.test(text);
      const hasAction = /(ENCERRAR TURNO|ABRIR TURNO|ABRIR LOJA)/i.test(text);
      const isSidebarSized = rect.left < 240 && rect.width > 70 && rect.width <= 240;

      if (hasStatus && hasAction && isSidebarSized) bestCandidate = node;
      if (bestCandidate && ['fixed', 'absolute', 'sticky'].includes(window.getComputedStyle(node).position)) break;
    }

    if (bestCandidate) {
      bestCandidate.style.setProperty('display', 'none', 'important');
      bestCandidate.dataset.legacyOperationCardHidden = 'true';
    } else {
      button.style.setProperty('display', 'none', 'important');
    }
  });
};

const syncSidebar = () => {
  const settingsButton = renameStoreSettings();
  const buttons = Object.fromEntries(navLabels.map((label) => [label, findButton(label)])) as Record<string, HTMLButtonElement | null>;

  navLabels.forEach((label) => polishButton(buttons[label]));
  if (settingsButton) polishButton(settingsButton);

  ensureSectionLabel(buttons['Pedidos e despacho'], 'operation', 'OPERAÇÃO');

  const management = buttons['Gestão e fechamento'];
  if (management) management.style.display = 'none';

  ensureSectionLabel(settingsButton || buttons['Configuração da loja'] || buttons['Configurações'], 'administration', 'ADMINISTRAÇÃO');

  const config = settingsButton || buttons['Configuração da loja'] || buttons['Configurações'];
  if (config) config.style.borderTop = '1px solid transparent';

  hideLegacyOperationCard();
  hideStoreLayerToggle();
};

export const SidebarPolish: React.FC = () => {
  useEffect(() => {
    syncSidebar();
    const observer = new MutationObserver(syncSidebar);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-current', 'style'] });
    return () => observer.disconnect();
  }, []);

  return null;
};
