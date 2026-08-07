import { Order, Motoboy, StoreShift } from '../types';

export const INITIAL_STORE_SHIFT: StoreShift = {
  isOpen: true,
  openedAt: '18:00',
  initialCash: 0,
  storeName: 'Hope Burger',
  storePhone: '(47) 99887-6655',
  storeAddress: 'R. dos Caçadores, 653 - Velha Central, Blumenau - SC, 89040-313',
  storeLat: -26.9388,
  storeLng: -49.1082,
  adminPassword: '123',
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
