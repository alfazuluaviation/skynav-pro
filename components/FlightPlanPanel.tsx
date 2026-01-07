import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'; // Nova biblioteca
import { Waypoint, FlightSegment, SavedPlan } from '../types';
import { NavPoint } from '../services/NavigationDataService';
import { AutocompleteInput } from './AutocompleteInput';
import { commonAircraft } from '../utils/aircraftData';
import { IconPlane, IconTrash, IconSwap, IconArrowUp, IconArrowDown, IconLocation, IconMaximize, IconDisk, IconFolder } from './Icons';
import { GripVertical } from 'lucide-react'; // Ícone para o Drag Handle

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
  onReorderWaypoints: (newWaypoints: Waypoint[]) => void; // Alterado para suportar DND
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

  const handleOnDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(waypoints);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    onReorderWaypoints(items);
  };

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
      <section className="w-[420px] bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 flex flex-col z-[1001] shadow-2xl shrink-0 relative">
        {/* Header & Inputs */}
        <div className="p-4 bg-slate-900/50 border-b border-slate-800/50">
          <div className="flex items-start justify-between mb-4 gap-2">
            <div className="flex-1 relative">
              <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1">Aeronave</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-400"><IconPlane /></div>
                <input
                  type="text"
                  className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg pl-9 pr-3 py-2 focus:outline-none uppercase"
                  value={aircraftQuery}
                  onChange={(e) => { setAircraftQuery(e.target.value); setIsAircraftOpen(true); }}
                  onFocus={() => setIsAircraftOpen(true)}
                  onBlur={() => setTimeout(() => setIsAircraftOpen(false), 200)}
                />
                {isAircraftOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                    {commonAircraft.filter(ac => ac.label.toLowerCase().includes(aircraftQuery.toLowerCase())).map(ac => (
                      <button key={ac.id} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-300 hover:bg-purple-500/20 flex justify-between"
                        onClick={() => { onAircraftModelChange(ac); onPlannedSpeedChange(ac.speed); setAircraftQuery(ac.label); setIsAircraftOpen(false); }}>
                        <span>{ac.label}</span><span>{ac.speed} KT</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="w-24">
              <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1 text-right">Velocidade</label>
              <div className="relative">
                <input type="number" className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg pl-3 pr-8 py-2 text-right"
                  value={plannedSpeed} onChange={(e) => onPlannedSpeedChange(Number(e.target.value))} />
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none"><span className="text-[10px] font-black text-slate-500">KT</span></div>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <AutocompleteInput placeholder="Origem..." icon={<IconLocation />} value={origin ? `${origin.icao || origin.name}` : ''} onSelect={(pt) => onAddWaypoint(pt, 'ORIGIN')} />
            <AutocompleteInput placeholder="Adicionar Waypoint..." onSelect={(pt) => onAddWaypoint(pt, 'WAYPOINT')} />
            <AutocompleteInput placeholder="Destino..." icon={<IconLocation />} value={destination ? `${destination.icao || destination.name}` : ''} onSelect={(pt) => onAddWaypoint(pt, 'DESTINATION')} />
          </div>
        </div>
        
        {/* Toolbar */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rota Atual</span>
          <div className="flex gap-1">
            <button onClick={() => setIsSaveModalOpen(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-green-400"><IconDisk /></button>
            <button onClick={() => setIsLoadModalOpen(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-blue-400"><IconFolder /></button>
            <div className="w-px h-4 bg-slate-700 mx-1 self-center"></div>
            <button onClick={() => setIsExpanded(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white"><IconMaximize /></button>
            <button onClick={onInvertRoute} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white"><IconSwap /></button>
            <button onClick={handleClearAll} className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400"><IconTrash /></button>
          </div>
        </div>
        
        {/* List - DRAG AND DROP COMPACT VIEW */}
        <DragDropContext onDragEnd={handleOnDragEnd}>
          <Droppable droppableId="waypoints">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="flex-1 overflow-y-auto custom-scrollbar bg-[#0b0e14] p-4 space-y-2">
                {waypoints.length === 0 ? (
                  <div className="text-center py-8 opacity-30 text-[10px] uppercase font-bold">Nenhuma rota definida</div>
                ) : (
                  waypoints.map((wp, i) => {
                    const segment = flightSegments[i];
                    const isOrigin = wp.role === 'ORIGIN';
                    const isDest = wp.role === 'DESTINATION';
                    
                    return (
                      <Draggable key={wp.id} draggableId={wp.id} index={i}>
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.draggableProps} className={`relative group border rounded-xl p-3 ${isOrigin ? 'bg-teal-500/10 border-teal-500/30' : isDest ? 'bg-purple-500/10 border-purple-500/30' : 'bg-slate-800/20 border-slate-800'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div {...provided.dragHandleProps} className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing"><GripVertical size={14} /></div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-black ${isOrigin ? 'bg-teal-400' : isDest ? 'bg-purple-400' : 'bg-yellow-400'}`}>
                                  {isOrigin ? 'DEP' : isDest ? 'ARR' : 'WPT'}
                                </span>
                                <span className="font-bold text-slate-200">{wp.icao || wp.name}</span>
                              </div>
                              <button onClick={() => onRemoveWaypoint(wp.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"><IconTrash /></button>
                            </div>
                            {segment && (
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pl-6">
                                <span className="text-purple-400">{segment.track.toString().padStart(3, '0')}°M <span className="text-slate-600">/</span> {segment.distance.toFixed(0)}NM</span>
                                <span>{segment.ete}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        
        {/* Footer Totals */}
        {waypoints.length > 1 && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shadow-2xl">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Distância Total</span>
              <span className="text-xl font-black text-purple-400">{flightSegments.reduce((acc, s) => acc + s.distance, 0).toFixed(0)} <span className="text-sm text-slate-500">NM</span></span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tempo Total</span>
              <span className="text-xl font-black text-slate-200">{((flightSegments.reduce((acc, s) => acc + s.distance, 0) / (plannedSpeed || 1))).toFixed(1).replace('.', ':')} <span className="text-sm text-slate-500">H</span></span>
            </div>
          </div>
        )}
      </section>
      
      {/* EXPANDED MODAL - DETAILED PLAN */}
      {isExpanded && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-10 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-3"><IconMaximize /> PLANO DE VOO DETALHADO</h2>
                <p className="text-slate-500 text-sm mt-1 uppercase font-bold">{aircraftModel.label} • Cruzeiro: {plannedSpeed} KT</p>
              </div>
              <button onClick={() => setIsExpanded(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-black transition-all">FECHAR</button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <table className="w-full text-left border-collapse">
                <thead className="text-[10px] uppercase font-black text-slate-500 tracking-widest bg-slate-950/50 sticky top-0 z-10">
                  <tr>
                    <th className="p-4 rounded-tl-lg">Ponto</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Coordenadas</th>
                    <th className="p-4 text-right text-purple-400">Rumo Mag.</th>
                    <th className="p-4 text-right">Distância (NM)</th>
                    <th className="p-4 text-right text-teal-400">ETE</th>
                    <th className="p-4 text-right rounded-tr-lg">Acumulada</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-bold text-slate-300 divide-y divide-slate-800">
                  {waypoints.map((wp, i) => {
                    const inboundSegment = i > 0 ? flightSegments[i - 1] : null;
                    const accumulatedDist = flightSegments.slice(0, i).reduce((acc, s) => acc + s.distance, 0);
                    return (
                      <tr key={wp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-mono text-white text-base">{wp.icao || wp.name}</td>
                        <td className="p-4"><span className={`text-[9px] font-bold px-2 py-1 rounded text-black ${wp.role === 'ORIGIN' ? 'bg-teal-400' : wp.role === 'DESTINATION' ? 'bg-purple-400' : 'bg-yellow-400'}`}>{wp.role === 'ORIGIN' ? 'ORIGEM' : wp.role === 'DESTINATION' ? 'DESTINO' : 'WAYPOINT'}</span></td>
                        <td className="p-4 font-mono text-slate-500 text-[10px]">{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</td>
                        <td className="p-4 text-right font-mono text-purple-400">{inboundSegment ? `${inboundSegment.track.toString().padStart(3, '0')}°` : '--°'}</td>
                        <td className="p-4 text-right font-mono">{inboundSegment ? inboundSegment.distance.toFixed(1) : '-'}</td>
                        <td className="p-4 text-right font-mono text-teal-400">{inboundSegment ? inboundSegment.ete : '-'}</td>
                        <td className="p-4 text-right font-mono text-slate-500">{accumulatedDist > 0 ? `${accumulatedDist.toFixed(1)} NM` : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* Modals for Save/Load (Mantidos conforme original) */}
      {isSaveModalOpen && ( /* ... seu código de modal de salvar ... */ )}
      {isLoadModalOpen && ( /* ... seu código de modal de carregar ... */ )}
    </>
  );
};