import React from 'react';
import { CreditCard, DollarSign, CheckCircle2, Utensils, Globe } from 'lucide-react';

export type NormalizedPaymentType = 
  | 'pix' 
  | 'card_credit' 
  | 'card_debit' 
  | 'cartao_maquininha' 
  | 'dinheiro' 
  | 'voucher' 
  | 'online' 
  | 'other';

/**
 * Normaliza qualquer formato de pagamento recebido do Cardápio Web, iFood ou lançado manualmente.
 * Converte códigos como CARD_DEB, CARD_CRE, card_credit, cash, etc.
 */
export function normalizePaymentMethod(raw?: string | null): NormalizedPaymentType {
  if (!raw) return 'other';
  const str = String(raw).trim().toLowerCase();

  if (str === 'pix' || str.includes('pix')) {
    return 'pix';
  }

  // Cartão de Crédito
  if (
    str === 'card_cre' || 
    str === 'card_credit' || 
    str.includes('cred') || 
    str === 'credit'
  ) {
    return 'card_credit';
  }

  // Cartão de Débito
  if (
    str === 'card_deb' || 
    str === 'card_debit' || 
    str.includes('deb') || 
    str === 'debit'
  ) {
    return 'card_debit';
  }

  // Cartão genérico / Maquininha
  if (
    str === 'cartao_maquininha' || 
    str.includes('maquininha') || 
    str === 'cartao' || 
    str === 'cartão' || 
    str === 'card'
  ) {
    return 'cartao_maquininha';
  }

  // Dinheiro
  if (
    str === 'dinheiro' || 
    str === 'cash' || 
    str.includes('money') || 
    str.includes('especie') || 
    str.includes('espécie')
  ) {
    return 'dinheiro';
  }

  // Vale Refeição / Alimentação
  if (
    str.includes('voucher') || 
    str.includes('vr') || 
    str.includes('va') || 
    str.includes('refeic') || 
    str.includes('alimentac')
  ) {
    return 'voucher';
  }

  // Online
  if (str.includes('online') || str.includes('ifood') || str.includes('cardapio_web')) {
    return 'online';
  }

  return 'other';
}

/**
 * Retorna rótulo legível em português elegante para a interface
 */
export function getPaymentMethodLabel(raw?: string | null): string {
  const norm = normalizePaymentMethod(raw);
  switch (norm) {
    case 'pix':
      return 'PIX';
    case 'card_credit':
      return 'Cartão Crédito';
    case 'card_debit':
      return 'Cartão Débito';
    case 'cartao_maquininha':
      return 'Cartão (Maquininha)';
    case 'dinheiro':
      return 'Dinheiro';
    case 'voucher':
      return 'Vale Refeição';
    case 'online':
      return 'Pago Online';
    default:
      if (!raw) return 'Não informado';
      const clean = String(raw).replace(/[_-]/g, ' ').trim();
      return clean.toUpperCase();
  }
}

/**
 * Retorna se o pagamento é em dinheiro (exige conferência de troco)
 */
export function isCashPayment(raw?: string | null): boolean {
  return normalizePaymentMethod(raw) === 'dinheiro';
}

/**
 * Retorna se o pagamento é via cartão (exige levar maquininha)
 */
export function isCardPayment(raw?: string | null): boolean {
  const norm = normalizePaymentMethod(raw);
  return norm === 'card_credit' || norm === 'card_debit' || norm === 'cartao_maquininha';
}

/**
 * Retorna se o pagamento é via PIX
 */
export function isPixPayment(raw?: string | null): boolean {
  return normalizePaymentMethod(raw) === 'pix';
}

/**
 * Componente visual de Badge de Pagamento de Alta Visibilidade
 */
export function PaymentBadge({
  method,
  changeFor,
  total,
  size = 'sm',
}: {
  method?: string | null;
  changeFor?: number;
  total?: number;
  size?: 'xs' | 'sm' | 'md';
}) {
  const norm = normalizePaymentMethod(method);
  const label = getPaymentMethodLabel(method);

  const textSize = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  const iconSize = size === 'xs' ? 'w-2.5 h-2.5' : size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  let badgeContent: React.ReactNode;

  switch (norm) {
    case 'pix':
      badgeContent = (
        <span className={`inline-flex items-center gap-1 font-bold rounded border bg-teal-950/80 text-teal-300 border-teal-500/30 ${textSize}`}>
          <CheckCircle2 className={`${iconSize} text-teal-400`} />
          <span>{label}</span>
        </span>
      );
      break;

    case 'card_credit':
      badgeContent = (
        <span className={`inline-flex items-center gap-1 font-bold rounded border bg-indigo-950/80 text-indigo-300 border-indigo-500/30 ${textSize}`}>
          <CreditCard className={`${iconSize} text-indigo-400`} />
          <span>{label}</span>
        </span>
      );
      break;

    case 'card_debit':
      badgeContent = (
        <span className={`inline-flex items-center gap-1 font-bold rounded border bg-cyan-950/80 text-cyan-300 border-cyan-500/30 ${textSize}`}>
          <CreditCard className={`${iconSize} text-cyan-400`} />
          <span>{label}</span>
        </span>
      );
      break;

    case 'cartao_maquininha':
      badgeContent = (
        <span className={`inline-flex items-center gap-1 font-bold rounded border bg-blue-950/80 text-blue-300 border-blue-500/30 ${textSize}`}>
          <CreditCard className={`${iconSize} text-blue-400`} />
          <span>{label}</span>
        </span>
      );
      break;

    case 'dinheiro':
      badgeContent = (
        <span className={`inline-flex items-center gap-1 font-bold rounded border bg-amber-950/80 text-amber-300 border-amber-500/30 ${textSize}`}>
          <DollarSign className={`${iconSize} text-amber-400`} />
          <span>{label}</span>
        </span>
      );
      break;

    case 'voucher':
      badgeContent = (
        <span className={`inline-flex items-center gap-1 font-bold rounded border bg-purple-950/80 text-purple-300 border-purple-500/30 ${textSize}`}>
          <Utensils className={`${iconSize} text-purple-400`} />
          <span>{label}</span>
        </span>
      );
      break;

    case 'online':
      badgeContent = (
        <span className={`inline-flex items-center gap-1 font-bold rounded border bg-emerald-950/80 text-emerald-300 border-emerald-500/30 ${textSize}`}>
          <Globe className={`${iconSize} text-emerald-400`} />
          <span>{label}</span>
        </span>
      );
      break;

    default:
      badgeContent = (
        <span className={`inline-flex items-center gap-1 font-semibold rounded border bg-slate-800 text-slate-300 border-slate-700 ${textSize}`}>
          <span>{label}</span>
        </span>
      );
      break;
  }

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      {badgeContent}
      {norm === 'dinheiro' && changeFor && total && changeFor > total ? (
        <span className="text-[10px] font-extrabold text-amber-400 block tracking-tight">
          Troco R$ {(changeFor - total).toFixed(2).replace('.', ',')} (Leva R$ {changeFor.toFixed(2).replace('.', ',')})
        </span>
      ) : null}
    </div>
  );
}
