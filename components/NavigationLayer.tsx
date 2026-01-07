
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMapEvents, CircleMarker, Tooltip, LayerGroup, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchNavigationData, NavPoint } from '../services/NavigationDataService';
import { Waypoint } from '../types';

interface NavigationLayerProps {
    onPointSelect?: (point: NavPoint) => void;
    waypoints?: Waypoint[];
    aircraftPosition?: [number, number];
}

export const NavigationLayer: React.FC<NavigationLayerProps> = ({ 
    onPointSelect, 
    waypoints = [],
    aircraftPosition
}) => {
    const map = useMap();
    const [points, setPoints] = useState<NavPoint[]>([]);
    const [zoom, setZoom] = useState(map.getZoom());
    const [isLocked, setIsLocked] = useState(true);
    
    // Referência para leitura imediata da trava
    const isLockedRef = useRef(isLocked);
    useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);

    // Lógica de Centralização Agressiva
    useEffect(() => {
        if (isLockedRef.current && aircraftPosition) {
            map.setView(aircraftPosition, map.getZoom(), { animate: true });
        }
    }, [aircraftPosition, map]);

    const handleUpdate = useCallback(async () => {
        if (map.getZoom() < 8) {
            if (points.length > 0) setPoints([]);
            return;
        }
        try {
            const bounds = map.getBounds();
            const data = await fetchNavigationData(bounds);
            setPoints(data);
        } catch (error) {
            console.error('Navigation Data Error:', error);
        }
    }, [map, points.length]);

    // EVENTOS: Mata o lock em qualquer interação
    useMapEvents({
        moveend: () => handleUpdate(),
        zoomend: () => setZoom(map.getZoom()),
        dragstart: () => setIsLocked(false),
        mousedown: () => setIsLocked(false),
        touchstart: () => setIsLocked(false),
        zoomstart: () => setIsLocked(false)
    });

    useEffect(() => { handleUpdate(); }, [handleUpdate]);

    const calculateTrueTrack = (start: Waypoint, end: Waypoint) => {
        const rad = Math.PI / 180;
        const y = Math.sin((end.lng - start.lng) * rad) * Math.cos(end.lat * rad);
        const x = Math.cos(start.lat * rad) * Math.sin(end.lat * rad) -
                  Math.sin(start.lat * rad) * Math.cos(end.lat * rad) * Math.cos((end.lng - start.lng) * rad);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    };

    const calculateDistance = (start: Waypoint, end: Waypoint) => {
        const R = 3440.065; 
        const rad = Math.PI / 180;
        const a = Math.sin(((end.lat - start.lat) * rad) / 2) ** 2 +
                  Math.cos(start.lat * rad) * Math.cos(end.lat * rad) * Math.sin(((end.lng - start.lng) * rad) / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    return (
        <>
            <LayerGroup>
                {/* ROTA */}
                {waypoints.length > 1 && (
                    <Polyline 
                        positions={waypoints.map(w => [w.lat, w.lng])} 
                        pathOptions={{ color: '#d946ef', weight: 4, opacity: 0.9 }} 
                    />
                )}

                {/* SETAS DECEA */}
                {zoom >= 8 && waypoints.slice(0, -1).map((start, i) => {
                    const end = waypoints[i + 1];
                    if (!start || !end) return null;

                    const trueTrack = calculateTrueTrack(start, end);
                    // IMPORTANTE: Busca a variação magnética oficial do objeto
                    const magVar = start.magneticVariation || 0; 
                    const magTrack = (trueTrack - magVar + 360) % 360;
                    const dist = calculateDistance(start, end);
                    const midLat = (start.lat + end.lat) / 2;
                    const midLng = (start.lng + end.lng) / 2;
                    const needsFlip = magTrack > 90 && magTrack < 270;

                    const deceaIcon = L.divIcon({
                        className: 'decea-arrow',
                        html: `
                            <div style="display: flex; align-items: center; justify-content: center; width: 140px; margin-left: -70px; margin-top: -15px;">
                                <div style="transform: rotate(${magTrack - 90}deg);">
                                    <div style="
                                        background: #d946ef; color: white; padding: 2px 10px; height: 26px;
                                        display: flex; align-items: center; border: 1.5px solid white;
                                        clip-path: polygon(0% 0%, 82% 0%, 100% 50%, 82% 100%, 0% 100%);
                                        min-width: 90px;
                                    ">
                                        <span style="font-weight: 900; font-size: 11px; transform: rotate(${needsFlip ? 180 : 0}deg);">
                                            ${magTrack.toFixed(0).padStart(3, '0')}°M ${dist.toFixed(0)}NM
                                        </span>
                                    </div>
                                </div>
                            </div>
                        `,
                        iconSize: [0, 0]
                    });

                    return <Marker key={`arrow-${i}`} position={[midLat, midLng]} icon={deceaIcon} interactive={false} />;
                })}

                {/* PONTOS WFS */}
                {zoom >= 8 && points.map(p => (
                    <CircleMarker key={`${p.type}-${p.id}`} center={[p.lat, p.lng]} radius={4} pathOptions={{ color: '#ffffff', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.9 }}>
                        <Tooltip direction="top" offset={[0, -10]} opacity={0.9}><div style={{ fontSize: '11px' }}><strong>{p.icao || p.name}</strong></div></Tooltip>
                    </CircleMarker>
                ))}
            </LayerGroup>

            {/* BOTÃO LOCK */}
            <div 
                style={{
                    position: 'fixed', bottom: '30px', right: '30px', zIndex: 1000,
                    background: isLocked ? '#d946ef' : 'rgba(15, 23, 42, 0.8)',
                    color: 'white', width: '55px', height: '55px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', border: '2px solid white', boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                }} 
                onClick={() => setIsLocked(!isLocked)}
            >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    {isLocked ? (
                        <>
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="3" fill="white" />
                        </>
                    ) : (
                        <path d="M1 1l22 22M12 2a10 10 0 0 1 10 10" />
                    )}
                </svg>
            </div>
        </>
    );
};