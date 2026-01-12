import React, { useState } from 'react';
import { IconMenu } from './Icons';
interface TopLeftMenuProps {
  onOpenCharts: () => void;
  onOpenAerodromes: () => void;
}
export const TopLeftMenu: React.FC<TopLeftMenuProps> = ({
  onOpenCharts,
  onOpenAerodromes
}) => {
  const [isOpen, setIsOpen] = useState(false);
  return <div className="absolute top-4 left-18z-[2000]">
      {/* Hamburger Icon Button */}
      <button onClick={() => setIsOpen(!isOpen)} aria-label="Toggle menu" className="p-3 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl flex items-center justify-center hover:bg-slate-800 transition-all z-[2001] relative text-center mx-[5px]">
        <IconMenu />
      </button>

      {/* Dropdown Menu */}
      {isOpen && <div className="absolute top-full mt-2 left-14 w-52 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-3 z-[2002] gap-2 items-start justify-start px-[20px] py-[20px] my-0 shadow-inner flex flex-row mx-[10px]">
          <button onClick={() => {
        onOpenCharts();
        setIsOpen(false);
      }} className="w-[160px] px-4 py-3 text-center text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition-all shadow-lg hover:shadow-sky-500/25">
            📄 Cartas
          </button>
          <button onClick={() => {
        onOpenAerodromes();
        setIsOpen(false);
      }} className="w-[160px] px-4 py-3 text-center text-sm font-bold text-white bg-sky-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg hover:shadow-sky-500/25">
            🛫 Aeródr
          </button>
        </div>}

      {/* Click outside to close */}
      {isOpen && <div className="fixed inset-0 z-[1999]" onClick={() => setIsOpen(false)} />}
    </div>;
};