import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LocationPoint, Stop, Motoboy } from '../types';
import { calculateDistanceKm } from '../utils/geoUtils';

interface RouteMapProps {
  origin: LocationPoint;
  stops: Stop[];
  selectedStopId?: string | null;
  onSelectStop?: (stop: Stop) => void;
  onUpdateStopStatus?: (stopId: string, status: Stop['status']) => void;
  motoboyName?: string;
  motoboyVehicle?: string;
  showMotoboyMarker?: boolean;
  motoboyLat?: number;
  motoboyLng?: number;
  motoboysList?: Motoboy[];
  selectedMotoboyId?: string | null;
  onSelectMotoboy?: (motoboyId: string | null) => void;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  origin,
  stops,
  selectedStopId,
  onSelectStop,
  motoboyName,
  motoboyVehicle,
  showMotoboyMarker = true,
  motoboyLat,
  motoboyLng,
  motoboysList,
  selectedMotoboyId = null,
  onSelectMotoboy,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Initialize Map with Dark Tile Theme
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([origin.lat, origin.lng], 14);

      // CartoDB Dark Matter tiles matching sleek Uber/Linear SaaS theme
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '© OpenStreetMap contributors © CARTO',
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      markersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      // Invalidate size after layout renders
      setTimeout(() => map.invalidateSize(), 150);
      setTimeout(() => map.invalidateSize(), 500);
    }

    // Attach ResizeObserver to auto-fix map on container resize
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Update Markers and Polyline when origin/stops/selection change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    map.invalidateSize();

    markersGroup.clearLayers();
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    const isStoreAddressConfigured = Boolean(
      origin.address &&
      origin.address.trim() !== '' &&
      origin.address !== 'Endereço não cadastrado' &&
      origin.address !== 'Aguardando cadastro em Configurar Loja'
    );

    const bounds: [number, number][] = [];

    // When the dashboard passes a fleet list, this map is an operational fleet overview.
    // In this mode we intentionally hide every customer/order stop and route polyline,
    // otherwise multiple riders with multiple orders create a misleading spaghetti map.
    // Customer tracking and the driver's own route map do not pass motoboysList, so they
    // continue to show their delivery destination normally.
    const fleetOverviewOnly = Boolean(motoboysList);

    // 1. Store Marker (Sleek Dark Pill) - ONLY render if store address is configured in Configurar Loja
    if (isStoreAddressConfigured) {
      bounds.push([origin.lat, origin.lng]);

      const originIcon = L.divIcon({
        className: 'custom-origin-pin z-50',
        html: `
          <div class="relative flex flex-col items-center justify-center">
            <div class="bg-slate-900/95 text-emerald-400 px-3 py-1 rounded-xl shadow-2xl border border-emerald-500/70 flex items-center gap-1.5 font-extrabold text-xs z-50">
              <span class="text-sm">🏪</span>
              <span class="tracking-wide uppercase text-[11px] text-white">${origin.name || 'Minha Loja'}</span>
            </div>
            <div class="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-emerald-500/80 -mt-0.5"></div>
          </div>
        `,
        iconSize: [110, 36],
        iconAnchor: [55, 36],
      });

      const originMarker = L.marker([origin.lat, origin.lng], { icon: originIcon, zIndexOffset: 1000 })
        .bindPopup(`
          <div class="p-2 min-w-[210px] text-slate-100">
            <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">🏪 Estabelecimento / Loja</span>
            <h4 class="font-extrabold text-white text-sm mt-1.5">${origin.name || 'Loja Principal'}</h4>
            <p class="text-xs text-slate-300 mt-0.5">${origin.address}</p>
          </div>
        `);
      markersGroup.addLayer(originMarker);
    }

    // 2. Stops Markers (hidden on store/fleet overview)
    if (!fleetOverviewOnly) {
      stops.forEach((stop, idx) => {
        bounds.push([stop.lat, stop.lng]);

        const isSelected = stop.id === selectedStopId;
        let bgColor = 'bg-slate-800 text-slate-200 border-slate-600';
        let badgeHtml = `${idx + 1}`;

        if (stop.status === 'delivered') {
          bgColor = 'bg-emerald-600 text-white border-emerald-400';
          badgeHtml = '✓';
        } else if (stop.status === 'in_transit') {
          bgColor = 'bg-blue-600 text-white border-blue-400';
        } else if (stop.status === 'failed') {
          bgColor = 'bg-rose-600 text-white border-rose-400';
          badgeHtml = '✕';
        }

        const ringClass = isSelected ? 'ring-4 ring-indigo-500/60 scale-110 z-30' : '';

        const stopIcon = L.divIcon({
          className: 'custom-stop-pin',
          html: `
            <div class="relative flex flex-col items-center justify-center transition-all duration-200 ${ringClass}">
              <div class="w-8 h-8 ${bgColor} rounded-full shadow-lg border-2 flex items-center justify-center font-bold text-xs z-30">
                ${badgeHtml}
              </div>
              <div class="mt-0.5 bg-slate-900/95 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-black whitespace-nowrap border border-emerald-500/60 shadow-md z-30">
                ${stop.title?.includes('Seu Endereço') ? '📍 Seu Endereço' : (stop.neighborhood || 'Centro')}
              </div>
            </div>
          `,
          iconSize: [70, 48],
          iconAnchor: [35, 24],
        });

        const marker = L.marker([stop.lat, stop.lng], { icon: stopIcon });

        marker.on('click', () => {
          if (onSelectStop) onSelectStop(stop);
        });

        marker.bindPopup(`
          <div class="p-2 min-w-[220px] text-slate-100">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="font-semibold text-xs text-indigo-400">Parada #${idx + 1}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                stop.status === 'delivered' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' :
                stop.status === 'in_transit' ? 'bg-blue-950 text-blue-300 border border-blue-700' :
                stop.status === 'failed' ? 'bg-rose-950 text-rose-300 border border-rose-700' : 'bg-slate-800 text-slate-300 border border-slate-700'
              }">${
                stop.status === 'delivered' ? 'Entregue' :
                stop.status === 'in_transit' ? 'Em trânsito' :
                stop.status === 'failed' ? 'Não entregue' : 'Pendente'
              }</span>
            </div>
            <h4 class="font-extrabold text-white text-sm">${stop.title}</h4>
            <div class="inline-flex items-center gap-1 my-1 px-2 py-0.5 bg-emerald-950/80 text-emerald-300 font-extrabold text-xs rounded border border-emerald-700/60">
              📍 Bairro: ${stop.neighborhood || 'Centro'}
            </div>
            <p class="text-xs text-slate-300 font-medium">${stop.address}</p>
            ${stop.recipientName ? `<p class="text-xs text-slate-400 mt-1">👤 ${stop.recipientName}</p>` : ''}
            <div class="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between gap-1">
              <a href="https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes" target="_blank" class="px-2 py-1 bg-indigo-950 text-indigo-300 border border-indigo-700 rounded text-xs font-semibold hover:bg-indigo-900 inline-block">
                Waze 🧭
              </a>
              <a href="https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}" target="_blank" class="px-2 py-1 bg-emerald-950 text-emerald-300 border border-emerald-700 rounded text-xs font-semibold hover:bg-emerald-900 inline-block">
                Google Maps 🗺️
              </a>
            </div>
          </div>
        `);

        markersGroup.addLayer(marker);
      });
    }

    // 3. Draw Motoboy Markers on Map (Sleek Scalable Cluster + Focus System)
    if (motoboysList && motoboysList.length > 0) {
      // Split motoboys into "At Store" (available & near store) and "On Road / Outside"
      const atStore = motoboysList.filter((m) => {
        if (m.status === 'delivering' || m.status === 'returning_to_store') return false;
        if (m.currentLat && m.currentLng && origin.lat && origin.lng) {
          const dist = calculateDistanceKm(m.currentLat, m.currentLng, origin.lat, origin.lng);
          if (dist > 0.3) return false; // Motoboy is outside store (e.g. at home or in street)
        }
        return true;
      });

      const onRoad = motoboysList.filter((m) => !atStore.includes(m));

      // A) RENDER AT-STORE MOTOBOYS (Clustered or Individual based on count & selection)
      const isAStoreMotoboySelected = selectedMotoboyId && atStore.some((m) => m.id === selectedMotoboyId);

      if (atStore.length > 2 && !isAStoreMotoboySelected) {
        // Cluster at-store motoboys into 1 sleek Fleet Badge
        const clusterIcon = L.divIcon({
          className: 'custom-fleet-cluster-pin z-40',
          html: `
            <div class="relative flex flex-col items-center justify-center">
              <div class="px-2.5 py-1 bg-emerald-950/95 text-emerald-300 border-2 border-emerald-400 rounded-xl shadow-2xl font-black text-xs flex items-center gap-1.5 animate-pulse">
                <span class="text-sm">🛵</span>
                <span>${atStore.length} na Loja (Fila)</span>
              </div>
            </div>
          `,
          iconSize: [120, 36],
          iconAnchor: [60, 18],
        });

        let storeQueuePopupHtml = `
          <div class="p-2 min-w-[220px] max-h-[220px] overflow-y-auto text-slate-100 space-y-1.5">
            <div class="flex items-center justify-between pb-1 border-b border-slate-800">
              <span class="text-xs font-black text-emerald-400 uppercase">🏪 Fila de Espera na Loja</span>
              <span class="text-[10px] font-bold bg-emerald-900 text-emerald-200 px-1.5 py-0.5 rounded">${atStore.length} motoboys</span>
            </div>
        `;

        atStore.forEach((mb, qIdx) => {
          storeQueuePopupHtml += `
            <div class="p-1.5 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span class="font-extrabold text-white">${qIdx + 1}º ${mb.name}</span>
                <span class="block text-[10px] text-slate-400">${mb.vehicleModel || 'Moto'}</span>
              </div>
              <span class="text-[10px] px-1.5 py-0.5 bg-emerald-950 text-emerald-300 font-bold rounded">Pronto</span>
            </div>
          `;
        });

        storeQueuePopupHtml += `</div>`;

        const clusterMarker = L.marker([origin.lat + 0.0001, origin.lng + 0.0001], {
          icon: clusterIcon,
          zIndexOffset: 800,
        }).bindPopup(storeQueuePopupHtml);

        markersGroup.addLayer(clusterMarker);
      } else {
        // Individual pins for at-store motoboys with circular radial layout
        atStore.forEach((mb, idx) => {
          const isThisSelected = mb.id === selectedMotoboyId;
          const angle = (idx / (atStore.length || 1)) * 2 * Math.PI;
          const radius = 0.00035;
          const mbLat = origin.lat + Math.sin(angle) * radius;
          const mbLng = origin.lng + Math.cos(angle) * radius;

          const initial = mb.name ? mb.name.charAt(0).toUpperCase() : 'M';
          const ringColor = isThisSelected ? 'border-amber-300 ring-4 ring-amber-500/50 scale-110' : 'border-emerald-400';

          const motoboyIcon = L.divIcon({
            className: 'custom-motoboy-pin z-40',
            html: `
              <div class="relative flex flex-col items-center justify-center">
                <div class="w-8 h-8 rounded-full bg-slate-950 border-2 ${ringColor} text-emerald-300 flex items-center justify-center font-black text-xs shadow-2xl z-30">
                  ${initial}
                </div>
                <div class="mt-0.5 bg-emerald-600 text-white font-extrabold px-1.5 py-0.5 rounded text-[9px] uppercase whitespace-nowrap shadow-md border border-emerald-300 z-30">
                  ${mb.name.split(' ')[0]}
                </div>
              </div>
            `,
            iconSize: [70, 48],
            iconAnchor: [35, 24],
          });

          const mbMarker = L.marker([mbLat, mbLng], { icon: motoboyIcon }).bindPopup(`
            <div class="p-2 min-w-[200px] text-slate-100">
              <div class="flex items-center justify-between gap-2 mb-1">
                <span class="font-extrabold text-xs text-white">${mb.name}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-700">Na Loja</span>
              </div>
              <p class="text-xs text-slate-300">${mb.vehicleModel || 'Moto'} • ${mb.plate || ''}</p>
            </div>
          `);

          markersGroup.addLayer(mbMarker);
          bounds.push([mbLat, mbLng]);
        });
      }

      // B) RENDER ON-ROAD MOTOBOYS (Delivering or Returning)
      onRoad.forEach((mb) => {
        let mbLat = mb.currentLat || origin.lat;
        let mbLng = mb.currentLng || origin.lng;
        const isReturning = mb.status === 'returning_to_store' || (mb as any).isReturning;
        const isDelivering = mb.status === 'delivering';
        const isSelected = selectedMotoboyId === mb.id;
        const isFilteringActive = Boolean(selectedMotoboyId);

        // Check if motoboy has a real distinct GPS location set
        const hasCustomGps =
          typeof mb.currentLat === 'number' &&
          typeof mb.currentLng === 'number' &&
          mb.currentLat !== 0 &&
          mb.currentLng !== 0 &&
          (Math.abs(mb.currentLat - origin.lat) > 0.0003 || Math.abs(mb.currentLng - origin.lng) > 0.0003);

        // Never invent a driver's position. If there is no valid GPS yet,
        // omit the road marker until the device publishes a real location.
        if (!hasCustomGps) return;

        const initial = mb.name ? mb.name.charAt(0).toUpperCase() : 'M';

        // If another motoboy is selected, show this motoboy as a clean discrete dot to avoid screen clutter!
        if (isFilteringActive && !isSelected) {
          const discreteDotIcon = L.divIcon({
            className: 'custom-discrete-dot z-20',
            html: `
              <div class="w-3.5 h-3.5 rounded-full ${isReturning ? 'bg-amber-500' : 'bg-blue-500'} border border-white shadow-md cursor-pointer opacity-70 hover:opacity-100 hover:scale-125 transition-all"></div>
            `,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });

          const dotMarker = L.marker([mbLat, mbLng], { icon: discreteDotIcon }).bindPopup(`
            <div class="p-1.5 text-slate-100 text-xs">
              <strong>${mb.name}</strong> (${isReturning ? 'Voltando' : 'Em Rota'})
            </div>
          `);

          if (onSelectMotoboy) {
            dotMarker.on('click', () => onSelectMotoboy(mb.id));
          }

          markersGroup.addLayer(dotMarker);
          return;
        }

        // Selected or All-mode Motoboy Marker
        const ringColor = isReturning
          ? 'border-amber-400 bg-amber-500/20 text-amber-300'
          : isDelivering
          ? 'border-blue-400 bg-blue-500/20 text-blue-300'
          : 'border-emerald-400 bg-emerald-500/20 text-emerald-300';

        const distFromStore =
          mb.currentLat && mb.currentLng && origin.lat && origin.lng
            ? calculateDistanceKm(mb.currentLat, mb.currentLng, origin.lat, origin.lng)
            : 0;

        const statusBadgeText = isReturning
          ? 'Voltando'
          : isDelivering
          ? 'Em Rota'
          : distFromStore > 0.3
          ? `Disponível (${distFromStore.toFixed(1)}km)`
          : 'Na Loja';

        const badgeBg = isReturning
          ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
          : isDelivering
          ? 'bg-blue-600 text-white border-blue-300 font-extrabold'
          : 'bg-emerald-600 text-white border-emerald-300 font-extrabold';

        const motoboyIcon = L.divIcon({
          className: 'custom-motoboy-pin z-40',
          html: `
            <div class="relative flex flex-col items-center justify-center">
              ${isReturning ? '<div class="absolute -inset-1.5 bg-amber-500/40 rounded-full animate-ping"></div>' : ''}
              <div class="w-8 h-8 rounded-full bg-slate-950 border-2 ${ringColor} ${isSelected ? 'ring-4 ring-amber-400/80 scale-110' : ''} flex items-center justify-center font-black text-xs shadow-2xl z-30">
                ${initial}
              </div>
              <div class="mt-0.5 ${badgeBg} px-2 py-0.5 rounded-md text-[10px] uppercase whitespace-nowrap shadow-lg border z-30">
                ${mb.name.split(' ')[0]} • ${statusBadgeText}
              </div>
            </div>
          `,
          iconSize: [90, 50],
          iconAnchor: [45, 25],
        });

        const mbMarker = L.marker([mbLat, mbLng], { icon: motoboyIcon }).bindPopup(`
          <div class="p-2 min-w-[200px] text-slate-100">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="font-extrabold text-xs text-white">${mb.name}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-black uppercase ${
                isReturning
                  ? 'bg-amber-950 text-amber-300 border border-amber-700'
                  : isDelivering
                  ? 'bg-blue-950 text-blue-300 border border-blue-700'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
              }">${isReturning ? 'Voltando à Loja' : isDelivering ? 'Em Rota' : statusBadgeText}</span>
            </div>
            <p class="text-xs text-slate-300">${mb.vehicleModel || 'Moto'} • ${mb.plate || ''}</p>
          </div>
        `);

        if (onSelectMotoboy) {
          mbMarker.on('click', () => onSelectMotoboy(mb.id));
        }

        markersGroup.addLayer(mbMarker);
        bounds.push([mbLat, mbLng]);

        // Draw returning trajectory line to store ONLY when returning
        if (isReturning) {
          const returnPolyline = L.polyline([[mbLat, mbLng], [origin.lat, origin.lng]], {
            color: '#f59e0b',
            weight: 3,
            opacity: 0.85,
            dashArray: '6, 8',
          });
          markersGroup.addLayer(returnPolyline);
        }
      });
    } else if (showMotoboyMarker) {
      let mLat: number | null = null;
      let mLng: number | null = null;

      if (
        typeof motoboyLat === 'number' &&
        !isNaN(motoboyLat) &&
        motoboyLat !== 0 &&
        typeof motoboyLng === 'number' &&
        !isNaN(motoboyLng) &&
        motoboyLng !== 0
      ) {
        mLat = motoboyLat;
        mLng = motoboyLng;
      }

      // No GPS means no motoboy marker; showing the destination as the driver
      // would create a false real-time tracking position.
      if (mLat !== null && mLng !== null) {
        const initial = motoboyName ? motoboyName.charAt(0).toUpperCase() : 'M';
        const motoboyIcon = L.divIcon({
          className: 'custom-motoboy-pin z-40',
          html: `
            <div class="relative flex flex-col items-center justify-center">
              <div class="w-8 h-8 rounded-full bg-slate-900 border-2 border-emerald-400 text-emerald-300 flex items-center justify-center font-black text-xs shadow-xl z-30">
                ${initial}
              </div>
              <div class="mt-0.5 bg-slate-950/90 text-emerald-300 px-2 py-0.5 rounded-md text-[10px] font-black uppercase whitespace-nowrap shadow-md border border-emerald-600/50 z-30">
                ${motoboyName ? motoboyName.split(' ')[0] : 'Entregador'}
              </div>
            </div>
          `,
          iconSize: [80, 50],
          iconAnchor: [40, 25],
        });

        const motoboyMarker = L.marker([mLat, mLng], { icon: motoboyIcon })
          .bindPopup(`
            <div class="p-2 min-w-[200px] text-slate-100">
              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-700">🛵 Localização do Entregador</span>
              <h4 class="font-extrabold text-white text-sm mt-1">${motoboyName || 'Entregador Dedicado'}</h4>
            </div>
          `);
        markersGroup.addLayer(motoboyMarker);
        bounds.push([mLat, mLng]);
      }
    }

    // 4. Draw Route Polyline ONLY IF an active route/delivery is happening.
    // Fleet overview intentionally never draws customer-to-customer lines.
    const activeStops = fleetOverviewOnly ? [] : stops.filter((s) => s.status === 'in_transit');

    if (activeStops.length > 0) {
      const hasLiveMotoboyGps =
        typeof motoboyLat === 'number' && !isNaN(motoboyLat) && motoboyLat !== 0 &&
        typeof motoboyLng === 'number' && !isNaN(motoboyLng) && motoboyLng !== 0;
      const routeStart: [number, number] = hasLiveMotoboyGps
        ? [motoboyLat as number, motoboyLng as number]
        : [origin.lat, origin.lng];
      const routeCoords: [number, number][] = [
        routeStart,
        ...activeStops.map((s) => [s.lat, s.lng] as [number, number]),
      ];

      polylineRef.current = L.polyline(routeCoords, {
        color: '#6366f1', // Sleek Indigo
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 8',
      }).addTo(map);
    }

    // 5. Smoothly fit map bounds to fit store + visible motoboys/stops
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15, { animate: true });
    } else if (!fleetOverviewOnly && stops.length > 0) {
      map.setView([stops[0].lat, stops[0].lng], 14, { animate: true });
    } else {
      map.setView([origin.lat || -26.91530418395996, origin.lng || -49.1146354675293], 14);
    }
  }, [origin, stops, selectedStopId, motoboysList, showMotoboyMarker, motoboyLat, motoboyLng, selectedMotoboyId]);

  // Counts for top status chip bar
  const atStoreCount =
    motoboysList?.filter((m) => {
      if (m.status === 'delivering' || m.status === 'returning_to_store') return false;
      if (m.currentLat && m.currentLng && origin.lat && origin.lng) {
        return calculateDistanceKm(m.currentLat, m.currentLng, origin.lat, origin.lng) <= 0.3;
      }
      return true;
    }).length || 0;

  const outsideAvailableCount =
    (motoboysList?.filter((m) => m.status === 'available' || m.status === 'offline').length || 0) - atStoreCount;
  const deliveringCount = motoboysList?.filter((m) => m.status === 'delivering').length || 0;
  const returningCount =
    motoboysList?.filter((m) => m.status === 'returning_to_store' || (m as any).isReturning).length || 0;

  const isStoreAddressConfigured = Boolean(
    origin.address &&
      origin.address.trim() !== '' &&
      origin.address !== 'Endereço não cadastrado' &&
      origin.address !== 'Aguardando cadastro em Configurar Loja'
  );

  return (
    <div className="relative w-full h-full min-h-[350px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
      <div ref={mapContainerRef} className="w-full h-full" />

      {isStoreAddressConfigured && stops.length === 0 && (!motoboysList || motoboysList.length === 0) && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-sm bg-slate-900/95 border border-slate-700 rounded-xl p-3 text-center shadow-xl backdrop-blur-md pointer-events-none">
          <p className="text-xs font-black text-white">Mapa pronto para a primeira entrega</p>
          <p className="text-[11px] text-slate-300 mt-0.5">A loja está centralizada. Pedidos e motoboys aparecerão aqui em tempo real.</p>
        </div>
      )}

      {/* Unconfigured Store Address Banner */}
      {!isStoreAddressConfigured && (
        <div className="absolute top-12 left-3 right-3 z-30 bg-slate-900/95 border-2 border-amber-500/80 rounded-xl p-2.5 shadow-2xl flex items-center gap-2.5 text-xs text-amber-200 backdrop-blur-md">
          <span className="p-1 rounded-lg bg-amber-500/20 text-amber-400 text-base shrink-0">📍</span>
          <div>
            <p className="font-extrabold text-white text-xs">Endereço da loja não cadastrado!</p>
            <p className="text-[11px] text-slate-300 font-medium">
              Cadastre o endereço da sua loja em <strong>Configurar Loja (⚙️)</strong> para que ela apareça no mapa.
            </p>
          </div>
        </div>
      )}

      {/* Top Left Uber/Linear Style Status Badge Overlay */}
      <div className="absolute top-3 left-3 z-20 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 flex items-center gap-3 font-extrabold shadow-lg">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block ring-2 ring-emerald-500/30"></span>
          <span>Na loja ({atStoreCount})</span>
        </div>
        {outsideAvailableCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-teal-400 rounded-full inline-block ring-2 ring-teal-400/30"></span>
            <span>Disponível fora ({outsideAvailableCount})</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-blue-500 rounded-full inline-block ring-2 ring-blue-500/30"></span>
          <span>Em rota ({deliveringCount})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-full inline-block ring-2 ring-amber-500/30"></span>
          <span>Voltando ({returningCount})</span>
        </div>
      </div>
    </div>
  );
};

