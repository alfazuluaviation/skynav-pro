
import React from 'react';
import { FlightStats } from '../types';

interface StatusBarProps {
    stats: FlightStats;
}

export const StatusBar: React.FC<StatusBarProps> = ({ stats }) => {
    const items = [
        { label: 'ALT', fullLabel: 'ALTITUDE (FT)', val: stats.altitude, color: 'text-purple-400' },
        { label: 'GS', fullLabel: 'GS (KT)', val: stats.groundSpeed, color: 'text-sky-400' },
        { label: 'ETE', fullLabel: 'ETE PRÓXIMO', val: stats.ete || '--:--', color: 'text-white' },
    ];

    return (
        <>
            {/* Desktop Version */}
            <div className="hidden md:flex absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] gap-4 pointer-events-none w-full max-w-4xl px-8">
                {items.map((s, i) => (
                    <div
                        key={i}
                        className="flex-1 bg-slate-900/90 backdrop-blur-2xl border border-slate-700/50 px-6 py-5 rounded-[2.5rem] shadow-3xl flex flex-col items-center pointer-events-auto hover:bg-slate-800 transition-colors"
                    >
                        <span className="text-[9px] uppercase font-black text-slate-500 tracking-[0.25em] mb-2">
                            {s.fullLabel}
                        </span>
                        <span className={`text-4xl font-mono font-black ${s.color}`}>{s.val}</span>
                    </div>
                ))}
            </div>

            {/* Mobile Version - Compact bar at top */}
            <div className="md:hidden absolute top-4 right-4 z-[1000] pointer-events-none safe-top safe-right">
                <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 px-3 py-2 rounded-xl shadow-xl flex gap-3 pointer-events-auto">
                    {items.map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                            <span className="text-[8px] uppercase font-black text-slate-500">
                                {s.label}
                            </span>
                            <span className={`text-sm font-mono font-black ${s.color}`}>{s.val}</span>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};
