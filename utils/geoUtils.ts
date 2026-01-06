impimport * as geomag from 'geomag.js';

const R_NM = 3440.065; // Earth radius in nautical miles

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_NM * c;
};

export const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360; // This is True Bearing
};

export const getMagneticDeclination = (lat: number, lng: number, alt: number = 0, date: Date = new Date()): number => {
  // getMagVar returns declination in degrees
  // Altitude is in meters, so convert feet to meters if needed. Assuming alt is already in meters.
  // If your altitude is in feet, convert it: alt_meters = alt_feet * 0.3048
  const declination = geomag.getMagVar(lat, lng, alt, date);
  return declination;
};

export const applyMagneticVariation = (trueBearing: number, magneticVariation: number): number => {
  // Magnetic Bearing = True Bearing - Magnetic Variation
  // Ensure result is between 0 and 360
  return (trueBearing - magneticVariation + 360) % 360;
};

export const formatTime = (hours: number): string => {
  if (!hours || isNaN(hours)) return '--:--';
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};