import React from 'react';
import { IconDownload, IconUser } from './Icons';
import { AiracCycle } from '../../types';

interface SettingsPopoverProps {
    userName?: string;
    userEmail?: string;
    isNightMode: boolean;
    onToggleNightMode: () => void;
    activeLayers: string[];
    onToggleLayer: (layer: string) => void;
    downloadedLayers: string[];
    onDownloadLayer: (layer: string) => void;
    syncingLayers: Record<string, number>;
    airac: AiracCycle | null;
}

export const SettingsPopover: React.FC<SettingsPopoverProps> = ({
    userName,
    userEmail,
    isNightMode,
    onToggleNightMode,
    activeLayers,
    onToggleLayer,
    downloadedLayers,
    onDownloadLayer,
    syncingLayers,
    airac,
}) => {
    return (
        <div
            className="absolute left-16 bottom-0 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-3xl p-5 z-[2100] animate-in"
            style={{ animationName: 'slide-in' }}
        >
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 px-1">
                Configurações
            </h3>

            <div className="flex flex-col gap-6">
                {/* USER PROFILE */}
                <div className="flex items-center gap-4 px-1 pb-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <IconUser />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-slate-100 truncate">
                            {userName || 'Piloto'}
                        </span>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-medium truncate mb-1">
                                {userEmail || 'usuario@skyfpl.com'}
                            </span>
                            <button className="w-fit text-[10px] font-black text-purple-400 uppercase tracking-widest hover:text-purple-300 transition-colors">
                                Perfil
                            </button>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-slate-800 w-full opacity-50"></div>

                {/* MODO NOTURNO */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-300">MODO NOTURNO</span>
                        <button
                            onClick={onToggleNightMode}
                            className={`w-12 h-6 rounded-full relative transition-colors ${isNightMode ? 'bg-purple-600' : 'bg-slate-700'
                                }`}
                        >
                            <div
                                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isNightMode ? 'right-1' : 'left-1'
                                    }`}
                            />
                        </button>
                    </div>
                    <p className="text-[9px] text-slate-500 leading-tight px-1">
                        Altere entre o modo dia e noite para melhor visibilidade em voo.
                    </p>
                </div>

                <div className="h-px bg-slate-800 w-full opacity-50"></div>

                {/* CICLO AIRAC */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-1">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">CICLO AIRAC</span>
                    </div>

                    {/* AIRAC VIGENTE */}
                    <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800 flex justify-between items-center group hover:border-slate-700 transition-colors">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">AIRAC VIGENTE</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-black text-slate-200">{airac?.current || '2513'}</span>
                                <span className="text-[9px] text-slate-500 font-mono">VIGÊNCIA: {airac?.effectiveDate || '25/12/2025'}</span>
                            </div>
                        </div>
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"></div>
                    </div>

                    {/* PRÓXIMO CICLO */}
                    <div className="bg-slate-800/20 rounded-xl p-3 border border-slate-800/50 flex justify-between items-center">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">PRÓXIMO CICLO</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-bold text-slate-400">{airac?.next || '2514'}</span>
                                <span className="text-[9px] text-slate-600 font-mono">VIGÊNCIA: {airac?.nextCycleDate || '22/01/2026'}</span>
                            </div>
                        </div>
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                    </div>
                </div>

                <div className="h-px bg-slate-800 w-full opacity-50"></div>

                {/* DOWNLOAD */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 px-1">
                        <IconDownload />
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Download</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {['HIGH', 'LOW', 'REA', 'WAC'].map(type => {
                            const isDownloaded = downloadedLayers.includes(type);
                            const progress = syncingLayers[type];
                            const isSyncing = progress !== undefined;

                            return (
                                <button
                                    key={type}
                                    onClick={() => onDownloadLayer(type)}
                                    disabled={isSyncing && !isDownloaded}
                                    className={`hover:bg-[#21262d] border py-3 rounded-xl flex flex-col items-center justify-center gap-1.5 group transition-all relative overflow-hidden ${isDownloaded
                                        ? 'bg-[#161b22] border-slate-800'
                                        : 'bg-slate-800/30 border-slate-800 border-dashed opacity-70'
                                        }`}
                                >
                                    <span className={`text-[9px] font-black uppercase tracking-tighter ${isDownloaded
                                        ? 'text-slate-100'
                                        : 'text-slate-500'
                                        }`}>
                                        {type === 'HIGH' ? 'ENRC HIGH' : type === 'LOW' ? 'ENRC LOW' : type}
                                    </span>

                                    {isDownloaded ? (
                                        <div className="flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                            <div className="text-[8px] font-bold text-slate-500 group-hover:text-slate-400">DISPONÍVEL</div>
                                        </div>
                                    ) : (
                                        <div className="text-[8px] font-bold text-slate-600 group-hover:text-slate-400">
                                            {isSyncing ? `${progress}%` : 'BAIXAR'}
                                        </div>
                                    )}

                                    {isSyncing && (
                                        <div
                                            className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-teal-600 to-teal-400 transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
