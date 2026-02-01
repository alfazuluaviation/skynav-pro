/**
 * Navigation Cache Service
 * Manages offline caching of navigation data (VOR, NDB, Waypoints, Aerodromes, Heliports, User Fixes)
 * Uses IndexedDB for persistent storage
 */

import { NavPoint } from '../../types';

const DB_NAME = 'skyfpl-navigation-cache';
const DB_VERSION = 2;

// Store names for different navigation data types
const STORES = {
  AIRPORTS: 'airports',
  HELIPORTS: 'heliports',
  VORS: 'vors',
  NDBS: 'ndbs',
  WAYPOINTS: 'waypoints',
  USER_FIXES: 'user_fixes',
  METADATA: 'nav_metadata'
} as const;

interface NavCacheMetadata {
  id: string;
  lastSync: number;
  totalPoints: number;
  status: 'pending' | 'syncing' | 'complete' | 'error';
}

interface CachedNavPoint extends NavPoint {
  cachedAt: number;
  searchKey: string; // Lowercase name + icao for fast search
}

interface UserFix {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Open or create the IndexedDB database for navigation data
 */
async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[NavCache] Error opening database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[NavCache] Database opened successfully');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log('[NavCache] Upgrading database schema...');

      // Create stores for each navigation type with indexes for search
      const createStoreWithIndexes = (storeName: string) => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          store.createIndex('icao', 'icao', { unique: false });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('searchKey', 'searchKey', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          console.log(`[NavCache] Created store: ${storeName}`);
        }
      };

      createStoreWithIndexes(STORES.AIRPORTS);
      createStoreWithIndexes(STORES.HELIPORTS);
      createStoreWithIndexes(STORES.VORS);
      createStoreWithIndexes(STORES.NDBS);
      createStoreWithIndexes(STORES.WAYPOINTS);

      // User fixes store (different structure)
      if (!db.objectStoreNames.contains(STORES.USER_FIXES)) {
        const userFixStore = db.createObjectStore(STORES.USER_FIXES, { keyPath: 'id' });
        userFixStore.createIndex('name', 'name', { unique: false });
        userFixStore.createIndex('searchKey', 'searchKey', { unique: false });
        console.log('[NavCache] Created store: user_fixes');
      }

      // Metadata store
      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        db.createObjectStore(STORES.METADATA, { keyPath: 'id' });
        console.log('[NavCache] Created store: nav_metadata');
      }
    };
  });
}

/**
 * Get the appropriate store name for a NavPoint type
 */
function getStoreForType(type: NavPoint['type'], kind?: string): string {
  if (type === 'airport') {
    return kind === 'heliport' ? STORES.HELIPORTS : STORES.AIRPORTS;
  }
  switch (type) {
    case 'vor': return STORES.VORS;
    case 'ndb': return STORES.NDBS;
    case 'fix': return STORES.WAYPOINTS;
    default: return STORES.WAYPOINTS;
  }
}

/**
 * Create a search key for fast lookups
 */
function createSearchKey(point: NavPoint): string {
  return `${(point.icao || '').toLowerCase()} ${(point.name || '').toLowerCase()}`;
}

/**
 * Cache multiple navigation points (batch operation)
 */
export async function cacheNavigationPoints(points: NavPoint[]): Promise<void> {
  if (points.length === 0) return;

  try {
    const db = await openDatabase();
    const timestamp = Date.now();

    // Group points by store
    const pointsByStore = new Map<string, CachedNavPoint[]>();

    for (const point of points) {
      const storeName = getStoreForType(point.type, point.kind);
      if (!pointsByStore.has(storeName)) {
        pointsByStore.set(storeName, []);
      }
      pointsByStore.get(storeName)!.push({
        ...point,
        cachedAt: timestamp,
        searchKey: createSearchKey(point)
      });
    }

    // Write to each store
    const storeNames = Array.from(pointsByStore.keys());
    const transaction = db.transaction(storeNames, 'readwrite');

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(`[NavCache] Cached ${points.length} navigation points`);
        resolve();
      };
      transaction.onerror = () => {
        console.error('[NavCache] Error caching points:', transaction.error);
        reject(transaction.error);
      };

      for (const [storeName, storePoints] of pointsByStore) {
        const store = transaction.objectStore(storeName);
        for (const point of storePoints) {
          store.put(point);
        }
      }
    });
  } catch (error) {
    console.error('[NavCache] Error caching navigation points:', error);
  }
}

/**
 * Search cached navigation points by query (offline search)
 */
export async function searchCachedNavPoints(query: string): Promise<NavPoint[]> {
  if (!query || query.length < 2) return [];

  try {
    const db = await openDatabase();
    const searchQuery = query.toLowerCase().trim();
    const results: NavPoint[] = [];
    const seen = new Set<string>();

    // Search in all navigation stores
    const storeNames = [
      STORES.AIRPORTS,
      STORES.HELIPORTS,
      STORES.VORS,
      STORES.NDBS,
      STORES.WAYPOINTS,
      STORES.USER_FIXES
    ];

    for (const storeName of storeNames) {
      try {
        const points = await searchStore(db, storeName, searchQuery);
        for (const point of points) {
          const key = `${point.type}-${point.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push(point);
          }
        }
      } catch (e) {
        // Store might not exist yet
        console.debug(`[NavCache] Store ${storeName} not available for search`);
      }
    }

    console.log(`[NavCache] Offline search for "${query}" found ${results.length} results`);
    return results.slice(0, 20); // Limit results
  } catch (error) {
    console.error('[NavCache] Error searching cached points:', error);
    return [];
  }
}

/**
 * Search a specific store
 */
async function searchStore(db: IDBDatabase, storeName: string, query: string): Promise<NavPoint[]> {
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const results: NavPoint[] = [];

      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const point = cursor.value as CachedNavPoint;
          // Check if searchKey contains query
          if (point.searchKey && point.searchKey.includes(query)) {
            results.push({
              id: point.id,
              type: point.type,
              name: point.name,
              lat: point.lat,
              lng: point.lng,
              icao: point.icao,
              kind: point.kind
            });
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Get all cached points for display on map (by bounds approximation)
 */
export async function getCachedNavPointsInBounds(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number
): Promise<NavPoint[]> {
  try {
    const db = await openDatabase();
    const results: NavPoint[] = [];

    const storeNames = [
      STORES.AIRPORTS,
      STORES.HELIPORTS,
      STORES.VORS,
      STORES.NDBS,
      STORES.WAYPOINTS
    ];

    for (const storeName of storeNames) {
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        await new Promise<void>((resolve) => {
          request.onsuccess = () => {
            const points = request.result as CachedNavPoint[];
            for (const point of points) {
              if (
                point.lat >= minLat &&
                point.lat <= maxLat &&
                point.lng >= minLng &&
                point.lng <= maxLng
              ) {
                results.push({
                  id: point.id,
                  type: point.type,
                  name: point.name,
                  lat: point.lat,
                  lng: point.lng,
                  icao: point.icao,
                  kind: point.kind
                });
              }
            }
            resolve();
          };
          request.onerror = () => resolve();
        });
      } catch {
        // Store might not exist
      }
    }

    console.log(`[NavCache] Found ${results.length} cached points in bounds`);
    return results;
  } catch (error) {
    console.error('[NavCache] Error getting cached points in bounds:', error);
    return [];
  }
}

// ==================== USER FIXES ====================

/**
 * Save a user-created fix
 */
export async function saveUserFix(fix: Omit<UserFix, 'createdAt' | 'updatedAt' | 'id'>): Promise<UserFix> {
  try {
    const db = await openDatabase();
    const now = Date.now();
    
    const newFix: UserFix & { searchKey: string; type: 'fix' } = {
      ...fix,
      id: `user-fix-${now}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
      searchKey: fix.name.toLowerCase(),
      type: 'fix'
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.USER_FIXES, 'readwrite');
      const store = transaction.objectStore(STORES.USER_FIXES);
      const request = store.add(newFix);

      request.onsuccess = () => {
        console.log(`[NavCache] Saved user fix: ${fix.name}`);
        resolve(newFix);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[NavCache] Error saving user fix:', error);
    throw error;
  }
}

/**
 * Get all user fixes
 */
export async function getAllUserFixes(): Promise<UserFix[]> {
  try {
    const db = await openDatabase();

    return new Promise((resolve) => {
      const transaction = db.transaction(STORES.USER_FIXES, 'readonly');
      const store = transaction.objectStore(STORES.USER_FIXES);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    console.error('[NavCache] Error getting user fixes:', error);
    return [];
  }
}

/**
 * Delete a user fix
 */
export async function deleteUserFix(fixId: string): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.USER_FIXES, 'readwrite');
      const store = transaction.objectStore(STORES.USER_FIXES);
      const request = store.delete(fixId);

      request.onsuccess = () => {
        console.log(`[NavCache] Deleted user fix: ${fixId}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[NavCache] Error deleting user fix:', error);
    throw error;
  }
}

// ==================== METADATA & SYNC ====================

/**
 * Get sync metadata
 */
export async function getNavCacheMetadata(): Promise<NavCacheMetadata | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve) => {
      const transaction = db.transaction(STORES.METADATA, 'readonly');
      const store = transaction.objectStore(STORES.METADATA);
      const request = store.get('navigation-sync');

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Update sync metadata
 */
export async function updateNavCacheMetadata(metadata: Partial<NavCacheMetadata>): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve) => {
      const transaction = db.transaction(STORES.METADATA, 'readwrite');
      const store = transaction.objectStore(STORES.METADATA);
      
      const fullMetadata: NavCacheMetadata = {
        id: 'navigation-sync',
        lastSync: metadata.lastSync || Date.now(),
        totalPoints: metadata.totalPoints || 0,
        status: metadata.status || 'pending'
      };

      store.put(fullMetadata);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  } catch (error) {
    console.error('[NavCache] Error updating metadata:', error);
  }
}

/**
 * Check if navigation cache has data
 */
export async function hasNavigationCache(): Promise<boolean> {
  const metadata = await getNavCacheMetadata();
  return metadata?.status === 'complete' && (metadata?.totalPoints || 0) > 0;
}

/**
 * Get cache statistics
 */
export async function getNavCacheStats(): Promise<{ 
  totalPoints: number; 
  lastSync: Date | null;
  byType: Record<string, number>;
}> {
  try {
    const db = await openDatabase();
    const byType: Record<string, number> = {};
    let totalPoints = 0;

    const storeNames = [
      STORES.AIRPORTS,
      STORES.HELIPORTS,
      STORES.VORS,
      STORES.NDBS,
      STORES.WAYPOINTS,
      STORES.USER_FIXES
    ];

    for (const storeName of storeNames) {
      try {
        const count = await new Promise<number>((resolve) => {
          const transaction = db.transaction(storeName, 'readonly');
          const store = transaction.objectStore(storeName);
          const request = store.count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(0);
        });
        byType[storeName] = count;
        totalPoints += count;
      } catch {
        byType[storeName] = 0;
      }
    }

    const metadata = await getNavCacheMetadata();

    return {
      totalPoints,
      lastSync: metadata?.lastSync ? new Date(metadata.lastSync) : null,
      byType
    };
  } catch (error) {
    console.error('[NavCache] Error getting cache stats:', error);
    return { totalPoints: 0, lastSync: null, byType: {} };
  }
}

/**
 * Clear all navigation cache
 */
export async function clearNavigationCache(): Promise<void> {
  try {
    const db = await openDatabase();

    const storeNames = [
      STORES.AIRPORTS,
      STORES.HELIPORTS,
      STORES.VORS,
      STORES.NDBS,
      STORES.WAYPOINTS,
      STORES.METADATA
    ];

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeNames, 'readwrite');

      for (const storeName of storeNames) {
        transaction.objectStore(storeName).clear();
      }

      transaction.oncomplete = () => {
        console.log('[NavCache] Cache cleared');
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('[NavCache] Error clearing cache:', error);
    throw error;
  }
}
