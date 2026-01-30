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

// Cache of database metadata for logging
interface DBMetadataCache {
  fileName: string;
  bounds: string | null;
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

  return { fileName, bounds, minZoom, maxZoom, tileCount, scheme };
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
export async function getMBTile(
  fileId: string,
  z: number,
  x: number,
  y: number
): Promise<Blob | null> {
  const db = await openDatabase(fileId);
  if (!db) return null;

  // TMS scheme: QGIS exports use TMS where Y is inverted compared to XYZ (Slippy Map).
  // Convert Leaflet's XYZ coordinates to TMS for the database query.

  try {
    // TMS scheme detected: MBTiles from QGIS use TMS where Y is inverted
    // Convert from Leaflet's XYZ (y) to TMS (yTms) for database query
    const yTms = (1 << z) - 1 - y;
    
    const result = db.exec(
      `SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?`,
      [z, x, yTms]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const tileData = result[0].values[0][0] as Uint8Array;
    if (!tileData) return null;

    // Determine MIME type from tile data
    const mimeType = detectImageType(tileData);
    
    return new Blob([tileData], { type: mimeType });
  } catch (error) {
    console.error(`[MBTiles Reader] Error reading tile z=${z} x=${x} y=${y}:`, error);
    return null;
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
