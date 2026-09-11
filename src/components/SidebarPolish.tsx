import React, { useEffect } from 'react';

const navLabels = ['Pedidos e despacho', 'Kanban', 'Entregadores', 'Financeiro', 'Gestão e fechamento', 'Configurações'];

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

const syncSidebar = () => {
  const buttons = Object.fromEntries(navLabels.map((label) => [label, findButton(label)])) as Record<string, HTMLButtonElement | null>;

  navLabels.forEach((label) => polishButton(buttons[label]));

  ensureSectionLabel(buttons['Pedidos e despacho'], 'operation', 'OPERAÇÃO');
  ensureSectionLabel(buttons['Gestão e fechamento'], 'administration', 'ADMINISTRAÇÃO');

  const management = buttons['Gestão e fechamento'];
  if (management) {
    management.style.border = '1px solid transparent';
    management.style.outline = 'none';
  }

  const config = buttons['Configurações'];
  if (config) {
    config.style.borderTop = '1px solid transparent';
  }
};

export const SidebarPolish: React.FC = () => {
  useEffect(() => {
    syncSidebar();
    const observer = new MutationObserver(syncSidebar);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-current'] });
    return () => observer.disconnect();
  }, []);

  return null;
};
