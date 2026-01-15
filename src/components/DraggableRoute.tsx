import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Polyline, CircleMarker, useMap, useMapEvents, Marker, Tooltip } from 'react-leaflet';
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

// Debounce helper
const useDebounce = (callback: (...args: any[]) => void, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

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
  const dragStateRef = useRef(dragState);

  // Keep ref in sync with state
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // Fetch nearby navigation points when dragging
  const fetchNearbyPointsImmediate = useCallback(async (lat: number, lng: number) => {
    try {
      // Create a small bounds around the current position
      const radiusDeg = 0.5; // roughly 30nm
      const bounds = L.latLngBounds(
        [lat - radiusDeg, lng - radiusDeg],
        [lat + radiusDeg, lng + radiusDeg]
      );
      const points = await fetchNavigationData(bounds);
      setNearbyPoints(points);
      
      // Find the closest point within snap distance (approximately 10nm)
      const snapDistanceNM = 10;
      const snapDistanceDeg = snapDistanceNM / 60;
      
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
  }, []);

  const fetchNearbyPoints = useDebounce(fetchNearbyPointsImmediate, 200);

  // Calculate midpoint of a segment
  const getMidpoint = (start: Waypoint, end: Waypoint): [number, number] => {
    return [(start.lat + end.lat) / 2, (start.lng + end.lng) / 2];
  };

  // Handle drag start on midpoint marker
  const handleDragStart = useCallback((segmentIndex: number, position: [number, number]) => {
    console.log('[DraggableRoute] Drag started on segment', segmentIndex);
    setDragState({
      isDragging: true,
      segmentIndex,
      currentPosition: position,
      nearbyPoint: null,
    });
    map.dragging.disable();
    fetchNearbyPointsImmediate(position[0], position[1]);
  }, [map, fetchNearbyPointsImmediate]);

  // Handle drag move - using direct map events
  useEffect(() => {
    if (!dragStateRef.current.isDragging) return;

    const onMouseMove = (e: L.LeafletMouseEvent) => {
      if (!dragStateRef.current.isDragging) return;
      const { lat, lng } = e.latlng;
      setDragState(prev => ({ ...prev, currentPosition: [lat, lng] }));
      fetchNearbyPoints(lat, lng);
    };

    const onMouseUp = () => {
      if (!dragStateRef.current.isDragging || !dragStateRef.current.currentPosition) {
        map.dragging.enable();
        return;
      }
      
      const [lat, lng] = dragStateRef.current.currentPosition;
      const segmentIndex = dragStateRef.current.segmentIndex;
      const nearbyPoint = dragStateRef.current.nearbyPoint;
      
      console.log('[DraggableRoute] Drag ended at', lat, lng, 'nearby:', nearbyPoint?.name);
      
      // Create new waypoint
      let newWaypoint: Waypoint;
      
      if (nearbyPoint) {
        // Snap to navigation point
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
        // Create user waypoint at the dragged position
        newWaypoint = {
          id: `wp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: `WP${String(segmentIndex + 1).padStart(2, '0')}`,
          lat,
          lng,
          type: 'USER',
          description: `User waypoint at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
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
      map.dragging.enable();
    };

    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);

    return () => {
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
    };
  }, [dragState.isDragging, map, onInsertWaypoint, fetchNearbyPoints]);

  // Create midpoint drag handle icon
  const createMidpointIcon = () => L.divIcon({
    className: 'midpoint-drag-handle',
    html: `
      <div style="
        width: 20px;
        height: 20px;
        background: linear-gradient(135deg, #d946ef 0%, #a855f7 100%);
        border: 2px solid white;
        border-radius: 50%;
        cursor: grab;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  // Create drag indicator icon
  const createDragIndicatorIcon = (hasSnap: boolean) => L.divIcon({
    className: 'drag-indicator',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background: ${hasSnap ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'linear-gradient(135deg, #d946ef 0%, #a855f7 100%)'};
        border: 3px solid white;
        border-radius: 50%;
        cursor: grabbing;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        animation: pulse 0.8s infinite;
      "></div>
      <style>
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.9; }
        }
      </style>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  if (waypoints.length < 2) return null;

  return (
    <>
      {/* Main route polyline */}
      <Polyline
        positions={waypoints.map(w => [w.lat, w.lng])}
        pathOptions={{
          color: '#d946ef',
          weight: 4,
          opacity: 0.9,
        }}
      />

      {/* Draggable midpoint markers for each segment - Using Marker for better drag support */}
      {!dragState.isDragging && waypoints.slice(0, -1).map((start, index) => {
        const end = waypoints[index + 1];
        const midpoint = getMidpoint(start, end);
        
        return (
          <Marker
            key={`midpoint-${index}`}
            position={midpoint}
            icon={createMidpointIcon()}
            eventHandlers={{
              mousedown: (e) => {
                L.DomEvent.stopPropagation(e.originalEvent);
                L.DomEvent.preventDefault(e.originalEvent);
                handleDragStart(index, midpoint);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                ✋ Arraste para inserir waypoint
              </div>
            </Tooltip>
          </Marker>
        );
      })}

      {/* Drag preview line and indicator */}
      {dragState.isDragging && dragState.currentPosition && (
        <>
          {/* Line from previous waypoint to drag position */}
          <Polyline
            positions={[
              [waypoints[dragState.segmentIndex].lat, waypoints[dragState.segmentIndex].lng],
              dragState.nearbyPoint 
                ? [dragState.nearbyPoint.lat, dragState.nearbyPoint.lng]
                : dragState.currentPosition,
            ]}
            pathOptions={{
              color: dragState.nearbyPoint ? '#22c55e' : '#d946ef',
              weight: 4,
              opacity: 0.8,
              dashArray: '10, 10',
            }}
          />
          
          {/* Line from drag position to next waypoint */}
          <Polyline
            positions={[
              dragState.nearbyPoint 
                ? [dragState.nearbyPoint.lat, dragState.nearbyPoint.lng]
                : dragState.currentPosition,
              [waypoints[dragState.segmentIndex + 1].lat, waypoints[dragState.segmentIndex + 1].lng],
            ]}
            pathOptions={{
              color: dragState.nearbyPoint ? '#22c55e' : '#d946ef',
              weight: 4,
              opacity: 0.8,
              dashArray: '10, 10',
            }}
          />

          {/* Drag position indicator */}
          <Marker
            position={dragState.nearbyPoint 
              ? [dragState.nearbyPoint.lat, dragState.nearbyPoint.lng]
              : dragState.currentPosition
            }
            icon={createDragIndicatorIcon(!!dragState.nearbyPoint)}
            interactive={false}
            zIndexOffset={5000}
          >
            <Tooltip direction="top" offset={[0, -18]} opacity={0.98} permanent>
              <div style={{ fontSize: '12px', fontWeight: 'bold', textAlign: 'center', padding: '2px 6px' }}>
                {dragState.nearbyPoint ? (
                  <span style={{ color: '#16a34a' }}>
                    📍 {dragState.nearbyPoint.icao || dragState.nearbyPoint.name}
                  </span>
                ) : (
                  <span>Solte para criar ponto</span>
                )}
              </div>
            </Tooltip>
          </Marker>

          {/* Show nearby navigation points while dragging */}
          {nearbyPoints.map((point, idx) => (
            <CircleMarker
              key={`nearby-${idx}`}
              center={[point.lat, point.lng]}
              radius={point === dragState.nearbyPoint ? 10 : 6}
              pathOptions={{
                color: point === dragState.nearbyPoint ? '#22c55e' : '#3b82f6',
                weight: point === dragState.nearbyPoint ? 3 : 1.5,
                fillColor: point === dragState.nearbyPoint ? '#22c55e' : '#3b82f6',
                fillOpacity: point === dragState.nearbyPoint ? 0.9 : 0.5,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>
                <div style={{ fontSize: '10px' }}>
                  <strong>{point.icao || point.name}</strong>
                  <br />
                  <span style={{ opacity: 0.7 }}>{point.type.toUpperCase()}</span>
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
