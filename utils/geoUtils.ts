// @ts-ignore
import geomagnetism from 'geomagnetism';

const R_NM = 3440.065;

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R_NM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

export const getMagneticDeclination = (lat: number, lng: number): number => {
  try {
    const model = geomagnetism.model();
    const info = model.point([lat, lng]);
    return info.declination;
  } catch (error) {
    console.error("WMM Calculation Error:", error);
    return -24.5; // Safety fallback for NE Brazil
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