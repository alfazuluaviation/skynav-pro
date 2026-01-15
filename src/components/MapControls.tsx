
import React, { useState } from 'react';
import {
    IconLayers, IconWeather, IconDots, IconTarget,
    IconSearch, IconPlus, IconMinus, IconLocation
} from './Icons';
import { LayersMenu } from './LayersMenu';

interface MapControlsProps {
    isFollowing: boolean;
    onToggleFollowing: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onCenterOnUser: () => void;
    activeLayers: string[];
    onToggleLayer: (layer: string) => void;
    downloadedLayers: string[];
}

export const MapControls: React.FC<MapControlsProps> = ({
    isFollowing,
    onToggleFollowing,
    onZoomIn,
    onZoomOut,
    onCenterOnUser,
    activeLayers,
    onToggleLayer,
    downloadedLayers,
}) => {
    const [showLayersMenu, setShowLayersMenu] = useState(false);

    return (
        <>
            {/* Desktop Controls - Right side */}
            <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-6 z-[1000] flex-col items-center gap-4">
                <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-2 rounded-2xl shadow-2xl flex flex-col gap-1.5">
                    <button
                        onClick={() => setShowLayersMenu(!showLayersMenu)}
                        className={`p-3 rounded-xl transition-all ${showLayersMenu
                            ? 'text-purple-400 bg-purple-400/20 shadow-inner'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <IconLayers />
                    </button>
                    <button className="p-3 rounded-xl text-slate-400 hover:bg-slate-800">
                        <IconWeather />
                    </button>
                    <button className="p-3 rounded-xl text-slate-400 hover:bg-slate-800">
                        <IconDots />
                    </button>
                    <button
                        onClick={onToggleFollowing}
                        className={`p-3 rounded-xl transition-all ${isFollowing
                            ? 'text-emerald-400 bg-emerald-400/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        <IconTarget />
                    </button>
                    <button className="p-3 rounded-xl text-slate-400 hover:bg-slate-800">
                        <IconSearch />
                    </button>

                    <div className="h-px bg-slate-800 w-full opacity-50 my-1"></div>

                    <button
                        onClick={onZoomIn}
                        className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                        <IconPlus />
                    </button>
                    <button
                        onClick={onCenterOnUser}
                        className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                        title="Centralizar na Localização"
                    >
                        <IconLocation />
                    </button>
                    <button
                        onClick={onZoomOut}
                        className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                        <IconMinus />
                    </button>
                </div>
            </div>

            {/* Mobile Controls - Bottom right, above bottom nav */}
            <div className="md:hidden absolute bottom-20 right-4 z-[1000] flex flex-col items-center gap-2">
                <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-1.5 rounded-2xl shadow-2xl flex flex-col gap-1">
                    <button
                        onClick={() => setShowLayersMenu(!showLayersMenu)}
                        className={`p-2.5 rounded-xl transition-all ${showLayersMenu
                            ? 'text-purple-400 bg-purple-400/20 shadow-inner'
                            : 'text-slate-400 active:bg-slate-800'
                            }`}
                    >
                        <IconLayers />
                    </button>
                    <button
                        onClick={onToggleFollowing}
                        className={`p-2.5 rounded-xl transition-all ${isFollowing
                            ? 'text-emerald-400 bg-emerald-400/20'
                            : 'text-slate-400 active:bg-slate-800'
                            }`}
                    >
                        <IconTarget />
                    </button>
                    <button
                        onClick={onCenterOnUser}
                        className="p-2.5 rounded-xl text-slate-400 active:bg-slate-800"
                        title="Centralizar na Localização"
                    >
                        <IconLocation />
                    </button>
                </div>

                <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-1.5 rounded-2xl shadow-2xl flex flex-col gap-1">
                    <button
                        onClick={onZoomIn}
                        className="p-2.5 rounded-xl text-slate-400 active:bg-slate-800"
                    >
                        <IconPlus />
                    </button>
                    <button
                        onClick={onZoomOut}
                        className="p-2.5 rounded-xl text-slate-400 active:bg-slate-800"
                    >
                        <IconMinus />
                    </button>
                </div>
            </div>

            {showLayersMenu && (
                <LayersMenu
                    onClose={() => setShowLayersMenu(false)}
                    activeLayers={activeLayers}
                    onToggleLayer={onToggleLayer}
                    downloadedLayers={downloadedLayers}
                />
            )}
        </>
    );
};
