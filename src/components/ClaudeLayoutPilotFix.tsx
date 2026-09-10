import { useEffect } from 'react';

/**
 * Ajustes de compatibilidade para o layout claro criado no redesign.
 * Atua apenas na apresentação/rotulagem dos controles do StoreDashboard.
 * Não altera estado, pedidos, fila, Firestore ou Cardápio Web.
 */
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

    const apply = () => {
      const sidebar = Array.from(document.querySelectorAll('aside')).find((el) =>
        (el.textContent || '').includes('Pedidos e despacho') && (el.textContent || '').includes('Entregadores')
      );
      if (!sidebar) return false;

      Array.from(sidebar.querySelectorAll('button')).forEach((button) => {
        const text = (button.textContent || '').trim();
        if (text === 'Gestão e fechamento') {
          button.classList.add('pilot-hidden-control');
        }
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
            if (span) span.textContent = 'Pedido de teste';
            else button.textContent = 'Pedido de teste';
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

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (apply() || attempts >= 20) window.clearInterval(timer);
    }, 250);
    apply();

    return () => {
      window.clearInterval(timer);
      style.remove();
    };
  }, []);

  return null;
}

export default ClaudeLayoutPilotFix;
