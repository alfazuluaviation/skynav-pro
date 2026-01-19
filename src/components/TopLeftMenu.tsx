import React, { useState, memo } from 'react';
import { IconMenu } from './Icons';
import { Map, Plane, Download } from 'lucide-react';

interface TopLeftMenuProps {
  onOpenCharts: () => void;
  onOpenAerodromes: () => void;
  onOpenDownload: () => void;
}

// Memoized menu item for performance
const MenuItem = memo(({ 
  onClick, 
  title, 
  icon: Icon,
  gradientFrom,
  gradientTo 
}: { 
  onClick: () => void; 
  title: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  gradientFrom: string;
  gradientTo: string;
}) => (
  <button 
    onClick={onClick} 
    title={title} 
    className="w-14 h-12 sm:w-[60px] sm:h-[48px] p-0 overflow-hidden rounded-xl transition-all shadow-lg hover:shadow-sky-500/25 active:scale-95 flex items-center justify-center"
    style={{
      background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`
    }}
  >
    <Icon className="w-7 h-7 text-white drop-shadow-md" strokeWidth={1.5} />
  </button>
));

MenuItem.displayName = 'MenuItem';

export const TopLeftMenu: React.FC<TopLeftMenuProps> = memo(({
  onOpenCharts,
  onOpenAerodromes,
  onOpenDownload
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenCharts = () => {
    onOpenCharts();
    setIsOpen(false);
  };

  const handleOpenAerodromes = () => {
    onOpenAerodromes();
    setIsOpen(false);
  };

  const handleOpenDownload = () => {
    onOpenDownload();
    setIsOpen(false);
  };

  return (
    <div className="absolute top-4 left-4 md:left-1 z-[2100] safe-top safe-left">
      {/* Hamburger Icon Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        aria-label="Toggle menu" 
        className="p-3 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl flex items-center justify-center hover:bg-slate-800 active:bg-slate-700 transition-all z-[2001] relative gap-0"
      >
        <IconMenu />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-3 z-[2002] gap-2 shadow-2xl flex flex-row animate-in mx-[42px]">
          <MenuItem 
            onClick={handleOpenCharts}
            title="Cartas"
            icon={Map}
            gradientFrom="#0f4c75"
            gradientTo="#1a73a7"
          />
          <MenuItem 
            onClick={handleOpenAerodromes}
            title="Aeródromos"
            icon={Plane}
            gradientFrom="#0f4c75"
            gradientTo="#1a73a7"
          />
          <MenuItem 
            onClick={handleOpenDownload}
            title="Download"
            icon={Download}
            gradientFrom="#0f4c75"
            gradientTo="#1a73a7"
          />
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
});

TopLeftMenu.displayName = 'TopLeftMenu';
