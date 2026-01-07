
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

export const NavigationLayer: React.FC<NavigationLayerProps> = ({ 
    onPointSelect, 
    waypoints = [], 
    flightSegments = [] 
}) => {
    const map = useMap();
    const [points, setPoints] = useState<NavPoint[]>([]);
    const [zoom, setZoom] = useState(map.getZoom());

    const handleUpdate = useCallback(async () => {
        const currentZoom = map.getZoom();
        
        // Hide data if zoomed out too far
        if (currentZoom < 8) {
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

    const mapEvents = useMapEvents({
        moveend: () => handleUpdate(),
        zoomend: () => setZoom(mapEvents.getZoom())
    });

    useEffect(() => {
        handleUpdate();
    }, [handleUpdate]);

    // Internal calculations for Route Pills
    const calculateTrack = (start: Waypoint, end: Waypoint) => {
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
        <LayerGroup>
            {/* 1. MAIN ROUTE LINE (MAGENTA) */}
            {waypoints.length > 1 && (
                <Polyline 
                    positions={waypoints.map(w => [w.lat, w.lng])} 
                    pathOptions={{ color: '#d946ef', weight: 5, lineCap: 'round', opacity: 0.8 }} 
                />
            )}

            {/* 2. NAVIGATION PILLS (TRACK | DISTANCE) - Visible at zoom >= 8 */}
            {zoom >= 8 && waypoints.slice(0, -1).map((start, i) => {
                const end = waypoints[i + 1];
                if (!start || !end) return null;

                const track = calculateTrack(start, end);
                const dist = calculateDistance(start, end);
                const midLat = (start.lat + end.lat) / 2;
                const midLng = (start.lng + end.lng) / 2;
                const needsFlip = track > 90 && track < 270;

                const arrowIcon = L.divIcon({
                    className: 'pill-marker',
                    html: `
                        <div style="display: flex; align-items: center; justify-content: center; width: 150px; margin-left: -75px; margin-top: -15px;">
                            <div style="transform: rotate(${track - 90}deg);">
                                <div style="
                                    background: #d946ef; color: white; padding: 4px 12px; border-radius: 20px; 
                                    display: flex; align-items: center; gap: 6px; border: 2px solid white;
                                    box-shadow: 0 2px 8px rgba(0,0,0,0.4); transform: rotate(${needsFlip ? 180 : 0}deg);
                                    white-space: nowrap;
                                ">
                                    <span style="display: flex; transform: rotate(${needsFlip ? 180 : 0}deg);">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                                            <path d="M21 12l-18 9v-18z"/>
                                        </svg>
                                    </span>
                                    <span style="font-weight: 900; font-size: 11px; font-family: sans-serif;">
                                        ${track.toFixed(0).padStart(3, '0')}° | ${dist.toFixed(0)}NM
                                    </span>
                                </div>
                            </div>
                        </div>
                    `,
                    iconSize: [0, 0]
                });

                return (
                    <Marker 
                        key={`pill-${i}`} 
                        position={[midLat, midLng]} 
                        icon={arrowIcon} 
                        interactive={false} 
                        zIndexOffset={2000} 
                    />
                );
            })}

            {/* 3. NAVIGATION DATA POINTS (WFS) */}
            {zoom >= 8 && points.map(p => (
                <CircleMarker
                    key={`${p.type}-${p.id}`}
                    center={[p.lat, p.lng]}
                    radius={4}
                    pathOptions={{ color: '#ffffff', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.9 }}
                    eventHandlers={{ click: () => onPointSelect?.(p) }}
                >
                    <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                        <div style={{ fontSize: '11px', textAlign: 'center' }}>
                            <strong>{p.icao || p.name}</strong>
                        </div>
                    </Tooltip>
                </CircleMarker>
            ))}
        </LayerGroup>
    );
};

export default NavigationLayer;