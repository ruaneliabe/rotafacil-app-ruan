import { useEffect } from 'react';

/**
 * Mantém apenas uma ação de criação manual de pedido na interface.
 * O botão global superior continua visível; o botão redundante do Kanban é ocultado.
 */
export const SingleOrderActionEnhancer = () => {
  useEffect(() => {
    const apply = () => {
      const candidates = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
      const novoPedidoButtons = candidates.filter((button) => {
        const text = button.textContent?.trim().toLowerCase() || '';
        return text === 'novo pedido' || text === '+ novo pedido';
      });

      novoPedidoButtons.forEach((button) => {
        const kanbanToolbar = button.closest('.bg-white.rounded-xl.p-3.border.border-slate-200');
        if (kanbanToolbar) button.style.display = 'none';
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
};
