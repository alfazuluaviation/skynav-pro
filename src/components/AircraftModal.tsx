/**
 * Aircraft Selection Modal
 * Shows user's saved aircraft and allows adding new ones
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { X, Search, Plane, Check, Plus, Trash2 } from 'lucide-react';
import { 
  commonAircraft, 
  AircraftType, 
  UserAircraft, 
  loadUserAircraft, 
  removeUserAircraft 
} from '../utils/aircraftData';
import { AircraftAddModal } from './AircraftAddModal';

interface AircraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAircraft: UserAircraft | null;
  onSelectAircraft: (aircraft: UserAircraft) => void;
}

export const AircraftModal: React.FC<AircraftModalProps> = ({
  isOpen,
  onClose,
  selectedAircraft,
  onSelectAircraft
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [userAircraft, setUserAircraft] = useState<UserAircraft[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AircraftType | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Load user aircraft on mount
  useEffect(() => {
    if (isOpen) {
      setUserAircraft(loadUserAircraft());
      setSearchTerm('');
      setShowDropdown(false);
    }
  }, [isOpen]);

  // Filter aircraft models based on search
  const filteredModels = useMemo(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) return [];
    
    const term = searchTerm.toLowerCase();
    return commonAircraft.filter(
      aircraft => 
        aircraft.label.toLowerCase().includes(term) ||
        aircraft.id.toLowerCase().includes(term)
    ).slice(0, 8); // Limit results
  }, [searchTerm]);

  const handleSelectModel = useCallback((model: AircraftType) => {
    setSelectedModel(model);
    setShowAddModal(true);
    setSearchTerm('');
    setShowDropdown(false);
  }, []);

  const handleAircraftAdded = useCallback((aircraft: UserAircraft) => {
    setUserAircraft(loadUserAircraft());
    setShowAddModal(false);
    setSelectedModel(null);
  }, []);

  const handleSelectUserAircraft = useCallback((aircraft: UserAircraft) => {
    onSelectAircraft(aircraft);
    onClose();
  }, [onSelectAircraft, onClose]);

  const handleRemoveAircraft = useCallback((e: React.MouseEvent, registration: string) => {
    e.stopPropagation();
    const updated = removeUserAircraft(registration);
    setUserAircraft(updated);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowDropdown(value.length >= 2);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="relative w-full max-w-md bg-gradient-to-b from-[#1a2332] to-[#0d1117] rounded-xl shadow-2xl border border-white/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#0f4c75] to-[#1a73a7]">
            <div className="flex items-center gap-3">
              <Plane className="w-5 h-5 text-white" />
              <h2 className="text-lg font-semibold text-white">Minhas Aeronaves</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Search to Add */}
          <div className="p-4 border-b border-white/10">
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              Adicionar Aeronave
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Buscar modelo (ex: Cessna, Beechcraft...)"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0d1117] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1a73a7]/50 focus:border-[#1a73a7] transition-all"
              />
              
              {/* Dropdown results */}
              {showDropdown && filteredModels.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a2332] border border-white/10 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                  {filteredModels.map((model) => {
                    const isAdded = userAircraft.some(ua => ua.id === model.id);
                    return (
                      <button
                        key={model.id}
                        onClick={() => handleSelectModel(model)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#0f4c75]/30 transition-colors text-left border-b border-white/5 last:border-b-0"
                      >
                        <div>
                          <div className="text-white font-medium">{model.label}</div>
                          <div className="text-xs text-gray-500">{model.id} • {model.speed} kt</div>
                        </div>
                        {isAdded ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Plus className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              
              {showDropdown && searchTerm.length >= 2 && filteredModels.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a2332] border border-white/10 rounded-lg shadow-xl z-50 p-4 text-center text-gray-400">
                  Nenhum modelo encontrado
                </div>
              )}
            </div>
          </div>

          {/* User Aircraft List */}
          <div className="max-h-[45vh] overflow-y-auto p-2">
            {userAircraft.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <Plane className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Nenhuma aeronave cadastrada</p>
                <p className="text-xs mt-1">Busque um modelo acima para adicionar</p>
              </div>
            ) : (
              <div className="space-y-1">
                {userAircraft.map((aircraft) => {
                  const isSelected = selectedAircraft?.registration === aircraft.registration;
                  
                  return (
                    <button
                      key={aircraft.registration}
                      onClick={() => handleSelectUserAircraft(aircraft)}
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
                            {aircraft.registration}
                          </div>
                          <div className="text-xs text-gray-500">
                            {aircraft.label} • {aircraft.speed} kt
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <Check className="w-5 h-5 text-[#1a73a7]" />
                        )}
                        <button
                          onClick={(e) => handleRemoveAircraft(e, aircraft.registration)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors group"
                        >
                          <Trash2 className="w-4 h-4 text-gray-500 group-hover:text-red-400" />
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-white/10 bg-[#0d1117]/50">
            <p className="text-xs text-gray-500 text-center">
              {userAircraft.length} aeronave{userAircraft.length !== 1 ? 's' : ''} cadastrada{userAircraft.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Add Aircraft Modal */}
      <AircraftAddModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedModel(null);
        }}
        model={selectedModel}
        onAircraftAdded={handleAircraftAdded}
      />
    </>
  );
};

export default AircraftModal;
