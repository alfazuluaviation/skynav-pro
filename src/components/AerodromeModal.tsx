import React, { useState } from 'react';
import { X, Search, Plane, Loader2, MapPin, Radio, Compass, Fuel, AlertTriangle, ExternalLink, Navigation, Wind, Phone, Ruler, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface RotaerData {
  icao: string;
  name: string;
  city: string;
  state: string;
  ciad: string;
  coordinates: string;
  elevation: string;
  type: string;
  operator: string;
  distanceFromCity: string;
  utc: string;
  operations: string;
  lighting: string[];
  fir: string;
  jurisdiction: string;
  runways: RunwayInfo[];
  communications: CommunicationInfo[];
  radioNav: string[];
  fuel: string;
  services: string;
  firefighting: string;
  meteorology: string[];
  ais: string[];
  remarks: RemarkSection[];
  declaredDistances: DeclaredDistance[];
  complements: string[];
  aiswebUrl: string;
}

interface RunwayInfo {
  designation: string;
  dimensions: string;
  surface: string;
  strength: string;
  lighting: string[];
}

interface CommunicationInfo {
  name: string;
  frequencies: string[];
}

interface RemarkSection {
  title: string;
  items: string[];
}

interface DeclaredDistance {
  runway: string;
  tora: string;
  toda: string;
  asda: string;
  lda: string;
  geoidal: string;
  coordinates: string;
}

interface AerodromeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCharts?: (icao: string) => void;
}

export const AerodromeModal: React.FC<AerodromeModalProps> = ({ isOpen, onClose, onOpenCharts }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rotaerData, setRotaerData] = useState<RotaerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'ROTAER' | 'NOTAM' | 'SUPLEMENTOS' | 'CARTAS' | 'METAR' | 'ROTAS'>('ROTAER');

  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 4) {
      setError('Digite um código ICAO válido (4 caracteres)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRotaerData(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-rotaer', {
        body: { icaoCode: searchQuery.toUpperCase() }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.success) {
        setRotaerData(data.data);
      } else {
        setError(data.error || 'Erro ao buscar dados do aeródromo');
      }
    } catch (err) {
      console.error('Error fetching ROTAER:', err);
      setError('Erro ao buscar dados. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'ROTAER', label: 'ROTAER' },
    { id: 'NOTAM', label: 'NOTAM' },
    { id: 'SUPLEMENTOS', label: 'Suplementos AIP' },
    { id: 'CARTAS', label: 'Cartas' },
    { id: 'METAR', label: 'Metar/TAF' },
    { id: 'ROTAS', label: 'Rotas Preferenciais' },
  ] as const;

  return (
    <div className="fixed inset-0 z-[3000] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full md:max-w-5xl max-h-[90vh] md:max-h-[95vh] bg-slate-900/95 backdrop-blur-xl border-t md:border border-slate-700/50 rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden md:mx-4 flex flex-col animate-slide-up md:animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Informações de Aeródromo</h2>
              <p className="text-xs text-slate-400">Dados oficiais do ROTAER - DECEA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Search Section */}
        <div className="p-4 border-b border-slate-700/50 bg-slate-900/40">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder="DIGITE O CÓDIGO ICAO (EX: SBGR)"
                maxLength={4}
                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/25 uppercase font-mono tracking-wider"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isLoading || searchQuery.length < 4}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-orange-950/20"
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
            <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {error}
            </p>
          )}
        </div>

        {/* Dynamic Tab Menu - AISWEB Style */}
        <div className="px-4 border-b border-slate-700/20 bg-slate-900/20">
          <div className="flex items-center overflow-x-auto no-scrollbar py-1">
            <div className="flex border border-sky-500/40 rounded-md overflow-hidden bg-slate-800/20 shadow-inner">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'CARTAS' && rotaerData && onOpenCharts) {
                      onOpenCharts(rotaerData.icao);
                      onClose();
                    }
                  }}
                  className={`px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap border-r border-sky-500/40 last:border-r-0 ${activeTab === tab.id
                    ? 'bg-sky-500/20 text-white'
                    : 'text-sky-400 hover:bg-sky-500/5 hover:text-sky-300'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-900/30">
          {!rotaerData && !isLoading && !error && (
            <div className="h-full flex flex-col items-center justify-center py-12 opacity-50">
              <div className="w-20 h-20 mb-4 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700/50">
                <Search className="w-10 h-10 text-slate-600" />
              </div>
              <p className="text-slate-400 font-medium">Digite um código ICAO para buscar informações</p>
              <p className="text-xs text-slate-500 mt-2 font-mono">EXEMPLO: SBGR, SBBR, SBSP, SBGL</p>
            </div>
          )}

          {rotaerData && activeTab === 'ROTAER' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Official ROTAER Header Block (Exact Mirror of AISWEB) */}
              <div className="bg-[#fcfdff] dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm p-8 text-slate-900 dark:text-slate-100 font-sans">
                {/* AISWEB Styles: Top Header Rows */}
                <div className="space-y-1 font-sans">
                  {/* helper to bold runway thresholds like **17** - ... - **35** */}
                  {(() => {
                    const headerLines = rotaerData.rawHeader ? rotaerData.rawHeader.split('\n').filter(l => l.trim()) : [];

                    const formatRunwayLine = (line: string) => {
                      // Regex to find 2-digit numbers specifically at thresholds: 
                      // 1. Start of line (^\d{2})
                      // 2. Before hyphen and maybe spaces (\d{2}\s*-)
                      // 3. After hyphen and maybe spaces (-\s*\d{2})
                      // 4. End of line (\d{2}$)
                      const parts = line.split(/(\d{2})(?=\s*-)|(?<=-\s*)(\d{2})|(^\d{2})|(\d{2}$)/g);
                      return parts.map((part, i) => {
                        if (!part) return null;
                        const isThreshold = /^\d{2}$/.test(part);
                        if (isThreshold) {
                          return <strong key={i} className="font-black text-slate-950 dark:text-white">{part}</strong>;
                        }
                        return part;
                      });
                    };

                    const rawElev = rotaerData.elevation || '0';
                    const elevValue = parseInt(rawElev.replace(/[^0-9]/g, '')) || 0;
                    const elevFt = (elevValue * 3.28084).toFixed(0);

                    return (
                      <>
                        {/* Row 1: Name and Coords */}
                        <div className="flex justify-between items-start gap-4 mb-0.5">
                          <h2 className="text-[17px] font-bold uppercase shrink-1 tracking-tight leading-none pt-1">
                            {rotaerData.name} ({rotaerData.icao}) / <span className="text-slate-500 font-medium">{rotaerData.city}, {rotaerData.state}</span>
                          </h2>
                          <span className="font-sans text-[15px] font-medium shrink-0 leading-none">{rotaerData.coordinates}</span>
                        </div>

                        {/* Rows 2+ */}
                        <div className="relative space-y-1">
                          {/* Row 2: Type/AD line + Elevation */}
                          <div className="flex justify-between items-baseline gap-4 h-5">
                            <p className="text-[13px] uppercase font-medium opacity-90 max-w-3xl truncate">
                              {headerLines[0] || rotaerData.type || 'INFORMAÇÕES DE AERÓDROMO'}
                            </p>
                            <span className="font-sans text-[15px] font-medium shrink-0">
                              {elevValue} <span className="font-black text-slate-950 dark:text-white">({elevFt})</span>
                            </span>
                          </div>

                          {/* Row 3: UTC/Ops line + CINDACTA/FIR */}
                          <div className="flex justify-between items-baseline gap-4 h-5">
                            <p className="text-[13px] uppercase font-medium opacity-90">
                              {headerLines[1] || 'VFR IFR'}
                            </p>
                            <span className="font-sans text-[15px] font-medium shrink-0 text-slate-600 uppercase">
                              {rotaerData.fir}
                            </span>
                          </div>

                          {/* Row 4+: Runway thresholds (Bolded) */}
                          {headerLines.slice(2).map((line, idx) => (
                            <div key={idx} className="flex justify-between items-baseline gap-4 mt-0.5">
                              <p className="text-[13px] uppercase font-medium leading-relaxed">
                                {formatRunwayLine(line)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Granular Information Blocks (Mirroring AISWEB Screenshots) */}
                <div className="space-y-4 mt-8 border-t border-slate-200 dark:border-slate-800/50 pt-6">
                  {rotaerData.complements && rotaerData.complements.map((block, idx) => {
                    const separatorIndex = block.indexOf(' - ');
                    const label = separatorIndex !== -1 ? block.substring(0, separatorIndex) : block;
                    const content = separatorIndex !== -1 ? block.substring(separatorIndex + 3) : '';

                    if (!content) return null;

                    // AISWEB Layout: Label is bold and starts the line
                    return (
                      <div key={idx} className="text-[13px] md:text-sm font-sans leading-relaxed tracking-tight uppercase">
                        <span className="font-black text-slate-900 dark:text-white mr-2">{label} -</span>
                        <span className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {content}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Runways (Briefly as cards for extra UI polish) */}
              {rotaerData.runways && rotaerData.runways.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rotaerData.runways.map((rw, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800/20 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 flex justify-between items-center shadow-sm">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Pista</span>
                        <span className="text-lg font-black dark:text-white font-mono">{rw.designation}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">{rw.dimensions}</span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{rw.surface} • {rw.strength || 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {rotaerData && activeTab === 'NOTAM' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-[#fcfdff] dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm p-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 uppercase flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  NOTAM de Aeródromo ({rotaerData.icao})
                </h3>

                <div className="space-y-6">
                  {rotaerData.notams && rotaerData.notams.length > 0 ? (
                    rotaerData.notams.map((notam, idx) => (
                      <div key={idx} className="p-4 bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-lg">
                        <p className="text-sm font-mono text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap uppercase">
                          {notam}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-slate-500 uppercase font-bold text-sm">Nenhum NOTAM ativo no momento para este aeródromo.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {rotaerData && activeTab !== 'ROTAER' && (
            <div className="h-full flex flex-col items-center justify-center py-20 text-center opacity-40 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-24 h-24 mb-6 rounded-full bg-slate-800/50 flex items-center justify-center border border-slate-700/30">
                <FileText className="w-12 h-12 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Seção {activeTab}</h3>
              <p className="text-slate-400 max-w-sm px-6">
                As informações desta categoria estarão disponíveis na próxima atualização do sistema de dados integrados.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50 bg-slate-900 flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Dados Oficiais DECEA / AISWEB <span className="mx-2 text-slate-700">|</span> Atualizado: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};
