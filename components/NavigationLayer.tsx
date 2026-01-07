
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
    
    // REFERÊNCIA DE CONTROLE ABSOLUTO
    // Usamos um Ref porque ele não é resetado por re-renderizações do componente pai
    const isLockedRef = useRef(true);

    // Sincroniza o estado visual com a referência de controle
    const toggleLock = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const nextState = !isLocked;
        isLockedRef.current = nextState;
        setIsLocked(nextState);
        console.log("Sistema de Travamento:", nextState ? "ARMADO" : "DESATIVADO");
    };

    // 1. LÓGICA DE MOVIMENTAÇÃO (BLINDADA)
    useEffect(() => {
        // Se a referência diz que está destravado, saímos da função IMEDIATAMENTE
        if (!isLockedRef.current) return;

        if (aircraftPosition) {
            // Usamos panTo com duração zero para uma resposta instantânea e sem loop
            map.panTo(aircraftPosition, { animate: false });
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
            console.error('Erro de Dados Nav:', error);
        }
    }, [map, points.length]);

    // 2. EVENTOS: Se o usuário tocar no mapa, ele DEVE destravar
    useMapEvents({
        moveend: () => handleUpdate(),
        zoomend: () => setZoom(map.getZoom()),
        dragstart: () => {
            isLockedRef.current = false;
            setIsLocked(false);
        },
        touchstart: () => {
            isLockedRef.current = false;
            setIsLocked(false);
        }
    });

    useEffect(() => { handleUpdate(); }, [handleUpdate]);

    // Funções de Cálculo Geodésico
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

                {/* SETAS DE RUMO (ESTILO DECEA) */}
                {zoom >= 8 && waypoints.slice(0, -1).map((start, i) => {
                    const end = waypoints[i + 1];
                    if (!start || !end) return null;

                    const trueTrack = calculateTrueTrack(start, end);
                    // Aqui pegaremos o dado exato da sua API
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
            </LayerGroup>

            {/* BOTÃO DE LOCK - POSICIONAMENTO FIXO FORA DO MAPA */}
            <div 
                style={{
                    position: 'fixed',
                    bottom: '40px',
                    right: '40px',
                    zIndex: 99999, // Garantia total de clique
                    background: isLocked ? '#d946ef' : '#1e293b',
                    color: 'white',
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    border: '3px solid white',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                }} 
                onClick={toggleLock}
            >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    {isLocked ? (
                        <>
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="white" fillOpacity="0.3"/>
                            <circle cx="12" cy="12" r="3" fill="white" />
                        </>
                    ) : (
                        <path d="M18 6L6 18M6 6l12 12" />
                    )}
                </svg>
            </div>
        </>
    );
};