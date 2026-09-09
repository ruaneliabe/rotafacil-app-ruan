import { useEffect } from 'react';
import { subscribeToOrders, saveOrderToCloud } from '../lib/firebase';
import type { Order } from '../types';

const terminalWords = [
  'closed','delivered','finalized','concluded','completed','finished','done',
  'concluido','finalizado','entregue','encerrado',
];

const cancelledWords = ['cancelled','canceled','rejected','cancelado'];
const normalize = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

function hasCompletionEvidence(order: Order & Record<string, any>) {
  if (order.closedInCardapioWeb === true) return true;
  if (order.routeCompletedAt || order.closedAt || order.deliveredAt || order.deliveredTimestamp || order.deliveredDate) return true;

  const statusText = [
    order.cardapioWebStatus,
    order.externalStatus,
    order.statusCardapioWeb,
    order.remoteStatus,
    order.orderStatus,
  ].map(normalize).filter(Boolean).join(' ');

  return terminalWords.some((word) => statusText.includes(word));
}

function hasCancellationEvidence(order: Order & Record<string, any>) {
  const statusText = [order.cardapioWebStatus, order.externalStatus, order.statusCardapioWeb, order.remoteStatus]
    .map(normalize).filter(Boolean).join(' ');
  return cancelledWords.some((word) => statusText.includes(word));
}

export function CardapioWebTerminalCleanup() {
  useEffect(() => {
    const processing = new Set<string>();
    const unsubscribe = subscribeToOrders((orders) => {
      orders.forEach((raw) => {
        const order = raw as Order & Record<string, any>;
        if (order.originChannel !== 'cardapio_web') return;
        if (!['picked_up','dispatched','in_transit','preparing','ready_at_counter','pending'].includes(order.status)) return;
        if (processing.has(order.id)) return;

        const cancelled = hasCancellationEvidence(order);
        const completed = hasCompletionEvidence(order);
        if (!cancelled && !completed) return;

        processing.add(order.id);
        saveOrderToCloud({
          ...order,
          status: cancelled ? 'cancelled' : 'delivered',
          ...(cancelled ? {} : {
            deliveredTimestamp: order.deliveredTimestamp || Date.now(),
            deliveredAt: order.deliveredAt || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          }),
        }).finally(() => processing.delete(order.id));
      });
    });

    return () => unsubscribe();
  }, []);

  return null;
}
