import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Waypoint, FlightSegment, SavedPlan } from '../types';
import { NavPoint } from '../services/NavigationDataService';
import { AutocompleteInput } from './AutocompleteInput';
import { commonAircraft } from '../utils/aircraftData';
import { IconPlane, IconTrash, IconSwap, IconArrowUp, IconArrowDown, IconLocation, IconMaximize, IconDisk, IconFolder } from './Icons';
import { GripVertical } from 'lucide-react';

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

  return (
    <>
      <section className="w-[420px] bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 flex flex-col z-[1001] shadow-2xl shrink-0 relative">
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
              <input type="number" className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg px-3 py-2 text-right"
                value={plannedSpeed} onChange={(e) => onPlannedSpeedChange(Number(e.target.value))} />
            </div>
          </div>
          
          <div className="space-y-3">
            <AutocompleteInput placeholder="Origem..." icon={<IconLocation />} value={origin ? `${origin.icao || origin.name}` : ''} onSelect={(pt) => onAddWaypoint(pt, 'ORIGIN')} />
            <AutocompleteInput placeholder="Adicionar Waypoint..." onSelect={(pt) => onAddWaypoint(pt, 'WAYPOINT')} />
            <AutocompleteInput placeholder="Destino..." icon={<IconLocation />} value={destination ? `${destination.icao || destination.name}` : ''} onSelect={(pt) => onAddWaypoint(pt, 'DESTINATION')} />
          </div>
        </div>
        
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rota Atual</span>
          <div className="flex gap-1">
            <button onClick={() => setIsSaveModalOpen(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500"><IconDisk /></button>
            <button onClick={() => setIsLoadModalOpen(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500"><IconFolder /></button>
            <button onClick={() => setIsExpanded(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500"><IconMaximize /></button>
            <button onClick={onInvertRoute} className="p-1.5 rounded hover:bg-slate-800 text-slate-500"><IconSwap /></button>
            <button onClick={onClearWaypoints} className="p-1.5 rounded hover:bg-red-500/10 text-slate-500"><IconTrash /></button>
          </div>
        </div>
        
        <DragDropContext onDragEnd={handleOnDragEnd}>
          <Droppable droppableId="waypoints">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="flex-1 overflow-y-auto bg-[#0b0e14] p-4 space-y-2">
                {waypoints.map((wp, i) => {
                  const segment = flightSegments[i];
                  return (
                    <Draggable key={wp.id} draggableId={wp.id} index={i}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.draggableProps} className="bg-slate-800/40 border border-slate-800 rounded-xl p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div {...provided.dragHandleProps} className="text-slate-600"><GripVertical size={14} /></div>
                              <span className="font-bold text-slate-200">{wp.icao || wp.name}</span>
                            </div>
                            <button onClick={() => onRemoveWaypoint(wp.id)} className="text-slate-500 hover:text-red-400"><IconTrash /></button>
                          </div>
                          {segment && (
                            <div className="text-[10px] font-mono text-purple-400 mt-1 pl-6">
                              {segment.track.toString().padStart(3, '0')}°M / {Math.round(segment.distance)}NM
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
      </section>

      {/* MODAL EXPANDIDO */}
      {isExpanded && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-10">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-2xl font-black text-white">PLANO DE VOO DETALHADO</h2>
              <button onClick={() => setIsExpanded(false)} className="px-4 py-2 bg-slate-800 text-white rounded-lg">FECHAR</button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <table className="w-full text-left">
                <thead className="text-[10px] uppercase text-slate-500 font-black">
                  <tr>
                    <th className="p-4">Ponto</th>
                    <th className="p-4 text-right">Rumo Mag.</th>
                    <th className="p-4 text-right">Distância</th>
                    <th className="p-4 text-right">ETE</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {waypoints.map((wp, i) => {
                    const seg = i > 0 ? flightSegments[i-1] : null;
                    return (
                      <tr key={wp.id} className="border-b border-slate-800">
                        <td className="p-4 font-bold">{wp.icao || wp.name}</td>
                        <td className="p-4 text-right text-purple-400">{seg ? `${seg.track.toString().padStart(3, '0')}°` : '--°'}</td>
                        <td className="p-4 text-right">{seg ? `${Math.round(seg.distance)} NM` : '--'}</td>
                        <td className="p-4 text-right text-teal-400">{seg ? seg.ete : '--'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SALVAR */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Salvar Plano</h3>
            <input className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white mb-4" value={planName} onChange={e => setPlanName(e.target.value)} placeholder="Nome do plano" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsSaveModalOpen(false)} className="text-slate-400 px-4 py-2">Cancelar</button>
              <button onClick={handleSaveSubmit} className="bg-green-600 text-white px-4 py-2 rounded-lg">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CARREGAR */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md max-h-[70vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">Carregar Plano</h3>
            {savedPlans.map((plan, i) => (
              <div key={i} className="p-3 bg-slate-800 mb-2 rounded-lg flex justify-between items-center cursor-pointer" onClick={() => { onLoadPlan(plan); setIsLoadModalOpen(false); }}>
                <span className="text-white font-bold">{plan.name}</span>
                <button onClick={(e) => { e.stopPropagation(); onDeletePlan(plan.name); }} className="text-red-400"><IconTrash /></button>
              </div>
            ))}
            <button onClick={() => setIsLoadModalOpen(false)} className="w-full mt-4 text-slate-400">Fechar</button>
          </div>
        </div>
      )}
    </>
  );
};