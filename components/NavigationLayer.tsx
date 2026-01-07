
import React, { useState, useEffect, useCallback } from 'react';
import { useMapEvents, CircleMarker, Tooltip, LayerGroup, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchNavigationData, NavPoint } from '../services/NavigationDataService';
import { Waypoint } from '../types';

interface NavigationLayerProps {
    onPointSelect?: (point: NavPoint) => void;
    waypoints?: Waypoint[];
    flightSegments?: any[];
}

export const NavigationLayer: React.FC<NavigationLayerProps> = ({ 
    onPointSelect, 
    waypoints = [] 
}) => {
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
        } catch (error) {
            console.error('Navigation Data Error:', error);
        }
    }, [map, points.length]);

    useMapEvents({
        moveend: () => handleUpdate(),
        zoomend: () => setZoom(map.getZoom())
    });

    useEffect(() => { handleUpdate(); }, [handleUpdate]);

    const calculateTrack = (start: Waypoint, end: Waypoint) => {
        const rad = Math.PI / 180;
        const y = Math.sin((end.lng - start.lng) * rad) * Math.cos(end.lat * rad);
        const x = Math.cos(start.lat * rad) * Math.sin(end.lat * rad) -
                  Math.sin(start.lat * rad) * Math.cos(end.lat * rad) * Math.cos((end.lng - start.lng) * rad);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    };

    const calculateDistance = (start: Waypoint, end: Waypoint) => {
        const R = 3440.065; // NM
        const rad = Math.PI / 180;
        const a = Math.sin(((end.lat - start.lat) * rad) / 2) ** 2 +
                  Math.cos(start.lat * rad) * Math.cos(end.lat * rad) * Math.sin(((end.lng - start.lng) * rad) / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    return (
        <LayerGroup>
            {/* 1. ROUTE LINE */}
            {waypoints.length > 1 && (
                <Polyline 
                    positions={waypoints.map(w => [w.lat, w.lng])} 
                    pathOptions={{ color: '#d946ef', weight: 4, lineCap: 'butt', opacity: 0.9 }} 
                />
            )}

            {/* 2. DECEA STYLE ARROW (MAGENTA) */}
            {zoom >= 8 && waypoints.slice(0, -1).map((start, i) => {
                const end = waypoints[i + 1];
                if (!start || !end) return null;

                const track = calculateTrack(start, end);
                const dist = calculateDistance(start, end);
                const midLat = (start.lat + end.lat) / 2;
                const midLng = (start.lng + end.lng) / 2;
                const needsFlip = track > 90 && track < 270;

                const deceaIcon = L.divIcon({
                    className: 'decea-arrow-container',
                    html: `
                        <div style="display: flex; align-items: center; justify-content: center; width: 140px; margin-left: -70px; margin-top: -15px;">
                            <div style="transform: rotate(${track - 90}deg); display: flex; align-items: center;">
                                <div style="
                                    background: #d946ef; 
                                    color: white; 
                                    padding: 2px 8px; 
                                    height: 24px;
                                    display: flex; 
                                    align-items: center; 
                                    border: 1.5px solid #ffffff;
                                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                                    position: relative;
                                    min-width: 80px;
                                    /* Pointer tip */
                                    clip-path: polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%);
                                ">
                                    <span style="
                                        font-weight: 900; 
                                        font-size: 12px; 
                                        font-family: 'Inter', sans-serif;
                                        transform: rotate(${needsFlip ? 180 : 0}deg);
                                        margin-right: 10px;
                                        white-space: nowrap;
                                    ">
                                        ${track.toFixed(0).padStart(3, '0')}° ${dist.toFixed(0)}NM
                                    </span>
                                </div>
                            </div>
                        </div>
                    `,
                    iconSize: [0, 0]
                });

                return <Marker key={`arrow-${i}`} position={[midLat, midLng]} icon={deceaIcon} interactive={false} zIndexOffset={2000} />;
            })}

            {/* 3. WFS POINTS */}
            {zoom >= 8 && points.map(p => (
                <CircleMarker
                    key={`${p.type}-${p.id}`}
                    center={[p.lat, p.lng]}
                    radius={4}
                    pathOptions={{ color: '#ffffff', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.9 }}
                >
                    <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                        <div style={{ fontSize: '11px' }}><strong>{p.icao || p.name}</strong></div>
                    </Tooltip>
                </CircleMarker>
            ))}
        </LayerGroup>
    );
};

export default NavigationLayer;