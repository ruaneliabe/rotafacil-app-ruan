import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

const ACTIVE_STATUSES = ['pending','preparing','ready_at_counter','picked_up','dispatched','in_transit'];
const ROUTE_STATUSES = ['released','dispatched','saiu_para_entrega','out_for_delivery'];
const TERMINAL_STATUSES = ['closed','delivered','finalized','concluded','completed','finished','done','canceled','cancelled','rejected'];

function getDbInstance() {
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'rotafcildelivery',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
  };
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const databaseId = process.env.VITE_FIRESTORE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || 'ai-studio-rotafcildelivery-495fd3be-5974-4310-960a-26a794361d3b';
  return getFirestore(app, databaseId);
}

function normalizeName(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeStatus(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function getCourierName(order: any) {
  const candidates = [
    order?.externalMotoboyName,
    order?.assignedMotoboyName,
    order?.deliverymanName,
    order?.courierName,
    order?.driverName,
    order?.motoboyName,
    order?.entregadorName,
  ];
  return String(candidates.find((value) => String(value || '').trim()) || '').trim();
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = getDbInstance();
    const [ordersSnap, motoboysSnap] = await Promise.all([
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'motoboys')),
    ]);

    const motoboys = motoboysSnap.docs.map((row) => ({ id: row.id, ...(row.data() as any) }));
    const motoboyByName = new Map<string, any>();
    for (const motoboy of motoboys) {
      const names = [motoboy.name, motoboy.username].map(normalizeName).filter(Boolean);
      for (const name of names) if (!motoboyByName.has(name)) motoboyByName.set(name, motoboy);
    }

    let linked = 0;
    let movedToPreparing = 0;
    let movedToRoute = 0;
    let externalCourier = 0;

    for (const row of ordersSnap.docs) {
      const order = row.data() as any;
      if (order.originChannel !== 'cardapio_web' || !ACTIVE_STATUSES.includes(order.status)) continue;

      const courierName = getCourierName(order);
      if (!courierName) continue;

      const cwStatus = normalizeStatus(order.cardapioWebStatus || order.externalStatus || order.status);
      if (TERMINAL_STATUSES.includes(cwStatus)) continue;

      const matchedMotoboy = motoboyByName.get(normalizeName(courierName));
      const patch: any = {
        externalMotoboyName: courierName,
        assignedMotoboyName: matchedMotoboy?.name || courierName,
        lastCourierReconcileAt: Date.now(),
      };

      if (matchedMotoboy) {
        if (order.assignedMotoboyId !== matchedMotoboy.id) {
          patch.assignedMotoboyId = matchedMotoboy.id;
          linked++;
        }

        if (ROUTE_STATUSES.includes(cwStatus)) {
          if (!['dispatched','in_transit','picked_up'].includes(order.status)) {
            patch.status = 'dispatched';
            patch.dispatchedAt = order.dispatchedAt || new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
            movedToRoute++;
          }
        } else if (['pending','preparing'].includes(order.status)) {
          patch.status = 'preparing';
          movedToPreparing++;
        }
      } else {
        // Entregador existe no Cardápio Web, mas não está cadastrado no app.
        // Mantemos a operação coerente no painel da loja colocando o pedido em rota,
        // sem inventar um motoboy local nem criar conta automaticamente.
        patch.assignedMotoboyId = null;
        patch.status = 'dispatched';
        patch.dispatchedAt = order.dispatchedAt || new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
        patch.externalCourierOnly = true;
        externalCourier++;
        if (!['dispatched','in_transit','picked_up'].includes(order.status)) movedToRoute++;
      }

      await setDoc(doc(db, 'orders', row.id), patch, { merge: true });
    }

    return res.status(200).json({ success:true, linked, movedToPreparing, movedToRoute, externalCourier });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || String(error) });
  }
}
