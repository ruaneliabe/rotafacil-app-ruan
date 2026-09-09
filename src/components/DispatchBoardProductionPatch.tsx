import { useEffect } from 'react';

/** Small production-only presentation cleanup without touching the secret-bearing app shell. */
export function DispatchBoardProductionPatch() {
  useEffect(() => {
    const apply = () => {
      const headings = Array.from(document.querySelectorAll('h3'));
      const waiting = headings.find((el) => el.textContent?.trim() === 'Aguardando motoboy');
      const preparing = headings.find((el) => el.textContent?.trim() === 'Preparando');
      if (!waiting || !preparing) return;

      const waitingSection = waiting.closest('section') as HTMLElement | null;
      const preparingSection = preparing.closest('section') as HTMLElement | null;
      if (!waitingSection || !preparingSection || waitingSection.dataset.productionMerged === '1') return;

      waiting.textContent = 'Preparando';
      const subtitle = waiting.parentElement?.querySelector('p');
      if (subtitle) subtitle.textContent = 'Pedidos em produção';
      waitingSection.dataset.productionMerged = '1';

      // The second preparing lane only contains already-reserved drivers; keep it operationally explicit.
      preparing.textContent = 'Motoboy reservado';
      const prepSubtitle = preparing.parentElement?.querySelector('p');
      if (prepSubtitle) prepSubtitle.textContent = 'Pedidos já vinculados';

      // Remove suggestion block: useful in demos, noisy during a real pilot.
      document.querySelectorAll('p').forEach((p) => {
        if (p.textContent?.trim() === 'Sugestões para próxima saída') {
          (p.closest('.rounded-lg') as HTMLElement | null)?.remove();
        }
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
