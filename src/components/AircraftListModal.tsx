/**
 * Aircraft List Modal (First Screen)
 * Shows user's saved aircraft collection with ADD button to navigate to search screen
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Plane, Check, Trash2, Plus } from 'lucide-react';
import { 
  UserAircraft, 
  loadUserAircraft, 
  removeUserAircraft 
} from '../utils/aircraftData';
import { AircraftModal } from './AircraftModal';

interface AircraftListModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAircraft: UserAircraft | null;
  onSelectAircraft: (aircraft: UserAircraft) => void;
}

export const AircraftListModal: React.FC<AircraftListModalProps> = ({
  isOpen,
  onClose,
  selectedAircraft,
  onSelectAircraft
}) => {
  const [userAircraft, setUserAircraft] = useState<UserAircraft[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Load user aircraft on mount
  useEffect(() => {
    if (isOpen) {
      setUserAircraft(loadUserAircraft());
    }
  }, [isOpen]);

  const handleSelectUserAircraft = useCallback((aircraft: UserAircraft) => {
    onSelectAircraft(aircraft);
    onClose();
  }, [onSelectAircraft, onClose]);

  const handleRemoveAircraft = useCallback((e: React.MouseEvent, registration: string) => {
    e.stopPropagation();
    const updated = removeUserAircraft(registration);
    setUserAircraft(updated);
  }, []);

  const handleAircraftAdded = useCallback((aircraft: UserAircraft) => {
    setUserAircraft(loadUserAircraft());
    setShowAddModal(false);
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

          {/* Add Button */}
          <div className="p-4 border-b border-white/10">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#0f4c75] to-[#1a73a7] hover:from-[#1a73a7] hover:to-[#2196f3] text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              ADICIONAR
            </button>
          </div>

          {/* User Aircraft List */}
          <div className="h-[320px] overflow-y-auto p-2">
            {userAircraft.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <Plane className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Nenhuma aeronave cadastrada</p>
                <p className="text-xs mt-1">Clique em ADICIONAR para cadastrar</p>
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

      {/* Add Aircraft Modal (Search Screen) */}
      <AircraftModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAircraftAdded={handleAircraftAdded}
      />
    </>
  );
};

export default AircraftListModal;
