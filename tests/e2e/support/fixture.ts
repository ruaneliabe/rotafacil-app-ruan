import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
} from 'firebase/firestore';
import { hashPassword } from '../../../src/lib/passwordSecurity';

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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig, 'pw-full-flow');
const dbId = process.env.VITE_FIRESTORE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || fileConfig.firestoreDatabaseId || '(default)';
export const db = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);

export const OPERATIONAL_EPOCH = 'zeroed_store_pilot_2026_08_17_v10';
export const STORE_USER = 'pw_full_store';
export const STORE_PASS = 'PwStore1234';
export const STORE_LOCATION = { latitude: -26.9194, longitude: -49.0661 };
export const ORDER_PREFIX = 'PW FLOW';

export const DRIVERS = [
  { id: 'pw_full_driver_1', username: 'pw_full_driver_1', password: 'PwDriver1234', name: 'PW1 Motoboy' },
  { id: 'pw_full_driver_2', username: 'pw_full_driver_2', password: 'PwDriver1234', name: 'PW2 Motoboy' },
  { id: 'pw_full_driver_3', username: 'pw_full_driver_3', password: 'PwDriver1234', name: 'PW3 Motoboy' },
];

export const ORDER_INPUTS = [
  { name: 'PW FLOW 01', street: 'Rua dos Caçadores', number: '653', neighborhood: 'Velha', latitude: -26.9201, longitude: -49.0992 },
  { name: 'PW FLOW 02', street: 'Rua João Pessoa', number: '850', neighborhood: 'Velha', latitude: -26.9176, longitude: -49.0927 },
  { name: 'PW FLOW 03', street: 'Rua Humberto de Campos', number: '500', neighborhood: 'Velha', latitude: -26.9147, longitude: -49.1016 },
  { name: 'PW FLOW 04', street: 'Rua General Osório', number: '1400', neighborhood: 'Velha', latitude: -26.9280, longitude: -49.1090 },
  { name: 'PW FLOW 05', street: 'Rua Almirante Barroso', number: '700', neighborhood: 'Vila Nova', latitude: -26.9092, longitude: -49.0860 },
  { name: 'PW FLOW 06', street: 'Rua Benjamin Constant', number: '1200', neighborhood: 'Escola Agrícola', latitude: -26.8968, longitude: -49.1050 },
  { name: 'PW FLOW 07', street: 'Rua São Paulo', number: '1100', neighborhood: 'Victor Konder', latitude: -26.9055, longitude: -49.0780 },
  { name: 'PW FLOW 08', street: 'Rua 7 de Setembro', number: '1500', neighborhood: 'Centro', latitude: -26.9182, longitude: -49.0710 },
];

export async function cleanupFullFlowData() {
  const orders = await getDocs(collection(db, 'orders'));
  const deletes: Promise<unknown>[] = [];
  for (const snap of orders.docs) {
    const data = snap.data() as any;
    if (String(data.clientName || '').startsWith(ORDER_PREFIX)) deletes.push(deleteDoc(snap.ref));
  }
  for (const driver of DRIVERS) deletes.push(deleteDoc(doc(db, 'motoboys', driver.id)));
  deletes.push(deleteDoc(doc(db, 'stores', STORE_USER)));
  await Promise.allSettled(deletes);
}

export async function seedFullFlowIdentities() {
  const now = Date.now();
  const storeCredential = await hashPassword(STORE_PASS);

  await setDoc(doc(db, 'stores', STORE_USER), {
    id: STORE_USER,
    username: STORE_USER,
    passwordHash: storeCredential.hash,
    passwordSalt: storeCredential.salt,
    storeName: 'PLAYWRIGHT FULL FLOW',
    createdAt: now,
  }, { merge: true });

  for (const [index, driver] of DRIVERS.entries()) {
    const credential = await hashPassword(driver.password);
    await setDoc(doc(db, 'motoboys', driver.id), {
      id: driver.id,
      username: driver.username,
      passwordHash: credential.hash,
      passwordSalt: credential.salt,
      name: driver.name,
      phone: `4799999200${index + 1}`,
      status: 'returning_to_store',
      activeOrdersCount: 0,
      deliveriesCountToday: 0,
      totalEarnedToday: 0,
      joinedQueueAt: null,
      callingToCounterAt: null,
      operationalEpoch: OPERATIONAL_EPOCH,
      isPlaywrightTest: true,
      createdAt: now + index,
    }, { merge: true });
  }
}

export async function getE2EOrders() {
  const snap = await getDocs(collection(db, 'orders'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((o) => String(o.clientName || '').startsWith(ORDER_PREFIX))
    .sort((a, b) => String(a.clientName).localeCompare(String(b.clientName)));
}

export async function getDriver(id: string) {
  const snap = await getDoc(doc(db, 'motoboys', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } as any : null;
}

export async function waitForOrderCount(count: number, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const orders = await getE2EOrders();
    if (orders.length === count) return orders;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Esperava ${count} pedidos E2E no Firestore.`);
}
