import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

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

const BLUMENAU_NEIGHBORHOOD_COORDS: Record<string, { lat: number; lng: number }> = {
  'velha central': { lat: -26.9284, lng: -49.1147 }, 'velha grande': { lat: -26.9550, lng: -49.1310 },
  'velha': { lat: -26.9200, lng: -49.0950 }, 'garcia': { lat: -26.9450, lng: -49.0680 },
  'centro': { lat: -26.9194, lng: -49.0661 }, 'itoupava norte': { lat: -26.8850, lng: -49.0800 },
  'itoupavazinha': { lat: -26.8650, lng: -49.0950 }, 'fortaleza': { lat: -26.8900, lng: -49.0550 },
  'vila nova': { lat: -26.9100, lng: -49.0850 }, 'victor konder': { lat: -26.9150, lng: -49.0750 },
  'escola agrícola': { lat: -26.8950, lng: -49.1050 }, 'escola agricola': { lat: -26.8950, lng: -49.1050 },
  'água verde': { lat: -26.9150, lng: -49.1200 }, 'agua verde': { lat: -26.9150, lng: -49.1200 },
  'passo manso': { lat: -26.9180, lng: -49.1450 }, 'salto do norte': { lat: -26.8700, lng: -49.1100 },
  'badenfurt': { lat: -26.8650, lng: -49.1450 }, 'vorstadt': { lat: -26.9300, lng: -49.0450 },
  'ponta aguda': { lat: -26.9250, lng: -49.0550 }, 'progresso': { lat: -26.9800, lng: -49.0700 },
  'da glória': { lat: -26.9600, lng: -49.0650 }, 'gloria': { lat: -26.9600, lng: -49.0650 },
  'valparaíso': { lat: -26.9550, lng: -49.0850 }, 'valparaiso': { lat: -26.9550, lng: -49.0850 },
  'tribess': { lat: -26.8750, lng: -49.0400 }, 'itoupava central': { lat: -26.8200, lng: -49.0900 },
  'testo salto': { lat: -26.8250, lng: -49.1500 }, 'fidélis': { lat: -26.8400, lng: -49.0700 },
  'fidelis': { lat: -26.8400, lng: -49.0700 },
};

async function resolveCoordinates(address: any, isTakeout: boolean, branch: 'hope_burger' | 'hope_pizza') {
  if (isTakeout) return branch === 'hope_pizza' ? { lat: -26.9240, lng: -49.0630 } : { lat: -26.9194, lng: -49.0661 };
  if (address.latitude && address.longitude) {
    const lat = Number(address.latitude), lng = Number(address.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0) return { lat, lng };
  }
  const street = (address.street || address.rua || address.logradouro || '').trim();
  const houseNumber = (address.number || address.numero || '').trim();
  const neighborhood = (address.neighborhood || address.bairro || '').trim();
  const city = (address.city || address.cidade || 'Blumenau').trim();
  if (street && street !== 'Rua não informada') {
    for (const q of [
      `${street}${houseNumber ? `, ${houseNumber}` : ''}, ${neighborhood ? `${neighborhood}, ` : ''}${city}, SC, Brasil`,
      `${street}, ${city}, SC, Brasil`,
    ]) {
      try {
        const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, {
          headers: { 'User-Agent': 'RotaFacilDelivery/1.0', 'Accept-Language': 'pt-BR,pt;q=0.9' }, signal: AbortSignal.timeout(3000),
        });
        if (geo.ok) {
          const data = await geo.json();
          if (data?.length) {
            const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
            if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
          }
        }
      } catch {}
    }
  }
  const lower = neighborhood.toLowerCase();
  for (const [key, coords] of Object.entries(BLUMENAU_NEIGHBORHOOD_COORDS)) {
    if (lower.includes(key)) return { lat: coords.lat + (Math.random() - .5) * .003, lng: coords.lng + (Math.random() - .5) * .003 };
  }
  return branch === 'hope_pizza' ? { lat: -26.9240, lng: -49.0630 } : { lat: -26.9194, lng: -49.0661 };
}

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
function mapStatus(raw: unknown): 'pending' | 'preparing' | 'dispatched' | 'delivered' | 'cancelled' {
  const status = normalize(raw);
  if (['released', 'dispatched', 'saiu_para_entrega', 'out_for_delivery'].includes(status)) return 'dispatched';
  if (['closed', 'delivered', 'finalized', 'concluded', 'completed'].includes(status)) return 'delivered';
  if (['canceled', 'cancelled', 'rejected'].includes(status)) return 'cancelled';
  if (['preparing', 'production', 'in_preparation', 'accepted'].includes(status)) return 'preparing';
  return 'pending';
}
function courierName(order: any): string | null {
  const candidates = [order?.deliveryman, order?.delivery_man, order?.courier, order?.driver, order?.motoboy, order?.entregador, order?.delivery_person,
    order?.delivery?.deliveryman, order?.delivery?.courier, order?.delivery?.driver, order?.delivery?.motoboy, order?.delivery?.entregador];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'string' && c.trim()) return c.trim();
    const name = c.name || c.nome || c.full_name || c.display_name;
    if (name && String(name).trim()) return String(name).trim();
  }
  return null;
}

function parseSourceDate(...values: any[]) {
  for (const raw of values) {
    if (raw == null || raw === '') continue;
    let date: Date | null = null;
    if (typeof raw === 'number') {
      const ms = raw < 100000000000 ? raw * 1000 : raw;
      date = new Date(ms);
    } else {
      const text = String(raw).trim();
      if (/^\d+$/.test(text)) {
        const n = Number(text);
        date = new Date(n < 100000000000 ? n * 1000 : n);
      } else {
        date = new Date(text.includes(' ') && !text.includes('T') ? text.replace(' ', 'T') : text);
      }
    }
    if (!date || Number.isNaN(date.getTime())) continue;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return { date: `${obj.year}-${obj.month}-${obj.day}`, timestamp: date.getTime() };
  }
  return null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-KEY, X-Webhook-Token, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ status: 'ok', service: 'Cardápio Web Webhook Vercel' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const db = getDbInstance();
    let payload = req.body || {};
    if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { payload = {}; } }
    const branchParam = (req.query?.branchId || req.query?.branch || '').toString().toLowerCase();
    const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = 'ed3bxFMKCQGtaqbTVJrDy6ZqfM7z2hEFLaRmQBo3tMW4ZkGuxTmBHAweBTrx';
    const CARDAPIO_WEB_HOPE_BURGER_TOKEN = 'ddoFwAw7TbrhTcV1CzeR1bqZAegsjZyzescnjr9QfR2dBEdo6QZNMNkbSeYx';
    const cwOrderId = payload.id || payload.order_id || payload.data?.id;
    let branch: 'hope_burger' | 'hope_pizza' = branchParam.includes('burger') ? 'hope_burger' : 'hope_pizza';
    let orderData: any = payload;

    if (cwOrderId) {
      const explicitBurger = branchParam.includes('burger');
      const firstToken = explicitBurger ? CARDAPIO_WEB_HOPE_BURGER_TOKEN : CARDAPIO_WEB_HOPE_PIZZA_TOKEN;
      const secondToken = explicitBurger ? CARDAPIO_WEB_HOPE_PIZZA_TOKEN : CARDAPIO_WEB_HOPE_BURGER_TOKEN;
      try {
        const first = await fetch(`https://integracao.cardapioweb.com/api/partner/v1/orders/${cwOrderId}`, { headers: { 'X-API-KEY': firstToken } });
        if (first.ok) {
          const fetched = await first.json();
          if (fetched?.id) { orderData = fetched; branch = explicitBurger ? 'hope_burger' : 'hope_pizza'; }
        } else {
          const second = await fetch(`https://integracao.cardapioweb.com/api/partner/v1/orders/${cwOrderId}`, { headers: { 'X-API-KEY': secondToken } });
          if (second.ok) {
            const fetched = await second.json();
            if (fetched?.id) { orderData = fetched; branch = explicitBurger ? 'hope_pizza' : 'hope_burger'; }
          }
        }
      } catch (error) { console.error('Falha ao consultar API Cardápio Web:', error); }
    }

    const sourceCreated = parseSourceDate(
      orderData.created_at, orderData.createdAt, orderData.created, orderData.order_date, orderData.orderDate,
      orderData.date, orderData.datetime, orderData.created_datetime,
      payload.created_at, payload.createdAt, payload.created, payload.order_date, payload.orderDate, payload.date
    );

    const rawStatus = orderData.status || payload.status || payload.data?.status || payload.event_status || '';
    const mappedStatus = mapStatus(rawStatus);
    const orderId = `cw_${cwOrderId || Date.now()}`;
    const existingRef = doc(db, 'orders', orderId);
    const existingSnap = cwOrderId ? await getDoc(existingRef) : null;
    const existing = existingSnap?.exists() ? existingSnap.data() as any : null;
    const driver = courierName(orderData) || courierName(payload);

    if (cwOrderId && existing && rawStatus) {
      const statusPatch: any = {
        status: mappedStatus,
        cardapioWebStatus: normalize(rawStatus),
        lastCardapioWebSyncAt: Date.now(),
        closedInCardapioWeb: mappedStatus === 'delivered',
      };
      if (sourceCreated) {
        statusPatch.sourceCreatedDate = sourceCreated.date;
        statusPatch.sourceCreatedTimestamp = sourceCreated.timestamp;
      }
      if (mappedStatus === 'dispatched') {
        statusPatch.dispatchedAt = existing.dispatchedAt || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        statusPatch.closedAt = null;
      } else if (mappedStatus === 'delivered') {
        statusPatch.closedAt = existing.closedAt || new Date().toISOString();
      }
      if (driver) { statusPatch.externalMotoboyName = driver; statusPatch.assignedMotoboyName = driver; }
      await setDoc(existingRef, statusPatch, { merge: true });
    }

    const orderType = normalize(orderData.order_type || payload.order_type);
    const isTakeout = ['takeout', 'indoor', 'balcao'].includes(orderType);
    if (isTakeout) return res.status(200).json({ status: 'ignored_takeout', message: 'Pedido de balcão ignorado para entrega' });

    const customer = orderData.customer || payload.customer || payload.cliente || {};
    const address = orderData.delivery_address || payload.delivery_address || payload.endereco || payload.address || {};
    const clientName = customer.name || customer.nome || payload.client_name || '';
    const clientPhone = customer.phone ? `${customer.ddi || '55'}${customer.phone}` : (customer.telefone || customer.cellphone || '');
    const deliveryFee = Number(orderData.delivery_fee ?? payload.delivery_fee ?? payload.taxa_entrega ?? existing?.deliveryFee ?? 0);
    const total = Number(orderData.total ?? payload.total ?? payload.valor_total ?? existing?.total ?? 0);

    if (total <= 0 && (!clientName || clientName.trim() === '')) {
      if (existing && rawStatus) return res.status(200).json({ status: 'status_updated', success: true, orderId, mappedStatus });
      return res.status(200).json({ status: 'ignored_empty', message: 'Payload sem dados suficientes' });
    }

    const finalClientName = clientName.trim() || existing?.clientName || 'Cliente Cardápio Web';
    const street = address.street || address.rua || address.logradouro || existing?.street || 'Rua não informada';
    const houseNumber = address.number || address.numero || existing?.houseNumber || '';
    const complement = address.complement || address.complemento || existing?.complement || '';
    const neighborhood = address.neighborhood || address.bairro || existing?.neighborhood || 'Centro';
    const reference = address.reference ? ` (${String(address.reference).trim()})` : '';
    const fullAddress = `${street}${houseNumber ? `, ${houseNumber}` : ''}${complement ? ` - ${complement}` : ''} - ${neighborhood}${reference}`;
    const coords = Object.keys(address).length ? await resolveCoordinates(address, false, branch) : { lat: existing?.lat, lng: existing?.lng };

    const rawItems = orderData.items || payload.items || payload.itens || payload.products || existing?.items || [];
    const items = Array.isArray(rawItems) ? rawItems.map((item: any, idx: number) => {
      const optionsText = Array.isArray(item.options) && item.options.length ? ` (${item.options.map((o: any) => o.name).filter(Boolean).join(', ')})` : '';
      return { id: String(item.item_id || item.id || idx + 1), name: `${item.name || item.nome || item.title || 'Item'}${optionsText}`, quantity: Number(item.quantity || item.qtd || item.quantidade || 1), price: Number(item.total_price || item.unit_price || item.price || item.valor || 0) };
    }) : [];
    const itemsSummary = items.length ? items.map((i: any) => `${i.quantity}x ${i.name}`).join(' | ') : (existing?.itemsSummary || orderData.observation || payload.notes || payload.observacoes || 'Pedido Cardápio Web');
    const payments = orderData.payments || [];
    const rawPayment = payments[0] || payload.payment || payload.pagamento || {};
    let paymentMethod: 'pix' | 'card_credit' | 'card_debit' | 'cash' = existing?.paymentMethod || 'pix';
    const paymentStr = JSON.stringify(rawPayment).toLowerCase();
    if (paymentStr.includes('dinheiro') || paymentStr.includes('money') || paymentStr.includes('cash')) paymentMethod = 'cash';
    else if (paymentStr.includes('debito') || paymentStr.includes('debit')) paymentMethod = 'card_debit';
    else if (paymentStr.includes('credito') || paymentStr.includes('credit')) paymentMethod = 'card_credit';

    const now = new Date();
    const localDateKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const displayId = orderData.display_id || payload.code || payload.codigo || payload.id_curto || existing?.codeNumber;
    const codeNumber = displayId ? Number(displayId) : (orderData.id ? Number(String(orderData.id).slice(-4)) : existing?.codeNumber || 0);
    const branchPrefix = branch === 'hope_burger' ? 'HB' : 'HP';
    const displayCode = `${branchPrefix}-${codeNumber}`;
    const storeName = branch === 'hope_burger' ? 'Hope Burger' : 'Hope Pizza';
    const subtotal = total > 0 ? total - deliveryFee : Number(payload.subtotal || existing?.subtotal || 0);
    const trackingCode = existing?.trackingCode || `CW-${branchPrefix}-${codeNumber}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;

    const completeOrder: any = {
      id: orderId, codeNumber, displayCode, clientName: finalClientName, clientPhone: clientPhone || existing?.clientPhone || '',
      address: fullAddress, street, houseNumber, complement, neighborhood, lat: coords.lat, lng: coords.lng,
      items, itemsSummary, subtotal: subtotal || total, deliveryFee, total, paymentMethod,
      changeFor: rawPayment.change_for || rawPayment.troco_para || existing?.changeFor || null,
      status: mappedStatus, createdAt: existing?.createdAt || new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
      createdDate: sourceCreated?.date || existing?.createdDate || localDateKey,
      createdTimestamp: sourceCreated?.timestamp || existing?.createdTimestamp || Date.now(),
      sourceCreatedDate: sourceCreated?.date || existing?.sourceCreatedDate || null,
      sourceCreatedTimestamp: sourceCreated?.timestamp || existing?.sourceCreatedTimestamp || null,
      originChannel: 'cardapio_web', storeBranch: branch, storeName,
      operationalEpoch: STORE_PILOT_RESET_VERSION, trackingCode, externalOrderId: String(cwOrderId || ''),
      cardapioWebStatus: normalize(rawStatus), lastCardapioWebSyncAt: Date.now(), closedInCardapioWeb: mappedStatus === 'delivered',
    };
    if (mappedStatus === 'dispatched') { completeOrder.dispatchedAt = existing?.dispatchedAt || new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); completeOrder.closedAt = null; }
    if (mappedStatus === 'delivered') completeOrder.closedAt = existing?.closedAt || new Date().toISOString();
    if (driver) { completeOrder.externalMotoboyName = driver; completeOrder.assignedMotoboyName = driver; }

    await setDoc(existingRef, completeOrder, { merge: true });
    return res.status(200).json({ status: 'received', success: true, orderId, codeNumber, displayCode, mappedStatus, driver: driver || null, sourceCreatedDate: completeOrder.sourceCreatedDate });
  } catch (err: any) {
    console.error('Erro no webhook Vercel:', err);
    return res.status(500).json({ error: 'Erro ao processar pedido', details: err?.message });
  }
}
