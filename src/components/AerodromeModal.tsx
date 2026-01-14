import React, { useState } from 'react';
import { X, Search, Plane, Loader2, MapPin, Radio, Compass, Fuel, AlertTriangle, ExternalLink, Navigation, Wind, Phone, Ruler } from 'lucide-react';
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
}

export const AerodromeModal: React.FC<AerodromeModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rotaerData, setRotaerData] = useState<RotaerData | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden mx-4">
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
        <div className="p-4 border-b border-slate-700/50">
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
                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/25 uppercase font-mono tracking-wider"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isLoading || searchQuery.length < 4}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center gap-2"
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
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {!rotaerData && !isLoading && !error && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                <Search className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-slate-400">Digite um código ICAO para buscar informações do aeródromo</p>
              <p className="text-xs text-slate-500 mt-2">Exemplo: SBGR, SBBR, SBSP, SBGL</p>
            </div>
          )}

          {rotaerData && (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl font-bold text-amber-400 font-mono">{rotaerData.icao}</span>
                      {rotaerData.ciad && (
                        <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded">CIAD: {rotaerData.ciad}</span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-white">{rotaerData.name}</h3>
                    {(rotaerData.city || rotaerData.state) && (
                      <p className="text-sm text-slate-400">{rotaerData.city}{rotaerData.state ? `, ${rotaerData.state}` : ''}</p>
                    )}
                  </div>
                  {rotaerData.aiswebUrl && (
                    <a
                      href={rotaerData.aiswebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
                    >
                      Ver no AISWEB <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {rotaerData.coordinates && (
                    <div className="bg-slate-800/50 rounded-lg p-2">
                      <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                        <Navigation className="w-3 h-3" /> Coordenadas
                      </div>
                      <p className="text-sm text-white font-mono">{rotaerData.coordinates}</p>
                    </div>
                  )}
                  {rotaerData.elevation && (
                    <div className="bg-slate-800/50 rounded-lg p-2">
                      <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                        <Ruler className="w-3 h-3" /> Elevação
                      </div>
                      <p className="text-sm text-white font-mono">{rotaerData.elevation}</p>
                    </div>
                  )}
                  {rotaerData.fir && (
                    <div className="bg-slate-800/50 rounded-lg p-2">
                      <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                        <Compass className="w-3 h-3" /> FIR
                      </div>
                      <p className="text-sm text-white font-mono">{rotaerData.fir}</p>
                    </div>
                  )}
                  {rotaerData.utc && (
                    <div className="bg-slate-800/50 rounded-lg p-2">
                      <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                        <Wind className="w-3 h-3" /> UTC
                      </div>
                      <p className="text-sm text-white font-mono">{rotaerData.utc}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Type Info */}
              {rotaerData.type && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                    <Plane className="w-4 h-4 text-amber-400" /> Tipo e Operações
                  </h4>
                  <p className="text-sm text-slate-400 whitespace-pre-wrap">{rotaerData.type}</p>
                </div>
              )}

              {/* Communications */}
              {rotaerData.communications && rotaerData.communications.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-green-400" /> Comunicações
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {rotaerData.communications.map((com, idx) => (
                      <div key={idx} className="bg-slate-900/50 rounded-lg p-2">
                        <span className="text-xs text-slate-400">{com.name}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {com.frequencies.map((freq, fIdx) => (
                            <span key={fIdx} className="text-sm font-mono text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                              {freq}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Radio Navigation */}
              {rotaerData.radioNav && rotaerData.radioNav.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-blue-400" /> Radionavegação
                  </h4>
                  <div className="space-y-1">
                    {rotaerData.radioNav.map((nav, idx) => (
                      <p key={idx} className="text-sm text-slate-400 font-mono">{nav}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Services */}
              {(rotaerData.fuel || rotaerData.services || rotaerData.firefighting) && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-cyan-400" /> Serviços
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {rotaerData.fuel && (
                      <div className="bg-slate-900/50 rounded-lg p-2">
                        <span className="text-xs text-slate-400">Combustível</span>
                        <p className="text-sm text-white">{rotaerData.fuel}</p>
                      </div>
                    )}
                    {rotaerData.services && (
                      <div className="bg-slate-900/50 rounded-lg p-2">
                        <span className="text-xs text-slate-400">Serviços</span>
                        <p className="text-sm text-white">{rotaerData.services}</p>
                      </div>
                    )}
                    {rotaerData.firefighting && (
                      <div className="bg-slate-900/50 rounded-lg p-2">
                        <span className="text-xs text-slate-400">RFFS</span>
                        <p className="text-sm text-white">{rotaerData.firefighting}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MET & AIS */}
              {(rotaerData.meteorology?.length > 0 || rotaerData.ais?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rotaerData.meteorology?.length > 0 && (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                        <Wind className="w-4 h-4 text-purple-400" /> Meteorologia
                      </h4>
                      {rotaerData.meteorology.map((met, idx) => (
                        <p key={idx} className="text-sm text-slate-400">{met}</p>
                      ))}
                    </div>
                  )}
                  {rotaerData.ais?.length > 0 && (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-indigo-400" /> AIS
                      </h4>
                      {rotaerData.ais.map((ais, idx) => (
                        <p key={idx} className="text-sm text-slate-400">{ais}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Declared Distances */}
              {rotaerData.declaredDistances && rotaerData.declaredDistances.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-rose-400" /> Distâncias Declaradas
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 text-xs">
                          <th className="text-left p-2">RWY</th>
                          <th className="text-left p-2">TORA</th>
                          <th className="text-left p-2">TODA</th>
                          <th className="text-left p-2">ASDA</th>
                          <th className="text-left p-2">LDA</th>
                          <th className="text-left p-2">Coords</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rotaerData.declaredDistances.map((dd, idx) => (
                          <tr key={idx} className="border-t border-slate-700/50">
                            <td className="p-2 font-mono font-bold text-amber-400">{dd.runway}</td>
                            <td className="p-2 text-slate-300">{dd.tora}m</td>
                            <td className="p-2 text-slate-300">{dd.toda}m</td>
                            <td className="p-2 text-slate-300">{dd.asda}m</td>
                            <td className="p-2 text-slate-300">{dd.lda}m</td>
                            <td className="p-2 text-slate-400 font-mono text-xs">{dd.coordinates}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Remarks */}
              {rotaerData.remarks && rotaerData.remarks.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" /> Observações
                  </h4>
                  <div className="space-y-4">
                    {rotaerData.remarks.map((remark, idx) => (
                      <div key={idx}>
                        <h5 className="text-xs font-semibold text-amber-400 mb-2">{remark.title}</h5>
                        <ul className="space-y-1">
                          {remark.items.map((item, itemIdx) => (
                            <li key={itemIdx} className="text-sm text-slate-400 pl-3 border-l-2 border-slate-700">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Complements */}
              {rotaerData.complements && rotaerData.complements.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">Complementos</h4>
                  <div className="space-y-1">
                    {rotaerData.complements.map((comp, idx) => (
                      <p key={idx} className="text-sm text-slate-400">{comp}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
          <p className="text-xs text-slate-500 text-center">
            Dados do ROTAER fornecidos oficialmente pelo DECEA através do AISWEB. Verifique sempre a atualização antes do voo.
          </p>
        </div>
      </div>
    </div>
  );
};
