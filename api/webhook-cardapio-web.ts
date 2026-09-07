import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const STORE_PILOT_RESET_VERSION = 'zeroed_store_pilot_2026_08_17_v10';

const FIREBASE_CONFIG = {
  projectId: "gentle-country-q2l12",
  appId: "1:1093185971024:web:0d69aec4e35fcbaae24255",
  apiKey: "AIzaSyCvh0-Qr7HWJSX3NozYqHyfBY9ZaNEAejg",
  authDomain: "gentle-country-q2l12.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-rotafcildelivery-495fd3be-5974-4310-960a-26a794361d3b",
  storageBucket: "gentle-country-q2l12.firebasestorage.app",
  messagingSenderId: "1093185971024",
};

function getDbInstance() {
  const fbApp = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
  return FIREBASE_CONFIG.firestoreDatabaseId && FIREBASE_CONFIG.firestoreDatabaseId !== '(default)'
    ? getFirestore(fbApp, FIREBASE_CONFIG.firestoreDatabaseId)
    : getFirestore(fbApp);
}

export default async function handler(req: any, res: any) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-KEY, X-Webhook-Token, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'Cardápio Web Webhook Vercel' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getDbInstance();
    let payload = req.body || {};
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }
    const branchParam = (req.query?.branchId || req.query?.branch || '').toString().toLowerCase();

    // Identificar se o pedido pertence à Hope Burger ou Hope Pizza
    let branch: 'hope_burger' | 'hope_pizza' = 'hope_burger';
    if (branchParam.includes('pizza') || JSON.stringify(payload).toLowerCase().includes('pizza')) {
      branch = 'hope_pizza';
    }

    const customer = payload.customer || payload.cliente || {};
    const address = payload.delivery_address || payload.endereco || payload.address || {};
    const rawItems = payload.items || payload.itens || payload.products || [];

    const clientName = customer.name || customer.nome || payload.client_name || 'Cliente Cardápio Web';
    const clientPhone = customer.phone || customer.telefone || customer.cellphone || customer.celular || '';

    const street = address.street || address.rua || address.logradouro || address.address || 'Rua não informada';
    const houseNumber = address.number || address.numero || '';
    const complement = address.complement || address.complemento || '';
    const neighborhood = address.neighborhood || address.bairro || 'Centro';
    const fullAddress = `${street}${houseNumber ? `, ${houseNumber}` : ''}${complement ? ` - ${complement}` : ''} - ${neighborhood}`;

    const lat = Number(address.latitude || address.lat || (branch === 'hope_pizza' ? -26.9240 : -26.9194));
    const lng = Number(address.longitude || address.lng || (branch === 'hope_pizza' ? -49.0630 : -49.0661));

    const items = Array.isArray(rawItems)
      ? rawItems.map((item: any, idx: number) => ({
          id: String(item.id || idx + 1),
          name: item.name || item.nome || item.title || 'Item',
          quantity: Number(item.quantity || item.qtd || item.quantidade || 1),
          price: Number(item.price || item.valor || item.preco || 0),
        }))
      : [];

    const itemsSummary = items.length > 0
      ? items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')
      : (payload.notes || payload.observacoes || 'Pedido Cardápio Web');

    const subtotal = Number(payload.subtotal || payload.order_amount || payload.valor_produtos || 0);
    const deliveryFee = Number(payload.delivery_fee || payload.taxa_entrega || payload.shipping_fee || 0);
    const total = Number(payload.total || payload.valor_total || (subtotal + deliveryFee) || 0);

    const rawPayment = payload.payment || payload.pagamento || {};
    let paymentMethod: 'pix' | 'card_credit' | 'card_debit' | 'cash' = 'pix';
    const paymentStr = JSON.stringify(rawPayment).toLowerCase();
    if (paymentStr.includes('dinheiro') || paymentStr.includes('cash')) {
      paymentMethod = 'cash';
    } else if (paymentStr.includes('debito') || paymentStr.includes('debit')) {
      paymentMethod = 'card_debit';
    } else if (paymentStr.includes('credito') || paymentStr.includes('credit')) {
      paymentMethod = 'card_credit';
    }

    const today = new Date();
    const localDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const codeNumber = payload.code || payload.codigo || payload.id_curto || Math.floor(100 + Math.random() * 900);
    const orderId = `cw_${payload.id || payload.order_id || Date.now()}`;
    const trackingCode = `CW-${branch === 'hope_pizza' ? 'HP' : 'HB'}-${codeNumber}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const completeOrder = {
      id: orderId,
      codeNumber: Number(codeNumber),
      clientName,
      clientPhone,
      address: fullAddress,
      street,
      houseNumber,
      complement,
      neighborhood,
      lat,
      lng,
      items,
      itemsSummary,
      subtotal: subtotal || total,
      deliveryFee,
      total,
      paymentMethod,
      changeFor: rawPayment.change_for || rawPayment.troco_para || null,
      status: 'pending',
      createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      createdDate: localDateKey,
      originChannel: 'cardapio_web',
      storeBranch: branch,
      operationalEpoch: STORE_PILOT_RESET_VERSION,
      trackingCode,
    };

    await setDoc(doc(db, 'orders', orderId), completeOrder, { merge: true });

    return res.status(200).json({ status: 'received', success: true, orderId });
  } catch (err: any) {
    console.error('Erro no webhook Vercel:', err);
    return res.status(500).json({ error: 'Erro ao processar pedido', details: err?.message });
  }
}
