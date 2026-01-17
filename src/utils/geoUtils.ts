// @ts-ignore
import geomagnetism from 'geomagnetism';

const R_NM = 3440.065;

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0; // SAFETY CHECK
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R_NM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0; // SAFETY CHECK
  const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

export const getMagneticDeclination = (lat: number, lng: number): number => {
  // CRITICAL SAFETY CHECK: Avoid crashing if coordinates are null or invalid
  if (lat === undefined || lat === null || lng === undefined || lng === null || isNaN(lat) || isNaN(lng)) {
    console.warn("[WMM] Invalid coordinates, using default declination");
    return -22.5; // Default for Brazil
  }

  try {
    const model = geomagnetism.model();
    if (!model) {
      console.warn("[WMM] Model not available, using default declination");
      return -22.5;
    }
    
    // geomagnetism expects [lat, lng] as array
    const info = model.point([lat, lng]);
    
    if (info && typeof info.decl === 'number') {
      console.log(`[WMM] Declination at (${lat.toFixed(4)}, ${lng.toFixed(4)}): ${info.decl.toFixed(2)}°`);
      return info.decl;
    }
    
    // Try alternative property names
    if (info && typeof info.declination === 'number') {
      console.log(`[WMM] Declination at (${lat.toFixed(4)}, ${lng.toFixed(4)}): ${info.declination.toFixed(2)}°`);
      return info.declination;
    }
    
    console.warn("[WMM] No declination data, using default");
    return -22.5;
  } catch (error) {
    console.error("[WMM] Calculation Error:", error);
    return -22.5;
  }
};

export const applyMagneticVariation = (trueBearing: number, magVar: number): number => {
  return (trueBearing - magVar + 360) % 360;
};

export const formatTime = (hours: number): string => {
  if (!hours || isNaN(hours)) return '--:--';
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};