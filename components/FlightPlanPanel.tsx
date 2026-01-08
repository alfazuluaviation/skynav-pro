import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  GripVertical, Plane, Trash2, ArrowLeftRight, Maximize2, 
  Save, FolderOpen, MapPin, X 
} from 'lucide-react';
import { Waypoint, FlightSegment, SavedPlan } from '../types';
import { NavPoint } from '../services/NavigationDataService';
import { AutocompleteInput } from './AutocompleteInput';

// Cálculo dinâmico para simular as linhas isogônicas das cartas (21°W a 23°W)
const getDynamicDeclination = (lat: number, lng: number): number => {
  // Simula a transição geográfica: em SP (~23°S) é menor, no NE (~12°S) é maior
  const base = -22.0; 
  const variance = (lat + 15) * 0.2; 
  return base + variance;
};

export const FlightPlanPanel: React.FC<FlightPlanPanelProps> = ({
  waypoints, flightSegments, plannedSpeed, onPlannedSpeedChange,
  aircraftModel, onAircraftModelChange, onClearWaypoints,
  onRemoveWaypoint, onReorderWaypoints, onAddWaypoint,
  savedPlans, onSavePlan, onLoadPlan, onDeletePlan, onInvertRoute
}) => {
  // Estados para controlar os Modais (que haviam parado de funcionar)
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
        {/* BUSCA E AERONAVE */}
        <div className="p-4 bg-slate-900/50 border-b border-slate-800">
           {/* ... Inputs de Aeronave e TAS ... */}
           <div className="space-y-2 mt-4">
              <AutocompleteInput placeholder="ORIGEM..." icon={<MapPin size={14} />} value={waypoints.find(w => w.role === 'ORIGIN')?.icao || ''} onSelect={(pt) => onAddWaypoint(pt, 'ORIGIN')} />
              <AutocompleteInput placeholder="ADICIONAR PONTO..." onSelect={(pt) => onAddWaypoint(pt, 'WAYPOINT')} />
              <AutocompleteInput placeholder="DESTINO..." icon={<MapPin size={14} />} value={waypoints.find(w => w.role === 'DESTINATION')?.icao || ''} onSelect={(pt) => onAddWaypoint(pt, 'DESTINATION')} />
           </div>
        </div>

        {/* TOOLBAR COM TOOLTIPS RESTAURADOS (image_3cd3c9.png) */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Plano de Voo</span>
          <div className="flex gap-1">
            <button 
              onClick={() => setIsSaveModalOpen(true)} 
              title="Salvar Plano de Voo"
              className="p-1.5 rounded hover:bg-green-500/10 text-slate-500 hover:text-green-400 transition-all"
            >
              <Save size={18}/>
            </button>
            <button 
              onClick={() => setIsLoadModalOpen(true)} 
              title="Biblioteca"
              className="p-1.5 rounded hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 transition-all"
            >
              <FolderOpen size={18}/>
            </button>
            <div className="w-px h-4 bg-slate-700 mx-1"></div>
            <button 
              onClick={() => setIsExpanded(true)} 
              title="Expandir plano de voo"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-all"
            >
              <Maximize2 size={18}/>
            </button>
            <button 
              onClick={onInvertRoute} 
              title="Inverter Plano de Voo"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-all"
            >
              <ArrowLeftRight size={18}/>
            </button>
            <button 
              onClick={() => confirm("Apagar todo o plano?") && onClearWaypoints()} 
              title="Apagar Plano de Voo"
              className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"
            >
              <Trash2 size={18}/>
            </button>
          </div>
        </div>

        {/* LISTAGEM DOS WAYPOINTS */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <DragDropContext onDragEnd={handleOnDragEnd}>
            <Droppable droppableId="route-list">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-slate-800/50">
                  {waypoints.map((wp, i) => {
                    const segment = i > 0 ? flightSegments[i - 1] : null;
                    const declination = getDynamicDeclination(wp.lat, wp.lng);
                    return (
                      <Draggable key={wp.id} draggableId={wp.id} index={i}>
                        {(dragProv, snapshot) => (
                          <div 
                            ref={dragProv.innerRef} 
                            {...dragProv.draggableProps} 
                            className={`p-4 flex items-center justify-between group ${snapshot.isDragging ? 'bg-slate-800 shadow-xl' : 'hover:bg-slate-800/20'}`}
                          >
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
                              <button onClick={() => onRemoveWaypoint(wp.id)} title="Remover Ponto" className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
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
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-80 shadow-2xl">
            <h3 className="text-white font-black uppercase text-sm mb-4">Salvar Plano</h3>
            <input 
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mb-4 outline-none focus:border-purple-500"
              placeholder="Nome do plano..."
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 text-slate-400 font-bold text-xs uppercase">Cancelar</button>
              <button 
                onClick={() => { onSavePlan(planName); setIsSaveModalOpen(false); setPlanName(''); }}
                className="px-4 py-2 bg-purple-600 text-white font-bold text-xs rounded uppercase"
              >Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ... Log de Navegação Expandido segue a mesma lógica de restauração ... */}
    </>
  );
};