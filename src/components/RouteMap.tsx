import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LocationPoint, Stop, Motoboy } from '../types';

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

    const bounds: [number, number][] = [[origin.lat, origin.lng]];

    // 1. Store Marker (Sleek Dark Pill)
    const originIcon = L.divIcon({
      className: 'custom-origin-pin z-50',
      html: `
        <div class="relative flex flex-col items-center justify-center">
          <div class="bg-slate-900/95 text-emerald-400 px-3 py-1 rounded-xl shadow-2xl border border-emerald-500/70 flex items-center gap-1.5 font-extrabold text-xs z-50">
            <span class="text-sm">🏪</span>
            <span class="tracking-wide uppercase text-[11px] text-white">${origin.name || 'Hope Burger'}</span>
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

    // 2. Stops Markers
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
            <div class="mt-0.5 bg-slate-900/90 text-slate-200 px-1.5 py-0.5 rounded text-[9px] font-extrabold whitespace-nowrap border border-slate-700 shadow-sm z-30">
              ${stop.neighborhood || 'Centro'}
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

    // 3. Draw Motoboy Markers on Map (Sleek Circular Avatar Pin)
    if (motoboysList && motoboysList.length > 0) {
      motoboysList.forEach((mb, idx) => {
        let mbLat = mb.currentLat || origin.lat;
        let mbLng = mb.currentLng || origin.lng;
        const isReturning = mb.status === 'returning_to_store' || (mb as any).isReturning;
        const isDelivering = mb.status === 'delivering';
        const isAvailable = mb.status === 'available' || mb.status === 'offline';

        // Check if motoboy has a real distinct GPS location set
        const hasCustomGps =
          typeof mb.currentLat === 'number' &&
          typeof mb.currentLng === 'number' &&
          mb.currentLat !== 0 &&
          mb.currentLng !== 0 &&
          (Math.abs(mb.currentLat - origin.lat) > 0.0003 || Math.abs(mb.currentLng - origin.lng) > 0.0003);

        // Fallback offset at store ONLY if motoboy does NOT have a distinct live GPS position
        if (!hasCustomGps && isAvailable) {
          mbLat = origin.lat + (idx * 0.00015);
          mbLng = origin.lng + (idx * 0.00015);
        } else if (!hasCustomGps && isReturning) {
          mbLat = origin.lat + 0.0075;
          mbLng = origin.lng - 0.0120;
        }

        const initial = mb.name ? mb.name.charAt(0).toUpperCase() : 'M';
        const ringColor = isReturning
          ? 'border-amber-400 text-amber-300'
          : isDelivering
          ? 'border-blue-400 text-blue-300'
          : 'border-emerald-400 text-emerald-300';

        const statusBadgeText = isReturning ? 'Voltando' : isDelivering ? 'Em rota' : 'Na loja';
        const badgeBg = isReturning
          ? 'bg-amber-950/90 text-amber-300 border-amber-600/50'
          : isDelivering
          ? 'bg-slate-950/90 text-blue-300 border-blue-600/50'
          : 'bg-slate-950/90 text-emerald-300 border-emerald-600/50';

        const motoboyIcon = L.divIcon({
          className: 'custom-motoboy-pin z-40',
          html: `
            <div class="relative flex flex-col items-center justify-center">
              ${isReturning ? '<div class="absolute -inset-1.5 bg-amber-500/30 rounded-full animate-ping"></div>' : ''}
              <div class="w-8 h-8 rounded-full bg-slate-900 border-2 ${ringColor} flex items-center justify-center font-black text-xs shadow-xl z-30">
                ${initial}
              </div>
              <div class="mt-0.5 ${badgeBg} px-2 py-0.5 rounded-md text-[10px] font-black uppercase whitespace-nowrap shadow-md border z-30">
                ${mb.name.split(' ')[0]} • ${statusBadgeText}
              </div>
            </div>
          `,
          iconSize: [80, 50],
          iconAnchor: [40, 25],
        });

        const mbMarker = L.marker([mbLat, mbLng], { icon: motoboyIcon }).bindPopup(`
          <div class="p-2 min-w-[200px] text-slate-100">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="font-extrabold text-xs text-white">${mb.name}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-black uppercase ${
                isReturning ? 'bg-amber-950 text-amber-300 border border-amber-700' : isDelivering ? 'bg-blue-950 text-blue-300 border border-blue-700' : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
              }">${isReturning ? 'Voltando à Loja' : isDelivering ? 'Em Rota' : 'Na Loja'}</span>
            </div>
            <p class="text-xs text-slate-300">${mb.vehicleModel || 'Moto'} • ${mb.plate || ''}</p>
          </div>
        `);

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
      } else if (stops.length > 0) {
        const activeStop = stops.find((s) => s.status === 'in_transit') || stops[0];
        if (activeStop) {
          mLat = activeStop.lat;
          mLng = activeStop.lng;
        }
      }

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

    // 4. Draw Route Polyline ONLY IF an active route/delivery is happening
    const activeStops = stops.filter((s) => s.status === 'in_transit');

    if (activeStops.length > 0) {
      const routeCoords: [number, number][] = [
        [origin.lat, origin.lng],
        ...activeStops.map((s) => [s.lat, s.lng] as [number, number]),
      ];

      polylineRef.current = L.polyline(routeCoords, {
        color: '#6366f1', // Sleek Indigo
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 8',
      }).addTo(map);
    }

    // 5. Smoothly fit map bounds to fit store + stops + motoboys
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else {
      map.setView([origin.lat, origin.lng], 15, { animate: true });
    }
  }, [origin, stops, selectedStopId, motoboysList, showMotoboyMarker, motoboyLat, motoboyLng]);

  // Counts for top status chip bar
  const availableCount = motoboysList?.filter((m) => m.status === 'available' || m.status === 'offline').length || 0;
  const deliveringCount = motoboysList?.filter((m) => m.status === 'delivering').length || 0;
  const returningCount = motoboysList?.filter((m) => m.status === 'returning_to_store' || (m as any).isReturning).length || 0;

  return (
    <div className="relative w-full h-full min-h-[350px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Left Uber/Linear Style Status Badge Overlay */}
      <div className="absolute top-3 left-3 z-20 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 flex items-center gap-3 font-extrabold shadow-lg">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block ring-2 ring-emerald-500/30"></span>
          <span>Na loja ({availableCount})</span>
        </div>
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
