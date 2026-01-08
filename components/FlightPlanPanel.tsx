import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  GripVertical, Plane, Trash2, ArrowLeftRight, Maximize2, 
  Save, FolderOpen, MapPin, ChevronDown, X, Navigation2
} from 'lucide-react';
import { Waypoint, FlightSegment } from '../types';
import { AutocompleteInput } from './AutocompleteInput';

// Cálculo de Declinação Magnética (Baseado nas cartas WAC das suas imagens)
const getMagDeclination = (lat: number, lng: number): number => {
  const base = -22.0; 
  const variance = (lat + 15) * 0.25; 
  return base + variance;
};

export const FlightPlanPanel: React.FC<FlightPlanPanelProps> = ({
  waypoints, flightSegments, plannedSpeed, onPlannedSpeedChange,
  aircraftModel, onClearWaypoints, onRemoveWaypoint, 
  onReorderWaypoints, onAddWaypoint, onInvertRoute, onSavePlan
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

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
        
        {/* 1. SELEÇÃO DE AERONAVE E TAS (image_3d3d78.png) */}
        <div className="p-4 bg-slate-900/50 border-b border-slate-800 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block">Aeronave Selecionada</label>
              <div className="relative group">
                <Plane className="absolute left-3 top-2.5 text-purple-400" size={14} />
                <input className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 py-2 text-xs font-bold text-white uppercase outline-none" value={aircraftModel.label} readOnly />
                <ChevronDown className="absolute right-3 top-2.5 text-slate-600" size={14} />
              </div>
            </div>
            <div className="w-24">
              <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block">TAS (KT)</label>
              <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white text-right outline-none" value={plannedSpeed} onChange={(e) => onPlannedSpeedChange(Number(e.target.value))} />
            </div>
          </div>

          {/* 2. INPUTS DE BUSCA (image_3ce347.png) */}
          <div className="space-y-2">
            <AutocompleteInput placeholder="ORIGEM..." icon={<MapPin size={14} />} value={waypoints.find(w => w.role === 'ORIGIN')?.icao || ''} onSelect={(pt) => onAddWaypoint(pt, 'ORIGIN')} />
            <AutocompleteInput placeholder="ADICIONAR PONTO..." onSelect={(pt) => onAddWaypoint(pt, 'WAYPOINT')} />
            <AutocompleteInput placeholder="DESTINO..." icon={<MapPin size={14} />} value={waypoints.find(w => w.role === 'DESTINATION')?.icao || ''} onSelect={(pt) => onAddWaypoint(pt, 'DESTINATION')} />
          </div>
        </div>

        {/* 3. TOOLBAR COM TOOLTIPS (image_3cd3c9.png) */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Plano de Voo</span>
          <div className="flex gap-1 items-center">
            <button onClick={() => setIsSaveModalOpen(true)} title="Salvar Plano de Voo" className="p-2 rounded hover:bg-green-500/10 text-slate-500 hover:text-green-400 transition-all"><Save size={18}/></button>
            <button title="Biblioteca" className="p-2 rounded hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 transition-all"><FolderOpen size={18}/></button>
            <div className="w-px h-4 bg-slate-700 mx-1"></div>
            <button onClick={() => setIsExpanded(true)} title="Expandir plano de voo" className="p-2 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-all"><Maximize2 size={18}/></button>
            <button onClick={onInvertRoute} title="Inverter Plano de Voo" className="p-2 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-all"><ArrowLeftRight size={18}/></button>
            <button onClick={() => onClearWaypoints()} title="Apagar Plano de Voo" className="p-2 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"><Trash2 size={18}/></button>
          </div>
        </div>

        {/* 4. LISTA DE WAYPOINTS - ONDE ESTAVA O ERRO DE CARREGAMENTO */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0b0e14]">
          <DragDropContext onDragEnd={handleOnDragEnd}>
            <Droppable droppableId="flight-waypoints">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-slate-800/50">
                  {waypoints.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed border-slate-800 m-4 rounded-xl">
                      <p className="text-slate-600 text-xs font-bold uppercase tracking-tighter">Nenhum ponto selecionado</p>
                    </div>
                  ) : (
                    waypoints.map((wp, i) => {
                      const segment = i > 0 ? flightSegments[i - 1] : null;
                      const declination = getMagDeclination(wp.lat, wp.lng);
                      return (
                        <Draggable key={wp.id} draggableId={wp.id} index={i}>
                          {(dragProv, snap) => (
                            <div 
                              ref={dragProv.innerRef} 
                              {...dragProv.draggableProps} 
                              className={`p-4 flex items-center justify-between group transition-all ${snap.isDragging ? 'bg-slate-800 shadow-2xl z-50' : 'hover:bg-slate-800/30'}`}
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
                                <button onClick={() => onRemoveWaypoint(wp.id)} title="Remover" className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 size={14} />
                                </button>
                              </div>
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
        </div>
      </section>

      {/* MODAL EXPANDIDO (LOG DE NAVEGAÇÃO) */}
      {/* ... (Código do modal conforme resposta anterior) ... */}
    </>
  );
};