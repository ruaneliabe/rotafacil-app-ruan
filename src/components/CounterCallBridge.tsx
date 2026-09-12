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

      // Existem dois rótulos usados hoje no despacho: "Chamar balcão" e
      // "Chamar <nome> ... balcão". O teste completo mostrou que aceitar só
      // o primeiro fazia o 2º/3º motoboy permanecer com joinedQueueAt gravado.
      const buttonLabel = button.textContent?.replace(/\s+/g, ' ').trim() || '';
      if (!/^Chamar\b.*\bbalc[aã]o$/i.test(buttonLabel)) return;

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
        // Chamado ao balcão = fora da fila. Ele só recebe um novo timestamp
        // quando confirmar a chegada à loja depois da rota.
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
