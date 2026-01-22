/**
 * Base Map Downloader Service
 * Pre-downloads OSM/CartoDB/OpenTopo tiles for offline use.
 */

import { cacheTile, updateLayerMetadata, isLayerCached } from './tileCache';
import { BASE_MAP_LAYERS, BaseMapLayerId } from '../config/chartLayers';

// Brazil bounding box (approximate)
const BRAZIL_BOUNDS = {
  minLat: -34.0,
  maxLat: 6.0,
  minLng: -74.0,
  maxLng: -34.0
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
 * Generate tile URL for base map
 * Always uses first subdomain for consistent caching
 */
function buildBaseMapTileUrl(baseUrl: string, subdomains: readonly string[], x: number, y: number, zoom: number): string {
  // Esri uses different format: {z}/{y}/{x}
  if (baseUrl.includes('arcgisonline.com')) {
    return baseUrl
      .replace('{z}', zoom.toString())
      .replace('{y}', y.toString())
      .replace('{x}', x.toString());
  }
  
  // Always use first subdomain ('a') for consistent cache keys
  const subdomain = subdomains[0] || '';
  return baseUrl
    .replace('{s}', subdomain)
    .replace('{z}', zoom.toString())
    .replace('{x}', x.toString())
    .replace('{y}', y.toString())
    .replace('{r}', ''); // Retina placeholder
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
 * Download a single tile with retry
 */
async function downloadTile(url: string, layerId: string, retries: number = 2): Promise<boolean> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal
      });
      
      clearTimeout(timeout);

      if (!response.ok) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 300));
          continue;
        }
        return false;
      }

      const blob = await response.blob();
      
      if (blob.size > 0 && blob.type.startsWith('image/')) {
        await cacheTile(url, blob, layerId);
        return true;
      }
      
      return false;
    } catch (error) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 300));
        continue;
      }
      return false;
    }
  }
  return false;
}

/**
 * Download base map tiles for offline use
 */
export async function downloadBaseMapLayer(
  layerId: BaseMapLayerId,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  const config = BASE_MAP_LAYERS[layerId];
  if (!config) {
    console.error('Unknown base map layer:', layerId);
    return false;
  }

  const zoomLevels = config.zoomLevels;
  const baseUrl = config.url;
  const subdomains = config.subdomains;

  // Calculate total tiles
  let allTiles: Array<{ url: string; zoom: number; x: number; y: number }> = [];
  
  for (const zoom of zoomLevels) {
    const tiles = getTilesForZoom(zoom);
    for (const tile of tiles) {
      const url = buildBaseMapTileUrl(baseUrl, subdomains, tile.x, tile.y, zoom);
      allTiles.push({ url, zoom, ...tile });
    }
  }

  const totalTiles = allTiles.length;
  let processedTiles = 0;
  let downloadedTiles = 0;

  console.log(`[BASE MAP] Starting download of ${layerId}: ${totalTiles} tiles across zoom levels ${zoomLevels.join(', ')}`);

  onProgress?.(0);

  await updateLayerMetadata({
    layerId: `BASEMAP_${layerId}`,
    totalTiles,
    downloadedTiles: 0,
    lastUpdated: Date.now(),
    status: 'downloading'
  });

  // Download in batches
  const batchSize = 15;
  
  for (let i = 0; i < allTiles.length; i += batchSize) {
    const batch = allTiles.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (tile) => {
        const success = await downloadTile(tile.url, `BASEMAP_${layerId}`);
        if (success) {
          downloadedTiles++;
        }
        processedTiles++;
        
        const progress = Math.round((processedTiles / totalTiles) * 100);
        onProgress?.(progress);
      })
    );

    await new Promise(resolve => setTimeout(resolve, 30));
  }

  console.log(`[BASE MAP] Download complete for ${layerId}: ${downloadedTiles}/${totalTiles} tiles cached`);

  await updateLayerMetadata({
    layerId: `BASEMAP_${layerId}`,
    totalTiles,
    downloadedTiles,
    lastUpdated: Date.now(),
    status: 'complete'
  });

  return true;
}

/**
 * Check if base map is available offline
 */
export async function isBaseMapAvailableOffline(layerId: BaseMapLayerId): Promise<boolean> {
  return isLayerCached(`BASEMAP_${layerId}`);
}
