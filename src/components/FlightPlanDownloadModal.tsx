import React, { useState } from 'react';
import { Waypoint, FlightSegment } from '../types';

interface FlightPlanDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  waypoints: Waypoint[];
  flightSegments: FlightSegment[];
  aircraftModel: { id: string; label: string; speed: number };
  plannedSpeed: number;
}

export const FlightPlanDownloadModal: React.FC<FlightPlanDownloadModalProps> = ({
  isOpen,
  onClose,
  waypoints,
  flightSegments,
  aircraftModel,
  plannedSpeed
}) => {
  const [downloadFormat, setDownloadFormat] = useState<'txt' | 'csv' | 'json'>('txt');

  if (!isOpen) return null;

  const totalDistance = flightSegments.reduce((acc, s) => acc + s.distance, 0);
  const totalFuel = flightSegments.reduce((acc, s) => acc + s.fuel, 0);

  const generateFlightPlanText = () => {
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR');
    
    let content = `═══════════════════════════════════════════════════════════════\n`;
    content += `                    PLANO DE VOO - SKY NAVIGATION\n`;
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
      
      flightSegments.forEach((seg, index) => {
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
    content += `                 Gerado por Sky Navigation\n`;
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
        distance: totalDistance,
        fuel: totalFuel
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

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900/95 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download do Plano de Voo
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
          {/* Resumo do Plano */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Resumo do Plano</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">Aeronave: </span>
                <span className="text-white font-semibold">{aircraftModel.id}</span>
              </div>
              <div>
                <span className="text-slate-500">Velocidade: </span>
                <span className="text-white font-semibold">{plannedSpeed} kt</span>
              </div>
              <div>
                <span className="text-slate-500">Waypoints: </span>
                <span className="text-white font-semibold">{waypoints.length}</span>
              </div>
              <div>
                <span className="text-slate-500">Legs: </span>
                <span className="text-white font-semibold">{flightSegments.length}</span>
              </div>
              <div>
                <span className="text-slate-500">Distância: </span>
                <span className="text-white font-semibold">{totalDistance.toFixed(1)} NM</span>
              </div>
              <div>
                <span className="text-slate-500">Combustível: </span>
                <span className="text-white font-semibold">{totalFuel} L</span>
              </div>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Formato de Download</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setDownloadFormat('txt')}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center ${
                  downloadFormat === 'txt'
                    ? 'border-sky-500 bg-sky-500/20 text-sky-400'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="text-2xl mb-1">📄</div>
                <div className="text-sm font-bold">TXT</div>
                <div className="text-xs text-slate-500">Texto</div>
              </button>
              <button
                onClick={() => setDownloadFormat('csv')}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center ${
                  downloadFormat === 'csv'
                    ? 'border-sky-500 bg-sky-500/20 text-sky-400'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="text-2xl mb-1">📊</div>
                <div className="text-sm font-bold">CSV</div>
                <div className="text-xs text-slate-500">Planilha</div>
              </button>
              <button
                onClick={() => setDownloadFormat('json')}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center ${
                  downloadFormat === 'json'
                    ? 'border-sky-500 bg-sky-500/20 text-sky-400'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="text-2xl mb-1">🔧</div>
                <div className="text-sm font-bold">JSON</div>
                <div className="text-xs text-slate-500">API</div>
              </button>
            </div>
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={waypoints.length === 0}
            className="w-full py-4 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-sky-500/25 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {waypoints.length === 0 ? 'Nenhum plano para baixar' : 'Baixar Plano de Voo'}
          </button>

          {waypoints.length === 0 && (
            <p className="text-center text-sm text-slate-500">
              Adicione waypoints ao seu plano de voo para poder fazer o download.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
