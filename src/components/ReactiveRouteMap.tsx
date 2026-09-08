import React from 'react';
import { LocationPoint } from '../types';
import { RouteMap } from './RouteMap';

interface ReactiveRouteMapProps {
  origin: LocationPoint;
  [key: string]: any;
}

/** Remount Leaflet when the saved store location changes. */
export const ReactiveRouteMap: React.FC<ReactiveRouteMapProps> = (props) => {
  const { origin } = props;
  const mapKey = [
    Number(origin?.lat || 0).toFixed(6),
    Number(origin?.lng || 0).toFixed(6),
    origin?.address || '',
    origin?.name || '',
  ].join('|');

  return <RouteMap key={mapKey} {...(props as any)} />;
};

export default ReactiveRouteMap;
