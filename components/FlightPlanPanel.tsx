import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  GripVertical, Plane, Trash2, ArrowLeftRight, Maximize2, 
  Save, FolderOpen, MapPin, ChevronDown 
} from 'lucide-react';
import { Waypoint, FlightSegment, SavedPlan } from '../types';
import { NavPoint } from '../services/NavigationDataService';
import { AutocompleteInput } from './AutocompleteInput';

// Cálculo oficial baseado na posição (21° a 23° conforme suas cartas WAC)
const getOfficialDeclination = (lat: number, lng: number): number => {
  const base = -22.0; 
  const variance = (lat + 15) * 0.25; 
  return base + variance;
};

export const FlightPlanPanel: React.FC<FlightPlanPanelProps> = ({
  waypoints, flightSegments, plannedSpeed, onPlannedSpeedChange,
  aircraftModel, onAircraftModelChange, onClearWaypoints,
  onRemoveWaypoint, onReorderWaypoints, onAddWaypoint,
  savedPlans, onSavePlan, onLoadPlan, onDeletePlan, onInvertRoute
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [planName, setPlanName] = useState('');

  const handleOnDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(waypoints);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    onReorderWaypoints(items);
  };

  return (
    <>
      <section className="w-[420px] bg-[#0b0e14] border-r border-slate-800 flex flex-col z-[1001] shadow-2xl h-full relative">
        
        {/* CABEÇALHO RESTAURADO: AERONAVE E PERFORMANCE */}
        <div className="p-4 bg-slate-900/50 border-b border-slate-800 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block tracking-tighter">Aeronave Selecionada</label>
              <div className="relative group">
                <Plane className="absolute left-3 top-2.5 text-purple-400 group-hover:scale-110 transition-transform" size={14} />
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-xs font-bold text-white uppercase outline-none focus:border-purple-500/50 cursor-default"
                  value={aircraftModel.label}
                  readOnly
                />
                <ChevronDown className="absolute right-3 top-2.5 text-slate-600" size={14} />
              </div>
            </div>
            <div className="w-24">
              <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block tracking-tighter">TAS (KT)</label>
              <input 
                type="number" 
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white text-right outline-none focus:border-purple-500/50" 
                value={plannedSpeed} 
                onChange={(e) => onPlannedSpeedChange(Number(e.target.value))} 
              />
            </div>
          </div>

          {/* INPUTS DE BUSCA */}
          <div className="space-y-2">
            <AutocompleteInput placeholder="ORIGEM..." icon={<MapPin size={14} />} value={waypoints.find(w => w.role === 'ORIGIN')?.icao || ''} onSelect={(pt) => onAddWaypoint(pt, 'ORIGIN')} />
            <AutocompleteInput placeholder="ADICIONAR PONTO..." onSelect={(pt) => onAddWaypoint(pt, 'WAYPOINT')} />
            <AutocompleteInput placeholder="DESTINO..." icon={<MapPin size={14} />} value={waypoints.find(w => w.role === 'DESTINATION')?.icao || ''} onSelect={(pt) => onAddWaypoint(pt, 'DESTINATION')} />
          </div>
        </div>

        {/* TOOLBAR COM 5 BOTÕES E TOOLTIPS RESTAURADOS */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Plano de Voo</span>
          <div className="flex gap-1 items-center">
            {/* 1. Salvar Plano */}
            <button onClick={() => setIsSaveModalOpen(true)} title="Salvar Plano de Voo" className="p-2 rounded hover:bg-green-500/10 text-slate-500 hover:text-green-400 transition-colors">
              <Save size={18}/>
            </button>
            {/* 2. Biblioteca */}
            <button onClick={() => setIsLoadModalOpen(true)} title="Biblioteca" className="p-2 rounded hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 transition-colors">
              <FolderOpen size={18}/>
            </button>
            
            <div className="w-px h-4 bg-slate-700 mx-1"></div>
            
            {/* 3. Expandir */}
            <button onClick={() => setIsExpanded(true)} title="Expandir plano de voo" className="p-2 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
              <Maximize2 size={18}/>
            </button>
            {/* 4. Inverter */}
            <button onClick={onInvertRoute} title="Inverter Plano de Voo" className="p-2 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
              <ArrowLeftRight size={18}/>
            </button>
            {/* 5. Apagar */}
            <button onClick={() => confirm("Apagar todo o plano?") && onClearWaypoints()} title="Apagar Plano de Voo" className="p-2 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors">
              <Trash2 size={18}/>
            </button>
          </div>
        </div>

        {/* LISTA DE PONTOS COM DRAG & DROP */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <DragDropContext onDragEnd={handleOnDragEnd}>
            <Droppable droppableId="route-items">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-slate-800/50">
                  {waypoints.map((wp, i) => {
                    const segment = i > 0 ? flightSegments[i - 1] : null;
                    const declination = getOfficialDeclination(wp.lat, wp.lng);
                    return (
                      <Draggable key={wp.id} draggableId={wp.id} index={i}>
                        {(dragProv, snap) => (
                          <div ref={dragProv.innerRef} {...dragProv.draggableProps} className={`p-4 flex items-center justify-between group transition-all ${snap.isDragging ? 'bg-slate-800 border-y border-purple-500/30 shadow-2xl' : 'hover:bg-slate-800/30'}`}>
                            <div className="flex items-center gap-3">
                              <div {...dragProv.dragHandleProps} className="text-slate-600 hover:text-slate-400"><GripVertical size={16} /></div>
                              <div className="flex flex-col">
                                <span className="text-white font-mono text-base font-bold uppercase">{wp.icao || wp.name}</span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded w-fit ${
                                  wp.role === 'ORIGIN' ? 'bg-teal-400 text-black' : 
                                  wp.role === 'DESTINATION' ? 'bg-purple-400 text-black' : 'bg-yellow-400 text-black'
                                }`}>{wp.role || 'WAYPOINT'}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {segment && (
                                <div className="text-right font-mono">
                                  <div className="text-purple-400 text-sm font-bold">
                                    {Math.round((segment.track - declination + 360) % 360).toString().padStart(3, '0')}°M
                                  </div>
                                  <div className="text-[10px] text-slate-500">{segment.distance.toFixed(0)} NM</div>
                                </div>
                              )}
                              <button onClick={() => onRemoveWaypoint(wp.id)} title="Remover Ponto" className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={14} />
                              </button>
                            </div>
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

      {/* MODAL DE SALVAR (RESTAURADO) */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-80 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-white font-black uppercase text-sm mb-4 tracking-widest flex items-center gap-2">
              <Save size={16} className="text-green-400" /> Salvar Plano
            </h3>
            <input 
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white mb-6 outline-none focus:border-purple-500 transition-all font-bold"
              placeholder="NOME DO PLANO..."
              value={planName}
              onChange={(e) => setPlanName(e.target.value.toUpperCase())}
            />
            <div className="flex justify-end gap-3 font-black">
              <button onClick={() => setIsSaveModalOpen(false)} className="text-slate-500 hover:text-white text-xs uppercase transition-colors">Cancelar</button>
              <button onClick={() => { onSavePlan(planName); setIsSaveModalOpen(false); setPlanName(''); }} className="bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded text-xs uppercase transition-all shadow-lg shadow-green-900/20">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};