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

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
const deliveredStatuses = ['closed','delivered','finalized','concluded','completed'];

function mapCwStatus(raw: unknown): string | null {
  const status = normalize(raw);
  if (['released','dispatched','saiu_para_entrega','out_for_delivery'].includes(status)) return 'dispatched';
  if (deliveredStatuses.includes(status)) return 'delivered';
  if (['canceled','cancelled','rejected'].includes(status)) return 'cancelled';
  if (['preparing','production','in_preparation','accepted'].includes(status)) return 'preparing';
  if (['pending','new','received','open'].includes(status)) return 'pending';
  return null;
}

async function fetchOrderById(externalId: string, token: string) {
  if (!externalId) return null;
  try {
    const response = await fetch(`https://integracao.cardapioweb.com/api/partner/v1/orders/${encodeURIComponent(externalId)}`, {
      headers: { 'X-API-KEY': token },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.id ? data : null;
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = getDbInstance();
    const [cwPizzaRes, cwBurgerRes] = await Promise.all([
      fetch('https://integracao.cardapioweb.com/api/partner/v1/orders', { headers: { 'X-API-KEY': CARDAPIO_WEB_HOPE_PIZZA_TOKEN } }),
      fetch('https://integracao.cardapioweb.com/api/partner/v1/orders', { headers: { 'X-API-KEY': CARDAPIO_WEB_HOPE_BURGER_TOKEN } }),
    ]);
    const pizzaList = cwPizzaRes.ok ? await cwPizzaRes.json() : [];
    const burgerList = cwBurgerRes.ok ? await cwBurgerRes.json() : [];
    const cwList = [
      ...(Array.isArray(pizzaList) ? pizzaList.map((o: any) => ({ ...o, _branch: 'hope_pizza' })) : []),
      ...(Array.isArray(burgerList) ? burgerList.map((o: any) => ({ ...o, _branch: 'hope_burger' })) : []),
    ];
    const cwMap = new Map<string, any>();
    cwList.forEach((o: any) => {
      cwMap.set(`${o._branch}:id:${o.id}`, o);
      cwMap.set(`${o._branch}:doc:cw_${o.id}`, o);
      if (o.display_id != null) cwMap.set(`${o._branch}:display:${o.display_id}`, o);
    });

    const snap = await getDocs(collection(db, 'orders'));
    let dispatchedCount = 0, deliveredCount = 0, cancelledCount = 0, purgedEmptyCount = 0, purgedTakeoutCount = 0, detailReconciledCount = 0;
    for (const d of snap.docs) {
      const data = d.data() as any;
      if (data.originChannel !== 'cardapio_web') continue;
      const isTakeoutOrder = (data.address && data.address.toLowerCase().includes('retirada')) || (data.neighborhood && data.neighborhood.toLowerCase() === 'balcão') || data.order_type === 'takeout';
      if (isTakeoutOrder) { await setDoc(doc(db, 'orders', d.id), { status: 'cancelled' }, { merge: true }); purgedTakeoutCount++; continue; }
      const isGhost = (!data.clientName || data.clientName === 'Cliente Cardápio Web' || data.clientName === 'Cliente não informado') && (!data.total || Number(data.total) <= 0);
      if (isGhost) { await setDoc(doc(db, 'orders', d.id), { status: 'cancelled' }, { merge: true }); purgedEmptyCount++; continue; }

      const branch = data.storeBranch || (data.storeName?.toLowerCase().includes('burger') ? 'hope_burger' : 'hope_pizza');
      const externalId = String(data.externalOrderId || d.id.replace(/^cw_/, ''));
      let cwOrder = cwMap.get(`${branch}:doc:${d.id}`) || cwMap.get(`${branch}:id:${externalId}`) || (data.codeNumber != null ? cwMap.get(`${branch}:display:${data.codeNumber}`) : null);

      // O endpoint de lista pode remover pedidos assim que são concluídos. Para pedidos ainda
      // ativos no Rota Fácil, consulta o pedido individualmente antes de mantê-lo preso em rota.
      if (!cwOrder && ['pending','preparing','ready_at_counter','picked_up','dispatched','in_transit'].includes(data.status)) {
        const primaryToken = branch === 'hope_burger' ? CARDAPIO_WEB_HOPE_BURGER_TOKEN : CARDAPIO_WEB_HOPE_PIZZA_TOKEN;
        const fallbackToken = branch === 'hope_burger' ? CARDAPIO_WEB_HOPE_PIZZA_TOKEN : CARDAPIO_WEB_HOPE_BURGER_TOKEN;
        cwOrder = await fetchOrderById(externalId, primaryToken);
        if (!cwOrder) cwOrder = await fetchOrderById(externalId, fallbackToken);
        if (cwOrder) detailReconciledCount++;
      }
      if (!cwOrder) continue;

      const status = normalize(cwOrder.status);
      const targetStatus = mapCwStatus(status);
      if (!targetStatus || targetStatus === data.status) continue;

      const patch: any = { status: targetStatus, cardapioWebStatus: status, lastCardapioWebSyncAt: Date.now(), closedInCardapioWeb: targetStatus === 'delivered' };
      if (targetStatus === 'dispatched') {
        patch.dispatchedAt = data.dispatchedAt || new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
        patch.closedAt = null;
        dispatchedCount++;
      } else if (targetStatus === 'delivered') {
        patch.closedAt = data.closedAt || new Date().toISOString();
        patch.routeCompletedAt = data.routeCompletedAt || Date.now();
        deliveredCount++;
      } else if (targetStatus === 'cancelled') {
        cancelledCount++;
      }
      await setDoc(doc(db, 'orders', d.id), patch, { merge: true });
    }
    return res.status(200).json({ success:true,totalCwOrders:cwList.length,dispatchedCount,deliveredCount,cancelledCount,purgedEmptyCount,purgedTakeoutCount,detailReconciledCount,totalUpdated:dispatchedCount+deliveredCount+cancelledCount });
  } catch (err:any) {
    console.error('Erro na sincronização Cardápio Web Vercel:', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
