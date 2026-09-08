import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { getCardapioWebStores } from './cardapio-web-config';

function getDbInstance() {
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'rotafcildelivery',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
  };

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const dbId = process.env.VITE_FIRESTORE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || 'ai-studio-rotafcildelivery-495fd3be-5974-4310-960a-26a794361d3b';
  return getFirestore(app, dbId);
}

const STATUS_RANK: Record<string, number> = {
  pending: 10,
  preparing: 20,
  ready_at_counter: 30,
  picked_up: 40,
  dispatched: 50,
  in_transit: 60,
  delivered: 100,
};

function mapExternalStatus(status: unknown): 'dispatched' | 'delivered' | 'cancelled' | null {
  const value = String(status || '').trim().toLowerCase();
  if (['closed', 'delivered', 'finalized', 'concluded'].includes(value)) return 'delivered';
  if (['released', 'dispatched', 'saiu_para_entrega'].includes(value)) return 'dispatched';
  if (['canceled', 'cancelled', 'rejected'].includes(value)) return 'cancelled';
  return null;
}

function canApplyExternalStatus(currentStatus: unknown, targetStatus: string): boolean {
  const current = String(currentStatus || 'pending').toLowerCase();
  if (current === 'delivered' || current === 'cancelled') return false;

  // Cancelamento externo so encerra pedido que ainda nao saiu para entrega.
  if (targetStatus === 'cancelled') {
    return (STATUS_RANK[current] || 0) < STATUS_RANK.dispatched;
  }

  return (STATUS_RANK[targetStatus] || 0) > (STATUS_RANK[current] || 0);
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = getDbInstance();
    const stores = getCardapioWebStores();

    const storeResults = await Promise.all(
      stores.map(async (store) => {
        try {
          const response = await fetch('https://integracao.cardapioweb.com/api/partner/v1/orders', {
            headers: { 'X-API-KEY': store.apiKey },
          });
          if (!response.ok) {
            console.error(`[Cardapio Web Sync] ${store.storeId}: HTTP ${response.status}`);
            return [];
          }
          const list = await response.json();
          return Array.isArray(list)
            ? list.map((order: any) => ({ ...order, _storeId: store.storeId }))
            : [];
        } catch (error) {
          console.error(`[Cardapio Web Sync] ${store.storeId}:`, error);
          return [];
        }
      })
    );

    const externalOrders = storeResults.flat();
    const externalMap = new Map<string, any>();
    for (const order of externalOrders) {
      if (order.id != null) externalMap.set(`${order._storeId}:id:${String(order.id)}`, order);
      if (order.display_id != null) externalMap.set(`${order._storeId}:display:${String(order.display_id)}`, order);
    }

    const snap = await getDocs(collection(db, 'orders'));
    let dispatchedCount = 0;
    let deliveredCount = 0;
    let cancelledCount = 0;
    let purgedEmptyCount = 0;
    let purgedTakeoutCount = 0;
    let regressionBlockedCount = 0;

    for (const d of snap.docs) {
      const data = d.data() as any;
      if (data.originChannel !== 'cardapio_web') continue;

      const isTakeoutOrder =
        (data.address && String(data.address).toLowerCase().includes('retirada')) ||
        (data.neighborhood && String(data.neighborhood).toLowerCase() === 'balcao') ||
        data.order_type === 'takeout';
      if (isTakeoutOrder && canApplyExternalStatus(data.status, 'cancelled')) {
        await setDoc(doc(db, 'orders', d.id), { status: 'cancelled', statusSource: 'system_cleanup' }, { merge: true });
        purgedTakeoutCount++;
        continue;
      }

      const isGhost =
        (!data.clientName || data.clientName === 'Cliente Cardápio Web' || data.clientName === 'Cliente não informado') &&
        (!data.total || Number(data.total) <= 0);
      if (isGhost && canApplyExternalStatus(data.status, 'cancelled')) {
        await setDoc(doc(db, 'orders', d.id), { status: 'cancelled', statusSource: 'system_cleanup' }, { merge: true });
        purgedEmptyCount++;
        continue;
      }

      const storeId = String(data.storeId || data.storeBranch || '').trim().toLowerCase();
      if (!storeId) continue;

      const externalId = data.externalOrderId || d.id.replace(/^cw_[^_]+_/, '').replace(/^cw_/, '');
      const external =
        externalMap.get(`${storeId}:id:${String(externalId)}`) ||
        (data.codeNumber != null ? externalMap.get(`${storeId}:display:${String(data.codeNumber)}`) : null);
      if (!external) continue;

      const targetStatus = mapExternalStatus(external.status);
      const patch: any = {
        externalStatus: String(external.status || ''),
        externalStatusSyncedAt: new Date().toISOString(),
      };

      if (targetStatus) {
        if (canApplyExternalStatus(data.status, targetStatus)) {
          patch.status = targetStatus;
          patch.statusSource = 'cardapio_web';
          if (targetStatus === 'delivered') {
            patch.closedAt = new Date().toISOString();
            patch.closedInCardapioWeb = true;
            deliveredCount++;
          } else if (targetStatus === 'dispatched') {
            dispatchedCount++;
          } else if (targetStatus === 'cancelled') {
            cancelledCount++;
          }
        } else if (targetStatus !== data.status) {
          regressionBlockedCount++;
        }
      }

      await setDoc(doc(db, 'orders', d.id), patch, { merge: true });
    }

    return res.status(200).json({
      success: true,
      storesChecked: stores.length,
      totalCwOrders: externalOrders.length,
      dispatchedCount,
      deliveredCount,
      cancelledCount,
      purgedEmptyCount,
      purgedTakeoutCount,
      regressionBlockedCount,
      totalUpdated: dispatchedCount + deliveredCount + cancelledCount,
    });
  } catch (err: any) {
    console.error('Erro na sincronizacao Cardapio Web Vercel:', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
