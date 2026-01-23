/**
 * Centralized chart layer configuration
 * This ensures download and display use identical layer strings for cache matching
 * 
 * MULTI-LEVEL STRATEGY (v3):
 * - Download 3 spaced zoom levels per chart (high, mid, low detail)
 * - Each level covers its range + 1 level via overzooming
 * - Provides sharp imagery at all zoom levels with minimal distortion
 * 
 * DECEA ScaleDenominator to Zoom mapping (approximate):
 * - 100,000  → Zoom 9 (highest detail)
 * - 250,000  → Zoom 8
 * - 500,000  → Zoom 7
 * - 1,000,000 → Zoom 6
 * - 2,500,000 → Zoom 5
 * - 5,000,000 → Zoom 4
 * - 7,500,000 → Zoom 3 (lowest detail)
 */

export const CHART_LAYERS = {
  // ENRC HIGH: ScaleDenominator 1,000,000 - 7,500,000 (Zoom ~3-6)
  // Chart designed for very zoomed-out view (national overview)
  HIGH: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: 'ICA:ENRC_H1,ICA:ENRC_H2,ICA:ENRC_H3,ICA:ENRC_H4,ICA:ENRC_H5,ICA:ENRC_H6,ICA:ENRC_H7,ICA:ENRC_H8,ICA:ENRC_H9',
    // Download levels 6, 5, 4 (covers zoom 3-7 with good quality)
    zoomLevels: [6, 5, 4],
    maxNativeZoom: 6,  // Best detail at zoom 6
    minNativeZoom: 4   // Coarsest at zoom 4
  },

  // ENRC LOW: ScaleDenominator 500,000 - 2,500,000 (Zoom ~5-7)
  // Chart designed for regional view
  LOW: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: 'ICA:ENRC_L1,ICA:ENRC_L2,ICA:ENRC_L3,ICA:ENRC_L4,ICA:ENRC_L5,ICA:ENRC_L6,ICA:ENRC_L7,ICA:ENRC_L8,ICA:ENRC_L9',
    // Download levels 7, 6, 5 (covers zoom 4-8 with good quality)
    zoomLevels: [7, 6, 5],
    maxNativeZoom: 7,
    minNativeZoom: 5
  },

  // WAC: ScaleDenominator 250,000 - 5,000,000 (Zoom ~4-8)
  // Wide area chart with broad range
  WAC: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: 'ICA:WAC_2825_CABO_ORANGE,ICA:WAC_2826_MONTE_RORAIMA,ICA:WAC_2827_SERRA_PACARAIMA,ICA:WAC_2892_PICO_DA_NEBLINA,ICA:WAC_2893_BOA_VISTA,ICA:WAC_2894_TUMUCUMAQUE,ICA:WAC_2895_MACAPA,ICA:WAC_2944_FORTALEZA,ICA:WAC_2945_SAO_LUIS,ICA:WAC_2946_BELEM,ICA:WAC_2947_SANTAREM,ICA:WAC_2948_MANAUS,ICA:WAC_2949_SAO_GABRIEL_DA_CACHOEIRA,ICA:WAC_3012_CRUZEIRO_DO_SUL,ICA:WAC_3013_TABATINGA,ICA:WAC_3014_HUMAITA,ICA:WAC_3015_ITAITUBA,ICA:WAC_3016_IMPERATRIZ,ICA:WAC_3017_TERESINA,ICA:WAC_3018_NATAL,ICA:WAC_3019_FERNANDO_DE_NORONHA,ICA:WAC_3066_RECIFE,ICA:WAC_3067_PETROLINA,ICA:WAC_3068_PORTO_NACIONAL,ICA:WAC_3069_CACHIMBO,ICA:WAC_3070_JI_PARANA,ICA:WAC_3071_PORTO_VELHO,ICA:WAC_3072_TARAUACA,ICA:WAC_3137_PRINCIPE_DA_BEIRA,ICA:WAC_3138_CUIABA,ICA:WAC_3139_ARAGARCAS,ICA:WAC_3140_BRASILIA,ICA:WAC_3141_SALVADOR,ICA:WAC_3189_BELO_HORIZONTE,ICA:WAC_3190_GOIANIA,ICA:WAC_3191_RONDONOPOLIS,ICA:WAC_3192_CORUMBA,ICA:WAC_3260_BELA_VISTA,ICA:WAC_3261_CAMPO_GRANDE,ICA:WAC_3262_SAO_PAULO,ICA:WAC_3263_RIO_DE_JANEIRO,ICA:WAC_3313_CURITIBA,ICA:WAC_3314_FOZ_DO_IGUACU,ICA:WAC_3383_URUGUAIANA,ICA:WAC_3384_PORTO_ALEGRE,ICA:WAC_3434_RIO_DA_PRATA',
    // Download levels 8, 6, 4 (covers zoom 3-9 with good quality)
    zoomLevels: [8, 6, 4],
    maxNativeZoom: 8,
    minNativeZoom: 4
  },

  // REA: ScaleDenominator 250,000 - 1,500,000 (Zoom ~4-8)
  // Route chart with medium detail
  REA: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    // NOTE: ICA:CCV_REA_WB_BELEM excluded due to GeoServer ServiceException
    layers: 'ICA:CCV_REA_CY_CUIABA,ICA:CCV_REA_PI-PARINTINS,ICA:CCV_REA_WA_TABATINGA,ICA:CCV_REA_WF_RECIFE,ICA:CCV_REA_WG_CAMPO_GRANDE,ICA:CCV_REA_WH_BELO_HORIZONTE,ICA:CCV_REA_WJ1_RIO_DE_JANEIRO,ICA:CCV_REA_WK_PORTO_SEGURO,ICA:CCV_REA_WN2_MANAUS,ICA:CCV_REA_WP_PORTO_ALEGRE,ICA:CCV_REA_WR_BRASILIA,ICA:CCV_REA_WS_SAO_LUIS,ICA:CCV_REA_WX_SANTAREM,ICA:CCV_REA_WZ_FORTALEZA,ICA:CCV_REA_XF_FLORIANOPOLIS,ICA:CCV_REA_XK_MACAPA,ICA:CCV_REA_XN-ANAPOLIS,ICA:CCV_REA_XP1_SAO_PAULO,ICA:CCV_REA_XP2_SAO_PAULO,ICA:CCV_REA_XR_VITORIA,ICA:CCV_REA_XS_SALVADOR,ICA:CCV_REA_XT_NATAL,ICA:REA_CURITIBA,ICA:REA_LONDRINA,ICA:REA_RIBEIRAO_PRETO',
    // Download levels 8, 6, 5 (covers zoom 4-9 with good quality)
    zoomLevels: [8, 6, 5],
    maxNativeZoom: 8,
    minNativeZoom: 5
  },

  // REUL: ScaleDenominator 250,000 - 1,500,000 (Zoom ~4-8)
  REUL: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: 'ICA:CCV_REUL_WJ3_RIO_DE_JANEIRO',
    // Download levels 8, 6, 5 (covers zoom 4-9 with good quality)
    zoomLevels: [8, 6, 5],
    maxNativeZoom: 8,
    minNativeZoom: 5
  },

  // REH: ScaleDenominator 100,000 - 1,000,000 (Zoom ~5-9)
  // Helicopter chart with highest detail available
  REH: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: 'ICA:CCV_REH_WH_BELO_HORIZONTE,ICA:CCV_REH_WJ1_CABO_FRIO,ICA:CCV_REH_WJ2_RIO_DE_JANEIRO,ICA:CCV_REH_WJ3_RIO_DE_JANEIRO,ICA:CCV_REH_XP1_SAO_JOSE_DOS_CAMPOS,ICA:CCV_REH_XP1_SOROCABA,ICA:CCV_REH_XP2_CAMPINAS,ICA:CCV_REH_XP2_SAO_PAULO_1,ICA:CCV_REH_XP2_SAO_PAULO_2,ICA:REH_BACIA_DE_SANTOS,ICA:REH_CURITIBA,ICA:REH_VITORIA',
    // Download levels 9, 7, 5 (covers zoom 4-10 with good quality)
    zoomLevels: [9, 7, 5],
    maxNativeZoom: 9,
    minNativeZoom: 5
  },

  // ARC: ScaleDenominator 100,000 - 1,000,000 (Zoom ~5-9)
  // Approach chart with highest detail available
  ARC: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: 'ICA:ARC_ACADEMIA,ICA:ARC_AMAZONICA,ICA:ARC_ANAPOLIS,ICA:ARC_BELEM,ICA:ARC_BELO_HORIZONTE,ICA:ARC_BRASILIA,ICA:ARC_CURITIBA_E_FLORIANOPOLIS,ICA:ARC_FORTALEZA,ICA:ARC_FOZ_DO_IGUACU,ICA:ARC_MACAE,ICA:ARC_MANAUS,ICA:ARC_NATAL,ICA:ARC_PORTO_ALEGRE,ICA:ARC_RECIFE,ICA:ARC_RIO_DE_JANEIRO_E_SAO_PAULO,ICA:ARC_SALVADOR,ICA:ARC_SANTA_MARIA,ICA:ARC_VITORIA',
    // Download levels 9, 7, 5 (covers zoom 4-10 with good quality)
    zoomLevels: [9, 7, 5],
    maxNativeZoom: 9,
    minNativeZoom: 5
  }
} as const;

export type ChartLayerId = keyof typeof CHART_LAYERS;

export function getChartConfig(layerId: ChartLayerId) {
  return CHART_LAYERS[layerId];
}

// Base map configurations for offline caching
// MULTI-LEVEL: Download 3 spaced zoom levels for smooth scaling
export const BASE_MAP_LAYERS = {
  OSM: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    zoomLevels: [8, 6, 4],
    maxNativeZoom: 8,
    minNativeZoom: 4,
    label: 'OpenStreetMap'
  },
  DARK: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    zoomLevels: [8, 6, 4],
    maxNativeZoom: 8,
    minNativeZoom: 4,
    label: 'Modo Noturno'
  },
  TOPO: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    zoomLevels: [8, 6, 4],
    maxNativeZoom: 8,
    minNativeZoom: 4,
    label: 'Terreno'
  },
  SATELLITE: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: [''],
    zoomLevels: [8, 6, 4],
    maxNativeZoom: 8,
    minNativeZoom: 4,
    label: 'Satélite'
  }
} as const;

export type BaseMapLayerId = keyof typeof BASE_MAP_LAYERS;
