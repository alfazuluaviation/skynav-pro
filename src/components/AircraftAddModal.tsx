/**
 * Aircraft Add Modal
 * Form to add a new aircraft with registration and details
 */

import React, { useState, useCallback, useEffect } from 'react';
import { X, Plane, Save } from 'lucide-react';
import { AircraftType, UserAircraft, addUserAircraft, loadUserAircraft } from '../utils/aircraftData';

interface AircraftAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: AircraftType | null;
  onAircraftAdded: (aircraft: UserAircraft) => void;
}

export const AircraftAddModal: React.FC<AircraftAddModalProps> = ({
  isOpen,
  onClose,
  model,
  onAircraftAdded
}) => {
  const [registration, setRegistration] = useState('');
  const [speed, setSpeed] = useState('');
  const [fuelConsumption, setFuelConsumption] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Reset form when model changes
  useEffect(() => {
    if (model) {
      setSpeed(model.speed.toString());
      setRegistration('');
      setFuelConsumption('');
      setNotes('');
      setError('');
    }
  }, [model]);

  const handleSave = useCallback(() => {
    if (!model) return;
    
    const reg = registration.trim().toUpperCase();
    if (!reg) {
      setError('Informe a matrícula da aeronave');
      return;
    }

    // Check if registration already exists
    const existing = loadUserAircraft();
    if (existing.some(a => a.registration === reg)) {
      setError('Esta matrícula já está cadastrada');
      return;
    }

    const speedNum = parseInt(speed) || model.speed;
    const fuelNum = fuelConsumption ? parseFloat(fuelConsumption) : undefined;

    const newAircraft: UserAircraft = {
      id: model.id,
      label: model.label,
      registration: reg,
      speed: speedNum,
      fuelConsumption: fuelNum,
      notes: notes.trim() || undefined
    };

    addUserAircraft(newAircraft);
    onAircraftAdded(newAircraft);
  }, [model, registration, speed, fuelConsumption, notes, onAircraftAdded]);

  if (!isOpen || !model) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-gradient-to-b from-[#1a2332] to-[#0d1117] rounded-xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#0f4c75] to-[#1a73a7]">
          <div className="flex items-center gap-3">
            <Plane className="w-5 h-5 text-white" />
            <h2 className="text-lg font-semibold text-white">Adicionar Aeronave</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Model Info */}
        <div className="px-5 py-3 bg-[#0d1117]/50 border-b border-white/10">
          <p className="text-sm text-gray-400">Modelo selecionado:</p>
          <p className="text-white font-medium">{model.label}</p>
          <p className="text-xs text-gray-500">{model.id}</p>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Registration */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
              Matrícula *
            </label>
            <input
              type="text"
              value={registration}
              onChange={(e) => {
                setRegistration(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="PT-ABC"
              className="w-full px-4 py-2.5 bg-[#0d1117] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1a73a7]/50 focus:border-[#1a73a7] transition-all uppercase"
              autoFocus
            />
          </div>

          {/* Speed */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
              Velocidade de Cruzeiro (kt)
            </label>
            <input
              type="number"
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
              placeholder={model.speed.toString()}
              className="w-full px-4 py-2.5 bg-[#0d1117] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1a73a7]/50 focus:border-[#1a73a7] transition-all"
            />
          </div>

          {/* Fuel Consumption */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
              Consumo de Combustível (L/h)
            </label>
            <input
              type="number"
              value={fuelConsumption}
              onChange={(e) => setFuelConsumption(e.target.value)}
              placeholder="Opcional"
              className="w-full px-4 py-2.5 bg-[#0d1117] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1a73a7]/50 focus:border-[#1a73a7] transition-all"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
              Observações
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              className="w-full px-4 py-2.5 bg-[#0d1117] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1a73a7]/50 focus:border-[#1a73a7] transition-all"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 bg-[#0d1117]/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-gray-300 hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#0f4c75] to-[#1a73a7] rounded-lg text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AircraftAddModal;
