/**
 * Tile Cache Service
 * Manages offline caching of WMS tiles using IndexedDB for aviation charts.
 */

const DB_NAME = 'skyfpl-tile-cache';
const DB_VERSION = 1;
const STORE_NAME = 'tiles';
const METADATA_STORE = 'metadata';

interface TileMetadata {
  layerId: string;
  totalTiles: number;
  downloadedTiles: number;
  lastUpdated: number;
  status: 'pending' | 'downloading' | 'complete' | 'error';
}

interface CachedTile {
  key: string;
  layerId: string;
  blob: Blob;
  timestamp: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Open or create the IndexedDB database
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

      // Store for tiles
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const tileStore = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        tileStore.createIndex('layerId', 'layerId', { unique: false });
        tileStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Store for layer metadata
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: 'layerId' });
      }
    };
  });
}

/**
 * Generate a unique cache key for a tile
 * Normalizes subdomain to 'a' for consistent caching
 */
export function getTileCacheKey(url: string): string {
  // Normalize subdomain (a, b, c, d) to 'a' for consistent cache keys
  // This ensures tiles cached with subdomain 'b' can be retrieved when looking up with 'a'
  return url
    .replace(/https:\/\/[abcd]\.tile\.openstreetmap\.org/, 'https://a.tile.openstreetmap.org')
    .replace(/https:\/\/[abcd]\.basemaps\.cartocdn\.com/, 'https://a.basemaps.cartocdn.com')
    .replace(/https:\/\/[abc]\.tile\.opentopomap\.org/, 'https://a.tile.opentopomap.org');
}

/**
 * Get a tile from cache
 */
export async function getCachedTile(url: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    const key = getTileCacheKey(url);

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const tile = request.result as CachedTile | undefined;
        resolve(tile?.blob || null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    console.error('Error getting cached tile:', error);
    return null;
  }
}

/**
 * Save a tile to cache
 */
export async function cacheTile(url: string, blob: Blob, layerId: string): Promise<void> {
  try {
    const db = await openDatabase();
    const key = getTileCacheKey(url);

    const tile: CachedTile = {
      key,
      layerId,
      blob,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(tile);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error caching tile:', error);
  }
}

/**
 * Get layer metadata
 */
export async function getLayerMetadata(layerId: string): Promise<TileMetadata | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve) => {
      const transaction = db.transaction(METADATA_STORE, 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(layerId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    console.error('Error getting layer metadata:', error);
    return null;
  }
}

/**
 * Update layer metadata
 */
export async function updateLayerMetadata(metadata: TileMetadata): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(METADATA_STORE, 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.put(metadata);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error updating layer metadata:', error);
  }
}

/**
 * Get count of cached tiles for a layer
 */
export async function getCachedTileCount(layerId: string): Promise<number> {
  try {
    const db = await openDatabase();

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('layerId');
      const request = index.count(IDBKeyRange.only(layerId));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  } catch (error) {
    console.error('Error counting cached tiles:', error);
    return 0;
  }
}

/**
 * Clear all cached tiles for a specific layer
 */
export async function clearLayerCache(layerId: string): Promise<void> {
  console.log(`[TILE CACHE] Clearing cache for layer: ${layerId}`);
  
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, METADATA_STORE], 'readwrite');
      let deletedCount = 0;
      
      // Get all tiles for this layer and delete them
      const tileStore = transaction.objectStore(STORE_NAME);
      const index = tileStore.index('layerId');
      const cursorRequest = index.openCursor(IDBKeyRange.only(layerId));

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        }
      };

      // Delete metadata
      const metadataStore = transaction.objectStore(METADATA_STORE);
      metadataStore.delete(layerId);

      transaction.oncomplete = () => {
        console.log(`[TILE CACHE] Cleared ${deletedCount} tiles for layer: ${layerId}`);
        resolve();
      };
      transaction.onerror = () => {
        console.error(`[TILE CACHE] Error clearing cache for ${layerId}:`, transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('[TILE CACHE] Error clearing layer cache:', error);
    throw error;
  }
}

/**
 * Clear all cached tiles
 */
export async function clearAllCache(): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, METADATA_STORE], 'readwrite');
      
      transaction.objectStore(STORE_NAME).clear();
      transaction.objectStore(METADATA_STORE).clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error clearing all cache:', error);
  }
}

/**
 * Get cache storage estimate
 */
export async function getCacheStats(): Promise<{ tileCount: number; estimatedSize: string }> {
  try {
    const db = await openDatabase();

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        const count = countRequest.result;
        // Estimate ~50KB per tile on average
        const estimatedBytes = count * 50 * 1024;
        const estimatedSize = estimatedBytes > 1024 * 1024 * 1024
          ? `${(estimatedBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
          : estimatedBytes > 1024 * 1024
            ? `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`
            : `${(estimatedBytes / 1024).toFixed(1)} KB`;

        resolve({ tileCount: count, estimatedSize });
      };

      countRequest.onerror = () => resolve({ tileCount: 0, estimatedSize: '0 KB' });
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return { tileCount: 0, estimatedSize: '0 KB' };
  }
}

/**
 * Check if a layer is fully cached
 */
export async function isLayerCached(layerId: string): Promise<boolean> {
  const metadata = await getLayerMetadata(layerId);
  const isCached = metadata?.status === 'complete';
  console.log(`[TILE CACHE] isLayerCached(${layerId}): ${isCached}, metadata:`, metadata);
  return isCached;
}

/**
 * Get all cached layer IDs
 */
export async function getCachedLayerIds(): Promise<string[]> {
  try {
    const db = await openDatabase();

    return new Promise((resolve) => {
      const transaction = db.transaction(METADATA_STORE, 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const metadata = request.result as TileMetadata[];
        resolve(
          metadata
            .filter(m => m.status === 'complete')
            .map(m => m.layerId)
        );
      };
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    console.error('Error getting cached layer IDs:', error);
    return [];
  }
}
