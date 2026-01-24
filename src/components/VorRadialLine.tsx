import React, { useEffect, useState, useMemo } from 'react';
import { Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { calculateDistance, calculateBearing, getMagneticDeclination, applyMagneticVariation } from '../utils/geoUtils';
import { NavPoint } from '../services/NavigationDataService';

interface VorRadialLineProps {
  selectedVor: NavPoint | null;
  aircraftPosition: [number, number] | null;
  onClose: () => void;
}

export const VorRadialLine: React.FC<VorRadialLineProps> = ({
  selectedVor,
  aircraftPosition,
  onClose
}) => {
  const map = useMap();
  const [radialData, setRadialData] = useState<{ radial: number; distance: number } | null>(null);

  // Calculate radial and distance in real-time
  useEffect(() => {
    if (!selectedVor || !aircraftPosition) {
      setRadialData(null);
      return;
    }

    const updateRadial = () => {
      // Calculate bearing FROM VOR TO aircraft (this is the radial)
      const trueBearing = calculateBearing(
        selectedVor.lat,
        selectedVor.lng,
        aircraftPosition[0],
        aircraftPosition[1]
      );

      // Get magnetic declination at VOR position
      const magVar = getMagneticDeclination(selectedVor.lat, selectedVor.lng);
      
      // Apply magnetic variation to get magnetic radial
      const magneticRadial = applyMagneticVariation(trueBearing, magVar);

      // Calculate distance
      const distance = calculateDistance(
        selectedVor.lat,
        selectedVor.lng,
        aircraftPosition[0],
        aircraftPosition[1]
      );

      setRadialData({
        radial: magneticRadial,
        distance: distance
      });
    };

    // Initial calculation
    updateRadial();

    // Update every 500ms for real-time tracking
    const interval = setInterval(updateRadial, 500);

    return () => clearInterval(interval);
  }, [selectedVor, aircraftPosition]);

  // Create the info label icon
  const infoLabelIcon = useMemo(() => {
    if (!radialData) return null;

    const radialText = `R${Math.round(radialData.radial).toString().padStart(3, '0')}°`;
    const distanceText = `${radialData.distance.toFixed(1)} NM`;

    return L.divIcon({
      className: 'vor-radial-label',
      html: `
        <div style="
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: linear-gradient(135deg, #22c55e, #15803d);
          color: white;
          padding: 8px 14px;
          border-radius: 8px;
          font-weight: bold;
          font-size: 13px;
          font-family: 'Arial', sans-serif;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          border: 2px solid rgba(255,255,255,0.9);
          text-align: center;
          line-height: 1.3;
        ">
          <div style="font-size: 15px; letter-spacing: 1px; font-weight: 800;">${radialText}</div>
          <div style="font-size: 12px; opacity: 0.95; margin-top: 2px;">${distanceText}</div>
        </div>
      `,
      iconSize: [100, 60],
      iconAnchor: [50, 30]
    });
  }, [radialData]);

  if (!selectedVor || !aircraftPosition || !radialData) {
    return null;
  }

  // Calculate midpoint for label placement
  const midLat = (selectedVor.lat + aircraftPosition[0]) / 2;
  const midLng = (selectedVor.lng + aircraftPosition[1]) / 2;

  // Line positions
  const linePositions: [number, number][] = [
    [selectedVor.lat, selectedVor.lng],
    [aircraftPosition[0], aircraftPosition[1]]
  ];

  return (
    <>
      {/* Dashed green line from VOR to aircraft */}
      <Polyline
        positions={linePositions}
        pathOptions={{
          color: '#22c55e',
          weight: 3,
          opacity: 0.9,
          dashArray: '10, 8',
          lineCap: 'round',
          lineJoin: 'round'
        }}
      />

      {/* Info label at midpoint */}
      {infoLabelIcon && (
        <Marker
          position={[midLat, midLng]}
          icon={infoLabelIcon}
          interactive={false}
          zIndexOffset={3000}
        />
      )}
    </>
  );
};

export default VorRadialLine;
