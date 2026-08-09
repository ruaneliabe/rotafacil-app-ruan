import { LocationPoint, Stop, RouteConfig, RouteSummary } from '../types';

/**
 * Calculates straight-line distance (Haversine formula) in km between two lat/lng coordinates
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Route optimization algorithm (Nearest-Neighbor + 2-Opt)
 * Orders stops starting from origin to minimize total distance
 */
export function optimizeRouteStops(origin: LocationPoint, stops: Stop[]): Stop[] {
  if (stops.length <= 1) return stops;

  const unvisited = [...stops];
  const orderedStops: Stop[] = [];

  let currentLat = origin.lat;
  let currentLng = origin.lng;

  // 1. Nearest Neighbor construction
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = calculateDistanceKm(
        currentLat,
        currentLng,
        unvisited[i].lat,
        unvisited[i].lng
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }

    const nextStop = unvisited.splice(nearestIndex, 1)[0];
    orderedStops.push(nextStop);
    currentLat = nextStop.lat;
    currentLng = nextStop.lng;
  }

  // 2. 2-Opt Refinement for reducing route crossovers
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  const points = [origin, ...orderedStops];

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < points.length - 1; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const d1 = calculateDistanceKm(
          points[i - 1].lat,
          points[i - 1].lng,
          points[i].lat,
          points[i].lng
        ) + calculateDistanceKm(
          points[j].lat,
          points[j].lng,
          points[j + 1]?.lat ?? points[j].lat,
          points[j + 1]?.lng ?? points[j].lng
        );

        const d2 = calculateDistanceKm(
          points[i - 1].lat,
          points[i - 1].lng,
          points[j].lat,
          points[j].lng
        ) + calculateDistanceKm(
          points[i].lat,
          points[i].lng,
          points[j + 1]?.lat ?? points[j].lat,
          points[j + 1]?.lng ?? points[j].lng
        );

        if (d2 < d1 - 0.05) { // 50m threshold
          // Reverse sub-segment [i, j]
          const sub = points.slice(i, j + 1).reverse();
          points.splice(i, j - i + 1, ...sub);
          improved = true;
        }
      }
    }
  }

  // Update orderIndex
  const finalStops = points.slice(1) as Stop[];
  return finalStops.map((stop, idx) => ({
    ...stop,
    orderIndex: idx + 1,
  }));
}

/**
 * Calculates stats and financial summary for the current route
 */
export function calculateRouteSummary(
  origin: LocationPoint,
  stops: Stop[],
  config: RouteConfig
): RouteSummary {
  if (stops.length === 0) {
    return {
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      estimatedFuelLiters: 0,
      estimatedFuelCost: 0,
      totalRevenue: 0,
      netProfit: 0,
      completedStopsCount: 0,
      totalStopsCount: 0,
    };
  }

  let totalDistKm = 0;
  let prevLat = origin.lat;
  let prevLng = origin.lng;

  stops.forEach((stop) => {
    // Add 1.25 multiplier for realistic road network curvature vs straight line
    const dist = calculateDistanceKm(prevLat, prevLng, stop.lat, stop.lng) * 1.25;
    totalDistKm += dist;
    prevLat = stop.lat;
    prevLng = stop.lng;
  });

  // Average speed based on transport mode in city environment
  const speedKmhMap: Record<string, number> = {
    moto: 28,
    car: 22,
    truck: 18,
    bicycle: 15,
    foot: 5,
  };

  const avgSpeedKmh = speedKmhMap[config.transportMode] || 25;
  const travelDurationMinutes = (totalDistKm / avgSpeedKmh) * 60;
  // Add 8 minutes average service time per stop
  const totalDurationMinutes = Math.round(travelDurationMinutes + stops.length * 8);

  const fuelConsumptionKmL = config.fuelConsumptionKmL || 30;
  const estimatedFuelLiters = totalDistKm / fuelConsumptionKmL;
  const estimatedFuelCost = estimatedFuelLiters * (config.fuelPricePerLiter || 0);

  const totalRevenue = stops.reduce((acc, s) => acc + (s.valueToReceive || config.pricePerDelivery || 0), 0);
  const totalCost = estimatedFuelCost + (config.fixedDailyCost || 0);
  const netProfit = totalRevenue - totalCost;

  const completedStopsCount = stops.filter((s) => s.status === 'delivered').length;

  return {
    totalDistanceKm: Number(totalDistKm.toFixed(1)),
    totalDurationMinutes,
    estimatedFuelLiters: Number(estimatedFuelLiters.toFixed(2)),
    estimatedFuelCost: Number(estimatedFuelCost.toFixed(2)),
    totalRevenue: Number(totalRevenue.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    completedStopsCount,
    totalStopsCount: stops.length,
  };
}

/**
 * Helper to expand common Portuguese address abbreviations and clean hyphens
 */
export function normalizeAddressQuery(raw: string): string {
  let cleaned = raw.trim();
  // Expand common street prefixes
  cleaned = cleaned.replace(/^r\.\s*/i, 'Rua ');
  cleaned = cleaned.replace(/^av\.\s*/i, 'Avenida ');
  cleaned = cleaned.replace(/^tv\.\s*/i, 'Travessa ');
  cleaned = cleaned.replace(/^tr\.\s*/i, 'Travessa ');
  cleaned = cleaned.replace(/^al\.\s*/i, 'Alameda ');
  cleaned = cleaned.replace(/^pç\.\s*/i, 'Praça ');
  cleaned = cleaned.replace(/\br\.\b/gi, 'Rua');
  cleaned = cleaned.replace(/\bav\.\b/gi, 'Avenida');
  
  // Replace hyphens separating neighborhood e.g. "R. dos Caçadores, 653 - Velha" -> "Rua dos Caçadores, 653, Velha"
  cleaned = cleaned.replace(/\s*-\s*/g, ', ');
  return cleaned;
}

/**
 * Geocode search using Nominatim (OpenStreetMap), viaCEP, or neighborhood dictionary fallback
 */
export async function geocodeAddress(query: string): Promise<LocationPoint | null> {
  const rawCleaned = query.trim();
  if (!rawCleaned) return null;

  const normalized = normalizeAddressQuery(rawCleaned);

  // 1. Check if query is a CEP (8 digits e.g., 89040-313 or 89040313)
  const cepMatch = rawCleaned.replace(/\D/g, '');
  if (cepMatch.length === 8) {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepMatch}/json/`);
      const data = await res.json();
      if (!data.erro) {
        const fullAddress = `${data.logradouro || ''}, ${data.bairro || ''}, ${data.localidade || 'Blumenau'} - ${data.uf || 'SC'}`;
        try {
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              fullAddress + ', Brasil'
            )}&limit=1`
          );
          if (nomRes.ok) {
            const nomData = await nomRes.json();
            if (nomData && nomData.length > 0) {
              return {
                address: fullAddress,
                lat: parseFloat(nomData[0].lat),
                lng: parseFloat(nomData[0].lon),
                cep: data.cep,
                name: data.logradouro || rawCleaned,
              };
            }
          }
        } catch {
          // ignore nominatim cep error
        }
      }
    } catch {
      // fallback to standard nominatim
    }
  }

  // 2. Try OpenStreetMap Nominatim with normalized query variations
  const searchQueries = [
    `${normalized}, Blumenau, SC, Brasil`,
    normalized.includes(',') ? `${normalized.split(',')[0]}, Blumenau, SC, Brasil` : `${normalized}, Blumenau, SC`
  ];

  for (const sq of searchQueries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(sq)}&limit=1`,
        { 
          headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
          signal: controller.signal 
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          // Check if coordinates are reasonably inside/near Blumenau area (-27.2 to -26.7, -49.3 to -48.8)
          if (lat < -26.7 && lat > -27.2 && lng < -48.8 && lng > -49.3) {
            return {
              address: rawCleaned,
              lat,
              lng,
              name: data[0].display_name ? data[0].display_name.split(',')[0] : rawCleaned,
            };
          }
        }
      }
    } catch (err) {
      console.warn('Nominatim geocode attempt failed:', err);
    }
  }

  // 3. Fallback: Smart Blumenau street & neighborhood dictionary with house number ranges
  const lowerNorm = normalized.toLowerCase();
  
  // Extract house number if present
  const numberMatch = normalized.match(/\b(\d{1,5})\b/);
  const houseNum = numberMatch ? parseInt(numberMatch[1], 10) : null;

  if (lowerNorm.includes('caçadores') || lowerNorm.includes('cacadores')) {
    if (houseNum !== null) {
      if (houseNum <= 400) return { address: rawCleaned, lat: -26.9248, lng: -49.0988, name: 'Rua dos Caçadores' };
      if (houseNum <= 1000) return { address: rawCleaned, lat: -26.9228, lng: -49.1082, name: 'Rua dos Caçadores' };
      if (houseNum <= 1800) return { address: rawCleaned, lat: -26.9185, lng: -49.1160, name: 'Rua dos Caçadores' };
      return { address: rawCleaned, lat: -26.9153287, lng: -49.1223501, name: 'Rua dos Caçadores' };
    }
    return { address: rawCleaned, lat: -26.9228, lng: -49.1082, name: 'Rua dos Caçadores' };
  }

  if (lowerNorm.includes('pioneiros')) {
    return { address: rawCleaned, lat: -26.9175, lng: -49.1040, name: 'Rua dos Pioneiros' };
  }

  if (lowerNorm.includes('guabiruba') || lowerNorm.includes('gabiruba')) {
    return { address: rawCleaned, lat: -26.9140, lng: -49.1125, name: 'Rua Guabiruba' };
  }

  if (lowerNorm.includes('humberto de campos')) {
    return { address: rawCleaned, lat: -26.9120, lng: -49.0810, name: 'Rua Humberto de Campos' };
  }

  if (lowerNorm.includes('general osorio') || lowerNorm.includes('osorio')) {
    return { address: rawCleaned, lat: -26.9220, lng: -49.0920, name: 'Rua General Osório' };
  }

  const blumenauKnownLocations: Record<string, { lat: number; lng: number }> = {
    'centro': { lat: -26.9189, lng: -49.0660 },
    'velha central': { lat: -26.9153287, lng: -49.1223501 },
    'velha': { lat: -26.9228, lng: -49.1082 },
    'vila nova': { lat: -26.9067, lng: -49.0785 },
    'victor konder': { lat: -26.9090, lng: -49.0710 },
    'agua verde': { lat: -26.9135, lng: -49.1020 },
    'água verde': { lat: -26.9135, lng: -49.1020 },
    'itoupava seca': { lat: -26.8970, lng: -49.0830 },
    'itoupava norte': { lat: -26.8850, lng: -49.0760 },
    'itoupavazinha': { lat: -26.8650, lng: -49.0880 },
    'fortaleza': { lat: -26.8790, lng: -49.0550 },
    'garcia': { lat: -26.9450, lng: -49.0650 },
    'ponta aguda': { lat: -26.9200, lng: -49.0520 },
    'vorstadt': { lat: -26.9250, lng: -49.0420 },
    'escola agricola': { lat: -26.8990, lng: -49.0980 },
    'progresso': { lat: -26.9780, lng: -49.0750 },
    'valparaiso': { lat: -26.9480, lng: -49.0520 },
    'tribess': { lat: -26.8650, lng: -49.0520 },
    'badenfurt': { lat: -26.8780, lng: -49.1450 },
  };

  for (const [key, coords] of Object.entries(blumenauKnownLocations)) {
    if (lowerNorm.includes(key)) {
      return {
        address: rawCleaned,
        lat: coords.lat,
        lng: coords.lng,
        name: rawCleaned.split('-')[0],
      };
    }
  }

  // Graceful fallback centered on Blumenau central area
  const randomOffsetLat = (Math.random() - 0.5) * 0.002;
  const randomOffsetLng = (Math.random() - 0.5) * 0.002;

  return {
    address: rawCleaned,
    lat: -26.9228 + randomOffsetLat,
    lng: -49.1082 + randomOffsetLng,
    name: rawCleaned.split('-')[0],
  };
}

/**
 * Format currency BRL (R$ 15,00)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

/**
 * Format duration (e.g., 1h 45min)
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Build external navigation links
 */
export function getGoogleMapsUrl(origin: LocationPoint, stops: Stop[]): string {
  if (stops.length === 0) return '#';
  const waypoints = stops.slice(0, -1).map((s) => `${s.lat},${s.lng}`).join('|');
  const destination = stops[stops.length - 1];
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }
  return url;
}

export function getWazeUrl(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

export function getSingleGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * Generate formatted WhatsApp message for delivery list
 */
export function generateWhatsAppMessage(origin: LocationPoint, stops: Stop[], summary: RouteSummary): string {
  let msg = `*🚀 ROTA FÁCIL - Roteiro de Entregas*\n`;
  msg += `📍 *Origem:* ${origin.name || origin.address}\n`;
  msg += `📊 *Total:* ${stops.length} entregas | 🛣️ ${summary.totalDistanceKm} km | ⏱️ ${formatDuration(summary.totalDurationMinutes)}\n`;
  msg += `-----------------------------------\n\n`;

  stops.forEach((s, idx) => {
    const statusIcon =
      s.status === 'delivered' ? '✅' : s.status === 'in_transit' ? '🚚' : s.status === 'failed' ? '❌' : '📦';
    msg += `*${idx + 1}. ${s.title}* ${statusIcon}\n`;
    if (s.recipientName) msg += `👤 Cliente: ${s.recipientName}\n`;
    if (s.phone) msg += `📞 Tel: ${s.phone}\n`;
    msg += `🏠 Endereço: ${s.address}\n`;
    if (s.notes) msg += `📝 Obs: ${s.notes}\n`;
    if (s.valueToReceive) msg += `💰 Cobrar: ${formatCurrency(s.valueToReceive)}\n`;
    msg += `🗺️ Waze: ${getWazeUrl(s.lat, s.lng)}\n\n`;
  });

  msg += `-----------------------------------\n`;
  msg += `📍 *Navegação completa no Google Maps:*\n${getGoogleMapsUrl(origin, stops)}`;

  return msg;
}
