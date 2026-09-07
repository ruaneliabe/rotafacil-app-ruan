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

const BLUMENAU_NEIGHBORHOOD_COORDS: Record<string, { lat: number; lng: number }> = {
  'velha central': { lat: -26.9284, lng: -49.1147 },
  'velha grande': { lat: -26.9550, lng: -49.1310 },
  'velha': { lat: -26.9200, lng: -49.0950 },
  'garcia': { lat: -26.9450, lng: -49.0680 },
  'centro': { lat: -26.9194, lng: -49.0661 },
  'itoupava norte': { lat: -26.8850, lng: -49.0800 },
  'itoupavazinha': { lat: -26.8650, lng: -49.0950 },
  'fortaleza': { lat: -26.8900, lng: -49.0550 },
  'vila nova': { lat: -26.9100, lng: -49.0850 },
  'victor konder': { lat: -26.9150, lng: -49.0750 },
  'escola agrícola': { lat: -26.8950, lng: -49.1050 },
  'escola agricola': { lat: -26.8950, lng: -49.1050 },
  'água verde': { lat: -26.9150, lng: -49.1200 },
  'agua verde': { lat: -26.9150, lng: -49.1200 },
  'passo manso': { lat: -26.9180, lng: -49.1450 },
  'salto do norte': { lat: -26.8700, lng: -49.1100 },
  'badenfurt': { lat: -26.8650, lng: -49.1450 },
  'vorstadt': { lat: -26.9300, lng: -49.0450 },
  'ponta aguda': { lat: -26.9250, lng: -49.0550 },
  'progresso': { lat: -26.9800, lng: -49.0700 },
  'da glória': { lat: -26.9600, lng: -49.0650 },
  'gloria': { lat: -26.9600, lng: -49.0650 },
  'valparaíso': { lat: -26.9550, lng: -49.0850 },
  'valparaiso': { lat: -26.9550, lng: -49.0850 },
  'tribess': { lat: -26.8750, lng: -49.0400 },
  'itoupava central': { lat: -26.8200, lng: -49.0900 },
  'testo salto': { lat: -26.8250, lng: -49.1500 },
  'fidélis': { lat: -26.8400, lng: -49.0700 },
  'fidelis': { lat: -26.8400, lng: -49.0700 },
};

async function resolveCoordinates(
  address: any,
  isTakeout: boolean,
  branch: 'hope_burger' | 'hope_pizza'
): Promise<{ lat: number; lng: number }> {
  if (isTakeout) {
    return branch === 'hope_pizza' ? { lat: -26.9240, lng: -49.0630 } : { lat: -26.9194, lng: -49.0661 };
  }

  if (address.latitude && address.longitude) {
    const lat = Number(address.latitude);
    const lng = Number(address.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
      return { lat, lng };
    }
  }

  const street = (address.street || address.rua || address.logradouro || '').trim();
  const houseNumber = (address.number || address.numero || '').trim();
  const neighborhood = (address.neighborhood || address.bairro || '').trim();
  const city = (address.city || address.cidade || 'Blumenau').trim();

  if (street && street !== 'Rua não informada') {
    try {
      const q = `${street}${houseNumber ? `, ${houseNumber}` : ''}, ${neighborhood ? `${neighborhood}, ` : ''}${city}, SC, Brasil`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, {
        headers: { 'User-Agent': 'RotaFacilDelivery/1.0', 'Accept-Language': 'pt-BR,pt;q=0.9' },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
          }
        }
      }
    } catch {}

    try {
      const q = `${street}, ${city}, SC, Brasil`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`, {
        headers: { 'User-Agent': 'RotaFacilDelivery/1.0', 'Accept-Language': 'pt-BR,pt;q=0.9' },
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
          }
        }
      }
    } catch {}
  }

  const lowerNeigh = neighborhood.toLowerCase();
  for (const [key, coords] of Object.entries(BLUMENAU_NEIGHBORHOOD_COORDS)) {
    if (lowerNeigh.includes(key)) {
      const jitterLat = (Math.random() - 0.5) * 0.003;
      const jitterLng = (Math.random() - 0.5) * 0.003;
      return { lat: coords.lat + jitterLat, lng: coords.lng + jitterLng };
    }
  }

  const baseLat = branch === 'hope_pizza' ? -26.9240 : -26.9194;
  const baseLng = branch === 'hope_pizza' ? -49.0630 : -49.0661;
  return { lat: baseLat, lng: baseLng };
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

    const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = 'ed3bxFMKCQGtaqbTVJrDy6ZqfM7z2hEFLaRmQBo3tMW4ZkGuxTmBHAweBTrx';
    const CARDAPIO_WEB_HOPE_BURGER_TOKEN = 'ddoFwAw7TbrhTcV1CzeR1bqZAegsjZyzescnjr9QfR2dBEdo6QZNMNkbSeYx';

    const cwOrderId = payload.id || payload.order_id || (payload.data && payload.data.id);
    let branch: 'hope_burger' | 'hope_pizza' = branchParam.includes('burger') ? 'hope_burger' : 'hope_pizza';
    let orderData: any = payload;

    // Se o webhook do Cardápio Web enviou apenas o evento/id, buscar os dados completos da API oficial com fallback inteligente
    if (cwOrderId) {
      const isExplicitBurger = branchParam.includes('burger');
      const firstToken = isExplicitBurger ? CARDAPIO_WEB_HOPE_BURGER_TOKEN : CARDAPIO_WEB_HOPE_PIZZA_TOKEN;
      const secondToken = isExplicitBurger ? CARDAPIO_WEB_HOPE_PIZZA_TOKEN : CARDAPIO_WEB_HOPE_BURGER_TOKEN;

      try {
        let cwRes = await fetch(`https://integracao.cardapioweb.com/api/partner/v1/orders/${cwOrderId}`, {
          headers: { 'X-API-KEY': firstToken },
        });

        if (cwRes.ok) {
          const fetchedJson = await cwRes.json();
          if (fetchedJson && fetchedJson.id) {
            orderData = fetchedJson;
            branch = isExplicitBurger ? 'hope_burger' : 'hope_pizza';
          }
        } else {
          // Tenta a outra loja caso o id pertença à outra
          const altRes = await fetch(`https://integracao.cardapioweb.com/api/partner/v1/orders/${cwOrderId}`, {
            headers: { 'X-API-KEY': secondToken },
          });
          if (altRes.ok) {
            const fetchedJson = await altRes.json();
            if (fetchedJson && fetchedJson.id) {
              orderData = fetchedJson;
              branch = isExplicitBurger ? 'hope_pizza' : 'hope_burger';
            }
          }
        }
      } catch (cwErr) {
        console.error('Falha ao consultar API Cardápio Web:', cwErr);
      }
    }

    // REGRA MÁXIMA: Pedidos de balcão (takeout / indoor) DEVEM SER IGNORADOS!
    const isTakeout = orderData.order_type === 'takeout' ||
                      orderData.order_type === 'indoor' ||
                      orderData.order_type === 'balcao' ||
                      payload.order_type === 'takeout' ||
                      (!orderData.delivery_address && orderData.order_type !== 'delivery');

    if (isTakeout) {
      console.log(`[Cardápio Web Webhook Vercel] Pedido de BALCÃO / RETIRADA ignorado com sucesso (CW ID: ${cwOrderId}, Código: ${orderData.display_id || 'N/A'}).`);
      return res.status(200).json({ status: 'ignored_takeout', message: 'Pedido de balcão ignorado para entrega' });
    }

    const customer = orderData.customer || payload.customer || payload.cliente || {};
    const address = orderData.delivery_address || payload.delivery_address || payload.endereco || payload.address || {};

    const clientName = customer.name || customer.nome || payload.client_name || '';
    const clientPhone = customer.phone ? `${customer.ddi || '55'}${customer.phone}` : (customer.telefone || customer.cellphone || '');

    const deliveryFee = Number(orderData.delivery_fee ?? payload.delivery_fee ?? payload.taxa_entrega ?? 0);
    const total = Number(orderData.total ?? payload.total ?? payload.valor_total ?? 0);
    const subtotal = total > 0 ? (total - deliveryFee) : (Number(payload.subtotal || 0));

    // REGRA DE SEGURANÇA MÁXIMA: Nunca criar registros fantasmas zerados e sem nome!
    if (total <= 0 && (!clientName || clientName.trim() === '')) {
      console.warn(`[Cardápio Web Webhook] Ignorando evento vazio sem dados de cliente e sem valor (ID: ${cwOrderId}).`);
      return res.status(200).json({ status: 'ignored_empty', message: 'Payload sem dados suficientes' });
    }

    const finalClientName = clientName.trim() || 'Cliente Cardápio Web';

    const street = address.street || address.rua || address.logradouro || 'Rua não informada';
    const houseNumber = address.number || address.numero || '';
    const complement = address.complement || address.complemento || '';
    const neighborhood = address.neighborhood || address.bairro || 'Centro';
    const reference = address.reference ? ` (${address.reference.trim()})` : '';
    const fullAddress = `${street}${houseNumber ? `, ${houseNumber}` : ''}${complement ? ` - ${complement}` : ''} - ${neighborhood}${reference}`;

    const { lat, lng } = await resolveCoordinates(address, false, branch);

    const rawItems = orderData.items || payload.items || payload.itens || payload.products || [];
    const items = Array.isArray(rawItems)
      ? rawItems.map((item: any, idx: number) => {
          const optionsText = Array.isArray(item.options) && item.options.length > 0
            ? ` (${item.options.map((o: any) => o.name).filter(Boolean).join(', ')})`
            : '';
          return {
            id: String(item.item_id || item.id || idx + 1),
            name: `${item.name || item.nome || item.title || 'Item'}${optionsText}`,
            quantity: Number(item.quantity || item.qtd || item.quantidade || 1),
            price: Number(item.total_price || item.unit_price || item.price || item.valor || 0),
          };
        })
      : [];

    const itemsSummary = items.length > 0
      ? items.map((i: any) => `${i.quantity}x ${i.name}`).join(' | ')
      : (orderData.observation || payload.notes || payload.observacoes || 'Pedido Cardápio Web');

    const payments = orderData.payments || [];
    const rawPayment = payments[0] || payload.payment || payload.pagamento || {};
    let paymentMethod: 'pix' | 'card_credit' | 'card_debit' | 'cash' = 'pix';
    const paymentStr = JSON.stringify(rawPayment).toLowerCase();
    if (paymentStr.includes('dinheiro') || paymentStr.includes('money') || paymentStr.includes('cash')) {
      paymentMethod = 'cash';
    } else if (paymentStr.includes('debito') || paymentStr.includes('debit')) {
      paymentMethod = 'card_debit';
    } else if (paymentStr.includes('credito') || paymentStr.includes('credit')) {
      paymentMethod = 'card_credit';
    }

    // Mapeamento inteligente de status sincronizado com Cardápio Web
    const cwStatus = String(orderData.status || payload.status || '').toLowerCase();
    let mappedStatus: 'pending' | 'dispatched' | 'delivered' | 'failed' = 'pending';
    if (cwStatus === 'closed') {
      mappedStatus = 'delivered';
    } else if (cwStatus === 'released' || cwStatus === 'dispatched') {
      mappedStatus = 'dispatched';
    } else if (cwStatus === 'canceled' || cwStatus === 'cancelled') {
      mappedStatus = 'failed';
    }

    const today = new Date();
    const localDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // PRESERVAÇÃO RIGOROSA DA DOCUMENTAÇÃO REAL:
    // codeNumber é o número real do documento no Cardápio Web (ex: 50)
    // displayCode é o código diferenciado visualmente (ex: HB-50 para Hope Burger, HP-50 para Hope Pizza)
    const displayId = orderData.display_id || payload.code || payload.codigo || payload.id_curto;
    const codeNumber = displayId ? Number(displayId) : (orderData.id ? Number(String(orderData.id).slice(-4)) : Math.floor(100 + Math.random() * 900));
    const branchPrefix = branch === 'hope_burger' ? 'HB' : 'HP';
    const displayCode = `${branchPrefix}-${codeNumber}`;
    const storeName = branch === 'hope_burger' ? 'Hope Burger' : 'Hope Pizza';

    const orderId = `cw_${cwOrderId || Date.now()}`;
    const trackingCode = `CW-${branchPrefix}-${codeNumber}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const completeOrder = {
      id: orderId,
      codeNumber: Number(codeNumber),
      displayCode,
      clientName: finalClientName,
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
      status: mappedStatus,
      createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      createdDate: localDateKey,
      originChannel: 'cardapio_web',
      storeBranch: branch,
      storeName,
      operationalEpoch: STORE_PILOT_RESET_VERSION,
      trackingCode,
    };

    await setDoc(doc(db, 'orders', orderId), completeOrder, { merge: true });

    return res.status(200).json({ status: 'received', success: true, orderId, codeNumber, displayCode });
  } catch (err: any) {
    console.error('Erro no webhook Vercel:', err);
    return res.status(500).json({ error: 'Erro ao processar pedido', details: err?.message });
  }
}
