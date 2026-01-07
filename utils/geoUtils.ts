import geomagnetism from 'geomagnetism';

const R_NM = 3440.065; // Earth radius in nautical miles

/**
 * Calculates the great-circle distance between two points in Nautical Miles.
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_NM * c;
};

/**
 * Calculates the True Bearing (True Track) between two points.
 */
export const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360; 
};

/**
 * Calculates the Magnetic Declination using the World Magnetic Model (WMM).
 * This replaces the approximate fallback of -24.5 with real-time geodetic data.
 */
export const getMagneticDeclination = (lat: number, lng: number): number => {
  try {
    // Initialize the WMM model for current date and location
    const model = geomagnetism.model();
    const info = model.point([lat, lng]);
    
    // Returns the calculated declination in degrees
    return info.declination;
  } catch (error) {
    console.error("Magnetic model error:", error);
    // Safety fallback to average NE Brazil variation if the library fails
    return -24.5;
  }
};

/**
 * Applies magnetic variation to a true bearing to get the magnetic track.
 */
export const applyMagneticVariation = (trueBearing: number, magneticVariation: number): number => {
  // Magnetic Bearing = True Bearing - Magnetic Variation
  return (trueBearing - magneticVariation + 360) % 360;
};

/**
 * Formats decimal hours into HH:mm format for ETE/ETA displays.
 */
export const formatTime = (hours: number): string => {
  if (!hours || isNaN(hours)) return '--:--';
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};