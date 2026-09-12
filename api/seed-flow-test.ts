import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const KEY = 'flowtest-6-20260912';
const EPOCH = 'zeroed_store_pilot_2026_08_17_v10';

function getDb() {
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'rotafacil-app-oficial',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
  };
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const dbId = process.env.VITE_FIRESTORE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || '(default)';
  return dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);
}

function spDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const o = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${o.year}-${o.month}-${o.day}`;
}

function spTime() {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date());
}

export async function seedFlowTestOrders() {
  const db = getDb();
  const markerRef = doc(db, 'system', 'flow_test_seed_20260912');
  const marker = await getDoc(markerRef);
  if (marker.exists()) return { alreadyCreated: true, count: 6 };

  const today = spDate();
  const now = Date.now();
  const orders = [
    ['TESTE Cliente 01', 'Rua dos Caçadores, 100, Velha, Blumenau', 'Velha', -26.9204, -49.0982, 42.90],
    ['TESTE Cliente 02', 'Rua João Pessoa, 850, Velha, Blumenau', 'Velha', -26.9176, -49.0927, 58.50],
    ['TESTE Cliente 03', 'Rua Humberto de Campos, 500, Velha, Blumenau', 'Velha', -26.9147, -49.1016, 36.90],
    ['TESTE Cliente 04', 'Rua General Osório, 1400, Velha, Blumenau', 'Velha', -26.9280, -49.1090, 74.80],
    ['TESTE Cliente 05', 'Rua Almirante Barroso, 700, Vila Nova, Blumenau', 'Vila Nova', -26.9092, -49.0860, 49.90],
    ['TESTE Cliente 06', 'Rua Benjamin Constant, 1200, Escola Agrícola, Blumenau', 'Escola Agrícola', -26.8968, -49.1050, 63.40],
  ];

  for (let i = 0; i < orders.length; i++) {
    const [clientName, address, neighborhood, lat, lng, total] = orders[i] as [string,string,string,number,number,number];
    const id = `flow_test_20260912_${String(i + 1).padStart(2, '0')}`;
    await setDoc(doc(db, 'orders', id), {
      id,
      codeNumber: 9001 + i,
      clientName,
      clientPhone: `4799000100${i + 1}`,
      address,
      neighborhood,
      lat,
      lng,
      items: [{ id: `item_${i + 1}`, name: 'Pedido de teste operacional', quantity: 1, price: total }],
      itemsSummary: '1x Pedido de teste operacional',
      subtotal: total - 6,
      deliveryFee: 6,
      total,
      paymentMethod: i % 3 === 0 ? 'cash' : i % 3 === 1 ? 'card' : 'pix',
      status: 'pending',
      createdAt: spTime(),
      createdDate: today,
      createdTimestamp: now + i,
      shiftDate: today,
      estimatedMinutes: 25,
      assignedMotoboyId: null,
      assignedMotoboyName: null,
      originChannel: 'manual',
      storeBranch: i % 2 === 0 ? 'hope_burger' : 'hope_pizza',
      storeName: i % 2 === 0 ? 'Hope Burger' : 'Hope Pizza',
      trackingCode: `TESTE-${9001 + i}`,
      operationalEpoch: EPOCH,
      isFlowTest: true,
    }, { merge: true });
  }

  await setDoc(markerRef, { createdAt: Date.now(), count: 6 }, { merge: true });
  return { alreadyCreated: false, count: 6 };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ success: false });
  if (String(req.query?.key || '') !== KEY) return res.status(404).json({ success: false });
  const result = await seedFlowTestOrders();
  return res.status(200).json({ success: true, ...result });
}
