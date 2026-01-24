
import React from 'react';
import { IconMap, IconPlane, IconMountain, IconSatellite } from './Icons';

// Base map types: roadmap respects isNightMode for light/dark, terrain shows elevation, satellite shows imagery
export type BaseMapType = 'roadmap' | 'terrain' | 'satellite';

// Visibility toggles for navigation points
export interface PointVisibility {
    waypoints: boolean;      // Fixos / Waypoints (FIX)
    vorNdb: boolean;         // VOR / NDB
    aerodromes: boolean;     // Aeródromos
    heliports: boolean;      // Helipontos
    userFixes: boolean;      // Fixos Usuário
}

interface LayersMenuProps {
    onClose: () => void;
    activeLayers: string[];
    onToggleLayer: (layer: string) => void;
    downloadedLayers: string[];
    position?: 'left' | 'right';
    isMobile?: boolean;
    activeBaseMap?: BaseMapType;
    onBaseMapChange?: (baseMap: BaseMapType) => void;
    pointVisibility?: PointVisibility;
    onTogglePointVisibility?: (key: keyof PointVisibility) => void;
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
    pointVisibility = { waypoints: true, vorNdb: true, aerodromes: true, heliports: true, userFixes: true },
    onTogglePointVisibility,
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
    
    // 3 base map options - roadmap respects night mode toggle in settings
    // Terrain has max zoom limitation (levels 15-17 depending on region)
    const mapTypes: { id: BaseMapType; name: string; icon: 'plane' | 'mountain' | 'satellite'; description: string }[] = [
        { id: 'roadmap', name: 'Rodoviário', icon: 'plane', description: 'Navegação urbana' },
        { id: 'terrain', name: 'Terreno', icon: 'mountain', description: 'Relevo e elevação' },
        { id: 'satellite', name: 'Satélite', icon: 'satellite', description: 'Imagem de satélite' }
    ];

    // Toggle items for navigation points visibility
    const visibilityToggles: Array<{ key: keyof PointVisibility; label: string; description: string }> = [
        { key: 'vorNdb', label: 'VOR / NDB', description: 'Auxílios rádio-navegação' },
        { key: 'waypoints', label: 'Fixos / Waypoints', description: 'Pontos de referência FIX' },
        { key: 'aerodromes', label: 'Aeródromos', description: 'Aeroportos e pistas' },
        { key: 'heliports', label: 'Helipontos', description: 'Pontos de pouso para helicópteros' },
        { key: 'userFixes', label: 'Fixos Usuário', description: 'Pontos criados por você' },
    ];

    // Render a toggle switch component
    const renderToggle = (toggleKey: keyof PointVisibility, label: string, description: string) => {
        const isActive = Boolean(pointVisibility[toggleKey]);
        
        const handleClick = () => {
            if (onTogglePointVisibility) {
                onTogglePointVisibility(toggleKey);
            }
        };
        
        return (
            <div 
                key={toggleKey}
                className="flex items-center justify-between py-2 px-1 cursor-pointer group"
                onClick={handleClick}
            >
                <div className="flex-1 mr-3">
                    <div className={`text-xs font-bold uppercase tracking-wide transition-colors ${isActive ? 'text-white' : 'text-slate-400'}`}>
                        {label}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{description}</div>
                </div>
                <div 
                    className={`relative w-11 h-6 rounded-full cursor-pointer transition-all duration-200 ${
                        isActive 
                            ? 'bg-purple-600 shadow-lg shadow-purple-500/50' 
                            : 'bg-slate-700'
                    }`}
                >
                    <div 
                        className={`absolute top-1 w-4 h-4 rounded-full shadow-md transition-all duration-200 ${
                            isActive 
                                ? 'translate-x-6 bg-white' 
                                : 'translate-x-1 bg-slate-400'
                        }`}
                    />
                </div>
            </div>
        );
    };

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
                    {/* Visibility Toggles Section */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                            Exibição no Mapa
                        </span>
                        {visibilityToggles.map(toggle => renderToggle(toggle.key, toggle.label, toggle.description))}
                    </div>

                    {/* Enhanced separator */}
                    <div className="relative py-2">
                        <div className="h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent w-full"></div>
                    </div>
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

                    <div className="grid grid-cols-3 gap-3">
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
                                        ) : mapType.icon === 'satellite' ? (
                                            <IconSatellite className={isActive ? "text-white w-6 h-6" : "text-slate-400 w-6 h-6"} />
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
            <div className="p-4 border-b border-slate-800 flex justify-center items-center bg-slate-800/80 relative">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                    Cartas e Mapas
                </span>
                <button
                    onClick={onClose}
                    className="absolute right-4 text-slate-500 hover:text-white transition-colors text-xl"
                >
                    &times;
                </button>
            </div>

            <div className="p-5 flex flex-col gap-6 max-h-[75vh] overflow-y-auto">
                {/* Visibility Toggles Section */}
                <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                        Exibição no Mapa
                    </span>
                    {visibilityToggles.map(toggle => renderToggle(toggle.key, toggle.label, toggle.description))}
                </div>

                {/* Enhanced separator */}
                <div className="relative py-2">
                    <div className="h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent w-full"></div>
                </div>

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

                <div className="grid grid-cols-3 gap-4">
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
                                    ) : mapType.icon === 'satellite' ? (
                                        <IconSatellite className={isActive ? "text-white w-7 h-7" : "text-slate-400 group-hover:text-white w-7 h-7"} />
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
