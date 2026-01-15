import React, { useState } from 'react';
import { Waypoint, FlightSegment } from '../types';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  waypoints: Waypoint[];
  flightSegments: FlightSegment[];
  aircraftModel: { id: string; label: string; speed: number };
  plannedSpeed: number;
  downloadedLayers: string[];
  syncingLayers: Record<string, number>;
  onDownloadLayer: (layer: string) => Promise<void>;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
  waypoints,
  flightSegments,
  aircraftModel,
  plannedSpeed,
  downloadedLayers,
  syncingLayers,
  onDownloadLayer
}) => {
  const [downloadFormat, setDownloadFormat] = useState<'txt' | 'csv' | 'json'>('txt');

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

  const handleChartDownload = async (chartId: string) => {
    if (downloadedLayers.includes(chartId) || syncingLayers[chartId] !== undefined) return;
    await onDownloadLayer(chartId);
  };

  const handleDownloadAll = async () => {
    // Download all charts one by one
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
    { id: 'WAC', label: 'WAC' },
  ];

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900/95 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
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
        <div className="p-6 space-y-6">
          {/* Chart Download Options */}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {chartOptions.slice(0, 3).map((chart) => {
                const isDownloaded = downloadedLayers.includes(chart.id);
                const progress = syncingLayers[chart.id];
                const isSyncing = progress !== undefined;

                return (
                  <button
                    key={chart.id}
                    onClick={() => handleChartDownload(chart.id)}
                    disabled={isSyncing}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center relative overflow-hidden ${isDownloaded
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : isSyncing
                          ? 'border-sky-500/50 bg-sky-500/5'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                  >
                    <div className="text-sm font-bold text-white mb-1 relative z-10">{chart.label}</div>

                    {isSyncing ? (
                      <div className="w-full mt-1 relative z-10">
                        <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <div className="text-[10px] text-sky-400 mt-1 font-bold">{progress}%</div>
                      </div>
                    ) : isDownloaded ? (
                      <div className="flex items-center gap-1 text-xs text-emerald-400 relative z-10">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        DISPONÍVEL
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 relative z-10 font-bold">BAIXAR</div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-center">
              {chartOptions.slice(3, 4).map((chart) => {
                const isDownloaded = downloadedLayers.includes(chart.id);
                const progress = syncingLayers[chart.id];
                const isSyncing = progress !== undefined;

                return (
                  <button
                    key={chart.id}
                    onClick={() => handleChartDownload(chart.id)}
                    disabled={isSyncing}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center w-1/3 relative overflow-hidden ${isDownloaded
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : isSyncing
                          ? 'border-sky-500/50 bg-sky-500/5'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                  >
                    <div className="text-sm font-bold text-white mb-1 relative z-10">{chart.label}</div>

                    {isSyncing ? (
                      <div className="w-full mt-1 relative z-10">
                        <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <div className="text-[10px] text-sky-400 mt-1 font-bold">{progress}%</div>
                      </div>
                    ) : isDownloaded ? (
                      <div className="flex items-center gap-1 text-xs text-emerald-400 relative z-10">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        DISPONÍVEL
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 relative z-10 font-bold">BAIXAR</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Download All Button */}
          <button
            onClick={handleDownloadAll}
            disabled={Object.keys(syncingLayers).length > 0 || downloadedLayers.length === chartOptions.length}
            className={`w-full py-4 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${downloadedLayers.length === chartOptions.length
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
    </div>
  );
};
