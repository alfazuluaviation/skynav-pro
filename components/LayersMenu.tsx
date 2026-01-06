
import React from 'react';
import { IconMap, IconPlane } from './Icons';

interface LayersMenuProps {
    onClose: () => void;
    activeLayers: string[];
    onToggleLayer: (layer: string) => void;
    downloadedLayers: string[];
}

export const LayersMenu: React.FC<LayersMenuProps> = ({
    onClose,
    activeLayers,
    onToggleLayer,
    downloadedLayers,
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
    const mapTypes = ['Rodoviário claro', 'Rodoviário escuro', 'Terreno', 'Satélite', 'Satélite limpo'];

    return (
        <div className="absolute right-24 top-1/2 -translate-y-1/2 w-[340px] z-[2000] bg-slate-900 border border-slate-800 rounded-3xl shadow-3xl overflow-hidden animate-in shadow-black/80">
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

                <div className="grid grid-cols-3 gap-3">
                    {mapTypes.map((name) => (
                        <button key={name} className="flex flex-col items-center gap-1.5 group">
                            <div className="w-full aspect-square rounded-2xl border-2 border-slate-800 group-hover:border-teal-500 transition-all bg-slate-800/40 flex items-center justify-center">
                                <IconPlane className="text-slate-500 group-hover:text-teal-400" />
                            </div>
                            <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-slate-300 text-center leading-tight">
                                {name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
