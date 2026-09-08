import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { findCardapioWebStore, getCardapioWebStores, CardapioWebStoreConfig } from './cardapio-web-config';

const STORE_PILOT_RESET_VERSION = 'zeroed_store_pilot_2026_08_17_v10';

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

function mapExternalStatus(status: unknown): 'pending' | 'dispatched' | 'delivered' | 'cancelled' {
  const value = String(status || '').trim().toLowerCase();
  if (['closed', 'delivered', 'finalized', 'concluded'].includes(value)) return 'delivered';
  if (['released', 'dispatched', 'saiu_para_entrega'].includes(value)) return 'dispatched';
  if (['canceled', 'cancelled', 'rejected'].includes(value)) return 'cancelled';
  return 'pending';
}

function resolveStatus(currentStatus: unknown, externalStatus: unknown): string {
  const current = String(currentStatus || 'pending').toLowerCase();
  const target = mapExternalStatus(externalStatus);
  if (current === 'delivered' || current === 'cancelled') return current;
  if (target === 'cancelled') return (STATUS_RANK[current] || 0) < STATUS_RANK.dispatched ? 'cancelled' : current;
  return (STATUS_RANK[target] || 0) > (STATUS_RANK[current] || 0) ? target : current;
}

async function resolveCoordinates(address: any, store: CardapioWebStoreConfig): Promise<{ lat: number; lng: number }> {
  const directLat = Number(address?.latitude ?? address?.lat);
  const directLng = Number(address?.longitude ?? address?.lng);
  if (Number.isFinite(directLat) && Number.isFinite(directLng) && directLat !== 0 && directLng !== 0) {
    return { lat: directLat, lng: directLng };
  }

  const street = String(address?.street || address?.rua || address?.logradouro || '').trim();
  const number = String(address?.number || address?.numero || '').trim();
  const neighborhood = String(address?.neighborhood || address?.bairro || '').trim();
  const city = String(address?.city || address?.cidade || 'Blumenau').trim();

  if (street) {
    try {
      const q = `${street}${number ? `, ${number}` : ''}, ${neighborhood ? `${neighborhood}, ` : ''}${city}, SC, Brasil`;
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, {
        headers: { 'User-Agent': 'RotaFacilDelivery/1.0', 'Accept-Language': 'pt-BR,pt;q=0.9' },
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data[0]) {
          const lat = Number(data[0].lat);
          const lng = Number(data[0].lon);
          if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
        }
      }
    } catch (error) {
      console.warn('[Cardapio Web] Falha ao geocodificar endereco:', error);
    }
  }

  return {
    lat: store.originLat ?? -26.9194,
    lng: store.originLng ?? -49.0661,
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Token, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ status: 'ok', service: 'Cardapio Web Webhook Vercel' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const db = getDbInstance();
    const stores = getCardapioWebStores();
    let payload = req.body || {};
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = {}; }
    }

    const storeSelector = req.query?.storeId || req.query?.branchId || req.query?.branch;
    let store = findCardapioWebStore(stores, storeSelector);
    const cwOrderId = payload.id || payload.order_id || payload.data?.id;
    let orderData: any = payload;

    // O storeId na URL e a fonte primaria. Para webhooks legados sem storeId,
    // tenta localizar o pedido nas lojas configuradas sem expor nenhuma chave ao cliente.
    const candidates = store ? [store] : stores;
    if (cwOrderId) {
      for (const candidate of candidates) {
        try {
          const response = await fetch(`https://integracao.cardapioweb.com/api/partner/v1/orders/${encodeURIComponent(String(cwOrderId))}`, {
            headers: { 'X-API-KEY': candidate.apiKey },
          });
          if (!response.ok) continue;
          const fetched = await response.json();
          if (fetched?.id) {
            store = candidate;
            orderData = fetched;
            break;
          }
        } catch (error) {
          console.error(`[Cardapio Web Webhook] consulta ${candidate.storeId}:`, error);
        }
      }
    }

    if (!store) return res.status(400).json({ error: 'Loja Cardapio Web nao identificada' });

    const externalOrderId = String(orderData.id || cwOrderId || '').trim();
    if (!externalOrderId) return res.status(400).json({ error: 'Pedido sem identificador externo' });

    const isTakeout = ['takeout', 'indoor', 'balcao'].includes(String(orderData.order_type || payload.order_type || '').toLowerCase()) ||
      (!orderData.delivery_address && orderData.order_type && orderData.order_type !== 'delivery');
    if (isTakeout) return res.status(200).json({ status: 'ignored_takeout', message: 'Pedido de balcao ignorado para entrega' });

    const customer = orderData.customer || payload.customer || payload.cliente || {};
    const address = orderData.delivery_address || payload.delivery_address || payload.endereco || payload.address || {};
    const clientName = String(customer.name || customer.nome || payload.client_name || '').trim();
    const clientPhone = customer.phone ? `${customer.ddi || '55'}${customer.phone}` : (customer.telefone || customer.cellphone || '');
    const deliveryFee = Number(orderData.delivery_fee ?? payload.delivery_fee ?? payload.taxa_entrega ?? 0);
    const total = Number(orderData.total ?? payload.total ?? payload.valor_total ?? 0);
    const subtotal = total > 0 ? total - deliveryFee : Number(payload.subtotal || 0);

    if (total <= 0 && !clientName) return res.status(200).json({ status: 'ignored_empty', message: 'Payload sem dados suficientes' });

    const street = address.street || address.rua || address.logradouro || 'Rua nao informada';
    const houseNumber = address.number || address.numero || '';
    const complement = address.complement || address.complemento || '';
    const neighborhood = address.neighborhood || address.bairro || 'Centro';
    const reference = address.reference ? ` (${String(address.reference).trim()})` : '';
    const fullAddress = `${street}${houseNumber ? `, ${houseNumber}` : ''}${complement ? ` - ${complement}` : ''} - ${neighborhood}${reference}`;
    const { lat, lng } = await resolveCoordinates(address, store);

    const rawItems = orderData.items || payload.items || payload.itens || payload.products || [];
    const items = Array.isArray(rawItems) ? rawItems.map((item: any, idx: number) => ({
      id: String(item.item_id || item.id || idx + 1),
      name: String(item.name || item.nome || item.title || 'Item'),
      quantity: Number(item.quantity || item.qtd || item.quantidade || 1),
      price: Number(item.total_price || item.unit_price || item.price || item.valor || 0),
    })) : [];
    const itemsSummary = items.length ? items.map((item: any) => `${item.quantity}x ${item.name}`).join(' | ') : (orderData.observation || payload.notes || 'Pedido Cardapio Web');

    const rawPayment = (orderData.payments || [])[0] || payload.payment || payload.pagamento || {};
    const paymentStr = JSON.stringify(rawPayment).toLowerCase();
    let paymentMethod = 'pix';
    if (paymentStr.includes('dinheiro') || paymentStr.includes('cash')) paymentMethod = 'dinheiro';
    else if (paymentStr.includes('cart') || paymentStr.includes('credit') || paymentStr.includes('debit')) paymentMethod = 'cartao_maquininha';

    const displayId = orderData.display_id || payload.code || payload.codigo || payload.id_curto;
    const codeNumber = displayId ? Number(displayId) : Number(String(externalOrderId).slice(-4)) || 0;
    const displayCode = `${store.prefix}-${codeNumber}`;

    // Idempotencia: mesma loja + mesmo ID externo = sempre o mesmo documento.
    const orderId = `cw_${store.storeId}_${externalOrderId}`;
    const orderRef = doc(db, 'orders', orderId);
    const existingSnap = await getDoc(orderRef);
    const existing = existingSnap.exists() ? existingSnap.data() as any : null;
    const externalStatus = String(orderData.status || payload.status || '').toLowerCase();
    const finalStatus = resolveStatus(existing?.status, externalStatus);
    const now = new Date();
    const localDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const completeOrder: any = {
      id: orderId,
      externalOrderId,
      externalStatus,
      externalStatusSyncedAt: now.toISOString(),
      codeNumber,
      displayCode,
      clientName: clientName || 'Cliente Cardapio Web',
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
      status: finalStatus,
      originChannel: 'cardapio_web',
      storeId: store.storeId,
      storeBranch: store.storeId,
      storeName: store.name,
      operationalEpoch: STORE_PILOT_RESET_VERSION,
      trackingCode: existing?.trackingCode || `CW-${store.prefix}-${codeNumber}-${externalOrderId.slice(-6).toUpperCase()}`,
      updatedAt: now.toISOString(),
    };

    // Campos operacionais locais nunca sao resetados por webhook repetido.
    if (!existing) {
      completeOrder.createdAt = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      completeOrder.createdDate = localDateKey;
      completeOrder.createdTimestamp = Date.now();
      completeOrder.statusSource = 'cardapio_web';
    } else {
      delete completeOrder.createdAt;
      delete completeOrder.createdDate;
      delete completeOrder.createdTimestamp;
      if (finalStatus !== existing.status) completeOrder.statusSource = 'cardapio_web';
    }

    await setDoc(orderRef, completeOrder, { merge: true });

    return res.status(200).json({
      status: existing ? 'updated' : 'received',
      success: true,
      orderId,
      storeId: store.storeId,
      codeNumber,
      displayCode,
      duplicatePrevented: Boolean(existing),
    });
  } catch (err: any) {
    console.error('Erro no webhook Vercel:', err);
    return res.status(500).json({ error: 'Erro ao processar pedido', details: err?.message });
  }
}
