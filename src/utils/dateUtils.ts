import { Order, StoreShift } from '../types';

/**
 * Retorna a chave de data YYYY-MM-DD no fuso horário oficial de Brasília (Blumenau - SC).
 */
export function getBrazilDateKey(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

/**
 * Retorna o horário HH:mm no fuso horário de Brasília.
 */
export function getBrazilTimeString(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Determina se um pedido pertence ao turno operacional ATUAL (entre a abertura e o fechamento da loja).
 *
 * Regras rigorosas:
 * 1. Se a loja está FECHADA (shift.isOpen === false):
 *    Nenhum pedido pertence ao turno operacional em andamento (o faturamento ativo é 0).
 * 2. Se a loja está ABERTA (shift.isOpen === true):
 *    - Se o pedido possui shiftId igual ao shift.shiftId, pertence ao turno.
 *    - Se o shift possui openedTimestamp, o pedido pertence ao turno se foi criado após a abertura (createdTimestamp >= shift.openedTimestamp).
 *    - Pedidos legados ou com createdDate anterior à data do turno não entram no faturamento.
 */
export function isOrderInCurrentShift(order: Order, shift: StoreShift): boolean {
  if (!shift.isOpen) {
    return false;
  }

  // Ignora cancelados
  if (order.status === 'cancelled' || (order.status as string) === 'failed') {
    return false;
  }

  // Se o pedido foi expressamente vinculado a este shiftId
  if (shift.shiftId && order.shiftId) {
    return order.shiftId === shift.shiftId;
  }

  // Se temos o timestamp exato em que o turno atual foi aberto
  if (shift.openedTimestamp) {
    if (order.createdTimestamp) {
      return order.createdTimestamp >= shift.openedTimestamp;
    }
    // Se o pedido não tem createdTimestamp mas foi entregue/despachado antes da abertura deste turno, não pertence
    if (order.deliveredTimestamp && order.deliveredTimestamp < shift.openedTimestamp) {
      return false;
    }
  }

  // Se o turno tem uma data operacional (shiftDate)
  if (shift.shiftDate && order.createdDate) {
    if (order.createdDate !== shift.shiftDate) {
      return false;
    }
  }

  // Caso o pedido tenha sido criado na mesma data e o turno esteja aberto sem restrição de timestamp
  const todayKey = getBrazilDateKey();
  if (order.createdDate && order.createdDate !== todayKey) {
    return false;
  }

  return true;
}
