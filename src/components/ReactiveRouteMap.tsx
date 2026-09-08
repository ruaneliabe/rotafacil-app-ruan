import React from 'react';
import { LocationPoint, Motoboy, Stop } from '../types';
import { RouteMap } from './RouteMap';

interface ReactiveRouteMapProps {
  origin: LocationPoint;
  stops: Stop[];
  selectedStopId?: string | null;
  onSelectStop?: (stop: Stop) => void;
  motoboysList?: Motoboy[];
  selectedMotoboyId?: string | null;
  onSelectMotoboy?: (motoboyId: string | null) => void;
}

/**
 * Leaflet keeps internal state after the first mount. When the store address
 * changes we deliberately remount the map so the store marker, center and
 * bounds immediately use the new coordinates without requiring a page reload.
 */
export const ReactiveRouteMap: React.FC<ReactiveRouteMapProps> = (props) => {
  const { origin } = props;
  const mapKey = [
    Number(origin?.lat || 0).toFixed(6),
    Number(origin?.lng || 0).toFixed(6),
    origin?.address || '',
    origin?.name || '',
  ].join('|');

  return <RouteMap key={mapKey} {...props} />;
};

export default ReactiveRouteMap;
