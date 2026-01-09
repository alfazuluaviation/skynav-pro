import React, { useState } from 'react';
import { IconMenu } from './Icons';

interface TopLeftMenuProps {
  onOpenCharts: () => void;
  onOpenAerodromes: () => void;
}

export const TopLeftMenu: React.FC<TopLeftMenuProps> = ({ onOpenCharts, onOpenAerodromes }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-4 left-4 z-[2000]">
      {/* Hamburger Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl flex items-center justify-center hover:bg-slate-800 transition-all z-[2001] relative"
        aria-label="Toggle menu"
      >
        <IconMenu />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute top-full mt-2 left-0 w-48 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden z-[2002]"
          style={{ 
            transform: 'translateY(0)',
            opacity: 1,
            transition: 'opacity 0.2s ease, transform 0.2s ease'
          }}
        >
          <button
            onClick={() => {
              onOpenCharts();
              setIsOpen(false);
            }}
            className="w-full px-4 py-3 text-left text-sm font-bold text-slate-200 hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-0"
          >
            Cartas
          </button>
          <button
            onClick={() => {
              onOpenAerodromes();
              setIsOpen(false);
            }}
            className="w-full px-4 py-3 text-left text-sm font-bold text-slate-200 hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-0"
          >
            Aeródromos
          </button>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[1999]"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};