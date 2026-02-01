
import React, { useState } from 'react';
import {
    IconMenu, IconPlane, IconMap, IconRoute,
    IconStar, IconFile, IconStore, IconSettings, IconMinus, IconLayers, IconUser
} from './Icons';
import { IconButton } from './IconButton';
import { SettingsPopover } from './SettingsPopover';
import { LayersMenu, BaseMapType, PointVisibility } from './LayersMenu';
import { AiracCycle } from '../../types';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { useLocationPermission } from '@/hooks/useLocationPermission';
import { useDownloadManager } from '@/hooks/useDownloadManager';
import { Map, MapPin, Plane, Download, Gauge } from 'lucide-react';

interface SidebarProps {
    userName?: string;
    userEmail?: string;
    showPlanPanel: boolean;
    onTogglePlanPanel: () => void;
    isNightMode: boolean;
    onToggleNightMode: () => void;
    onSignOut: () => void;
    activeLayers: string[];
    onToggleLayer: (layer: string) => void;
    downloadedLayers: string[];
    onDownloadLayer: (layer: string) => void;
    airac: AiracCycle | null;
    activeBaseMap: BaseMapType;
    onBaseMapChange: (baseMap: BaseMapType) => void;
    onMenuStateChange?: (isMenuOpen: boolean) => void;
    isLoggedIn?: boolean;
    onLogin?: () => void;
    pointVisibility?: PointVisibility;
    onTogglePointVisibility?: (key: keyof PointVisibility) => void;
    // New props for main menu functionality
    onOpenCharts?: () => void;
    onOpenAerodromes?: () => void;
    onOpenAircraft?: () => void;
    onOpenDownload?: () => void;
    // Altimeter toggle
    showAltimeter?: boolean;
    onToggleAltimeter?: () => void;
    // MBTiles toggle for testing
    mbtilesReady?: Record<string, boolean>;
    forceMBTiles?: boolean;
    onToggleForceMBTiles?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    userName,
    userEmail,
    showPlanPanel,
    onTogglePlanPanel,
    isNightMode,
    onToggleNightMode,
    onSignOut,
    activeLayers,
    onToggleLayer,
    downloadedLayers,
    onDownloadLayer,
    airac,
    activeBaseMap,
    onBaseMapChange,
    onMenuStateChange,
    isLoggedIn = false,
    onLogin,
    pointVisibility = { waypoints: true, aerodromes: true, heliports: true, userFixes: true },
    onTogglePointVisibility,
    onOpenCharts,
    onOpenAerodromes,
    onOpenAircraft,
    onOpenDownload,
    showAltimeter = false,
    onToggleAltimeter,
    mbtilesReady = {},
    forceMBTiles = false,
    onToggleForceMBTiles,
}) => {
    const [showSettings, setShowSettings] = useState(false);
    const [showLayersMenu, setShowLayersMenu] = useState(false);
    const [showMainMenu, setShowMainMenu] = useState(false);
    const { needRefresh, lastUpdateDate, handleUpdate, checkForUpdate, forceRefresh, isChecking, currentVersion } = usePWAUpdate();
    const { permissionStatus, isRequesting, requestPermission, showIOSInstructions } = useLocationPermission();
    const { syncingLayers } = useDownloadManager();

    // Notify parent when menus are open (mobile only)
    React.useEffect(() => {
        if (onMenuStateChange) {
            onMenuStateChange(showSettings || showLayersMenu || showMainMenu);
        }
    }, [showSettings, showLayersMenu, showMainMenu, onMenuStateChange]);

    // Handlers for main menu items
    const handleOpenCharts = () => {
        onOpenCharts?.();
        setShowMainMenu(false);
    };

    const handleOpenAerodromes = () => {
        onOpenAerodromes?.();
        setShowMainMenu(false);
    };

    const handleOpenAircraft = () => {
        onOpenAircraft?.();
        setShowMainMenu(false);
    };

    const handleOpenDownload = () => {
        onOpenDownload?.();
        setShowMainMenu(false);
    };

    const handleToggleAltimeter = () => {
        onToggleAltimeter?.();
        setShowMainMenu(false);
    };

    return (
        <>
            {/* Desktop Sidebar - Hidden on mobile */}
            <aside className="hidden md:flex w-14 flex-col items-center py-6 bg-slate-900 border-r border-slate-800 z-[2000] shadow-2xl shrink-0">
                {/* Main Menu Button (Hamburger) */}
                <button 
                    onClick={() => setShowMainMenu(!showMainMenu)}
                    className={`mb-8 p-2 rounded-xl transition-all ${showMainMenu ? 'text-teal-400 bg-teal-500/20' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                    title="Menu Principal"
                >
                    <IconMenu />
                </button>

                <nav className="flex flex-col gap-6 flex-1">
                    <IconButton
                        icon={<IconRoute />}
                        onClick={onTogglePlanPanel}
                        isActive={showPlanPanel}
                        activeColor="teal"
                    />
                    <IconButton
                        icon={<IconLayers />}
                        onClick={() => setShowLayersMenu(!showLayersMenu)}
                        isActive={showLayersMenu}
                        activeColor="purple"
                        title="Cartas e Mapas"
                    />
                </nav>

                <div className="flex flex-col gap-4 relative">
                    <div className="relative">
                        <IconButton
                            icon={<IconSettings />}
                            onClick={() => setShowSettings(!showSettings)}
                            isActive={showSettings}
                            activeColor="purple"
                        />
                        {needRefresh && !showSettings && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                        )}
                    </div>

                    {isLoggedIn ? (
                        <IconButton
                            icon={<IconMinus />}
                            onClick={onSignOut}
                            title="Sair"
                        />
                    ) : (
                        <IconButton
                            icon={<IconUser />}
                            onClick={onLogin}
                            title="Entrar"
                            activeColor="teal"
                        />
                    )}

                    {showSettings && (
                        <SettingsPopover
                            userName={userName}
                            userEmail={userEmail}
                            isNightMode={isNightMode}
                            onToggleNightMode={onToggleNightMode}
                            airac={airac}
                            needRefresh={needRefresh}
                            lastUpdateDate={lastUpdateDate}
                            onUpdate={handleUpdate}
                            onCheckUpdate={checkForUpdate}
                            onForceRefresh={forceRefresh}
                            isCheckingUpdate={isChecking}
                            currentVersion={currentVersion}
                            locationPermission={permissionStatus}
                            onRequestLocation={requestPermission}
                            isRequestingLocation={isRequesting}
                            showIOSInstructions={showIOSInstructions}
                            onClose={() => setShowSettings(false)}
                        />
                    )}
                </div>
            </aside>

            {/* Desktop Main Menu Dropdown */}
            {showMainMenu && (
                <div className="hidden md:block absolute left-16 top-4 z-[2100] bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden animate-in">
                    <div className="p-3 flex flex-row gap-2">
                        <button 
                            onClick={handleOpenCharts}
                            title="Cartas"
                            className="w-14 h-12 rounded-xl transition-all shadow-lg hover:shadow-sky-500/25 active:scale-95 flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #0f4c75, #1a73a7)' }}
                        >
                            <Map className="w-7 h-7 text-white drop-shadow-md" strokeWidth={1.5} />
                        </button>
                        <button 
                            onClick={handleOpenAerodromes}
                            title="Aeródromos"
                            className="w-14 h-12 rounded-xl transition-all shadow-lg hover:shadow-sky-500/25 active:scale-95 flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #0f4c75, #1a73a7)' }}
                        >
                            <MapPin className="w-7 h-7 text-white drop-shadow-md" strokeWidth={1.5} />
                        </button>
                        <button 
                            onClick={handleOpenAircraft}
                            title="Aeronaves"
                            className="w-14 h-12 rounded-xl transition-all shadow-lg hover:shadow-sky-500/25 active:scale-95 flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #0f4c75, #1a73a7)' }}
                        >
                            <Plane className="w-7 h-7 text-white drop-shadow-md" strokeWidth={1.5} />
                        </button>
                        <button 
                            onClick={handleOpenDownload}
                            title="Download"
                            className="w-14 h-12 rounded-xl transition-all shadow-lg hover:shadow-sky-500/25 active:scale-95 flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #0f4c75, #1a73a7)' }}
                        >
                            <Download className="w-7 h-7 text-white drop-shadow-md" strokeWidth={1.5} />
                        </button>
                        <button 
                            onClick={handleToggleAltimeter}
                            title="Altímetro"
                            className={`w-14 h-12 rounded-xl transition-all shadow-lg hover:shadow-cyan-500/25 active:scale-95 flex items-center justify-center ${showAltimeter ? 'ring-2 ring-cyan-400' : ''}`}
                            style={{ background: showAltimeter ? 'linear-gradient(135deg, #0891b2, #06b6d4)' : 'linear-gradient(135deg, #0f4c75, #1a73a7)' }}
                        >
                            <Gauge className="w-7 h-7 text-white drop-shadow-md" strokeWidth={1.5} />
                        </button>
                    </div>
                </div>
            )}

            {/* Click outside to close main menu (Desktop) */}
            {showMainMenu && (
                <div 
                    className="hidden md:block fixed inset-0 z-[2050]" 
                    onClick={() => setShowMainMenu(false)} 
                />
            )}

            {/* Desktop Layers Menu - Positioned to the left of sidebar */}
            {showLayersMenu && (
                <div className="hidden md:block absolute left-20 top-1/2 -translate-y-1/2 w-[340px] z-[2000] bg-slate-900 border border-slate-800 rounded-3xl shadow-3xl overflow-hidden animate-in shadow-black/80">
                    <LayersMenu
                        onClose={() => setShowLayersMenu(false)}
                        activeLayers={activeLayers}
                        onToggleLayer={onToggleLayer}
                        downloadedLayers={downloadedLayers}
                        position="left"
                        activeBaseMap={activeBaseMap}
                        onBaseMapChange={onBaseMapChange}
                        pointVisibility={pointVisibility}
                        onTogglePointVisibility={onTogglePointVisibility}
                        mbtilesReady={mbtilesReady}
                        forceMBTiles={forceMBTiles}
                        onToggleForceMBTiles={onToggleForceMBTiles}
                    />
                </div>
            )}

            {/* Mobile Bottom Navigation Bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[2000] bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 safe-bottom">
                <div className="flex items-center justify-around py-2 px-4">
                    {/* Mobile Main Menu Button */}
                    <IconButton
                        icon={<IconMenu />}
                        onClick={() => setShowMainMenu(!showMainMenu)}
                        isActive={showMainMenu}
                        activeColor="teal"
                        title="Menu Principal"
                    />

                    <IconButton
                        icon={<IconRoute />}
                        onClick={onTogglePlanPanel}
                        isActive={showPlanPanel}
                        activeColor="teal"
                    />

                    <IconButton
                        icon={<IconLayers />}
                        onClick={() => setShowLayersMenu(!showLayersMenu)}
                        isActive={showLayersMenu}
                        activeColor="purple"
                        title="Cartas e Mapas"
                    />

                    <div className="relative">
                        <IconButton
                            icon={<IconSettings />}
                            onClick={() => setShowSettings(!showSettings)}
                            isActive={showSettings}
                            activeColor="purple"
                        />
                        {needRefresh && !showSettings && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                        )}
                    </div>

                    {isLoggedIn ? (
                        <IconButton
                            icon={<IconMinus />}
                            onClick={onSignOut}
                            title="Sair"
                        />
                    ) : (
                        <IconButton
                            icon={<IconUser />}
                            onClick={onLogin}
                            title="Entrar"
                            activeColor="teal"
                        />
                    )}
                </div>
            </nav>

            {/* Mobile Main Menu - Bottom Sheet */}
            {showMainMenu && (
                <div className="md:hidden fixed inset-0 z-[2100] bg-black/80 backdrop-blur-sm" onClick={() => setShowMainMenu(false)}>
                    <div 
                        className="absolute bottom-16 left-0 right-0 bg-slate-900 border-t border-slate-800 rounded-t-3xl animate-slide-up safe-bottom"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mt-3 mb-2" />
                        <div className="p-4">
                            <h3 className="text-white text-lg font-semibold mb-4 text-center">Menu Principal</h3>
                            <div className="flex flex-row justify-center gap-3">
                                <button 
                                    onClick={handleOpenCharts}
                                    title="Cartas"
                                    className="w-16 h-14 rounded-xl transition-all shadow-lg hover:shadow-sky-500/25 active:scale-95 flex flex-col items-center justify-center gap-1"
                                    style={{ background: 'linear-gradient(135deg, #0f4c75, #1a73a7)' }}
                                >
                                    <Map className="w-6 h-6 text-white drop-shadow-md" strokeWidth={1.5} />
                                    <span className="text-white text-xs">Cartas</span>
                                </button>
                                <button 
                                    onClick={handleOpenAerodromes}
                                    title="Aeródromos"
                                    className="w-16 h-14 rounded-xl transition-all shadow-lg hover:shadow-sky-500/25 active:scale-95 flex flex-col items-center justify-center gap-1"
                                    style={{ background: 'linear-gradient(135deg, #0f4c75, #1a73a7)' }}
                                >
                                    <MapPin className="w-6 h-6 text-white drop-shadow-md" strokeWidth={1.5} />
                                    <span className="text-white text-xs">Aeródromos</span>
                                </button>
                                <button 
                                    onClick={handleOpenAircraft}
                                    title="Aeronaves"
                                    className="w-16 h-14 rounded-xl transition-all shadow-lg hover:shadow-sky-500/25 active:scale-95 flex flex-col items-center justify-center gap-1"
                                    style={{ background: 'linear-gradient(135deg, #0f4c75, #1a73a7)' }}
                                >
                                    <Plane className="w-6 h-6 text-white drop-shadow-md" strokeWidth={1.5} />
                                    <span className="text-white text-xs">Aeronaves</span>
                                </button>
                                <button 
                                    onClick={handleOpenDownload}
                                    title="Download"
                                    className="w-16 h-14 rounded-xl transition-all shadow-lg hover:shadow-sky-500/25 active:scale-95 flex flex-col items-center justify-center gap-1"
                                    style={{ background: 'linear-gradient(135deg, #0f4c75, #1a73a7)' }}
                                >
                                    <Download className="w-6 h-6 text-white drop-shadow-md" strokeWidth={1.5} />
                                    <span className="text-white text-xs">Download</span>
                                </button>
                                <button 
                                    onClick={handleToggleAltimeter}
                                    title="Altímetro"
                                    className={`w-16 h-14 rounded-xl transition-all shadow-lg hover:shadow-cyan-500/25 active:scale-95 flex flex-col items-center justify-center gap-1 ${showAltimeter ? 'ring-2 ring-cyan-400' : ''}`}
                                    style={{ background: showAltimeter ? 'linear-gradient(135deg, #0891b2, #06b6d4)' : 'linear-gradient(135deg, #0f4c75, #1a73a7)' }}
                                >
                                    <Gauge className="w-6 h-6 text-white drop-shadow-md" strokeWidth={1.5} />
                                    <span className="text-white text-xs">Altímetro</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Layers Menu - Full Screen */}
            {showLayersMenu && (
                <div className="md:hidden fixed inset-0 z-[2100] bg-black/80 backdrop-blur-sm" onClick={() => setShowLayersMenu(false)}>
                    <div 
                        className="absolute bottom-16 left-0 right-0 max-h-[70vh] overflow-y-auto bg-slate-900 border-t border-slate-800 rounded-t-3xl animate-slide-up touch-scroll safe-bottom"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mt-3 mb-2" />
                        <LayersMenu
                            onClose={() => setShowLayersMenu(false)}
                            activeLayers={activeLayers}
                            onToggleLayer={onToggleLayer}
                            downloadedLayers={downloadedLayers}
                            position="left"
                            isMobile={true}
                            activeBaseMap={activeBaseMap}
                            onBaseMapChange={onBaseMapChange}
                            pointVisibility={pointVisibility}
                            onTogglePointVisibility={onTogglePointVisibility}
                            mbtilesReady={mbtilesReady}
                            forceMBTiles={forceMBTiles}
                            onToggleForceMBTiles={onToggleForceMBTiles}
                        />
                    </div>
                </div>
            )}

            {/* Mobile Settings Popover - Full Screen */}
            {showSettings && (
                <div className="md:hidden fixed inset-0 z-[2100] bg-black/80 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
                    <div 
                        className="absolute bottom-16 left-0 right-0 max-h-[70vh] overflow-y-auto bg-slate-900 border-t border-slate-800 rounded-t-3xl animate-slide-up touch-scroll safe-bottom"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mt-3 mb-2" />
                        <SettingsPopover
                            userName={userName}
                            userEmail={userEmail}
                            isNightMode={isNightMode}
                            onToggleNightMode={onToggleNightMode}
                            airac={airac}
                            isMobile={true}
                            needRefresh={needRefresh}
                            lastUpdateDate={lastUpdateDate}
                            onUpdate={handleUpdate}
                            onCheckUpdate={checkForUpdate}
                            onForceRefresh={forceRefresh}
                            isCheckingUpdate={isChecking}
                            currentVersion={currentVersion}
                            locationPermission={permissionStatus}
                            onRequestLocation={requestPermission}
                            isRequestingLocation={isRequesting}
                            showIOSInstructions={showIOSInstructions}
                            onClose={() => setShowSettings(false)}
                        />
                    </div>
                </div>
            )}
        </>
    );
};
