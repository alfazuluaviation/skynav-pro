
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
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(map.getZoom());

  // 1. Função de busca de dados (WFS)
  const handleUpdate = useCallback(async () => {
    // Só busca se o zoom for maior ou igual a 8
    if (map.getZoom() < 8) {
      if (points.length > 0) setPoints([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const bounds = map.getBounds();
      const data = await fetchNavigationData(bounds);
      setPoints(data);
    } catch (e) {
      console.error('Navigation Data Error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [map, points.length]);

  // 2. Ouvinte de eventos do mapa
  const mapEvents = useMapEvents({
    moveend: () => {
      handleUpdate();
    },
    zoomend: () => {
      const currentZoom = mapEvents.getZoom();
      setZoom(currentZoom);
    }
  });

  // 3. Carregamento inicial
  useEffect(() => {
    handleUpdate();
  }, [handleUpdate]);

  const routePositions = waypoints.map(w => [w.lat, w.lng] as [number, number]);

  return (
    <LayerGroup>
      {/* 1. LINHA DA ROTA (MAGENTA) */}
      {routePositions.length > 1 && (
        <Polyline
          positions={routePositions}
          pathOptions={{
            color: '#d946ef',
            weight: 5,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}

      {/* 2. SETAS/PILLS DE INFORMAÇÃO DA ROTA (ZOOM > 9) */}
      {zoom > 9 && flightSegments.map((segment, i) => {
        const start = waypoints[i];
        const end = waypoints[i + 1];
        if (!start || !end) return null;

        const midLat = (start.lat + end.lat) / 2;
        const midLng = (start.lng + end.lng) / 2;
        const rotation = segment.track;
        
        // Mantém o texto em pé (leitura humana) entre 90 e 270 graus
        const needsFlip = rotation > 90 && rotation < 270;

        const arrowIcon = L.divIcon({
          className: 'bg-transparent border-none',
          html: `
            <div style="transform: translate(-50%, -50%) rotate(${rotation - 90}deg); display: flex; align-items: center; justify-content: center;">
              <div style="
                background: #d946ef; color: white; padding: 4px 12px; border-radius: 20px; 
                display: flex; align-items: center; gap: 8px; border: 2px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.4); white-space: nowrap;
                transform: rotate(${needsFlip ? 180 : 0}deg);
              ">
                <span style="display: flex; transform: rotate(${needsFlip ? 180 : 0}deg);">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                    <path d="M21 12l-18 9v-18z"/>
                  </svg>
                </span>
                <span style="font-weight: 900; font-size: 12px; font-family: sans-serif; letter-spacing: 0.5px;">
                  ${rotation.toFixed(0).padStart(3, '0')}° | ${segment.distance.toFixed(0)}NM
                </span>
              </div>
            </div>
          `,
          iconSize: [0, 0]
        });

        return (
          <Marker 
            key={`pill-${i}-${start.id}`} 
            position={[midLat, midLng]} 
            icon={arrowIcon} 
            interactive={false} 
            zIndexOffset={1000} 
          />
        );
      })}

      {/* 3. PONTOS DE NAVEGAÇÃO (AERÓDROMOS, VOR, FIX) - ZOOM > 8 */}
      {zoom > 8 && points.map(p => {
        let color = '#3b82f6'; // Azul padrão
        let radius = 6;

        if (p.type === 'vor') { color = '#f97316'; radius = 4; } 
        else if (p.type === 'ndb') { color = '#eab308'; radius = 4; } 
        else if (p.type === 'fix') { color = '#a855f7'; radius = 3; }

        return (
          <CircleMarker
            key={`${p.type}-${p.id}`}
            center={[p.lat, p.lng]}
            radius={radius}
            pathOptions={{
              color: '#ffffff',
              weight: 1,
              fillColor: color,
              fillOpacity: 0.8
            }}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                if (onPointSelect) onPointSelect(p);
              }
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.9} className="custom-tooltip">
              <div className="flex flex-col items-center">
                <span className="font-bold text-xs">{p.icao || p.name}</span>
                {p.icao !== p.name && (
                  <span className="text-[9px] text-slate-400 max-w-[100px] truncate">{p.name}</span>
                )}
                <span className="text-[9px] text-slate-500">{p.type.toUpperCase()}</span>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </LayerGroup>
  );
};

export default NavigationLayer;