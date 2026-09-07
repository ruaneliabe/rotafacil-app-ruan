import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, getDocs } from 'firebase/firestore';

const STORE_PILOT_RESET_VERSION = 'zeroed_store_pilot_2026_08_17_v10';

// Read Firebase config safely
let firebaseConfig: any = {};
try {
  const raw = fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
  firebaseConfig = JSON.parse(raw);
} catch (e) {
  console.warn('Could not read firebase-applet-config.json in server.ts:', e);
}

const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(fbApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(fbApp);

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Rota administrativa para regeocodificar pedidos antigos com coordenadas reais
  app.get('/api/admin/regeocode-orders', async (_req, res) => {
    try {
      const snap = await getDocs(collection(db, 'orders'));
      const results: any[] = [];
      for (const d of snap.docs) {
        const ord = d.data() as any;
        const isDefaultHopePizza = Math.abs((ord.lat || 0) - (-26.9240)) < 0.0001 && Math.abs((ord.lng || 0) - (-49.0630)) < 0.0001;
        const isDefaultHopeBurger = Math.abs((ord.lat || 0) - (-26.9194)) < 0.0001 && Math.abs((ord.lng || 0) - (-49.0661)) < 0.0001;
        const isMissing = !ord.lat || !ord.lng || ord.lat === 0;

        if ((isDefaultHopePizza || isDefaultHopeBurger || isMissing) && ord.address && !ord.address.toLowerCase().includes('retirada')) {
          const fakeAddressObj = {
            street: ord.street || ord.address.split(',')[0],
            number: ord.houseNumber || '',
            neighborhood: ord.neighborhood || '',
            city: 'Blumenau',
          };
          const branch = ord.storeBranch === 'hope_pizza' ? 'hope_pizza' : 'hope_burger';
          const resolved = await resolveCoordinates(fakeAddressObj, false, branch);
          if (resolved) {
            await setDoc(doc(db, 'orders', d.id), { lat: resolved.lat, lng: resolved.lng }, { merge: true });
            results.push({ id: d.id, code: ord.codeNumber, address: ord.address, newLat: resolved.lat, newLng: resolved.lng });
          }
        }
      }
      res.json({ success: true, updatedCount: results.length, updated: results });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || String(err) });
    }
  });

  // Webhook Cardápio Web (suporta tanto /api/webhook/cardapio-web/:branchId quanto /api/webhook/cardapio-web)
  app.post(['/api/webhook/cardapio-web', '/api/webhook/cardapio-web/:branchId'], async (req, res) => {
    // Responder HTTP 200 imediato para o Cardápio Web
    res.status(200).json({ status: 'received', success: true });

    try {
      const payload = req.body || {};
      const branchParam = (req.params.branchId || req.query.branch || '').toString().toLowerCase();

      // Identificar se o pedido pertence à Hope Burger ou Hope Pizza
      let branch: 'hope_burger' | 'hope_pizza' = 'hope_burger';
      if (branchParam.includes('pizza') || JSON.stringify(payload).toLowerCase().includes('pizza')) {
        branch = 'hope_pizza';
      }

      const cwOrderId = payload.id || payload.order_id || (payload.data && payload.data.id);
      const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = 'ed3bxFMKCQGtaqbTVJrDy6ZqfM7z2hEFLaRmQBo3tMW4ZkGuxTmBHAweBTrx';
      const apiKey = branch === 'hope_pizza' ? CARDAPIO_WEB_HOPE_PIZZA_TOKEN : '';

      let orderData: any = payload;

      // Se o webhook enviou apenas id/evento, buscar os dados completos da API oficial
      if (cwOrderId && apiKey) {
        try {
          const cwRes = await fetch(`https://integracao.cardapioweb.com/api/partner/v1/orders/${cwOrderId}`, {
            headers: { 'X-API-KEY': apiKey },
          });
          if (cwRes.ok) {
            const fetchedJson = await cwRes.json();
            if (fetchedJson && fetchedJson.id) {
              orderData = fetchedJson;
            }
          }
        } catch (cwErr) {
          console.error('[Cardápio Web] Falha ao consultar API:', cwErr);
        }
      }

      const customer = orderData.customer || payload.customer || payload.cliente || {};
      const address = orderData.delivery_address || payload.delivery_address || payload.endereco || payload.address || {};
      const isTakeout = orderData.order_type === 'takeout' || (!orderData.delivery_address && orderData.order_type);

      const clientName = customer.name || customer.nome || payload.client_name || 'Cliente Cardápio Web';
      const clientPhone = customer.phone ? `${customer.ddi || '55'}${customer.phone}` : (customer.telefone || customer.cellphone || '');

      const street = address.street || address.rua || address.logradouro || (isTakeout ? 'Retirada no Balcão' : 'Rua não informada');
      const houseNumber = address.number || address.numero || '';
      const complement = address.complement || address.complemento || '';
      const neighborhood = address.neighborhood || address.bairro || (isTakeout ? 'Balcão' : 'Centro');
      const reference = address.reference ? ` (${address.reference.trim()})` : '';
      const fullAddress = isTakeout
        ? 'Retirada no Balcão (Takeout)'
        : `${street}${houseNumber ? `, ${houseNumber}` : ''}${complement ? ` - ${complement}` : ''} - ${neighborhood}${reference}`;

      // Geocodificação inteligente com endereços de Blumenau e Nominatim
      const { lat, lng } = await resolveCoordinates(address, Boolean(isTakeout), branch);

      // Mapeamento de itens com opções/sabores/bordas
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

      const deliveryFee = Number(orderData.delivery_fee ?? payload.delivery_fee ?? payload.taxa_entrega ?? 0);
      const total = Number(orderData.total ?? payload.total ?? payload.valor_total ?? 0);
      const subtotal = total > 0 ? (total - deliveryFee) : (Number(payload.subtotal || 0));

      // Pagamento
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

      const today = new Date();
      const localDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const codeNumber = orderData.display_id || payload.code || payload.codigo || payload.id_curto || Math.floor(100 + Math.random() * 900);
      const orderId = `cw_${cwOrderId || Date.now()}`;
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
        changeFor: rawPayment.change_for || rawPayment.troco_para || undefined,
        status: 'pending',
        createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        createdDate: localDateKey,
        originChannel: 'cardapio_web',
        storeBranch: branch,
        operationalEpoch: STORE_PILOT_RESET_VERSION,
        trackingCode,
      };

      await setDoc(doc(db, 'orders', orderId), completeOrder, { merge: true });
      console.log(`[Cardápio Web Webhook] Pedido #${codeNumber} (${clientName}) salvo com sucesso para ${branch}!`);
    } catch (err) {
      console.error('[Cardápio Web Webhook] Erro ao processar webhook:', err);
    }
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
