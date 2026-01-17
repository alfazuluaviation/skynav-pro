import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Waypoint, FlightStats, ChartConfig, AiracCycle, FlightSegment, SavedPlan, NavPoint } from '../types';
import { calculateDistance, calculateBearing, formatTime, applyMagneticVariation, getMagneticDeclination } from './utils/geoUtils';
import { syncAeronauticalData, searchAerodrome } from './services/geminiService';
// Components
import { Sidebar } from './components/Sidebar';
import { FlightPlanPanel } from './components/FlightPlanPanel';
import { MapControls } from './components/MapControls';
import { Auth } from './components/Auth';
import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { getAiracCycleInfo } from './services/airacService';
import { ENRC_SEGMENTS } from '../config/chartConfig';
import { WMSTileLayer } from 'react-leaflet';
import { NavigationLayer } from './components/NavigationLayer';
import { TopLeftMenu } from './components/TopLeftMenu';
import { ChartsModal } from './components/ChartsModal';
import { AerodromeModal } from './components/AerodromeModal';
import { DownloadModal } from './components/DownloadModal';
import { FlightPlanDownloadModal } from './components/FlightPlanDownloadModal';
import { BaseMapType } from './components/LayersMenu';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

const planeIcon = L.divIcon({
  html: `<div style="transform: rotate(0deg); transition: transform 0.5s;">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="#a855f7" stroke="white" stroke-width="0.5">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
    </svg>
  </div>`,
  className: 'plane-icon',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Component to handle map resize
function MapUIControls({ showPlanPanel }: { showPlanPanel: boolean }) {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 300);
  }, [showPlanPanel, map]);

  return null;
}

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [showPlanPanel, setShowPlanPanel] = useState(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  // User position from GPS - null until GPS provides first position
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  const [stats, setStats] = useState<FlightStats>({
    groundSpeed: 0,
    altitude: 0,
    heading: 0,
    nextWaypointDistance: null,
    ete: null,
  });

  const [isFollowing, setIsFollowing] = useState(false);
  // Night mode: false by default on first visit, then persists user preference
  const [isNightMode, setIsNightMode] = useState(() => {
    const saved = localStorage.getItem('skyFplNightMode');
    return saved !== null ? saved === 'true' : false;
  });
  const [activeBaseMap, setActiveBaseMap] = useState<BaseMapType>('roadmap');
  const [airac, setAirac] = useState<AiracCycle | null>(null);
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [plannedSpeed, setPlannedSpeed] = useState(230);
  const [aircraftModel, setAircraftModel] = useState({ id: 'C172', label: 'Cessna 172 Skyhawk', speed: 110 });
  const [planViewMode, setPlanViewMode] = useState<'ETAPA' | 'ACUMULADO'>('ETAPA');
  const [mapRef, setMapRef] = useState<L.Map | null>(null);
  const [activeLayers, setActiveLayers] = useState<string[]>([]);
  const [downloadedLayers, setDownloadedLayers] = useState<string[]>([]);
  const [syncingLayers, setSyncingLayers] = useState<Record<string, number>>({});
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [showChartsModal, setShowChartsModal] = useState(false);
  const [showAerodromeModal, setShowAerodromeModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showFlightPlanDownloadModal, setShowFlightPlanDownloadModal] = useState(false);
  const [chartsModalIcao, setChartsModalIcao] = useState<string | null>(null);
  const [isSidebarMenuOpen, setIsSidebarMenuOpen] = useState(false);

  // Persistence Keys
  const KEY_CURRENT_PLAN = 'flight_plan_v1';
  const KEY_SAVED_PLANS = 'saved_flight_plans_v1';

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoadingSession(false); // Session loading is complete
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingSession(false); // Also set to false on auth state change
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialization & Auto-Load
  useEffect(() => {
    // 1. Load Settings & Layers
    const savedCharts = localStorage.getItem('sky_nav_charts');
    const savedAirac = localStorage.getItem('sky_nav_airac');
    const savedDownloaded = localStorage.getItem('sky_nav_downloaded_layers');
    const savedActive = localStorage.getItem('sky_nav_active_layers');

    if (savedCharts && savedAirac) {
      setCharts(JSON.parse(savedCharts));
      setAirac(JSON.parse(savedAirac));
    } else {
      handleSync();
    }

    if (savedDownloaded) setDownloadedLayers(JSON.parse(savedDownloaded));
    if (savedActive) setActiveLayers(JSON.parse(savedActive));

    // 2. Load Saved Plans List
    const savedList = localStorage.getItem(KEY_SAVED_PLANS);
    if (savedList) setSavedPlans(JSON.parse(savedList));

    // 3. Load Auto-Saved Current Plan
    const currentPlan = localStorage.getItem(KEY_CURRENT_PLAN);
    if (currentPlan) {
      try {
        const parsed = JSON.parse(currentPlan);
        if (parsed.waypoints) setWaypoints(parsed.waypoints);
        if (parsed.aircraft) setAircraftModel(parsed.aircraft);
        if (parsed.speed) setPlannedSpeed(parsed.speed);
      } catch (e) {
        console.error("Failed to load auto-saved plan", e);
      }
    }
  }, []);

  // Auto-Save Effect for current plan
  useEffect(() => {
    const plan = {
      waypoints,
      aircraft: aircraftModel,
      speed: plannedSpeed,
    };
    localStorage.setItem(KEY_CURRENT_PLAN, JSON.stringify(plan));
  }, [waypoints, aircraftModel, plannedSpeed]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition((pos) => {
        const { latitude, longitude, speed, altitude, heading } = pos.coords;
        setUserPos([latitude, longitude]);
        const gs = (speed || 0) * 1.94384;
        document.documentElement.style.setProperty('--heading', `${heading || 0}deg`);
        setStats({
          groundSpeed: Math.round(gs),
          altitude: Math.round((altitude || 0) * 3.28084),
          heading: Math.round(heading || 0),
          nextWaypointDistance: waypoints.length > 0 ? calculateDistance(latitude, longitude, waypoints[0].lat, waypoints[0].lng) : null,
          ete: gs > 5 && waypoints.length > 0 ? formatTime(calculateDistance(latitude, longitude, waypoints[0].lat, waypoints[0].lng) / gs) : '--:--',
        });
      }, (err) => {
        console.error("Erro GPS:", err);
      }, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      });

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [waypoints]);

  const handleSync = async () => {
    try {
      const airacData = getAiracCycleInfo();

      // Transform Date to string for the existing type/component
      const airacObj: AiracCycle = {
        current: airacData.current.current,
        effectiveDate: airacData.current.effectiveDate.toLocaleDateString(),
        expiryDate: airacData.current.expiryDate.toLocaleDateString(),
        nextCycleDate: airacData.current.nextCycleDate.toLocaleDateString(),
        status: 'CURRENT'
      };

      setAirac(airacObj);
      localStorage.setItem('sky_nav_airac', JSON.stringify(airacObj));
    } catch (e) {
      console.error(e);
    }
  };

  const handleChartDownload = async (layer: string) => {
    if (syncingLayers[layer] !== undefined) return;

    // Iniciar progresso
    for (let p = 0; p <= 100; p += 10) {
      setSyncingLayers(prev => ({ ...prev, [layer]: p }));
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
    }

    setDownloadedLayers(prev => {
      const next = prev.includes(layer) ? prev : [...prev, layer];
      localStorage.setItem('sky_nav_downloaded_layers', JSON.stringify(next));
      return next;
    });

    setSyncingLayers(prev => {
      const next = { ...prev };
      delete next[layer];
      return next;
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    const result = await searchAerodrome(searchQuery);
    if (result) {
      const wp: Waypoint = {
        id: `wp-${Date.now()}`,
        name: result.name,
        icao: result.icao,
        lat: result.lat,
        lng: result.lng,
        type: 'AIRPORT',
        description: 'Encontrado via busca.',
      };
      setWaypoints([...waypoints, wp]);
      setSearchQuery('');
      if (mapRef) mapRef.setView([result.lat, result.lng], 12);
    }
  };

  // Helper to get waypoint identifier for comparison
  const getWaypointIdentifier = (wp: Waypoint | NavPoint): string => {
    if ('icao' in wp && wp.icao) return wp.icao.toUpperCase();
    if ('name' in wp && wp.name) return wp.name.toUpperCase();
    return `${wp.lat.toFixed(6)},${wp.lng.toFixed(6)}`;
  };

  const handleAddWaypoint = (point: NavPoint, insertionType: 'ORIGIN' | 'DESTINATION' | 'WAYPOINT') => {
    const wp: Waypoint = {
      id: `wp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: point.name,
      icao: point.icao,
      lat: point.lat,
      lng: point.lng,
      type: (point.type === 'vor' ? 'VOR' : (point.type === 'ndb' || point.type === 'fix') ? 'FIX' : 'AIRPORT') as 'AIRPORT' | 'FIX' | 'VOR' | 'USER',
      description: point.type,
      role: insertionType,
    };

    setWaypoints(prev => {
      let next = [...prev];
      const newId = getWaypointIdentifier(wp);

      if (insertionType === 'ORIGIN') {
        // Check if first waypoint after origin would be the same
        if (next.length > 0) {
          const firstNonOrigin = next.find(w => w.role !== 'ORIGIN');
          if (firstNonOrigin && getWaypointIdentifier(firstNonOrigin) === newId) {
            alert('Não é permitido inserir o mesmo waypoint/aeródromo em sequência consecutiva.');
            return prev;
          }
        }
        
        // Sempre substitui o índice 0
        if (next.length > 0) {
          // Verifica se já existe uma origem e a substitui
          const originIndex = next.findIndex(w => w.role === 'ORIGIN');
          if (originIndex !== -1) {
            next[originIndex] = { ...wp, role: 'ORIGIN' };
          } else {
            // Se não tem origem, insere no início
            next.unshift({ ...wp, role: 'ORIGIN' });
          }
        } else {
          next = [{ ...wp, role: 'ORIGIN' }];
        }
      } else if (insertionType === 'DESTINATION') {
        // Check if last waypoint before destination would be the same
        const lastNonDest = [...next].reverse().find(w => w.role !== 'DESTINATION');
        if (lastNonDest && getWaypointIdentifier(lastNonDest) === newId) {
          alert('Não é permitido inserir o mesmo waypoint/aeródromo em sequência consecutiva.');
          return prev;
        }
        
        // Substitui o destino existente ou adiciona no final
        const destinationIndex = next.findIndex(w => w.role === 'DESTINATION');
        if (destinationIndex !== -1) {
          next[destinationIndex] = { ...wp, role: 'DESTINATION' };
        } else {
          // Se não tem destino, adiciona no final
          next.push({ ...wp, role: 'DESTINATION' });
        }
      } else {
        // WAYPOINT insertion - insere antes do destino se existir, senão no final
        const destinationIndex = next.findIndex(w => w.role === 'DESTINATION');
        const insertIndex = destinationIndex !== -1 ? destinationIndex : next.length;
        
        // Check for consecutive duplicates
        const prevWaypoint = insertIndex > 0 ? next[insertIndex - 1] : null;
        const nextWaypoint = insertIndex < next.length ? next[insertIndex] : null;
        
        if ((prevWaypoint && getWaypointIdentifier(prevWaypoint) === newId) ||
            (nextWaypoint && getWaypointIdentifier(nextWaypoint) === newId)) {
          alert('Não é permitido inserir o mesmo waypoint/aeródromo em sequência consecutiva.');
          return prev;
        }
        
        if (destinationIndex !== -1) {
          // Insere antes do destino
          next.splice(destinationIndex, 0, { ...wp, role: 'WAYPOINT' });
        } else {
          // Se não tem destino, adiciona no final
          next.push({ ...wp, role: 'WAYPOINT' });
        }
      }

      return next;
    });
  };

  const handleInvertRoute = () => {
    setWaypoints(prev => {
      if (prev.length < 2) return prev;

      const newWaypoints = [...prev].reverse().map((wp, index, arr) => {
        let role: 'ORIGIN' | 'DESTINATION' | 'WAYPOINT' = 'WAYPOINT';
        if (index === 0) role = 'ORIGIN';
        else if (index === arr.length - 1) role = 'DESTINATION';
        return { ...wp, role };
      });

      return newWaypoints;
    });
  };

  const handleInsertWaypoint = (waypoint: Waypoint, insertAfterIndex: number) => {
    setWaypoints(prev => {
      const newWaypoints = [...prev];
      // Insert after the specified index (so before the next waypoint in the segment)
      newWaypoints.splice(insertAfterIndex + 1, 0, waypoint);
      return newWaypoints;
    });
  };

  const handleMoveWaypoint = (id: string, direction: 'UP' | 'DOWN') => {
    setWaypoints(prev => {
      const index = prev.findIndex(w => w.id === id);
      if (index === -1) return prev;

      const newWaypoints = [...prev];
      if (direction === 'UP' && index > 0) {
        [newWaypoints[index], newWaypoints[index - 1]] = [newWaypoints[index - 1], newWaypoints[index]];
      } else if (direction === 'DOWN' && index < prev.length - 1) {
        [newWaypoints[index], newWaypoints[index + 1]] = [newWaypoints[index + 1], newWaypoints[index]];
      }

      return newWaypoints;
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Calculate flight segments
  const flightSegments: FlightSegment[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    const dist = calculateDistance(from.lat, from.lng, to.lat, to.lng);
    const trueBrng = calculateBearing(from.lat, from.lng, to.lat, to.lng);

    // Calculate magnetic variation at departure point (aviation standard)
    const magneticVariation = getMagneticDeclination(from.lat, from.lng);

    // Apply magnetic variation: Magnetic = True - Variation (West is negative in Brazil)
    const magneticTrack = applyMagneticVariation(trueBrng, magneticVariation);

    flightSegments.push({
      from,
      to,
      distance: dist,
      track: Math.round(magneticTrack),
      ete: formatTime(dist / (plannedSpeed || 100)),
      fuel: Math.round(dist * 1.3)
    });
  }

  const handleZoomIn = () => mapRef?.zoomIn();
  const handleZoomOut = () => mapRef?.zoomOut();
  const handleCenterOnUser = () => {
    if (userPos) {
      mapRef?.setView(userPos, mapRef.getZoom(), { animate: true });
    }
  };

  const handleToggleLayer = (layer: string) => {
    setActiveLayers(prev => {
      const isActivating = !prev.includes(layer);
      let next = isActivating ? [...prev, layer] : prev.filter(l => l !== layer);

      if (isActivating) {
        if (layer === 'HIGH') next = next.filter(l => l !== 'LOW' && l !== 'WAC');
        if (layer === 'LOW') next = next.filter(l => l !== 'HIGH' && l !== 'WAC');
        if (layer === 'WAC') next = next.filter(l => l !== 'HIGH' && l !== 'LOW');
      }

      localStorage.setItem('sky_nav_active_layers', JSON.stringify(next));
      return next;
    });
  };

  // Plan Management
  const handleSavePlan = (name: string) => {
    const newPlan: SavedPlan = {
      name,
      date: new Date().toISOString(),
      waypoints,
      aircraft: aircraftModel,
      speed: plannedSpeed
    };

    const nextList = [...savedPlans, newPlan];
    setSavedPlans(nextList);
    localStorage.setItem(KEY_SAVED_PLANS, JSON.stringify(nextList));
  };

  const handleLoadPlan = (plan: SavedPlan) => {
    setWaypoints(plan.waypoints);
    setAircraftModel(plan.aircraft);
    setPlannedSpeed(plan.speed);
  };

  const handleDeletePlan = (name: string) => {
    const nextList = savedPlans.filter(p => p.name !== name);
    setSavedPlans(nextList);
    localStorage.setItem(KEY_SAVED_PLANS, JSON.stringify(nextList));
  };

  // Handlers for the new menu
  const handleOpenCharts = (icao: string | null = null) => {
    setChartsModalIcao(icao);
    setShowChartsModal(true);
  };

  const handleOpenAerodromes = () => {
    console.log("Opening aerodromes menu");
    setShowAerodromeModal(true);
  };

  const handleOpenDownload = () => {
    console.log("Opening download menu");
    setShowDownloadModal(true);
  };

  if (loadingSession) { // Render a loading spinner or null while session is being checked
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0d1117]">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="flex h-screen w-screen bg-[#0d1117] text-slate-100 overflow-hidden font-sans select-none">
      {/* TOP LEFT MENU */}
      <TopLeftMenu
        onOpenCharts={handleOpenCharts}
        onOpenAerodromes={handleOpenAerodromes}
        onOpenDownload={handleOpenDownload}
      />

      {/* SIDEBAR */}
      <Sidebar
        userName={session.user.user_metadata?.full_name}
        userEmail={session.user.email}
        showPlanPanel={showPlanPanel}
        onTogglePlanPanel={() => setShowPlanPanel(!showPlanPanel)}
        isNightMode={isNightMode}
        onToggleNightMode={() => {
          const newValue = !isNightMode;
          setIsNightMode(newValue);
          localStorage.setItem('skyFplNightMode', String(newValue));
        }}
        onSignOut={handleSignOut}
        activeLayers={activeLayers}
        onToggleLayer={handleToggleLayer}
        downloadedLayers={downloadedLayers}
        onDownloadLayer={handleChartDownload}
        syncingLayers={syncingLayers}
        airac={airac}
        activeBaseMap={activeBaseMap}
        onBaseMapChange={setActiveBaseMap}
        onMenuStateChange={setIsSidebarMenuOpen}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* FLIGHT PLAN PANEL */}
        {showPlanPanel && (
          <FlightPlanPanel
            waypoints={waypoints}
            flightSegments={flightSegments}
            plannedSpeed={plannedSpeed}
            onPlannedSpeedChange={setPlannedSpeed}
            aircraftModel={aircraftModel}
            onAircraftModelChange={setAircraftModel}
            searchQuery={searchQuery}
            planViewMode={planViewMode}
            onSearchQueryChange={setSearchQuery}
            onSearch={handleSearch}
            onClearWaypoints={() => setWaypoints([])}
            onRemoveWaypoint={(id) => setWaypoints(waypoints.filter(w => w.id !== id))}
            onMoveWaypoint={handleMoveWaypoint}
            onPlanViewModeChange={setPlanViewMode}
            onAddWaypoint={handleAddWaypoint}
            onUpdateWaypoint={(id, updates) => setWaypoints(waypoints.map(w => w.id === id ? { ...w, ...updates } : w))}
            savedPlans={savedPlans}
            onSavePlan={handleSavePlan}
            onLoadPlan={handleLoadPlan}
            onDeletePlan={handleDeletePlan}
            onInvertRoute={handleInvertRoute}
            onOpenDownload={() => setShowFlightPlanDownloadModal(true)}
            onClose={() => setShowPlanPanel(false)}
          />
        )}

        {/* MAP CONTENT */}
        <div className="flex-1 relative">
          <MapControls
            isFollowing={isFollowing}
            onToggleFollowing={() => setIsFollowing(!isFollowing)}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onCenterOnUser={handleCenterOnUser}
          />

          <MapContainer
            center={[-15.78, -47.93]}
            zoom={5}
            className="h-full w-full"
            zoomControl={false}
            attributionControl={false}
            ref={setMapRef}
          >
            <MapUIControls
              showPlanPanel={showPlanPanel}
            />

            {/* Base Map Layer - terrain uses OpenTopoMap with elevation/relief/hillshading, roadmap respects isNightMode */}
            {/* TERRAIN: Shows contour lines, hillshading, vegetation, hydrography. Max zoom ~17 (detail fades at higher zooms) */}
            {/* ROADMAP: Full street detail, respects night mode for dark/light theme */}
            {activeBaseMap === 'terrain' ? (
              <TileLayer
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                maxZoom={17}
                attribution='Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
              />
            ) : isNightMode ? (
              // Roadmap Dark (Night Mode ON)
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='© OpenStreetMap contributors, © CARTO'
              />
            ) : (
              // Roadmap Light (Night Mode OFF)
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='© OpenStreetMap contributors'
              />
            )}

            {userPos && <Marker position={userPos} icon={planeIcon} zIndexOffset={1000} />}

            {waypoints.map((wp) => {
              // Format coordinates for USER waypoints
              const formatCoord = (lat: number, lng: number): string => {
                const latDir = lat >= 0 ? 'N' : 'S';
                const lngDir = lng >= 0 ? 'E' : 'W';
                const latDeg = Math.abs(lat);
                const lngDeg = Math.abs(lng);
                const latMin = (latDeg % 1) * 60;
                const lngMin = (lngDeg % 1) * 60;
                return `${Math.floor(latDeg)}°${latMin.toFixed(2)}'${latDir} ${Math.floor(lngDeg)}°${lngMin.toFixed(2)}'${lngDir}`;
              };
              
              // Check if waypoint name is a coordinate pattern
              const isCoordinateName = (name: string): boolean => {
                return /^\d+°\d+\.\d+'.+\d+°\d+\.\d+'/.test(name);
              };
              
              // Check if USER waypoint has a custom name (not coordinates)
              const hasCustomName = wp.type === 'USER' && wp.name && !isCoordinateName(wp.name);
              const coordString = formatCoord(wp.lat, wp.lng);
              
              return (
                <Marker key={wp.id} position={[wp.lat, wp.lng]} icon={defaultIcon}>
                  {/* Tooltip for USER waypoints showing coordinates and optional name */}
                  {wp.type === 'USER' && (
                    <Tooltip 
                      direction="top" 
                      offset={[0, -40]} 
                      opacity={0.95}
                      className="user-waypoint-tooltip"
                    >
                      <div style={{ 
                        fontSize: '11px', 
                        fontWeight: 'bold', 
                        textAlign: 'center',
                        padding: '4px 8px',
                        background: '#fae8ff',
                        borderRadius: '4px',
                        color: '#a21caf'
                      }}>
                        {hasCustomName && (
                          <div style={{ marginBottom: '2px', color: '#7e22ce' }}>📍 {wp.name}</div>
                        )}
                        <div style={{ fontSize: '10px', opacity: 0.9 }}>
                          Ponto em {coordString}
                        </div>
                      </div>
                    </Tooltip>
                  )}
                  <Popup><div className="p-2 font-black text-[10px] uppercase text-purple-400">{wp.name}</div></Popup>
                </Marker>
              );
            })}

            {/* Route rendered in NavigationLayer */}

            {/* DECEA WMS Layers */}
            {activeLayers.includes('HIGH') && (
              <WMSTileLayer
                url="https://geoaisweb.decea.mil.br/geoserver/wms"
                layers="ICA:ENRC_H1,ICA:ENRC_H2,ICA:ENRC_H3,ICA:ENRC_H4,ICA:ENRC_H5,ICA:ENRC_H6,ICA:ENRC_H7,ICA:ENRC_H8,ICA:ENRC_H9"
                format="image/png"
                transparent={true}
                version="1.3.0"
                opacity={0.8}
                zIndex={100}
              />
            )}

            {activeLayers.includes('LOW') && (
              <WMSTileLayer
                url="https://geoaisweb.decea.mil.br/geoserver/wms"
                layers="ICA:ENRC_L1,ICA:ENRC_L2,ICA:ENRC_L3,ICA:ENRC_L4,ICA:ENRC_L5,ICA:ENRC_L6,ICA:ENRC_L7,ICA:ENRC_L8,ICA:ENRC_L9"
                format="image/png"
                transparent={true}
                version="1.3.0"
                opacity={0.8}
                zIndex={100}
              />
            )}

            {activeLayers.includes('WAC') && (
              <>
                {/* WAC Group 1 (North/Northwest) */}
                <WMSTileLayer
                  url="https://geoaisweb.decea.mil.br/geoserver/wms"
                  layers={[
                    'ICA:WAC_2825_CABO_ORANGE',
                    'ICA:WAC_2826_MONTE_RORAIMA',
                    'ICA:WAC_2827_SERRA_PACARAIMA',
                    'ICA:WAC_2892_PICO_DA_NEBLINA',
                    'ICA:WAC_2893_BOA_VISTA',
                    'ICA:WAC_2894_TUMUCUMAQUE',
                    'ICA:WAC_2895_MACAPA',
                    'ICA:WAC_2944_FORTALEZA',
                    'ICA:WAC_2945_SAO_LUIS',
                    'ICA:WAC_2946_BELEM',
                    'ICA:WAC_2947_SANTAREM',
                    'ICA:WAC_2948_MANAUS',
                    'ICA:WAC_2949_SAO_GABRIEL_DA_CACHOEIRA',
                    'ICA:WAC_3012_CRUZEIRO_DO_SUL',
                    'ICA:WAC_3013_TABATINGA'
                  ].join(',')}
                  format="image/png"
                  transparent={true}
                  version="1.1.1"
                  opacity={0.8}
                  zIndex={114}
                />

                {/* WAC Group 2 (Center/Northeast) */}
                <WMSTileLayer
                  url="https://geoaisweb.decea.mil.br/geoserver/wms"
                  layers={[
                    'ICA:WAC_3014_HUMAITA',
                    'ICA:WAC_3015_ITAITUBA',
                    'ICA:WAC_3016_IMPERATRIZ',
                    'ICA:WAC_3017_TERESINA',
                    'ICA:WAC_3018_NATAL',
                    'ICA:WAC_3019_FERNANDO_DE_NORONHA',
                    'ICA:WAC_3066_RECIFE',
                    'ICA:WAC_3067_PETROLINA',
                    'ICA:WAC_3068_PORTO_NACIONAL',
                    'ICA:WAC_3069_CACHIMBO',
                    'ICA:WAC_3070_JI_PARANA',
                    'ICA:WAC_3071_PORTO_VELHO',
                    'ICA:WAC_3072_TARAUACA',
                    'ICA:WAC_3137_PRINCIPE_DA_BEIRA',
                    'ICA:WAC_3138_CUIABA'
                  ].join(',')}
                  format="image/png"
                  transparent={true}
                  version="1.1.1"
                  opacity={0.8}
                  zIndex={114}
                />

                {/* WAC Group 3 (South/Southeast) */}
                <WMSTileLayer
                  url="https://geoaisweb.decea.mil.br/geoserver/wms"
                  layers={[
                    'ICA:WAC_3139_ARAGARCAS',
                    'ICA:WAC_3140_BRASILIA',
                    'ICA:WAC_3141_SALVADOR',
                    'ICA:WAC_3189_BELO_HORIZONTE',
                    'ICA:WAC_3190_GOIANIA',
                    'ICA:WAC_3191_RONDONOPOLIS',
                    'ICA:WAC_3192_CORUMBA',
                    'ICA:WAC_3260_BELA_VISTA',
                    'ICA:WAC_3261_CAMPO_GRANDE',
                    'ICA:WAC_3262_SAO_PAULO',
                    'ICA:WAC_3263_RIO_DE_JANEIRO',
                    'ICA:WAC_3313_CURITIBA',
                    'ICA:WAC_3314_FOZ_DO_IGUACU',
                    'ICA:WAC_3383_URUGUAIANA',
                    'ICA:WAC_3384_PORTO_ALEGRE',
                    'ICA:WAC_3434_RIO_DA_PRATA'
                  ].join(',')}
                  format="image/png"
                  transparent={true}
                  version="1.1.1"
                  opacity={0.8}
                  zIndex={114}
                />
              </>
            )}

            {activeLayers.includes('REA') && (
              <>
                {/* REA / CCV - Specialized Layer for Recife to ensure loading reliability */}
                <WMSTileLayer
                  url="https://geoaisweb.decea.mil.br/geoserver/wms"
                  layers="ICA:CCV_REA_WF_RECIFE"
                  format="image/png"
                  transparent={true}
                  version="1.1.1"
                  opacity={0.9}
                  zIndex={115}
                />

                {/* REA / CCV Paper-style Georeferenced Charts (Group 1A) - v1.1.1 for raster compatibility */}
                <WMSTileLayer
                  url="https://geoaisweb.decea.mil.br/geoserver/wms"
                  layers="ICA:CCV_REA_CY_CUIABA,ICA:CCV_REA_WA_TABATINGA,ICA:CCV_REA_WB_BELEM,ICA:CCV_REA_WG_CAMPO_GRANDE,ICA:CCV_REA_WH_BELO_HORIZONTE"
                  format="image/png"
                  transparent={true}
                  version="1.1.1"
                  opacity={0.9}
                  zIndex={116}
                />

                {/* REA / CCV Paper-style Georeferenced Charts (Group 1B) - v1.1.1 for raster compatibility */}
                <WMSTileLayer
                  url="https://geoaisweb.decea.mil.br/geoserver/wms"
                  layers="ICA:CCV_REA_WJ1_RIO_DE_JANEIRO,ICA:CCV_REA_WK_PORTO_SEGURO,ICA:CCV_REA_WN2_MANAUS,ICA:CCV_REA_WP_PORTO_ALEGRE,ICA:CCV_REA_WR_BRASILIA"
                  format="image/png"
                  transparent={true}
                  version="1.1.1"
                  opacity={0.9}
                  zIndex={117}
                />

                {/* REA / CCV Paper-style Georeferenced Charts (Group 2) - v1.1.1 for raster compatibility */}
                <WMSTileLayer
                  url="https://geoaisweb.decea.mil.br/geoserver/wms"
                  layers="ICA:CCV_REA_WS_SAO_LUIS,ICA:CCV_REA_WX_SANTAREM,ICA:CCV_REA_WZ_FORTALEZA,ICA:CCV_REA_XF_FLORIANOPOLIS,ICA:CCV_REA_XK_MACAPA,ICA:CCV_REA_XN-ANAPOLIS,ICA:CCV_REA_XP1_SAO_PAULO,ICA:CCV_REA_XP2_SAO_PAULO,ICA:CCV_REA_XR_VITORIA,ICA:CCV_REA_XS_SALVADOR,ICA:CCV_REA_XT_NATAL"
                  format="image/png"
                  transparent={true}
                  version="1.1.1"
                  opacity={0.9}
                  zIndex={118}
                />
              </>
            )}

            {/* DYNAMIC NAVIGATION DATA (Airports, Navaids, Route) */}
            <NavigationLayer
              onPointSelect={(point) => handleAddWaypoint(point, 'WAYPOINT')}
              waypoints={waypoints}
              flightSegments={flightSegments}
              aircraftPosition={userPos ?? undefined}
              hideLockButton={showPlanPanel || isSidebarMenuOpen}
              onInsertWaypoint={handleInsertWaypoint}
            />
          </MapContainer>
        </div>
      </div>

      {/* Charts Modal */}
      <ChartsModal
        isOpen={showChartsModal}
        onClose={() => {
          setShowChartsModal(false);
          setChartsModalIcao(null);
        }}
        initialIcao={chartsModalIcao}
      />

      {/* Aerodrome Modal */}
      <AerodromeModal
        isOpen={showAerodromeModal}
        onClose={() => setShowAerodromeModal(false)}
        onOpenCharts={handleOpenCharts}
      />

      {/* Download Modal */}
      <DownloadModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        waypoints={waypoints}
        flightSegments={flightSegments}
        aircraftModel={aircraftModel}
        plannedSpeed={plannedSpeed}
        downloadedLayers={downloadedLayers}
        syncingLayers={syncingLayers}
        onDownloadLayer={handleChartDownload}
      />

      {/* Flight Plan Download Modal */}
      <FlightPlanDownloadModal
        isOpen={showFlightPlanDownloadModal}
        onClose={() => setShowFlightPlanDownloadModal(false)}
        waypoints={waypoints}
        flightSegments={flightSegments}
        aircraftModel={aircraftModel}
        plannedSpeed={plannedSpeed}
      />

      {/* PWA Update Prompt */}
      <PWAUpdatePrompt />
    </div>
  );
};

export default App;



