/**
 * Chart Downloader Service
 * Pre-downloads WMS tiles for offline use by fetching tiles for key zoom levels
 * and geographic areas of Brazil.
 * Uses a proxy to avoid CORS issues with DECEA GeoServer.
 */

import { cacheTile, updateLayerMetadata, getCachedTileCount, isLayerCached } from './tileCache';

// Supabase edge function URL for WMS proxy
const SUPABASE_URL = "https://gongoqjjpwphhttumdjm.supabase.co";
const WMS_PROXY_URL = `${SUPABASE_URL}/functions/v1/proxy-wms`;

// Brazil bounding box (approximate)
const BRAZIL_BOUNDS = {
  minLat: -34.0,
  maxLat: 6.0,
  minLng: -74.0,
  maxLng: -34.0
};

// Zoom levels to cache for different chart types
const ZOOM_LEVELS = {
  HIGH: [5, 6, 7, 8],
  LOW: [5, 6, 7, 8],
  REA: [6, 7, 8, 9, 10],
  REUL: [7, 8, 9, 10],
  REH: [7, 8, 9, 10],
  WAC: [5, 6, 7, 8]
};

// Layer configurations for downloading
const LAYER_CONFIGS: Record<string, { url: string; layers: string[] }> = {
  HIGH: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: [
      'ICA:CCV_ENRC_S1_ALTA',
      'ICA:CCV_ENRC_S2_ALTA',
      'ICA:CCV_ENRC_S3_ALTA',
      'ICA:CCV_ENRC_S4_ALTA'
    ]
  },
  LOW: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: [
      'ICA:CCV_ENRC_S1_BAIXA',
      'ICA:CCV_ENRC_S2_BAIXA',
      'ICA:CCV_ENRC_S3_BAIXA',
      'ICA:CCV_ENRC_S4_BAIXA'
    ]
  },
  REA: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: [
      'ICA:CCV_REA_WF_RECIFE',
      'ICA:CCV_REA_CY_CUIABA',
      'ICA:CCV_REA_WA_TABATINGA',
      'ICA:CCV_REA_WB_BELEM',
      'ICA:CCV_REA_WG_CAMPO_GRANDE',
      'ICA:CCV_REA_WH_BELO_HORIZONTE',
      'ICA:CCV_REA_WJ1_RIO_DE_JANEIRO',
      'ICA:CCV_REA_WK_PORTO_SEGURO',
      'ICA:CCV_REA_WN2_MANAUS',
      'ICA:CCV_REA_WP_PORTO_ALEGRE',
      'ICA:CCV_REA_WR_BRASILIA',
      'ICA:CCV_REA_WS_SAO_LUIS',
      'ICA:CCV_REA_WX_SANTAREM',
      'ICA:CCV_REA_WZ_FORTALEZA',
      'ICA:CCV_REA_XF_FLORIANOPOLIS',
      'ICA:CCV_REA_XK_MACAPA',
      'ICA:CCV_REA_XN-ANAPOLIS',
      'ICA:CCV_REA_XP1_SAO_PAULO',
      'ICA:CCV_REA_XP2_SAO_PAULO',
      'ICA:CCV_REA_XR_VITORIA',
      'ICA:CCV_REA_XS_SALVADOR',
      'ICA:CCV_REA_XT_NATAL'
    ]
  },
  REUL: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: ['ICA:CCV_REUL_WJ3_RIO_DE_JANEIRO']
  },
  REH: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: [
      'ICA:CCV_REH_WH_BELO_HORIZONTE',
      'ICA:CCV_REH_WJ1_CABO_FRIO',
      'ICA:CCV_REH_WJ2_RIO_DE_JANEIRO',
      'ICA:CCV_REH_WJ3_RIO_DE_JANEIRO',
      'ICA:CCV_REH_XP1_SAO_JOSE_DOS_CAMPOS',
      'ICA:CCV_REH_XP1_SOROCABA',
      'ICA:CCV_REH_XP2_CAMPINAS',
      'ICA:CCV_REH_XP2_SAO_PAULO_1',
      'ICA:CCV_REH_XP2_SAO_PAULO_2',
      'ICA:REH_BACIA_DE_SANTOS',
      'ICA:REH_CURITIBA',
      'ICA:REH_VITORIA'
    ]
  },
  WAC: {
    url: 'https://geoaisweb.decea.mil.br/geoserver/wms',
    layers: [
      'ICA:WAC_2893_BOA_VISTA',
      'ICA:WAC_2894_TUMUCUMAQUE',
      'ICA:WAC_2895_MACAPA',
      'ICA:WAC_2944_FORTALEZA',
      'ICA:WAC_2945_SAO_LUIS',
      'ICA:WAC_2946_BELEM',
      'ICA:WAC_2947_SANTAREM',
      'ICA:WAC_2948_MANAUS',
      'ICA:WAC_2949_SAO_GABRIEL_DA_CACHOEIRA',
      'ICA:WAC_3012_CRUZEIRO_DO_SUL',
      'ICA:WAC_3013_TABATINGA',
      'ICA:WAC_3014_HUMAITA',
      'ICA:WAC_3015_ITAITUBA',
      'ICA:WAC_3016_IMPERATRIZ',
      'ICA:WAC_3017_TERESINA',
      'ICA:WAC_3018_NATAL',
      'ICA:WAC_3019_FERNANDO_DE_NORONHA',
      'ICA:WAC_3066_RECIFE',
      'ICA:WAC_3067_PETROLINA',
      'ICA:WAC_3068_PORTO_NACIONAL',
      'ICA:WAC_3069_CACHIMBO',
      'ICA:WAC_3070_JI_PARANA',
      'ICA:WAC_3071_PORTO_VELHO',
      'ICA:WAC_3072_TARAUACA',
      'ICA:WAC_3137_PRINCIPE_DA_BEIRA',
      'ICA:WAC_3138_CUIABA',
      'ICA:WAC_3139_ARAGARCAS',
      'ICA:WAC_3140_BRASILIA',
      'ICA:WAC_3141_SALVADOR',
      'ICA:WAC_3189_BELO_HORIZONTE',
      'ICA:WAC_3190_GOIANIA',
      'ICA:WAC_3191_RONDONOPOLIS',
      'ICA:WAC_3192_CORUMBA',
      'ICA:WAC_3260_BELA_VISTA',
      'ICA:WAC_3261_CAMPO_GRANDE',
      'ICA:WAC_3262_SAO_PAULO',
      'ICA:WAC_3263_RIO_DE_JANEIRO',
      'ICA:WAC_3313_CURITIBA',
      'ICA:WAC_3314_FOZ_DO_IGUACU',
      'ICA:WAC_3383_URUGUAIANA',
      'ICA:WAC_3384_PORTO_ALEGRE',
      'ICA:WAC_3434_RIO_DA_PRATA'
    ]
  }
};

/**
 * Convert lat/lng to tile coordinates
 */
function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

/**
 * Convert tile coordinates to bounding box
 */
function tileToBBox(x: number, y: number, zoom: number): { minLng: number; minLat: number; maxLng: number; maxLat: number } {
  const n = Math.pow(2, zoom);
  const minLng = x / n * 360 - 180;
  const maxLng = (x + 1) / n * 360 - 180;
  
  const minLatRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)));
  const maxLatRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  
  const minLat = minLatRad * 180 / Math.PI;
  const maxLat = maxLatRad * 180 / Math.PI;
  
  return { minLng, minLat, maxLng, maxLat };
}

/**
 * Build WMS tile URL using proxy to avoid CORS
 */
function buildWMSTileUrl(baseUrl: string, layers: string, x: number, y: number, zoom: number, tileSize: number = 256): string {
  const bbox = tileToBBox(x, y, zoom);
  // WMS 1.1.1 format: BBOX=minx,miny,maxx,maxy
  const bboxStr = `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;
  
  const params = new URLSearchParams({
    service: 'WMS',
    request: 'GetMap',
    layers: layers,
    styles: '',
    format: 'image/png',
    transparent: 'true',
    version: '1.1.1',
    width: tileSize.toString(),
    height: tileSize.toString(),
    srs: 'EPSG:4326',
    bbox: bboxStr
  });

  // Use proxy to avoid CORS issues
  return `${WMS_PROXY_URL}?${params.toString()}`;
}

/**
 * Generate all tile coordinates for a zoom level within Brazil bounds
 */
function getTilesForZoom(zoom: number): Array<{ x: number; y: number }> {
  const minTile = latLngToTile(BRAZIL_BOUNDS.maxLat, BRAZIL_BOUNDS.minLng, zoom);
  const maxTile = latLngToTile(BRAZIL_BOUNDS.minLat, BRAZIL_BOUNDS.maxLng, zoom);
  
  const tiles: Array<{ x: number; y: number }> = [];
  
  for (let x = minTile.x; x <= maxTile.x; x++) {
    for (let y = minTile.y; y <= maxTile.y; y++) {
      tiles.push({ x, y });
    }
  }
  
  return tiles;
}

/**
 * Download a single tile
 */
async function downloadTile(url: string, layerId: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Accept': 'image/png,image/*'
      }
    });

    if (!response.ok) {
      return false;
    }

    const blob = await response.blob();
    
    // Only cache if we got actual image data
    if (blob.size > 0 && blob.type.startsWith('image/')) {
      await cacheTile(url, blob, layerId);
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn('Failed to download tile:', error);
    return false;
  }
}

/**
 * Download all tiles for a chart layer
 */
export async function downloadChartLayer(
  layerId: string,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  const config = LAYER_CONFIGS[layerId];
  if (!config) {
    console.error('Unknown layer:', layerId);
    return false;
  }

  const zoomLevels = ZOOM_LEVELS[layerId as keyof typeof ZOOM_LEVELS] || [6, 7, 8];
  const tileSize = 256; // Use 256 for caching, keeps file sizes reasonable

  // Calculate total tiles
  let allTiles: Array<{ url: string; zoom: number; x: number; y: number }> = [];
  
  for (const zoom of zoomLevels) {
    const tiles = getTilesForZoom(zoom);
    for (const tile of tiles) {
      // For each tile, we need to fetch all layers combined
      const layersStr = config.layers.join(',');
      const url = buildWMSTileUrl(config.url, layersStr, tile.x, tile.y, zoom, tileSize);
      allTiles.push({ url, zoom, ...tile });
    }
  }

  const totalTiles = allTiles.length;
  let downloadedTiles = 0;

  // Update metadata to downloading
  await updateLayerMetadata({
    layerId,
    totalTiles,
    downloadedTiles: 0,
    lastUpdated: Date.now(),
    status: 'downloading'
  });

  // Download in batches to avoid overwhelming the server
  const batchSize = 5;
  
  for (let i = 0; i < allTiles.length; i += batchSize) {
    const batch = allTiles.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (tile) => {
        const success = await downloadTile(tile.url, layerId);
        if (success) {
          downloadedTiles++;
        }
        
        // Report progress
        const progress = Math.round((downloadedTiles / totalTiles) * 100);
        onProgress?.(progress);
      })
    );

    // Small delay between batches to be nice to the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Update metadata to complete
  await updateLayerMetadata({
    layerId,
    totalTiles,
    downloadedTiles,
    lastUpdated: Date.now(),
    status: 'complete'
  });

  return true;
}

/**
 * Check if a layer is available offline
 */
export async function isLayerAvailableOffline(layerId: string): Promise<boolean> {
  return isLayerCached(layerId);
}

/**
 * Get download status for a layer
 */
export async function getLayerDownloadStatus(layerId: string): Promise<{
  isDownloaded: boolean;
  tileCount: number;
}> {
  const isDownloaded = await isLayerCached(layerId);
  const tileCount = await getCachedTileCount(layerId);
  
  return { isDownloaded, tileCount };
}
