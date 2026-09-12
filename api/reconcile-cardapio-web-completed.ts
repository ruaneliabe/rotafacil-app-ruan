import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const ACTIVE_ROUTE_STATUSES = ['picked_up', 'dispatched', 'in_transit'];
const FIREBASE_APP_NAME = 'rotafacil-cardapio-completed-reconcile';

function getDbInstance() {
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyD-XkOCjvoGt3VZRfLQyH5Dg1S7P2Ex2-8',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || 'rotafacil-app-oficial.firebaseapp.com',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'rotafacil-app-oficial',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || 'rotafacil-app-oficial.firebasestorage.app',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '846726683671',
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '1:846726683671:web:d0b5ddc701815609be9052',
  };
  const app = getApps().find((candidate) => candidate.name === FIREBASE_APP_NAME)
    || initializeApp(firebaseConfig, FIREBASE_APP_NAME);
  const databaseId = process.env.VITE_FIRESTORE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || '(default)';
  return databaseId && databaseId !== '(default)' ? getFirestore(app, databaseId) : getFirestore(app);
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