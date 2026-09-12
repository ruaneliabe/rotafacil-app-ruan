import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { deleteDoc, doc, getFirestore, setDoc } from 'firebase/firestore';

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || fileConfig.apiKey,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || fileConfig.authDomain,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || fileConfig.projectId,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || fileConfig.storageBucket,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || fileConfig.messagingSenderId,
  appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || fileConfig.appId,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig, 'playwright-e2e');
const dbId = process.env.VITE_FIRESTORE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || fileConfig.firestoreDatabaseId || '(default)';
const db = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);

export const DRIVER_ID = 'pw_e2e_driver';
export const DRIVER_USER = 'pw_e2e_driver';
export const DRIVER_PASS = 'PwTest1234';
export const ORDER_IDS = ['pw_e2e_order_01', 'pw_e2e_order_02'];
export const OPERATIONAL_EPOCH = 'zeroed_store_pilot_2026_08_17_v10';

function brazilDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export async function seedPwaFlowFixture() {
  const today = brazilDateKey();
  const now = Date.now();

  await setDoc(doc(db, 'motoboys', DRIVER_ID), {
    id: DRIVER_ID,
    name: 'PLAYWRIGHT - Motoboy',
    username: DRIVER_USER,
    password: DRIVER_PASS,
    phone: '47999990000',
    status: 'available',
    joinedQueueAt: now - 60_000,
    activeOrdersCount: 0,
    deliveriesCountToday: 0,
    totalEarnedToday: 0,
    operationalEpoch: OPERATIONAL_EPOCH,
    isPlaywrightTest: true,
    createdAt: now,
  }, { merge: true });

  const orders = [
    {
      id: ORDER_IDS[0], codeNumber: 99001, clientName: 'PW Cliente 01',
      address: 'Rua dos Caçadores, 653, Velha, Blumenau', neighborhood: 'Velha',
      lat: -26.9199, lng: -49.1010, total: 49.9,
    },
    {
      id: ORDER_IDS[1], codeNumber: 99002, clientName: 'PW Cliente 02',
      address: 'Rua João Pessoa, 850, Velha, Blumenau', neighborhood: 'Velha',
      lat: -26.9176, lng: -49.0927, total: 64.9,
    },
  ];

  for (let i = 0; i < orders.length; i += 1) {
    const order = orders[i];
    await setDoc(doc(db, 'orders', order.id), {
      ...order,
      clientPhone: `4799999100${i + 1}`,
      items: [{ id: `pw_item_${i + 1}`, name: 'Pedido Playwright', quantity: 1, price: order.total }],
      itemsSummary: '1x Pedido Playwright',
      subtotal: order.total - 6,
      deliveryFee: 6,
      paymentMethod: i === 0 ? 'pix' : 'card',
      status: 'ready_at_counter',
      createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
      createdDate: today,
      createdTimestamp: now + i,
      shiftDate: today,
      assignedMotoboyId: DRIVER_ID,
      assignedMotoboyName: 'PLAYWRIGHT - Motoboy',
      routeSequence: i + 1,
      originChannel: 'manual',
      storeBranch: 'hope_burger',
      trackingCode: `PW-E2E-${i + 1}`,
      operationalEpoch: OPERATIONAL_EPOCH,
      isPlaywrightTest: true,
    }, { merge: true });
  }
}

export async function cleanupPwaFlowFixture() {
  await Promise.allSettled([
    ...ORDER_IDS.map((id) => deleteDoc(doc(db, 'orders', id))),
    deleteDoc(doc(db, 'motoboys', DRIVER_ID)),
  ]);
}
