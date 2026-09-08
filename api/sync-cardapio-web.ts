import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = 'ed3bxFMKCQGtaqbTVJrDy6ZqfM7z2hEFLaRmQBo3tMW4ZkGuxTmBHAweBTrx';
const CARDAPIO_WEB_HOPE_BURGER_TOKEN = 'ddoFwAw7TbrhTcV1CzeR1bqZAegsjZyzescnjr9QfR2dBEdo6QZNMNkbSeYx';

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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = getDbInstance();
    const [cwPizzaRes, cwBurgerRes] = await Promise.all([
      fetch('https://integracao.cardapioweb.com/api/partner/v1/orders', {
        headers: { 'X-API-KEY': CARDAPIO_WEB_HOPE_PIZZA_TOKEN },
      }),
      fetch('https://integracao.cardapioweb.com/api/partner/v1/orders', {
        headers: { 'X-API-KEY': CARDAPIO_WEB_HOPE_BURGER_TOKEN },
      }),
    ]);

    const pizzaList = cwPizzaRes.ok ? await cwPizzaRes.json() : [];
    const burgerList = cwBurgerRes.ok ? await cwBurgerRes.json() : [];

    const cwList = [
      ...(Array.isArray(pizzaList) ? pizzaList.map((o: any) => ({ ...o, _branch: 'hope_pizza' })) : []),
      ...(Array.isArray(burgerList) ? burgerList.map((o: any) => ({ ...o, _branch: 'hope_burger' })) : []),
    ];

    const cwMap = new Map();
    cwList.forEach((o: any) => {
      cwMap.set(String(o.id), o.status);
      cwMap.set(`cw_${o.id}`, o.status);
      if (o.display_id) {
        cwMap.set(`${o._branch}_display_${o.display_id}`, o.status);
        cwMap.set(`display_${o.display_id}`, o.status);
      }
    });

    const snap = await getDocs(collection(db, 'orders'));
    let dispatchedCount = 0;
    let deliveredCount = 0;
    let purgedEmptyCount = 0;
    let purgedTakeoutCount = 0;

    for (const d of snap.docs) {
      const data = d.data() as any;

      // Pedidos de balcão / retirada devem ser ignorados do balcão de entregas
      const isTakeoutOrder = (data.address && data.address.toLowerCase().includes('retirada')) ||
                             (data.neighborhood && data.neighborhood.toLowerCase() === 'balcão') ||
                             data.order_type === 'takeout';
      if (isTakeoutOrder) {
        await setDoc(doc(db, 'orders', d.id), { status: 'cancelled' }, { merge: true });
        purgedTakeoutCount++;
        continue;
      }

      // Limpeza preventiva: pedidos fantasmas
      const isGhost = (!data.clientName || data.clientName === 'Cliente Cardápio Web' || data.clientName === 'Cliente não informado') && (!data.total || Number(data.total) <= 0);
      if (isGhost) {
        await setDoc(doc(db, 'orders', d.id), { status: 'cancelled' }, { merge: true });
        purgedEmptyCount++;
        continue;
      }

      const cleanDocId = d.id.replace(/^cw_/, '');
      const branchKey = data.storeBranch || (data.storeName?.toLowerCase().includes('burger') ? 'hope_burger' : 'hope_pizza');
      const cwStatus = cwMap.get(d.id) ||
                       cwMap.get(cleanDocId) ||
                       (data.codeNumber ? cwMap.get(`${branchKey}_display_${data.codeNumber}`) : null) ||
                       (data.codeNumber ? cwMap.get(`display_${data.codeNumber}`) : null);
      if (!cwStatus) continue;

      const normCwStatus = String(cwStatus).trim().toLowerCase();
      let targetStatus: string | null = null;
      if (['closed', 'released', 'delivered', 'dispatched', 'saiu_para_entrega', 'finalized', 'concluded'].includes(normCwStatus)) {
        // Pedido já foi despachado ou entregue no Cardápio Web: deve sumir da fila ativa do Rota Fácil
        targetStatus = 'delivered';
      } else if (['canceled', 'cancelled', 'rejected'].includes(normCwStatus)) {
        targetStatus = 'failed';
      }

      if (targetStatus && targetStatus !== data.status) {
        await setDoc(doc(db, 'orders', d.id), {
          status: targetStatus,
          closedAt: new Date().toISOString(),
          closedInCardapioWeb: true,
        }, { merge: true });
        if (targetStatus === 'delivered') deliveredCount++;
      }
    }

    return res.status(200).json({
      success: true,
      totalCwOrders: cwList.length,
      dispatchedCount,
      deliveredCount,
      purgedEmptyCount,
      purgedTakeoutCount,
      totalUpdated: dispatchedCount + deliveredCount,
    });
  } catch (err: any) {
    console.error('Erro na sincronização Cardápio Web Vercel:', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
