/**
 * MBTiles Reader Service
 * 
 * Reads tiles from MBTiles files (SQLite format) using sql.js.
 * MBTiles is a specification for storing tiled map data in SQLite databases.
 * 
 * MBTiles Schema:
 * - metadata: name, value pairs for map metadata
 * - tiles: zoom_level, tile_column, tile_row, tile_data (blob)
 * 
 * Note: MBTiles uses TMS tile coordinates where Y is inverted compared to XYZ (Slippy Map).
 */

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { getMBTilesFile, getMBTilesMetadata, getAllMBTilesMetadata } from './mbtilesStorage';
import { getMBTilesConfig } from '../config/mbtilesConfig';

// Bundle the sql.js WASM so MBTiles works offline (no CDN dependency)
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

// Singleton SQL.js instance
let SQL: SqlJsStatic | null = null;

// Cache of open databases (by file ID)
const dbCache: Map<string, Database> = new Map();

// Prevent concurrent tile requests from opening the same DB multiple times.
// Without this, Leaflet can trigger many parallel tile loads, causing repeated
// IndexedDB reads + multiple sql.js Database instances (high memory, slow, flaky on mobile).
const dbOpenPromises: Map<string, Promise<Database | null>> = new Map();

// Feature flag for strict bounds filtering
// When enabled, tiles are only served if the tile's geographic center falls within the MBTiles bounds
// This prevents "patchwork" visual errors where tiles from one subchart incorrectly appear in another region
let strictBoundsEnabled = true;

// Export functions to control strict bounds mode
export function isStrictBoundsEnabled(): boolean {
  return strictBoundsEnabled;
}

export function setStrictBoundsEnabled(enabled: boolean): void {
  strictBoundsEnabled = enabled;
  console.log(`[MBTiles Reader] Strict bounds mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

// Cache of database metadata for logging
interface DBMetadataCache {
  fileName: string;
  bounds: string | null;
  parsedBounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  scheme: string;
}
const dbMetadataCache: Map<string, DBMetadataCache> = new Map();

/**
 * Initialize sql.js (loads WASM)
 */
async function initSQL(): Promise<SqlJsStatic> {
  if (SQL) return SQL;

  console.log('[MBTiles Reader] Initializing sql.js...');
  
  SQL = await initSqlJs({
    // IMPORTANT: Use bundled WASM so offline mode works.
    // sql.js will call locateFile('sql-wasm.wasm')
    locateFile: (file: string) => {
      if (file.endsWith('.wasm')) return sqlWasmUrl;
      return file;
    }
  });

  console.log('[MBTiles Reader] sql.js initialized');
  return SQL;
}

/**
 * Open a MBTiles database and log detailed metadata
 */
async function openDatabase(fileId: string): Promise<Database | null> {
  // Check cache first
  if (dbCache.has(fileId)) {
    return dbCache.get(fileId)!;
  }

  // If an open is already in progress for this file, await it.
  const inflight = dbOpenPromises.get(fileId);
  if (inflight) return inflight;

  const openPromise = (async (): Promise<Database | null> => {
    const sql = await initSQL();
    const fileData = await getMBTilesFile(fileId);

    if (!fileData) {
      console.error(`[MBTiles Reader] ❌ File not found: ${fileId}`);
      return null;
    }

    const fileSizeMB = (fileData.byteLength / 1024 / 1024).toFixed(2);
    console.log(`[MBTiles Reader] 📂 Opening database ${fileId} (${fileSizeMB} MB)`);

    try {
      const db = new sql.Database(new Uint8Array(fileData));
      dbCache.set(fileId, db);

      // Extract and log detailed metadata
      const metadata = extractDatabaseMetadata(db, fileId);
      dbMetadataCache.set(fileId, metadata);

      logDatabaseDetails(fileId, metadata);

      return db;
    } catch (error) {
      console.error(`[MBTiles Reader] ❌ Failed to open database:`, error);
      return null;
    }
  })().finally(() => {
    dbOpenPromises.delete(fileId);
  });

  dbOpenPromises.set(fileId, openPromise);
  return openPromise;
}

/**
 * Parse bounds string "minLng,minLat,maxLng,maxLat" into object
 */
function parseBounds(boundsStr: string | null): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
  if (!boundsStr) return null;
  
  const parts = boundsStr.split(',').map(s => parseFloat(s.trim()));
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  
  return {
    minLng: parts[0],
    minLat: parts[1],
    maxLng: parts[2],
    maxLat: parts[3]
  };
}

/**
 * Convert tile coordinates to geographic center point
 * Returns [lat, lng] of tile center
 */
function getTileCenter(z: number, x: number, y: number): { lat: number; lng: number } {
  const n = Math.pow(2, z);
  // Center of tile
  const lng = ((x + 0.5) / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n)));
  const lat = latRad * (180 / Math.PI);
  return { lat, lng };
}

/**
 * Check if a point is within bounds (with small tolerance for edge tiles)
 */
function isPointInBounds(
  lat: number, 
  lng: number, 
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number }
): boolean {
  // Add small tolerance (0.5 degrees) for tiles on the edge
  const tolerance = 0.5;
  return (
    lng >= bounds.minLng - tolerance &&
    lng <= bounds.maxLng + tolerance &&
    lat >= bounds.minLat - tolerance &&
    lat <= bounds.maxLat + tolerance
  );
}

/**
 * Extract detailed metadata from the database for logging
 */
function extractDatabaseMetadata(db: Database, fileId: string): DBMetadataCache {
  let bounds: string | null = null;
  let scheme = 'unknown';
  let fileName = fileId;
  
  // Get metadata
  try {
    const metaResult = db.exec('SELECT name, value FROM metadata');
    if (metaResult.length > 0) {
      for (const row of metaResult[0].values) {
        const key = String(row[0]).toLowerCase();
        const value = String(row[1]);
        if (key === 'bounds') bounds = value;
        if (key === 'scheme') scheme = value;
        if (key === 'name') fileName = value;
      }
    }
  } catch (e) {
    console.warn(`[MBTiles Reader] Could not read metadata table`);
  }

  // Get actual zoom range from tiles
  let minZoom = 0, maxZoom = 0;
  try {
    const zoomResult = db.exec('SELECT MIN(zoom_level), MAX(zoom_level) FROM tiles');
    if (zoomResult.length > 0 && zoomResult[0].values.length > 0) {
      minZoom = Number(zoomResult[0].values[0][0]) || 0;
      maxZoom = Number(zoomResult[0].values[0][1]) || 0;
    }
  } catch (e) {
    console.warn(`[MBTiles Reader] Could not read zoom levels`);
  }

  // Get tile count
  let tileCount = 0;
  try {
    const countResult = db.exec('SELECT COUNT(*) FROM tiles');
    if (countResult.length > 0 && countResult[0].values.length > 0) {
      tileCount = Number(countResult[0].values[0][0]) || 0;
    }
  } catch (e) {
    console.warn(`[MBTiles Reader] Could not count tiles`);
  }

  // Parse bounds for geographic filtering
  const parsedBounds = parseBounds(bounds);

  return { fileName, bounds, parsedBounds, minZoom, maxZoom, tileCount, scheme };
}

/**
 * Log detailed database information for debugging
 */
function logDatabaseDetails(fileId: string, meta: DBMetadataCache): void {
  console.log(`[MBTiles Reader] ════════════════════════════════════════`);
  console.log(`[MBTiles Reader] 📊 Database: ${meta.fileName}`);
  console.log(`[MBTiles Reader]    FileID: ${fileId}`);
  console.log(`[MBTiles Reader]    Bounds: ${meta.bounds || 'not set'}`);
  console.log(`[MBTiles Reader]    Zoom Range: ${meta.minZoom} - ${meta.maxZoom}`);
  console.log(`[MBTiles Reader]    Tile Count: ${meta.tileCount.toLocaleString()}`);
  console.log(`[MBTiles Reader]    Metadata Scheme: ${meta.scheme}`);
  console.log(`[MBTiles Reader]    ⚡ Using: TMS (Y inverted for QGIS exports)`);
  console.log(`[MBTiles Reader] ════════════════════════════════════════`);
}

/**
 * Get a tile from MBTiles as Blob
 * 
 * IMPORTANT: Uses XYZ scheme directly (no TMS conversion).
 * QGIS exports tiles in XYZ format where tile_row = Y directly.
 */
/**
 * Get a tile from MBTiles as Blob
 * 
 * IMPORTANT: Uses XYZ scheme directly (no TMS conversion).
 * QGIS exports tiles in XYZ format where tile_row = Y directly.
 * 
 * Includes automatic retry with 50ms delay for resilience.
 */
export async function getMBTile(
  fileId: string,
  z: number,
  x: number,
  y: number,
  retryCount: number = 0
): Promise<Blob | null> {
  const db = await openDatabase(fileId);
  if (!db) {
    // Database not ready - retry once after short delay
    if (retryCount === 0) {
      await delay(50);
      return getMBTile(fileId, z, x, y, 1);
    }
    return null;
  }

  try {
    // TMS scheme: QGIS exports use TMS where Y is inverted compared to XYZ (Slippy Map).
    // Convert from Leaflet's XYZ (y) to TMS (yTms) for database query
    const yTms = (1 << z) - 1 - y;
    
    const result = db.exec(
      `SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?`,
      [z, x, yTms]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      // Log tile miss for debugging - detailed log for first failures
      const logKey = `miss_${fileId}_${z}_${x}_${y}`;
      if (!tileQueryLog.has(logKey)) {
        tileQueryLog.add(logKey);
        
        // Log detailed miss info (first 30 per session)
        if (tileQueryLog.size <= 30) {
          const cachedMeta = dbMetadataCache.get(fileId);
          console.debug(
            `[MBTiles] 🔍 Tile MISS: z=${z} x=${x} y=${y} (yTms=${yTms}) | ` +
            `File: ${cachedMeta?.fileName || fileId} | ` +
            `Bounds: ${cachedMeta?.bounds || 'unknown'}`
          );
        }
        
        // Limit log size
        if (tileQueryLog.size > 1000) {
          tileQueryLog.clear();
        }
      }
      return null;
    }

    const tileData = result[0].values[0][0] as Uint8Array;
    if (!tileData || tileData.length === 0) {
      console.warn(`[MBTiles] ⚠️ Empty tile data at z=${z} x=${x} yTms=${yTms} from ${fileId}`);
      return null;
    }

    // Log successful tile retrieval for debugging (first 10 per file)
    const successKey = `hit_${fileId}`;
    if (!tileHitCount.has(successKey)) {
      tileHitCount.set(successKey, 0);
    }
    const hitCount = tileHitCount.get(successKey)!;
    if (hitCount < 10) {
      console.log(`[MBTiles] ✅ Tile HIT: z=${z} x=${x} yTms=${yTms} from ${fileId} (${tileData.length} bytes)`);
      tileHitCount.set(successKey, hitCount + 1);
    }

    // Determine MIME type from tile data
    const mimeType = detectImageType(tileData);
    
    return new Blob([tileData], { type: mimeType });
  } catch (error) {
    // Retry once on query error with 50ms delay
    if (retryCount === 0) {
      console.debug(`[MBTiles] ⚡ Retrying tile z=${z} x=${x} y=${y} after error...`);
      await delay(50);
      return getMBTile(fileId, z, x, y, 1);
    }
    console.error(`[MBTiles] ❌ Error reading tile z=${z} x=${x} y=${y} after retry:`, error);
    return null;
  }
}

/**
 * Utility function for delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Track logged tile queries to avoid spam
const tileQueryLog = new Set<string>();
const tileHitCount = new Map<string, number>();
const boundsRejectLog = new Set<string>();
const multiHitLog = new Set<string>();

/**
 * Get tile with geographic bounds validation
 * 
 * This function checks if the tile's geographic center falls within the MBTiles bounds
 * before returning it. This prevents "patchwork" errors where tiles from one subchart
 * incorrectly appear in another region.
 * 
 * @returns { blob, fileId, rejected } - blob is null if not found or rejected by bounds
 */
export async function getMBTileWithBoundsCheck(
  fileId: string,
  z: number,
  x: number,
  y: number
): Promise<{ blob: Blob | null; rejected: boolean; reason?: string }> {
  // Get cached metadata for bounds check
  const cachedMeta = dbMetadataCache.get(fileId);
  
  // If strict bounds is enabled and we have bounds, check geographic validity
  if (strictBoundsEnabled && cachedMeta?.parsedBounds) {
    const tileCenter = getTileCenter(z, x, y);
    
    if (!isPointInBounds(tileCenter.lat, tileCenter.lng, cachedMeta.parsedBounds)) {
      // Log rejection (first 20 per session)
      const rejectKey = `${fileId}_${z}_${x}_${y}`;
      if (!boundsRejectLog.has(rejectKey) && boundsRejectLog.size < 20) {
        boundsRejectLog.add(rejectKey);
        console.debug(
          `[MBTiles] 🚫 BOUNDS REJECT: z=${z} x=${x} y=${y} | ` +
          `File: ${cachedMeta.fileName} | ` +
          `TileCenter: (${tileCenter.lat.toFixed(3)}, ${tileCenter.lng.toFixed(3)}) | ` +
          `Bounds: [${cachedMeta.bounds}]`
        );
      }
      return { blob: null, rejected: true, reason: 'outside_bounds' };
    }
  }
  
  // Tile is within bounds (or bounds check disabled) - fetch it
  const blob = await getMBTile(fileId, z, x, y);
  return { blob, rejected: false };
}

/**
 * Get cached metadata for a file (for external bounds checking)
 */
export function getCachedMetadata(fileId: string): DBMetadataCache | undefined {
  return dbMetadataCache.get(fileId);
}

/**
 * Log multi-hit detection (when multiple files return tiles for same coordinates)
 */
export function logMultiHit(z: number, x: number, y: number, fileIds: string[]): void {
  const hitKey = `${z}_${x}_${y}`;
  if (!multiHitLog.has(hitKey) && multiHitLog.size < 30) {
    multiHitLog.add(hitKey);
    const fileNames = fileIds.map(id => {
      const meta = dbMetadataCache.get(id);
      return meta?.fileName || id.split('_').pop();
    });
    console.warn(
      `[MBTiles] ⚠️ MULTI-HIT: z=${z} x=${x} y=${y} | ` +
      `${fileIds.length} files have this tile: ${fileNames.join(', ')}`
    );
  }
}

/**
 * Get tile as Data URL (for image src)
 */
export async function getMBTileAsDataUrl(
  fileId: string,
  z: number,
  x: number,
  y: number
): Promise<string | null> {
  const blob = await getMBTile(fileId, z, x, y);
  if (!blob) return null;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Get MBTiles metadata
 */
export async function getMBTilesDatabaseMetadata(fileId: string): Promise<Record<string, string> | null> {
  const db = await openDatabase(fileId);
  if (!db) return null;

  try {
    const result = db.exec('SELECT name, value FROM metadata');
    if (result.length === 0) return null;

    const metadata: Record<string, string> = {};
    for (const row of result[0].values) {
      metadata[row[0] as string] = row[1] as string;
    }
    return metadata;
  } catch (error) {
    console.error(`[MBTiles Reader] Error reading metadata:`, error);
    return null;
  }
}

/**
 * Get tile count for a zoom level
 */
export async function getTileCount(fileId: string, zoom?: number): Promise<number> {
  const db = await openDatabase(fileId);
  if (!db) return 0;

  try {
    const query = zoom !== undefined
      ? `SELECT COUNT(*) FROM tiles WHERE zoom_level = ?`
      : 'SELECT COUNT(*) FROM tiles';
    
    const params = zoom !== undefined ? [zoom] : [];
    const result = db.exec(query, params);

    if (result.length === 0 || result[0].values.length === 0) return 0;
    return result[0].values[0][0] as number;
  } catch (error) {
    console.error(`[MBTiles Reader] Error counting tiles:`, error);
    return 0;
  }
}

/**
 * Get available zoom levels
 */
export async function getAvailableZoomLevels(fileId: string): Promise<number[]> {
  const db = await openDatabase(fileId);
  if (!db) return [];

  try {
    const result = db.exec('SELECT DISTINCT zoom_level FROM tiles ORDER BY zoom_level');
    if (result.length === 0) return [];
    
    return result[0].values.map(row => row[0] as number);
  } catch (error) {
    console.error(`[MBTiles Reader] Error getting zoom levels:`, error);
    return [];
  }
}

/**
 * Check if MBTiles is available for offline use
 * Checks if there are any complete MBTiles files for the given chartId
 */
export async function isMBTilesReady(chartId: string): Promise<boolean> {
  const config = getMBTilesConfig(chartId);
  if (!config) {
    console.log(`[MBTiles Reader] No config for chartId: ${chartId}`);
    return false;
  }

  // Check for any complete MBTiles files with this chartId
  const allMetadata = await getAllMBTilesMetadata();
  const hasCompleteFiles = allMetadata.some(m => 
    m.chartId === chartId &&
    m.status === 'complete' &&
    m.totalSize > 0 &&
    m.fileName?.toLowerCase().endsWith('.mbtiles')
  );
  
  console.log(`[MBTiles Reader] isMBTilesReady(${chartId}): found ${allMetadata.filter(m => m.chartId === chartId).length} files, complete: ${hasCompleteFiles}`);
  
  return hasCompleteFiles;
}

/**
 * Get all available MBTiles file IDs for a chart
 */
export async function getMBTilesFileIds(chartId: string): Promise<string[]> {
  const allMetadata = await getAllMBTilesMetadata();
  const fileIds = allMetadata
    .filter(m => m.chartId === chartId && m.status === 'complete' && m.totalSize > 0 && m.fileName?.toLowerCase().endsWith('.mbtiles'))
    .map(m => m.id);
  
  console.log(`[MBTiles Reader] getMBTilesFileIds(${chartId}): ${fileIds.length} files found`);
  return fileIds;
}

/**
 * Close and cleanup database
 */
export function closeDatabase(fileId: string): void {
  const db = dbCache.get(fileId);
  if (db) {
    db.close();
    dbCache.delete(fileId);
    console.log(`[MBTiles Reader] Closed database ${fileId}`);
  }
}

/**
 * Close all open databases
 */
export function closeAllDatabases(): void {
  for (const [fileId, db] of dbCache.entries()) {
    db.close();
    console.log(`[MBTiles Reader] Closed database ${fileId}`);
  }
  dbCache.clear();
  dbMetadataCache.clear();
  tileQueryLog.clear();
  tileHitCount.clear();
}

/**
 * Close and clear all databases for a specific chart
 * This MUST be called when deleting a chart's MBTiles files
 */
export function closeDatabasesForChart(chartId: string): void {
  const toClose: string[] = [];
  
  for (const fileId of dbCache.keys()) {
    // Match files belonging to this chart (e.g., ENRC_LOW_MBTILES_*)
    if (fileId.includes(chartId) || fileId.startsWith(`ENRC_LOW_MBTILES`)) {
      toClose.push(fileId);
    }
  }
  
  for (const fileId of toClose) {
    const db = dbCache.get(fileId);
    if (db) {
      db.close();
      dbCache.delete(fileId);
      dbMetadataCache.delete(fileId);
      console.log(`[MBTiles Reader] 🗑️ Closed and removed database: ${fileId}`);
    }
  }
  
  // Clear tile logs to allow fresh logging after re-download
  tileQueryLog.clear();
  tileHitCount.clear();
  
  console.log(`[MBTiles Reader] ✅ Cleared ${toClose.length} databases for chart: ${chartId}`);
}

/**
 * Detect image type from magic bytes
 */
function detectImageType(data: Uint8Array): string {
  if (data.length < 4) return 'image/png';

  // PNG magic bytes: 137 80 78 71
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    return 'image/png';
  }

  // JPEG magic bytes: 255 216 255
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    return 'image/jpeg';
  }

  // WebP magic bytes: RIFF....WEBP
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
    return 'image/webp';
  }

  // Default to PNG
  return 'image/png';
}
