/**
 * MBTiles Storage Service
 * 
 * Handles storage of MBTiles files using IndexedDB.
 * Files are stored as ArrayBuffer chunks for efficient memory usage.
 * 
 * This service is ISOLATED from the existing tile cache system.
 */

import { MBTILES_CONSTANTS } from '../config/mbtilesConfig';

const { DB_NAME, DB_VERSION, STORE_NAME, METADATA_STORE, CHUNKS_STORE, CHUNK_SIZE } = MBTILES_CONSTANTS;

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
 * Store MBTiles file in IndexedDB (as chunks for large files)
 */
export async function storeMBTilesFile(
  fileId: string,
  chartId: string,
  fileName: string,
  data: ArrayBuffer,
  manifestData: ManifestData | null = null
): Promise<void> {
  const db = await openDatabase();
  const totalSize = data.byteLength;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

  console.log(`[MBTiles Storage] Storing ${fileName} (${(totalSize / 1024 / 1024).toFixed(2)} MB) in ${totalChunks} chunks`);

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
 * Retrieve MBTiles file from IndexedDB
 */
export async function getMBTilesFile(fileId: string): Promise<ArrayBuffer | null> {
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
 */
export async function getMBTilesMetadata(fileId: string): Promise<MBTilesMetadata | null> {
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
 */
export async function getAllMBTilesMetadata(): Promise<MBTilesMetadata[]> {
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
