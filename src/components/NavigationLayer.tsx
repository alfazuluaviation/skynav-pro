
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMapEvents, CircleMarker, Tooltip, LayerGroup, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchNavigationData, NavPoint } from '../services/NavigationDataService';
import { Waypoint } from '../types';
import { DraggableRoute } from './DraggableRoute';

interface NavigationLayerProps {
    onPointSelect?: (point: NavPoint) => void;
    waypoints?: Waypoint[];
    aircraftPosition?: [number, number];
    hideLockButton?: boolean;
    onInsertWaypoint?: (waypoint: Waypoint, insertAfterIndex: number) => void;
}

export const NavigationLayer: React.FC<NavigationLayerProps> = ({ 
    onPointSelect, 
    waypoints = [],
    aircraftPosition,
    hideLockButton = false,
    onInsertWaypoint
}) => {
    const map = useMap();
    const [points, setPoints] = useState<NavPoint[]>([]);
    const [zoom, setZoom] = useState(map.getZoom());
    
    // Map starts UNLOCKED (free to drag) - user can lock to follow aircraft position
    const [isLocked, setIsLocked] = useState(false);
    const lockRef = useRef(false);

    const toggleLock = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const nextState = !isLocked;
        lockRef.current = nextState;
        setIsLocked(nextState);
        console.log(`[SkyFPL] Map Lock Status: ${nextState ? 'ENGAGED' : 'DISENGAGED'}`);
    };

    // MISSION CRITICAL: Aircraft tracking logic
    useEffect(() => {
        // If the pilot unlocked the map, we ignore any incoming position updates (Transponder)
        if (!lockRef.current) return;

        if (aircraftPosition) {
            // Instant snap to position to avoid visual rubber-banding
            map.setView(aircraftPosition, map.getZoom(), { animate: false });
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

    useMapEvents({
        moveend: () => handleUpdate(),
        zoomend: () => setZoom(map.getZoom())
    });

    useEffect(() => { handleUpdate(); }, [handleUpdate]);

    // GEODESIC CALCULATIONS
    const calculateTrueTrack = (start: Waypoint, end: Waypoint) => {
        const rad = Math.PI / 180;
        const y = Math.sin((end.lng - start.lng) * rad) * Math.cos(end.lat * rad);
        const x = Math.cos(start.lat * rad) * Math.sin(end.lat * rad) -
                  Math.sin(start.lat * rad) * Math.cos(end.lat * rad) * Math.cos((end.lng - start.lng) * rad);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    };

    const calculateDistance = (start: Waypoint, end: Waypoint) => {
        const R = 3440.065; // Nautical Miles
        const rad = Math.PI / 180;
        const a = Math.sin(((end.lat - start.lat) * rad) / 2) ** 2 +
                  Math.cos(start.lat * rad) * Math.cos(end.lat * rad) * Math.sin(((end.lng - start.lng) * rad) / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    return (
        <>
            <LayerGroup>
                {/* 1. DRAGGABLE ROUTE LINE */}
                {waypoints.length > 1 && onInsertWaypoint && (
                    <DraggableRoute
                        waypoints={waypoints}
                        onInsertWaypoint={onInsertWaypoint}
                    />
                )}
                
                {/* Fallback: Static route line when no insert handler */}
                {waypoints.length > 1 && !onInsertWaypoint && (
                    <Polyline 
                        positions={waypoints.map(w => [w.lat, w.lng])} 
                        pathOptions={{ color: '#d946ef', weight: 4, opacity: 0.9 }} 
                    />
                )}

                {/* 2. ARROW-SHAPED LABELS (NexAtlas style - single pentagon shape) */}
                {waypoints.slice(0, -1).map((start, i) => {
                    const end = waypoints[i + 1];
                    if (!start || !end) return null;

                    const trueTrack = calculateTrueTrack(start, end);
                    const magVar = start.magneticVariation || 0; 
                    const magTrack = (trueTrack - magVar + 360) % 360;
                    const dist = calculateDistance(start, end);
                    
                    // Calculate segment length in pixels
                    const startPoint = map.latLngToContainerPoint([start.lat, start.lng]);
                    const endPoint = map.latLngToContainerPoint([end.lat, end.lng]);
                    const segmentPixelLength = Math.sqrt(
                        Math.pow(endPoint.x - startPoint.x, 2) + 
                        Math.pow(endPoint.y - startPoint.y, 2)
                    );
                    
                    // Only show label if segment is long enough
                    const minSegmentLength = 80;
                    if (segmentPixelLength < minSegmentLength) return null;
                    
                    // Position label at CENTER of segment
                    const labelLat = start.lat + (end.lat - start.lat) * 0.5;
                    const labelLng = start.lng + (end.lng - start.lng) * 0.5;
                    
                    // Flip text if facing backwards (keep readable)
                    const needsFlip = trueTrack > 90 && trueTrack < 270;
                    const labelRotation = needsFlip ? trueTrack + 180 : trueTrack;
                    
                    const text = `${magTrack.toFixed(0).padStart(3, '0')}° ${dist.toFixed(0)}nm`;
                    
                    // Arrow shape dimensions
                    const width = 72;
                    const height = 22;
                    const arrowTip = 10;
                    
                    // Pentagon arrow shape: flat left, pointed right
                    // If flipped, mirror the shape
                    const arrowOnRight = !needsFlip;
                    
                    // Points for pentagon arrow shape
                    const points = arrowOnRight
                        ? `0,0 ${width - arrowTip},0 ${width},${height / 2} ${width - arrowTip},${height} 0,${height}`
                        : `${arrowTip},0 ${width},0 ${width},${height} ${arrowTip},${height} 0,${height / 2}`;

                    const labelIcon = L.divIcon({
                        className: 'route-arrow-label',
                        html: `
                            <svg 
                                width="${width}" 
                                height="${height}" 
                                viewBox="0 0 ${width} ${height}"
                                style="
                                    position: absolute;
                                    transform: translate(-50%, -50%) rotate(${labelRotation - 90}deg);
                                    transform-origin: center center;
                                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
                                "
                            >
                                <polygon 
                                    points="${points}"
                                    fill="#047857"
                                    stroke="rgba(255,255,255,0.7)"
                                    stroke-width="1"
                                />
                                <text 
                                    x="${width / 2}" 
                                    y="${height / 2 + 1}" 
                                    text-anchor="middle" 
                                    dominant-baseline="middle"
                                    fill="white"
                                    font-size="11"
                                    font-weight="700"
                                    font-family="Arial, sans-serif"
                                >${text}</text>
                            </svg>
                        `,
                        iconSize: [0, 0]
                    });

                    return <Marker key={`arrow-label-${i}`} position={[labelLat, labelLng]} icon={labelIcon} interactive={false} zIndexOffset={2000} />;
                })}

                {/* 3. NAVIGATION DATA POINTS (WFS) */}
                {zoom >= 8 && points.map(p => (
                    <CircleMarker key={`${p.type}-${p.id}`} center={[p.lat, p.lng]} radius={4} pathOptions={{ color: '#ffffff', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.9 }}>
                        <Tooltip direction="top" offset={[0, -10]} opacity={0.9}><div style={{ fontSize: '11px' }}><strong>{p.icao || p.name}</strong></div></Tooltip>
                    </CircleMarker>
                ))}
            </LayerGroup>

            {/* ARMOR CONTROL: MAP LOCK TOGGLE - Hidden on mobile when plan panel is open */}
            <div 
                className={hideLockButton ? 'hidden md:flex' : 'flex'}
                style={{
                    position: 'fixed', bottom: '40px', right: '40px', zIndex: 99999,
                    background: isLocked ? '#d946ef' : 'rgba(15, 23, 42, 0.9)',
                    color: 'white', width: '64px', height: '64px', borderRadius: '50%',
                    alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', border: '3px solid white', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }} 
                onClick={toggleLock}
            >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    {isLocked ? (
                        <>
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="white" fillOpacity="0.3"/>
                            <circle cx="12" cy="12" r="3" fill="white" />
                        </>
                    ) : (
                        <path d="M21 21l-18-18M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    )}
                </svg>
            </div>
        </>
    );
};

export default NavigationLayer;