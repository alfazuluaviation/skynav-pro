import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useBarometricAltitude } from '../hooks/useBarometricAltitude';
import { ChevronUp, ChevronDown, Minus, Settings, X, GripHorizontal, RotateCcw } from 'lucide-react';

interface AltimeterDisplayProps {
  visible: boolean;
  onClose: () => void;
}

interface Position {
  x: number;
  y: number;
}

export const AltimeterDisplay: React.FC<AltimeterDisplayProps> = ({ visible, onClose }) => {
  const { data, qnh, updateQnh, resetQnhToStandard, standardPressure } = useBarometricAltitude();
  const [showSettings, setShowSettings] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Draggable state
  const [position, setPosition] = useState<Position>(() => {
    const saved = localStorage.getItem('skyfpl_altimeter_position');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { x: 20, y: 100 };
      }
    }
    return { x: 20, y: 100 };
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist position
  useEffect(() => {
    localStorage.setItem('skyfpl_altimeter_position', JSON.stringify(position));
  }, [position]);

  // Dragging handlers
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !dragStartRef.current) return;
    
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    
    const newX = Math.max(0, Math.min(window.innerWidth - 180, dragStartRef.current.posX + deltaX));
    const newY = Math.max(0, Math.min(window.innerHeight - 100, dragStartRef.current.posY + deltaY));
    
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const handleMouseUp = () => handleDragEnd();
    
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Get trend icon and color
  const getTrendDisplay = () => {
    switch (data.trend) {
      case 'climbing':
        return { icon: ChevronUp, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' };
      case 'descending':
        return { icon: ChevronDown, color: 'text-orange-400', bgColor: 'bg-orange-500/20' };
      default:
        return { icon: Minus, color: 'text-slate-400', bgColor: 'bg-slate-500/20' };
    }
  };

  // Format altitude with thousands separator
  const formatAltitude = (alt: number): string => {
    return alt.toLocaleString('pt-BR');
  };

  // Format vertical speed
  const formatVS = (vs: number): string => {
    const sign = vs >= 0 ? '+' : '';
    return `${sign}${vs}`;
  };

  if (!visible) return null;

  const trendDisplay = getTrendDisplay();
  const TrendIcon = trendDisplay.icon;
  const isStandardQnh = Math.abs(qnh - standardPressure) < 0.1;

  return (
    <div
      ref={containerRef}
      className={`fixed z-[10000] select-none transition-all duration-200 ${isDragging ? 'cursor-grabbing' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        touchAction: 'none',
      }}
    >
      {/* Main Display */}
      <div className={`
        bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900
        border border-slate-600/50 rounded-2xl shadow-2xl
        backdrop-blur-xl overflow-hidden
        ${isMinimized ? 'w-16' : 'w-44'}
        transition-all duration-300
      `}>
        {/* Header - Drag Handle */}
        <div
          className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/50 cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center gap-1.5">
            <GripHorizontal className="w-3.5 h-3.5 text-slate-500" />
            {!isMinimized && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ALT</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isMinimized && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 hover:bg-slate-700/50 rounded transition-colors"
              >
                <Settings className="w-3 h-3 text-slate-400" />
              </button>
            )}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-slate-700/50 rounded transition-colors"
            >
              <Minus className="w-3 h-3 text-slate-400" />
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-red-500/20 rounded transition-colors"
            >
              <X className="w-3 h-3 text-slate-400 hover:text-red-400" />
            </button>
          </div>
        </div>

        {/* Minimized View */}
        {isMinimized ? (
          <div className="p-2 text-center">
            <span className="text-lg font-mono font-black text-cyan-400">
              {Math.round(data.altitude / 100)}
            </span>
            <span className="text-[8px] text-slate-500 block">×100</span>
          </div>
        ) : (
          <>
            {/* Main Altitude Display */}
            <div className="p-3 space-y-2">
              {/* Altitude */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className={`
                    text-3xl font-mono font-black tracking-tight
                    ${data.isValid ? 'text-cyan-400' : 'text-slate-500'}
                    drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]
                  `}>
                    {data.isValid ? formatAltitude(data.altitude) : '----'}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  FT MSL
                </span>
              </div>

              {/* Vertical Speed & Trend */}
              <div className="flex items-center justify-between px-1">
                {/* VS Display */}
                <div className="flex items-center gap-1.5">
                  <div className={`p-1 rounded ${trendDisplay.bgColor}`}>
                    <TrendIcon className={`w-4 h-4 ${trendDisplay.color}`} />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-mono font-bold ${trendDisplay.color}`}>
                      {formatVS(data.verticalSpeed)}
                    </span>
                    <span className="text-[8px] text-slate-500 uppercase">FPM</span>
                  </div>
                </div>

                {/* QNH Badge */}
                <div 
                  className={`
                    px-2 py-1 rounded-lg text-center cursor-pointer
                    ${isStandardQnh ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-emerald-500/20 border border-emerald-500/30'}
                  `}
                  onClick={() => setShowSettings(true)}
                >
                  <span className={`text-xs font-mono font-bold ${isStandardQnh ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {qnh.toFixed(0)}
                  </span>
                  <span className="text-[7px] text-slate-400 block">QNH</span>
                </div>
              </div>

              {/* Source indicator */}
              <div className="flex flex-col items-center gap-0.5 pt-1">
                <div className="flex items-center justify-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${data.isValid ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  <span className="text-[8px] text-slate-500 uppercase">
                    {data.source === 'gps' ? 'GPS' : data.source === 'barometer' ? 'BARO' : 'SIM'}
                  </span>
                </div>
                {!data.isValid && (
                  <span className="text-[7px] text-amber-400/80 text-center px-2">
                    Altitude GPS indisponível
                  </span>
                )}
              </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
              <div className="border-t border-slate-700/50 p-3 space-y-3 bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Ajuste QNH</span>
                  <button
                    onClick={() => {
                      resetQnhToStandard();
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded text-amber-400 text-[9px] font-bold transition-colors"
                    title="Reset para 1013.25 hPa (FL)"
                  >
                    <RotateCcw className="w-3 h-3" />
                    STD
                  </button>
                </div>
                
                {/* QNH Input */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQnh(qnh - 1)}
                    className="w-8 h-8 flex items-center justify-center bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-slate-300 font-bold transition-colors"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center">
                    <input
                      type="number"
                      value={qnh.toFixed(1)}
                      onChange={(e) => updateQnh(parseFloat(e.target.value) || standardPressure)}
                      className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-2 py-1.5 text-center text-lg font-mono font-bold text-cyan-400 focus:outline-none focus:border-cyan-500/50"
                      step="0.1"
                      min="950"
                      max="1050"
                    />
                    <span className="text-[8px] text-slate-500">hPa</span>
                  </div>
                  <button
                    onClick={() => updateQnh(qnh + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-slate-300 font-bold transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* inHg conversion display */}
                <div className="text-center text-[9px] text-slate-500">
                  = {(qnh * 0.02953).toFixed(2)} inHg
                </div>

                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full py-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-[10px] font-bold text-slate-300 transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AltimeterDisplay;
