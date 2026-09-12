import React, { useEffect } from 'react';
import { Motoboy } from '../types';
import { saveMotoboyToCloud } from '../lib/firebase';

interface Props {
  motoboys: Motoboy[];
}

export const CounterCallBridge: React.FC<Props> = ({ motoboys }) => {
  useEffect(() => {
    const onClick = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('button');
      if (!button) return;
      if (!button.closest('[data-operation-enhanced-modal="true"]')) return;
      if (button.textContent?.trim() !== 'Chamar balcão') return;

      const row = button.closest<HTMLElement>('[data-counter-driver-id]') || button.parentElement?.parentElement;
      const explicitId = row?.dataset.counterDriverId;
      const rowText = row?.textContent || '';
      const driver = explicitId
        ? motoboys.find((m) => m.id === explicitId)
        : motoboys.find((m) => rowText.includes(m.name));

      if (!driver) {
        console.warn('Rota Fácil: não foi possível identificar o motoboy chamado ao balcão.');
        return;
      }

      try {
        // Ao chamar o motoboy para o balcão ele deixa de ocupar uma posição
        // na fila imediatamente. A próxima entrada na fila recebe um novo
        // joinedQueueAt somente quando ele confirmar que voltou à loja.
        await saveMotoboyToCloud({
          ...driver,
          joinedQueueAt: null,
          callingToCounterAt: Date.now(),
        });
      } catch (err) {
        console.error('Rota Fácil: falha ao enviar chamada ao balcão.', err);
      }
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [motoboys]);

  return null;
};
