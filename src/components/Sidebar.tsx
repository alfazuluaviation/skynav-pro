
import React, { useState } from 'react';
import {
    IconMenu, IconPlane, IconMap, IconRoute,
    IconStar, IconFile, IconStore, IconSettings, IconMinus, IconLayers
} from './Icons';
import { IconButton } from './IconButton';
import { SettingsPopover } from './SettingsPopover';
import { LayersMenu, BaseMapType } from './LayersMenu';
import { AiracCycle } from '../../types';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { useLocationPermission } from '@/hooks/useLocationPermission';

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
    syncingLayers: Record<string, number>;
    airac: AiracCycle | null;
    activeBaseMap: BaseMapType;
    onBaseMapChange: (baseMap: BaseMapType) => void;
    onMenuStateChange?: (isMenuOpen: boolean) => void;
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
    syncingLayers,
    airac,
    activeBaseMap,
    onBaseMapChange,
    onMenuStateChange,
}) => {
    const [showSettings, setShowSettings] = useState(false);
    const [showLayersMenu, setShowLayersMenu] = useState(false);
    const { needRefresh, lastUpdateDate, handleUpdate, checkForUpdate, isChecking } = usePWAUpdate();
    const { permissionStatus, isRequesting, requestPermission, showIOSInstructions } = useLocationPermission();

    // Notify parent when menus are open (mobile only)
    React.useEffect(() => {
        if (onMenuStateChange) {
            onMenuStateChange(showSettings || showLayersMenu);
        }
    }, [showSettings, showLayersMenu, onMenuStateChange]);

    return (
        <>
            {/* Desktop Sidebar - Hidden on mobile */}
            <aside className="hidden md:flex w-14 flex-col items-center py-6 bg-slate-900 border-r border-slate-800 z-[2000] shadow-2xl shrink-0">
                <div className="mb-8 text-slate-500 hover:text-white cursor-pointer transition-colors">
                    <IconMenu />
                </div>

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

                    <IconButton
                        icon={<IconMinus />}
                        onClick={onSignOut}
                        title="Sair"
                    />

                    {showSettings && (
                        <SettingsPopover
                            userName={userName}
                            userEmail={userEmail}
                            isNightMode={isNightMode}
                            onToggleNightMode={onToggleNightMode}
                            activeLayers={activeLayers}
                            onToggleLayer={onToggleLayer}
                            downloadedLayers={downloadedLayers}
                            onDownloadLayer={onDownloadLayer}
                            syncingLayers={syncingLayers}
                            airac={airac}
                            needRefresh={needRefresh}
                            lastUpdateDate={lastUpdateDate}
                            onUpdate={handleUpdate}
                            onCheckUpdate={checkForUpdate}
                            isCheckingUpdate={isChecking}
                            locationPermission={permissionStatus}
                            onRequestLocation={requestPermission}
                            isRequestingLocation={isRequesting}
                            showIOSInstructions={showIOSInstructions}
                            onClose={() => setShowSettings(false)}
                        />
                    )}
                </div>
            </aside>

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
                    />
                </div>
            )}

            {/* Mobile Bottom Navigation Bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[2000] bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 safe-bottom">
                <div className="flex items-center justify-around py-2 px-4">
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

                    <IconButton
                        icon={<IconMinus />}
                        onClick={onSignOut}
                        title="Sair"
                    />
                </div>
            </nav>

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
                            activeLayers={activeLayers}
                            onToggleLayer={onToggleLayer}
                            downloadedLayers={downloadedLayers}
                            onDownloadLayer={onDownloadLayer}
                            syncingLayers={syncingLayers}
                            airac={airac}
                            isMobile={true}
                            needRefresh={needRefresh}
                            lastUpdateDate={lastUpdateDate}
                            onUpdate={handleUpdate}
                            onCheckUpdate={checkForUpdate}
                            isCheckingUpdate={isChecking}
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
