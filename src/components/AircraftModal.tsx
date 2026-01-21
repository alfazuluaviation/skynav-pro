/**
 * Aircraft Selection Modal
 * Allows users to search and select an aircraft model
 */

import React, { useState, useMemo, useCallback } from 'react';
import { X, Search, Plane, Check } from 'lucide-react';
import { commonAircraft, AircraftType } from '../utils/aircraftData';

interface AircraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAircraft: AircraftType | null;
  onSelectAircraft: (aircraft: AircraftType) => void;
}

export const AircraftModal: React.FC<AircraftModalProps> = ({
  isOpen,
  onClose,
  selectedAircraft,
  onSelectAircraft
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAircraft = useMemo(() => {
    if (!searchTerm.trim()) return commonAircraft;
    
    const term = searchTerm.toLowerCase();
    return commonAircraft.filter(
      aircraft => 
        aircraft.label.toLowerCase().includes(term) ||
        aircraft.id.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const handleSelect = useCallback((aircraft: AircraftType) => {
    onSelectAircraft(aircraft);
    onClose();
  }, [onSelectAircraft, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#1a2332] to-[#0d1117] rounded-xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#0f4c75] to-[#1a73a7]">
          <div className="flex items-center gap-3">
            <Plane className="w-5 h-5 text-white" />
            <h2 className="text-lg font-semibold text-white">Selecionar Aeronave</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar aeronave por modelo ou código..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#0d1117] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1a73a7]/50 focus:border-[#1a73a7] transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Aircraft List */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filteredAircraft.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <Plane className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nenhuma aeronave encontrada</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredAircraft.map((aircraft) => {
                const isSelected = selectedAircraft?.id === aircraft.id;
                
                return (
                  <button
                    key={aircraft.id}
                    onClick={() => handleSelect(aircraft)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                      isSelected
                        ? 'bg-[#1a73a7]/30 border border-[#1a73a7]'
                        : 'bg-[#0d1117]/50 border border-transparent hover:bg-[#1a2332] hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-[#1a73a7]' : 'bg-[#1a2332]'}`}>
                        <Plane className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      <div className="text-left">
                        <div className={`font-medium ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                          {aircraft.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {aircraft.id} • {aircraft.speed} kt
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-5 h-5 text-[#1a73a7]" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 bg-[#0d1117]/50">
          <p className="text-xs text-gray-500 text-center">
            {filteredAircraft.length} aeronave{filteredAircraft.length !== 1 ? 's' : ''} disponíve{filteredAircraft.length !== 1 ? 'is' : 'l'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AircraftModal;
