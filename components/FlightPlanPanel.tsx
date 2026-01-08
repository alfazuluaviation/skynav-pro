import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  GripVertical, Plane, Trash2, ArrowLeftRight, Maximize2,
  Save, FolderOpen, MapPin, X, Clock, Navigation2, CheckCircle2
} from 'lucide-react';
import { Waypoint, FlightSegment, SavedPlan } from '../types';
import { AutocompleteInput } from './AutocompleteInput';

// Interface adicionada para garantir que o código funcione
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
              <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white text-right outline-none" value={plannedSpeed} onChange={(e)