
import React, { useState } from 'react';
import {
    IconMenu, IconPlane, IconMap, IconRoute,
    IconStar, IconFile, IconStore, IconSettings, IconMinus
} from './Icons';
import { IconButton } from './IconButton';
import { SettingsPopover } from './SettingsPopover';
import { AiracCycle } from '../../types';

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
}) => {
    const [showSettings, setShowSettings] = useState(false);

    return (
        <aside className="w-14 flex flex-col items-center py-6 bg-slate-900 border-r border-slate-800 z-[2000] shadow-2xl shrink-0">
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
            </nav>

            <div className="flex flex-col gap-4 relative">
                <IconButton
                    icon={<IconSettings />}
                    onClick={() => setShowSettings(!showSettings)}
                    isActive={showSettings}
                    activeColor="purple"
                />

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
                    />
                )}
            </div>
        </aside>
    );
};
