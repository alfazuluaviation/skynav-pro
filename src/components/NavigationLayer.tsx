
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMapEvents, Tooltip, LayerGroup, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchNavigationData, NavPoint } from '../services/NavigationDataService';
import { Waypoint } from '../../types';
import { DraggableRoute } from './DraggableRoute';
import { getMagneticDeclination, applyMagneticVariation } from '../utils/geoUtils';
import { getAerodromeIconHTML, getIconSize } from './AerodromeIcons';
import { PointVisibility } from './LayersMenu';
import { VorRadialLine } from './VorRadialLine';

interface NavigationLayerProps {
    onPointSelect?: (point: NavPoint) => void;
    waypoints?: Waypoint[];
    aircraftPosition?: [number, number];
    hideLockButton?: boolean;
    onInsertWaypoint?: (waypoint: Waypoint, insertAfterIndex: number) => void;
    pointVisibility?: PointVisibility;
}

export const NavigationLayer: React.FC<NavigationLayerProps> = ({ 
    onPointSelect, 
    waypoints = [],
    aircraftPosition,
    hideLockButton = false,
    onInsertWaypoint,
    pointVisibility = { waypoints: true, vorNdb: true, aerodromes: true, heliports: true, userFixes: true }
}) => {
    const map = useMap();
    const [points, setPoints] = useState<NavPoint[]>([]);
    const [zoom, setZoom] = useState(map.getZoom());
    
    // VOR Radial tracking state
    const [selectedVor, setSelectedVor] = useState<NavPoint | null>(null);
    
    // Map starts UNLOCKED (free to drag) - user can lock to follow aircraft position
    const [isLocked, setIsLocked] = useState(false);
    const lockRef = useRef(false);
    
    // Track if flight plan is expanded (to hide lock button)
    const [isFlightPlanExpanded, setIsFlightPlanExpanded] = useState(false);
    
    // Listen for flight plan expanded changes
    useEffect(() => {
        const handleExpandedChange = (e: CustomEvent<{ expanded: boolean }>) => {
            setIsFlightPlanExpanded(e.detail.expanded);
        };
        window.addEventListener('flightPlanExpandedChange', handleExpandedChange as EventListener);
        return () => {
            window.removeEventListener('flightPlanExpandedChange', handleExpandedChange as EventListener);
        };
    }, []);

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
                    const dist = calculateDistance(start, end);
                    
                    // Calculate magnetic declination at departure point (aviation standard)
                    const magVar = getMagneticDeclination(start.lat, start.lng);
                    const magTrack = applyMagneticVariation(trueTrack, magVar);
                    
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

                {/* 3. NAVIGATION DATA POINTS (WFS) - Using DECEA standard symbols */}
                {zoom >= 8 && points.map(p => {
                    // Filter based on visibility settings
                    const isHeliport = p.kind === 'heliport';
                    const isAerodrome = p.type === 'airport' && !isHeliport;
                    const isVorNdb = p.type === 'vor' || p.type === 'ndb';
                    const isWaypoint = p.type === 'fix';
                    
                    // Apply visibility filters
                    if (isHeliport && !pointVisibility.heliports) return null;
                    if (isAerodrome && !pointVisibility.aerodromes) return null;
                    if (isVorNdb && !pointVisibility.vorNdb) return null;
                    if (isWaypoint && !pointVisibility.waypoints) return null;
                    
                    // Determine the icon type based on point type and kind
                    const iconType = isHeliport ? 'heliport' : p.type;
                    
                    // Determine if it's a principal aerodrome (SB prefix = major Brazilian airports)
                    // SBGR, SBSP, SBRJ, SBGL, etc. are principal aerodromes
                    const isPrincipal = p.type === 'airport' && 
                                       p.kind !== 'heliport' && 
                                       p.icao?.startsWith('SB');
                    
                    // Check if this VOR is currently selected for radial display
                    const isVorSelected = selectedVor?.id === p.id && isVorNdb;
                    
                    const iconHTML = getAerodromeIconHTML(iconType as any, p.kind, isPrincipal, zoom);
                    const iconSize = getIconSize(iconType as any, isPrincipal, zoom);
                    
                    const customIcon = L.divIcon({
                        className: `nav-point-icon ${isVorSelected ? 'vor-selected' : ''}`,
                        html: `<div style="
                            display: flex; 
                            align-items: center; 
                            justify-content: center;
                            ${isVorSelected ? 'filter: drop-shadow(0 0 8px #22c55e) drop-shadow(0 0 16px #22c55e);' : ''}
                        ">${iconHTML}</div>`,
                        iconSize: iconSize,
                        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2]
                    });
                    
                    // Generate tooltip with type indication
                    const typeLabel = isHeliport ? 'Heliporto' : 
                                     isPrincipal ? 'Aeródromo Principal' : 
                                     p.type === 'airport' ? 'Aeródromo' :
                                     p.type === 'vor' ? 'VOR' :
                                     p.type === 'ndb' ? 'NDB' : 'FIX';
                    
                    // Handle VOR click for radial tracking
                    const handleVorClick = () => {
                        if (isVorNdb) {
                            // Toggle selection: if same VOR clicked, deselect; otherwise select
                            if (selectedVor?.id === p.id) {
                                setSelectedVor(null);
                                console.log(`[VOR RADIAL] Desativado: ${p.icao || p.name}`);
                            } else {
                                setSelectedVor(p);
                                console.log(`[VOR RADIAL] Ativado: ${p.icao || p.name} (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})`);
                            }
                        }
                    };
                    
                    return (
                        <Marker 
                            key={`${p.type}-${p.id}`} 
                            position={[p.lat, p.lng]} 
                            icon={customIcon}
                            eventHandlers={{
                                click: handleVorClick
                            }}
                        >
                            <Tooltip 
                                direction="top" 
                                offset={[0, -iconSize[1] / 2 - 5]} 
                                opacity={0.95}
                            >
                                <div style={{ 
                                    fontSize: '11px', 
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    padding: '2px 6px',
                                    background: 'rgba(255,255,255,0.95)',
                                    borderRadius: '3px'
                                }}>
                                    <div>{p.icao || p.name}</div>
                                    <div style={{ fontSize: '9px', fontWeight: 'normal', color: '#666' }}>
                                        {typeLabel}
                                        {isVorNdb && <span style={{ color: '#22c55e' }}> • Clique para radial</span>}
                                    </div>
                                </div>
                            </Tooltip>
                        </Marker>
                    );
                })}

                {/* 4. VOR RADIAL LINE */}
                <VorRadialLine
                    selectedVor={selectedVor}
                    aircraftPosition={aircraftPosition || null}
                    onClose={() => setSelectedVor(null)}
                />
            </LayerGroup>

            {/* ARMOR CONTROL: MAP LOCK TOGGLE - Hidden when plan panel is open or flight plan is expanded */}
            <div 
                className={`${(hideLockButton || isFlightPlanExpanded) ? 'hidden' : 'flex'} md:w-10 md:h-10 w-9 h-9 md:bottom-10 md:left-[88px] bottom-[58px] left-4`}
                style={{
                    position: 'fixed', 
                    zIndex: 99999,
                    background: isLocked ? '#d946ef' : 'rgba(15, 23, 42, 0.9)',
                    color: 'white', 
                    borderRadius: '50%',
                    alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', border: '2px solid white', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }} 
                onClick={toggleLock}
            >
                <svg className="w-5 h-5 md:w-8 md:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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