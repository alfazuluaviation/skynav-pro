import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Polyline, CircleMarker, useMap, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Waypoint, NavPoint } from '../../types';
import { fetchNavigationData } from '../services/NavigationDataService';

interface DraggableRouteProps {
  waypoints: Waypoint[];
  onInsertWaypoint: (waypoint: Waypoint, insertAfterIndex: number) => void;
}

interface DragState {
  isDragging: boolean;
  segmentIndex: number;
  currentPosition: [number, number] | null;
  nearbyPoint: NavPoint | null;
}

export const DraggableRoute: React.FC<DraggableRouteProps> = ({
  waypoints,
  onInsertWaypoint,
}) => {
  const map = useMap();
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    segmentIndex: -1,
    currentPosition: null,
    nearbyPoint: null,
  });
  const [nearbyPoints, setNearbyPoints] = useState<NavPoint[]>([]);
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const dragStateRef = useRef(dragState);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const polylinesRef = useRef<L.Polyline[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // Fetch nearby navigation points with debounce
  const fetchNearbyPoints = useCallback(async (lat: number, lng: number) => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    fetchTimeoutRef.current = setTimeout(async () => {
      try {
        const radiusDeg = 0.5;
        const bounds = L.latLngBounds(
          [lat - radiusDeg, lng - radiusDeg],
          [lat + radiusDeg, lng + radiusDeg]
        );
        const points = await fetchNavigationData(bounds);
        setNearbyPoints(points);
        
        // Find closest point within snap distance
        const snapDistanceDeg = 10 / 60; // ~10nm
        let closestPoint: NavPoint | null = null;
        let closestDist = Infinity;
        
        for (const point of points) {
          const dist = Math.sqrt(Math.pow(point.lat - lat, 2) + Math.pow(point.lng - lng, 2));
          if (dist < snapDistanceDeg && dist < closestDist) {
            closestDist = dist;
            closestPoint = point;
          }
        }
        
        setDragState(prev => ({ ...prev, nearbyPoint: closestPoint }));
      } catch (error) {
        console.error('Error fetching nearby points:', error);
      }
    }, 150);
  }, []);

  // Start drag - called from native Leaflet event
  const startDrag = useCallback((lat: number, lng: number, segmentIndex: number) => {
    console.log('[DraggableRoute] Starting drag on segment', segmentIndex, 'at', lat.toFixed(4), lng.toFixed(4));
    
    // Disable ALL map interactions immediately
    map.dragging.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.touchZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    
    map.getContainer().style.cursor = 'grabbing';
    
    setDragState({
      isDragging: true,
      segmentIndex,
      currentPosition: [lat, lng],
      nearbyPoint: null,
    });
    
    fetchNearbyPoints(lat, lng);
  }, [map, fetchNearbyPoints]);

  // Handle drop/insert
  const handleDrop = useCallback(() => {
    if (!dragStateRef.current.isDragging) return;
    
    const state = dragStateRef.current;
    console.log('[DraggableRoute] Dropping...');
    
    // Re-enable ALL map interactions
    map.dragging.enable();
    map.doubleClickZoom.enable();
    map.scrollWheelZoom.enable();
    map.touchZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
    map.getContainer().style.cursor = '';
    
    if (!state.currentPosition) {
      setDragState({
        isDragging: false,
        segmentIndex: -1,
        currentPosition: null,
        nearbyPoint: null,
      });
      return;
    }
    
    const [lat, lng] = state.currentPosition;
    const segmentIndex = state.segmentIndex;
    const nearbyPoint = state.nearbyPoint;
    
    console.log('[DraggableRoute] Drop at', lat.toFixed(4), lng.toFixed(4), 'snap:', nearbyPoint?.name);
    
    // Create new waypoint
    let newWaypoint: Waypoint;
    
    if (nearbyPoint) {
      newWaypoint = {
        id: `wp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: nearbyPoint.name,
        icao: nearbyPoint.icao,
        lat: nearbyPoint.lat,
        lng: nearbyPoint.lng,
        type: (nearbyPoint.type === 'vor' ? 'VOR' : (nearbyPoint.type === 'ndb' || nearbyPoint.type === 'fix') ? 'FIX' : 'AIRPORT') as 'AIRPORT' | 'FIX' | 'VOR' | 'USER',
        description: nearbyPoint.type,
        role: 'WAYPOINT',
      };
    } else {
      newWaypoint = {
        id: `wp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: `WP${String(segmentIndex + 2).padStart(2, '0')}`,
        lat,
        lng,
        type: 'USER',
        description: `Ponto em ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        role: 'WAYPOINT',
      };
    }
    
    onInsertWaypoint(newWaypoint, segmentIndex);
    
    // Reset state
    setDragState({
      isDragging: false,
      segmentIndex: -1,
      currentPosition: null,
      nearbyPoint: null,
    });
    setNearbyPoints([]);
  }, [map, onInsertWaypoint]);

  // Create interactive polylines using native Leaflet (not react-leaflet)
  // This gives us proper control over mousedown events
  useEffect(() => {
    if (waypoints.length < 2 || dragState.isDragging) {
      // Remove existing polylines when dragging
      polylinesRef.current.forEach(pl => pl.remove());
      polylinesRef.current = [];
      return;
    }
    
    // Clear old polylines
    polylinesRef.current.forEach(pl => pl.remove());
    polylinesRef.current = [];
    
    // Create new polylines for each segment
    waypoints.slice(0, -1).forEach((start, index) => {
      const end = waypoints[index + 1];
      
      const polyline = L.polyline(
        [[start.lat, start.lng], [end.lat, end.lng]],
        {
          color: '#d946ef',
          weight: 8,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }
      ).addTo(map);
      
      // Bind tooltip
      polyline.bindTooltip('✋ Arraste para inserir ponto', {
        direction: 'top',
        offset: [0, -10],
        opacity: 0.95,
        className: 'drag-tooltip',
      });
      
      // Mouse events
      polyline.on('mouseover', () => {
        polyline.setStyle({ color: '#22c55e', weight: 12 });
        map.getContainer().style.cursor = 'grab';
        setHoveredSegment(index);
      });
      
      polyline.on('mouseout', () => {
        if (!dragStateRef.current.isDragging) {
          polyline.setStyle({ color: '#d946ef', weight: 8 });
          map.getContainer().style.cursor = '';
          setHoveredSegment(null);
        }
      });
      
      // CRITICAL: Use native mousedown to capture before Leaflet's map drag
      const element = polyline.getElement();
      if (element) {
        element.addEventListener('mousedown', (e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          
          const containerPoint = map.mouseEventToContainerPoint(e);
          const latlng = map.containerPointToLatLng(containerPoint);
          startDrag(latlng.lat, latlng.lng, index);
        }, { capture: true });
        
        element.addEventListener('touchstart', (e: TouchEvent) => {
          e.stopPropagation();
          e.preventDefault();
          
          const touch = e.touches[0];
          const rect = map.getContainer().getBoundingClientRect();
          const containerPoint = L.point(touch.clientX - rect.left, touch.clientY - rect.top);
          const latlng = map.containerPointToLatLng(containerPoint);
          startDrag(latlng.lat, latlng.lng, index);
        }, { capture: true, passive: false });
      }
      
      polylinesRef.current.push(polyline);
    });
    
    return () => {
      polylinesRef.current.forEach(pl => pl.remove());
      polylinesRef.current = [];
    };
  }, [waypoints, map, startDrag, dragState.isDragging]);

  // Global mouse/touch move and up handlers
  useEffect(() => {
    const container = map.getContainer();
    
    const onMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.isDragging) return;
      e.preventDefault();
      
      const rect = container.getBoundingClientRect();
      const containerPoint = L.point(e.clientX - rect.left, e.clientY - rect.top);
      const latlng = map.containerPointToLatLng(containerPoint);
      
      setDragState(prev => ({ ...prev, currentPosition: [latlng.lat, latlng.lng] }));
      fetchNearbyPoints(latlng.lat, latlng.lng);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragStateRef.current.isDragging) return;
      e.preventDefault();
      
      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      const containerPoint = L.point(touch.clientX - rect.left, touch.clientY - rect.top);
      const latlng = map.containerPointToLatLng(containerPoint);
      
      setDragState(prev => ({ ...prev, currentPosition: [latlng.lat, latlng.lng] }));
      fetchNearbyPoints(latlng.lat, latlng.lng);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (dragStateRef.current.isDragging) {
        e.preventDefault();
        handleDrop();
      }
    };
    
    const onTouchEnd = (e: TouchEvent) => {
      if (dragStateRef.current.isDragging) {
        e.preventDefault();
        handleDrop();
      }
    };

    // Use capture phase to intercept events before Leaflet
    container.addEventListener('mousemove', onMouseMove, { capture: true });
    container.addEventListener('mouseup', onMouseUp, { capture: true });
    container.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    container.addEventListener('touchend', onTouchEnd, { capture: true });

    return () => {
      container.removeEventListener('mousemove', onMouseMove, { capture: true });
      container.removeEventListener('mouseup', onMouseUp, { capture: true });
      container.removeEventListener('touchmove', onTouchMove, { capture: true });
      container.removeEventListener('touchend', onTouchEnd, { capture: true });
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [map, handleDrop, fetchNearbyPoints]);

  // Create drag indicator icon
  const createDragIcon = (hasSnap: boolean) => L.divIcon({
    className: 'drag-indicator',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background: ${hasSnap ? '#22c55e' : '#d946ef'};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 4px 20px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: pulse 0.5s ease-in-out infinite alternate;
      ">
        <div style="
          width: 12px;
          height: 12px;
          background: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  if (waypoints.length < 2) return null;

  return (
    <>
      {/* Add CSS for tooltip and animation */}
      <style>{`
        .drag-tooltip {
          background: #15803d !important;
          color: white !important;
          font-weight: bold !important;
          border: none !important;
          border-radius: 6px !important;
          padding: 6px 10px !important;
        }
        .drag-tooltip::before {
          border-top-color: #15803d !important;
        }
        @keyframes pulse {
          from { transform: scale(1); }
          to { transform: scale(1.15); }
        }
      `}</style>
      
      {/* Drag preview when dragging */}
      {dragState.isDragging && dragState.currentPosition && (
        <>
          {/* Original route faded */}
          <Polyline
            positions={waypoints.map(w => [w.lat, w.lng])}
            pathOptions={{
              color: '#d946ef',
              weight: 3,
              opacity: 0.3,
            }}
          />
          
          {/* Line from start of segment to drag position */}
          <Polyline
            positions={[
              [waypoints[dragState.segmentIndex].lat, waypoints[dragState.segmentIndex].lng],
              dragState.nearbyPoint 
                ? [dragState.nearbyPoint.lat, dragState.nearbyPoint.lng]
                : dragState.currentPosition,
            ]}
            pathOptions={{
              color: dragState.nearbyPoint ? '#22c55e' : '#d946ef',
              weight: 5,
              opacity: 0.9,
              dashArray: '12, 8',
            }}
          />
          
          {/* Line from drag position to end of segment */}
          <Polyline
            positions={[
              dragState.nearbyPoint 
                ? [dragState.nearbyPoint.lat, dragState.nearbyPoint.lng]
                : dragState.currentPosition,
              [waypoints[dragState.segmentIndex + 1].lat, waypoints[dragState.segmentIndex + 1].lng],
            ]}
            pathOptions={{
              color: dragState.nearbyPoint ? '#22c55e' : '#d946ef',
              weight: 5,
              opacity: 0.9,
              dashArray: '12, 8',
            }}
          />

          {/* Drag position indicator */}
          <Marker
            position={dragState.nearbyPoint 
              ? [dragState.nearbyPoint.lat, dragState.nearbyPoint.lng]
              : dragState.currentPosition
            }
            icon={createDragIcon(!!dragState.nearbyPoint)}
            interactive={false}
            zIndexOffset={9999}
          >
            <Tooltip direction="top" offset={[0, -20]} opacity={0.98} permanent>
              <div style={{ 
                fontSize: '12px', 
                fontWeight: 'bold', 
                textAlign: 'center', 
                padding: '4px 8px',
                background: dragState.nearbyPoint ? '#dcfce7' : '#fae8ff',
                borderRadius: '4px',
              }}>
                {dragState.nearbyPoint ? (
                  <span style={{ color: '#15803d' }}>
                    📍 {dragState.nearbyPoint.icao || dragState.nearbyPoint.name}
                    <br />
                    <small style={{ opacity: 0.8 }}>{dragState.nearbyPoint.type.toUpperCase()}</small>
                  </span>
                ) : (
                  <span style={{ color: '#a21caf' }}>Solte para criar ponto</span>
                )}
              </div>
            </Tooltip>
          </Marker>

          {/* Nearby navigation points */}
          {nearbyPoints.map((point, idx) => (
            <CircleMarker
              key={`nearby-${idx}`}
              center={[point.lat, point.lng]}
              radius={point === dragState.nearbyPoint ? 12 : 7}
              pathOptions={{
                color: 'white',
                weight: 2,
                fillColor: point === dragState.nearbyPoint ? '#22c55e' : '#3b82f6',
                fillOpacity: point === dragState.nearbyPoint ? 1 : 0.7,
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
                  {point.icao || point.name}
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
        </>
      )}
    </>
  );
};

export default DraggableRoute;
