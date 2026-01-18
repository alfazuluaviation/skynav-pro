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

      // Use html2canvas to capture the map (route is already rendered on the map)
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

  // Format coordinates as degrees/minutes/seconds
  const formatCoord = (value: number, isLat: boolean): string => {
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(0);
    const dir = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${deg}°${min.toString().padStart(2, '0')}'${sec.toString().padStart(2, '0')}"${dir}`;
  };

  // Get role label
  const getRoleLabel = (role?: string): { label: string; color: string } => {
    switch (role) {
      case 'ORIGIN': return { label: 'DEP', color: 'bg-teal-600' };
      case 'DESTINATION': return { label: 'ARR', color: 'bg-red-500' };
      default: return { label: 'USE', color: 'bg-amber-500' };
    }
  };

  // Get type label
  const getTypeLabel = (type: string, role?: string): { label: string; color: string } => {
    if (role === 'ORIGIN') return { label: 'DEP', color: 'bg-teal-600' };
    if (role === 'DESTINATION') return { label: 'ARR', color: 'bg-red-500' };
    switch (type) {
      case 'AIRPORT': return { label: 'AIR', color: 'bg-amber-500' };
      case 'VOR': return { label: 'VOR', color: 'bg-blue-500' };
      case 'NDB': return { label: 'NDB', color: 'bg-purple-500' };
      case 'FIX': return { label: 'FIX', color: 'bg-cyan-500' };
      default: return { label: 'USE', color: 'bg-amber-500' };
    }
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
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70 backdrop-blur-sm print:bg-white print:backdrop-blur-none">
      <div className="bg-slate-900/95 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto print:bg-white print:border-none print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:rounded-none print:mx-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-blue-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10 print:bg-slate-800 print:static">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6 print:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download do Plano de Voo
          </h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors print:hidden"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - A4 optimized layout */}
        <div className="p-4 space-y-4 print:p-0 print:space-y-2" style={{ maxWidth: '210mm' }}>
          {/* Header Info Row */}
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 print:bg-gray-100 print:border-gray-300 print:rounded-none">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
              <div className="text-center">
                <span className="text-slate-500 print:text-gray-600 block">Aeronave</span>
                <span className="text-white print:text-black font-bold">{aircraftModel.id}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-500 print:text-gray-600 block">Velocidade</span>
                <span className="text-white print:text-black font-bold">{plannedSpeed} kt</span>
              </div>
              <div className="text-center">
                <span className="text-slate-500 print:text-gray-600 block">Waypoints</span>
                <span className="text-white print:text-black font-bold">{waypoints.length}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-500 print:text-gray-600 block">Distância</span>
                <span className="text-white print:text-black font-bold">{totalDistance.toFixed(1)} NM</span>
              </div>
              <div className="text-center">
                <span className="text-slate-500 print:text-gray-600 block">Tempo</span>
                <span className="text-white print:text-black font-bold">{calculateTotalTime()}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-500 print:text-gray-600 block">Combustível</span>
                <span className="text-white print:text-black font-bold">{totalFuel.toFixed(1)} L</span>
              </div>
            </div>
          </div>

          {/* Map Preview - Compact */}
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 print:bg-white print:border-gray-300 print:rounded-none">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider print:text-gray-700">Mapa da Rota</h3>
              {mapImage && (
                <button
                  onClick={handleDownloadMapImage}
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors print:hidden"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Baixar
                </button>
              )}
            </div>
            
            {isCapturing ? (
              <div className="flex items-center justify-center h-40 bg-slate-900/50 rounded-lg print:hidden">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-slate-400">Capturando...</span>
                </div>
              </div>
            ) : mapImage ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-600 print:border-gray-400">
                <img 
                  src={mapImage} 
                  alt="Mapa da rota" 
                  className="w-full h-auto max-h-48 object-contain print:max-h-64"
                />
              </div>
            ) : waypoints.length < 2 ? (
              <div className="flex items-center justify-center h-32 bg-slate-900/50 rounded-lg print:hidden">
                <span className="text-xs text-slate-500">Mínimo 2 waypoints</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 bg-slate-900/50 rounded-lg gap-2 print:hidden">
                <button onClick={captureMapScreenshot} className="text-xs text-sky-400 hover:text-sky-300 underline">
                  Tentar novamente
                </button>
              </div>
            )}
          </div>

          {/* Flight Plan Table - Full Details */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden print:bg-white print:border-gray-300 print:rounded-none">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider p-3 border-b border-slate-700/50 print:text-gray-700 print:bg-gray-100 print:border-gray-300">
              Detalhes do Plano de Voo
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-700/50 print:bg-gray-200">
                    <th className="text-left py-2 px-3 text-slate-300 font-bold print:text-gray-700">PONTO</th>
                    <th className="text-center py-2 px-2 text-slate-300 font-bold print:text-gray-700">TIPO</th>
                    <th className="text-left py-2 px-3 text-slate-300 font-bold print:text-gray-700">COORDENADAS</th>
                    <th className="text-center py-2 px-2 text-slate-300 font-bold print:text-gray-700">RUMO</th>
                    <th className="text-center py-2 px-2 text-slate-300 font-bold print:text-gray-700">DIST</th>
                    <th className="text-center py-2 px-2 text-slate-300 font-bold print:text-gray-700">ETE</th>
                    <th className="text-center py-2 px-2 text-slate-300 font-bold print:text-gray-700">COMB</th>
                  </tr>
                </thead>
                <tbody>
                  {waypoints.map((wp, index) => {
                    const segment = index < flightSegments.length ? flightSegments[index] : null;
                    const typeInfo = getTypeLabel(wp.type, wp.role);
                    
                    return (
                      <tr 
                        key={wp.id} 
                        className="border-t border-slate-700/30 hover:bg-slate-700/30 print:border-gray-200 print:hover:bg-transparent"
                      >
                        <td className="py-2 px-3">
                          <span className="text-white print:text-black font-semibold">
                            {wp.icao || wp.name?.substring(0, 10) || `WP${index + 1}`}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white ${typeInfo.color} print:bg-gray-500`}>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="text-slate-300 print:text-gray-600 leading-tight">
                            <div>{formatCoord(wp.lat, true)}</div>
                            <div>{formatCoord(wp.lng, false)}</div>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-white print:text-black font-medium">
                            {segment ? `${segment.track}°` : '-'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-slate-300 print:text-gray-600">
                            {segment ? `${segment.distance.toFixed(1)}` : '-'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-slate-300 print:text-gray-600">
                            {segment ? segment.ete : '-'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="text-slate-300 print:text-gray-600">
                            {segment ? `${segment.fuel.toFixed(1)}` : '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals Row */}
                  <tr className="border-t-2 border-slate-600 bg-slate-700/50 print:border-gray-400 print:bg-gray-100">
                    <td colSpan={3} className="py-2 px-3">
                      <span className="text-white print:text-black font-bold">TOTAIS</span>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-400 print:text-gray-500">-</td>
                    <td className="py-2 px-2 text-center">
                      <span className="text-white print:text-black font-bold">{totalDistance.toFixed(1)}</span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className="text-white print:text-black font-bold">{calculateTotalTime()}</span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className="text-white print:text-black font-bold">{totalFuel.toFixed(1)}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Format Selection - Hidden on print */}
          <div className="space-y-2 print:hidden">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Formato</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setDownloadFormat('txt')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center ${
                  downloadFormat === 'txt'
                    ? 'border-sky-500 bg-sky-500/20 text-sky-400'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="text-lg mb-0.5">📄</div>
                <div className="text-xs font-bold">TXT</div>
              </button>
              <button
                onClick={() => setDownloadFormat('csv')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center ${
                  downloadFormat === 'csv'
                    ? 'border-sky-500 bg-sky-500/20 text-sky-400'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="text-lg mb-0.5">📊</div>
                <div className="text-xs font-bold">CSV</div>
              </button>
              <button
                onClick={() => setDownloadFormat('json')}
                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center ${
                  downloadFormat === 'json'
                    ? 'border-sky-500 bg-sky-500/20 text-sky-400'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="text-lg mb-0.5">🔧</div>
                <div className="text-xs font-bold">JSON</div>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir
            </button>
            <button
              onClick={handleDownload}
              disabled={waypoints.length === 0}
              className="flex-1 py-3 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-sky-500/25 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Baixar
            </button>
          </div>

          {waypoints.length === 0 && (
            <p className="text-center text-xs text-slate-500 print:hidden">
              Adicione waypoints para baixar.
            </p>
          )}

          {/* Print Footer */}
          <div className="hidden print:block text-center text-xs text-gray-500 pt-4 border-t border-gray-300">
            Gerado por SkyFPL em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
          </div>
        </div>
      </div>
    </div>
  );
};