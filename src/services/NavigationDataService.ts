import { LatLngBounds } from 'leaflet';
import { NavPoint } from '../../types';
import { 
  cacheNavigationPoints, 
  searchCachedNavPoints, 
  getCachedNavPointsInBounds,
  getAllUserFixes
} from './NavigationCacheService';

// Re-export NavPoint for backwards compatibility
export type { NavPoint } from '../../types';

// Use Edge Function proxy to avoid CORS issues
const getProxyUrl = () => {
  const projectId = 'gongoqjjpwphhttumdjm';
  return `https://${projectId}.supabase.co/functions/v1/proxy-geoserver`;
};

// Sanitize user input for CQL queries to prevent injection attacks
const sanitizeCQLInput = (input: string): string => {
  const sanitized = input.replace(/[^a-zA-Z0-9\s\-áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/g, '');
  return sanitized.trim().substring(0, 50);
};

// Escape single quotes for CQL ILIKE queries
const escapeCQLValue = (input: string): string => {
  return input.replace(/'/g, "''");
};

// Validate search query format
const validateSearchQuery = (query: string): boolean => {
  if (!query || query.length < 2 || query.length > 50) {
    return false;
  }
  return /^[a-zA-Z0-9\s\-áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]+$/.test(query);
};

// Safe fetch that catches network errors silently when offline
const safeFetch = async (url: string): Promise<Response | null> => {
  if (!navigator.onLine) {
    return null;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    return null;
  }
};

/**
 * Fetch navigation data for map display
 * - Online: fetches from GeoServer and caches results
 * - Offline: returns cached data from IndexedDB
 */
export const fetchNavigationData = async (bounds: LatLngBounds): Promise<NavPoint[]> => {
  const minLat = bounds.getSouth();
  const maxLat = bounds.getNorth();
  const minLng = bounds.getWest();
  const maxLng = bounds.getEast();

  // OFFLINE MODE: Use cached data
  if (!navigator.onLine) {
    console.debug('[NavDataService] Offline - using cached navigation data');
    try {
      const cachedPoints = await getCachedNavPointsInBounds(minLat, maxLat, minLng, maxLng);
      const userFixes = await getAllUserFixes();
      
      // Convert user fixes to NavPoint format
      const userFixPoints: NavPoint[] = userFixes.map(fix => ({
        id: fix.id,
        type: 'fix' as const,
        name: fix.name,
        lat: fix.lat,
        lng: fix.lng,
        icao: fix.name.substring(0, 5).toUpperCase(),
        kind: 'user'
      })).filter(fix => 
        fix.lat >= minLat && fix.lat <= maxLat && 
        fix.lng >= minLng && fix.lng <= maxLng
      );

      return [...cachedPoints, ...userFixPoints];
    } catch (error) {
      console.error('[NavDataService] Error fetching cached data:', error);
      return [];
    }
  }

  // ONLINE MODE: Fetch from GeoServer
  const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
  const layers = ['ICA:airport', 'ICA:heliport', 'ICA:vor', 'ICA:ndb', 'ICA:waypoint'];
  const results: NavPoint[] = [];

  const fetchLayer = async (layerName: string) => {
    if (!navigator.onLine) return;

    try {
      const params = new URLSearchParams({
        typeName: layerName,
        bbox: bbox,
        maxFeatures: '100'
      });

      const response = await safeFetch(`${getProxyUrl()}?${params.toString()}`);
      if (!response) return;
      if (!response.ok) return;

      const data = await response.json();

      if (data.features) {
        for (const f of data.features) {
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
      }
    } catch (error) {
      if (navigator.onLine) {
        console.warn(`[NavDataService] Failed to fetch layer ${layerName}`, error);
      }
    }
  };

  await Promise.all(layers.map(l => fetchLayer(l)));

  // Cache results for offline use
  if (results.length > 0) {
    try {
      await cacheNavigationPoints(results);
    } catch (error) {
      console.warn('[NavDataService] Failed to cache navigation points:', error);
    }
  }

  // Also include user fixes
  try {
    const userFixes = await getAllUserFixes();
    const userFixPoints: NavPoint[] = userFixes.map(fix => ({
      id: fix.id,
      type: 'fix' as const,
      name: fix.name,
      lat: fix.lat,
      lng: fix.lng,
      icao: fix.name.substring(0, 5).toUpperCase(),
      kind: 'user'
    })).filter(fix => 
      fix.lat >= minLat && fix.lat <= maxLat && 
      fix.lng >= minLng && fix.lng <= maxLng
    );
    results.push(...userFixPoints);
  } catch (error) {
    console.debug('[NavDataService] Could not load user fixes:', error);
  }

  return results;
};

/**
 * Search navigation points by query
 * - Online: searches via GeoServer API and caches results
 * - Offline: searches in IndexedDB cache
 */
export const searchNavigationPoints = async (query: string): Promise<NavPoint[]> => {
  // Validate input
  if (!validateSearchQuery(query)) {
    console.warn('[NavDataService] Invalid search query format');
    return [];
  }

  // OFFLINE MODE: Search in cache
  if (!navigator.onLine) {
    console.debug('[NavDataService] Offline - searching in cache');
    try {
      const cachedResults = await searchCachedNavPoints(query);
      
      // Also search user fixes
      const userFixes = await getAllUserFixes();
      const matchingUserFixes: NavPoint[] = userFixes
        .filter(fix => 
          fix.name.toLowerCase().includes(query.toLowerCase())
        )
        .map(fix => ({
          id: fix.id,
          type: 'fix' as const,
          name: fix.name,
          lat: fix.lat,
          lng: fix.lng,
          icao: fix.name.substring(0, 5).toUpperCase(),
          kind: 'user'
        }));

      return [...cachedResults, ...matchingUserFixes];
    } catch (error) {
      console.error('[NavDataService] Offline search error:', error);
      return [];
    }
  }

  // ONLINE MODE: Search via API
  const layers = ['ICA:airport', 'ICA:heliport', 'ICA:waypoint', 'ICA:vor', 'ICA:ndb'];
  const results: NavPoint[] = [];

  const fetchLayer = async (layerName: string) => {
    if (!navigator.onLine) return;

    const sanitizedQuery = sanitizeCQLInput(query);
    const escapedQuery = escapeCQLValue(sanitizedQuery);

    let cql = '';
    if (layerName === 'ICA:airport' || layerName === 'ICA:heliport') {
      cql = `localidade_id ILIKE '%${escapedQuery}%' OR nome ILIKE '%${escapedQuery}%'`;
    } else {
      cql = `ident ILIKE '%${escapedQuery}%'`;
    }

    try {
      const params = new URLSearchParams({
        typeName: layerName,
        maxFeatures: '15',
        cql_filter: cql
      });

      const url = `${getProxyUrl()}?${params.toString()}`;
      const response = await safeFetch(url);
      if (!response) return;
      if (!response.ok) {
        console.error(`[NavDataService] Search failed for ${layerName} with status ${response.status}`);
        return;
      }

      const data = await response.json();

      if (data.features) {
        for (const f of data.features) {
          if (f.geometry && (f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint')) {
            const coords = f.geometry.type === 'MultiPoint' ? f.geometry.coordinates[0] : f.geometry.coordinates;
            const [lng, lat] = coords;

            let type: NavPoint['type'] = 'fix';
            let name = f.properties?.nome || f.properties?.name || f.id;
            let icao = '';
            let kind: string | undefined = undefined;

            if (layerName === 'ICA:airport') {
              type = 'airport';
              name = f.properties?.nome || name;
              icao = f.properties?.localidade_id || '';
              kind = f.properties?.tipo_uso || f.properties?.tipo || 'civil';
            } else if (layerName === 'ICA:heliport') {
              type = 'airport';
              name = f.properties?.nome || name;
              icao = f.properties?.localidade_id || '';
              kind = 'heliport';
            } else if (layerName === 'ICA:waypoint' || layerName === 'ICA:vor' || layerName === 'ICA:ndb') {
              type = layerName === 'ICA:waypoint' ? 'fix' : layerName === 'ICA:vor' ? 'vor' : 'ndb';
              icao = f.properties?.ident || '';
              name = f.properties?.nome || icao;
            }

            const key = (icao || name).toUpperCase();
            if (!results.find(r => r.type === type && (r.icao?.toUpperCase() === key || r.name.toUpperCase() === key))) {
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
        }
      }
    } catch (error) {
      if (navigator.onLine) {
        console.error(`[NavDataService] Search failed for ${layerName}`, error);
      }
    }
  };

  await Promise.all(layers.map(l => fetchLayer(l)));

  // Cache search results for future offline use
  if (results.length > 0) {
    try {
      await cacheNavigationPoints(results);
    } catch (error) {
      console.warn('[NavDataService] Failed to cache search results:', error);
    }
  }

  // Also search user fixes
  try {
    const userFixes = await getAllUserFixes();
    const matchingUserFixes: NavPoint[] = userFixes
      .filter(fix => 
        fix.name.toLowerCase().includes(query.toLowerCase())
      )
      .map(fix => ({
        id: fix.id,
        type: 'fix' as const,
        name: fix.name,
        lat: fix.lat,
        lng: fix.lng,
        icao: fix.name.substring(0, 5).toUpperCase(),
        kind: 'user'
      }));
    results.push(...matchingUserFixes);
  } catch (error) {
    console.debug('[NavDataService] Could not search user fixes:', error);
  }

  return results;
};
