import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';

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

  // Helper para calcular se o estabelecimento está aberto no Cardápio Web
  function isMerchantOpen(merchant: any): { isOpen: boolean; reason: string; weekday?: string; time?: string; hours?: string[] } {
    if (!merchant || merchant.status !== 'ACTIVE') {
      return { isOpen: false, reason: `Status não é ACTIVE (${merchant?.status || 'nulo'})` };
    }

    const tz = merchant.opening_hours?.timezone || 'America/Sao_Paulo';
    const now = new Date();

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);

    let weekday = '';
    let hour = 0;
    let minute = 0;
    parts.forEach((p) => {
      if (p.type === 'weekday') weekday = p.value.toLowerCase();
      if (p.type === 'hour') hour = parseInt(p.value, 10);
      if (p.type === 'minute') minute = parseInt(p.value, 10);
    });

    const currentMinutes = hour * 60 + minute;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    // Verificação de fechamento temporário manual no Cardápio Web
    const tempState = merchant.opening_hours?.temporary_state;
    const tempEndAt = merchant.opening_hours?.temporary_state_end_at;
    if (tempState === 'closed') {
      if (tempEndAt) {
        const endEpoch = new Date(tempEndAt).getTime();
        if (now.getTime() < endEpoch) {
          return { isOpen: false, reason: `Fechado temporariamente no Cardápio Web até ${new Date(tempEndAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, time: timeStr, weekday };
        }
      } else {
        return { isOpen: false, reason: 'Fechado temporariamente no Cardápio Web', time: timeStr, weekday };
      }
    }

    // Horários regulares cadastrados na plataforma
    const dayRanges = merchant.opening_hours?.[weekday] || [];
    if (!Array.isArray(dayRanges) || dayRanges.length === 0) {
      return { isOpen: false, reason: `Sem horário de entrega hoje (${weekday})`, time: timeStr, weekday };
    }

    let inRange = false;
    for (const range of dayRanges) {
      if (!Array.isArray(range) || range.length < 2) continue;
      const [startH, startM] = range[0].split(':').map(Number);
      const [endH, endM] = range[1].split(':').map(Number);
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;
      if (endMin < startMin) {
        // Horário que vira a noite (ex: 18:00 às 01:00)
        if (currentMinutes >= startMin || currentMinutes < endMin) {
          inRange = true;
          break;
        }
      } else {
        if (currentMinutes >= startMin && currentMinutes < endMin) {
          inRange = true;
          break;
        }
      }
    }

    const formattedHours: string[] = dayRanges.map((r: any) => Array.isArray(r) ? r.join(' - ') : String(r));

    if (inRange) {
      return { isOpen: true, reason: `Aberto no Cardápio Web (${timeStr})`, time: timeStr, weekday, hours: formattedHours };
    } else {
      const nextOpenTime = dayRanges[0]?.[0] || '18:00';
      return { isOpen: false, reason: `Fora do horário de funcionamento (${timeStr} - abre às ${nextOpenTime})`, time: timeStr, weekday, hours: formattedHours };
    }
  }

  // Sincronização de Status da Loja (Aberto / Fechado) com o Cardápio Web
  async function syncCardapioWebStoreStatus() {
    try {
      const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = 'ed3bxFMKCQGtaqbTVJrDy6ZqfM7z2hEFLaRmQBo3tMW4ZkGuxTmBHAweBTrx';
      const CARDAPIO_WEB_HOPE_BURGER_TOKEN = 'ddoFwAw7TbrhTcV1CzeR1bqZAegsjZyzescnjr9QfR2dBEdo6QZNMNkbSeYx';

      const [pRes, bRes] = await Promise.all([
        fetch('https://integracao.cardapioweb.com/api/partner/v1/merchant', {
          headers: { 'X-API-KEY': CARDAPIO_WEB_HOPE_PIZZA_TOKEN },
        }),
        fetch('https://integracao.cardapioweb.com/api/partner/v1/merchant', {
          headers: { 'X-API-KEY': CARDAPIO_WEB_HOPE_BURGER_TOKEN },
        }),
      ]);

      const pData = pRes.ok ? await pRes.json() : null;
      const bData = bRes.ok ? await bRes.json() : null;

      const pStatus = isMerchantOpen(pData);
      const bStatus = isMerchantOpen(bData);

      // A loja principal está aberta se pelo menos uma das marcas (Hope Burger ou Hope Pizza) estiver aberta
      const shouldBeOpen = pStatus.isOpen || bStatus.isOpen;

      const shiftRef = doc(db, 'shifts', 'current_shift');
      const shiftSnap = await getDoc(shiftRef);
      const currentShiftData = shiftSnap.exists() ? shiftSnap.data() : {};

      const previousIsOpen = currentShiftData.isOpen;
      const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const cardapioWebStatus = {
        isOpen: shouldBeOpen,
        lastCheckedAt: new Date().toISOString(),
        pizza: {
          isOpen: pStatus.isOpen,
          status: pData?.status || 'UNKNOWN',
          reason: pStatus.reason,
          hours: pStatus.hours || [],
        },
        burger: {
          isOpen: bStatus.isOpen,
          status: bData?.status || 'UNKNOWN',
          reason: bStatus.reason,
          hours: bStatus.hours || [],
        },
      };

      const updatePayload: any = {
        cardapioWebStatus,
      };

      // Se o status mudou no Cardápio Web, sincroniza automaticamente no Rota Fácil
      if (previousIsOpen !== shouldBeOpen) {
        updatePayload.isOpen = shouldBeOpen;
        const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        const nowTs = Date.now();
        if (shouldBeOpen) {
          updatePayload.openedAt = nowStr;
          updatePayload.openedTimestamp = nowTs;
          updatePayload.shiftId = `shift_${todayKey}_${nowTs}`;
          updatePayload.shiftDate = todayKey;
          updatePayload.closedAt = null;
          updatePayload.closedTimestamp = null;
          updatePayload.totalOrdersCount = 0;
          updatePayload.totalDeliveriesValue = 0;
          updatePayload.currentCash = currentShiftData.initialCash || 0;
          console.log(`[Cardápio Web Sync] Loja ABRIU no Cardápio Web! Sincronizando Rota Fácil como ABERTO (Turno ${updatePayload.shiftId} iniciado com faturamento zerado).`);

          // Reseta contadores diários dos motoboys no novo turno
          try {
            const mbSnap = await getDocs(collection(db, 'motoboys'));
            for (const mbDoc of mbSnap.docs) {
              await setDoc(doc(db, 'motoboys', mbDoc.id), {
                deliveriesCountToday: 0,
                totalEarnedToday: 0,
                statsDate: todayKey,
              }, { merge: true });
            }
          } catch (e) {
            console.warn('[Cardápio Web Sync] Erro ao resetar motoboys na abertura:', e);
          }
        } else {
          updatePayload.closedAt = nowStr;
          updatePayload.closedTimestamp = nowTs;
          console.log(`[Cardápio Web Sync] Loja FECHOU no Cardápio Web! Sincronizando Rota Fácil como FECHADO.`);
        }
      }

      await setDoc(shiftRef, updatePayload, { merge: true });

      return {
        success: true,
        isOpen: shouldBeOpen,
        previousIsOpen,
        changed: previousIsOpen !== shouldBeOpen,
        cardapioWebStatus,
      };
    } catch (err: any) {
      console.error('[Cardápio Web Store Sync] Erro ao sincronizar status da loja:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  // Rota de Sincronização Bidirecional com Cardápio Web (Hope Pizza & Hope Burger)
  // Função central de sincronização com o Cardápio Web:
  // 1. Sincroniza abertura/fechamento das lojas
  // 2. Detecta pedidos que já foram despachados/entregues/cancelados
  // 3. Limpa/arquiva pedidos pendentes de ontem para não poluir o painel com loja fechada
  async function syncCardapioWebOrders() {
    try {
      // 1. Sincroniza status da loja primeiro
      const storeStatus = await syncCardapioWebStoreStatus();

      const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = 'ed3bxFMKCQGtaqbTVJrDy6ZqfM7z2hEFLaRmQBo3tMW4ZkGuxTmBHAweBTrx';
      const CARDAPIO_WEB_HOPE_BURGER_TOKEN = 'ddoFwAw7TbrhTcV1CzeR1bqZAegsjZyzescnjr9QfR2dBEdo6QZNMNkbSeYx';

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

      const cwMap = new Map<string, { status: string; order_type?: string }>();
      cwList.forEach((o: any) => {
        const info = { status: String(o.status || '').trim().toLowerCase(), order_type: o.order_type };
        cwMap.set(String(o.id), info);
        cwMap.set(`cw_${o.id}`, info);
        if (o.display_id) {
          cwMap.set(`${o._branch}_display_${o.display_id}`, info);
          cwMap.set(`display_${o.display_id}`, info);
        }
      });

      const today = new Date();
      const todayDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const snap = await getDocs(collection(db, 'orders'));
      let dispatchedCount = 0;
      let deliveredCount = 0;
      let cancelledCount = 0;
      let purgedEmptyCount = 0;
      let purgedTakeoutCount = 0;
      let archivedYesterdayCount = 0;

      for (const d of snap.docs) {
        const data = d.data() as any;

        // Limpeza preventiva: pedidos de balcão/retirada devem ser ignorados do balcão de entregas
        const isTakeoutOrder = (data.address && data.address.toLowerCase().includes('retirada')) ||
                               (data.neighborhood && data.neighborhood.toLowerCase() === 'balcão') ||
                               data.order_type === 'takeout';
        if (isTakeoutOrder) {
          if (data.status !== 'cancelled') {
            await setDoc(doc(db, 'orders', d.id), { status: 'cancelled' }, { merge: true });
            purgedTakeoutCount++;
          }
          continue;
        }

        // Limpeza preventiva: pedidos vazios/fantasmas com total 0 e sem cliente
        const isGhost = (!data.clientName || data.clientName === 'Cliente Cardápio Web' || data.clientName === 'Cliente não informado') && (!data.total || Number(data.total) <= 0);
        if (isGhost) {
          if (data.status !== 'cancelled') {
            await setDoc(doc(db, 'orders', d.id), { status: 'cancelled' }, { merge: true });
            purgedEmptyCount++;
          }
          continue;
        }

        // Limpeza preventiva: pedidos com status 'failed' devem ser normalizados como 'cancelled'
        if (data.status === 'failed') {
          await setDoc(doc(db, 'orders', d.id), { status: 'cancelled' }, { merge: true });
          cancelledCount++;
          continue;
        }

        // REGRA CRÍTICA DE FECHAMENTO / PEDIDOS DE ONTEM:
        // Se o pedido foi criado numa data anterior a hoje (ontem ou mais antigo) e continua com status
        // pending / preparing / ready_at_counter, ele foi abandonado ou o turno encerrou sem despacho.
        // Deve ser finalizado para não ficar poluindo o painel ou o Kanban quando a loja abre/fecha!
        const isFromPreviousDate = data.createdDate && data.createdDate < todayDateKey;
        const isStillUnfinished = data.status === 'pending' || data.status === 'preparing' || data.status === 'ready_at_counter';
        if (isFromPreviousDate && isStillUnfinished) {
          console.log(`[Sync CW] Arquivando pedido antigo de ontem #${data.codeNumber} (${data.createdDate}) que ficou pendente após fechamento da loja.`);
          await setDoc(doc(db, 'orders', d.id), {
            status: 'delivered',
            deliveredDate: data.createdDate,
            closedAt: new Date().toISOString(),
            closedInCardapioWeb: true,
            archiveReason: 'shift_closed_yesterday',
          }, { merge: true });
          archivedYesterdayCount++;
          continue;
        }

        const cleanDocId = d.id.replace(/^cw_/, '');
        const branchKey = data.storeBranch || (data.storeName?.toLowerCase().includes('burger') ? 'hope_burger' : 'hope_pizza');
        const cwInfo = cwMap.get(d.id) ||
                       cwMap.get(cleanDocId) ||
                       (data.codeNumber ? cwMap.get(`${branchKey}_display_${data.codeNumber}`) : null) ||
                       (data.codeNumber ? cwMap.get(`display_${data.codeNumber}`) : null);

        if (!cwInfo) continue;

        const cwStatus = cwInfo.status;
        let targetStatus: string | null = null;

        // No Cardápio Web:
        // 'released' significa Despachado / Saiu para entrega.
        // 'closed' significa Fechado / Entregue.
        // 'delivered' / 'dispatched' / 'concluded' / 'finalized'
        // Todos esses indicam que o pedido não está mais aguardando na loja e não deve ficar no mapa!
        if (['closed', 'released', 'delivered', 'dispatched', 'saiu_para_entrega', 'finalized', 'concluded'].includes(cwStatus)) {
          targetStatus = 'delivered';
        } else if (['canceled', 'cancelled', 'rejected'].includes(cwStatus)) {
          targetStatus = 'cancelled';
        }

        if (targetStatus && targetStatus !== data.status) {
          console.log(`[Sync CW] Atualizando pedido #${data.codeNumber} [${data.displayCode || branchKey}] (${data.clientName}): ${data.status} -> ${targetStatus} (CW: ${cwStatus})`);
          await setDoc(doc(db, 'orders', d.id), {
            status: targetStatus,
            closedAt: new Date().toISOString(),
            closedInCardapioWeb: true,
          }, { merge: true });
          if (targetStatus === 'delivered') deliveredCount++;
          if (targetStatus === 'cancelled') cancelledCount++;
        }
      }

      return {
        success: true,
        storeStatus,
        totalCwOrders: cwList.length,
        dispatchedCount,
        deliveredCount,
        cancelledCount,
        purgedEmptyCount,
        purgedTakeoutCount,
        archivedYesterdayCount,
        totalUpdated: dispatchedCount + deliveredCount + cancelledCount + archivedYesterdayCount,
      };
    } catch (err: any) {
      console.error('[Cardápio Web Sync] Erro interno:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  // Rota para consultar e forçar checagem do status da loja no Cardápio Web
  app.get('/api/cardapio-web/store-status', async (_req, res) => {
    const result = await syncCardapioWebStoreStatus();
    res.json(result);
  });

  // Atualiza automaticamente pedidos que já foram despachados ou entregues no Cardápio Web
  app.get(['/api/cardapio-web/sync', '/api/sync-cardapio-web'], async (_req, res) => {
    const result = await syncCardapioWebOrders();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  });

  app.post(['/api/cardapio-web/sync', '/api/sync-cardapio-web'], async (_req, res) => {
    const result = await syncCardapioWebOrders();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  });

  // Loop contínuo de background no servidor para garantir sincronização mesmo sem abas abertas
  setInterval(async () => {
    await syncCardapioWebOrders();
  }, 20000);
  setTimeout(async () => {
    await syncCardapioWebOrders();
  }, 3000);

  // Webhook Cardápio Web (suporta tanto /api/webhook/cardapio-web/:branchId quanto /api/webhook/cardapio-web)
  app.post(['/api/webhook/cardapio-web', '/api/webhook/cardapio-web/:branchId'], async (req, res) => {
    // Responder HTTP 200 imediato para o Cardápio Web
    res.status(200).json({ status: 'received', success: true });

    try {
      const payload = req.body || {};
      const branchParam = (req.params.branchId || req.query.branch || '').toString().toLowerCase();

      const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = 'ed3bxFMKCQGtaqbTVJrDy6ZqfM7z2hEFLaRmQBo3tMW4ZkGuxTmBHAweBTrx';
      const CARDAPIO_WEB_HOPE_BURGER_TOKEN = 'ddoFwAw7TbrhTcV1CzeR1bqZAegsjZyzescnjr9QfR2dBEdo6QZNMNkbSeYx';

      const cwOrderId = payload.id || payload.order_id || (payload.data && payload.data.id);
      let branch: 'hope_burger' | 'hope_pizza' = branchParam.includes('burger') ? 'hope_burger' : 'hope_pizza';
      let orderData: any = payload;

      // Se o webhook enviou apenas id/evento, consultar API oficial com fallback inteligente entre Pizza e Burger
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
            // Tenta a outra loja caso o id não pertença à primeira
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
          console.error('[Cardápio Web] Falha ao consultar API:', cwErr);
        }
      }

      // REGRA MÁXIMA: Pedidos de balcão (takeout / indoor) DEVEM SER IGNORADOS!
      const isTakeout = orderData.order_type === 'takeout' ||
                        orderData.order_type === 'indoor' ||
                        orderData.order_type === 'balcao' ||
                        payload.order_type === 'takeout' ||
                        (!orderData.delivery_address && orderData.order_type !== 'delivery');

      if (isTakeout) {
        console.log(`[Cardápio Web Webhook] Pedido de BALCÃO / RETIRADA ignorado com sucesso (CW ID: ${cwOrderId}, Código: ${orderData.display_id || 'N/A'}).`);
        return;
      }

      const customer = orderData.customer || payload.customer || payload.cliente || {};
      const address = orderData.delivery_address || payload.delivery_address || payload.endereco || payload.address || {};

      const clientName = customer.name || customer.nome || payload.client_name || '';
      const clientPhone = customer.phone ? `${customer.ddi || '55'}${customer.phone}` : (customer.telefone || customer.cellphone || '');

      const deliveryFee = Number(orderData.delivery_fee ?? payload.delivery_fee ?? payload.taxa_entrega ?? 0);
      const total = Number(orderData.total ?? payload.total ?? payload.valor_total ?? 0);
      const subtotal = total > 0 ? (total - deliveryFee) : (Number(payload.subtotal || 0));

      // REGRA DE SEGURANÇA: Nunca criar registros fantasmas zerados e sem nome!
      if (total <= 0 && (!clientName || clientName.trim() === '')) {
        console.warn(`[Cardápio Web Webhook] Ignorando evento vazio sem dados de cliente e sem valor (ID: ${cwOrderId}).`);
        return;
      }

      const finalClientName = clientName.trim() || 'Cliente Cardápio Web';

      const street = address.street || address.rua || address.logradouro || 'Rua não informada';
      const houseNumber = address.number || address.numero || '';
      const complement = address.complement || address.complemento || '';
      const neighborhood = address.neighborhood || address.bairro || 'Centro';
      const reference = address.reference ? ` (${address.reference.trim()})` : '';
      const fullAddress = `${street}${houseNumber ? `, ${houseNumber}` : ''}${complement ? ` - ${complement}` : ''} - ${neighborhood}${reference}`;

      // Geocodificação inteligente com endereços de Blumenau e Nominatim
      const { lat, lng } = await resolveCoordinates(address, false, branch);

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

      // Pagamento estruturado
      const payments = orderData.payments || [];
      const rawPayment = payments[0] || payload.payment || payload.pagamento || {};
      let paymentMethod: 'pix' | 'card_credit' | 'card_debit' | 'cash' = 'pix';
      const paymentStr = JSON.stringify(rawPayment).toLowerCase();
      if (paymentStr.includes('dinheiro') || paymentStr.includes('money') || paymentStr.includes('cash') || paymentStr.includes('especie')) {
        paymentMethod = 'cash';
      } else if (paymentStr.includes('card_deb') || paymentStr.includes('debito') || paymentStr.includes('debit') || paymentStr.includes('deb')) {
        paymentMethod = 'card_debit';
      } else if (paymentStr.includes('card_cre') || paymentStr.includes('credito') || paymentStr.includes('credit') || paymentStr.includes('cre')) {
        paymentMethod = 'card_credit';
      } else if (paymentStr.includes('pix')) {
        paymentMethod = 'pix';
      }

      // Mapeamento inteligente de status sincronizado com Cardápio Web
      const cwStatus = String(orderData.status || payload.status || '').toLowerCase();
      let mappedStatus: 'pending' | 'dispatched' | 'delivered' | 'failed' = 'pending';
      if (cwStatus === 'closed' || cwStatus === 'released' || cwStatus === 'dispatched' || cwStatus === 'delivered') {
        // Se já foi despachado no Cardápio Web, não entra na fila ativa de entrega
        mappedStatus = 'delivered';
      } else if (cwStatus === 'canceled' || cwStatus === 'cancelled') {
        mappedStatus = 'failed';
      }

      const today = new Date();
      const localDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // PRESERVAÇÃO RIGOROSA DA DOCUMENTAÇÃO REAL:
      // codeNumber é o número real do documento no Cardápio Web (ex: 50)
      // displayCode é o código diferenciado visualmente (ex: HB-50 para Hope Burger, HP-50 para Hope Pizza)
      const displayId = orderData.display_id || payload.code || payload.codigo || payload.id_curto;
      const codeNumber = displayId ? Number(displayId) : (orderData.id ? Number(String(orderData.id).slice(-4)) : 0);
      const branchPrefix = branch === 'hope_burger' ? 'HB' : 'HP';
      const displayCode = `${branchPrefix}-${codeNumber}`;
      const storeName = branch === 'hope_burger' ? 'Hope Burger' : 'Hope Pizza';

      const orderId = `cw_${cwOrderId || Date.now()}`;
      const trackingCode = `CW-${branchPrefix}-${codeNumber}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Recupera dados do turno atual para vincular o pedido se o turno estiver aberto
      let currentShiftId: string | undefined = undefined;
      let currentShiftDate: string | undefined = localDateKey;
      try {
        const sSnap = await getDoc(doc(db, 'shifts', 'current_shift'));
        if (sSnap.exists()) {
          const sData = sSnap.data();
          if (sData.isOpen) {
            currentShiftId = sData.shiftId || `shift_${localDateKey}`;
            currentShiftDate = sData.shiftDate || localDateKey;
          }
        }
      } catch (err) {
        console.warn('Não foi possível obter dados do turno no webhook:', err);
      }

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
        changeFor: rawPayment.change_for || rawPayment.troco_para || undefined,
        status: mappedStatus,
        createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        createdDate: localDateKey,
        createdTimestamp: Date.now(),
        shiftId: currentShiftId,
        shiftDate: currentShiftDate,
        originChannel: 'cardapio_web',
        storeBranch: branch,
        storeName,
        operationalEpoch: STORE_PILOT_RESET_VERSION,
        trackingCode,
      };

      await setDoc(doc(db, 'orders', orderId), completeOrder, { merge: true });
      console.log(`[Cardápio Web Webhook] Pedido ${displayCode} #${codeNumber} (${finalClientName}) salvo com status ${mappedStatus}!`);
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
