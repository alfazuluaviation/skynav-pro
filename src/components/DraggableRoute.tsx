import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Polyline, CircleMarker, useMap, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Waypoint, NavPoint } from '../../types';
import { fetchNavigationData } from '../services/NavigationDataService';
import { X, MapPin, Navigation, Radio, Plane, Edit3 } from 'lucide-react';

interface DraggableRouteProps {
  waypoints: Waypoint[];
  onInsertWaypoint: (waypoint: Waypoint, insertAfterIndex: number) => void;
}

interface DragState {
  isDragging: boolean;
  segmentIndex: number;
  currentPosition: [number, number] | null;
}

interface SelectionState {
  isOpen: boolean;
  position: [number, number] | null;
  segmentIndex: number;
  nearbyPoints: NavPoint[];
  customName: string;
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
  });
  const [nearbyPoints, setNearbyPoints] = useState<NavPoint[]>([]);
  const [selectionState, setSelectionState] = useState<SelectionState>({
    isOpen: false,
    position: null,
    segmentIndex: -1,
    nearbyPoints: [],
    customName: '',
  });
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const dragStateRef = useRef(dragState);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const polylinesRef = useRef<L.Polyline[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // Fetch nearby navigation points with debounce (no snapping during drag)
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
      } catch (error) {
        console.error('Error fetching nearby points:', error);
      }
    }, 150);
  }, []);

  // Start drag - called from native Leaflet event
  const startDrag = useCallback((lat: number, lng: number, segmentIndex: number) => {
    console.log('[DraggableRoute] Starting drag on segment', segmentIndex, 'at', lat.toFixed(4), lng.toFixed(4));
    
    // Close selection if open
    setSelectionState({ isOpen: false, position: null, segmentIndex: -1, nearbyPoints: [], customName: '' });
    
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
    });
    
    fetchNearbyPoints(lat, lng);
  }, [map, fetchNearbyPoints]);

  // Format coordinates for display
  const formatCoordinate = (lat: number, lng: number): string => {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    const latDeg = Math.abs(lat);
    const lngDeg = Math.abs(lng);
    const latMin = (latDeg % 1) * 60;
    const lngMin = (lngDeg % 1) * 60;
    return `${Math.floor(latDeg)}°${latMin.toFixed(2)}'${latDir} ${Math.floor(lngDeg)}°${lngMin.toFixed(2)}'${lngDir}`;
  };

  // Calculate distance between two points in NM
  const calculateDistanceNM = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 3440.065; // Earth radius in NM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Handle selection from the list
  const handleSelectPoint = useCallback((selectedPoint: NavPoint | 'coordinates') => {
    if (!selectionState.position) return;
    
    const [lat, lng] = selectionState.position;
    const segmentIndex = selectionState.segmentIndex;
    
    let newWaypoint: Waypoint;
    
    if (selectedPoint === 'coordinates') {
      // Use custom name if provided, otherwise use coordinates as name
      const customName = selectionState.customName.trim();
      const coordinateStr = formatCoordinate(lat, lng);
      
      newWaypoint = {
        id: `wp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: customName || coordinateStr, // Use coordinates if no custom name
        lat,
        lng,
        type: 'USER',
        description: coordinateStr, // Always store coordinates in description
        role: 'WAYPOINT',
      };
    } else {
      newWaypoint = {
        id: `wp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: selectedPoint.icao || selectedPoint.name,
        icao: selectedPoint.icao,
        lat: selectedPoint.lat,
        lng: selectedPoint.lng,
        type: (selectedPoint.type === 'vor' ? 'VOR' : (selectedPoint.type === 'ndb' || selectedPoint.type === 'fix') ? 'FIX' : 'AIRPORT') as 'AIRPORT' | 'FIX' | 'VOR' | 'USER',
        description: selectedPoint.name,
        role: 'WAYPOINT',
      };
    }
    
    onInsertWaypoint(newWaypoint, segmentIndex);
    
    // Close selection
    setSelectionState({ isOpen: false, position: null, segmentIndex: -1, nearbyPoints: [], customName: '' });
  }, [selectionState, onInsertWaypoint]);

  // Handle drop - show selection modal instead of inserting directly
  const handleDrop = useCallback(async () => {
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
    
    console.log('[DraggableRoute] Drop at', lat.toFixed(4), lng.toFixed(4));
    
    // Fetch nearby points for the selection list
    try {
      const radiusDeg = 0.5; // ~30nm radius
      const bounds = L.latLngBounds(
        [lat - radiusDeg, lng - radiusDeg],
        [lat + radiusDeg, lng + radiusDeg]
      );
      const points = await fetchNavigationData(bounds);
      
      // Sort by distance from drop point
      const sortedPoints = points
        .map(p => ({
          ...p,
          distance: calculateDistanceNM(lat, lng, p.lat, p.lng)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10); // Limit to 10 closest
      
      // Open selection modal
      setSelectionState({
        isOpen: true,
        position: [lat, lng],
        segmentIndex,
        nearbyPoints: sortedPoints,
        customName: '',
      });
    } catch (error) {
      console.error('Error fetching nearby points:', error);
      // If fetch fails, still open modal with just coordinates
      setSelectionState({
        isOpen: true,
        position: [lat, lng],
        segmentIndex,
        nearbyPoints: [],
        customName: '',
      });
    }
    
    // Reset drag state
    setDragState({
      isDragging: false,
      segmentIndex: -1,
      currentPosition: null,
    });
    setNearbyPoints([]);
  }, [map]);

  // Close selection modal
  const handleCloseSelection = useCallback(() => {
    setSelectionState({ isOpen: false, position: null, segmentIndex: -1, nearbyPoints: [], customName: '' });
  }, []);

  // Create interactive polylines using native Leaflet
  useEffect(() => {
    if (waypoints.length < 2 || dragState.isDragging) {
      polylinesRef.current.forEach(pl => pl.remove());
      polylinesRef.current = [];
      return;
    }
    
    polylinesRef.current.forEach(pl => pl.remove());
    polylinesRef.current = [];
    
    waypoints.slice(0, -1).forEach((start, index) => {
      const end = waypoints[index + 1];
      
      // Check if this is a zero-length segment (same position waypoints)
      const isZeroLength = start.lat === end.lat && start.lng === end.lng;
      
      // For zero-length segments, create a small visible circle marker instead
      if (isZeroLength) {
        // Create a circle marker that can be interacted with
        const circle = L.circleMarker([start.lat, start.lng], {
          radius: 15,
          color: '#d946ef',
          fillColor: '#d946ef',
          fillOpacity: 0.3,
          weight: 3,
        }).addTo(map);
        
        circle.bindTooltip('✋ Clique para inserir ponto entre waypoints idênticos', {
          direction: 'top',
          offset: [0, -10],
          opacity: 0.95,
          className: 'drag-tooltip',
        });
        
        circle.on('mouseover', () => {
          circle.setStyle({ color: '#22c55e', fillColor: '#22c55e' });
          map.getContainer().style.cursor = 'grab';
          setHoveredSegment(index);
        });
        
        circle.on('mouseout', () => {
          if (!dragStateRef.current.isDragging) {
            circle.setStyle({ color: '#d946ef', fillColor: '#d946ef' });
            map.getContainer().style.cursor = '';
            setHoveredSegment(null);
          }
        });
        
        circle.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          // Open selection modal at this position
          setSelectionState({
            isOpen: true,
            position: [start.lat, start.lng],
            segmentIndex: index,
            nearbyPoints: [],
            customName: '',
          });
        });
        
        // Store as polyline for cleanup (we'll cast it)
        polylinesRef.current.push(circle as unknown as L.Polyline);
        return;
      }
      
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
      
      polyline.bindTooltip('✋ Arraste para inserir ponto', {
        direction: 'top',
        offset: [0, -10],
        opacity: 0.95,
        className: 'drag-tooltip',
      });
      
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
      // Don't fetch during move to avoid snapping - only fetch on drop
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragStateRef.current.isDragging) return;
      e.preventDefault();
      
      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      const containerPoint = L.point(touch.clientX - rect.left, touch.clientY - rect.top);
      const latlng = map.containerPointToLatLng(containerPoint);
      
      setDragState(prev => ({ ...prev, currentPosition: [latlng.lat, latlng.lng] }));
      // Don't fetch during move to avoid snapping - only fetch on drop
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

  // Create drag indicator icon (no snapping, always same color)
  const createDragIcon = () => L.divIcon({
    className: 'drag-indicator',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background: #d946ef;
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

  // Get icon for point type
  const getPointIcon = (type: string) => {
    switch (type) {
      case 'airport':
        return <Plane className="w-4 h-4" />;
      case 'vor':
        return <Navigation className="w-4 h-4" />;
      case 'ndb':
        return <Radio className="w-4 h-4" />;
      case 'fix':
        return <MapPin className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  // Get color for point type
  const getPointColor = (type: string) => {
    switch (type) {
      case 'airport':
        return 'bg-blue-500';
      case 'vor':
        return 'bg-green-500';
      case 'ndb':
        return 'bg-orange-500';
      case 'fix':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

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
      
      {/* Selection Modal */}
      {selectionState.isOpen && selectionState.position && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleCloseSelection}
        >
          <div 
            className="bg-card border border-border rounded-xl shadow-2xl w-[90vw] max-w-md max-h-[70vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Inserir Ponto na Rota</h3>
                <p className="text-xs text-muted-foreground">
                  Selecione um ponto para inserir entre {waypoints[selectionState.segmentIndex]?.name} e {waypoints[selectionState.segmentIndex + 1]?.name}
                </p>
              </div>
              <button
                onClick={handleCloseSelection}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(70vh-80px)]">
              {/* Coordinates option - always first with optional name input */}
              <div className="border-b border-border">
                <div className="px-4 py-3 bg-gradient-to-r from-fuchsia-500/10 to-transparent">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-fuchsia-500 flex items-center justify-center text-white">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-foreground">
                        Usar Coordenada
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCoordinate(selectionState.position[0], selectionState.position[1])}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      USER
                    </div>
                  </div>
                  
                  {/* Optional name input */}
                  <div className="flex items-center gap-2 mb-2">
                    <Edit3 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="Nome do ponto (opcional)"
                      value={selectionState.customName}
                      onChange={(e) => setSelectionState(prev => ({ ...prev, customName: e.target.value }))}
                      className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                      maxLength={20}
                    />
                  </div>
                  
                  <button
                    onClick={() => handleSelectPoint('coordinates')}
                    className="w-full py-2.5 bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    {selectionState.customName.trim() 
                      ? `Inserir "${selectionState.customName.trim()}"` 
                      : 'Inserir Coordenada'}
                  </button>
                </div>
              </div>
              
              {/* Nearby points */}
              {(selectionState.nearbyPoints as (NavPoint & { distance?: number })[]).length > 0 && (
                <div className="px-4 py-2 bg-muted/30 border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Pontos Próximos
                  </span>
                </div>
              )}
              
              {(selectionState.nearbyPoints as (NavPoint & { distance?: number })[]).map((point, idx) => (
                <button
                  key={`selection-${idx}`}
                  onClick={() => handleSelectPoint(point)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/10 border-b border-border transition-colors group"
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full ${getPointColor(point.type)} flex items-center justify-center text-white`}>
                    {getPointIcon(point.type)}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-foreground group-hover:text-primary">
                      {point.icao || point.name}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {point.name}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded uppercase">
                      {point.type}
                    </div>
                    {point.distance !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        {point.distance.toFixed(1)} NM
                      </div>
                    )}
                  </div>
                </button>
              ))}
              
              {(selectionState.nearbyPoints as (NavPoint & { distance?: number })[]).length === 0 && (
                <div className="px-4 py-6 text-center text-muted-foreground">
                  <p className="text-sm">Nenhum ponto de navegação encontrado nas proximidades.</p>
                  <p className="text-xs mt-1">Você pode usar a coordenada diretamente.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
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
              dragState.currentPosition,
            ]}
            pathOptions={{
              color: '#d946ef',
              weight: 5,
              opacity: 0.9,
              dashArray: '12, 8',
            }}
          />
          
          {/* Line from drag position to end of segment */}
          <Polyline
            positions={[
              dragState.currentPosition,
              [waypoints[dragState.segmentIndex + 1].lat, waypoints[dragState.segmentIndex + 1].lng],
            ]}
            pathOptions={{
              color: '#d946ef',
              weight: 5,
              opacity: 0.9,
              dashArray: '12, 8',
            }}
          />

          {/* Drag position indicator */}
          <Marker
            position={dragState.currentPosition}
            icon={createDragIcon()}
            interactive={false}
            zIndexOffset={9999}
          >
            <Tooltip direction="top" offset={[0, -20]} opacity={0.98} permanent>
              <div style={{ 
                fontSize: '12px', 
                fontWeight: 'bold', 
                textAlign: 'center', 
                padding: '4px 8px',
                background: '#fae8ff',
                borderRadius: '4px',
              }}>
                <span style={{ color: '#a21caf' }}>Solte para selecionar ponto</span>
              </div>
            </Tooltip>
          </Marker>

          {/* Nearby navigation points (visual reference only, no snapping) */}
          {nearbyPoints.slice(0, 5).map((point, idx) => (
            <CircleMarker
              key={`nearby-${idx}`}
              center={[point.lat, point.lng]}
              radius={7}
              pathOptions={{
                color: 'white',
                weight: 2,
                fillColor: '#3b82f6',
                fillOpacity: 0.7,
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
