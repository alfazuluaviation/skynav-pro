import React, { useState, useEffect } from 'react';
import { Waypoint, FlightSegment } from '../types';
import { useDownloadManager } from '../hooks/useDownloadManager';
import { Wifi, WifiOff, AlertTriangle, Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import { getCachedTileCount } from '../services/tileCache';
import { DownloadStats } from '../services/chartDownloader';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  waypoints: Waypoint[];
  flightSegments: FlightSegment[];
  aircraftModel: { id: string; label: string; speed: number };
  plannedSpeed: number;
  downloadedLayers: string[];
  // Flag indicating IndexedDB validation is complete - prevents showing false "OFFLINE" status
  downloadedLayersReady: boolean;
  onDownloadLayer: (layer: string) => Promise<void>;
  onClearLayerCache: (layer: string) => void;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
  waypoints,
  flightSegments,
  aircraftModel,
  plannedSpeed,
  downloadedLayers,
  downloadedLayersReady,
  onDownloadLayer,
  onClearLayerCache
}) => {
  const [downloadFormat, setDownloadFormat] = useState<'txt' | 'csv' | 'json'>('txt');
  const [confirmClearLayer, setConfirmClearLayer] = useState<string | null>(null);
  const [tileCounts, setTileCounts] = useState<Record<string, number>>({});
  const { syncingLayers, isOnline, getError } = useDownloadManager();

  // Fetch tile counts for downloaded layers
  // Also clears counts for layers that were removed (cache cleared)
  useEffect(() => {
    const fetchTileCounts = async () => {
      const counts: Record<string, number> = {};
      for (const layerId of downloadedLayers) {
        try {
          const count = await getCachedTileCount(layerId);
          counts[layerId] = count;
        } catch (e) {
          counts[layerId] = 0;
        }
      }
      // This replaces the entire state, removing counts for cleared layers
      setTileCounts(counts);
    };
    
    if (downloadedLayersReady) {
      // Always fetch, even if downloadedLayers is empty (to clear old counts)
      fetchTileCounts();
    }
  }, [downloadedLayers, downloadedLayersReady]);

  if (!isOpen) return null;

  const generateFlightPlanText = () => {
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR');

    let content = `═══════════════════════════════════════════════════════════════\n`;
    content += `                    PLANO DE VOO - SKYFPL\n`;
    content += `═══════════════════════════════════════════════════════════════\n\n`;
    content += `Data: ${date}    Hora: ${time}\n`;
    content += `Aeronave: ${aircraftModel.label} (${aircraftModel.id})\n`;
    content += `Velocidade Planejada: ${plannedSpeed} kt\n\n`;

    content += `───────────────────────────────────────────────────────────────\n`;
    content += `                         ROTA\n`;
    content += `───────────────────────────────────────────────────────────────\n\n`;

    if (waypoints.length === 0) {
      content += `Nenhum waypoint definido.\n`;
    } else {
      waypoints.forEach((wp, index) => {
        const role = wp.role === 'ORIGIN' ? '[ORIGEM]' : wp.role === 'DESTINATION' ? '[DESTINO]' : `[WPT ${index}]`;
        content += `${role} ${wp.icao || wp.name}\n`;
        content += `   Nome: ${wp.name}\n`;
        content += `   Coordenadas: ${wp.lat.toFixed(6)}° / ${wp.lng.toFixed(6)}°\n`;
        content += `   Tipo: ${wp.type}\n\n`;
      });
    }

    if (flightSegments.length > 0) {
      content += `───────────────────────────────────────────────────────────────\n`;
      content += `                       SEGMENTOS\n`;
      content += `───────────────────────────────────────────────────────────────\n\n`;

      let totalDistance = 0;
      let totalFuel = 0;

      flightSegments.forEach((seg, index) => {
        totalDistance += seg.distance;
        totalFuel += seg.fuel;
        content += `Leg ${index + 1}: ${seg.from.icao || seg.from.name} → ${seg.to.icao || seg.to.name}\n`;
        content += `   Distância: ${seg.distance.toFixed(1)} NM\n`;
        content += `   Proa Magnética: ${seg.track}°\n`;
        content += `   ETE: ${seg.ete}\n`;
        content += `   Combustível Est.: ${seg.fuel} L\n\n`;
      });

      content += `───────────────────────────────────────────────────────────────\n`;
      content += `                        TOTAIS\n`;
      content += `───────────────────────────────────────────────────────────────\n\n`;
      content += `   Distância Total: ${totalDistance.toFixed(1)} NM\n`;
      content += `   Combustível Total Est.: ${totalFuel} L\n`;
    }

    content += `\n═══════════════════════════════════════════════════════════════\n`;
    content += `                 Gerado por SkyFPL\n`;
    content += `═══════════════════════════════════════════════════════════════\n`;

    return content;
  };

  const generateFlightPlanCSV = () => {
    let csv = 'Seq,ICAO,Nome,Latitude,Longitude,Tipo,Função,Distância(NM),Proa(°),ETE,Combustível(L)\n';

    waypoints.forEach((wp, index) => {
      const segment = flightSegments[index];
      csv += `${index + 1},${wp.icao || ''},${wp.name},${wp.lat.toFixed(6)},${wp.lng.toFixed(6)},${wp.type},${wp.role || 'WAYPOINT'},`;
      if (segment) {
        csv += `${segment.distance.toFixed(1)},${segment.track},${segment.ete},${segment.fuel}`;
      } else {
        csv += ',,,,';
      }
      csv += '\n';
    });

    return csv;
  };

  const generateFlightPlanJSON = () => {
    const data = {
      metadata: {
        generatedAt: new Date().toISOString(),
        aircraft: aircraftModel,
        plannedSpeed: plannedSpeed
      },
      waypoints: waypoints.map(wp => ({
        icao: wp.icao,
        name: wp.name,
        coordinates: {
          latitude: wp.lat,
          longitude: wp.lng
        },
        type: wp.type,
        role: wp.role
      })),
      segments: flightSegments.map(seg => ({
        from: seg.from.icao || seg.from.name,
        to: seg.to.icao || seg.to.name,
        distance: seg.distance,
        track: seg.track,
        ete: seg.ete,
        fuel: seg.fuel
      })),
      totals: {
        distance: flightSegments.reduce((sum, s) => sum + s.distance, 0),
        fuel: flightSegments.reduce((sum, s) => sum + s.fuel, 0)
      }
    };

    return JSON.stringify(data, null, 2);
  };

  const handleDownload = () => {
    let content: string;
    let filename: string;
    let mimeType: string;

    const origin = waypoints.find(w => w.role === 'ORIGIN')?.icao || 'XXX';
    const dest = waypoints.find(w => w.role === 'DESTINATION')?.icao || 'XXX';
    const dateStr = new Date().toISOString().split('T')[0];

    switch (downloadFormat) {
      case 'csv':
        content = generateFlightPlanCSV();
        filename = `PLN_${origin}_${dest}_${dateStr}.csv`;
        mimeType = 'text/csv';
        break;
      case 'json':
        content = generateFlightPlanJSON();
        filename = `PLN_${origin}_${dest}_${dateStr}.json`;
        mimeType = 'application/json';
        break;
      default:
        content = generateFlightPlanText();
        filename = `PLN_${origin}_${dest}_${dateStr}.txt`;
        mimeType = 'text/plain';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleChartClick = async (chartId: string) => {
    const isSyncing = syncingLayers[chartId] !== undefined;
    if (isSyncing) return;

    const isDownloaded = downloadedLayers.includes(chartId);
    
    // This modal is ONLY for downloading - not for toggling map layers
    // If already downloaded, do nothing (user can use "CARTAS E MAPAS" menu to toggle)
    if (isDownloaded) {
      return;
    }
    
    // Download the chart/base map
    await onDownloadLayer(chartId);
  };

  const handleClearCacheRequest = (e: React.MouseEvent, chartId: string) => {
    e.stopPropagation();
    setConfirmClearLayer(chartId);
  };

  const handleConfirmClearCache = () => {
    if (confirmClearLayer) {
      onClearLayerCache(confirmClearLayer);
      setConfirmClearLayer(null);
    }
  };

  const handleCancelClearCache = () => {
    setConfirmClearLayer(null);
  };

  const getLayerLabel = (layerId: string): string => {
    const allOptions = [...chartOptions, ...baseMapOptions];
    return allOptions.find(o => o.id === layerId)?.label || layerId;
  };

  const handleDownloadAll = async () => {
    for (const chart of chartOptions) {
      if (!downloadedLayers.includes(chart.id)) {
        await onDownloadLayer(chart.id);
      }
    }
  };

  const chartOptions = [
    { id: 'HIGH', label: 'ENRC HIGH' },
    { id: 'LOW', label: 'ENRC LOW' },
    { id: 'REA', label: 'REA' },
    { id: 'REUL', label: 'REUL' },
    { id: 'REH', label: 'REH' },
    { id: 'WAC', label: 'WAC' },
    { id: 'ARC', label: 'ARC' },
  ];

  // Base map options for offline
  const baseMapOptions = [
    { id: 'BASEMAP_OSM', label: 'Mapa (Dia)' },
    { id: 'BASEMAP_DARK', label: 'Mapa (Noite)' },
    { id: 'BASEMAP_TOPO', label: 'Terreno' },
    { id: 'BASEMAP_SATELLITE', label: 'Satélite' },
  ];

  const renderChartButton = (chart: { id: string; label: string }) => {
    // CRITICAL: Only show as downloaded AFTER IndexedDB validation is complete
    // This prevents false positives from residual tiles or stale localStorage
    const isDownloaded = downloadedLayersReady && downloadedLayers.includes(chart.id);
    const isValidating = !downloadedLayersReady;
    
    // Download modal shows ONLY download status - NOT map activation status
    const progress = syncingLayers[chart.id];
    const isSyncing = progress !== undefined;
    const error = getError(chart.id);

    return (
      <div key={chart.id} className="relative">
        <button
          onClick={() => handleChartClick(chart.id)}
          disabled={isSyncing || isValidating || (!isOnline && !isDownloaded)}
          className={`w-full p-4 rounded-xl border-2 transition-all flex flex-col items-center relative overflow-hidden ${
            error
              ? 'border-red-500/50 bg-red-500/10'
              : isValidating
                ? 'border-slate-600 bg-slate-800/30'
                : isDownloaded
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : isSyncing
                    ? 'border-sky-500/50 bg-sky-500/5'
                    : !isOnline
                      ? 'border-slate-700 bg-slate-800/30 opacity-50 cursor-not-allowed'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
          }`}
        >
          <div className="text-sm font-bold text-white mb-1 relative z-10">{chart.label}</div>

          {error ? (
            <div className="flex items-center gap-1 text-xs text-red-400 relative z-10">
              <WifiOff className="w-3 h-3" />
              Sem internet
            </div>
          ) : isValidating ? (
            <div className="flex items-center gap-1 text-xs text-slate-400 relative z-10">
              <Loader2 className="w-3 h-3 animate-spin" />
              Verificando...
            </div>
          ) : isSyncing ? (
            <div className="w-full mt-1 relative z-10">
              <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-emerald-400 mt-1 font-bold">{progress}%</div>
            </div>
          ) : isDownloaded ? (
            <div className="flex flex-col items-center relative z-10">
              <div className="flex items-center gap-1 text-xs text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                OFFLINE ✓
              </div>
              {tileCounts[chart.id] > 0 && (
                <div className="text-[9px] text-slate-500 mt-0.5">
                  {tileCounts[chart.id]} tiles
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 relative z-10 font-bold">BAIXAR</div>
          )}
        </button>
        {/* Clear cache button - only clears offline cache, does NOT affect map display */}
        {isDownloaded && !isSyncing && (
          <button
            onClick={(e) => handleClearCacheRequest(e, chart.id)}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center text-white text-xs shadow-lg transition-colors"
            title="Limpar cache offline (não afeta exibição no mapa)"
          >
            ×
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900/95 border-t md:border border-slate-700/50 rounded-t-3xl md:rounded-2xl shadow-2xl w-full md:max-w-lg md:mx-4 overflow-hidden animate-slide-up md:animate-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Cartas Aeronáuticas
          </h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Connection status */}
          {!isOnline && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg">
              <WifiOff className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-300">Sem conexão com a internet</span>
            </div>
          )}
          
          {/* Info text */}
          <p className="text-xs text-slate-400 text-center">
            Baixe cartas e mapas para uso <strong>offline</strong>. Use o menu "CARTAS E MAPAS" para ativar/desativar no mapa.
          </p>
          
          {/* Offline zoom info */}
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-[11px] text-emerald-300">
              <strong>Modo Offline:</strong> Cartas baixadas funcionam em todos os níveis de zoom. Os tiles de alta resolução são escalados automaticamente.
            </span>
          </div>

          {/* Base Map Options */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Mapa Base (OSM)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {baseMapOptions.map(renderChartButton)}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700/50"></div>

          {/* Chart Options */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Cartas Aeronáuticas
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {chartOptions.slice(0, 4).map(renderChartButton)}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {chartOptions.slice(4, 7).map(renderChartButton)}
            </div>
          </div>

          {/* Download All Button */}
          <button
            onClick={handleDownloadAll}
            disabled={Object.keys(syncingLayers).length > 0 || downloadedLayers.length === chartOptions.length}
            className={`w-full py-4 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${
              downloadedLayers.length === chartOptions.length
                ? 'bg-emerald-600 text-white cursor-default'
                : Object.keys(syncingLayers).length > 0
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white shadow-sky-500/25'
            }`}
          >
            {downloadedLayers.length === chartOptions.length ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Todos baixados
              </>
            ) : Object.keys(syncingLayers).length > 0 ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                Baixando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Baixar todos
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Dialog for Clear Cache */}
      {confirmClearLayer && (
        <div className="fixed inset-0 z-[3100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-orange-600 px-5 py-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-white" />
              <h3 className="text-lg font-bold text-white">Limpar Cache</h3>
            </div>
            
            {/* Content */}
            <div className="p-5 space-y-4">
              <p className="text-slate-300 text-sm leading-relaxed">
                Você está prestes a remover a carta <span className="font-bold text-white">{getLayerLabel(confirmClearLayer)}</span> do cache offline.
              </p>
              
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-300 text-xs leading-relaxed">
                  <strong>⚠️ Atenção:</strong> Esta carta não estará mais disponível offline. Você precisará baixá-la novamente para usar sem conexão com a internet.
                </p>
              </div>

              <p className="text-slate-400 text-xs">
                Deseja continuar?
              </p>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={handleCancelClearCache}
                className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmClearCache}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold rounded-xl transition-all shadow-lg"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};