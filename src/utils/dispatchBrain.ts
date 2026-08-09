import { Order, Motoboy, StoreShift } from '../types';
import { calculateRoadDistanceKm } from './geoUtils';

export interface DispatchRecommendation {
  id: string;
  motoboyId: string;
  motoboyName: string;
  motoboyStatus: 'available' | 'returning_to_store';
  motoboyEtaMin: number; // 0 if available, >0 if returning
  orderIds: string[];
  orders: Order[];
  totalStops: number;
  totalDistanceKm: number;
  interOrderDistanceKm?: number;
  estimatedTripMin: number;
  neighborhoodSummary: string;
  rationale: string;
  waitSuggestion?: {
    suggestWait: boolean;
    waitMinutes: number;
    reason: string;
    subReason?: string;
    readyOrderCode?: number;
    readyOrderId?: string;
    prepOrderCode?: number;
    prepOrderId?: string;
  };
}

export interface OperationalAlert {
  id: string;
  type: 'delay_risk' | 'motoboy_idle' | 'fleet_bottleneck' | 'kitchen_sync' | 'savings';
  severity: 'high' | 'medium' | 'info';
  title: string;
  description: string;
  actionText?: string;
  orderId?: string;
  motoboyId?: string;
  timestamp: string;
}

/**
  Smart Dispatch Brain (Cérebro de Despacho)
 * Analyzes orders and motoboys to generate optimal dispatch recommendations and operational alerts.
 */
export function analyzeOperationalBrain(
  orders: Order[],
  motoboys: Motoboy[],
  shift: StoreShift
) {
  const storeLat = shift.storeLat || -26.9228;
  const storeLng = shift.storeLng || -49.1014;

  // Active pending/ready orders needing dispatch (unassigned only)
  const pendingOrders = orders.filter(
    (o) => !o.assignedMotoboyId && (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready_at_counter')
  );

  // Active motoboys (available or returning) - sorted by queue time (FIFO)
  const availableMotoboys = [...motoboys]
    .filter((m) => m.status === 'available')
    .sort((a, b) => (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0));
  const returningMotoboys = motoboys.filter((m) => m.status === 'returning_to_store');

  const recommendations: DispatchRecommendation[] = [];
  const alerts: OperationalAlert[] = [];

  // --- 1. GENERATE SMART DISPATCH RECOMMENDATIONS ---
  if (pendingOrders.length > 0) {
    // Group orders by neighborhood or close proximity (<2.5km)
    const unassignedOrders = [...pendingOrders];
    let recId = 1;

    while (unassignedOrders.length > 0 && (availableMotoboys.length > 0 || returningMotoboys.length > 0)) {
      const seedOrder = unassignedOrders.shift()!;
      const cluster: Order[] = [seedOrder];

      // Find up to 2 other nearby orders (< 2.5 km away from seed or existing cluster)
      for (let i = unassignedOrders.length - 1; i >= 0; i--) {
        if (cluster.length >= 3) break;
        const candidate = unassignedOrders[i];
        const distFromSeed = calculateRoadDistanceKm(
          seedOrder.lat,
          seedOrder.lng,
          candidate.lat,
          candidate.lng
        );

        if (distFromSeed <= 2.5 || seedOrder.neighborhood === candidate.neighborhood) {
          cluster.push(candidate);
          unassignedOrders.splice(i, 1);
        }
      }

      // Pick best motoboy: Available first, then returning with lowest ETA
      let chosenMotoboy: { id: string; name: string; status: 'available' | 'returning_to_store'; eta: number } | null = null;

      if (availableMotoboys.length > 0) {
        const mb = availableMotoboys.shift()!;
        chosenMotoboy = { id: mb.id, name: mb.name, status: 'available', eta: 0 };
      } else if (returningMotoboys.length > 0) {
        const mb = returningMotoboys.shift()!;
        const distToStore = calculateRoadDistanceKm(
          mb.currentLat || storeLat,
          mb.currentLng || storeLng,
          storeLat,
          storeLng
        );
        const eta = Math.max(1, Math.round((distToStore / 25) * 60)); // ~25km/h speed
        chosenMotoboy = { id: mb.id, name: mb.name, status: 'returning_to_store', eta };
      }

      if (chosenMotoboy) {
        // Calculate total trip distance (Store -> Order 1 -> Order 2 ... -> Store)
        let totalDist = 0;
        let lastLat = storeLat;
        let lastLng = storeLng;

        cluster.forEach((ord) => {
          totalDist += calculateRoadDistanceKm(lastLat, lastLng, ord.lat, ord.lng);
          lastLat = ord.lat;
          lastLng = ord.lng;
        });

        totalDist += calculateRoadDistanceKm(lastLat, lastLng, storeLat, storeLng); // return leg
        const estimatedTripMin = Math.round(totalDist * 2.8 + cluster.length * 4); // ~2.8 min/km + 4 min per stop

        const neighborhoods = Array.from(new Set(cluster.map((c) => c.neighborhood))).join(' + ');

        // Calculate inter-order distance if cluster has multiple stops
        let interOrderDist = 0;
        if (cluster.length >= 2) {
          interOrderDist = calculateRoadDistanceKm(
            cluster[0].lat,
            cluster[0].lng,
            cluster[1].lat,
            cluster[1].lng
          );
        }

        // Check if cluster has a ready order and an order preparing in kitchen
        const readyOrder = cluster.find((c) => c.status === 'ready_at_counter' || (c.kitchenReadyInMin || 0) === 0);
        const kitchenWaitOrder = cluster.find((c) => (c.kitchenReadyInMin || 0) > 0);
        let waitSuggestion;

        if (readyOrder && kitchenWaitOrder) {
          const waitMins = kitchenWaitOrder.kitchenReadyInMin || 3;
          const distLabel = interOrderDist > 0 ? `${interOrderDist} km` : 'mesmo bairro';
          waitSuggestion = {
            suggestWait: true,
            waitMinutes: waitMins,
            readyOrderCode: readyOrder.codeNumber,
            readyOrderId: readyOrder.id,
            prepOrderCode: kitchenWaitOrder.codeNumber,
            prepOrderId: kitchenWaitOrder.id,
            reason: `#${readyOrder.codeNumber} está pronto e #${kitchenWaitOrder.codeNumber} ficará pronto em aproximadamente ${waitMins} min.`,
            subReason: `Os destinos são próximos (${distLabel}) e ambos permanecem dentro do prazo.`,
          };
        } else if (kitchenWaitOrder) {
          const waitMins = kitchenWaitOrder.kitchenReadyInMin || 3;
          waitSuggestion = {
            suggestWait: true,
            waitMinutes: waitMins,
            prepOrderCode: kitchenWaitOrder.codeNumber,
            prepOrderId: kitchenWaitOrder.id,
            reason: `Pedido #${kitchenWaitOrder.codeNumber} ficará pronto em ~${waitMins} min na cozinha.`,
            subReason: `Aguardar evita uma segunda saída e otimiza a rota do entregador.`,
          };
        } else if (chosenMotoboy.status === 'returning_to_store' && chosenMotoboy.eta > 0) {
          waitSuggestion = {
            suggestWait: true,
            waitMinutes: chosenMotoboy.eta,
            reason: `${chosenMotoboy.name} chega à loja em ~${chosenMotoboy.eta} min para assumir a rota.`,
            subReason: `Os pedidos já estão prontos aguardando o retorno do motoboy à loja.`,
          };
        }

        let rationale = '';
        if (cluster.length === 1) {
          if (chosenMotoboy.status === 'returning_to_store') {
            rationale = `${chosenMotoboy.name} é a melhor opção. Chega à loja em ~${chosenMotoboy.eta} min e assume a entrega para ${cluster[0].clientName} (${neighborhoods}).`;
          } else {
            rationale = `${chosenMotoboy.name} é a melhor opção para este pedido. Está na loja e a entrega leva aproximadamente ${estimatedTripMin} min.`;
          }
        } else {
          if (chosenMotoboy.status === 'returning_to_store') {
            rationale = `Vale agrupar estes ${cluster.length} pedidos. Os destinos ficam na região do ${neighborhoods} e podem sair juntos com ${chosenMotoboy.name} assim que ele chegar à loja (~${chosenMotoboy.eta} min).`;
          } else {
            rationale = `Vale agrupar estes ${cluster.length} pedidos. Os destinos estão próximos (${neighborhoods}) e seguem na mesma direção com ${chosenMotoboy.name}.`;
          }
        }

        recommendations.push({
          id: `rec-${recId++}`,
          motoboyId: chosenMotoboy.id,
          motoboyName: chosenMotoboy.name,
          motoboyStatus: chosenMotoboy.status,
          motoboyEtaMin: chosenMotoboy.eta,
          orderIds: cluster.map((c) => c.id),
          orders: cluster,
          totalStops: cluster.length,
          totalDistanceKm: Number(totalDist.toFixed(1)),
          estimatedTripMin,
          neighborhoodSummary: neighborhoods,
          rationale,
          waitSuggestion,
        });
      }
    }
  }

  // --- 2. GENERATE OPERATIONAL EXCEPTION ALERTS ---
  const now = new Date();

  // Alert A: Delayed Orders or High Wait Time
  orders.forEach((ord) => {
    if (ord.status === 'pending' || ord.status === 'preparing' || ord.status === 'ready_at_counter') {
      const createdTime = new Date(ord.createdAt).getTime();
      const elapsedMin = Math.round((now.getTime() - createdTime) / 60000);

      if (elapsedMin > 25) {
        alerts.push({
          id: `alert-delay-${ord.id}`,
          type: 'delay_risk',
          severity: 'high',
          title: `🔴 Risco de Atraso: Pedido #${ord.codeNumber}`,
          description: `Aguardando despacho há ${elapsedMin} min (${ord.clientName} - ${ord.neighborhood}). Priorize a saída!`,
          actionText: 'Despachar Agora',
          orderId: ord.id,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    }
  });

  // Alert B: Fleet Bottleneck (Ready orders but no available motoboys)
  const readyOrders = orders.filter((o) => o.status === 'ready_at_counter' || o.status === 'pending');
  if (readyOrders.length >= 2 && availableMotoboys.length === 0) {
    const nextReturning = returningMotoboys[0];
    const nextEtaText = nextReturning ? `Próximo retorno: ${nextReturning.name}` : 'Nenhum motoboy retornando no momento';

    alerts.push({
      id: 'alert-fleet-bottleneck',
      type: 'fleet_bottleneck',
      severity: 'medium',
      title: `🟠 Gargalo na Entrega: ${readyOrders.length} Pedidos Prontos`,
      description: `Todos os entregadores estão em rota. ${nextEtaText}.`,
      actionText: 'Ver Fila de Entregas',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    });
  }

  // Alert C: Kitchen-Return Sync Opportunity
  returningMotoboys.forEach((mb) => {
    const distToStore = calculateRoadDistanceKm(
      mb.currentLat || storeLat,
      mb.currentLng || storeLng,
      storeLat,
      storeLng
    );
    const returnEtaMin = Math.max(1, Math.round((distToStore / 25) * 60));

    // Check if there are orders getting ready right around the return time
    const syncingOrders = orders.filter(
      (o) => (o.status === 'preparing' || o.status === 'pending') && (o.kitchenReadyInMin || 5) <= returnEtaMin + 3
    );

    if (syncingOrders.length > 0) {
      alerts.push({
        id: `alert-sync-${mb.id}`,
        type: 'kitchen_sync',
        severity: 'info',
        title: `🔵 Sincronia Perfeita: ${mb.name} x Cozinha`,
        description: `${mb.name} chega em ~${returnEtaMin} min. ${syncingOrders.length} ${syncingOrders.length === 1 ? 'pedido estará pronto' : 'pedidos estarão prontos'} para a próxima saída!`,
        actionText: 'Agrupar Pedidos',
        motoboyId: mb.id,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      });
    }
  });

  // Alert D: Daily Savings
  const deliveredToday = orders.filter((o) => o.status === 'delivered');
  if (deliveredToday.length >= 3) {
    const estimatedKmSaved = (deliveredToday.length * 1.8).toFixed(1);
    alerts.push({
      id: 'alert-savings-info',
      type: 'savings',
      severity: 'info',
      title: `🟢 Eficiência da Frota Hoje`,
      description: `Com o agrupamento inteligente por bairro, sua loja economizou ~${estimatedKmSaved} km em trajetos de entrega hoje.`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    });
  }

  return {
    recommendations,
    alerts,
  };
}
