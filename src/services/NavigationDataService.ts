import { LatLngBounds } from 'leaflet';
import { NavPoint } from '../types';
import { searchAerodrome } from './geminiService'; // Import searchAerodrome
import { supabase } from '@/integrations/supabase/client';

// Use Edge Function proxy to avoid CORS issues
const getProxyUrl = () => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'gongoqjjpwphhttumdjm';
  return `https://${projectId}.supabase.co/functions/v1/proxy-geoserver`;
};
// Sanitize user input for CQL queries to prevent injection attacks
// Uses whitelist approach - only allow safe characters
const sanitizeCQLInput = (input: string): string => {
  // Only allow alphanumeric, spaces, hyphens, and common accented characters
  // This is safer than blacklisting specific characters
  const sanitized = input.replace(/[^a-zA-Z0-9\s\-áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/g, '');
  
  // Additional protection: limit length and trim
  return sanitized.trim().substring(0, 50);
};

// Escape single quotes for CQL ILIKE queries
const escapeCQLValue = (input: string): string => {
  // Escape single quotes by doubling them (CQL standard)
  return input.replace(/'/g, "''");
};

// Validate search query format
const validateSearchQuery = (query: string): boolean => {
  if (!query || query.length < 2 || query.length > 50) {
    return false;
  }
  // Allow alphanumeric, spaces, hyphens, and common accented characters
  return /^[a-zA-Z0-9\s\-áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]+$/.test(query);
};

// Safe fetch that catches network errors silently when offline
const safeFetch = async (url: string): Promise<Response | null> => {
    if (!navigator.onLine) {
        return null;
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        // Silently ignore network errors (ERR_INTERNET_DISCONNECTED, etc.)
        return null;
    }
};

export const fetchNavigationData = async (bounds: LatLngBounds): Promise<NavPoint[]> => {
    // Skip network requests when offline to avoid console errors
    if (!navigator.onLine) {
        console.debug('[NavDataService] Offline - skipping navigation data fetch');
        return [];
    }

    // Construct BBOX string: minLng,minLat,maxLng,maxLat
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

    // Validated layers - including heliport for proper symbol differentiation
    const layers = ['ICA:airport', 'ICA:heliport', 'ICA:vor', 'ICA:ndb', 'ICA:waypoint'];

    const results: NavPoint[] = [];

    const fetchLayer = async (layerName: string) => {
        // Double-check offline status before each fetch
        if (!navigator.onLine) {
            return;
        }

        try {
            const params = new URLSearchParams({
                typeName: layerName,
                bbox: bbox,
                maxFeatures: '100'
            });

            const response = await safeFetch(`${getProxyUrl()}?${params.toString()}`);
            if (!response) return; // Offline or network error
            if (!response.ok) return;

            const data = await response.json();

            // Parse features
            if (data.features) {
                for (const f of data.features) {
                    // Check geometry type
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
            // Silently ignore errors when offline
            if (navigator.onLine) {
                console.warn(`[NavDataService] Failed to fetch layer ${layerName}`, error);
            }
        }
    };

    await Promise.all(layers.map(l => fetchLayer(l)));

    return results;
};

export const searchNavigationPoints = async (query: string): Promise<NavPoint[]> => {
    // Skip network requests when offline
    if (!navigator.onLine) {
        console.debug('[NavDataService] Offline - skipping search');
        return [];
    }

    // Validate input
    if (!validateSearchQuery(query)) {
        console.warn('[NavDataService] Invalid search query format');
        return [];
    }

    // Layers to search
    const layers = ['ICA:airport', 'ICA:waypoint', 'ICA:vor', 'ICA:ndb'];
    const results: NavPoint[] = [];

    const fetchLayer = async (layerName: string) => {
        // Double-check offline status before each fetch
        if (!navigator.onLine) {
            return;
        }

        // Sanitize and escape input before using in CQL query
        const sanitizedQuery = sanitizeCQLInput(query);
        const escapedQuery = escapeCQLValue(sanitizedQuery);
        
        let cql = '';
        if (layerName === 'ICA:airport') {
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
            if (!response) return; // Offline or network error
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

                        if (layerName === 'ICA:airport') {
                            type = 'airport';
                            name = f.properties?.nome || name;
                            icao = f.properties?.localidade_id || '';
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
                            });
                        }
                    }
                }
            }
        } catch (error) {
            // Silently ignore errors when offline
            if (navigator.onLine) {
                console.error(`[NavDataService] Search failed for ${layerName}`, error);
            }
        }
    };

    await Promise.all(layers.map(l => fetchLayer(l)));
    return results;
};