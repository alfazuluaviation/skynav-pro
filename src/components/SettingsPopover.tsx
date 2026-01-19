import React from 'react';
import { IconDownload, IconUser } from './Icons';
import { AiracCycle } from '../../types';
import { RefreshCw, Check, X, MapPin, Loader2 } from 'lucide-react';
import { LocationPermissionStatus } from '@/hooks/useLocationPermission';

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
    isMobile?: boolean;
    // PWA Update props
    needRefresh?: boolean;
    lastUpdateDate?: string | null;
    onUpdate?: () => void;
    onCheckUpdate?: () => void;
    isCheckingUpdate?: boolean;
    onClose?: () => void;
    // Location props
    locationPermission?: LocationPermissionStatus;
    onRequestLocation?: () => void;
    isRequestingLocation?: boolean;
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
    isMobile = false,
    needRefresh = false,
    lastUpdateDate = null,
    onUpdate,
    onCheckUpdate,
    isCheckingUpdate = false,
    onClose,
    locationPermission = 'unknown',
    onRequestLocation,
    isRequestingLocation = false,
}) => {
    const containerClass = isMobile 
        ? "w-full p-5" 
        : "absolute left-16 bottom-4 w-72 max-h-[calc(100vh-2rem)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-3xl p-5 z-[2100] animate-in";

    const getLocationStatusColor = () => {
        switch (locationPermission) {
            case 'granted': return 'bg-emerald-500';
            case 'denied': return 'bg-red-500';
            case 'prompt': return 'bg-amber-500';
            default: return 'bg-slate-600';
        }
    };

    const getLocationStatusText = () => {
        switch (locationPermission) {
            case 'granted': return 'Permitido';
            case 'denied': return 'Negado';
            case 'prompt': return 'Não solicitado';
            default: return 'Verificando...';
        }
    };

    return (
        <div
            className={containerClass}
            style={!isMobile ? { animationName: 'slide-in' } : undefined}
        >
            <div className="flex items-center justify-between mb-6 px-1">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Configurações
                </h3>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 flex items-center justify-center transition-colors"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                )}
            </div>

            <div className="flex flex-col gap-6">
                {/* USER PROFILE */}
                <div className="flex items-center gap-4 px-1 pb-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
                        <IconUser />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-black text-slate-100 truncate">
                            {userName || 'Piloto'}
                        </span>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-medium truncate mb-1">
                                {userEmail || 'usuario@skyfpl.com'}
                            </span>
                            <button className="w-fit text-[10px] font-black text-purple-400 uppercase tracking-widest hover:text-purple-300 active:text-purple-200 transition-colors">
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
                            className={`w-14 h-7 sm:w-12 sm:h-6 rounded-full relative transition-colors ${isNightMode ? 'bg-purple-600' : 'bg-slate-700'
                                }`}
                        >
                            <div
                                className={`absolute top-1 w-5 h-5 sm:w-4 sm:h-4 rounded-full bg-white transition-all ${isNightMode ? 'right-1' : 'left-1'
                                    }`}
                            />
                        </button>
                    </div>
                    <p className="text-[9px] text-slate-500 leading-tight px-1">
                        Altere entre o modo dia e noite para melhor visibilidade em voo.
                    </p>
                </div>

                <div className="h-px bg-slate-800 w-full opacity-50"></div>

                {/* LOCALIZAÇÃO */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Localização</span>
                    </div>

                    <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">STATUS</span>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${getLocationStatusColor()} shadow-[0_0_6px_rgba(0,0,0,0.3)]`}></div>
                                    <span className={`text-xs font-bold ${locationPermission === 'granted' ? 'text-emerald-400' : locationPermission === 'denied' ? 'text-red-400' : 'text-amber-400'}`}>
                                        {getLocationStatusText()}
                                    </span>
                                </div>
                            </div>
                            {locationPermission !== 'granted' && (
                                <button
                                    onClick={onRequestLocation}
                                    disabled={isRequestingLocation || locationPermission === 'denied'}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
                                        locationPermission === 'denied' 
                                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                            : 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white'
                                    }`}
                                >
                                    {isRequestingLocation ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : locationPermission === 'denied' ? (
                                        'Bloqueado'
                                    ) : (
                                        'Solicitar'
                                    )}
                                </button>
                            )}
                        </div>
                        <p className="text-[9px] text-slate-500 leading-tight">
                            {locationPermission === 'denied' 
                                ? 'Acesse as configurações do navegador para permitir a localização.'
                                : 'Necessário para navegação GPS e cálculo de posição em voo.'
                            }
                        </p>
                    </div>
                </div>

                <div className="h-px bg-slate-800 w-full opacity-50"></div>

                {/* ATUALIZAÇÃO */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Atualização</span>
                        </div>
                        {!needRefresh && onCheckUpdate && (
                            <button
                                onClick={onCheckUpdate}
                                disabled={isCheckingUpdate}
                                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 flex items-center justify-center transition-colors disabled:opacity-50"
                                title="Verificar atualizações"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                            </button>
                        )}
                    </div>

                    {needRefresh ? (
                        <button
                            onClick={onUpdate}
                            className="bg-purple-600/20 rounded-xl p-3 border border-purple-500/50 flex justify-between items-center group hover:border-purple-400 active:bg-purple-600/30 transition-all"
                        >
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] text-purple-400 font-bold uppercase tracking-widest">NOVA VERSÃO</span>
                                <span className="text-xs font-bold text-purple-300">Toque para atualizar</span>
                            </div>
                            <RefreshCw className="w-4 h-4 text-purple-400 group-hover:animate-spin" />
                        </button>
                    ) : (
                        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">STATUS</span>
                                    <span className="text-xs font-bold text-emerald-400">Atualizado</span>
                                </div>
                                <Check className="w-4 h-4 text-emerald-500" />
                            </div>
                            {lastUpdateDate && (
                                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/50">
                                    <span className="text-[9px] text-slate-600 font-medium">Última verificação:</span>
                                    <span className="text-[10px] text-slate-400 font-mono">{lastUpdateDate}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="h-px bg-slate-800 w-full opacity-50"></div>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-1">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">CICLO AIRAC</span>
                    </div>

                    {/* AIRAC VIGENTE */}
                    <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800 flex justify-between items-center group hover:border-slate-700 active:border-slate-600 transition-colors">
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

                    <div className="grid grid-cols-4 sm:grid-cols-3 gap-2">
                        {['HIGH', 'LOW', 'REA', 'WAC'].map(type => {
                            const isDownloaded = downloadedLayers.includes(type);
                            const progress = syncingLayers[type];
                            const isSyncing = progress !== undefined;

                            return (
                                <button
                                    key={type}
                                    onClick={() => onDownloadLayer(type)}
                                    disabled={isSyncing && !isDownloaded}
                                    className={`hover:bg-[#21262d] active:bg-[#2d333b] border py-3 rounded-xl flex flex-col items-center justify-center gap-1.5 group transition-all relative overflow-hidden ${isDownloaded
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
