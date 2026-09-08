import React, { useMemo } from 'react';
import { LocationPoint } from '../types';
import { RouteMap } from './RouteMap';

interface ReactiveRouteMapProps {
  origin: LocationPoint;
  stops?: any[];
  selectedStopId?: string | null;
  [key: string]: any;
}

const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earth = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Keeps Leaflet reactive to store changes and protects the operational map from
 * bad/outlier coordinates when many real orders arrive at once.
 */
export const ReactiveRouteMap: React.FC<ReactiveRouteMapProps> = (props) => {
  const { origin, stops = [], selectedStopId } = props;
  const originLat = Number(origin?.lat || 0);
  const originLng = Number(origin?.lng || 0);

  const operationalStops = useMemo(() => {
    if (!Number.isFinite(originLat) || !Number.isFinite(originLng) || originLat === 0 || originLng === 0) {
      return stops;
    }

    const valid = stops.filter((stop: any) => {
      const lat = Number(stop?.lat);
      const lng = Number(stop?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return false;

      // A selected order must always remain visible/focusable, even when it is
      // legitimately farther away than the normal delivery area.
      if (selectedStopId && stop?.id === selectedStopId) return true;

      // At high volume, one malformed/geocoded coordinate used to pull the
      // entire map tens of kilometres away. Keep the overview inside a sane
      // Blumenau delivery radius; clicking a specific order still focuses it.
      const km = distanceKm(originLat, originLng, lat, lng);
      return km <= 18;
    });

    return valid;
  }, [stops, selectedStopId, originLat, originLng]);

  const mapKey = [
    originLat.toFixed(6),
    originLng.toFixed(6),
    origin?.address || '',
    origin?.name || '',
  ].join('|');

  return (
    <RouteMap
      key={mapKey}
      {...(props as any)}
      stops={operationalStops}
    />
  );
};

export default ReactiveRouteMap;
