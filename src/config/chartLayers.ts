/**
 * Centralized chart layer configuration
 * This ensures download and display use identical layer strings for cache matching
 */

export const CHART_LAYERS = {
  HIGH: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: 'ICA:ENRC_H1,ICA:ENRC_H2,ICA:ENRC_H3,ICA:ENRC_H4,ICA:ENRC_H5,ICA:ENRC_H6,ICA:ENRC_H7,ICA:ENRC_H8,ICA:ENRC_H9',
    zoomLevels: [5, 6, 7, 8]
  },
  LOW: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: 'ICA:ENRC_L1,ICA:ENRC_L2,ICA:ENRC_L3,ICA:ENRC_L4,ICA:ENRC_L5,ICA:ENRC_L6,ICA:ENRC_L7,ICA:ENRC_L8,ICA:ENRC_L9',
    zoomLevels: [5, 6, 7, 8]
  },
  WAC: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: 'ICA:WAC_2825_CABO_ORANGE,ICA:WAC_2826_MONTE_RORAIMA,ICA:WAC_2827_SERRA_PACARAIMA,ICA:WAC_2892_PICO_DA_NEBLINA,ICA:WAC_2893_BOA_VISTA,ICA:WAC_2894_TUMUCUMAQUE,ICA:WAC_2895_MACAPA,ICA:WAC_2944_FORTALEZA,ICA:WAC_2945_SAO_LUIS,ICA:WAC_2946_BELEM,ICA:WAC_2947_SANTAREM,ICA:WAC_2948_MANAUS,ICA:WAC_2949_SAO_GABRIEL_DA_CACHOEIRA,ICA:WAC_3012_CRUZEIRO_DO_SUL,ICA:WAC_3013_TABATINGA,ICA:WAC_3014_HUMAITA,ICA:WAC_3015_ITAITUBA,ICA:WAC_3016_IMPERATRIZ,ICA:WAC_3017_TERESINA,ICA:WAC_3018_NATAL,ICA:WAC_3019_FERNANDO_DE_NORONHA,ICA:WAC_3066_RECIFE,ICA:WAC_3067_PETROLINA,ICA:WAC_3068_PORTO_NACIONAL,ICA:WAC_3069_CACHIMBO,ICA:WAC_3070_JI_PARANA,ICA:WAC_3071_PORTO_VELHO,ICA:WAC_3072_TARAUACA,ICA:WAC_3137_PRINCIPE_DA_BEIRA,ICA:WAC_3138_CUIABA,ICA:WAC_3139_ARAGARCAS,ICA:WAC_3140_BRASILIA,ICA:WAC_3141_SALVADOR,ICA:WAC_3189_BELO_HORIZONTE,ICA:WAC_3190_GOIANIA,ICA:WAC_3191_RONDONOPOLIS,ICA:WAC_3192_CORUMBA,ICA:WAC_3260_BELA_VISTA,ICA:WAC_3261_CAMPO_GRANDE,ICA:WAC_3262_SAO_PAULO,ICA:WAC_3263_RIO_DE_JANEIRO,ICA:WAC_3313_CURITIBA,ICA:WAC_3314_FOZ_DO_IGUACU,ICA:WAC_3383_URUGUAIANA,ICA:WAC_3384_PORTO_ALEGRE,ICA:WAC_3434_RIO_DA_PRATA',
    zoomLevels: [5, 6, 7, 8]
  },
  REA: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: 'ICA:CCV_REA_WF_RECIFE,ICA:CCV_REA_CY_CUIABA,ICA:CCV_REA_WA_TABATINGA,ICA:CCV_REA_WB_BELEM,ICA:CCV_REA_WG_CAMPO_GRANDE,ICA:CCV_REA_WH_BELO_HORIZONTE,ICA:CCV_REA_WJ1_RIO_DE_JANEIRO,ICA:CCV_REA_WK_PORTO_SEGURO,ICA:CCV_REA_WN2_MANAUS,ICA:CCV_REA_WP_PORTO_ALEGRE,ICA:CCV_REA_WR_BRASILIA,ICA:CCV_REA_WS_SAO_LUIS,ICA:CCV_REA_WX_SANTAREM,ICA:CCV_REA_WZ_FORTALEZA,ICA:CCV_REA_XF_FLORIANOPOLIS,ICA:CCV_REA_XK_MACAPA,ICA:CCV_REA_XN-ANAPOLIS,ICA:CCV_REA_XP1_SAO_PAULO,ICA:CCV_REA_XP2_SAO_PAULO,ICA:CCV_REA_XR_VITORIA,ICA:CCV_REA_XS_SALVADOR,ICA:CCV_REA_XT_NATAL',
    zoomLevels: [6, 7, 8, 9, 10]
  },
  REUL: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: 'ICA:CCV_REUL_WJ3_RIO_DE_JANEIRO',
    zoomLevels: [7, 8, 9, 10]
  },
  REH: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: 'ICA:CCV_REH_WH_BELO_HORIZONTE,ICA:CCV_REH_WJ1_CABO_FRIO,ICA:CCV_REH_WJ2_RIO_DE_JANEIRO,ICA:CCV_REH_WJ3_RIO_DE_JANEIRO,ICA:CCV_REH_XP1_SAO_JOSE_DOS_CAMPOS,ICA:CCV_REH_XP1_SOROCABA,ICA:CCV_REH_XP2_CAMPINAS,ICA:CCV_REH_XP2_SAO_PAULO_1,ICA:CCV_REH_XP2_SAO_PAULO_2,ICA:REH_BACIA_DE_SANTOS,ICA:REH_CURITIBA,ICA:REH_VITORIA',
    zoomLevels: [7, 8, 9, 10]
  }
} as const;

export type ChartLayerId = keyof typeof CHART_LAYERS;

export function getChartConfig(layerId: ChartLayerId) {
  return CHART_LAYERS[layerId];
}

// Base map configurations for offline caching
export const BASE_MAP_LAYERS = {
  OSM: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    zoomLevels: [4, 5, 6, 7, 8],
    label: 'OpenStreetMap'
  },
  DARK: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    zoomLevels: [4, 5, 6, 7, 8],
    label: 'Modo Noturno'
  },
  TOPO: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    zoomLevels: [4, 5, 6, 7],
    label: 'Terreno'
  }
} as const;

export type BaseMapLayerId = keyof typeof BASE_MAP_LAYERS;
