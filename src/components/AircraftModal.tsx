/**
 * Aircraft Search Modal (Second Screen)
 * Allows searching and adding new aircraft models from the master list
 */

import React, { useState, useMemo, useCallback } from 'react';
import { X, Search, Plane, Check, Plus } from 'lucide-react';
import { 
  commonAircraft, 
  AircraftType, 
  UserAircraft, 
  loadUserAircraft 
} from '../utils/aircraftData';
import { AircraftAddModal } from './AircraftAddModal';

interface AircraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAircraftAdded: (aircraft: UserAircraft) => void;
}

export const AircraftModal: React.FC<AircraftModalProps> = ({
  isOpen,
  onClose,
  onAircraftAdded
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AircraftType | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Get user aircraft to show which are already added
  const userAircraft = useMemo(() => loadUserAircraft(), [isOpen]);

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
    setShowAddModal(false);
    setSelectedModel(null);
    onAircraftAdded(aircraft);
    onClose();
  }, [onAircraftAdded, onClose]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowDropdown(value.length >= 2);
  }, []);

  const handleClose = useCallback(() => {
    setSearchTerm('');
    setShowDropdown(false);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="relative w-full max-w-md bg-gradient-to-b from-[#1a2332] to-[#0d1117] rounded-xl shadow-2xl border border-white/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#0f4c75] to-[#1a73a7]">
            <div className="flex items-center gap-3">
              <Plus className="w-5 h-5 text-white" />
              <h2 className="text-lg font-semibold text-white">Adicionar Aeronave</h2>
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Search */}
          <div className="p-4">
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              Buscar Modelo
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Digite o modelo (ex: Cessna, Beechcraft...)"
                className="w-full pl-10 pr-4 py-2.5 bg-[#0d1117] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1a73a7]/50 focus:border-[#1a73a7] transition-all"
                autoFocus
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
            
            <p className="mt-3 text-xs text-gray-500 text-center">
              Digite pelo menos 2 caracteres para buscar
            </p>
          </div>

          {/* Info */}
          <div className="px-4 pb-4">
            <div className="p-3 bg-[#0d1117]/50 rounded-lg border border-white/5">
              <div className="flex items-start gap-2">
                <Plane className="w-4 h-4 text-[#1a73a7] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-400">
                  Selecione um modelo da lista para cadastrar com matrícula, velocidade e consumo personalizados.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Aircraft Details Modal */}
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
