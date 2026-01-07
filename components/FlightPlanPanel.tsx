import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'; // Nova linha
import { Waypoint, FlightSegment, SavedPlan } from '../types';
import { NavPoint } from '../services/NavigationDataService';
import { AutocompleteInput } from './AutocompleteInput';
import { commonAircraft } from '../utils/aircraftData';
import { IconPlane, IconTrash, IconSwap, IconArrowUp, IconArrowDown, IconLocation, IconMaximize, IconDisk, IconFolder } from './Icons';
import { GripVertical } from 'lucide-react'; // Para o ícone de arrastar

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
  onMoveWaypoint: (id: string, direction: 'UP' | 'DOWN') => void;
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
  onMoveWaypoint,
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
  
  // Save/Load Modal States
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
      <section className="w-[420px] bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 flex flex-col z-[1001] shadow-2xl shrink-0 animate-in slide-in-from-left duration-300 relative">
        {/* Header / Info & Search Inputs */}
        <div className="p-4 bg-slate-900/50 border-b border-slate-800/50">
          {/* Aircraft Info & Speed Inputs */}
          <div className="flex items-start justify-between mb-4 gap-2">
            {/* Aircraft Input */}
            <div className="flex-1 relative">
              <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1">Aeronave</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-400">
                  <IconPlane />
                </div>
                <input
                  type="text"
                  className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all uppercase placeholder-slate-600"
                  placeholder="Selecionar Aeronave..."
                  value={aircraftQuery}
                  onChange={(e) => {
                    setAircraftQuery(e.target.value);
                    setIsAircraftOpen(true);
                  }}
                  onFocus={() => setIsAircraftOpen(true)}
                  onBlur={() => setTimeout(() => setIsAircraftOpen(false), 200)}
                />
                {isAircraftOpen && filteredAircraft.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50 max-h-48 overflow-y-auto">
                    {filteredAircraft.map(ac => (
                      <button
                        key={ac.id}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-300 hover:bg-purple-500/20 hover:text-white transition-colors flex justify-between group"
                        onClick={() => {
                          onAircraftModelChange(ac);
                          onPlannedSpeedChange(ac.speed);
                          setAircraftQuery(ac.label);
                          setIsAircraftOpen(false);
                        }}
                      >
                        <span>{ac.label}</span>
                        <span className="text-slate-500 group-hover:text-purple-300">{ac.speed} KT</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Speed Input */}
            <div className="w-24">
              <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-1 text-right">Velocidade</label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all text-right"
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
            <button onClick={() => setIsSaveModalOpen(true)} title="Salvar Plano" className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-green-400 transition-colors">
              <IconDisk />
            </button>
            <button onClick={() => setIsLoadModalOpen(true)} title="Carregar Plano" className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-blue-400 transition-colors">
              <IconFolder />
            </button>
            <div className="w-px h-4 bg-slate-700 mx-1 self-center"></div>
            <button onClick={() => setIsExpanded(true)} title="Visualizar Plano de Voo" className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors flex items-center gap-1">
              <IconMaximize />
            </button>
            <button onClick={onInvertRoute} title="Inverter Plano de Voo" className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
              <IconSwap />
            </button>
            <button onClick={handleClearAll} title="Limpar Plano de Voo" className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors">
              <IconTrash />
            </button>
          </div>
        </div>
        
        {/* List - Compact View */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0b0e14] p-4 space-y-2">
          {waypoints.length === 0 ? (
            <div className="text-center py-8 opacity-30">
              <p className="text-[10px] uppercase font-bold">Nenhuma rota definida</p>
            </div>
          ) : (
            waypoints.map((wp, i) => {
              const segment = flightSegments[i];
              const isOrigin = wp.role === 'ORIGIN';
              const isDest = wp.role === 'DESTINATION';
              
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
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-black ${
                        isOrigin ? 'bg-teal-400' : 
                        isDest ? 'bg-purple-400' : 
                        'bg-yellow-400'
                      }`}>
                        {isOrigin ? 'DEP' : isDest ? 'ARR' : (wp.type ? wp.type.substring(0, 3) : 'WPT')}
                      </span>
                      <span className="font-bold text-slate-200">{wp.icao || wp.name}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isOrigin && !isDest && (
                        <>
                          <button onClick={() => onMoveWaypoint(wp.id, 'UP')} className="p-1 hover:text-purple-400"><IconArrowUp /></button>
                          <button onClick={() => onMoveWaypoint(wp.id, 'DOWN')} className="p-1 hover:text-purple-400"><IconArrowDown /></button>
                        </>
                      )}
                      <button onClick={() => onRemoveWaypoint(wp.id)} className="p-1 hover:text-red-400"><IconTrash /></button>
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
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
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
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-10 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  <IconMaximize /> PLANO DE VOO DETALHADO
                </h2>
                <p className="text-slate-500 text-sm mt-1">{aircraftModel.label} @ {plannedSpeed} KT</p>
              </div>
              <button onClick={() => setIsExpanded(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-bold transition-colors">
                FECHAR
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <table className="w-full text-left border-collapse">
                <thead className="text-[10px] uppercase font-black text-slate-500 tracking-widest bg-slate-950/50 sticky top-0 z-10">
                  <tr>
                    <th className="p-4 rounded-tl-lg">Ponto</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Coordenadas</th>
                    <th className="p-4 text-right">Rumo Mag.</th>
                    <th className="p-4 text-right">Distância (NM)</th>
                    <th className="p-4 text-right">ETE</th>
                    <th className="p-4 text-right rounded-tr-lg">Dist. Acumulada</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-bold text-slate-300 divide-y divide-slate-800">
                  {waypoints.map((wp, i) => {
                    const segment = flightSegments[i];
                    const inboundSegment = i > 0 ? flightSegments[i - 1] : null;
                    const accumulatedDist = flightSegments.slice(0, i).reduce((acc, s) => acc + s.distance, 0);
                    
                    return (
                      <tr key={wp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-mono text-white text-base">{wp.icao || wp.name}</td>
                        <td className="p-4">
                          <span className={`text-[9px] font-bold px-2 py-1 rounded text-black ${
                            wp.role === 'ORIGIN' ? 'bg-teal-400' : 
                            wp.role === 'DESTINATION' ? 'bg-purple-400' : 
                            'bg-yellow-400'
                          }`}>
                            {wp.role === 'ORIGIN' ? 'ORIGEM' : wp.role === 'DESTINATION' ? 'DESTINO' : wp.type}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-500 text-xs text-[10px]">
                          {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                        </td>
                        <td className="p-4 text-right font-mono text-purple-400">
                          {inboundSegment ? `${inboundSegment.track}°` : '-'}
                        </td>
                        <td className="p-4 text-right font-mono">
                          {inboundSegment ? inboundSegment.distance.toFixed(1) : '-'}
                        </td>
                        <td className="p-4 text-right font-mono text-teal-400">
                          {inboundSegment ? inboundSegment.ete : '-'}
                        </td>
                        <td className="p-4 text-right font-mono text-slate-400">
                          {accumulatedDist > 0 ? accumulatedDist.toFixed(1) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-900/80 border-t-2 border-slate-700">
                  <tr>
                    <td colSpan={4} className="p-4 text-right font-black uppercase text-slate-500">Totais</td>
                    <td className="p-4 text-right font-black text-white text-lg">
                      {flightSegments.reduce((acc, s) => acc + s.distance, 0).toFixed(0)} NM
                    </td>
                    <td className="p-4 text-right font-black text-white text-lg">
                      {((flightSegments.reduce((acc, s) => acc + s.distance, 0) / plannedSpeed)).toFixed(2).replace('.', ':')} H
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* SAVE PLAN MODAL */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-black text-white mb-4">Salvar Plano de Voo</h3>
            <form onSubmit={handleSaveSubmit}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome do Plano</label>
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-green-500/50 focus:outline-none"
                  placeholder="Ex: Voo SBGR-SBRJ"
                  value={planName}
                  onChange={e => setPlanName(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white font-bold">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white font-bold">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* LOAD PLAN MODAL */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-xl font-black text-white mb-1">Carregar Plano</h3>
              <p className="text-slate-500 text-xs">Selecione um plano salvo para carregar.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {savedPlans.length === 0 ? (
                <div className="text-center py-8 text-slate-600 font-bold text-xs uppercase">Nenhum plano salvo.</div>
              ) : (
                savedPlans.map((plan, i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-800 hover:bg-slate-800 hover:border-blue-500/30 rounded-lg group transition-colors cursor-pointer"
                    onClick={() => {
                      onLoadPlan(plan);
                      setIsLoadModalOpen(false);
                    }}
                  >
                    <div>
                      <div className="font-bold text-white text-sm">{plan.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        {new Date(plan.date).toLocaleDateString()} • {plan.waypoints.length} pontos • {plan.aircraft.label}
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Deletar este plano?')) onDeletePlan(plan.name);
                      }} 
                      className="p-2 text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <IconTrash />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button onClick={() => setIsLoadModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white font-bold">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};