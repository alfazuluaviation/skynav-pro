import React, { useState, useEffect, useRef } from 'react';
import { searchNavigationPoints } from '../services/NavigationDataService';
import { NavPoint } from '../../types';
import { IconSearch, IconPlane, IconLocation } from './Icons';

interface AutocompleteInputProps {
    placeholder: string;
    onSelect: (point: NavPoint) => void;
    value?: string;
    icon?: React.ReactNode;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({ placeholder, onSelect, value = '', icon }) => {
    const [query, setQuery] = useState(value);
    const [results, setResults] = useState<NavPoint[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Track online/offline status
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Sync local state with prop value
    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    // Debounce search
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (query.length >= 2 && isOpen) {
                setIsLoading(true);
                try {
                    console.log(`[AutocompleteInput] Searching for: ${query} (${isOffline ? 'OFFLINE' : 'ONLINE'})`);
                    const points = await searchNavigationPoints(query);
                    setResults(points);
                } catch (error) {
                    console.error("Error searching navigation points in AutocompleteInput:", error);
                    setResults([]);
                } finally {
                    setIsLoading(false);
                }
            } else if (query.length < 2) {
                setResults([]);
            }
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [query, isOpen, isOffline]);

    // Handle outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (point: NavPoint) => {
        console.log(`[AutocompleteInput] Selected point:`, point);
        setQuery(point.icao || point.name);
        setIsOpen(false);
        onSelect(point);
    };

    // Get icon and color for point type
    const getPointStyle = (point: NavPoint) => {
        const isUserFix = point.kind === 'user';
        const isHeliport = point.kind === 'heliport';
        
        if (isUserFix) {
            return { bg: 'bg-purple-500/10', text: 'text-purple-400' };
        }
        if (isHeliport) {
            return { bg: 'bg-emerald-500/10', text: 'text-emerald-400' };
        }
        if (point.type === 'airport') {
            return { bg: 'bg-blue-500/10', text: 'text-blue-400' };
        }
        if (point.type === 'vor') {
            return { bg: 'bg-orange-500/10', text: 'text-orange-400' };
        }
        if (point.type === 'ndb') {
            return { bg: 'bg-amber-500/10', text: 'text-amber-400' };
        }
        return { bg: 'bg-yellow-500/10', text: 'text-yellow-400' };
    };

    // Get label for point type
    const getPointLabel = (point: NavPoint) => {
        if (point.kind === 'user') return 'Fixo Usuário';
        if (point.kind === 'heliport') return 'Heliponto';
        if (point.type === 'airport') return 'Aeródromo';
        if (point.type === 'vor') return 'VOR';
        if (point.type === 'ndb') return 'NDB';
        return 'Waypoint';
    };

    return (
        <div ref={wrapperRef} className="relative group w-full">
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => {
                        console.log(`[AutocompleteInput] Focus on input, query: "${query}"`);
                        setIsOpen(true);
                    }}
                    onClick={() => {
                        console.log(`[AutocompleteInput] Click on input, query: "${query}"`);
                        setIsOpen(true);
                    }}
                    placeholder={placeholder}
                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all uppercase font-bold tracking-wider"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {icon || <IconSearch />}
                </div>
                
                {/* Status indicator */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isLoading && (
                        <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    )}
                    {isOffline && !isLoading && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 rounded text-[9px] font-bold text-amber-400">
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
                            </svg>
                            OFFLINE
                        </div>
                    )}
                </div>
            </div>

            {isOpen && results.length > 0 && (
                <div
                    className="absolute top-full left-0 right-0 mt-2 bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[9999] max-h-[300px] overflow-y-auto pointer-events-auto"
                    style={{ minWidth: '100%' }}
                >
                    {results.map((point) => {
                        const style = getPointStyle(point);
                        const label = getPointLabel(point);
                        
                        return (
                            <button
                                key={`${point.type}-${point.id}`}
                                onClick={() => handleSelect(point)}
                                className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-3 border-b border-slate-700/50 last:border-0"
                            >
                                <div className={`p-2 rounded-lg ${style.bg} ${style.text}`}>
                                    {point.type === 'airport' ? <IconPlane /> : <IconLocation />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-black text-slate-100">{point.icao || point.name}</div>
                                    <div className="text-xs text-slate-400 truncate">{point.name}</div>
                                </div>
                                <div className={`text-[9px] font-bold px-2 py-0.5 rounded ${style.bg} ${style.text}`}>
                                    {label}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* No results message */}
            {isOpen && query.length >= 2 && !isLoading && results.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl p-4 z-[9999]">
                    <div className="text-center text-slate-400 text-sm">
                        {isOffline ? (
                            <div className="flex flex-col items-center gap-2">
                                <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <span>Sem resultados no cache offline</span>
                                <span className="text-xs text-slate-500">
                                    Sincronize os dados de navegação em Downloads
                                </span>
                            </div>
                        ) : (
                            <span>Nenhum resultado encontrado para "{query}"</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
