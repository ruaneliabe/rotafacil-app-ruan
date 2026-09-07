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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
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

      // Extração resiliente de dados do pedido do Cardápio Web
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

      // Geocodificação aproximada ou coordenadas diretas se fornecidas pelo Cardápio Web
      const lat = Number(address.latitude || address.lat || (branch === 'hope_pizza' ? -26.9240 : -26.9194));
      const lng = Number(address.longitude || address.lng || (branch === 'hope_pizza' ? -49.0630 : -49.0661));

      // Mapeamento de itens
      const items = Array.isArray(rawItems)
        ? rawItems.map((item: any, idx: number) => ({
            id: String(item.id || idx + 1),
            name: item.name || item.nome || item.title || 'Item',
            quantity: Number(item.quantity || item.qtd || item.quantidade || 1),
            price: Number(item.price || item.valor || item.preco || 0),
          }))
        : [];

      const itemsSummary = items.length > 0
        ? items.map((i) => `${i.quantity}x ${i.name}`).join(', ')
        : (payload.notes || payload.observacoes || 'Pedido Cardápio Web');

      const subtotal = Number(payload.subtotal || payload.order_amount || payload.valor_produtos || 0);
      const deliveryFee = Number(payload.delivery_fee || payload.taxa_entrega || payload.shipping_fee || 0);
      const total = Number(payload.total || payload.valor_total || (subtotal + deliveryFee) || 0);

      // Pagamento
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
      console.log(`[Cardápio Web Webhook] Pedido #${codeNumber} salvo com sucesso para ${branch}!`);
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
