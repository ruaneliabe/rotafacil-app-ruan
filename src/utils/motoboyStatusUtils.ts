import { Motoboy } from '../types';

export type MotoboyStatusPresentation = {
  label: string;
  dotClass: string;
  textClass: string;
  badgeClass: string;
};

export const MOTOBOY_STATUS_PRESENTATION: Record<Motoboy['status'], MotoboyStatusPresentation> = {
  available: {
    label: 'Na fila da loja',
    dotClass: 'bg-emerald-400',
    textClass: 'text-emerald-300',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  delivering: {
    label: 'Em rota',
    dotClass: 'bg-blue-400',
    textClass: 'text-blue-300',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
  busy: {
    label: 'Pausado',
    dotClass: 'bg-amber-400',
    textClass: 'text-amber-300',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  returning_to_store: {
    label: 'Voltando à loja',
    dotClass: 'bg-orange-400',
    textClass: 'text-orange-300',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  },
  offline: {
    label: 'Expediente encerrado',
    dotClass: 'bg-rose-400',
    textClass: 'text-rose-300',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
};

export const getMotoboyStatusPresentation = (status?: Motoboy['status']) =>
  MOTOBOY_STATUS_PRESENTATION[status ?? 'offline'];
