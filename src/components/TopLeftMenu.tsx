import React, { useState } from 'react';
import { IconMenu } from './Icons';
import aerodromosIcon from '@/assets/aerodromos-icon.jpg';
import cartasIcon from '@/assets/cartas-icon.jpg';
import downloadIcon from '@/assets/download-icon.jpg';

interface TopLeftMenuProps {
  onOpenCharts: () => void;
  onOpenAerodromes: () => void;
  onOpenDownload: () => void;
}

export const TopLeftMenu: React.FC<TopLeftMenuProps> = ({
  onOpenCharts,
  onOpenAerodromes,
  onOpenDownload
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="absolute top-4 left-4 z-[2000] safe-top safe-left">
      {/* Hamburger Icon Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        aria-label="Toggle menu" 
        className="p-3 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl flex items-center justify-center hover:bg-slate-800 active:bg-slate-700 transition-all z-[2001] relative"
      >
        <IconMenu />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-3 z-[2002] gap-2 shadow-2xl flex flex-row animate-in">
          <button 
            onClick={() => {
              onOpenCharts();
              setIsOpen(false);
            }} 
            title="Cartas"
            className="w-14 h-12 sm:w-[60px] sm:h-[48px] p-0 overflow-hidden rounded-xl transition-all shadow-lg hover:shadow-sky-500/25 active:scale-95 flex items-center justify-center"
          >
            <img src={cartasIcon} alt="Cartas" className="w-full h-full object-cover rounded-xl" />
          </button>
          <button 
            onClick={() => {
              onOpenAerodromes();
              setIsOpen(false);
            }} 
            title="Aeródromos"
            className="w-14 h-12 sm:w-[60px] sm:h-[48px] p-0 overflow-hidden rounded-xl transition-all shadow-lg hover:shadow-sky-500/25 active:scale-95 flex items-center justify-center"
          >
            <img src={aerodromosIcon} alt="Aeródromos" className="w-full h-full object-cover rounded-xl" />
          </button>
          <button 
            onClick={() => {
              onOpenDownload();
              setIsOpen(false);
            }} 
            title="Download"
            className="w-14 h-12 sm:w-[60px] sm:h-[48px] p-0 overflow-hidden rounded-xl transition-all shadow-lg hover:shadow-sky-500/25 active:scale-95 flex items-center justify-center"
          >
            <img src={downloadIcon} alt="Download" className="w-full h-full object-cover rounded-xl" />
          </button>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && <div className="fixed inset-0 z-[1999]" onClick={() => setIsOpen(false)} />}
    </div>
  );
};
