/**
 * Aerodrome Symbol Icons - DECEA Standard
 * Based on official Brazilian aeronautical charts (DECEA/ICA)
 * 
 * Symbol types:
 * - Civil aerodrome: Circle with radiating lines (spoke pattern)
 * - Aerodrome with services: Filled hexagon/polygon shape
 * - Heliport: "H" symbol inside a circle
 * - Military: Special marking
 * - VOR: Hexagonal compass rose shape
 * - NDB: Circle with dot
 * - Waypoint/Fix: Triangle
 */

import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

// Civil Aerodrome - Circle with radiating spokes (8 lines)
export const CivilAerodromeIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = '#2563eb', 
  strokeColor = '#1e40af',
  strokeWidth = 1.5 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    {/* Outer circle */}
    <circle cx="12" cy="12" r="9" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
    {/* Inner circle */}
    <circle cx="12" cy="12" r="4" fill={color} stroke={strokeColor} strokeWidth={strokeWidth} />
    {/* Radiating spokes (8 directions) */}
    <line x1="12" y1="2" x2="12" y2="7" stroke={strokeColor} strokeWidth={strokeWidth} />
    <line x1="12" y1="17" x2="12" y2="22" stroke={strokeColor} strokeWidth={strokeWidth} />
    <line x1="2" y1="12" x2="7" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
    <line x1="17" y1="12" x2="22" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
    {/* Diagonal spokes */}
    <line x1="4.93" y1="4.93" x2="8.17" y2="8.17" stroke={strokeColor} strokeWidth={strokeWidth} />
    <line x1="15.83" y1="15.83" x2="19.07" y2="19.07" stroke={strokeColor} strokeWidth={strokeWidth} />
    <line x1="4.93" y1="19.07" x2="8.17" y2="15.83" stroke={strokeColor} strokeWidth={strokeWidth} />
    <line x1="15.83" y1="8.17" x2="19.07" y2="4.93" stroke={strokeColor} strokeWidth={strokeWidth} />
  </svg>
);

// Heliport - Circle with "H"
export const HeliportIcon: React.FC<IconProps> = ({ 
  size = 20, 
  color = '#2563eb', 
  strokeColor = '#1e40af',
  strokeWidth = 1.5 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="white" stroke={strokeColor} strokeWidth={strokeWidth} />
    <circle cx="12" cy="12" r="8" fill={color} stroke={strokeColor} strokeWidth={strokeWidth * 0.5} />
    {/* Letter H */}
    <path 
      d="M8 6v12M16 6v12M8 12h8" 
      stroke="white" 
      strokeWidth={2.5} 
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

// Major Airport / IFR Airport - Filled star/polygon shape (like DECEA charts)
export const MajorAirportIcon: React.FC<IconProps> = ({ 
  size = 22, 
  color = '#1e40af', 
  strokeColor = '#1e3a8a',
  strokeWidth = 1 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    {/* Airport symbol - hexagon with inner circle */}
    <polygon 
      points="12,1 22,7 22,17 12,23 2,17 2,7"
      fill={color}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
    />
    <circle cx="12" cy="12" r="3" fill="white" />
  </svg>
);

// Small Aerodrome / Private - Simple circle with center dot
export const SmallAerodromeIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = '#3b82f6', 
  strokeColor = '#1d4ed8',
  strokeWidth = 1.5 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" fill="white" stroke={strokeColor} strokeWidth={strokeWidth} />
    <circle cx="12" cy="12" r="3" fill={color} />
  </svg>
);

// VOR - Hexagonal compass rose
export const VORIcon: React.FC<IconProps> = ({ 
  size = 18, 
  color = '#7c3aed', 
  strokeColor = '#5b21b6',
  strokeWidth = 1.5 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    {/* Hexagon */}
    <polygon 
      points="12,2 21,7 21,17 12,22 3,17 3,7"
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeWidth}
    />
    {/* Inner hexagon */}
    <polygon 
      points="12,6 17,9 17,15 12,18 7,15 7,9"
      fill={color}
      stroke={strokeColor}
      strokeWidth={strokeWidth * 0.5}
    />
    {/* Center point */}
    <circle cx="12" cy="12" r="2" fill="white" />
  </svg>
);

// NDB - Circle with center dot and radiating waves
export const NDBIcon: React.FC<IconProps> = ({ 
  size = 16, 
  color = '#dc2626', 
  strokeColor = '#b91c1c',
  strokeWidth = 1.5 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
    <circle cx="12" cy="12" r="3" fill={color} />
    {/* Small dots around */}
    <circle cx="12" cy="3" r="1.5" fill={strokeColor} />
    <circle cx="12" cy="21" r="1.5" fill={strokeColor} />
    <circle cx="3" cy="12" r="1.5" fill={strokeColor} />
    <circle cx="21" cy="12" r="1.5" fill={strokeColor} />
  </svg>
);

// Waypoint/Fix - Filled triangle
export const WaypointIcon: React.FC<IconProps> = ({ 
  size = 14, 
  color = '#0f172a', 
  strokeColor = '#0f172a',
  strokeWidth = 1 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <polygon 
      points="12,3 22,21 2,21"
      fill={color}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
    />
  </svg>
);

// Generate Leaflet divIcon HTML for each type
export const getAerodromeIconHTML = (
  type: 'airport' | 'vor' | 'ndb' | 'fix' | 'heliport',
  kind?: string
): string => {
  // Determine specific icon based on type and kind
  if (type === 'vor') {
    return `<svg width="16" height="16" viewBox="0 0 24 24">
      <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="none" stroke="#5b21b6" stroke-width="1.5"/>
      <polygon points="12,6 17,9 17,15 12,18 7,15 7,9" fill="#7c3aed" stroke="#5b21b6" stroke-width="0.75"/>
      <circle cx="12" cy="12" r="2" fill="white"/>
    </svg>`;
  }
  
  if (type === 'ndb') {
    return `<svg width="14" height="14" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="none" stroke="#b91c1c" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="3" fill="#dc2626"/>
      <circle cx="12" cy="3" r="1.5" fill="#b91c1c"/>
      <circle cx="12" cy="21" r="1.5" fill="#b91c1c"/>
      <circle cx="3" cy="12" r="1.5" fill="#b91c1c"/>
      <circle cx="21" cy="12" r="1.5" fill="#b91c1c"/>
    </svg>`;
  }
  
  if (type === 'fix') {
    return `<svg width="12" height="12" viewBox="0 0 24 24">
      <polygon points="12,3 22,21 2,21" fill="#0f172a" stroke="#0f172a" stroke-width="1"/>
    </svg>`;
  }
  
  if (type === 'heliport') {
    return `<svg width="18" height="18" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="white" stroke="#1e40af" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="8" fill="#2563eb" stroke="#1e40af" stroke-width="0.75"/>
      <path d="M8 6v12M16 6v12M8 12h8" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    </svg>`;
  }
  
  // Airport - determine subtype based on ICAO prefix or kind
  if (type === 'airport') {
    // Heliports have 'SH' or 'SS' prefixes, or kind contains 'heli'
    if (kind?.toLowerCase().includes('heli') || kind?.toLowerCase().includes('heliport')) {
      return getAerodromeIconHTML('heliport');
    }
    
    // Major airports (international, major hubs) - SB prefix usually
    // For now, use the civil aerodrome symbol for all airports
    // The classic DECEA symbol with spokes
    return `<svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="none" stroke="#1e40af" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="4" fill="#2563eb" stroke="#1e40af" stroke-width="1"/>
      <line x1="12" y1="2" x2="12" y2="7" stroke="#1e40af" stroke-width="1.5"/>
      <line x1="12" y1="17" x2="12" y2="22" stroke="#1e40af" stroke-width="1.5"/>
      <line x1="2" y1="12" x2="7" y2="12" stroke="#1e40af" stroke-width="1.5"/>
      <line x1="17" y1="12" x2="22" y2="12" stroke="#1e40af" stroke-width="1.5"/>
      <line x1="4.93" y1="4.93" x2="8.17" y2="8.17" stroke="#1e40af" stroke-width="1.5"/>
      <line x1="15.83" y1="15.83" x2="19.07" y2="19.07" stroke="#1e40af" stroke-width="1.5"/>
      <line x1="4.93" y1="19.07" x2="8.17" y2="15.83" stroke="#1e40af" stroke-width="1.5"/>
      <line x1="15.83" y1="8.17" x2="19.07" y2="4.93" stroke="#1e40af" stroke-width="1.5"/>
    </svg>`;
  }
  
  // Default fallback
  return `<svg width="12" height="12" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="6" fill="#3b82f6" stroke="#1d4ed8" stroke-width="1.5"/>
  </svg>`;
};

// Get icon size for centering the divIcon
export const getIconSize = (type: 'airport' | 'vor' | 'ndb' | 'fix' | 'heliport'): [number, number] => {
  switch (type) {
    case 'airport':
      return [20, 20];
    case 'heliport':
      return [18, 18];
    case 'vor':
      return [16, 16];
    case 'ndb':
      return [14, 14];
    case 'fix':
      return [12, 12];
    default:
      return [12, 12];
  }
};
