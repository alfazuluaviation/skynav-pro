import React, { useState, useCallback } from 'react';
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

  // Fetch nearby navigation points when dragging
  const fetchNearbyPoints = useCallback(async (lat: number, lng: number) => {
    try {
      // Create a small bounds around the current position (approximately 50nm radius)
      const radiusDeg = 0.5; // roughly 30nm
      const bounds = L.latLngBounds(
        [lat - radiusDeg, lng - radiusDeg],
        [lat + radiusDeg, lng + radiusDeg]
      );
      const points = await fetchNavigationData(bounds);
      setNearbyPoints(points);
      
      // Find the closest point within snap distance (approximately 10nm)
      const snapDistanceNM = 10;
      const snapDistanceDeg = snapDistanceNM / 60; // rough conversion
      
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

  // Calculate midpoint of a segment
  const getMidpoint = (start: Waypoint, end: Waypoint): [number, number] => {
    return [(start.lat + end.lat) / 2, (start.lng + end.lng) / 2];
  };

  // Handle drag start on midpoint marker
  const handleDragStart = useCallback((segmentIndex: number, position: [number, number]) => {
    setDragState({
      isDragging: true,
      segmentIndex,
      currentPosition: position,
      nearbyPoint: null,
    });
    map.dragging.disable();
    fetchNearbyPoints(position[0], position[1]);
  }, [map, fetchNearbyPoints]);

  // Handle drag move
  const handleDragMove = useCallback((e: L.LeafletMouseEvent) => {
    if (!dragState.isDragging) return;
    
    const { lat, lng } = e.latlng;
    setDragState(prev => ({ ...prev, currentPosition: [lat, lng] }));
    
    // Debounce the nearby points fetch
    fetchNearbyPoints(lat, lng);
  }, [dragState.isDragging, fetchNearbyPoints]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!dragState.isDragging || !dragState.currentPosition) return;
    
    const [lat, lng] = dragState.currentPosition;
    const segmentIndex = dragState.segmentIndex;
    
    // Create new waypoint
    let newWaypoint: Waypoint;
    
    if (dragState.nearbyPoint) {
      // Snap to navigation point
      const point = dragState.nearbyPoint;
      newWaypoint = {
        id: `wp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: point.name,
        icao: point.icao,
        lat: point.lat,
        lng: point.lng,
        type: (point.type === 'vor' ? 'VOR' : (point.type === 'ndb' || point.type === 'fix') ? 'FIX' : 'AIRPORT') as 'AIRPORT' | 'FIX' | 'VOR' | 'USER',
        description: point.type,
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
  }, [dragState, onInsertWaypoint, map]);

  // Map event handlers
  useMapEvents({
    mousemove: handleDragMove,
    mouseup: handleDragEnd,
  });

  // Create draggable midpoint icon
  const createMidpointIcon = (isHovered: boolean) => L.divIcon({
    className: 'midpoint-drag-handle',
    html: `
      <div style="
        width: 16px;
        height: 16px;
        background: ${isHovered ? '#d946ef' : 'rgba(217, 70, 239, 0.6)'};
        border: 2px solid white;
        border-radius: 50%;
        cursor: grab;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        transition: all 0.15s ease;
        transform: scale(${isHovered ? 1.2 : 1});
      "></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  // Create drag indicator icon
  const createDragIndicatorIcon = (hasSnap: boolean) => L.divIcon({
    className: 'drag-indicator',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: ${hasSnap ? '#22c55e' : '#d946ef'};
        border: 3px solid white;
        border-radius: 50%;
        cursor: grabbing;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        animation: pulse 0.8s infinite;
      "></div>
      <style>
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      </style>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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

      {/* Draggable midpoint markers for each segment */}
      {!dragState.isDragging && waypoints.slice(0, -1).map((start, index) => {
        const end = waypoints[index + 1];
        const midpoint = getMidpoint(start, end);
        
        return (
          <CircleMarker
            key={`midpoint-${index}`}
            center={midpoint}
            radius={8}
            pathOptions={{
              color: 'white',
              weight: 2,
              fillColor: 'rgba(217, 70, 239, 0.6)',
              fillOpacity: 1,
            }}
            eventHandlers={{
              mousedown: (e) => {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
                handleDragStart(index, midpoint);
              },
              mouseover: (e) => {
                e.target.setStyle({
                  fillColor: '#d946ef',
                  fillOpacity: 1,
                });
              },
              mouseout: (e) => {
                e.target.setStyle({
                  fillColor: 'rgba(217, 70, 239, 0.6)',
                  fillOpacity: 1,
                });
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
              <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
                Arraste para inserir waypoint
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}

      {/* Drag preview line and indicator */}
      {dragState.isDragging && dragState.currentPosition && (
        <>
          {/* Line from previous waypoint to drag position */}
          <Polyline
            positions={[
              [waypoints[dragState.segmentIndex].lat, waypoints[dragState.segmentIndex].lng],
              dragState.currentPosition,
            ]}
            pathOptions={{
              color: dragState.nearbyPoint ? '#22c55e' : '#d946ef',
              weight: 3,
              opacity: 0.7,
              dashArray: '8, 8',
            }}
          />
          
          {/* Line from drag position to next waypoint */}
          <Polyline
            positions={[
              dragState.currentPosition,
              [waypoints[dragState.segmentIndex + 1].lat, waypoints[dragState.segmentIndex + 1].lng],
            ]}
            pathOptions={{
              color: dragState.nearbyPoint ? '#22c55e' : '#d946ef',
              weight: 3,
              opacity: 0.7,
              dashArray: '8, 8',
            }}
          />

          {/* Snap indicator line to nearby point */}
          {dragState.nearbyPoint && (
            <Polyline
              positions={[
                dragState.currentPosition,
                [dragState.nearbyPoint.lat, dragState.nearbyPoint.lng],
              ]}
              pathOptions={{
                color: '#22c55e',
                weight: 2,
                opacity: 0.5,
                dashArray: '4, 4',
              }}
            />
          )}

          {/* Drag position indicator */}
          <Marker
            position={dragState.nearbyPoint 
              ? [dragState.nearbyPoint.lat, dragState.nearbyPoint.lng]
              : dragState.currentPosition
            }
            icon={createDragIndicatorIcon(!!dragState.nearbyPoint)}
            interactive={false}
          >
            <Tooltip direction="top" offset={[0, -15]} opacity={0.95} permanent>
              <div style={{ fontSize: '11px', fontWeight: 'bold', textAlign: 'center' }}>
                {dragState.nearbyPoint ? (
                  <span style={{ color: '#22c55e' }}>
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
              radius={point === dragState.nearbyPoint ? 8 : 5}
              pathOptions={{
                color: point === dragState.nearbyPoint ? '#22c55e' : '#3b82f6',
                weight: point === dragState.nearbyPoint ? 3 : 1,
                fillColor: point === dragState.nearbyPoint ? '#22c55e' : '#3b82f6',
                fillOpacity: point === dragState.nearbyPoint ? 0.9 : 0.6,
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
