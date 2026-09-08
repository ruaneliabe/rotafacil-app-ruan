import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

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

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();

function mapStatus(rawStatus: unknown) {
  const status = normalize(rawStatus);
  if (['released', 'dispatched', 'saiu_para_entrega', 'out_for_delivery'].includes(status)) return 'dispatched';
  if (['closed', 'delivered', 'finalized', 'concluded', 'completed'].includes(status)) return 'delivered';
  if (['canceled', 'cancelled', 'rejected'].includes(status)) return 'cancelled';
  if (['preparing', 'production', 'in_preparation', 'accepted'].includes(status)) return 'preparing';
  return 'pending';
}

function courierName(order: any): string | null {
  const candidates = [
    order?.deliveryman,
    order?.delivery_man,
    order?.courier,
    order?.driver,
    order?.motoboy,
    order?.entregador,
    order?.delivery_person,
    order?.delivery?.deliveryman,
    order?.delivery?.courier,
    order?.delivery?.driver,
    order?.delivery?.motoboy,
    order?.delivery?.entregador,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    const name = candidate.name || candidate.nome || candidate.full_name || candidate.display_name;
    if (name && String(name).trim()) return String(name).trim();
  }
  return null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const branches = Array.isArray(req.body?.branches) ? req.body.branches : [];
    const validBranches = branches.filter((b: any) =>
      ['hope_pizza', 'hope_burger'].includes(String(b?.id)) && typeof b?.token === 'string' && b.token.trim().length > 10
    );

    if (validBranches.length === 0) {
      return res.status(400).json({ error: 'Nenhuma credencial de loja disponível para sincronização.' });
    }

    const externalOrders: any[] = [];
    for (const branch of validBranches) {
      const response = await fetch('https://integracao.cardapioweb.com/api/partner/v1/orders', {
        method: 'GET',
        headers: { 'X-API-KEY': branch.token },
      });
      if (!response.ok) continue;
      const list = await response.json();
      if (Array.isArray(list)) {
        externalOrders.push(...list.map((order: any) => ({ ...order, _branch: branch.id })));
      }
    }

    const byKey = new Map<string, any>();
    for (const order of externalOrders) {
      if (order?.id != null) {
        byKey.set(`${order._branch}:id:${order.id}`, order);
        byKey.set(`${order._branch}:doc:cw_${order.id}`, order);
      }
      if (order?.display_id != null) {
        byKey.set(`${order._branch}:display:${order.display_id}`, order);
      }
    }

    const db = getDbInstance();
    const snap = await getDocs(collection(db, 'orders'));
    let updated = 0;
    let dispatched = 0;
    let delivered = 0;
    let cancelled = 0;

    for (const item of snap.docs) {
      const data = item.data() as any;
      if (data.originChannel !== 'cardapio_web') continue;

      const branch = data.storeBranch || (data.storeName?.toLowerCase().includes('burger') ? 'hope_burger' : 'hope_pizza');
      const externalId = String(data.externalOrderId || item.id.replace(/^cw_/, ''));
      const external = byKey.get(`${branch}:doc:${item.id}`) ||
        byKey.get(`${branch}:id:${externalId}`) ||
        (data.codeNumber != null ? byKey.get(`${branch}:display:${data.codeNumber}`) : null);

      if (!external) continue;

      const targetStatus = mapStatus(external.status);
      const driver = courierName(external);
      const patch: any = {
        status: targetStatus,
        cardapioWebStatus: normalize(external.status),
        lastCardapioWebSyncAt: Date.now(),
        closedInCardapioWeb: targetStatus === 'delivered',
      };

      if (targetStatus === 'dispatched') {
        patch.dispatchedAt = data.dispatchedAt || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        patch.closedAt = null;
        dispatched++;
      } else if (targetStatus === 'delivered') {
        patch.closedAt = data.closedAt || new Date().toISOString();
        delivered++;
      } else if (targetStatus === 'cancelled') {
        cancelled++;
      }

      if (driver) {
        patch.externalMotoboyName = driver;
        patch.assignedMotoboyName = driver;
      }

      const changed = data.status !== patch.status ||
        data.cardapioWebStatus !== patch.cardapioWebStatus ||
        (driver && data.externalMotoboyName !== driver);

      if (changed) {
        await setDoc(doc(db, 'orders', item.id), patch, { merge: true });
        updated++;
      }
    }

    return res.status(200).json({
      success: true,
      externalOrders: externalOrders.length,
      updated,
      dispatched,
      delivered,
      cancelled,
    });
  } catch (error: any) {
    console.error('Erro no shadow sync Cardápio Web:', error);
    return res.status(500).json({ error: error?.message || String(error) });
  }
}
