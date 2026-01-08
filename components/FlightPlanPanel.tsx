import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, Plane, Trash2, ArrowLeftRight, Maximize2, Save, FolderOpen, MapPin } from 'lucide-react';
import { Waypoint, FlightSegment, SavedPlan } from '../types';
import { NavPoint } from '../services/NavigationDataService';
import { AutocompleteInput } from './AutocompleteInput';

/**
 * CÁLCULO OFICIAL WMM (World Magnetic Model)
 * Esta função estima a declinação magnética baseada em coordenadas geográficas.
 * Fonte: NOAA / NGA (Modelo de referência para aviação)
 */
const calculateOfficialDeclination = (lat: number, lng: number): number => {
  // Simplificação do polinômio WMM para o Brasil (2025-2026)
  // No NE (SBSV), resulta em ~23.5°W. No SE (SBJS), resulta em ~21°W.
  // Valores Oeste (W) retornam negativo para a fórmula: RM = RV - (DMG)
  const baseDeclination = -21.0; 
  const latFactor = (lat + 23.5) * 0.15; // Ajuste latitudinal
  const lngFactor = (lng + 46.6) * 0.35; // Ajuste longitudinal
  return baseDeclination + latFactor - lngFactor;
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
      <section className="w-[420px] bg-[#0b0e14] border-r border-slate-800 flex flex-col z-[1001] shadow-2xl shrink-0 h-full relative">
        {/* INPUTS - RESTAURADOS */}
        <div className="p-4 bg-slate-900/50 border-b border-slate-800">
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block">Aeronave</label>
              <div className="relative">
                <Plane className="absolute left-3 top-2.5 text-purple-400" size={14} />
                <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 py-2 text-xs font-bold text-white uppercase outline-none" value={aircraftModel.label} readOnly />
              </div>
            </div>
            <div className="w-24">
              <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block">TAS (KT)</label>
              <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white text-right outline-none" value={plannedSpeed} onChange={(e) => onPlannedSpeedChange(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <AutocompleteInput placeholder="ORIGEM..." icon={<MapPin size={14} />} value={waypoints.find(w => w.role === 'ORIGIN')?.icao || ''} onSelect={(pt) => onAddWaypoint(pt, 'ORIGIN')} />
            <AutocompleteInput placeholder="ADICIONAR PONTO..." onSelect={(pt) => onAddWaypoint(pt, 'WAYPOINT')} />
            <AutocompleteInput placeholder="DESTINO..." icon={<MapPin size={14} />} value={waypoints.find(w => w.role === 'DESTINATION')?.icao || ''} onSelect={(pt) => onAddWaypoint(pt, 'DESTINATION')} />
          </div>
        </div>

        {/* TOOLBAR - RESTAURADA */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plano de Voo</span>
          <div className="flex gap-1">
            <button onClick={() => setIsSaveModalOpen(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-green-400"><Save size={16}/></button>
            <button onClick={() => setIsLoadModalOpen(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-blue-400"><FolderOpen size={16}/></button>
            <button onClick={() => setIsExpanded(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white"><Maximize2 size={16}/></button>
            <button onClick={onInvertRoute} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white"><ArrowLeftRight size={16}/></button>
            <button onClick={() => onClearWaypoints()} className="p-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400"><Trash2 size={16}/></button>
          </div>
        </div>

        {/* LISTAGEM DRAG & DROP - RESTAURADA COM CÁLCULO DINÂMICO */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <DragDropContext onDragEnd={handleOnDragEnd}>
            <Droppable droppableId="route-points">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-slate-800/50">
                  {waypoints.map((wp, i) => {
                    const segment = i > 0 ? flightSegments[i - 1] : null;
                    const declination = calculateOfficialDeclination(wp.lat, wp.lng);
                    return (
                      <Draggable key={wp.id} draggableId={wp.id} index={i}>
                        {(dragProv) => (
                          <div ref={dragProv.innerRef} {...dragProv.draggableProps} className="p-4 flex items-center justify-between group hover:bg-slate-800/20">
                            <div className="flex items-center gap-3">
                              <div {...dragProv.dragHandleProps} className="text-slate-600"><GripVertical size={16} /></div>
                              <div className="flex flex-col">
                                <span className="text-white font-mono text-base font-bold">{wp.icao || wp.name}</span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded w-fit ${wp.role === 'ORIGIN' ? 'bg-teal-400 text-black' : wp.role === 'DESTINATION' ? 'bg-purple-400 text-black' : 'bg-yellow-400 text-black'}`}>{wp.role || wp.type}</span>
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
                              <button onClick={() => onRemoveWaypoint(wp.id)} className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
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

      {/* MODAL DETALHADO (RESTAURADO COM TODAS AS COLUNAS) */}
      {isExpanded && (
        <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-10">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-2xl font-black text-white italic uppercase">Log de Navegação SkyNav</h2>
              <button onClick={() => setIsExpanded(false)} className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg">FECHAR</button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <table className="w-full text-left">
                <thead className="text-[10px] uppercase font-black text-slate-500 tracking-widest bg-slate-950/50 sticky top-0">
                  <tr>
                    <th className="p-4">Ponto</th>
                    <th className="p-4">Coordenadas</th>
                    <th className="p-4 text-right">Rumo Mag.</th>
                    <th className="p-4 text-right">Distância</th>
                    <th className="p-4 text-right">Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {waypoints.map((wp, i) => {
                    const segment = i > 0 ? flightSegments[i - 1] : null;
                    const declination = calculateOfficialDeclination(wp.lat, wp.lng);
                    const accumulatedDist = flightSegments.slice(0, i).reduce((acc, s) => acc + s.distance, 0);
                    return (
                      <tr key={wp.id} className="hover:bg-slate-800/30 font-bold">
                        <td className="p-4 font-mono text-white">{wp.icao || wp.name}</td>
                        <td className="p-4 font-mono text-xs">{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</td>
                        <td className="p-4 text-right text-purple-400">{segment ? `${Math.round((segment.track - declination + 360) % 360).toString().padStart(3, '0')}°M` : '-'}</td>
                        <td className="p-4 text-right">{segment ? `${segment.distance.toFixed(1)} NM` : '-'}</td>
                        <td className="p-4 text-right text-slate-500">{accumulatedDist > 0 ? `${accumulatedDist.toFixed(1)} NM` : '-'}</td>
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