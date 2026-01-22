
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
    // Grupo 1: REA, REUL, REH, ARC
    const chartTypesGroup1 = [
        { id: 'REA', name: 'REA' },
        { id: 'REUL', name: 'REUL' },
        { id: 'REH', name: 'REH' },
        { id: 'ARC', name: 'ARC' },
    ];
    
    // Grupo 2: WAC, ENRC HIGH, ENRC LOW
    const chartTypesGroup2 = [
        { id: 'WAC', name: 'WAC' },
        { id: 'HIGH', name: 'ENRC HIGH' },
        { id: 'LOW', name: 'ENRC LOW' }
    ];
    
    // Simplified to just 2 options - roadmap respects night mode toggle in settings
    // Terrain has max zoom limitation (levels 15-17 depending on region)
    const mapTypes: { id: BaseMapType; name: string; icon: 'plane' | 'mountain'; description: string }[] = [
        { id: 'roadmap', name: 'Rodoviário', icon: 'plane', description: 'Navegação urbana' },
        { id: 'terrain', name: 'Terreno', icon: 'mountain', description: 'Relevo e elevação' }
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
                    {/* Grupo 1: REA, REUL, REH, ARC */}
                    <div className="grid grid-cols-4 gap-2">
                        {chartTypesGroup1.map((chart) => {
                            const isActive = activeLayers.includes(chart.id);
                            const isDownloaded = downloadedLayers.includes(chart.id);

                            return (
                                <button
                                    key={chart.id}
                                    onClick={() => onToggleLayer(chart.id)}
                                    className="flex flex-col items-center gap-1 transition-opacity opacity-100"
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
                                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900"></div>
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

                    {/* Grupo 2: WAC, ENRC HIGH, ENRC LOW */}
                    <div className="grid grid-cols-3 gap-2">
                        {chartTypesGroup2.map((chart) => {
                            const isActive = activeLayers.includes(chart.id);
                            const isDownloaded = downloadedLayers.includes(chart.id);

                            return (
                                <button
                                    key={chart.id}
                                    onClick={() => onToggleLayer(chart.id)}
                                    className="flex flex-col items-center gap-1 transition-opacity opacity-100"
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
                                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900"></div>
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
                                    <div className={`w-full aspect-square rounded-xl border-2 transition-all flex items-center justify-center relative ${
                                        isActive 
                                            ? 'border-purple-400 shadow-lg' 
                                            : 'border-slate-800 active:border-purple-500 bg-slate-800/40'
                                    }`}
                                    style={{
                                        backgroundColor: isActive ? '#7e22ce' : 'rgba(30, 41, 59, 0.6)'
                                    }}>
                                        {mapType.icon === 'mountain' ? (
                                            <IconMountain className={isActive ? "text-white w-6 h-6" : "text-slate-400 w-6 h-6"} />
                                        ) : (
                                            <IconPlane className={isActive ? "text-white w-6 h-6" : "text-slate-400 w-6 h-6"} />
                                        )}
                                        {isActive && (
                                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900"></div>
                                        )}
                                    </div>
                                    <span className={`text-[9px] font-black uppercase text-center leading-tight ${
                                        isActive ? 'text-white' : 'text-slate-400'
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
                {/* Grupo 1: REA, REUL, REH, ARC */}
                <div className="grid grid-cols-4 gap-3">
                    {chartTypesGroup1.map((chart) => {
                        const isActive = activeLayers.includes(chart.id);
                        const isDownloaded = downloadedLayers.includes(chart.id);

                        return (
                            <button
                                key={chart.id}
                                onClick={() => onToggleLayer(chart.id)}
                                className="flex flex-col items-center gap-1.5 group transition-opacity opacity-100"
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
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0d1117]"></div>
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

                {/* Grupo 2: WAC, ENRC HIGH, ENRC LOW */}
                <div className="grid grid-cols-3 gap-3">
                    {chartTypesGroup2.map((chart) => {
                        const isActive = activeLayers.includes(chart.id);
                        const isDownloaded = downloadedLayers.includes(chart.id);

                        return (
                            <button
                                key={chart.id}
                                onClick={() => onToggleLayer(chart.id)}
                                className="flex flex-col items-center gap-1.5 group transition-opacity opacity-100"
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
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0d1117]"></div>
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
                                <div className={`w-full aspect-square rounded-2xl border-2 transition-all flex items-center justify-center relative ${
                                    isActive 
                                        ? 'border-purple-400 shadow-lg' 
                                        : 'border-slate-800 group-hover:border-purple-500 bg-slate-800/40'
                                }`}
                                style={{
                                    backgroundColor: isActive ? '#7e22ce' : 'rgba(30, 41, 59, 0.6)'
                                }}>
                                    {mapType.icon === 'mountain' ? (
                                        <IconMountain className={isActive ? "text-white w-7 h-7" : "text-slate-400 group-hover:text-white w-7 h-7"} />
                                    ) : (
                                        <IconPlane className={isActive ? "text-white w-7 h-7" : "text-slate-400 group-hover:text-white w-7 h-7"} />
                                    )}
                                    {isActive && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0d1117]"></div>
                                    )}
                                </div>
                                <span className={`text-[10px] font-black uppercase text-center leading-tight ${
                                    isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
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
