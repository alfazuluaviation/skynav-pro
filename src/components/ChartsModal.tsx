import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Search, FileText, ExternalLink, Plane, Loader2, MapPin, ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ChartInfo {
  id: string;
  tipo: string;
  tipo_descr: string;
  nome: string;
  link: string;
  dt: string;
}

interface ChartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIcao?: string | null;
}

const chartTypeIcons: Record<string, string> = {
  'ADC': '🛬',
  'SID': '🛫',
  'STAR': '✈️',
  'IAC': '📍',
  'VAC': '👁️',
  'GMC': '🗺️',
  'PDC': '📐',
  'ARC': '🌐',
  'PATC': '⛰️',
  'OTR': '🏔️',
};

const chartTypeColors: Record<string, string> = {
  'ADC': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'SID': 'bg-green-500/20 text-green-400 border-green-500/30',
  'STAR': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'IAC': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'VAC': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'GMC': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'PDC': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'ARC': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  'PATC': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'OTR': 'bg-red-500/20 text-red-400 border-red-500/30',
};

export const ChartsModal: React.FC<ChartsModalProps> = ({ isOpen, onClose, initialIcao }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [charts, setCharts] = useState<ChartInfo[]>([]);
  const [selectedIcao, setSelectedIcao] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiswebUrl, setAiswebUrl] = useState<string | null>(null);
  const [viewingChart, setViewingChart] = useState<ChartInfo | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  
  // Resizable state
  const [viewerHeight, setViewerHeight] = useState(80); // percentage of viewport height
  const [viewerTop, setViewerTop] = useState(5); // percentage from top - start higher
  const [isResizingTop, setIsResizingTop] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);
  
  
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  // Reset size when closing viewer
  useEffect(() => {
    if (!viewingChart) {
      setViewerHeight(80);
      setViewerTop(5);
    }
  }, [viewingChart]);

  // Auto-search if initialIcao is provided
  useEffect(() => {
    if (isOpen && initialIcao) {
      setSearchQuery(initialIcao.toUpperCase());
      handleSearchInternal(initialIcao.toUpperCase());
    } else if (!isOpen) {
      // Clear state when closing
      setSearchQuery('');
      setCharts([]);
      setSelectedIcao(null);
      setError(null);
      setAiswebUrl(null);
      setViewingChart(null);
      setIsMaximized(false);
      setZoom(1);
      setPanPosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialIcao]);

  const handleSearchInternal = async (icao: string) => {
    if (!icao || icao.length < 3) {
      setError('Digite um código ICAO válido');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCharts([]);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-charts', {
        body: { icaoCode: icao.toUpperCase() }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.success) {
        setCharts(data.charts || []);
        setSelectedIcao(data.icao);
        setAiswebUrl(data.aisweb_url);
      } else {
        setError(data.error || 'Erro ao buscar cartas');
      }
    } catch (err) {
      console.error('Error fetching charts:', err);
      setError('Erro ao buscar cartas. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => handleSearchInternal(searchQuery);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const openChart = (chart: ChartInfo) => {
    setViewingChart(chart);
  };

  const closeViewer = () => {
    setViewingChart(null);
  };

  // Resize handlers
  const handleResizeStart = useCallback((edge: 'top' | 'bottom') => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (edge === 'top') {
      setIsResizingTop(true);
    } else {
      setIsResizingBottom(true);
    }
  }, []);

  useEffect(() => {
    if (!isResizingTop && !isResizingBottom) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
      if (clientY === undefined) return;
      
      const viewportHeight = window.innerHeight;
      const percentY = (clientY / viewportHeight) * 100;
      const minHeight = 30;
      const minTop = 2;
      const maxBottom = 98;

      if (isResizingTop) {
        const currentBottom = viewerTop + viewerHeight;
        const newTop = Math.max(minTop, Math.min(percentY, currentBottom - minHeight));
        const newHeight = currentBottom - newTop;
        
        if (newHeight >= minHeight && newTop >= minTop) {
          setViewerTop(newTop);
          setViewerHeight(newHeight);
        }
      } else if (isResizingBottom) {
        const newBottom = Math.max(viewerTop + minHeight, Math.min(percentY, maxBottom));
        const newHeight = newBottom - viewerTop;
        
        if (newHeight >= minHeight) {
          setViewerHeight(newHeight);
        }
      }
    };

    const handleEnd = () => {
      setIsResizingTop(false);
      setIsResizingBottom(false);
    };

    // Use capture phase to ensure we get the events
    window.addEventListener('mousemove', handleMove, { passive: false, capture: true });
    window.addEventListener('mouseup', handleEnd, { capture: true });
    window.addEventListener('touchmove', handleMove, { passive: false, capture: true });
    window.addEventListener('touchend', handleEnd, { capture: true });
    window.addEventListener('touchcancel', handleEnd, { capture: true });
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';

    return () => {
      window.removeEventListener('mousemove', handleMove, { capture: true });
      window.removeEventListener('mouseup', handleEnd, { capture: true });
      window.removeEventListener('touchmove', handleMove, { capture: true });
      window.removeEventListener('touchend', handleEnd, { capture: true });
      window.removeEventListener('touchcancel', handleEnd, { capture: true });
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingTop, isResizingBottom, viewerTop, viewerHeight]);

  const groupedCharts = charts.reduce((acc, chart) => {
    if (!acc[chart.tipo]) {
      acc[chart.tipo] = [];
    }
    acc[chart.tipo].push(chart);
    return acc;
  }, {} as Record<string, ChartInfo[]>);

  if (!isOpen) return null;

  // Calculate modal style for viewer mode - use fixed positioning
  const modalStyle = viewingChart && !isMaximized ? {
    position: 'fixed' as const,
    top: `${viewerTop}vh`,
    left: '50%',
    transform: 'translateX(-50%)',
    height: `${viewerHeight}vh`,
    maxHeight: 'none',
  } : {};

  return (
    <div className="fixed inset-0 z-[3000]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className={`${viewingChart && !isMaximized ? '' : 'absolute bottom-0 md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2'} w-full ${isMaximized ? 'md:max-w-[98vw] h-[98vh] md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 absolute' : viewingChart ? 'md:max-w-4xl' : 'md:max-w-2xl max-h-[90vh] md:max-h-[80vh]'} bg-slate-900/95 backdrop-blur-xl border-t md:border border-slate-700/50 rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden md:mx-auto flex flex-col animate-slide-up md:animate-in`}
        style={viewingChart && !isMaximized ? modalStyle : {}}
      >
        {/* Top resize handle - only in viewer mode */}
        {viewingChart && !isMaximized && (
          <div
            className="absolute top-0 left-0 right-0 h-4 cursor-ns-resize z-20 flex items-center justify-center group touch-none"
            onMouseDown={handleResizeStart('top')}
            onTouchStart={handleResizeStart('top')}
          >
            <div className="w-16 h-1.5 bg-slate-500 rounded-full group-hover:bg-sky-400 group-active:bg-sky-400 transition-colors" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            {viewingChart ? (
              <button
                onClick={closeViewer}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium hidden sm:inline">Voltar para a lista</span>
              </button>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Cartas Aeronáuticas</h2>
                  <p className="text-xs text-slate-400">Fonte: DECEA/AISWEB</p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {viewingChart && (
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title={isMaximized ? "Restaurar" : "Maximizar"}
              >
                {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {viewingChart ? (
          /* PDF Viewer Mode - using flex-1 with absolute iframe to fill entire container */
          <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
            {/* Chart info bar */}
            <div className="p-2 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 ml-2 min-w-0">
                <span className="text-lg flex-shrink-0">{chartTypeIcons[viewingChart.tipo] || '📄'}</span>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-white truncate">{viewingChart.nome}</h3>
                  <p className="text-[10px] text-slate-400">{viewingChart.tipo_descr}</p>
                </div>
              </div>
              <a
                href={viewingChart.link}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-sky-400 transition-colors flex-shrink-0"
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            
            {/* Chart viewer - iframe fills remaining space */}
            <div 
              ref={viewerContainerRef}
              className="flex-1 relative"
              style={{ minHeight: 0 }}
            >
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(viewingChart.link)}&embedded=true`}
                className="absolute inset-0 w-full h-full border-none bg-white"
                title={viewingChart.nome}
                allow="autoplay"
              />
            </div>
            
            {/* Bottom resize handle - only in viewer mode */}
            {!isMaximized && (
              <div
                className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize z-20 flex items-center justify-center group touch-none bg-gradient-to-t from-slate-900/80 to-transparent"
                onMouseDown={handleResizeStart('bottom')}
                onTouchStart={handleResizeStart('bottom')}
              >
                <div className="w-16 h-1.5 bg-slate-500 rounded-full group-hover:bg-sky-400 group-active:bg-sky-400 transition-colors" />
              </div>
            )}
          </div>
        ) : (
          /* List Mode */
          <>
            {/* Search Section */}
            <div className="p-4 border-b border-slate-700/50 flex-shrink-0">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                    onKeyPress={handleKeyPress}
                    placeholder="Digite o código ICAO (ex: SBGR)"
                    maxLength={4}
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/25 uppercase font-mono tracking-wider"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isLoading || searchQuery.length < 4}
                  className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Buscar
                </button>
              </div>

              {error && (
                <p className="mt-2 text-sm text-red-400">{error}</p>
              )}
            </div>

            {/* Results Section */}
            <div className="p-4 overflow-y-auto flex-1">
              {selectedIcao && charts.length > 0 && (
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plane className="w-4 h-4 text-sky-400" />
                    <span className="text-sm text-slate-300">
                      Cartas disponíveis para <span className="font-mono font-bold text-sky-400">{selectedIcao}</span>
                    </span>
                  </div>
                  {aiswebUrl && (
                    <a
                      href={aiswebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-400 hover:text-sky-400 flex items-center gap-1 transition-colors"
                    >
                      Ver no AISWEB <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {charts.length === 0 && !isLoading && !error && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                    <Search className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="text-slate-400">Digite um código ICAO para buscar as cartas disponíveis</p>
                  <p className="text-xs text-slate-500 mt-2">Exemplo: SBGR, SBBR, SBSP, SBGL</p>
                </div>
              )}

              {Object.entries(groupedCharts).map(([tipo, chartList]) => {
                const list = chartList as ChartInfo[];
                return (
                  <div key={tipo} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{chartTypeIcons[tipo] || '📄'}</span>
                      <h3 className="text-sm font-medium text-slate-300">
                        {list[0]?.tipo_descr || tipo}
                      </h3>
                      <span className="text-xs text-slate-500">({list.length})</span>
                    </div>
                    <div className="space-y-2">
                      {list.map((chart) => (
                        <button
                          key={chart.id}
                          onClick={() => openChart(chart)}
                          className={`w-full p-3 rounded-xl border ${chartTypeColors[tipo] || 'bg-slate-800/50 text-slate-300 border-slate-700/50'} hover:scale-[1.01] transition-all flex items-center justify-between group`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`px-2 py-1 rounded-lg text-xs font-mono font-bold ${chartTypeColors[tipo] || 'bg-slate-700 text-slate-400'}`}>
                              {chart.tipo}
                            </div>
                            <span className="text-sm font-medium truncate max-w-[300px]">
                              {chart.nome}
                            </span>
                          </div>
                          <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
              <p className="text-xs text-slate-500 text-center">
                As cartas são fornecidas oficialmente pelo DECEA através do AISWEB. Verifique sempre a validade antes do voo.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};