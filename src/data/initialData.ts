import { Order, Motoboy, StoreShift } from '../types';

export const INITIAL_STORE_SHIFT: StoreShift = {
  id: 'current_shift',
  isOpen: false,
  openedAt: '',
  initialCash: 0,
  currentCash: 0,
  totalOrdersCount: 0,
  totalDeliveriesValue: 0,
  storeName: 'Configure sua loja',
  storePhone: '',
  storeAddress: '',
  storeLat: -26.9194,
  storeLng: -49.0661,
  storeUsername: '',
  adminPassword: '',
  masterUsername: 'ruan',
  masterPassword: 'ruan123',
  setupRequired: true,
  pilotMode: true,
  demoDataDisabled: true,
  integrations: {
    ifood: { enabled: false, accountId: '', webhookUrl: '' },
    cardapioWeb: { enabled: false, accountId: '', webhookUrl: '' },
  },
};

export const INITIAL_MOTOBOYS: Motoboy[] = [];

export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_ITEMS_MENU = [
  { name: 'Hope Smash Cheeseburger', price: 28.0 },
  { name: 'Hope Smash Bacon', price: 32.0 },
  { name: 'Hope Double Cheese & Bacon', price: 38.0 },
  { name: 'Hope Monster Triple Bacon', price: 44.0 },
  { name: 'Hope Chicken Crisp', price: 34.0 },
  { name: 'Porção de Batata Rústica', price: 22.0 },
  { name: 'Porção Batata c/ Cheddar e Bacon', price: 28.0 },
  { name: 'Coca-Cola 350ml lata', price: 7.0 },
  { name: 'Coca-Cola Zero 350ml lata', price: 7.0 },
  { name: 'Refrigerante Guaraná 2L', price: 14.0 },
  { name: 'Água Mineral 500ml', price: 5.0 },
];
