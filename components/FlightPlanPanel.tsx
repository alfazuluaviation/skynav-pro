import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
import { Waypoint, FlightSegment, SavedPlan } from '../types';
import { NavPoint } from '../services/NavigationDataService';
import { AutocompleteInput } from './AutocompleteInput';
import { commonAircraft } from '../utils/aircraftData';
import { 
  IconPlane, IconTrash, IconSwap, IconLocation, IconMaximize, 
  IconDisk, IconFolder 
} from './Icons';

// Função interna para evitar erro de arquivo ausente (utils/geo)
const calculateMagDeclination = (lat: number, lng: number): number => {
  // Simplificação para fins de exibição. 
  // Em uma versão final, você pode importar uma biblioteca como 'geomagnetism'
  return -20; // Valor médio aproximado para o Brasil
};

interface FlightPlanPanelProps {
  waypoints: Waypoint[];
  flightSegments: FlightSegment[];
  plannedSpeed: number;
  onPlannedSpeedChange: (speed: number) => void;
  aircraftModel: { id: string, label: string, speed: number };
  onAircraftModelChange: (model: { id: string, label: string, speed: number }) => void;
  searchQuery: string;
  planViewMode: 'ETAPA' | 'ACUMULADO';
  onSearchQueryChange: (query: string) => void;
  onSearch: (e: React.FormEvent) => void;
  onClearWaypoints: () => void;
  onRemoveWaypoint: (id: string) => void;
  onReorderWaypoints: (newWaypoints: Waypoint[]) => void;
  onPlanViewModeChange: (mode: 'ETAPA' | 'ACUMULADO') => void;
  onAddWaypoint: (point: NavPoint, type: 'ORIGIN' | 'DESTINATION' | 'WAYPOINT') => void;
  savedPlans: SavedPlan[];
  onSavePlan: (name: string) => void;
  onLoadPlan: (plan: SavedPlan) => void;
  onDeletePlan: (name: string) => void;
  onInvertRoute?: () => void;
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
  onReorderWaypoints,
  onAddWaypoint,
  savedPlans,
  onSavePlan,
  onLoadPlan,
  onDeletePlan,
  onInvertRoute
}) => {
  const origin = waypoints.find(w => w.role === 'ORIGIN') || null;
  const destination = waypoints.find(w => w.role === 'DESTINATION') || null;
  
  const [isAircraftOpen, setIsAircraftOpen] = useState(false);
  const [aircraftQuery, setAircraftQuery] = useState(aircraftModel.label);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [planName, setPlanName] = useState('');

  useEffect(() => {
    setAircraftQuery(aircraftModel.label);
  }, [aircraftModel]);

  const filteredAircraft = commonAircraft.filter(ac => 
    ac.label.toLowerCase().includes(aircraftQuery.toLowerCase()) || 
    ac.id.toLowerCase().includes(aircraftQuery.toLowerCase())
  );

  const handleOnDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(waypoints);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    onReorderWaypoints(items);
  };

  return (
    <>
      <section className="w-[420px] bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 flex flex-col z-[1001] shadow-2xl shrink-0 animate-in slide-in-from-left duration-300 relative">
        {/* CABEÇALHO E INPUTS */}
        <div className="p-4 bg-slate-900/50 border-b border-slate-800/50">
          <div className="flex items-start justify-between mb-4 gap-2">
            <div className="flex-1 relative">
              <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1">Aeronave</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-400">
                  <IconPlane />
                </div>
                <input
                  type="text"
                  className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-purple-500/50 transition-all uppercase"
                  value={aircraftQuery}
                  onChange={(e) => { setAircraftQuery(e.target.value); setIsAircraftOpen(true); }}
                />
                {isAircraftOpen && filteredAircraft.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                    {filteredAircraft.map(ac => (
                      <button key={ac.id} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-300 hover:bg-purple-500/20" onClick={() => { onAircraftModelChange(ac); onPlannedSpeedChange(ac.speed); setAircraftQuery(ac.label); setIsAircraftOpen(false); }}>
                        {ac.label} - {ac.speed} KT
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="w-24">
              <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1 text-right">Velocidade</label>
              <input type="number" className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg px-3 py-2 text-right" value={plannedSpeed} onChange={(e) => onPlannedSpeedChange(Number(e.target.value))} />
            </div>
          </div>
          
          <div className="space-y-3">
            <AutocompleteInput placeholder="Origem..." value={origin ? `${origin.icao || origin.name}` : ''} onSelect={(pt) => onAddWaypoint(pt, 'ORIGIN')} />
            <AutocompleteInput placeholder="Adicionar waypoint..." onSelect={(pt) => onAddWaypoint(pt, 'WAYPOINT')} />
            <AutocompleteInput placeholder="Destino..." value={destination ? `${destination.icao || destination.name}` : ''} onSelect={(pt) => onAddWaypoint(pt, 'DESTINATION')} />
          </div>
        </div>

        {/* BARRA DE AÇÕES */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rota</span>
          <div className="flex gap-1">
            <button onClick={() => setIsExpanded(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
              <IconMaximize />
            </button>
            <button onClick={() => onClearWaypoints()} className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400">
              <IconTrash />
            </button>
          </div>
        </div>

        {/* LISTA DE WAYPOINTS (SIDEBAR) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0b0e14]">
          <DragDropContext onDragEnd={handleOnDragEnd}>
            <Droppable droppableId="sidebar-list">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-slate-800">
                  {waypoints.map((wp, i) => {
                    const segment = i > 0 ? flightSegments[i - 1] : null;
                    return (
                      <Draggable key={wp.id} draggableId={wp.id.toString()} index={i}>
                        {(dragProvided) => (
                          <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className="p-4 flex items-center justify-between group hover:bg-slate-800/30">
                            <div className="flex items-center gap-3">
                              <div {...dragProvided.dragHandleProps} className="text-slate-600"><GripVertical size={14}/></div>
                              <div className="flex flex-col">
                                <span className="text-white font-mono text-base">{wp.icao || wp.name}</span>
                                <span className="text-[8px] font-black text-slate-500 uppercase">{wp.role || wp.type}</span>
                              </div>
                            </div>
                            {segment && (
                              <div className="text-right font-mono">
                                <div className="text-purple-400 text-xs">
                                  {Math.round((segment.track - calculateMagDeclination(wp.lat, wp.lng) + 360) % 360).toString().padStart(3, '0')}°M
                                </div>
                                <div className="text-[10px] text-slate-500">{segment.distance.toFixed(0)} NM</div>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </section>

      {/* MODAL DETALHADO EXPANDIDO */}
      {isExpanded && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-10">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-2xl font-black text-white">PLANO DE VOO DETALHADO</h2>
              <button onClick={() => setIsExpanded(false)} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold">FECHAR</button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <table className="w-full text-left border-collapse">
                <thead className="text-[10px] uppercase font-black text-slate-500 tracking-widest bg-slate-950/50">
                  <tr>
                    <th className="p-4">Ponto</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Coordenadas</th>
                    <th className="p-4 text-right">Rumo Mag.</th>
                    <th className="p-4 text-right">Distância (NM)</th>
                    <th className="p-4 text-right">ETE</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-bold text-slate-300 divide-y divide-slate-800">
                  {waypoints.map((wp, i) => {
                    const segment = i > 0 ? flightSegments[i - 1] : null;
                    return (
                      <tr key={wp.id} className="hover:bg-slate-800/30">
                        <td className="p-4 font-mono text-white">{wp.icao || wp.name}</td>
                        <td className="p-4"><span className="px-2 py-1 bg-slate-700 rounded text-[10px]">{wp.role || wp.type}</span></td>
                        <td className="p-4 font-mono text-slate-500 text-xs">{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</td>
                        <td className="p-4 text-right font-mono text-purple-400">
                          {segment ? `${Math.round((segment.track - calculateMagDeclination(wp.lat, wp.lng) + 360) % 360).toString().padStart(3, '0')}°M` : '-'}
                        </td>
                        <td className="p-4 text-right font-mono">{segment ? segment.distance.toFixed(1) : '-'}</td>
                        <td className="p-4 text-right font-mono text-teal-400">{segment ? segment.ete : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
};