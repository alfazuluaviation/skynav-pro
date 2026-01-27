/**
 * Chart Downloader Service v3
 * Pre-downloads WMS tiles for offline use with:
 * - High-concurrency parallel downloads
 * - Checkpoint/resume support for interrupted downloads
 * - Aggressive retry with proxy rotation
 * - Optimized for speed (target: <5 min per chart)
 */

import { cacheTile, updateLayerMetadata, getCachedTileCount, isLayerCached, getCachedTile } from './tileCache';
import { CHART_LAYERS, ChartLayerId } from '../config/chartLayers';

// WMS URL - Access GeoServer directly
const BASE_WMS_URL = "https://geoaisweb.decea.mil.br/geoserver/wms";

// Multiple CORS proxies for redundancy
const CORS_PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://api.codetabs.com/v1/proxy?quest="
];

// Brazil bounding box
const BRAZIL_BOUNDS = {
  minLat: -34.0,
  maxLat: 6.0,
  minLng: -74.0,
  maxLng: -34.0
};

// Minimum valid tile size (bytes)
const MIN_VALID_TILE_SIZE = 500;

// Checkpoint storage key prefix
const CHECKPOINT_KEY = 'download_checkpoint_';

export interface DownloadStats {
  totalTiles: number;
  downloadedTiles: number;
  failedTiles: number;
  retriedTiles: number;
  skippedTiles: number;
  elapsedSeconds: number;
  estimatedSecondsRemaining: number;
}

interface DownloadCheckpoint {
  layerId: string;
  completedTileKeys: string[];
  totalTiles: number;
  lastUpdated: number;
  zoomLevels: number[];
}

interface TileInfo {
  directUrl: string;
  cacheKey: string;
  zoom: number;
  x: number;
  y: number;
}

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
function tileToBBox(x: number, y: number, zoom: number) {
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
 * Build WMS tile URL
 */
function buildWMSTileUrl(layers: string, x: number, y: number, zoom: number): string {
  const bbox = tileToBBox(x, y, zoom);
  const bboxStr = `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;
  const tileSize = 256;
  
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

  return `${BASE_WMS_URL}?${params.toString()}`;
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
 * Save checkpoint to localStorage
 */
function saveCheckpoint(checkpoint: DownloadCheckpoint): void {
  try {
    localStorage.setItem(CHECKPOINT_KEY + checkpoint.layerId, JSON.stringify(checkpoint));
  } catch (e) {
    console.warn('[ChartDownloader] Failed to save checkpoint:', e);
  }
}

/**
 * Load checkpoint from localStorage
 */
function loadCheckpoint(layerId: string): DownloadCheckpoint | null {
  try {
    const data = localStorage.getItem(CHECKPOINT_KEY + layerId);
    if (data) {
      const checkpoint = JSON.parse(data) as DownloadCheckpoint;
      // Checkpoint valid for 24 hours
      if (Date.now() - checkpoint.lastUpdated < 24 * 60 * 60 * 1000) {
        return checkpoint;
      }
    }
  } catch (e) {
    console.warn('[ChartDownloader] Failed to load checkpoint:', e);
  }
  return null;
}

/**
 * Clear checkpoint
 */
function clearCheckpoint(layerId: string): void {
  try {
    localStorage.removeItem(CHECKPOINT_KEY + layerId);
  } catch (e) {
    // Ignore
  }
}

/**
 * Download a single tile with concurrent proxy attempts
 * Returns immediately when any source succeeds
 */
async function downloadTileFast(
  directUrl: string,
  cacheKey: string,
  layerId: string,
  preferredProxy: number = 0
): Promise<boolean> {
  
  const validateAndCache = async (response: Response): Promise<boolean> => {
    if (!response.ok) return false;
    
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('xml') || contentType.includes('text/html')) {
      return false;
    }
    
    const blob = await response.blob();
    if (!blob.type.startsWith('image/') || blob.size < MIN_VALID_TILE_SIZE) {
      return false;
    }
    
    await cacheTile(cacheKey, blob, layerId);
    return true;
  };

  const fetchWithTimeout = (url: string, timeout: number): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    return fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
  };

  // Use Promise.race to return immediately when any source succeeds
  // This is CRITICAL for performance - we don't wait for all proxies
  const attemptFetch = async (url: string, timeout: number): Promise<boolean> => {
    try {
      const response = await fetchWithTimeout(url, timeout);
      return await validateAndCache(response);
    } catch {
      return false;
    }
  };

  // First, try direct access (fastest)
  try {
    const directSuccess = await attemptFetch(directUrl, 4000);
    if (directSuccess) return true;
  } catch {
    // Continue to proxies
  }

  // Try preferred proxy
  const preferredUrl = `${CORS_PROXIES[preferredProxy]}${encodeURIComponent(directUrl)}`;
  try {
    const proxySuccess = await attemptFetch(preferredUrl, 5000);
    if (proxySuccess) return true;
  } catch {
    // Continue to other proxies
  }

  // Try remaining proxies in parallel with Promise.race (first success wins)
  const remainingProxies = CORS_PROXIES.filter((_, i) => i !== preferredProxy);
  if (remainingProxies.length > 0) {
    const proxyAttempts = remainingProxies.map(proxy => {
      const proxyUrl = `${proxy}${encodeURIComponent(directUrl)}`;
      return attemptFetch(proxyUrl, 6000);
    });

    try {
      // Wait for all and check if any succeeded
      const results = await Promise.all(proxyAttempts);
      if (results.some(r => r)) return true;
    } catch {
      // All failed
    }
  }

  return false;
}

/**
 * Download all tiles for a chart layer with checkpoint/resume support
 * OPTIMIZED: High concurrency, minimal overhead
 */
export async function downloadChartLayer(
  layerId: string,
  onProgress?: (progress: number, stats?: DownloadStats) => void
): Promise<boolean> {
  const config = CHART_LAYERS[layerId as ChartLayerId];
  if (!config) {
    console.error('[ChartDownloader] Unknown layer:', layerId);
    return false;
  }

  const startTime = Date.now();
  const zoomLevels = config.zoomLevels;
  const layersString = config.layers;

  // Generate all tiles
  let allTiles: TileInfo[] = [];
  for (const zoom of zoomLevels) {
    const tiles = getTilesForZoom(zoom);
    for (const tile of tiles) {
      const directUrl = buildWMSTileUrl(layersString, tile.x, tile.y, zoom);
      allTiles.push({ directUrl, cacheKey: directUrl, zoom, ...tile });
    }
  }

  const totalTiles = allTiles.length;
  
  // Load checkpoint - resume from where we left off
  const checkpoint = loadCheckpoint(layerId);
  const completedKeys = new Set<string>(checkpoint?.completedTileKeys || []);
  
  // Filter out already downloaded tiles (from checkpoint or cache)
  let tilesToDownload: TileInfo[] = [];
  let skippedTiles = 0;

  // Quick check: if we have a checkpoint, trust it
  if (checkpoint && checkpoint.completedTileKeys.length > 0) {
    console.log(`[ChartDownloader] Resuming ${layerId}: ${checkpoint.completedTileKeys.length} tiles already done`);
    skippedTiles = checkpoint.completedTileKeys.length;
    tilesToDownload = allTiles.filter(t => !completedKeys.has(t.cacheKey));
  } else {
    // No checkpoint - check cache for each tile (in parallel batches)
    console.log(`[ChartDownloader] Starting fresh download of ${layerId}`);
    
    // Check cache in parallel for speed
    const cacheCheckBatchSize = 50;
    for (let i = 0; i < allTiles.length; i += cacheCheckBatchSize) {
      const batch = allTiles.slice(i, i + cacheCheckBatchSize);
      const results = await Promise.all(
        batch.map(async t => {
          const cached = await getCachedTile(t.cacheKey);
          return { tile: t, cached: cached !== null && cached.size >= MIN_VALID_TILE_SIZE };
        })
      );
      
      for (const { tile, cached } of results) {
        if (cached) {
          completedKeys.add(tile.cacheKey);
          skippedTiles++;
        } else {
          tilesToDownload.push(tile);
        }
      }
    }
  }

  console.log(`[ChartDownloader] ${layerId}: ${tilesToDownload.length} tiles to download, ${skippedTiles} already cached`);

  // Update metadata
  await updateLayerMetadata({
    layerId,
    totalTiles,
    downloadedTiles: skippedTiles,
    lastUpdated: Date.now(),
    status: 'downloading'
  });

  // Report initial progress
  const initialProgress = Math.round((skippedTiles / totalTiles) * 100);
  onProgress?.(initialProgress, {
    totalTiles,
    downloadedTiles: skippedTiles,
    failedTiles: 0,
    retriedTiles: 0,
    skippedTiles,
    elapsedSeconds: 0,
    estimatedSecondsRemaining: 0
  });

  // If all tiles already cached
  if (tilesToDownload.length === 0) {
    console.log(`[ChartDownloader] ${layerId}: All tiles already cached!`);
    clearCheckpoint(layerId);
    await updateLayerMetadata({
      layerId,
      totalTiles,
      downloadedTiles: totalTiles,
      lastUpdated: Date.now(),
      status: 'complete'
    });
    onProgress?.(100);
    return true;
  }

  // High-concurrency download
  // Desktop: 20 concurrent, iOS: 10 concurrent
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const concurrency = isIOS ? 10 : 20;
  
  let downloadedTiles = skippedTiles;
  let failedTiles = 0;
  let lastProgressUpdate = Date.now();
  let lastCheckpointSave = Date.now();
  let preferredProxy = 0;

  console.log(`[ChartDownloader] Device: ${isIOS ? 'iOS' : 'Desktop'}, concurrency=${concurrency}`);

  // Process tiles with controlled concurrency using a semaphore pattern
  const processTile = async (tile: TileInfo): Promise<boolean> => {
    const success = await downloadTileFast(tile.directUrl, tile.cacheKey, layerId, preferredProxy);
    
    if (success) {
      downloadedTiles++;
      completedKeys.add(tile.cacheKey);
    } else {
      failedTiles++;
    }
    
    return success;
  };

  // Chunk the work into concurrent batches
  for (let i = 0; i < tilesToDownload.length; i += concurrency) {
    // Check if we're still online
    if (!navigator.onLine) {
      console.warn('[ChartDownloader] Lost connection - saving checkpoint');
      saveCheckpoint({
        layerId,
        completedTileKeys: Array.from(completedKeys),
        totalTiles,
        lastUpdated: Date.now(),
        zoomLevels
      });
      onProgress?.(Math.round((downloadedTiles / totalTiles) * 100), {
        totalTiles,
        downloadedTiles,
        failedTiles,
        retriedTiles: 0,
        skippedTiles,
        elapsedSeconds: (Date.now() - startTime) / 1000,
        estimatedSecondsRemaining: -1
      });
      return false;
    }

    const batch = tilesToDownload.slice(i, i + concurrency);
    await Promise.all(batch.map(processTile));

    // Update progress (throttled to every 500ms)
    const now = Date.now();
    if (now - lastProgressUpdate >= 500) {
      const elapsedSeconds = (now - startTime) / 1000;
      const tilesProcessed = downloadedTiles - skippedTiles + failedTiles;
      const tilesRemaining = tilesToDownload.length - tilesProcessed;
      const tilesPerSecond = tilesProcessed / elapsedSeconds || 1;
      const estimatedSecondsRemaining = tilesRemaining / tilesPerSecond;
      
      const progress = Math.round((downloadedTiles / totalTiles) * 100);
      onProgress?.(progress, {
        totalTiles,
        downloadedTiles,
        failedTiles,
        retriedTiles: 0,
        skippedTiles,
        elapsedSeconds: Math.round(elapsedSeconds),
        estimatedSecondsRemaining: Math.round(estimatedSecondsRemaining)
      });
      lastProgressUpdate = now;
    }

    // Save checkpoint periodically (every 10 seconds)
    if (now - lastCheckpointSave >= 10000) {
      saveCheckpoint({
        layerId,
        completedTileKeys: Array.from(completedKeys),
        totalTiles,
        lastUpdated: now,
        zoomLevels
      });
      lastCheckpointSave = now;
    }
  }

  // Retry failed tiles once more
  const failedTilesList = tilesToDownload.filter(t => !completedKeys.has(t.cacheKey));
  if (failedTilesList.length > 0 && failedTilesList.length < totalTiles * 0.3) {
    console.log(`[ChartDownloader] Retrying ${failedTilesList.length} failed tiles...`);
    
    // Wait a bit before retry
    await new Promise(r => setTimeout(r, 1000));
    
    // Rotate to different proxy for retry
    preferredProxy = (preferredProxy + 1) % CORS_PROXIES.length;
    
    for (let i = 0; i < failedTilesList.length; i += Math.floor(concurrency / 2)) {
      const batch = failedTilesList.slice(i, i + Math.floor(concurrency / 2));
      const results = await Promise.all(batch.map(t => downloadTileFast(t.directUrl, t.cacheKey, layerId, preferredProxy)));
      
      results.forEach((success, idx) => {
        if (success) {
          downloadedTiles++;
          failedTiles--;
          completedKeys.add(batch[idx].cacheKey);
        }
      });
    }
  }

  // Final stats
  const elapsedSeconds = (Date.now() - startTime) / 1000;
  const successRate = (downloadedTiles / totalTiles) * 100;
  
  console.log(`[ChartDownloader] Complete ${layerId}: ${downloadedTiles}/${totalTiles} (${successRate.toFixed(1)}%) in ${elapsedSeconds.toFixed(0)}s`);

  // Clear checkpoint on success
  if (downloadedTiles >= totalTiles * 0.9) {
    clearCheckpoint(layerId);
  }

  // Update metadata
  const isComplete = downloadedTiles >= totalTiles * 0.9;
  await updateLayerMetadata({
    layerId,
    totalTiles,
    downloadedTiles,
    lastUpdated: Date.now(),
    status: isComplete ? 'complete' : 'error'
  });

  onProgress?.(100, {
    totalTiles,
    downloadedTiles,
    failedTiles: totalTiles - downloadedTiles,
    retriedTiles: 0,
    skippedTiles,
    elapsedSeconds: Math.round(elapsedSeconds),
    estimatedSecondsRemaining: 0
  });

  return isComplete;
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
  hasCheckpoint: boolean;
  checkpointProgress: number;
}> {
  const isDownloaded = await isLayerCached(layerId);
  const tileCount = await getCachedTileCount(layerId);
  const checkpoint = loadCheckpoint(layerId);
  
  return { 
    isDownloaded, 
    tileCount,
    hasCheckpoint: checkpoint !== null,
    checkpointProgress: checkpoint ? Math.round((checkpoint.completedTileKeys.length / checkpoint.totalTiles) * 100) : 0
  };
}

/**
 * Clear download checkpoint (for fresh restart)
 */
export function clearDownloadCheckpoint(layerId: string): void {
  clearCheckpoint(layerId);
}
