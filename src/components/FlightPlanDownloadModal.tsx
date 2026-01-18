import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
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
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Capture map screenshot when modal opens
  useEffect(() => {
    if (isOpen && waypoints.length >= 2) {
      captureMapScreenshot();
    }
    return () => {
      setMapImage(null);
    };
  }, [isOpen, waypoints.length]);

  const captureMapScreenshot = async () => {
    setIsCapturing(true);
    try {
      const mapInstance = (window as any).leafletMapInstance;
      
      if (!mapInstance || waypoints.length < 2) {
        console.error('Map instance not found or not enough waypoints');
        setIsCapturing(false);
        return;
      }

      // Save current map view to restore later
      const currentCenter = mapInstance.getCenter();
      const currentZoom = mapInstance.getZoom();

      // Calculate bounds from waypoints with generous padding
      const lats = waypoints.map(wp => wp.lat);
      const lngs = waypoints.map(wp => wp.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      
      // Add 25% padding to bounds to ensure all waypoints are visible
      const latPadding = Math.max((maxLat - minLat) * 0.25, 0.1);
      const lngPadding = Math.max((maxLng - minLng) * 0.25, 0.1);
      
      const bounds = [
        [minLat - latPadding, minLng - lngPadding],
        [maxLat + latPadding, maxLng + lngPadding]
      ] as [[number, number], [number, number]];
      
      console.log('Fitting map to bounds:', bounds, 'waypoints:', waypoints.length);
      
      // Fit the map to the route bounds with pixel padding
      mapInstance.fitBounds(bounds, { 
        animate: false,
        duration: 0,
        padding: [50, 50],
        maxZoom: 9
      });
      
      // Force invalidate size to ensure proper rendering
      mapInstance.invalidateSize();

      // Wait for map to update and tiles to load (longer wait)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Find the leaflet map container
      const mapContainer = document.querySelector('.leaflet-container') as HTMLElement;
      if (!mapContainer) {
        console.error('Map container not found');
        setIsCapturing(false);
        return;
      }

      // Use html2canvas to capture the map
      const canvas = await html2canvas(mapContainer, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#1e293b',
        scale: 2,
        logging: false,
        imageTimeout: 20000,
        onclone: (clonedDoc) => {
          // Hide UI elements that shouldn't be in the screenshot
          const elementsToHide = clonedDoc.querySelectorAll(
            '.leaflet-control-container, .leaflet-control, [class*="sidebar"], [class*="menu"], [class*="panel"], [class*="Modal"], [class*="modal"], [class*="Popover"], [class*="popover"]'
          );
          elementsToHide.forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });
        }
      });

      // Draw route line on canvas
      const ctx = canvas.getContext('2d');
      if (ctx && waypoints.length >= 2) {
        const scale = 2; // Same scale as html2canvas
        
        ctx.strokeStyle = '#22c55e'; // Green route line
        ctx.lineWidth = 4 * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        
        waypoints.forEach((wp, index) => {
          // Convert lat/lng to pixel coordinates
          const point = mapInstance.latLngToContainerPoint([wp.lat, wp.lng]);
          const x = point.x * scale;
          const y = point.y * scale;
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.stroke();
        
        // Draw waypoint markers
        waypoints.forEach((wp, index) => {
          const point = mapInstance.latLngToContainerPoint([wp.lat, wp.lng]);
          const x = point.x * scale;
          const y = point.y * scale;
          
          // Draw circle marker
          ctx.beginPath();
          ctx.arc(x, y, 8 * scale, 0, Math.PI * 2);
          ctx.fillStyle = wp.role === 'ORIGIN' ? '#22c55e' : wp.role === 'DESTINATION' ? '#ef4444' : '#3b82f6';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2 * scale;
          ctx.stroke();
          
          // Draw waypoint label
          const label = wp.icao || wp.name?.substring(0, 5) || `WP${index + 1}`;
          ctx.font = `bold ${12 * scale}px Arial`;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.strokeText(label, x + 12 * scale, y + 4 * scale);
          ctx.fillText(label, x + 12 * scale, y + 4 * scale);
        });
      }

      const imageData = canvas.toDataURL('image/png', 1.0);
      setMapImage(imageData);
      
      // Restore original map view
      mapInstance.setView(currentCenter, currentZoom, { animate: false });
      
    } catch (error) {
      console.error('Error capturing map:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  if (!isOpen) return null;

  const totalDistance = flightSegments.reduce((acc, s) => acc + s.distance, 0);
  const totalFuel = flightSegments.reduce((acc, s) => acc + s.fuel, 0);
  
  // Calculate total time from ETE strings to be consistent
  const calculateTotalTime = (): string => {
    let totalMinutes = 0;
    flightSegments.forEach(s => {
      if (s.ete && s.ete !== '--:--') {
        const [h, m] = s.ete.split(':').map(Number);
        totalMinutes += h * 60 + m;
      }
    });
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

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
      content += `   Tempo de Voo: ${calculateTotalTime()} h\n`;
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
        distance: totalDistance,
        time: calculateTotalTime(),
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

  const handleDownloadMapImage = () => {
    if (!mapImage) return;
    
    const origin = waypoints.find(w => w.role === 'ORIGIN')?.icao || 'XXX';
    const dest = waypoints.find(w => w.role === 'DESTINATION')?.icao || 'XXX';
    const dateStr = new Date().toISOString().split('T')[0];
    
    const a = document.createElement('a');
    a.href = mapImage;
    a.download = `MAPA_${origin}_${dest}_${dateStr}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900/95 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-blue-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
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
                <span className="text-slate-500">Tempo: </span>
                <span className="text-white font-semibold">{calculateTotalTime()} h</span>
              </div>
            </div>
          </div>

          {/* Map Preview */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Imagem da Rota</h3>
              {mapImage && (
                <button
                  onClick={handleDownloadMapImage}
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Baixar Imagem
                </button>
              )}
            </div>
            
            {isCapturing ? (
              <div className="flex items-center justify-center h-48 bg-slate-900/50 rounded-lg">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-slate-400">Capturando mapa...</span>
                </div>
              </div>
            ) : mapImage ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-600">
                <img 
                  src={mapImage} 
                  alt="Mapa da rota" 
                  className="w-full h-auto max-h-64 object-cover"
                />
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  Alta resolução
                </div>
              </div>
            ) : waypoints.length < 2 ? (
              <div className="flex items-center justify-center h-32 bg-slate-900/50 rounded-lg">
                <span className="text-sm text-slate-500">Adicione ao menos 2 waypoints para visualizar a rota</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 bg-slate-900/50 rounded-lg gap-2">
                <span className="text-sm text-slate-500">Não foi possível capturar o mapa</span>
                <button
                  onClick={captureMapScreenshot}
                  className="text-xs text-sky-400 hover:text-sky-300 underline"
                >
                  Tentar novamente
                </button>
              </div>
            )}
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
