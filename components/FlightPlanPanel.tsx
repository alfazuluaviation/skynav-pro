import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  GripVertical, Plane, Trash2, ArrowLeftRight, Maximize2, 
  Save, FolderOpen, MapPin, X, Clock, Navigation2, CheckCircle2 
} from 'lucide-react';
import { Waypoint, FlightSegment, SavedPlan } from '../types';
import { AutocompleteInput } from './AutocompleteInput';

interface FlightPlanPanelProps {
  waypoints: Waypoint[];
  flightSegments: FlightSegment[];
  plannedSpeed: number;
  onPlannedSpeedChange: (speed: number) => void;
  aircraftModel: { label: string; value: string };
  onClearWaypoints: () => void;
  onRemoveWaypoint: (id: string) => void;
  onReorderWaypoints: (waypoints: Waypoint[]) => void;
  onAddWaypoint: (point: any, role: 'ORIGIN' | 'DESTINATION' | 'WAYPOINT') => void;
  onInvertRoute: () => void;
  onSavePlan: (name: string) => void;
  savedPlans?: SavedPlan[];
  onLoadPlan: (plan: SavedPlan) => void;
}

const getMagDeclination = (lat: number, lng: number): number => {
  const base = -22.0; 
  const variance = (lat + 15) * 0.25; 
  return base + variance;
};

export const FlightPlanPanel: React.FC<FlightPlanPanelProps> = ({
  waypoints, flightSegments, plannedSpeed, onPlannedSpeedChange,
  aircraftModel, onClearWaypoints, onRemoveWaypoint, 
  onReorderWaypoints, onAddWaypoint, onInvertRoute,
  onSavePlan, savedPlans = [], onLoadPlan
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [showToast, setShowToast] = useState(false);

  const calculateETE = (distance: number, speed: number): string => {
    if (speed <= 0) return '--:--';
    const totalMinutes = Math.round((distance / speed) * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(waypoints);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    onReorderWaypoints(items);
  };

  const handleSaveAction = () => {
    if (!planName.trim()) return;
    onSavePlan(planName);
    setIsSaveModalOpen(false);
    setPlanName('');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <>
      <section className="w-[420px] bg-[#0b0e14] border-r border-slate-800 flex flex-col z-[1001] shadow-2xl h-full relative">
        {/* 1. TOP SELECTION AREA */}
        <div className="p-4 bg-slate-900/50 border-b border-slate-800 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block tracking-tighter">Selected Aircraft</label>
              <div className="relative group">
                <Plane className="absolute left-3 top-2.5 text-purple-400" size={14} />
                <input className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 py-2 text-xs font-bold text-white uppercase outline-none" value={aircraftModel.label} readOnly />
              </div>
            </div>
            <div className="w-24">
              <label className="text-[10px] text-slate-500 font-black uppercase mb-1 block text-right tracking-tighter">TAS (KT)</label>
              <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white text-right outline-none" value={plannedSpeed} onChange={(e) => onPlannedSpeedChange(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <AutocompleteInput placeholder="ORIGIN..." icon={<MapPin size={14} />} value={waypoints.find(w => w.role === 'ORIGIN')?.icao || ''} onSelect={(pt) => onAddWaypoint(pt, 'ORIGIN')} />
            <AutocompleteInput placeholder="ADD POINT..." onSelect={(pt) => onAddWaypoint(pt, 'WAYPOINT')} />
            <AutocompleteInput placeholder="DESTINATION..." icon={<MapPin size={14} />} value={waypoints.find(w => w.role === 'DESTINATION')?.icao || ''} onSelect={(pt) => onAddWaypoint(pt, 'DESTINATION')} />
          </div>
        </div>

        {/* 2. TOOLBAR */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Flight Plan</span>
          <div className="flex gap-1 items-center">
            <button onClick={() => setIsSaveModalOpen(true)} title="Save Plan" className="p-2 rounded hover:bg-green-500/10 text-slate-500 hover:text-green-400 transition-all"><Save size={18}/></button>
            <button onClick={() => setIsLibraryOpen(true)} title="Open Library" className="p-2 rounded hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 transition-all"><FolderOpen size={18}/></button>
            <div className="w-px h-4 bg-slate-700 mx-1"></div>
            <button onClick={() => setIsExpanded(true)} title="Expand" className={`p-2 rounded transition-all ${isExpanded ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-500 hover:text-white'}`}><Maximize2 size={18}/></button>
            <button onClick={onInvertRoute} title="Invert" className="p-2 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition-all"><ArrowLeftRight size={18}/></button>
            <button onClick={() => onClearWaypoints()} title="Clear" className="p-2 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"><Trash2 size={18}/></button>
          </div>
        </div>

        {/* 3. WAYPOINT LIST */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0b0e14]">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="side-route-list">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-slate-800/50">
                  {waypoints.map((wp, i) => {
                    const segment = i > 0 ? flightSegments[i - 1] : null;
                    const declination = getMagDeclination(wp.lat, wp.lng);
                    return (
                      <Draggable key={wp.id} draggableId={wp.id} index={i}>
                        {(drag) => (
                          <div ref={drag.innerRef} {...drag.draggableProps} className="p-4 flex items-center justify-between group hover:bg-slate-800/30 transition-all">
                            <div className="flex items-center gap-3">
                              <div {...drag.dragHandleProps} className="text-slate-600"><GripVertical size={16} /></div>
                              <div className="flex flex-col">
                                <span className="text-white font-mono text-base font-bold uppercase">{wp.icao || wp.name}</span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded w-fit ${wp.role === 'ORIGIN' ? 'bg-teal-400 text-black' : wp.role === 'DESTINATION' ? 'bg-purple-400 text-black' : 'bg-yellow-400 text-black'}`}>{wp.role}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {segment && (
                                <div className="text-right font-mono">
                                  <div className="text-purple-400 text-sm font-bold">{Math.round((segment.track - declination + 360) % 360).toString().padStart(3, '0')}°M</div>
                                  <div className="text-[10px] text-slate-500">{segment.distance.toFixed(0)} NM</div>
                                </div>
                              )}
                              <button onClick={() => onRemoveWaypoint(wp.id)} className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
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

      {/* 4. MODALS: SAVE, LIBRARY, TOAST, EXPANDED LOG */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-black uppercase text-sm mb-4">Save Flight Plan</h3>
            <input autoFocus className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white mb-6 outline-none focus:border-green-500 font-bold uppercase" placeholder="PLAN NAME..." value={planName} onChange={(e) => setPlanName(e.target.value.toUpperCase())} />
            <div className="flex justify-end gap-3 font-black text-xs">
              <button onClick={() => setIsSaveModalOpen(false)} className="text-slate-500 uppercase">Cancel</button>
              <button onClick={handleSaveAction} className="bg-green-600 px-6 py-2 rounded-lg text-white uppercase">Confirm Save</button>
            </div>
          </div>
        </div>
      )}

      {isLibraryOpen && (
        <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b0e14] border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-2">
                <FolderOpen size={18} className="text-