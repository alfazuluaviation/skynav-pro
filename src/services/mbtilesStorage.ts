/**
 * MBTiles Storage Service
 * 
 * Handles storage of MBTiles files using:
 * - IndexedDB for web/PWA (default)
 * - Capacitor Filesystem for native apps (Android/iOS)
 * 
 * Files are stored as ArrayBuffer chunks for efficient memory usage.
 * This service is ISOLATED from the existing tile cache system.
 */

import { MBTILES_CONSTANTS } from '../config/mbtilesConfig';
import { isCapacitorNative } from '../utils/environment';
import * as nativeStorage from './nativeStorage';

const { DB_NAME, DB_VERSION, STORE_NAME, METADATA_STORE, CHUNKS_STORE, CHUNK_SIZE } = MBTILES_CONSTANTS;

// Directory for MBTiles files in native storage
const MBTILES_DIR = 'mbtiles';

interface MBTilesMetadata {
  id: string;
  chartId: string;
  fileName: string;
  totalSize: number;
  totalChunks: number;
  downloadedAt: number;
  version: string;
  manifestData: ManifestData | null;
  status: 'downloading' | 'complete' | 'error';
}

export interface MBTilesChartStatus {
  chartId: string;
  /** True when all files listed in manifest are present; if no manifest, true when at least one .mbtiles file exists */
  isComplete: boolean;
  availableMbtilesFiles: string[];
  expectedMbtilesFiles?: string[];
  missingMbtilesFiles?: string[];
}

interface ManifestData {
  files: string[];
  version: string;
  created: string;
  description?: string;
}

interface MBTilesChunk {
  id: string; // format: `${fileId}_chunk_${index}`
  fileId: string;
  chunkIndex: number;
  data: ArrayBuffer;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Open or create the MBTiles IndexedDB database
 * This is SEPARATE from the main tile cache database
 */
async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for complete mbtiles files (for smaller files)
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }

      // Store for file metadata
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: 'id' });
      }

      // Store for file chunks (for large files)
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        const chunkStore = db.createObjectStore(CHUNKS_STORE, { keyPath: 'id' });
        chunkStore.createIndex('fileId', 'fileId', { unique: false });
      }
    };
  });
}

/**
 * Store MBTiles file
 * - Native: Uses Capacitor Filesystem
 * - Web: Uses IndexedDB chunks
 */
export async function storeMBTilesFile(
  fileId: string,
  chartId: string,
  fileName: string,
  data: ArrayBuffer,
  manifestData: ManifestData | null = null
): Promise<void> {
  const totalSize = data.byteLength;
  console.log(`[MBTiles Storage] Storing ${fileName} (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);

  // Use native storage for Capacitor
  if (isCapacitorNative()) {
    await storeNativeMBTilesFile(fileId, chartId, fileName, data, manifestData);
    return;
  }

  // Web/PWA: Use IndexedDB
  await storeIndexedDBMBTilesFile(fileId, chartId, fileName, data, manifestData);
}

/**
 * Store MBTiles file in native filesystem (Capacitor)
 */
async function storeNativeMBTilesFile(
  fileId: string,
  chartId: string,
  fileName: string,
  data: ArrayBuffer,
  manifestData: ManifestData | null = null
): Promise<void> {
  // Ensure directory exists
  await nativeStorage.ensureDirectory(MBTILES_DIR);
  
  // Write the actual file
  const filePath = `${MBTILES_DIR}/${fileName}`;
  const success = await nativeStorage.writeFile(filePath, data);
  
  if (!success) {
    throw new Error(`Failed to write MBTiles file: ${fileName}`);
  }
  
  // Store metadata in a JSON file
  const metadata: MBTilesMetadata = {
    id: fileId,
    chartId,
    fileName,
    totalSize: data.byteLength,
    totalChunks: 1, // Native stores as single file
    downloadedAt: Date.now(),
    version: manifestData?.version || 'unknown',
    manifestData,
    status: 'complete'
  };
  
  const metadataPath = `${MBTILES_DIR}/${fileId}_metadata.json`;
  await nativeStorage.writeFile(metadataPath, JSON.stringify(metadata), 'utf8');
  
  console.log(`[MBTiles Storage] Native file stored: ${fileName}`);
}

/**
 * Store MBTiles file in IndexedDB (as chunks for large files)
 */
async function storeIndexedDBMBTilesFile(
  fileId: string,
  chartId: string,
  fileName: string,
  data: ArrayBuffer,
  manifestData: ManifestData | null = null
): Promise<void> {
  const db = await openDatabase();
  const totalSize = data.byteLength;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

  // Store metadata first
  const metadata: MBTilesMetadata = {
    id: fileId,
    chartId,
    fileName,
    totalSize,
    totalChunks,
    downloadedAt: Date.now(),
    version: manifestData?.version || 'unknown',
    manifestData,
    status: 'downloading'
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(METADATA_STORE, 'readwrite');
    const store = transaction.objectStore(METADATA_STORE);
    const request = store.put(metadata);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Store file in chunks
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const chunkData = data.slice(start, end);

    const chunk: MBTilesChunk = {
      id: `${fileId}_chunk_${i}`,
      fileId,
      chunkIndex: i,
      data: chunkData
    };

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(CHUNKS_STORE, 'readwrite');
      const store = transaction.objectStore(CHUNKS_STORE);
      const request = store.put(chunk);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`[MBTiles Storage] Stored chunk ${i + 1}/${totalChunks}`);
  }

  // Update metadata status to complete
  metadata.status = 'complete';
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(METADATA_STORE, 'readwrite');
    const store = transaction.objectStore(METADATA_STORE);
    const request = store.put(metadata);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  console.log(`[MBTiles Storage] Successfully stored ${fileName}`);
}

/**
 * Retrieve MBTiles file
 * - Native: Reads from Capacitor Filesystem
 * - Web: Reads from IndexedDB chunks
 */
export async function getMBTilesFile(fileId: string): Promise<ArrayBuffer | null> {
  // Use native storage for Capacitor
  if (isCapacitorNative()) {
    return getNativeMBTilesFile(fileId);
  }
  
  // Web/PWA: Use IndexedDB
  return getIndexedDBMBTilesFile(fileId);
}

/**
 * Retrieve MBTiles file from native filesystem
 */
async function getNativeMBTilesFile(fileId: string): Promise<ArrayBuffer | null> {
  const metadata = await getMBTilesMetadata(fileId);
  if (!metadata || metadata.status !== 'complete') {
    console.log(`[MBTiles Storage] Native file ${fileId} not found or incomplete`);
    return null;
  }
  
  const filePath = `${MBTILES_DIR}/${metadata.fileName}`;
  const data = await nativeStorage.readFile(filePath);
  
  if (data) {
    console.log(`[MBTiles Storage] Native file loaded: ${metadata.fileName} (${(data.byteLength / 1024 / 1024).toFixed(2)} MB)`);
  }
  
  return data;
}

/**
 * Retrieve MBTiles file from IndexedDB
 */
async function getIndexedDBMBTilesFile(fileId: string): Promise<ArrayBuffer | null> {
  const db = await openDatabase();

  // Get metadata first
  const metadata = await getMBTilesMetadata(fileId);
  if (!metadata || metadata.status !== 'complete') {
    console.log(`[MBTiles Storage] File ${fileId} not found or incomplete`);
    return null;
  }

  console.log(`[MBTiles Storage] Loading ${metadata.fileName} (${metadata.totalChunks} chunks)`);

  // Collect all chunks
  const chunks: ArrayBuffer[] = new Array(metadata.totalChunks);
  
  for (let i = 0; i < metadata.totalChunks; i++) {
    const chunk = await new Promise<MBTilesChunk | null>((resolve) => {
      const transaction = db.transaction(CHUNKS_STORE, 'readonly');
      const store = transaction.objectStore(CHUNKS_STORE);
      const request = store.get(`${fileId}_chunk_${i}`);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });

    if (!chunk) {
      console.error(`[MBTiles Storage] Missing chunk ${i} for file ${fileId}`);
      return null;
    }

    chunks[i] = chunk.data;
  }

  // Combine chunks into single ArrayBuffer
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const combined = new ArrayBuffer(totalSize);
  const view = new Uint8Array(combined);
  
  let offset = 0;
  for (const chunk of chunks) {
    view.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }

  console.log(`[MBTiles Storage] Loaded ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  return combined;
}

/**
 * Get MBTiles metadata
 * - Native: Reads from JSON metadata file
 * - Web: Reads from IndexedDB
 */
export async function getMBTilesMetadata(fileId: string): Promise<MBTilesMetadata | null> {
  // Use native storage for Capacitor
  if (isCapacitorNative()) {
    return getNativeMBTilesMetadata(fileId);
  }
  
  // Web/PWA: Use IndexedDB
  return getIndexedDBMBTilesMetadata(fileId);
}

/**
 * Get MBTiles metadata from native filesystem
 */
async function getNativeMBTilesMetadata(fileId: string): Promise<MBTilesMetadata | null> {
  const metadataPath = `${MBTILES_DIR}/${fileId}_metadata.json`;
  const data = await nativeStorage.readFileAsString(metadataPath);
  
  if (!data) return null;
  
  try {
    return JSON.parse(data) as MBTilesMetadata;
  } catch (error) {
    console.error('[MBTiles Storage] Failed to parse native metadata:', error);
    return null;
  }
}

/**
 * Get MBTiles metadata from IndexedDB
 */
async function getIndexedDBMBTilesMetadata(fileId: string): Promise<MBTilesMetadata | null> {
  const db = await openDatabase();

  return new Promise((resolve) => {
    const transaction = db.transaction(METADATA_STORE, 'readonly');
    const store = transaction.objectStore(METADATA_STORE);
    const request = store.get(fileId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

/**
 * Check if MBTiles file exists and is complete
 */
export async function isMBTilesFileAvailable(fileId: string): Promise<boolean> {
  const metadata = await getMBTilesMetadata(fileId);
  return metadata?.status === 'complete';
}

/**
 * Get all available MBTiles files
 * - Native: Lists metadata files from filesystem
 * - Web: Reads from IndexedDB
 */
export async function getAllMBTilesMetadata(): Promise<MBTilesMetadata[]> {
  // Use native storage for Capacitor
  if (isCapacitorNative()) {
    return getAllNativeMBTilesMetadata();
  }
  
  // Web/PWA: Use IndexedDB
  return getAllIndexedDBMBTilesMetadata();
}

/**
 * Get all MBTiles metadata from native filesystem
 */
async function getAllNativeMBTilesMetadata(): Promise<MBTilesMetadata[]> {
  const files = await nativeStorage.listDirectory(MBTILES_DIR);
  const metadataFiles = files.filter(f => f.endsWith('_metadata.json'));
  
  const results: MBTilesMetadata[] = [];
  
  for (const file of metadataFiles) {
    const path = `${MBTILES_DIR}/${file}`;
    const data = await nativeStorage.readFileAsString(path);
    if (data) {
      try {
        results.push(JSON.parse(data) as MBTilesMetadata);
      } catch (e) {
        console.warn(`[MBTiles Storage] Failed to parse metadata: ${file}`);
      }
    }
  }
  
  return results;
}

/**
 * Get all MBTiles metadata from IndexedDB
 */
async function getAllIndexedDBMBTilesMetadata(): Promise<MBTilesMetadata[]> {
  const db = await openDatabase();

  return new Promise((resolve) => {
    const transaction = db.transaction(METADATA_STORE, 'readonly');
    const store = transaction.objectStore(METADATA_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

/**
 * Returns whether a chart has a COMPLETE MBTiles set.
 * - If manifest exists: all .mbtiles listed must be present with status=complete
 * - If manifest doesn't exist: at least one .mbtiles file must be present
 */
export async function getMBTilesChartStatus(chartId: string): Promise<MBTilesChartStatus> {
  const all = await getAllMBTilesMetadata();

  const tileFiles = all.filter(
    (m) =>
      m.chartId === chartId &&
      m.status === 'complete' &&
      m.totalSize > 0 &&
      (m.fileName || '').toLowerCase().endsWith('.mbtiles')
  );

  const available = tileFiles.map((m) => m.fileName);

  // Find any "package" metadata entry that contains a manifest.
  // We store the package reference with totalSize=0.
  const pkg = all.find(
    (m) =>
      m.chartId === chartId &&
      m.status === 'complete' &&
      m.totalSize === 0 &&
      Boolean(m.manifestData?.files?.length)
  );

  const expected = pkg?.manifestData?.files
    ?.map((f) => (f.split('/').pop() || f).trim())
    .filter((f) => f.toLowerCase().endsWith('.mbtiles'));

  if (!expected || expected.length === 0) {
    // No manifest: consider usable if we have at least one tile file.
    return {
      chartId,
      isComplete: available.length > 0,
      availableMbtilesFiles: available,
    };
  }

  const availableSet = new Set(available);
  const missing = expected.filter((f) => !availableSet.has(f));

  return {
    chartId,
    isComplete: missing.length === 0 && expected.length > 0,
    availableMbtilesFiles: available,
    expectedMbtilesFiles: expected,
    missingMbtilesFiles: missing,
  };
}

/**
 * Delete MBTiles file and its chunks
 */
export async function deleteMBTilesFile(fileId: string): Promise<void> {
  const db = await openDatabase();
  const metadata = await getMBTilesMetadata(fileId);

  if (!metadata) return;

  console.log(`[MBTiles Storage] Deleting ${metadata.fileName}`);

  // Delete all chunks
  for (let i = 0; i < metadata.totalChunks; i++) {
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(CHUNKS_STORE, 'readwrite');
      const store = transaction.objectStore(CHUNKS_STORE);
      const request = store.delete(`${fileId}_chunk_${i}`);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  // Delete metadata
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(METADATA_STORE, 'readwrite');
    const store = transaction.objectStore(METADATA_STORE);
    const request = store.delete(fileId);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });

  console.log(`[MBTiles Storage] Deleted ${metadata.fileName}`);
}

/**
 * Get storage statistics
 */
export async function getMBTilesStorageStats(): Promise<{
  totalFiles: number;
  totalSize: number;
  files: Array<{ id: string; fileName: string; size: number; downloadedAt: number }>;
}> {
  const metadata = await getAllMBTilesMetadata();
  
  return {
    totalFiles: metadata.filter(m => m.status === 'complete').length,
    totalSize: metadata.reduce((sum, m) => m.status === 'complete' ? sum + m.totalSize : sum, 0),
    files: metadata
      .filter(m => m.status === 'complete')
      .map(m => ({
        id: m.id,
        fileName: m.fileName,
        size: m.totalSize,
        downloadedAt: m.downloadedAt
      }))
  };
}
