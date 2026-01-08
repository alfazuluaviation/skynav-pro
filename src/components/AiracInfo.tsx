
import React from 'react';
import { AiracCycle } from '../types';

interface AiracInfoProps {
    airac: AiracCycle | null;
}

export const AiracInfo: React.FC<AiracInfoProps> = ({ airac }) => {
    return (
        <div className="absolute top-6 left-6 z-[1000] pointer-events-none">
            <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 px-6 py-3 rounded-2xl flex items-center gap-8 shadow-2xl">
                <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">
                        AIRAC VIGENTE
                    </span>
                    <span className="text-sm font-mono font-bold text-emerald-400">
                        {airac?.current || '2513'}
                    </span>
                </div>
                <div className="h-10 w-px bg-slate-800"></div>
                <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">
                        PRÓXIMO CICLO
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-300">
                        {airac?.nextCycleDate || '2026-01-22'}
                    </span>
                </div>
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]"></div>
            </div>
        </div>
    );
};
