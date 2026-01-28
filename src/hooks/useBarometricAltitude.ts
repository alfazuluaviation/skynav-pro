import { useState, useEffect, useCallback, useRef } from 'react';

// ISA (International Standard Atmosphere) constants
const ISA = {
  P0: 1013.25,       // Standard pressure at sea level (hPa)
  T0: 288.15,        // Standard temperature at sea level (K) = 15°C
  L: 0.0065,         // Temperature lapse rate (K/m)
  g: 9.80665,        // Gravitational acceleration (m/s²)
  M: 0.0289644,      // Molar mass of dry air (kg/mol)
  R: 8.31447,        // Universal gas constant (J/(mol·K))
};

// Calculate exponent for barometric formula
const BAROMETRIC_EXPONENT = (ISA.g * ISA.M) / (ISA.R * ISA.L);

export interface AltimeterData {
  // Current altitude in feet (pressure altitude corrected with QNH)
  altitude: number;
  // Pressure altitude (based on 1013.25 hPa)
  pressureAltitude: number;
  // Vertical speed in feet per minute
  verticalSpeed: number;
  // Trend: 'climbing', 'descending', 'level'
  trend: 'climbing' | 'descending' | 'level';
  // QNH setting in hPa
  qnh: number;
  // Data source: 'gps' | 'barometer' | 'simulated'
  source: 'gps' | 'barometer' | 'simulated';
  // Is data valid/fresh
  isValid: boolean;
  // Last update timestamp
  lastUpdate: number;
}

interface UseBarometricAltitudeOptions {
  initialQnh?: number;
  updateInterval?: number; // ms
}

/**
 * Custom hook for barometric altitude calculations
 * Uses GPS altitude as primary source, with aviation-standard corrections
 */
export function useBarometricAltitude(options: UseBarometricAltitudeOptions = {}) {
  const { 
    initialQnh = 1013.25, 
    updateInterval = 1000 
  } = options;

  const [data, setData] = useState<AltimeterData>({
    altitude: 0,
    pressureAltitude: 0,
    verticalSpeed: 0,
    trend: 'level',
    qnh: initialQnh,
    source: 'gps',
    isValid: false,
    lastUpdate: Date.now(),
  });

  // History for vertical speed calculation
  const altitudeHistory = useRef<{ altitude: number; timestamp: number }[]>([]);
  const maxHistoryLength = 10; // Keep last 10 readings for smoothing

  // QNH setting (persisted)
  const [qnh, setQnh] = useState<number>(() => {
    const saved = localStorage.getItem('skyfpl_qnh');
    return saved ? parseFloat(saved) : initialQnh;
  });

  /**
   * Calculate pressure altitude from actual pressure
   * Using the barometric formula: h = (T0/L) * [1 - (P/P0)^(R*L/(g*M))]
   */
  const calculatePressureAltitude = useCallback((pressureHpa: number): number => {
    const ratio = pressureHpa / ISA.P0;
    const altitudeMeters = (ISA.T0 / ISA.L) * (1 - Math.pow(ratio, 1 / BAROMETRIC_EXPONENT));
    return altitudeMeters * 3.28084; // Convert to feet
  }, []);

  /**
   * Apply QNH correction to pressure altitude
   * Standard rule: 1 hPa = 30 feet (approximately)
   */
  const applyQnhCorrection = useCallback((pressureAltitude: number, currentQnh: number): number => {
    const correction = (currentQnh - ISA.P0) * 30; // 30 feet per hPa
    return pressureAltitude + correction;
  }, []);

  /**
   * Calculate vertical speed from altitude history
   * Returns feet per minute (fpm)
   */
  const calculateVerticalSpeed = useCallback((currentAltitude: number): number => {
    const now = Date.now();
    
    // Add current reading to history
    altitudeHistory.current.push({ altitude: currentAltitude, timestamp: now });
    
    // Keep only recent readings (last 10 seconds)
    const cutoff = now - 10000;
    altitudeHistory.current = altitudeHistory.current.filter(h => h.timestamp > cutoff);
    
    if (altitudeHistory.current.length < 2) return 0;
    
    // Calculate rate of change over the history window
    const oldest = altitudeHistory.current[0];
    const newest = altitudeHistory.current[altitudeHistory.current.length - 1];
    
    const deltaAlt = newest.altitude - oldest.altitude;
    const deltaTime = (newest.timestamp - oldest.timestamp) / 1000 / 60; // Convert to minutes
    
    if (deltaTime === 0) return 0;
    
    // Vertical speed in feet per minute, rounded to nearest 50 fpm
    const vs = deltaAlt / deltaTime;
    return Math.round(vs / 50) * 50;
  }, []);

  /**
   * Determine trend from vertical speed
   */
  const getTrend = useCallback((vs: number): 'climbing' | 'descending' | 'level' => {
    if (vs > 100) return 'climbing';
    if (vs < -100) return 'descending';
    return 'level';
  }, []);

  /**
   * Update QNH setting
   */
  const updateQnh = useCallback((newQnh: number) => {
    const clampedQnh = Math.max(950, Math.min(1050, newQnh)); // Valid QNH range
    setQnh(clampedQnh);
    localStorage.setItem('skyfpl_qnh', clampedQnh.toString());
  }, []);

  /**
   * Reset QNH to standard (1013.25 hPa)
   */
  const resetQnhToStandard = useCallback(() => {
    updateQnh(ISA.P0);
  }, [updateQnh]);

  // GPS altitude monitoring
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      console.warn('[Altimeter] Geolocation API not available');
      setData(prev => ({ 
        ...prev, 
        isValid: false,
        source: 'gps',
      }));
      return;
    }

    console.log('[Altimeter] Starting GPS altitude monitoring...');

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { altitude, altitudeAccuracy, latitude, longitude } = position.coords;
        
        console.log('[Altimeter] GPS Position received:', {
          latitude: latitude?.toFixed(6),
          longitude: longitude?.toFixed(6),
          altitude: altitude,
          altitudeAccuracy: altitudeAccuracy,
        });
        
        // Many devices (especially desktop/laptop) don't provide GPS altitude
        if (altitude === null || altitude === undefined) {
          console.warn('[Altimeter] GPS altitude not available from device. This is common on desktop browsers.');
          setData(prev => ({ 
            ...prev, 
            isValid: false,
            source: 'gps',
            lastUpdate: Date.now(),
          }));
          return;
        }

        // GPS altitude is in meters, convert to feet
        const gpsAltitudeFeet = altitude * 3.28084;
        
        console.log('[Altimeter] Altitude calculated:', {
          metersRaw: altitude,
          feetConverted: gpsAltitudeFeet.toFixed(0),
        });
        
        // For GPS altitude, we treat it as if it's already QNH-corrected
        // (GPS provides geometric altitude, not pressure altitude)
        // We apply a simulated pressure altitude for display purposes
        const pressureAlt = gpsAltitudeFeet; // Simplified for GPS source
        const correctedAlt = applyQnhCorrection(pressureAlt, qnh);
        
        const vs = calculateVerticalSpeed(correctedAlt);
        const trend = getTrend(vs);

        setData({
          altitude: Math.round(correctedAlt),
          pressureAltitude: Math.round(pressureAlt),
          verticalSpeed: vs,
          trend,
          qnh,
          source: 'gps',
          isValid: true,
          lastUpdate: Date.now(),
        });
      },
      (error) => {
        console.error('[Altimeter] GPS error:', error.code, error.message);
        setData(prev => ({ 
          ...prev, 
          isValid: false,
          source: 'gps',
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );

    return () => {
      console.log('[Altimeter] Stopping GPS watch');
      navigator.geolocation.clearWatch(watchId);
    };
  }, [qnh, applyQnhCorrection, calculateVerticalSpeed, getTrend]);

  // Update data when QNH changes
  useEffect(() => {
    setData(prev => ({
      ...prev,
      qnh,
      altitude: applyQnhCorrection(prev.pressureAltitude, qnh),
    }));
  }, [qnh, applyQnhCorrection]);

  return {
    data,
    qnh,
    updateQnh,
    resetQnhToStandard,
    standardPressure: ISA.P0,
  };
}

export default useBarometricAltitude;
