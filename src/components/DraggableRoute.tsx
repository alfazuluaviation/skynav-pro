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

  // Calculate midpoint of a segment
  const getMidpoint = useCallback((start: Waypoint, end: Waypoint): [number, number] => {
    return [(start.lat + end.lat) / 2, (start.lng + end.lng) / 2];
  }, []);

  // Handle click on route line to start drag
  const handleRouteClick = useCallback((e: L.LeafletMouseEvent, segmentIndex: number) => {
    L.DomEvent.stopPropagation(e.originalEvent);
    L.DomEvent.preventDefault(e.originalEvent);
    
    const { lat, lng } = e.latlng;
    console.log('[DraggableRoute] Click on segment', segmentIndex, 'at', lat.toFixed(4), lng.toFixed(4));
    
    setDragState({
      isDragging: true,
      segmentIndex,
      currentPosition: [lat, lng],
      nearbyPoint: null,
    });
    
    map.dragging.disable();
    map.getContainer().style.cursor = 'grabbing';
    fetchNearbyPoints(lat, lng);
  }, [map, fetchNearbyPoints]);

  // Handle touch start on route
  const handleTouchStart = useCallback((e: React.TouchEvent, segmentIndex: number) => {
    e.stopPropagation();
    
    const touch = e.touches[0];
    const container = map.getContainer();
    const rect = container.getBoundingClientRect();
    const point = map.containerPointToLatLng([touch.clientX - rect.left, touch.clientY - rect.top]);
    
    console.log('[DraggableRoute] Touch on segment', segmentIndex, 'at', point.lat.toFixed(4), point.lng.toFixed(4));
    
    setDragState({
      isDragging: true,
      segmentIndex,
      currentPosition: [point.lat, point.lng],
      nearbyPoint: null,
    });
    
    map.dragging.disable();
    fetchNearbyPoints(point.lat, point.lng);
  }, [map, fetchNearbyPoints]);

  // Handle drop/insert
  const handleDrop = useCallback(() => {
    if (!dragStateRef.current.isDragging) return;
    
    const state = dragStateRef.current;
    if (!state.currentPosition) {
      map.dragging.enable();
      map.getContainer().style.cursor = '';
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
    
    // Reset
    setDragState({
      isDragging: false,
      segmentIndex: -1,
      currentPosition: null,
      nearbyPoint: null,
    });
    setNearbyPoints([]);
    map.dragging.enable();
    map.getContainer().style.cursor = '';
  }, [map, onInsertWaypoint]);

  // Map event handlers for drag (mouse + touch support)
  useEffect(() => {
    const container = map.getContainer();
    
    const onMouseMove = (e: L.LeafletMouseEvent) => {
      if (!dragStateRef.current.isDragging) return;
      
      const { lat, lng } = e.latlng;
      setDragState(prev => ({ ...prev, currentPosition: [lat, lng] }));
      fetchNearbyPoints(lat, lng);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragStateRef.current.isDragging) return;
      e.preventDefault();
      
      const touch = e.touches[0];
      const point = map.containerPointToLatLng([touch.clientX - container.getBoundingClientRect().left, touch.clientY - container.getBoundingClientRect().top]);
      setDragState(prev => ({ ...prev, currentPosition: [point.lat, point.lng] }));
      fetchNearbyPoints(point.lat, point.lng);
    };

    const onMouseUp = () => handleDrop();
    const onTouchEnd = () => handleDrop();

    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    return () => {
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
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
        width: 32px;
        height: 32px;
        background: ${hasSnap ? '#22c55e' : '#d946ef'};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 4px 20px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 10px;
          height: 10px;
          background: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  if (waypoints.length < 2) return null;

  return (
    <>
      {/* Interactive route segments - each segment is a clickable polyline */}
      {!dragState.isDragging && waypoints.slice(0, -1).map((start, index) => {
        const end = waypoints[index + 1];
        const isHovered = hoveredSegment === index;
        
        return (
          <Polyline
            key={`segment-${index}`}
            positions={[[start.lat, start.lng], [end.lat, end.lng]]}
            pathOptions={{
              color: isHovered ? '#22c55e' : '#d946ef',
              weight: isHovered ? 10 : 6,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
            eventHandlers={{
              click: (e) => handleRouteClick(e, index),
              mouseover: () => {
                setHoveredSegment(index);
                map.getContainer().style.cursor = 'grab';
              },
              mouseout: () => {
                setHoveredSegment(null);
                map.getContainer().style.cursor = '';
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -15]} opacity={0.98} sticky>
              <div style={{ 
                fontSize: '12px', 
                fontWeight: 'bold', 
                padding: '6px 10px',
                background: '#15803d',
                color: 'white',
                borderRadius: '6px',
              }}>
                ✋ Arraste para inserir ponto
              </div>
            </Tooltip>
          </Polyline>
        );
      })}

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
