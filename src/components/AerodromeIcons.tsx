/**
 * Aerodrome Symbol Icons - DECEA Standard
 * Based on official Brazilian aeronautical charts (DECEA/ICA)
 * 
 * AERÓDROMOS PRINCIPAIS (Principal Aerodromes):
 * - Civil ou Civil/Militar: Círculo com marcas de tick + linha diagonal
 * - Militar: Mesmo símbolo com preenchimento diferente
 * 
 * OUTROS AERÓDROMOS (Other Aerodromes):
 * - Civil ou Civil/Militar: Círculo com linha diagonal (sem ticks)
 * - Existência duvidosa: Círculo simples
 * - Heliporto: Círculo com "H"
 * 
 * AUXÍLIOS-RÁDIO (Radio Aids):
 * - VOR: Hexágono (preenchido = compulsório, contorno = a pedido)
 * - VOR/DME: Hexágono com ponto central
 * - NDB: Círculo com pontos radiantes
 * - DME: Quadrado com ponto central
 */

import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

// AERÓDROMO PRINCIPAL - Civil ou Civil/Militar
// Círculo com marcas de tick (4 direções) e linha diagonal
export const PrincipalAerodromeIcon: React.FC<IconProps> = ({ 
  size = 20, 
  strokeColor = '#1e40af',
  strokeWidth = 2 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    {/* Círculo principal */}
    <circle cx="12" cy="12" r="8" fill="white" stroke={strokeColor} strokeWidth={strokeWidth} />
    {/* Marcas de tick nas 4 direções cardeais */}
    <line x1="12" y1="1" x2="12" y2="4" stroke={strokeColor} strokeWidth={strokeWidth} />
    <line x1="12" y1="20" x2="12" y2="23" stroke={strokeColor} strokeWidth={strokeWidth} />
    <line x1="1" y1="12" x2="4" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
    <line x1="20" y1="12" x2="23" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
    {/* Linha diagonal (característica do aeródromo principal) */}
    <line x1="6" y1="18" x2="18" y2="6" stroke={strokeColor} strokeWidth={strokeWidth} />
  </svg>
);

// OUTRO AERÓDROMO - Civil ou Civil/Militar
// Círculo com linha diagonal apenas (sem marcas de tick)
export const OtherAerodromeIcon: React.FC<IconProps> = ({ 
  size = 18, 
  strokeColor = '#1e40af',
  strokeWidth = 2 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    {/* Círculo principal */}
    <circle cx="12" cy="12" r="8" fill="white" stroke={strokeColor} strokeWidth={strokeWidth} />
    {/* Linha diagonal */}
    <line x1="6" y1="18" x2="18" y2="6" stroke={strokeColor} strokeWidth={strokeWidth} />
  </svg>
);

// EXISTÊNCIA DUVIDOSA - Círculo simples
export const DoubtfulAerodromeIcon: React.FC<IconProps> = ({ 
  size = 16, 
  strokeColor = '#1e40af',
  strokeWidth = 2 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" fill="white" stroke={strokeColor} strokeWidth={strokeWidth} />
  </svg>
);

// HELIPORTO - Círculo com "H" central
export const HeliportIcon: React.FC<IconProps> = ({ 
  size = 20, 
  strokeColor = '#1e40af',
  strokeWidth = 2 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" fill="white" stroke={strokeColor} strokeWidth={strokeWidth} />
    {/* Letra H */}
    <path 
      d="M7 6v12M17 6v12M7 12h10" 
      stroke={strokeColor} 
      strokeWidth={strokeWidth} 
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

// VOR - Hexágono (compulsório = preenchido)
export const VORIcon: React.FC<IconProps> = ({ 
  size = 18, 
  color = '#1e40af',
  strokeColor = '#1e40af',
  strokeWidth = 1.5,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <polygon 
      points="12,2 21,7 21,17 12,22 3,17 3,7"
      fill={color}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
    />
  </svg>
);

// VOR On Request - Hexágono contorno apenas
export const VOROnRequestIcon: React.FC<IconProps> = ({ 
  size = 18, 
  strokeColor = '#1e40af',
  strokeWidth = 1.5 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <polygon 
      points="12,2 21,7 21,17 12,22 3,17 3,7"
      fill="white"
      stroke={strokeColor}
      strokeWidth={strokeWidth}
    />
  </svg>
);

// VOR/DME - Hexágono com ponto central
export const VORDMEIcon: React.FC<IconProps> = ({ 
  size = 18, 
  color = '#1e40af',
  strokeColor = '#1e40af',
  strokeWidth = 1.5 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <polygon 
      points="12,2 21,7 21,17 12,22 3,17 3,7"
      fill={color}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
    />
    {/* Ponto central (DME) */}
    <circle cx="12" cy="12" r="3" fill="white" />
  </svg>
);

// NDB - Círculo com pontos radiantes (padrão DECEA)
export const NDBIcon: React.FC<IconProps> = ({ 
  size = 18, 
  strokeColor = '#1e40af',
  strokeWidth = 1.5 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    {/* Círculo central preenchido */}
    <circle cx="12" cy="12" r="5" fill={strokeColor} />
    {/* Pontos radiantes ao redor - padrão NDB */}
    {/* Anel interno de pontos */}
    <circle cx="12" cy="3" r="1.2" fill={strokeColor} />
    <circle cx="12" cy="21" r="1.2" fill={strokeColor} />
    <circle cx="3" cy="12" r="1.2" fill={strokeColor} />
    <circle cx="21" cy="12" r="1.2" fill={strokeColor} />
    <circle cx="5.5" cy="5.5" r="1.2" fill={strokeColor} />
    <circle cx="18.5" cy="18.5" r="1.2" fill={strokeColor} />
    <circle cx="5.5" cy="18.5" r="1.2" fill={strokeColor} />
    <circle cx="18.5" cy="5.5" r="1.2" fill={strokeColor} />
    {/* Anel externo adicional de pontos menores */}
    <circle cx="8" cy="3.5" r="0.8" fill={strokeColor} />
    <circle cx="16" cy="3.5" r="0.8" fill={strokeColor} />
    <circle cx="8" cy="20.5" r="0.8" fill={strokeColor} />
    <circle cx="16" cy="20.5" r="0.8" fill={strokeColor} />
    <circle cx="3.5" cy="8" r="0.8" fill={strokeColor} />
    <circle cx="3.5" cy="16" r="0.8" fill={strokeColor} />
    <circle cx="20.5" cy="8" r="0.8" fill={strokeColor} />
    <circle cx="20.5" cy="16" r="0.8" fill={strokeColor} />
  </svg>
);

// DME - Quadrado com ponto central
export const DMEIcon: React.FC<IconProps> = ({ 
  size = 16, 
  strokeColor = '#1e40af',
  strokeWidth = 1.5 
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <rect x="4" y="4" width="16" height="16" fill="white" stroke={strokeColor} strokeWidth={strokeWidth} />
    <circle cx="12" cy="12" r="2" fill={strokeColor} />
  </svg>
);

// Waypoint/Fix - Triângulo preenchido
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

// ============================================================
// HTML generators for Leaflet divIcon
// ============================================================

// Generate Leaflet divIcon HTML for each type
export const getAerodromeIconHTML = (
  type: 'airport' | 'vor' | 'ndb' | 'fix' | 'heliport' | 'dme',
  kind?: string,
  isPrincipal?: boolean
): string => {
  const color = '#1e40af'; // Azul DECEA
  
  // VOR - Hexágono preenchido
  if (type === 'vor') {
    // Verificar se tem DME
    if (kind?.toLowerCase().includes('dme')) {
      return `<svg width="18" height="18" viewBox="0 0 24 24">
        <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="${color}" stroke="${color}" stroke-width="1.5"/>
        <circle cx="12" cy="12" r="3" fill="white"/>
      </svg>`;
    }
    return `<svg width="18" height="18" viewBox="0 0 24 24">
      <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="${color}" stroke="${color}" stroke-width="1.5"/>
    </svg>`;
  }
  
  // NDB - Círculo com pontos radiantes
  if (type === 'ndb') {
    return `<svg width="18" height="18" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" fill="${color}"/>
      <circle cx="12" cy="3" r="1.2" fill="${color}"/>
      <circle cx="12" cy="21" r="1.2" fill="${color}"/>
      <circle cx="3" cy="12" r="1.2" fill="${color}"/>
      <circle cx="21" cy="12" r="1.2" fill="${color}"/>
      <circle cx="5.5" cy="5.5" r="1.2" fill="${color}"/>
      <circle cx="18.5" cy="18.5" r="1.2" fill="${color}"/>
      <circle cx="5.5" cy="18.5" r="1.2" fill="${color}"/>
      <circle cx="18.5" cy="5.5" r="1.2" fill="${color}"/>
      <circle cx="8" cy="3.5" r="0.8" fill="${color}"/>
      <circle cx="16" cy="3.5" r="0.8" fill="${color}"/>
      <circle cx="8" cy="20.5" r="0.8" fill="${color}"/>
      <circle cx="16" cy="20.5" r="0.8" fill="${color}"/>
      <circle cx="3.5" cy="8" r="0.8" fill="${color}"/>
      <circle cx="3.5" cy="16" r="0.8" fill="${color}"/>
      <circle cx="20.5" cy="8" r="0.8" fill="${color}"/>
      <circle cx="20.5" cy="16" r="0.8" fill="${color}"/>
    </svg>`;
  }
  
  // DME - Quadrado com ponto
  if (type === 'dme') {
    return `<svg width="16" height="16" viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" fill="white" stroke="${color}" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="2" fill="${color}"/>
    </svg>`;
  }
  
  // Fix/Waypoint - Triângulo
  if (type === 'fix') {
    return `<svg width="12" height="12" viewBox="0 0 24 24">
      <polygon points="12,3 22,21 2,21" fill="#0f172a" stroke="#0f172a" stroke-width="1"/>
    </svg>`;
  }
  
  // Heliporto - Círculo com H
  if (type === 'heliport') {
    return `<svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="white" stroke="${color}" stroke-width="2"/>
      <path d="M7 6v12M17 6v12M7 12h10" stroke="${color}" stroke-width="2" stroke-linecap="round" fill="none"/>
    </svg>`;
  }
  
  // Aeródromo
  if (type === 'airport') {
    // Detectar heliporto pelo nome/kind
    if (kind?.toLowerCase().includes('heli') || kind?.toLowerCase().includes('heliport')) {
      return getAerodromeIconHTML('heliport');
    }
    
    // Verificar se é aeródromo principal (prefixo SB = grandes aeroportos)
    // Ou baseado no parâmetro isPrincipal
    if (isPrincipal) {
      // AERÓDROMO PRINCIPAL - Círculo com ticks e linha diagonal
      return `<svg width="22" height="22" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8" fill="white" stroke="${color}" stroke-width="2"/>
        <line x1="12" y1="1" x2="12" y2="4" stroke="${color}" stroke-width="2"/>
        <line x1="12" y1="20" x2="12" y2="23" stroke="${color}" stroke-width="2"/>
        <line x1="1" y1="12" x2="4" y2="12" stroke="${color}" stroke-width="2"/>
        <line x1="20" y1="12" x2="23" y2="12" stroke="${color}" stroke-width="2"/>
        <line x1="6" y1="18" x2="18" y2="6" stroke="${color}" stroke-width="2"/>
      </svg>`;
    }
    
    // OUTRO AERÓDROMO - Círculo com linha diagonal apenas
    return `<svg width="18" height="18" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="white" stroke="${color}" stroke-width="2"/>
      <line x1="6" y1="18" x2="18" y2="6" stroke="${color}" stroke-width="2"/>
    </svg>`;
  }
  
  // Default fallback
  return `<svg width="12" height="12" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="6" fill="white" stroke="${color}" stroke-width="1.5"/>
  </svg>`;
};

// Get icon size for centering the divIcon
export const getIconSize = (
  type: 'airport' | 'vor' | 'ndb' | 'fix' | 'heliport' | 'dme',
  isPrincipal?: boolean
): [number, number] => {
  switch (type) {
    case 'airport':
      return isPrincipal ? [22, 22] : [18, 18];
    case 'heliport':
      return [20, 20];
    case 'vor':
      return [18, 18];
    case 'ndb':
      return [18, 18];
    case 'dme':
      return [16, 16];
    case 'fix':
      return [12, 12];
    default:
      return [12, 12];
  }
};

// Legacy exports for backward compatibility
export const CivilAerodromeIcon = PrincipalAerodromeIcon;
export const MajorAirportIcon = PrincipalAerodromeIcon;
export const SmallAerodromeIcon = OtherAerodromeIcon;
