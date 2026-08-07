import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LocationPoint, Stop } from '../types';
import { Navigation, MapPin } from 'lucide-react';

interface RouteMapProps {
  origin: LocationPoint;
  stops: Stop[];
  selectedStopId?: string | null;
  onSelectStop?: (stop: Stop) => void;
  onUpdateStopStatus?: (stopId: string, status: Stop['status']) => void;
  motoboyName?: string;
  motoboyVehicle?: string;
  showMotoboyMarker?: boolean;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  origin,
  stops,
  selectedStopId,
  onSelectStop,
  onUpdateStopStatus,
  motoboyName,
  motoboyVehicle,
  showMotoboyMarker = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([origin.lat, origin.lng], 13);

      // Add clean OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      }).addTo(map);

      // Add zoom control top right
      L.control.zoom({ position: 'topright' }).addTo(map);

      markersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      // Keep map alive or cleanup if unmounted
    };
  }, []);

  // Update Markers and Polyline when origin/stops/selection change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    const bounds: [number, number][] = [[origin.lat, origin.lng]];

    // 1. Origin Depot Marker (Home / Base Icon)
    const originIcon = L.divIcon({
      className: 'custom-origin-pin',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute -inset-2 bg-indigo-500/20 rounded-full animate-ping"></div>
          <div class="w-10 h-10 bg-indigo-600 text-white rounded-2xl shadow-lg border-2 border-white flex items-center justify-center font-bold text-sm">
            🏠
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const originMarker = L.marker([origin.lat, origin.lng], { icon: originIcon })
      .bindPopup(`
        <div class="p-2 min-w-[200px]">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-indigo-100 text-indigo-700">Ponto de Partida</span>
          <h4 class="font-bold text-slate-800 text-sm mt-1">${origin.name || 'Depósito Central'}</h4>
          <p class="text-xs text-slate-500 mt-0.5">${origin.address}</p>
        </div>
      `);
    markersGroup.addLayer(originMarker);

    // 2. Stops Markers
    stops.forEach((stop, idx) => {
      bounds.push([stop.lat, stop.lng]);

      const isSelected = stop.id === selectedStopId;
      let bgColor = 'bg-slate-700 text-white';
      let borderCol = 'border-white';
      let badgeHtml = `${idx + 1}`;

      if (stop.status === 'delivered') {
        bgColor = 'bg-emerald-500 text-white';
        badgeHtml = '✓';
      } else if (stop.status === 'in_transit') {
        bgColor = 'bg-blue-600 text-white';
      } else if (stop.status === 'failed') {
        bgColor = 'bg-rose-500 text-white';
        badgeHtml = '✕';
      }

      const ringClass = isSelected ? 'ring-4 ring-indigo-500/40 scale-110 z-30' : '';

      const stopIcon = L.divIcon({
        className: 'custom-stop-pin',
        html: `
          <div class="relative flex items-center justify-center transition-all duration-200 ${ringClass}">
            <div class="w-9 h-9 ${bgColor} rounded-full shadow-md border-2 ${borderCol} flex items-center justify-center font-bold text-xs">
              ${badgeHtml}
            </div>
            ${
              stop.priority === 'high'
                ? '<span class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white"></span>'
                : ''
            }
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([stop.lat, stop.lng], { icon: stopIcon });

      marker.on('click', () => {
        if (onSelectStop) onSelectStop(stop);
      });

      marker.bindPopup(`
        <div class="p-2 min-w-[220px]">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="font-semibold text-xs text-indigo-600">Parada #${idx + 1}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded uppercase font-medium ${
              stop.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
              stop.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
              stop.status === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
            }">${
              stop.status === 'delivered' ? 'Entregue' :
              stop.status === 'in_transit' ? 'Em trânsito' :
              stop.status === 'failed' ? 'Não entregue' : 'Pendente'
            }</span>
          </div>
          <h4 class="font-bold text-slate-900 text-sm">${stop.title}</h4>
          <p class="text-xs text-slate-500 mt-0.5">${stop.address}</p>
          ${stop.recipientName ? `<p class="text-xs text-slate-600 mt-1">👤 ${stop.recipientName}</p>` : ''}
          <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
            <a href="https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes" target="_blank" class="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs font-semibold hover:bg-indigo-100 inline-block">
              Waze 🧭
            </a>
            <a href="https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}" target="_blank" class="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-semibold hover:bg-emerald-100 inline-block">
              Google Maps 🗺️
            </a>
          </div>
        </div>
      `);

      markersGroup.addLayer(marker);
    });

    // 3. Draw Motoboy Marker on Map if available
    if (stops.length > 0 && showMotoboyMarker) {
      const activeStop = stops.find((s) => s.status === 'in_transit') || stops[0];
      if (activeStop) {
        const motoboyLat = origin.lat + (activeStop.lat - origin.lat) * 0.55;
        const motoboyLng = origin.lng + (activeStop.lng - origin.lng) * 0.55;

        const motoboyIcon = L.divIcon({
          className: 'custom-motoboy-pin',
          html: `
            <div class="relative flex flex-col items-center justify-center">
              <div class="absolute -inset-2 bg-emerald-500/30 rounded-full animate-ping"></div>
              <div class="w-11 h-11 bg-slate-950 text-white rounded-2xl shadow-2xl border-2 border-emerald-400 flex items-center justify-center font-extrabold text-lg z-30">
                🛵
              </div>
              <div class="mt-1 bg-slate-950 text-emerald-300 px-2 py-0.5 rounded-md text-[10px] font-black uppercase whitespace-nowrap shadow-md border border-slate-800 z-30">
                ${motoboyName ? motoboyName.split(' ')[0] : 'Entregador'}
              </div>
            </div>
          `,
          iconSize: [44, 54],
          iconAnchor: [22, 27],
        });

        const motoboyMarker = L.marker([motoboyLat, motoboyLng], { icon: motoboyIcon })
          .bindPopup(`
            <div class="p-2.5 min-w-[200px]">
              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">🛵 Entregador em Rota</span>
              <h4 class="font-extrabold text-slate-900 text-sm mt-1">${motoboyName || 'Entregador Dedicado'}</h4>
              ${motoboyVehicle ? `<p class="text-xs text-slate-500 mt-0.5">${motoboyVehicle}</p>` : ''}
              <p class="text-xs text-emerald-700 font-bold mt-1">A caminho do destino 📍</p>
            </div>
          `);
        markersGroup.addLayer(motoboyMarker);
        bounds.push([motoboyLat, motoboyLng]);
      }
    }

    // 4. Draw Route Polyline connecting Origin -> Stop 1 -> Stop 2 -> ...
    if (stops.length > 0) {
      const routeCoords: [number, number][] = [
        [origin.lat, origin.lng],
        ...stops.map((s) => [s.lat, s.lng] as [number, number]),
      ];

      polylineRef.current = L.polyline(routeCoords, {
        color: '#4f46e5', // Indigo 600
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 8',
      }).addTo(map);

      // Fit map bounds smoothly
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [origin, stops, selectedStopId]);

  return (
    <div className="relative w-full h-full min-h-[350px] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-20 bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-slate-200/80 text-xs text-slate-700 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-3 h-3 bg-indigo-600 rounded-full inline-block"></span>
          <span>Partida</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-3 h-3 bg-slate-700 rounded-full inline-block"></span>
          <span>Pendente</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-3 h-3 bg-blue-600 rounded-full inline-block"></span>
          <span>Em Trânsito</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-3 h-3 bg-emerald-500 rounded-full inline-block"></span>
          <span>Entregue</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-3 h-3 bg-rose-500 rounded-full inline-block"></span>
          <span>Falha</span>
        </div>
      </div>
    </div>
  );
};
