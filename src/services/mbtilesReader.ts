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

// Singleton SQL.js instance
let SQL: SqlJsStatic | null = null;

// Cache of open databases (by file ID)
const dbCache: Map<string, Database> = new Map();

/**
 * Initialize sql.js (loads WASM)
 */
async function initSQL(): Promise<SqlJsStatic> {
  if (SQL) return SQL;

  console.log('[MBTiles Reader] Initializing sql.js...');
  
  SQL = await initSqlJs({
    // Load WASM from CDN for simplicity
    // In production, this should be bundled with the app
    locateFile: (file: string) => `https://sql.js.org/dist/${file}`
  });

  console.log('[MBTiles Reader] sql.js initialized');
  return SQL;
}

/**
 * Open a MBTiles database
 */
async function openDatabase(fileId: string): Promise<Database | null> {
  // Check cache first
  if (dbCache.has(fileId)) {
    return dbCache.get(fileId)!;
  }

  const sql = await initSQL();
  const fileData = await getMBTilesFile(fileId);

  if (!fileData) {
    console.error(`[MBTiles Reader] File not found: ${fileId}`);
    return null;
  }

  console.log(`[MBTiles Reader] Opening database ${fileId} (${(fileData.byteLength / 1024 / 1024).toFixed(2)} MB)`);

  try {
    const db = new sql.Database(new Uint8Array(fileData));
    dbCache.set(fileId, db);
    return db;
  } catch (error) {
    console.error(`[MBTiles Reader] Failed to open database:`, error);
    return null;
  }
}

/**
 * Convert XYZ tile coordinates to TMS (used by MBTiles)
 * TMS has inverted Y axis: tmsY = (2^zoom - 1) - xyzY
 */
function xyzToTms(x: number, y: number, z: number): { x: number; y: number; z: number } {
  const tmsY = Math.pow(2, z) - 1 - y;
  return { x, y: tmsY, z };
}

/**
 * Get a tile from MBTiles as Blob
 */
export async function getMBTile(
  fileId: string,
  z: number,
  x: number,
  y: number
): Promise<Blob | null> {
  const db = await openDatabase(fileId);
  if (!db) return null;

  // Convert XYZ to TMS coordinates
  const tms = xyzToTms(x, y, z);

  try {
    const result = db.exec(
      `SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?`,
      [tms.z, tms.x, tms.y]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const tileData = result[0].values[0][0] as Uint8Array;
    if (!tileData) return null;

    // Determine MIME type from tile data
    // MBTiles typically stores PNG or JPEG tiles
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
    m.chartId === chartId && m.status === 'complete'
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
    .filter(m => m.chartId === chartId && m.status === 'complete' && m.totalSize > 0)
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
