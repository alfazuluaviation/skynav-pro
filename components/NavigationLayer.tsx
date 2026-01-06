
import React, { useState, useEffect, useCallback } from 'react';
import { useMapEvents, CircleMarker, Tooltip, LayerGroup, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import { fetchNavigationData, NavPoint } from '../services/NavigationDataService';
import { FlightSegment, Waypoint } from '../types';

interface NavigationLayerProps {
    onPointSelect?: (point: NavPoint) => void;
    waypoints?: Waypoint[];
    flightSegments?: FlightSegment[];
}

export const NavigationLayer: React.FC<NavigationLayerProps> = ({ onPointSelect, waypoints = [], flightSegments = [] }) => {
    const [points, setPoints] = useState<NavPoint[]>([]);
    const [zoom, setZoom] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const map = useMapEvents({
        moveend: () => {
            handleUpdate();
        },
        zoomend: () => {
            const z = map.getZoom();
            setZoom(z);
            if (z < 8) setPoints([]);
        }
    });

    const handleUpdate = useCallback(async () => {
        if (map.getZoom() < 8) return;

        setIsLoading(true);
        try {
            const bounds = map.getBounds();
            const data = await fetchNavigationData(bounds);
            setPoints(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [map]);

    useEffect(() => {
        setZoom(map.getZoom());
        handleUpdate();
    }, [handleUpdate, map]);

    // Route Polyline
    const routePositions = waypoints.map(w => [w.lat, w.lng] as [number, number]);

    return (
        <LayerGroup>
            {/* 1. Magenta Route Line */}
            {routePositions.length > 1 && (
                <Polyline
                    positions={routePositions}
                    pathOptions={{
                        color: '#d946ef', // Magenta-500
                        weight: 5,
                        opacity: 1,
                        lineCap: 'round',
                        lineJoin: 'round',
                        dashArray: undefined
                    }}
                />
            )}

            {/* 2. Route Segment Labels (Pills) */}
            {flightSegments.map((segment, i) => {
                const start = waypoints[i];
                const end = waypoints[i + 1];
                if (!start || !end) return null;

                const midLat = (start.lat + end.lat) / 2;
                const midLng = (start.lng + end.lng) / 2;
                const rotation = segment.track;

                const arrowIcon = L.divIcon({
                    className: 'bg-transparent border-none',
                    html: `
                        <div style="
                            position: absolute;
                            left: 0; top: 0;
                            transform: translate(-50%, -50%) rotate(${rotation - 90}deg); 
                            display: flex; 
                            align-items: center; 
                            justify-content: center;
                        ">
                            <div class="bg-[#d946ef] border border-white/20 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap tracking-wider">
                                <span>➤</span>
                                <span>${segment.track}°</span>
                                <span class="w-px h-3 bg-white/30"></span>
                                <span>${segment.distance.toFixed(0)} NM</span>
                            </div>
                        </div>
                    `,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                });

                return (
                    <Marker
                        key={`seg-${i}`}
                        position={[midLat, midLng]}
                        icon={arrowIcon}
                        interactive={false}
                        zIndexOffset={100}
                    />
                );
            })}

            {/* 3. Navigation Points (WFS) */}
            {points.map(p => {
                let color = '#3b82f6';
                let radius = 6;

                if (p.type === 'vor') {
                    color = '#f97316';
                    radius = 4;
                } else if (p.type === 'ndb') {
                    color = '#eab308';
                    radius = 4;
                } else if (p.type === 'fix') {
                    color = '#a855f7';
                    radius = 3;
                }

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
                        <Tooltip
                            direction="top"
                            offset={[0, -10]}
                            opacity={0.9}
                            className="custom-tooltip"
                        >
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
