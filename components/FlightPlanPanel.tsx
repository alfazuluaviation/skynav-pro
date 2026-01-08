import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
import { Waypoint, FlightSegment, SavedPlan } from '../types';
import { NavPoint } from '../services/NavigationDataService';
import { AutocompleteInput } from './AutocompleteInput';
import { commonAircraft } from '../utils/aircraftData';
import { 
  IconPlane, IconTrash, IconSwap, IconArrowUp, 
  IconArrowDown, IconLocation, IconMaximize, 
  IconDisk, IconFolder 
} from './Icons';

// Função de Declinação Magnética integrada para evitar erro de importação
const getMagDeclinationInternal = (lat: number, lng: number): number => {
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
      <section className="w-[420px] bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 flex flex-col z-[1001] shadow-2xl shrink-0 animate-in slide-in-from-left duration-300 relative">
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
                  onFocus={() => setIsAircraftOpen(true)}
                />
                {isAircraftOpen && filteredAircraft.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                    {filteredAircraft.map(ac => (
                      <button key={ac.id} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-300 hover:bg-purple-500/20 flex justify-between group" onClick={() => { onAircraftModelChange(ac); onPlannedSpeedChange(ac.speed); setAircraftQuery(ac.label); setIsAircraftOpen(false); }}>
                        <span>{ac.label}</span>
                        <span className="text-slate-500">{ac.speed} KT</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="w-24">
              <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1 text-right">Velocidade</label>
              <div className="relative">
                <input type="number" className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg px-3 py-2 text-right" value={plannedSpeed} onChange={(e) => onPlannedSpeedChange(Number(e.target.value))} />
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-teal-500 uppercase tracking-widest ml-1">Origem</label>
              <AutocompleteInput placeholder="Buscar Aeródromo..." icon={<IconLocation />} value={origin ? `${origin.icao || origin.name}` : ''} onSelect={(pt) => onAddWaypoint(pt, 'ORIGIN')} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Waypoints / Fixos</label>
              <AutocompleteInput placeholder="Adicionar ponto..." onSelect={(pt) => onAddWaypoint(pt, 'WAYPOINT')} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-purple-500 uppercase tracking-widest ml-1">Destino</label>
              <AutocompleteInput placeholder="Buscar Aeródromo..." icon={<IconLocation />} value={destination ? `${destination.icao || destination.name}` : ''} onSelect={(pt) => onAddWaypoint(pt, 'DESTINATION')} />
            </div>
          </div>
        </div>
        
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rota</span>
          <div className="flex gap-1">
            <button onClick={() => setIsSaveModalOpen(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-green-400"><IconDisk /></button>
            <button onClick={() => setIsLoadModalOpen(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-blue-400"><IconFolder /></button>
            <div className="w-px h-4 bg-slate-700 mx-1 self-center"></div>
            <button onClick={() => setIsExpanded(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white"><IconMaximize /></button>
            <button onClick={onInvertRoute} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white"><IconSwap /></button>
            <button onClick={() => { if(confirm("Limpar rota?")) onClearWaypoints(); }} className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400"><IconTrash /></button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0b0e14]">
          <DragDropContext onDragEnd={handleOnDragEnd}>
            <table className="w-full text-left border-collapse">
              <Droppable droppableId="side-list">
                {(provided) => (
                  <tbody {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-slate-800">
                    {waypoints.map((wp, i) => {
                      const segment = i > 0 ? flightSegments[i - 1] : null;
                      return (
                        <Draggable key={wp.id} draggableId={wp.id.toString()} index={i}>
                          {(draggableProvided, snapshot) => (
                            <tr ref={draggableProvided.innerRef} {...draggableProvided.draggableProps} className={`transition-colors ${snapshot.isDragging ? 'bg-slate-800' : 'hover:bg-slate-800/30'}`}>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div {...draggableProvided.dragHandleProps} className="text-slate-600"><GripVertical size={14} /></div>
                                  <div className="flex flex-col">
                                    <span className="text-white font-mono text-base">{wp.icao || wp.name}</span>
                                    <span className={`text-[8px] font-black px-1 rounded w-fit ${
                                      wp.role === 'ORIGIN' ? 'bg-teal-400 text-black' : 
                                      wp.role === 'DESTINATION' ? 'bg-purple-400 text-black' : 
                                      'bg-yellow-400 text-black'
                                    }`}>{wp.role || wp.type}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-right font-mono">
                                {segment ? (
                                  <div className="flex flex-col items-end">
                                    <span className="text-purple-400">{Math.round((segment.track - getMagDeclinationInternal(wp.lat, wp.lng) + 360) % 360).toString().padStart(3, '0')}°M</span>
                                    <span className="text-[10px] text-slate-500">{segment.distance.toFixed(0)} NM</span>
                                  </div>
                                ) : <span className="text-slate-700">---</span>}
                              </td>
                              <td className="p-4 text-right">
                                <button onClick={() => onRemoveWaypoint(wp.id)} className="p-1.5 text-slate-600 hover:text-red-400"><IconTrash /></button>
                              </td>
                            </tr>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </tbody>
                )}
              </Droppable>
            </table>
          </DragDropContext>
        </div>

        {waypoints.length > 1 && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total</span>
              <span className="text-xl font-black text-purple-400">{flightSegments.reduce((acc, s) => acc + s.distance, 0).toFixed(0)} NM</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tempo</span>
              <span className="text-xl font-black text-slate-200">{((flightSegments.reduce((acc, s) => acc + s.distance, 0) / plannedSpeed)).toFixed(1).replace('.', ':')} H</span>
            </div>
          </div>
        )}
      </section>

      {/* MODAL EXPANDIDO COM TODAS AS CORES E COLUNAS */}
      {isExpanded && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-10 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Plano de Voo Detalhado</h2>
                <p className="text-slate-500 text-sm mt-1">{aircraftModel.label} • Cruzeiro: {plannedSpeed} KT</p>
              </div>
              <button onClick={() => setIsExpanded(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg">FECHAR</button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-[#0b0e14]">
              <table className="w-full text-left border-collapse">
                <thead className="text-[10px] uppercase font-black text-slate-500 tracking-widest bg-slate-950/50">
                  <tr>
                    <th className="p-4 rounded-tl-lg">Ponto</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Coordenadas</th>
                    <th className="p-4 text-right">Rumo Mag.</th>
                    <th className="p-4 text-right">Dist. (NM)</th>
                    <th className="p-4 text-right">ETE</th>
                    <th className="p-4 text-right rounded-tr-lg">Acumulada</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-bold text-slate-300 divide-y divide-slate-800">
                  {waypoints.map((wp, i) => {
                    const segment = i > 0 ? flightSegments[i - 1] : null;
                    const accumulated = flightSegments.slice(0, i).reduce((acc, s) => acc + s.distance, 0);
                    return (
                      <tr key={wp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-mono text-white text-base">{wp.icao || wp.name}</td>
                        <td className="p-4">
                          <span className={`text-[9px] font-black px-2 py-1 rounded text-black ${
                            wp.role === 'ORIGIN' ? 'bg-teal-400' : 
                            wp.role === 'DESTINATION' ? 'bg-purple-400' : 
                            'bg-yellow-400'
                          }`}>{wp.role || wp.type}</span>
                        </td>
                        <td className="p-4 font-mono text-slate-500 text-xs">{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</td>
                        <td className="p-4 text-right font-mono text-purple-400">
                          {segment ? `${Math.round((segment.track - getMagDeclinationInternal(wp.lat, wp.lng) + 360) % 360).toString().padStart(3, '0')}°M` : '-'}
                        </td>
                        <td className="p-4 text-right font-mono">{segment ? segment.distance.toFixed(1) : '-'}</td>
                        <td className="p-4 text-right font-mono text-teal-400">{segment ? segment.ete : '-'}</td>
                        <td className="p-4 text-right font-mono text-slate-400">{accumulated > 0 ? accumulated.toFixed(1) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SALVAR PLANO */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black text-white mb-4">Salvar Plano de Voo</h3>
            <form onSubmit={handleSaveSubmit}>
              <input type="text" autoFocus className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white mb-4" placeholder="Nome do Plano..." value={planName} onChange={e => setPlanName(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 text-slate-400 font-bold">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500">Salvar Plano</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CARREGAR PLANO */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800"><h3 className="text-xl font-black text-white">Carregar Plano</h3></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {savedPlans.length === 0 ? <p className="text-center text-slate-500 py-10 font-bold uppercase">Nenhum plano salvo.</p> :
                savedPlans.map((plan, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700 rounded-lg group hover:border-blue-500/50 cursor-pointer" onClick={() => { onLoadPlan(plan); setIsLoadModalOpen(false); }}>
                    <div>
                      <p className="font-bold text-white">{plan.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{new Date(plan.date).toLocaleDateString()} • {plan.waypoints.length} Pontos</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); if(confirm('Excluir plano?')) onDeletePlan(plan.name); }} className="p-2 text-slate-600 hover:text-red-400 transition-colors"><IconTrash /></button>
                  </div>
                ))
              }
            </div>
            <div className="p-4 border-t border-slate-800 text-right"><button onClick={() => setIsLoadModalOpen(false)} className="px-4 py-2 text-slate-400 font-bold">Fechar</button></div>
          </div>
        </div>
      )}
    </>
  );
};