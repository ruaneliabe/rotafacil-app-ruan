import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const ACTIVE_ROUTE_STATUSES = ['picked_up', 'dispatched', 'in_transit'];

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

function requestOrigin(req: any) {
  const proto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : '';
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = getDbInstance();
    const origin = requestOrigin(req);
    if (!origin) return res.status(500).json({ error: 'Não foi possível determinar a origem da aplicação.' });

    const snap = await getDocs(collection(db, 'orders'));
    const candidates = snap.docs
      .map((row) => ({ id: row.id, data: row.data() as any }))
      .filter(({ data }) => data.originChannel === 'cardapio_web' && ACTIVE_ROUTE_STATUSES.includes(data.status));

    let checked = 0;
    let refreshed = 0;
    const failures: string[] = [];

    // O webhook existente já possui as credenciais atuais e consulta /orders/{id}.
    // Reutilizamos exatamente esse caminho para não duplicar nem mover tokens.
    for (const { id: documentId, data } of candidates) {
      const externalId = String(data.externalOrderId || documentId.replace(/^cw_/, ''));
      if (!externalId) continue;

      const branch = String(data.storeBranch || (data.storeName?.toLowerCase().includes('burger') ? 'hope_burger' : 'hope_pizza'));
      checked++;

      try {
        const response = await fetch(`${origin}/api/webhook-cardapio-web?branchId=${encodeURIComponent(branch)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: externalId, order_id: externalId }),
        });

        if (response.ok) refreshed++;
        else failures.push(`${documentId}:${response.status}`);
      } catch {
        failures.push(`${documentId}:request_failed`);
      }
    }

    return res.status(200).json({
      success: true,
      candidates: candidates.length,
      checked,
      refreshed,
      failures: failures.slice(0, 10),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || String(error) });
  }
}
