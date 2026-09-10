import { useEffect } from 'react';

const TAB_STORAGE_KEY = 'rota_facil_store_active_tab';
const TAB_LABELS = ['Pedidos e despacho', 'Kanban', 'Entregadores', 'Financeiro'] as const;

export function ClaudeLayoutPilotFix() {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'claude-layout-pilot-fix';
    style.textContent = `
      .pilot-hidden-control{display:none!important}
      .pilot-secondary-order{background:#fff!important;color:#475569!important;border:1px solid #d8dee8!important;box-shadow:none!important;font-weight:600!important}
      .pilot-secondary-order:hover{background:#f8fafc!important;color:#0f172a!important;border-color:#cbd5e1!important}
      .pilot-finance-item{color:#475569!important}
      .pilot-finance-item[data-active="true"]{background:#f5f3ff!important;color:#4c1d95!important;border-left-color:#7c3aed!important}
      .pilot-operation-status{padding:8px 10px!important;border-radius:9px!important;background:#fff!important;border:1px solid #e2e8f0!important;color:#475569!important}
      .pilot-operation-status:hover{border-color:#cbd5e1!important;background:#f8fafc!important}
      .pilot-cw-chip{padding:6px 9px!important;border-radius:8px!important;background:#fff!important;border:1px solid #e2e8f0!important;color:#64748b!important;font-weight:600!important}
    `;
    document.head.appendChild(style);

    let restored = false;

    const getSidebar = () => Array.from(document.querySelectorAll('aside')).find((el) =>
      (el.textContent || '').includes('Pedidos e despacho') && (el.textContent || '').includes('Entregadores')
    );

    const restoreSavedTab = (sidebar: Element) => {
      if (restored) return;
      const saved = localStorage.getItem(TAB_STORAGE_KEY);
      if (!saved || !TAB_LABELS.includes(saved as any)) {
        restored = true;
        return;
      }
      const button = Array.from(sidebar.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === saved) as HTMLButtonElement | undefined;
      if (!button) return;
      const active = button.className.includes('bg-violet-50') || button.getAttribute('aria-current') === 'page';
      restored = true;
      if (!active) window.setTimeout(() => button.click(), 0);
    };

    const apply = () => {
      const sidebar = getSidebar();
      if (!sidebar) return false;

      restoreSavedTab(sidebar);

      Array.from(sidebar.querySelectorAll('button')).forEach((button) => {
        const text = (button.textContent || '').trim();
        if (text === 'Gestão e fechamento') button.classList.add('pilot-hidden-control');
        if (text === 'Financeiro') {
          button.classList.add('pilot-finance-item');
          button.dataset.active = button.className.includes('bg-violet-50') ? 'true' : 'false';
        }
        if (text.startsWith('Loja aberta') || text.startsWith('Loja fechada')) {
          button.classList.add('pilot-operation-status');
          button.textContent = text.startsWith('Loja aberta') ? '● Operação aberta · encerrar' : '● Operação fechada · abrir';
        }
      });

      const dashboard = sidebar.parentElement;
      if (dashboard) {
        Array.from(dashboard.querySelectorAll('button')).forEach((button) => {
          const text = (button.textContent || '').trim();
          if (text === 'Novo pedido') {
            button.classList.add('pilot-secondary-order');
            const span = button.querySelector('span');
            if (span) span.textContent = 'Pedido de teste'; else button.textContent = 'Pedido de teste';
            button.title = 'Pedido manual disponível apenas para testes da operação';
          }
        });
        Array.from(dashboard.querySelectorAll('span')).forEach((span) => {
          const text = (span.textContent || '').trim();
          if (/^CW:\s*(Aberto|Fechado)$/i.test(text)) {
            span.classList.add('pilot-cw-chip');
            span.textContent = text.replace(/^CW:/i, 'Cardápio Web:');
            span.title = 'Status espelhado do Cardápio Web';
          }
        });
      }
      return true;
    };

    const handleClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest('button');
      if (!button) return;
      const sidebar = getSidebar();
      if (!sidebar || !sidebar.contains(button)) return;
      const label = (button.textContent || '').trim();
      const cleanLabel = label.replace(/^●\s*/, '').split(' · ')[0];
      if (TAB_LABELS.includes(cleanLabel as any)) localStorage.setItem(TAB_STORAGE_KEY, cleanLabel);
    };

    document.addEventListener('click', handleClick);
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (apply() || attempts >= 24) window.clearInterval(timer);
    }, 200);
    apply();

    return () => {
      document.removeEventListener('click', handleClick);
      window.clearInterval(timer);
      style.remove();
    };
  }, []);

  return null;
}

export default ClaudeLayoutPilotFix;
