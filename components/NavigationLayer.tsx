
import React, { useState, useEffect, useCallback } from 'react';
import { useMapEvents, CircleMarker, Tooltip, LayerGroup, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchNavigationData, NavPoint } from '../services/NavigationDataService';
import { FlightSegment, Waypoint } from '../types';

interface NavigationLayerProps {
    onPointSelect?: (point: NavPoint) => void;
    waypoints?: Waypoint[];
    flightSegments?: FlightSegment[];
}

export const NavigationLayer: React.FC<NavigationLayerProps> = ({ onPointSelect, waypoints = [], flightSegments = [] }) => {
  const map = useMap(); 
  const [points, setPoints] = useState<NavPoint[]>([]);
  const [zoom, setZoom] = useState(map.getZoom());

  const handleUpdate = useCallback(async () => {
    if (map.getZoom() < 8) {
      if (points.length > 0) setPoints([]);
      return;
    }
    try {
      const bounds = map.getBounds();
      const data = await fetchNavigationData(bounds);
      setPoints(data);
    } catch (e) {
      console.error('Navigation Data Error:', e);
    }
  }, [map, points.length]);

  const mapEvents = useMapEvents({
    moveend: () => handleUpdate(),
    zoomend: () => setZoom(mapEvents.getZoom())
  });

  useEffect(() => {
    handleUpdate();
  }, [handleUpdate]);

  const routePositions = waypoints.map(w => [w.lat, w.lng] as [number, number]);

  return (
    <LayerGroup>
      {/* 1. LINHA DA ROTA */}
      {routePositions.length > 1 && (
        <Polyline positions={routePositions} pathOptions={{ color: '#d946ef', weight: 5, lineCap: 'round' }} />
      )}

      {/* 2. SETAS MAGENTA (PILLS) - CORREÇÃO ITEM 2 */}
      {zoom > 9 && flightSegments.map((segment, i) => {
        const start = waypoints[i];
        const end = waypoints[i + 1];
        if (!start || !end) return null;

        const midLat = (start.lat + end.lat) / 2;
        const midLng = (start.lng + end.lng) / 2;
        const rotation = segment.track;
        const needsFlip = rotation > 90 && rotation < 270;

        const arrowIcon = L.divIcon({
          className: 'custom-pill-icon',
          html: `
            <div style="position: relative; width: 120px; margin-left: -60px; margin-top: -15px; pointer-events: none;">
              <div style="transform: rotate(${rotation - 90}deg); display: flex; justify-content: center;">
                <div style="
                  background: #d946ef; color: white; padding: 4px 10px; border-radius: 20px; 
                  display: flex; align-items: center; gap: 6px; border: 2px solid white;
                  box-shadow: 0 2px 5px rgba(0,0,0,0.5); transform: rotate(${needsFlip ? 180 : 0}deg);
                ">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white" style="transform: rotate(${needsFlip ? 180 : 0}deg);">
                    <path d="M21 12l-18 9v-18z"/>
                  </svg>
                  <span style="font-weight: 900; font-size: 11px; white-space: nowrap;">
                    ${rotation.toFixed(0).padStart(3, '0')}° | ${segment.distance.toFixed(0)}NM
                  </span>
                </div>
              </div>
            </div>
          `,
          iconSize: [0, 0]
        });

        return <Marker key={`pill-${i}`} position={[midLat, midLng]} icon={arrowIcon} interactive={false} />;
      })}

      {/* 3. PONTOS DE NAVEGAÇÃO */}
      {zoom > 8 && points.map(p => (
        <CircleMarker
          key={`${p.type}-${p.id}`}
          center={[p.lat, p.lng]}
          radius={p.type === 'vor' ? 4 : 3}
          pathOptions={{ color: '#ffffff', weight: 1, fillColor: p.type === 'vor' ? '#f97316' : '#a855f7', fillOpacity: 0.8 }}
          eventHandlers={{ click: () => onPointSelect?.(p) }}
        >
          <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
            <div className="text-center"><strong>{p.icao || p.name}</strong></div>
          </Tooltip>
        </CircleMarker>
      ))}
    </LayerGroup>
  );
};
export default NavigationLayer;