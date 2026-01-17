
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

                {/* 2. POINTED DIRECTIONAL ARROWS (NexAtlas style) */}
                {waypoints.slice(0, -1).map((start, i) => {
                    const end = waypoints[i + 1];
                    if (!start || !end) return null;

                    const trueTrack = calculateTrueTrack(start, end);
                    
                    // Calculate segment length in pixels
                    const startPoint = map.latLngToContainerPoint([start.lat, start.lng]);
                    const endPoint = map.latLngToContainerPoint([end.lat, end.lng]);
                    const segmentPixelLength = Math.sqrt(
                        Math.pow(endPoint.x - startPoint.x, 2) + 
                        Math.pow(endPoint.y - startPoint.y, 2)
                    );
                    
                    // Arrow dimensions - proportional to segment
                    const arrowWidth = 8;
                    const arrowLength = 16;
                    
                    // STRICT: Only show arrow if segment is at least 4x the arrow length
                    const minSegmentLength = arrowLength * 4;
                    if (segmentPixelLength < minSegmentLength) return null;
                    
                    // Position arrow exactly at center of segment
                    const arrowLat = start.lat + (end.lat - start.lat) * 0.5;
                    const arrowLng = start.lng + (end.lng - start.lng) * 0.5;

                    // NexAtlas style: pointed arrow shape using SVG polygon
                    // Arrow points RIGHT by default, then rotated to trueTrack
                    const arrowIcon = L.divIcon({
                        className: 'route-direction-arrow',
                        html: `
                            <svg 
                                width="${arrowLength}" 
                                height="${arrowWidth}" 
                                viewBox="0 0 ${arrowLength} ${arrowWidth}"
                                style="
                                    position: absolute;
                                    transform: translate(-50%, -50%) rotate(${trueTrack - 90}deg);
                                    transform-origin: center center;
                                    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
                                "
                            >
                                <polygon 
                                    points="0,${arrowWidth * 0.2} ${arrowLength * 0.7},${arrowWidth * 0.2} ${arrowLength},${arrowWidth * 0.5} ${arrowLength * 0.7},${arrowWidth * 0.8} 0,${arrowWidth * 0.8}"
                                    fill="#047857"
                                    stroke="#fff"
                                    stroke-width="0.5"
                                />
                            </svg>
                        `,
                        iconSize: [0, 0]
                    });

                    return <Marker key={`arrow-${i}`} position={[arrowLat, arrowLng]} icon={arrowIcon} interactive={false} zIndexOffset={2000} />;
                })}

                {/* 3. TRACK/DISTANCE LABELS - Only show at zoom >= 8 */}
                {zoom >= 8 && waypoints.slice(0, -1).map((start, i) => {
                    const end = waypoints[i + 1];
                    if (!start || !end) return null;

                    const trueTrack = calculateTrueTrack(start, end);
                    const magVar = start.magneticVariation || 0; 
                    const magTrack = (trueTrack - magVar + 360) % 360;
                    const dist = calculateDistance(start, end);
                    
                    // Position label at 35% along the segment
                    const labelLat = start.lat + (end.lat - start.lat) * 0.35;
                    const labelLng = start.lng + (end.lng - start.lng) * 0.35;
                    
                    const needsFlip = trueTrack > 90 && trueTrack < 270;
                    const labelRotation = needsFlip ? trueTrack + 180 : trueTrack;

                    const labelIcon = L.divIcon({
                        className: 'route-label',
                        html: `
                            <div style="
                                position: absolute;
                                transform: translate(-50%, -50%) rotate(${labelRotation - 90}deg);
                                transform-origin: center center;
                                background: rgba(4, 120, 87, 0.95);
                                color: white;
                                padding: 2px 6px;
                                font-size: 10px;
                                font-weight: 700;
                                font-family: sans-serif;
                                white-space: nowrap;
                                border-radius: 3px;
                                border: 1px solid rgba(255,255,255,0.5);
                                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                            ">${magTrack.toFixed(0).padStart(3, '0')}° ${dist.toFixed(0)}nm</div>
                        `,
                        iconSize: [0, 0]
                    });

                    return <Marker key={`label-${i}`} position={[labelLat, labelLng]} icon={labelIcon} interactive={false} zIndexOffset={1999} />;
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