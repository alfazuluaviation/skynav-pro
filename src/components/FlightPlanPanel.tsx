import React, { useState, useEffect } from 'react';
import { Waypoint, FlightSegment, SavedPlan } from '../types';
import { NavPoint } from '../services/NavigationDataService';
import { AutocompleteInput } from './AutocompleteInput';
import { UserAircraft, loadUserAircraft } from '../utils/aircraftData';
import { IconPlane, IconTrash, IconSwap, IconArrowUp, IconArrowDown, IconLocation, IconMaximize, IconDisk, IconFolder, IconDownload, IconEdit } from './Icons';

// Format coordinates to DMS format like "12°28.77'S 38°10.66'W"
const formatCoordDMS = (lat: number, lng: number): string => {
  const formatDMS = (coord: number, isLat: boolean): string => {
    const abs = Math.abs(coord);
    const deg = Math.floor(abs);
    const minDecimal = (abs - deg) * 60;
    const dir = isLat 
      ? (coord >= 0 ? 'N' : 'S')
      : (coord >= 0 ? 'E' : 'W');
    return `${deg}°${minDecimal.toFixed(2)}'${dir}`;
  };
  return `${formatDMS(lat, true)} ${formatDMS(lng, false)}`;
};

interface FlightPlanPanelProps {
  waypoints: Waypoint[];
  flightSegments: FlightSegment[];
  plannedSpeed: number;
  onPlannedSpeedChange: (speed: number) => void;
  aircraftModel: { id: string, label: string, speed: number } | null;
  onAircraftModelChange: (model: { id: string, label: string, speed: number }) => void;
  searchQuery: string;
  planViewMode: 'ETAPA' | 'ACUMULADO';
  onSearchQueryChange: (query: string) => void;
  onSearch: (e: React.FormEvent) => void;
  onClearWaypoints: () => void;
  onRemoveWaypoint: (id: string) => void;
  onMoveWaypoint: (id: string, direction: 'UP' | 'DOWN') => void;
  onPlanViewModeChange: (mode: 'ETAPA' | 'ACUMULADO') => void;
  onAddWaypoint: (point: NavPoint, type: 'ORIGIN' | 'DESTINATION' | 'WAYPOINT') => void;
  onUpdateWaypoint?: (id: string, updates: Partial<Waypoint>) => void;
  savedPlans: SavedPlan[];
  onSavePlan: (name: string) => void;
  onLoadPlan: (plan: SavedPlan) => void;
  onDeletePlan: (name: string) => void;
  onInvertRoute?: () => void;
  onOpenDownload?: () => void;
  onClose?: () => void;
}

export const FlightPlanPanel: React.FC<FlightPlanPanelProps> = ({
  waypoints,
  flightSegments,
  plannedSpeed,
  onPlannedSpeedChange,
  aircraftModel,
  onAircraftModelChange,
  onClearWaypoints,
  onRemoveWaypoint,
  onMoveWaypoint,
  onAddWaypoint,
  onUpdateWaypoint,
  savedPlans,
  onSavePlan,
  onLoadPlan,
  onDeletePlan,
  onInvertRoute,
  onOpenDownload,
  onClose
}) => {
  const origin = waypoints.find(w => w.role === 'ORIGIN') || null;
  const destination = waypoints.find(w => w.role === 'DESTINATION') || null;
  
  const [isAircraftOpen, setIsAircraftOpen] = useState(false);
  const [aircraftQuery, setAircraftQuery] = useState(aircraftModel?.label || '');
  const [userAircraft, setUserAircraft] = useState<UserAircraft[]>([]);
  const [isExpanded, setIsExpandedState] = useState(false);

  // Load user aircraft on mount and when dropdown opens
  useEffect(() => {
    setUserAircraft(loadUserAircraft());
  }, []);

  useEffect(() => {
    if (isAircraftOpen) {
      setUserAircraft(loadUserAircraft());
    }
  }, [isAircraftOpen]);
  
  // Expose isExpanded through a callback prop if needed for parent
  const setIsExpanded = (val: boolean) => {
    setIsExpandedState(val);
    // Dispatch custom event for lock button visibility
    window.dispatchEvent(new CustomEvent('flightPlanExpandedChange', { detail: { expanded: val } }));
  };
  
  // Save/Load Modal States
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  
  // Edit USER waypoint name
  const [editingWaypointId, setEditingWaypointId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Helper to check if a waypoint name looks like coordinates
  const isCoordinateName = (name: string): boolean => {
    // Matches patterns like "12°30.50'N 45°20.30'W" or similar coordinate formats
    return /^\d+°\d+\.\d+'.+\d+°\d+\.\d+'/.test(name);
  };

  // Get display name for waypoint - show coordinate from description if name is coordinates
  const getWaypointDisplayName = (wp: Waypoint): string => {
    if (wp.type === 'USER') {
      // If name is a coordinate pattern, show it directly
      if (isCoordinateName(wp.name)) {
        return wp.name;
      }
      // Otherwise show the custom name
      return wp.name;
    }
    return wp.icao || wp.name;
  };

  // Get coordinate string for USER waypoints (from description)
  const getCoordinateString = (wp: Waypoint): string | null => {
    if (wp.type === 'USER' && wp.description) {
      return wp.description;
    }
    return null;
  };

  // Handle starting edit of USER waypoint name
  const handleStartEditName = (wp: Waypoint) => {
    if (wp.type === 'USER') {
      setEditingWaypointId(wp.id);
      // If name is coordinates, start with empty for custom name
      setEditingName(isCoordinateName(wp.name) ? '' : wp.name);
    }
  };

  // Handle saving edited name
  const handleSaveEditName = (wp: Waypoint) => {
    if (editingWaypointId && onUpdateWaypoint) {
      const newName = editingName.trim();
      // If empty, revert to coordinates
      const finalName = newName || wp.description || wp.name;
      onUpdateWaypoint(wp.id, { name: finalName });
    }
    setEditingWaypointId(null);
    setEditingName('');
  };

  useEffect(() => {
    setAircraftQuery(aircraftModel?.label || '');
  }, [aircraftModel]);

  // Filter user's saved aircraft - show all when query is empty or matches current selection
  const filteredAircraft = userAircraft.filter(ac => {
    // If query is empty or matches the current selection, show all user aircraft
    if (!aircraftQuery.trim() || aircraftQuery === (aircraftModel?.label || '')) {
      return true;
    }
    return ac.label.toLowerCase().includes(aircraftQuery.toLowerCase()) || 
      ac.registration.toLowerCase().includes(aircraftQuery.toLowerCase()) ||
      ac.id.toLowerCase().includes(aircraftQuery.toLowerCase());
  });

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (planName.trim()) {
      onSavePlan(planName);
      setPlanName('');
      setIsSaveModalOpen(false);
    }
  };

  const handleClearAll = () => {
    if (window.confirm("Tem certeza que quer apagar todo o Plano de Voo?")) {
      onClearWaypoints();
    }
  };

  return (
    <>
      {/* Mobile: Full screen overlay / Desktop: Fixed width panel - entire panel is scrollable */}
      <section className="fixed inset-0 md:relative md:inset-auto w-full md:w-[420px] h-full md:h-auto max-h-screen bg-slate-900/95 md:bg-slate-900/95 backdrop-blur-xl md:border-r border-slate-700/50 flex flex-col z-[1001] shadow-2xl md:shrink-0 animate-in md:slide-in-from-left duration-300 overflow-y-auto overflow-x-hidden custom-scrollbar touch-scroll">
        {/* Mobile Header with close button */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 safe-top">
          <h2 className="text-lg font-black text-white">Plano de Voo</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Header / Info & Search Inputs */}
        <div className="p-4 bg-slate-900/50 border-b border-slate-800/50">
          {/* Aircraft Info & Speed Inputs */}
          <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-3 sm:gap-2">
            {/* Aircraft Input */}
            <div className="w-full sm:flex-1 relative">
              <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1">Aeronave</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-400">
                  <IconPlane />
                </div>
                <input
                  type="text"
                  className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 text-sm sm:text-xs font-bold rounded-lg pl-9 pr-3 py-3 sm:py-2 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all uppercase placeholder-slate-600"
                  placeholder={userAircraft.length > 0 ? "Selecionar Aeronave..." : ""}
                  value={aircraftQuery}
                  onChange={(e) => {
                    setAircraftQuery(e.target.value);
                    setIsAircraftOpen(true);
                  }}
                  onFocus={() => setIsAircraftOpen(true)}
                  onBlur={() => setTimeout(() => setIsAircraftOpen(false), 200)}
                  readOnly={userAircraft.length === 0}
                />
                {isAircraftOpen && filteredAircraft.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50 max-h-48 overflow-y-auto">
                    {filteredAircraft.map(ac => (
                      <button
                        key={ac.registration}
                        type="button"
                        className="w-full text-left px-3 py-3 sm:py-2 text-sm sm:text-xs font-bold text-slate-300 hover:bg-purple-500/20 hover:text-white transition-colors flex flex-col group active:bg-purple-500/30"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onAircraftModelChange(ac);
                          onPlannedSpeedChange(ac.speed);
                          setAircraftQuery(`${ac.registration} - ${ac.label}`);
                          setIsAircraftOpen(false);
                        }}
                      >
                        <div className="flex justify-between w-full">
                          <span className="text-white">{ac.registration}</span>
                          <span className="text-slate-500 group-hover:text-purple-300">{ac.speed} KT</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{ac.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Speed Input */}
            <div className="w-full sm:w-24">
              <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1 sm:text-right">Velocidade</label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 text-sm sm:text-xs font-bold rounded-lg pl-3 pr-8 py-3 sm:py-2 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all text-right"
                  value={plannedSpeed}
                  onChange={(e) => onPlannedSpeedChange(Number(e.target.value))}
                />
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                  <span className="text-[10px] font-black text-slate-500">KT</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Inputs */}
          <div className="space-y-3">
            {/* Origem */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-teal-500 uppercase tracking-widest ml-1">Origem</label>
              <AutocompleteInput
                placeholder="Buscar Aeródromo..."
                icon={<IconLocation />}
                value={origin ? `${origin.icao || origin.name}` : ''}
                onSelect={(pt) => onAddWaypoint(pt, 'ORIGIN')}
              />
            </div>
            
            {/* Waypoints */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Waypoints / Fixos</label>
              <AutocompleteInput
                placeholder="Adicionar ponto intermediário..."
                onSelect={(pt) => onAddWaypoint(pt, 'WAYPOINT')}
              />
            </div>
            
            {/* Destino */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-purple-500 uppercase tracking-widest ml-1">Destino</label>
              <AutocompleteInput
                placeholder="Buscar Aeródromo..."
                icon={<IconLocation />}
                value={destination ? `${destination.icao || destination.name}` : ''}
                onSelect={(pt) => onAddWaypoint(pt, 'DESTINATION')}
              />
            </div>
          </div>
        </div>
        
        {/* Toolbar */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Rota
          </span>
          <div className="flex gap-1">
            <button onClick={() => setIsSaveModalOpen(true)} title="Salvar Plano" className="p-2 sm:p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-green-400 transition-colors active:bg-slate-700">
              <IconDisk />
            </button>
            <button onClick={() => setIsLoadModalOpen(true)} title="Carregar Plano" className="p-2 sm:p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-blue-400 transition-colors active:bg-slate-700">
              <IconFolder />
            </button>
            <button onClick={onOpenDownload} title="Download do Plano de Voo" className="p-2 sm:p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-cyan-400 transition-colors active:bg-slate-700">
              <IconDownload />
            </button>
            <div className="w-px h-4 bg-slate-700 mx-1 self-center"></div>
            <button onClick={() => setIsExpanded(true)} title="Visualizar Plano de Voo" className="flex p-2 sm:p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors items-center gap-1 active:bg-slate-700">
              <IconMaximize />
            </button>
            <button onClick={onInvertRoute} title="Inverter Plano de Voo" className="p-2 sm:p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors active:bg-slate-700">
              <IconSwap />
            </button>
            <button onClick={handleClearAll} title="Limpar Plano de Voo" className="p-2 sm:p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors active:bg-red-500/20">
              <IconTrash />
            </button>
          </div>
        </div>
        
        {/* List - Compact View - No height restrictions, content expands naturally */}
        <div className="bg-[#0b0e14] p-4 space-y-2 pb-24">
          {waypoints.length === 0 ? (
            <div className="text-center py-8 opacity-30">
              <p className="text-[10px] uppercase font-bold">Nenhuma rota definida</p>
            </div>
          ) : (
            waypoints.map((wp, i) => {
              const segment = flightSegments[i];
              const isOrigin = wp.role === 'ORIGIN';
              const isDest = wp.role === 'DESTINATION';
              const isUserWaypoint = wp.type === 'USER';
              const isEditing = editingWaypointId === wp.id;
              const coordinateStr = getCoordinateString(wp);
              const displayName = getWaypointDisplayName(wp);
              const hasCustomName = isUserWaypoint && !isCoordinateName(wp.name);
              
              return (
                <div 
                  key={wp.id} 
                  className={`relative group border rounded-xl p-3 transition-colors ${
                    isOrigin ? 'bg-teal-500/10 border-teal-500/30' : 
                    isDest ? 'bg-purple-500/10 border-purple-500/30' : 
                    'bg-slate-800/20 border-slate-800 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-black flex-shrink-0 ${
                        isOrigin ? 'bg-teal-400' : 
                        isDest ? 'bg-purple-400' : 
                        isUserWaypoint ? 'bg-amber-500' :
                        'bg-yellow-400'
                      }`}>
                        {isOrigin ? 'DEP' : isDest ? 'ARR' : (wp.type ? wp.type.substring(0, 3) : 'WPT')}
                      </span>
                      
                      {/* Display waypoint name/coordinates */}
                      {isEditing ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="text"
                            autoFocus
                            className="flex-1 px-2 py-1 text-sm bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-purple-500"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditName(wp);
                              if (e.key === 'Escape') {
                                setEditingWaypointId(null);
                                setEditingName('');
                              }
                            }}
                            onBlur={() => handleSaveEditName(wp)}
                            placeholder="Nome do ponto"
                            maxLength={20}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col flex-1 min-w-0">
                          {/* For USER waypoints: show custom name or coordinates */}
                          {isUserWaypoint ? (
                            hasCustomName ? (
                              <>
                                <span className="font-bold truncate text-amber-300">
                                  {displayName}
                                </span>
                                {coordinateStr && (
                                  <span className="text-[9px] text-slate-500 font-mono truncate">
                                    {coordinateStr}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="font-bold truncate text-slate-200">
                                {coordinateStr || displayName}
                              </span>
                            )
                          ) : (
                            /* For non-USER waypoints: show ICAO or name directly */
                            <span className="font-bold truncate text-slate-200">
                              {wp.icao || wp.name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {/* Edit button for USER waypoints */}
                      {isUserWaypoint && !isEditing && (
                        <button 
                          onClick={() => handleStartEditName(wp)} 
                          className="p-2 sm:p-1 hover:text-amber-400 active:text-amber-300"
                          title="Renomear ponto"
                        >
                          <IconEdit />
                        </button>
                      )}
                      {!isOrigin && !isDest && (
                        <>
                          <button onClick={() => onMoveWaypoint(wp.id, 'UP')} className="p-2 sm:p-1 hover:text-purple-400 active:text-purple-300"><IconArrowUp /></button>
                          <button onClick={() => onMoveWaypoint(wp.id, 'DOWN')} className="p-2 sm:p-1 hover:text-purple-400 active:text-purple-300"><IconArrowDown /></button>
                        </>
                      )}
                      <button onClick={() => onRemoveWaypoint(wp.id)} className="p-2 sm:p-1 hover:text-red-400 active:text-red-300"><IconTrash /></button>
                    </div>
                  </div>
                  {segment && (
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>{segment.track}° / {segment.distance.toFixed(0)}NM</span>
                      <span>{segment.ete}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        
        {/* Footer Totals */}
        {waypoints.length > 1 && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.5)] mb-16 md:mb-0">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Distância Total</span>
              <span className="text-xl font-black text-purple-400">
                {flightSegments.reduce((acc, s) => acc + s.distance, 0).toFixed(0)} <span className="text-sm text-slate-500">NM</span>
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tempo Total</span>
              <span className="text-xl font-black text-slate-200">
                {((flightSegments.reduce((acc, s) => acc + s.distance, 0) / plannedSpeed)).toFixed(1).replace('.', ':')} <span className="text-sm text-slate-500">H</span>
              </span>
            </div>
          </div>
        )}
      </section>
      
      {/* EXPANDED MODAL */}
      {isExpanded && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-10 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl h-[95vh] sm:h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div>
                <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-3">
                  <IconMaximize /> PLANO DE VOO
                </h2>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">{aircraftModel?.label || 'Aeronave não selecionada'} @ {plannedSpeed} KT</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={onOpenDownload} title="Download do Plano de Voo" className="px-3 sm:px-4 py-2 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 rounded-lg text-white font-bold transition-colors flex items-center gap-2 text-sm">
                  <IconDownload /> <span className="hidden sm:inline">DOWNLOAD</span>
                </button>
                <button onClick={() => setIsExpanded(false)} className="px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-white font-bold transition-colors text-sm">
                  FECHAR
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 sm:p-6 touch-scroll">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead className="text-[10px] uppercase font-black text-slate-500 tracking-widest bg-slate-950/50 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 sm:p-4 rounded-tl-lg">Ponto</th>
                      <th className="p-3 sm:p-4">Tipo</th>
                      <th className="p-3 sm:p-4 hidden sm:table-cell">Coordenadas</th>
                      <th className="p-3 sm:p-4 text-right">Rumo</th>
                      <th className="p-3 sm:p-4 text-right">Dist.</th>
                      <th className="p-3 sm:p-4 text-right">ETE</th>
                      <th className="p-3 sm:p-4 text-right rounded-tr-lg hidden sm:table-cell">Acum.</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-bold text-slate-300 divide-y divide-slate-800">
                    {waypoints.map((wp, i) => {
                      const segment = flightSegments[i];
                      const inboundSegment = i > 0 ? flightSegments[i - 1] : null;
                      const accumulatedDist = flightSegments.slice(0, i).reduce((acc, s) => acc + s.distance, 0);
                      const isUserWaypoint = wp.type === 'USER';
                      const displayName = getWaypointDisplayName(wp);
                      const hasCustomName = isUserWaypoint && !isCoordinateName(wp.name);
                      
                      return (
                        <tr key={wp.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-3 sm:p-4 font-mono text-sm sm:text-base">
                            <div className="flex flex-col">
                              {hasCustomName ? (
                                <>
                                  <span className="text-amber-300">{displayName}</span>
                                  {wp.description && (
                                    <span className="text-[10px] text-slate-500">{wp.description}</span>
                                  )}
                                </>
                              ) : isUserWaypoint ? (
                                <span className="text-white">Coordenada</span>
                              ) : (
                                <span className="text-white">{displayName}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <span className={`text-[9px] font-bold px-2 py-1 rounded text-black ${
                              wp.role === 'ORIGIN' ? 'bg-teal-400' : 
                              wp.role === 'DESTINATION' ? 'bg-purple-400' : 
                              isUserWaypoint ? 'bg-amber-500' :
                              'bg-yellow-400'
                            }`}>
                              {wp.role === 'ORIGIN' ? 'DEP' : wp.role === 'DESTINATION' ? 'ARR' : wp.type?.substring(0, 3) || 'WPT'}
                            </span>
                          </td>
                          <td className="p-3 sm:p-4 font-mono text-slate-500 text-xs hidden sm:table-cell">
                            {formatCoordDMS(wp.lat, wp.lng)}
                          </td>
                          <td className="p-3 sm:p-4 text-right font-mono text-purple-400">
                            {inboundSegment ? `${inboundSegment.track}°` : '-'}
                          </td>
                          <td className="p-3 sm:p-4 text-right font-mono">
                            {inboundSegment ? inboundSegment.distance.toFixed(1) : '-'}
                          </td>
                          <td className="p-3 sm:p-4 text-right font-mono text-teal-400">
                            {inboundSegment ? inboundSegment.ete : '-'}
                          </td>
                          <td className="p-3 sm:p-4 text-right font-mono text-slate-400 hidden sm:table-cell">
                            {accumulatedDist > 0 ? accumulatedDist.toFixed(1) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-900/80 border-t-2 border-slate-700">
                    <tr>
                      <td colSpan={3} className="p-3 sm:p-4 text-right font-black uppercase text-slate-500 hidden sm:table-cell">Totais</td>
                      <td colSpan={2} className="p-3 sm:p-4 text-right font-black uppercase text-slate-500 sm:hidden">Totais</td>
                      <td className="p-3 sm:p-4 text-right font-black text-white text-base sm:text-lg whitespace-nowrap">
                        Distância total: {flightSegments.reduce((acc, s) => acc + s.distance, 0).toFixed(1)} NM
                      </td>
                      <td className="p-3 sm:p-4 text-right font-black text-white text-base sm:text-lg whitespace-nowrap">
                        Tempo de voo: {(() => {
                          // Sum ETEs by parsing HH:MM format to ensure consistency with individual segments
                          let totalMinutes = 0;
                          flightSegments.forEach(s => {
                            if (s.ete && s.ete !== '--:--') {
                              const [h, m] = s.ete.split(':').map(Number);
                              totalMinutes += h * 60 + m;
                            }
                          });
                          const hours = Math.floor(totalMinutes / 60);
                          const minutes = totalMinutes % 60;
                          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                        })()} h
                      </td>
                      <td className="hidden sm:table-cell"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* SAVE PLAN MODAL */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 animate-slide-up sm:animate-in">
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
            <h3 className="text-xl font-black text-white mb-4">Salvar Plano de Voo</h3>
            <form onSubmit={handleSaveSubmit}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome do Plano</label>
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 sm:py-2 text-white focus:border-green-500/50 focus:outline-none text-base sm:text-sm"
                  placeholder="Ex: Voo SBGR-SBRJ"
                  value={planName}
                  onChange={e => setPlanName(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsSaveModalOpen(false)} className="px-4 py-3 sm:py-2 rounded-lg text-slate-400 hover:text-white font-bold active:bg-slate-800">Cancelar</button>
                <button type="submit" className="px-4 py-3 sm:py-2 bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-lg text-white font-bold">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* LOAD PLAN MODAL */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-slide-up sm:animate-in">
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mt-3 sm:hidden" />
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-xl font-black text-white mb-1">Carregar Plano</h3>
              <p className="text-slate-500 text-xs">Selecione um plano salvo para carregar.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 touch-scroll">
              {savedPlans && savedPlans.length === 0 ? (
                <div className="text-center py-8 text-slate-600 font-bold text-xs uppercase">Nenhum plano salvo.</div>
              ) : (
                savedPlans && savedPlans.map((plan, i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-between p-4 sm:p-3 bg-slate-800/30 border border-slate-800 hover:bg-slate-800 active:bg-slate-700 hover:border-blue-500/30 rounded-lg group transition-colors cursor-pointer"
                    onClick={() => {
                      onLoadPlan(plan);
                      setIsLoadModalOpen(false);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm truncate">{plan.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        {plan.date ? new Date(plan.date).toLocaleDateString() : 'Data não disponível'} • {plan.waypoints ? plan.waypoints.length : 0} pontos
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Deletar este plano?')) onDeletePlan(plan.name);
                      }} 
                      className="p-2 text-slate-600 hover:text-red-400 active:text-red-300 transition-colors"
                    >
                      <IconTrash />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-end safe-bottom">
              <button onClick={() => setIsLoadModalOpen(false)} className="px-4 py-3 sm:py-2 rounded-lg text-slate-400 hover:text-white font-bold active:bg-slate-800">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
