
import React from 'react';
import { IconMap, IconPlane, IconMountain } from './Icons';

// Simplified to just 'roadmap' and 'terrain' - roadmap respects isNightMode for light/dark
export type BaseMapType = 'roadmap' | 'terrain';

interface LayersMenuProps {
    onClose: () => void;
    activeLayers: string[];
    onToggleLayer: (layer: string) => void;
    downloadedLayers: string[];
    position?: 'left' | 'right';
    isMobile?: boolean;
    activeBaseMap?: BaseMapType;
    onBaseMapChange?: (baseMap: BaseMapType) => void;
}

export const LayersMenu: React.FC<LayersMenuProps> = ({
    onClose,
    activeLayers,
    onToggleLayer,
    downloadedLayers,
    position = 'right',
    isMobile = false,
    activeBaseMap = 'roadmap',
    onBaseMapChange,
}) => {
    const chartTypes = [
        { id: 'REA', name: 'REA' },
        { id: 'ARC', name: 'ARC' },
        { id: 'REH', name: 'REH' },
        { id: 'REUL', name: 'REUL' },
        { id: 'WAC', name: 'WAC' },
        { id: 'HIGH', name: 'ENRC HIGH' },
        { id: 'LOW', name: 'ENRC LOW' }
    ];
    
    // Simplified to just 2 options - roadmap respects night mode toggle in settings
    const mapTypes: { id: BaseMapType; name: string; icon: 'plane' | 'mountain' }[] = [
        { id: 'roadmap', name: 'Rodoviário', icon: 'plane' },
        { id: 'terrain', name: 'Terreno', icon: 'mountain' }
    ];

    // Mobile content - without wrapper
    if (isMobile) {
        return (
            <>
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-sm font-black uppercase tracking-wider text-slate-300">
                        Cartas e Mapas
                    </span>
                    <button
                        onClick={onClose}
                        className="text-slate-500 active:text-white transition-colors text-2xl p-1"
                    >
                        &times;
                    </button>
                </div>

                <div className="p-4 flex flex-col gap-4">
                    <div className="grid grid-cols-4 gap-2">
                        {chartTypes.map((chart) => {
                            const isActive = activeLayers.includes(chart.id);
                            const isEnrc = chart.id === 'HIGH' || chart.id === 'LOW' || chart.id === 'REA';
                            const isDownloaded = !isEnrc || downloadedLayers.includes(chart.id);

                            return (
                                <button
                                    key={chart.id}
                                    onClick={() => {
                                        if (isDownloaded) onToggleLayer(chart.id);
                                    }}
                                    disabled={!isDownloaded}
                                    className={`flex flex-col items-center gap-1 transition-opacity ${!isDownloaded ? 'opacity-30' : 'opacity-100'}`}
                                >
                                    <div
                                        className={`w-12 h-12 rounded-xl border-2 transition-all flex items-center justify-center relative ${isActive ? 'border-purple-400 shadow-lg' : 'border-slate-800'
                                            }`}
                                        style={{
                                            backgroundColor: isActive ? '#7e22ce' : 'rgba(30, 41, 59, 0.6)'
                                        }}
                                    >
                                        <IconMap className={isActive ? 'text-white' : 'text-slate-400'} />
                                        {isActive && (
                                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-purple-500 rounded-full border-2 border-slate-900"></div>
                                        )}
                                    </div>
                                    <span className={`text-[8px] font-black uppercase text-center leading-tight ${isActive ? 'text-white' : 'text-slate-400'
                                        }`}>
                                        {chart.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="h-px bg-slate-800 w-full opacity-30"></div>

                    <div className="grid grid-cols-2 gap-3">
                        {mapTypes.map((mapType) => {
                            const isActive = activeBaseMap === mapType.id;
                            return (
                                <button 
                                    key={mapType.id} 
                                    onClick={() => onBaseMapChange?.(mapType.id)}
                                    className="flex flex-col items-center gap-1"
                                >
                                    <div className={`w-full aspect-square rounded-xl border-2 transition-all flex items-center justify-center ${
                                        isActive 
                                            ? 'border-teal-400 bg-teal-500/20' 
                                            : 'border-slate-800 active:border-teal-500 bg-slate-800/40'
                                    }`}>
                                        {mapType.icon === 'mountain' ? (
                                            <IconMountain className={isActive ? "text-teal-400 w-6 h-6" : "text-slate-500 w-6 h-6"} />
                                        ) : (
                                            <IconPlane className={isActive ? "text-teal-400 w-6 h-6" : "text-slate-500 w-6 h-6"} />
                                        )}
                                    </div>
                                    <span className={`text-[9px] font-black uppercase text-center leading-tight ${
                                        isActive ? 'text-teal-400' : 'text-slate-500'
                                    }`}>
                                        {mapType.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </>
        );
    }

    // Desktop content - without wrapper (wrapper is in Sidebar)
    return (
        <>
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/80">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                    Cartas e Mapas
                </span>
                <button
                    onClick={onClose}
                    className="text-slate-500 hover:text-white transition-colors text-xl"
                >
                    &times;
                </button>
            </div>

            <div className="p-5 flex flex-col gap-6 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-4 gap-3">
                    {chartTypes.map((chart) => {
                        const isActive = activeLayers.includes(chart.id);
                        const isEnrc = chart.id === 'HIGH' || chart.id === 'LOW' || chart.id === 'REA';
                        const isDownloaded = !isEnrc || downloadedLayers.includes(chart.id);

                        return (
                            <button
                                key={chart.id}
                                onClick={() => isDownloaded && onToggleLayer(chart.id)}
                                disabled={!isDownloaded}
                                className={`flex flex-col items-center gap-1.5 group transition-opacity ${!isDownloaded ? 'opacity-30 cursor-not-allowed' : 'opacity-100'}`}
                            >
                                <div
                                    className={`w-14 h-14 rounded-2xl border-2 transition-all flex items-center justify-center relative ${isActive ? 'border-purple-400 shadow-lg' : 'border-slate-800'
                                        }`}
                                    style={{
                                        backgroundColor: isActive ? '#7e22ce' : 'rgba(30, 41, 59, 0.6)'
                                    }}
                                >
                                    <IconMap className={isActive ? 'text-white' : 'text-slate-400'} />
                                    {isActive && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-[#0d1117]"></div>
                                    )}
                                </div>
                                <span className={`text-[9px] font-black uppercase text-center leading-tight transition-colors ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                                    }`}>
                                    {chart.name}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="h-px bg-slate-800 w-full opacity-30"></div>

                <div className="grid grid-cols-2 gap-4">
                    {mapTypes.map((mapType) => {
                        const isActive = activeBaseMap === mapType.id;
                        return (
                            <button 
                                key={mapType.id} 
                                onClick={() => onBaseMapChange?.(mapType.id)}
                                className="flex flex-col items-center gap-2 group"
                            >
                                <div className={`w-full aspect-square rounded-2xl border-2 transition-all flex items-center justify-center ${
                                    isActive 
                                        ? 'border-teal-400 bg-teal-500/20' 
                                        : 'border-slate-800 group-hover:border-teal-500 bg-slate-800/40'
                                }`}>
                                    {mapType.icon === 'mountain' ? (
                                        <IconMountain className={isActive ? "text-teal-400 w-7 h-7" : "text-slate-500 group-hover:text-teal-400 w-7 h-7"} />
                                    ) : (
                                        <IconPlane className={isActive ? "text-teal-400 w-7 h-7" : "text-slate-500 group-hover:text-teal-400 w-7 h-7"} />
                                    )}
                                </div>
                                <span className={`text-[10px] font-black uppercase text-center leading-tight ${
                                    isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'
                                }`}>
                                    {mapType.name}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
};
