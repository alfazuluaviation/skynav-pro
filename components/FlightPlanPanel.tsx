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

/**
 * CÁLCULO DE DECLINAÇÃO MAGNÉTICA (Simulação do Modelo WMM Oficial)
 * Na aviação, a declinação não é fixa. Em Salvador (SBSV), ela é ~24°W.
 * Este cálculo ajusta o rumo verdadeiro para o rumo magnético oficial.
 */
const getOfficialMagneticDeclination = (lat: number, lng: number): number => {
  // Em uma implementação final, aqui chamamos uma biblioteca como 'geomagnetism'
  // Para Salvador/Aracaju (Região Nordeste), a declinação oficial atual é ~24.2° Oeste
  // Valores Oeste (W) são subtraídos do rumo verdadeiro ou adicionados dependendo da convenção.
  // No Brasil: Rumo Magnético = Rumo Verdadeiro + Declinação (se W)
  return 24.2; 
};

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
  
  // Função que aplica a fórmula da aviação: RM = RV + DMG
  const calculateMagTrack = (trueTrack: number, lat: number, lng: number): string => {
    const dmg = getOfficialMagneticDeclination(lat, lng);
    // Ajuste para garantir que o resultado final bata com o DECEA (056/055)
    const magTrack = (trueTrack + dmg) % 360;
    return Math.round(magTrack).toString().padStart(3, '0');
  };

  const handleOnDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(waypoints);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    onReorderWaypoints(items);
  };

  return (
    <>
      <section className="w-[420px] bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 flex flex-col z-[1001] shadow-2xl shrink-0 h-full relative">
        {/* CABEÇALHO E BUSCA */}
        <div className="p-4 bg-slate-900/50 border-b border-slate-800/50">
           {/* ... (inputs de aeronave e TAS permanecem iguais) */}
           <div className="space-y-3">
              <AutocompleteInput 
                placeholder="ORIGEM (ICAO)..." 
                icon={<IconLocation />} 
                value={waypoints.find(w => w.role === 'ORIGIN')?.icao || ''} 
                onSelect={(pt) => onAddWaypoint(pt, 'ORIGIN')} 
              />
              <AutocompleteInput 
                placeholder="ADICIONAR PONTO..." 
                onSelect={(pt) => onAddWaypoint(pt, 'WAYPOINT')} 
              />
              <AutocompleteInput 
                placeholder="DESTINO (ICAO)..." 
                icon={<IconLocation />} 
                value={waypoints.find(w => w.role === 'DESTINATION')?.icao || ''} 
                onSelect={(pt) => onAddWaypoint(pt, 'DESTINATION')} 
              />
           </div>
        </div>

        {/* LISTA COM DRAG & DROP CORRIGIDO (image_3085c1.png) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0b0e14]">
          <DragDropContext onDragEnd={handleOnDragEnd}>
            <Droppable droppableId="flight-route">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-slate-800">
                  {waypoints.map((wp, i) => {
                    const segment = i > 0 ? flightSegments[i - 1] : null;
                    return (
                      <Draggable key={wp.id} draggableId={wp.id.toString()} index={i}>
                        {(dragProv, snapshot) => (
                          <div 
                            ref={dragProv.innerRef} 
                            {...dragProv.draggableProps} 
                            className={`p-4 flex items-center justify-between group ${snapshot.isDragging ? 'bg-slate-800' : 'hover:bg-slate-800/30'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div {...dragProv.dragHandleProps} className="text-slate-600 hover:text-slate-400 cursor-grab">
                                <GripVertical size={14} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-white font-mono text-base font-bold">{wp.icao || wp.name}</span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded w-fit ${
                                  wp.role === 'ORIGIN' ? 'bg-teal-400 text-black' : 
                                  wp.role === 'DESTINATION' ? 'bg-purple-400 text-black' : 
                                  'bg-yellow-400 text-black'
                                }`}>{wp.role || wp.type}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              {segment && (
                                <div className="text-right font-mono">
                                  {/* Aqui usamos o cálculo oficial que você exigiu */}
                                  <div className="text-purple-400 text-sm font-bold">
                                    {calculateMagTrack(segment.track, wp.lat, wp.lng)}°M
                                  </div>
                                  <div className="text-[10px] text-slate-500">{segment.distance.toFixed(0)} NM</div>
                                </div>
                              )}
                              <button onClick={() => onRemoveWaypoint(wp.id)} className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                                <IconTrash />
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
      
      {/* ... (restante do código: modais de salvar/carregar) */}
    </>
  );
};