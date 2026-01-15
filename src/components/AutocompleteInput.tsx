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
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Sync local state with prop value
    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    // Debounce search
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            // Only search if query is long enough and dropdown is open
            // Removing the query !== value check to allow re-searching or searching same prefix
            if (query.length >= 2 && isOpen) {
                setIsLoading(true);
                try {
                    console.log(`[AutocompleteInput] Searching for: ${query}`);
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
    }, [query, isOpen]);

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
                {isLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            {isOpen && results.length > 0 && (
                <div
                    className="absolute top-full left-0 right-0 mt-2 bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[9999] max-h-[300px] overflow-y-auto pointer-events-auto"
                    style={{ minWidth: '100%' }}
                >
                    {results.map((point) => (
                        <button
                            key={`${point.type}-${point.id}`}
                            onClick={() => handleSelect(point)}
                            className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-3 border-b border-slate-700/50 last:border-0"
                        >
                            <div className={`p-2 rounded-lg ${point.type === 'airport' ? 'bg-blue-500/10 text-blue-400' :
                                point.type === 'vor' ? 'bg-orange-500/10 text-orange-400' : 'bg-yellow-500/10 text-yellow-400'
                                }`}>
                                {point.type === 'airport' ? <IconPlane /> : <IconLocation />}
                            </div>
                            <div>
                                <div className="font-black text-slate-100">{point.icao}</div>
                                <div className="text-xs text-slate-400 truncate max-w-[200px]">{point.name}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
