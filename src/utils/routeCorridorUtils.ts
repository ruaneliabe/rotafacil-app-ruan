import { Order } from '../types';
import { calculateRoadDistanceKm, BLUMENAU_NEIGHBORHOOD_COORDS } from './geoUtils';

export const DEFAULT_STORE_COORDS = {
  lat: -26.91530418395996,
  lng: -49.1146354675293, // Rua dos Caçadores, 653 - Velha Central, Blumenau - SC
};

export interface DeliveryCorridor {
  id: string;
  name: string;
  shortName: string;
  neighborhoods: string[];
  mainAvenues: string[];
  approxAngleDeg: number; // Ângulo aproximado a partir da loja em Velha Central
}

/**
 * Mapeamento dos principais eixos e corredores viários de Blumenau a partir da loja
 * (Localizada na Rua dos Caçadores, Velha Central).
 * 
 * Bairros diferentes no mesmo corredor compartilham a mesma rota de saída do motoboy.
 */
export const BLUMENAU_CORRIDORS: DeliveryCorridor[] = [
  {
    id: 'corredor_velha_aguaverde',
    name: 'Eixo Velha & Água Verde (Oeste / Caçadores)',
    shortName: 'Velha ➔ Água Verde',
    neighborhoods: ['velha central', 'velha grande', 'velha', 'água verde', 'agua verde', 'passo manso'],
    mainAvenues: ['Rua dos Caçadores', 'Rua Gov. Jorge Lacerda', 'Rua Frei Estanislau Schaette', 'Rua General Osório'],
    approxAngleDeg: 190,
  },
  {
    id: 'corredor_vilanova_escola',
    name: 'Eixo Vila Nova & Escola Agrícola (Noroeste-Central)',
    shortName: 'Vila Nova ➔ Escola Agrícola',
    neighborhoods: ['vila nova', 'escola agrícola', 'escola agricola', 'victor konder'],
    mainAvenues: ['Rua Theodoro Holtrup', 'Rua Almirante Barroso', 'Rua Benjamin Constant'],
    approxAngleDeg: 45,
  },
  {
    id: 'corredor_centro_leste',
    name: 'Eixo Centro & Leste (Centro / Ponta Aguda / Vorstadt)',
    shortName: 'Centro ➔ Ponta Aguda',
    neighborhoods: ['centro', 'victor konder', 'ponta aguda', 'vorstadt'],
    mainAvenues: ['Rua 7 de Setembro', 'Rua 15 de Novembro', 'Rua São Paulo', 'Av. Brasil'],
    approxAngleDeg: 80,
  },
  {
    id: 'corredor_sul_garcia',
    name: 'Eixo Sul / Grande Garcia (Garcia / Glória / Progresso)',
    shortName: 'Garcia ➔ Progresso',
    neighborhoods: ['garcia', 'valparaíso', 'valparaiso', 'da glória', 'gloria', 'progresso'],
    mainAvenues: ['Rua Amazonas', 'Rua Hermann Huscher', 'Rua Progresso'],
    approxAngleDeg: 130,
  },
  {
    id: 'corredor_norte_itoupavas',
    name: 'Eixo Norte / Itoupavas (Itoupava / Fortaleza / Salto)',
    shortName: 'Norte ➔ Fortaleza / Itoupavas',
    neighborhoods: ['itoupava norte', 'itoupavazinha', 'itoupava central', 'fortaleza', 'tribess', 'salto do norte', 'badenfurt', 'fidélis', 'fidelis'],
    mainAvenues: ['Via Expressa (Rod. Paul Fritz Kuehnrich)', 'Rua 2 de Setembro', 'Rua 1º de Maio', 'Rua Bahia'],
    approxAngleDeg: 15,
  },
];

/**
 * Retorna as coordenadas geográficas efetivas de um pedido.
 * Se lat/lng estiverem vazias ou forem a loja/padrão, consulta o dicionário de bairros de Blumenau.
 */
export function getOrderEffectiveCoords(
  order: Order,
  storeLat: number = DEFAULT_STORE_COORDS.lat,
  storeLng: number = DEFAULT_STORE_COORDS.lng
): { lat: number; lng: number } {
  const isDefaultHopePizza = Math.abs((order.lat || 0) - (-26.9240)) < 0.0001 && Math.abs((order.lng || 0) - (-49.0630)) < 0.0001;
  const isDefaultHopeBurger = Math.abs((order.lat || 0) - (-26.9194)) < 0.0001 && Math.abs((order.lng || 0) - (-49.0661)) < 0.0001;
  const isStoreCoords = Math.abs((order.lat || 0) - storeLat) < 0.0001 && Math.abs((order.lng || 0) - storeLng) < 0.0001;
  const isInvalid = !order.lat || !order.lng || order.lat === 0 || isNaN(order.lat);

  if (!isInvalid && !isDefaultHopePizza && !isDefaultHopeBurger && !isStoreCoords) {
    return { lat: order.lat, lng: order.lng };
  }

  // Fallback por dicionário de bairros de Blumenau
  const normNeigh = (order.neighborhood || '').trim().toLowerCase();
  for (const [neighName, coords] of Object.entries(BLUMENAU_NEIGHBORHOOD_COORDS)) {
    if (normNeigh.includes(neighName) || neighName.includes(normNeigh)) {
      return { lat: coords.lat, lng: coords.lng };
    }
  }

  return { lat: storeLat, lng: storeLng };
}

/**
 * Calcula os minutos totais decorridos desde a criação do pedido (tempo de espera do cliente)
 */
export function getOrderWaitMinutes(order: Order): number {
  if (order.createdTimestamp) {
    return Math.max(0, Math.floor((Date.now() - order.createdTimestamp) / (1000 * 60)));
  }
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [h, m] = (order.createdAt || '00:00').split(':').map(Number);
  let diff = nowMin - ((h || 0) * 60 + (m || 0));
  if (diff < 0) diff += 24 * 60;
  return diff;
}

/**
 * Identifica o corredor logístico de um pedido
 */
export function findOrderCorridor(order: Order): DeliveryCorridor | null {
  const normNeigh = (order.neighborhood || '').trim().toLowerCase();
  for (const corridor of BLUMENAU_CORRIDORS) {
    if (corridor.neighborhoods.some((n) => normNeigh.includes(n) || n.includes(normNeigh))) {
      return corridor;
    }
  }
  return null;
}

export interface TrajectoryAnalysis {
  canShareRoute: boolean;
  interOrderDistanceKm: number;
  corridorName: string;
  sameNeighborhood: boolean;
  detourKm: number;
  timeCompatible: boolean;
  timeDiffMinutes: number;
  waitA: number;
  waitB: number;
  hasUrgentSLA: boolean;
  urgentReason?: string;
  recommendationType:
    | 'optimal_batch'
    | 'acceptable_batch'
    | 'incompatible_route'
    | 'incompatible_time'
    | 'urgent_immediate_dispatch';
  explanation: string;
}

/**
 * Analisador Crítico de Trajetória e Compatibilidade de Tempo:
 *
 * 1. TEMPO E SLA:
 *    - Pedido novo NÃO pode esperar pedido antigo!
 *    - Pedido antigo (>25m total ou >8m pronto no balcão) DEVE SAIR IMEDIATAMENTE.
 *    - Diferença de tempo aceitável entre pedidos agrupados: máximo 8 a 10 minutos.
 *
 * 2. GEOGRAFIA E MESMO CAMINHO:
 *    - Não se limita a bairros com o mesmo nome!
 *    - Avalia se as entregas estão no mesmo corredor de saída, na mesma avenida ou a uma distância curta (<2.2km).
 */
export function analyzeRouteTrajectory(
  orderA: Order,
  orderB: Order,
  storeLat: number = DEFAULT_STORE_COORDS.lat,
  storeLng: number = DEFAULT_STORE_COORDS.lng
): TrajectoryAnalysis {
  const waitA = getOrderWaitMinutes(orderA);
  const waitB = getOrderWaitMinutes(orderB);
  const timeDiffMinutes = Math.abs(waitA - waitB);

  const coordA = getOrderEffectiveCoords(orderA, storeLat, storeLng);
  const coordB = getOrderEffectiveCoords(orderB, storeLat, storeLng);

  const interOrderDistanceKm = calculateRoadDistanceKm(coordA.lat, coordA.lng, coordB.lat, coordB.lng);

  const distStoreToA = calculateRoadDistanceKm(storeLat, storeLng, coordA.lat, coordA.lng);
  const distStoreToB = calculateRoadDistanceKm(storeLat, storeLng, coordB.lat, coordB.lng);

  // Rota conjunta: Loja -> A -> B -> Loja
  const combinedTripKm = distStoreToA + interOrderDistanceKm + calculateRoadDistanceKm(coordB.lat, coordB.lng, storeLat, storeLng);
  // Viagens separadas: (Loja -> A -> Loja) + (Loja -> B -> Loja)
  const separateTripsKm = distStoreToA * 2 + distStoreToB * 2;
  const kmSaved = Math.max(0, separateTripsKm - combinedTripKm);
  const detourKm = Number(Math.max(0, combinedTripKm - (Math.max(distStoreToA, distStoreToB) * 2)).toFixed(1));

  const neighA = (orderA.neighborhood || '').trim().toLowerCase();
  const neighB = (orderB.neighborhood || '').trim().toLowerCase();
  const sameNeighborhood = neighA === neighB && neighA.length > 0;

  const corridorA = findOrderCorridor(orderA);
  const corridorB = findOrderCorridor(orderB);
  const sameCorridor = Boolean(corridorA && corridorB && corridorA.id === corridorB.id);

  // Corredores contíguos de Blumenau (adjacência natural de tráfego)
  const isAdjacentCorridor =
    (corridorA?.id === 'corredor_velha_aguaverde' && corridorB?.id === 'corredor_vilanova_escola') ||
    (corridorB?.id === 'corredor_velha_aguaverde' && corridorA?.id === 'corredor_vilanova_escola') ||
    (corridorA?.id === 'corredor_vilanova_escola' && corridorB?.id === 'corredor_centro_leste') ||
    (corridorB?.id === 'corredor_vilanova_escola' && corridorA?.id === 'corredor_centro_leste') ||
    (corridorA?.id === 'corredor_centro_leste' && corridorB?.id === 'corredor_sul_garcia') ||
    (corridorB?.id === 'corredor_centro_leste' && corridorA?.id === 'corredor_sul_garcia');

  // Determina se estão no MESMO CAMINHO / TRAJETO
  const isGeographicallyAligned =
    sameNeighborhood ||
    interOrderDistanceKm <= 2.0 || // Menos de 2 km entre os pontos é proximidade imediata
    (sameCorridor && interOrderDistanceKm <= 3.2) || // No mesmo eixo viário até 3.2 km
    (isAdjacentCorridor && interOrderDistanceKm <= 2.5); // Em eixos contíguos com pouco desvio

  const canShareRoute = isGeographicallyAligned;

  // Análise estrita de tempo e SLA
  const maxWait = Math.max(waitA, waitB);
  const minWait = Math.min(waitA, waitB);
  const hasUrgentSLA = maxWait >= 25 || (orderA.status === 'ready_at_counter' && waitA >= 10) || (orderB.status === 'ready_at_counter' && waitB >= 10);

  // Se um pedido tem mais de 22 min e o outro é recém-chegado (diferença > 8m), BLOQUEIA!
  const isDisparateTime = timeDiffMinutes > (maxWait >= 20 ? 7 : 10);

  let timeCompatible = !isDisparateTime;
  let urgentReason: string | undefined;

  if (hasUrgentSLA) {
    const delayedOrder = waitA >= waitB ? orderA : orderB;
    const delayedTime = Math.max(waitA, waitB);
    urgentReason = `Pedido #${delayedOrder.codeNumber || delayedOrder.displayCode} já aguarda há ${delayedTime} min. Saída imediata prioritária para não comprometer o cliente!`;

    // Se ambos já estão prontos no balcão e a diferença de tempo é pequena (<= 6m), eles ainda podem ir juntos
    if (orderA.status === 'ready_at_counter' && orderB.status === 'ready_at_counter' && timeDiffMinutes <= 6) {
      timeCompatible = true;
    } else {
      timeCompatible = false;
    }
  }

  // Se um estiver pronto no balcão e o outro estiver pendente/preparando, não pode esperar se a diferença for alta
  if (
    (orderA.status === 'ready_at_counter' && orderB.status !== 'ready_at_counter' && waitA >= 8) ||
    (orderB.status === 'ready_at_counter' && orderA.status !== 'ready_at_counter' && waitB >= 8)
  ) {
    timeCompatible = false;
    urgentReason = `Pedido pronto na bancada esfriando. Não pode aguardar outro pedido na cozinha.`;
  }

  // Nome descritivo do trajeto / corredor
  let corridorName = corridorA?.shortName || corridorB?.shortName || (sameNeighborhood ? orderA.neighborhood : `${orderA.neighborhood} + ${orderB.neighborhood}`);
  if (sameNeighborhood) {
    corridorName = `Bairro ${orderA.neighborhood}`;
  } else if (sameCorridor) {
    corridorName = `${corridorA?.shortName} (${orderA.neighborhood} + ${orderB.neighborhood})`;
  } else if (interOrderDistanceKm <= 2.0) {
    corridorName = `Mesmo Trajeto (${orderA.neighborhood} ➔ ${orderB.neighborhood})`;
  }

  let recommendationType: TrajectoryAnalysis['recommendationType'] = 'incompatible_route';
  let explanation = '';

  if (hasUrgentSLA && !timeCompatible) {
    recommendationType = 'urgent_immediate_dispatch';
    explanation = `🚨 ${urgentReason || 'Pedido em atraso crítico. Despachar individualmente sem retenção.'}`;
  } else if (!canShareRoute) {
    recommendationType = 'incompatible_route';
    explanation = `Rotas incompatíveis: ${orderA.neighborhood} e ${orderB.neighborhood} ficam distantes (${interOrderDistanceKm} km entre si).`;
  } else if (!timeCompatible) {
    recommendationType = 'incompatible_time';
    explanation = `Incompatível por tempo: Pedido #${orderA.codeNumber || ''} (${waitA}m) e #${orderB.codeNumber || ''} (${waitB}m) têm diferença de ${timeDiffMinutes} min. Não atrasar o mais antigo!`;
  } else if (interOrderDistanceKm <= 1.5 && timeDiffMinutes <= 6) {
    recommendationType = 'optimal_batch';
    explanation = `⚡ Lote Ideal: Mesmo trajeto (${interOrderDistanceKm} km entre entregas) com tempos alinhados (${waitA}m e ${waitB}m). Economia de ~${kmSaved.toFixed(1)} km.`;
  } else {
    recommendationType = 'acceptable_batch';
    explanation = `✓ Bom agrupamento: Mesma rota (${corridorName}, desvio de ${detourKm} km). Tempos sincronizados (${waitA}m e ${waitB}m).`;
  }

  return {
    canShareRoute,
    interOrderDistanceKm,
    corridorName,
    sameNeighborhood,
    detourKm,
    timeCompatible,
    timeDiffMinutes,
    waitA,
    waitB,
    hasUrgentSLA,
    urgentReason,
    recommendationType,
    explanation,
  };
}

export interface SmartRouteBatch {
  id: string;
  corridorName: string;
  neighborhoodSummary: string;
  orderIds: string[];
  orders: Order[];
  maxWaitMinutes: number;
  minWaitMinutes: number;
  timeSpreadMinutes: number;
  interOrderDistanceKm: number;
  isUrgent: boolean;
  urgencyReason?: string;
  confidenceScore: number;
  description: string;
}

/**
 * Gera lotes inteligentes para pedidos prontos no balcão ou pendentes de despacho:
 * - Respeita rigorosamente a compatibilidade temporal (SLA).
 * - Agrupa pedidos no mesmo caminho/corredor, mesmo em bairros diferentes.
 * - Prioriza pedidos mais antigos (FIFO).
 */
export function buildSmartRouteBatches(
  orders: Order[],
  storeLat: number = DEFAULT_STORE_COORDS.lat,
  storeLng: number = DEFAULT_STORE_COORDS.lng
): SmartRouteBatch[] {
  // Apenas pedidos não despachados
  const availableOrders = [...orders]
    .filter((o) => !o.assignedMotoboyId && o.status !== 'cancelled' && o.status !== 'delivered')
    .sort((a, b) => getOrderWaitMinutes(b) - getOrderWaitMinutes(a)); // Mais antigos primeiro (maior espera)

  const batches: SmartRouteBatch[] = [];
  const assignedOrderIds = new Set<string>();

  for (let i = 0; i < availableOrders.length; i++) {
    const seed = availableOrders[i];
    if (assignedOrderIds.has(seed.id)) continue;

    const seedWait = getOrderWaitMinutes(seed);

    // Se o pedido já é crítico (>= 28 min de espera), só agrupa se outro estiver IGUALMENTE pronto e perto
    const cluster: Order[] = [seed];
    let clusterInterDist = 0;
    let clusterCorridor = findOrderCorridor(seed)?.shortName || seed.neighborhood || 'Centro';

    for (let j = i + 1; j < availableOrders.length; j++) {
      if (cluster.length >= 2) break; // Limite de 2 entregas por rota para manter a velocidade do delivery
      const candidate = availableOrders[j];
      if (assignedOrderIds.has(candidate.id)) continue;

      const analysis = analyzeRouteTrajectory(seed, candidate, storeLat, storeLng);

      // Critério estrito: precisa poder compartilhar a rota E ter tempo compatível
      if (analysis.canShareRoute && analysis.timeCompatible) {
        cluster.push(candidate);
        clusterInterDist = analysis.interOrderDistanceKm;
        clusterCorridor = analysis.corridorName;
        break;
      }
    }

    if (cluster.length >= 2) {
      cluster.forEach((o) => assignedOrderIds.add(o.id));
      const waits = cluster.map(getOrderWaitMinutes);
      const maxW = Math.max(...waits);
      const minW = Math.min(...waits);

      const neighs = Array.from(new Set(cluster.map((o) => o.neighborhood || 'Centro'))).join(' + ');

      batches.push({
        id: `batch_${cluster[0].id}_${cluster[1].id}`,
        corridorName: clusterCorridor,
        neighborhoodSummary: neighs,
        orderIds: cluster.map((o) => o.id),
        orders: cluster,
        maxWaitMinutes: maxW,
        minWaitMinutes: minW,
        timeSpreadMinutes: maxW - minW,
        interOrderDistanceKm: clusterInterDist,
        isUrgent: maxW >= 22,
        urgencyReason: maxW >= 22 ? `Pedido com ${maxW} min de espera` : undefined,
        confidenceScore: clusterInterDist <= 1.5 && maxW - minW <= 5 ? 98 : 85,
        description: `Mesmo trajeto (${clusterCorridor}, ${clusterInterDist} km entre entregas) com tempos alinhados (${waits.join('m e ')}m).`,
      });
    }
  }

  return batches;
}
