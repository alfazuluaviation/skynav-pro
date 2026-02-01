/**
 * Navigation Sync Service
 * Handles initial sync of all Brazilian navigation data for offline use
 */

import { NavPoint } from '../../types';
import { 
  cacheNavigationPoints, 
  updateNavCacheMetadata,
  getNavCacheMetadata,
  getNavCacheStats
} from './NavigationCacheService';

const PROXY_URL = 'https://gongoqjjpwphhttumdjm.supabase.co/functions/v1/proxy-geoserver';

// Brazil bounding box (expanded to cover all FIRs)
const BRAZIL_BOUNDS = {
  minLat: -35.0,
  maxLat: 6.0,
  minLng: -75.0,
  maxLng: -30.0
};

interface SyncProgress {
  layer: string;
  current: number;
  total: number;
  status: 'pending' | 'syncing' | 'complete' | 'error';
}

type ProgressCallback = (progress: SyncProgress) => void;

// Expected count ranges for integrity validation (based on DECEA data)
// These ranges allow for some variation while detecting major sync failures
const EXPECTED_COUNTS: Record<string, { min: number; max: number }> = {
  'ICA:airport': { min: 2000, max: 3500 },
  'ICA:heliport': { min: 400, max: 2000 },
  'ICA:vor': { min: 40, max: 150 },
  'ICA:ndb': { min: 80, max: 300 },
  'ICA:waypoint': { min: 1000, max: 6000 }
};

// Sync result with integrity information
export interface SyncResult {
  success: boolean;
  totalPoints: number;
  byLayer: Record<string, number>;
  errors: string[];
  integrity: 'verified' | 'partial' | 'unknown';
  integrityDetails?: string;
}

/**
 * Fetch all features from a layer (paginated)
 */
async function fetchAllLayerFeatures(
  layerName: string,
  onProgress?: ProgressCallback
): Promise<NavPoint[]> {
  const results: NavPoint[] = [];
  const bbox = `${BRAZIL_BOUNDS.minLng},${BRAZIL_BOUNDS.minLat},${BRAZIL_BOUNDS.maxLng},${BRAZIL_BOUNDS.maxLat}`;
  const pageSize = 1000; // Increased for efficiency
  let startIndex = 0;
  let hasMore = true;
  let retryCount = 0;
  const maxRetries = 3;

  onProgress?.({ layer: layerName, current: 0, total: 0, status: 'syncing' });

  while (hasMore) {
    try {
      const params = new URLSearchParams({
        typeName: layerName,
        bbox: bbox,
        maxFeatures: String(pageSize),
        startIndex: String(startIndex) // CRITICAL: This was missing proper encoding
      });

      console.log(`[NavSync] Fetching ${layerName} from index ${startIndex}...`);
      
      const response = await fetch(`${PROXY_URL}?${params.toString()}`, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        console.error(`[NavSync] Failed to fetch ${layerName} at index ${startIndex}: HTTP ${response.status}`);
        retryCount++;
        if (retryCount >= maxRetries) {
          console.error(`[NavSync] Max retries reached for ${layerName}`);
          break;
        }
        await new Promise(r => setTimeout(r, 1000 * retryCount));
        continue;
      }

      const data = await response.json();
      const features = data.features || [];
      
      // Check for warning/error from proxy
      if (data._warning || data._error) {
        console.warn(`[NavSync] GeoServer warning for ${layerName}:`, data._warning || data._error);
      }

      console.log(`[NavSync] Got ${features.length} features for ${layerName} at index ${startIndex}`);

      if (features.length === 0) {
        hasMore = false;
        break;
      }

      // Reset retry count on success
      retryCount = 0;

      for (const f of features) {
        if (f.geometry && (f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint')) {
          const coords = f.geometry.type === 'MultiPoint' ? f.geometry.coordinates[0] : f.geometry.coordinates;
          const [lng, lat] = coords;

          let type: NavPoint['type'] = 'airport';
          let name = f.properties?.nome || f.id;
          let icao = f.properties?.localidade_id || '';
          let kind: string | undefined = undefined;

          if (layerName === 'ICA:airport') {
            name = f.properties?.nome || name;
            icao = f.properties?.localidade_id || icao;
            kind = f.properties?.tipo_uso || f.properties?.tipo || 'civil';
          } else if (layerName === 'ICA:heliport') {
            type = 'airport';
            name = f.properties?.nome || name;
            icao = f.properties?.localidade_id || '';
            kind = 'heliport';
          } else if (layerName === 'ICA:waypoint' || layerName === 'ICA:vor' || layerName === 'ICA:ndb') {
            type = layerName === 'ICA:waypoint' ? 'fix' : layerName === 'ICA:vor' ? 'vor' : 'ndb';
            name = f.properties?.ident || f.properties?.nome || name;
            icao = f.properties?.ident || '';
          }

          if (!name) name = icao || f.id;

          results.push({
            id: f.id,
            type,
            name,
            lat,
            lng,
            icao,
            kind,
          });
        }
      }

      startIndex += features.length;
      onProgress?.({ 
        layer: layerName, 
        current: results.length, 
        total: results.length, 
        status: 'syncing' 
      });

      // If we got fewer than pageSize, we're done
      if (features.length < pageSize) {
        hasMore = false;
      }

      // Small delay between pages to avoid rate limiting
      if (hasMore) {
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (error) {
      console.error(`[NavSync] Error fetching ${layerName}:`, error);
      retryCount++;
      if (retryCount >= maxRetries) {
        console.error(`[NavSync] Max retries reached for ${layerName}, stopping`);
        hasMore = false;
      } else {
        await new Promise(r => setTimeout(r, 1000 * retryCount));
      }
    }
  }

  onProgress?.({ 
    layer: layerName, 
    current: results.length, 
    total: results.length, 
    status: 'complete' 
  });

  console.log(`[NavSync] Completed ${layerName}: ${results.length} points total`);
  return results;
}

/**
 * Sync all navigation data for offline use
 * This downloads ALL Brazilian navigation points with integrity validation
 */
export async function syncAllNavigationData(
  onProgress?: (overallProgress: number, message: string) => void
): Promise<SyncResult> {
  if (!navigator.onLine) {
    return { 
      success: false, 
      totalPoints: 0, 
      byLayer: {},
      errors: ['Sem conexão com a internet'],
      integrity: 'unknown'
    };
  }

  const layers = [
    'ICA:airport',
    'ICA:heliport',
    'ICA:vor',
    'ICA:ndb',
    'ICA:waypoint'
  ];

  let totalPoints = 0;
  const byLayer: Record<string, number> = {};
  const errors: string[] = [];
  const layerProgress = new Map<string, number>();

  try {
    await updateNavCacheMetadata({ status: 'syncing', totalPoints: 0 });

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const layerLabel = layer.replace('ICA:', '').toUpperCase();
      
      onProgress?.(
        Math.round((i / layers.length) * 100),
        `Sincronizando ${layerLabel}...`
      );

      const points = await fetchAllLayerFeatures(layer, (progress) => {
        layerProgress.set(layer, progress.current);
      });

      // Cache in batches
      if (points.length > 0) {
        const batchSize = 200;
        for (let j = 0; j < points.length; j += batchSize) {
          const batch = points.slice(j, j + batchSize);
          await cacheNavigationPoints(batch);
        }
      }

      byLayer[layer] = points.length;
      totalPoints += points.length;
      
      // Check against expected counts
      const expected = EXPECTED_COUNTS[layer];
      if (expected && points.length < expected.min) {
        const warning = `${layerLabel}: ${points.length} pontos (esperado: ${expected.min}-${expected.max})`;
        errors.push(warning);
        console.warn(`[NavSync] ⚠️ ${warning}`);
      }
      
      console.log(`[NavSync] Synced ${points.length} points from ${layer}`);
    }

    // Validate overall integrity
    let integrity: 'verified' | 'partial' | 'unknown' = 'verified';
    let integrityDetails: string | undefined;
    
    // Check if any layer is below minimum
    const failedLayers = Object.entries(byLayer).filter(([layer, count]) => {
      const expected = EXPECTED_COUNTS[layer];
      return expected && count < expected.min;
    });
    
    if (failedLayers.length > 0) {
      integrity = 'partial';
      integrityDetails = `⚠️ Sincronização parcial: ${failedLayers.length} camada(s) com dados incompletos. Recomenda-se nova sincronização com conexão estável.`;
    } else if (totalPoints < 3000) {
      // If total is suspiciously low
      integrity = 'partial';
      integrityDetails = `⚠️ Total de ${totalPoints} pontos é menor que o esperado (~5.000+). Verifique a conexão e sincronize novamente.`;
    }

    await updateNavCacheMetadata({
      status: integrity === 'verified' ? 'complete' : 'partial',
      totalPoints,
      lastSync: Date.now()
    });

    const finalMessage = integrity === 'verified'
      ? `✓ Sincronização completa! ${totalPoints.toLocaleString()} pontos salvos.`
      : `⚠️ Sincronização parcial: ${totalPoints.toLocaleString()} pontos. ${integrityDetails}`;
    
    onProgress?.(100, finalMessage);
    console.log(`[NavSync] Complete! Total points: ${totalPoints}, Integrity: ${integrity}`);

    return { 
      success: true, 
      totalPoints, 
      byLayer,
      errors,
      integrity,
      integrityDetails
    };
  } catch (error) {
    console.error('[NavSync] Sync failed:', error);
    await updateNavCacheMetadata({ status: 'error' });
    return { 
      success: false, 
      totalPoints, 
      byLayer,
      errors: [error instanceof Error ? error.message : 'Erro desconhecido'],
      integrity: 'unknown'
    };
  }
}

/**
 * Check if sync is needed (no data or old data)
 */
export async function isSyncNeeded(): Promise<boolean> {
  const metadata = await getNavCacheMetadata();
  
  if (!metadata || metadata.status !== 'complete') {
    return true;
  }

  // Consider sync needed if data is older than 7 days
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  if (metadata.lastSync < sevenDaysAgo) {
    return true;
  }

  const stats = await getNavCacheStats();
  // If we have very few points, sync is needed
  if (stats.totalPoints < 100) {
    return true;
  }

  return false;
}

/**
 * Get sync status for UI display
 */
export async function getSyncStatus(): Promise<{
  isSynced: boolean;
  lastSync: Date | null;
  totalPoints: number;
  needsSync: boolean;
}> {
  const metadata = await getNavCacheMetadata();
  const stats = await getNavCacheStats();
  const needsSync = await isSyncNeeded();

  return {
    isSynced: metadata?.status === 'complete',
    lastSync: stats.lastSync,
    totalPoints: stats.totalPoints,
    needsSync
  };
}
