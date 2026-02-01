/**
 * CachedWMSTileLayer
 * A WMS tile layer component that uses IndexedDB for offline caching.
 * Tiles are served from cache when available, with network fallback.
 * 
 * OPTIMIZED v4:
 * - Supabase Edge Function proxy as primary (most reliable)
 * - Parallel fetches with staggered fallbacks
 * - Aggressive retry with exponential backoff
 * - Session-aware proxy selection
 */

import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getCachedTile, cacheTile } from '../services/tileCache';

// GeoServer direct URL
const BASE_WMS_URL = "https://geoaisweb.decea.mil.br/geoserver/wms";

// Supabase Edge Function proxy URL - most reliable option
const SUPABASE_PROXY_URL = `https://gongoqjjpwphhttumdjm.supabase.co/functions/v1/proxy-wms`;

// Public CORS proxies as fallback (ordered by reliability)
const PUBLIC_PROXIES = [
  "https://api.codetabs.com/v1/proxy?quest=",  // Most reliable based on logs
  "https://api.allorigins.win/raw?url=",
];

// Track which sources are working in this session
const sourceHealth: Record<string, { failures: number; lastSuccess: number }> = {
  'supabase': { failures: 0, lastSuccess: Date.now() },
  'direct': { failures: 0, lastSuccess: 0 },
  'public-0': { failures: 0, lastSuccess: 0 },
  'public-1': { failures: 0, lastSuccess: 0 }
};

interface CachedWMSTileLayerProps {
  url: string;
  layers: string;
  format?: string;
  transparent?: boolean;
  version?: string;
  opacity?: number;
  zIndex?: number;
  tileSize?: number;
  detectRetina?: boolean;
  maxZoom?: number;
  layerId: string;
  useCache?: boolean;
  useProxy?: boolean;
  attribution?: string;
}

// Custom TileLayer class with IndexedDB caching and optimized network loading
const CachedWMSLayer = L.TileLayer.WMS.extend({
  options: {
    layerId: '',
    useCache: true,
    useProxy: false,
    baseWmsUrl: BASE_WMS_URL
  },

  // Generate WMS URL with EPSG:4326 coordinates
  getTileUrl: function (coords: L.Coords) {
    const zoom = coords.z;
    const x = coords.x;
    const y = coords.y;
    
    const n = Math.pow(2, zoom);
    
    const minLng = x / n * 360 - 180;
    const maxLng = (x + 1) / n * 360 - 180;
    
    const minLatRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)));
    const maxLatRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
    
    const minLat = minLatRad * 180 / Math.PI;
    const maxLat = maxLatRad * 180 / Math.PI;
    
    const bboxStr = `${minLng},${minLat},${maxLng},${maxLat}`;
    const tileSize = 256;
    
    const params = new URLSearchParams({
      service: 'WMS',
      request: 'GetMap',
      layers: this.wmsParams.layers,
      styles: '',
      format: 'image/png',
      transparent: 'true',
      version: '1.1.1',
      width: tileSize.toString(),
      height: tileSize.toString(),
      srs: 'EPSG:4326',
      bbox: bboxStr
    });

    return `${this.options.baseWmsUrl}?${params.toString()}`;
  },

  createTile: function (coords: L.Coords, done: L.DoneCallback) {
    const tile = document.createElement('img');
    const tileUrl = this.getTileUrl(coords);
    const layerId = this.options.layerId;
    const useCache = this.options.useCache;

    tile.alt = '';
    tile.setAttribute('role', 'presentation');
    tile.crossOrigin = 'anonymous';

    // Build Supabase proxy URL with WMS params
    const buildSupabaseProxyUrl = (wmsUrl: string) => {
      const wmsUrlObj = new URL(wmsUrl);
      const proxyUrl = new URL(SUPABASE_PROXY_URL);
      // Copy all WMS parameters to the proxy URL
      for (const [key, value] of wmsUrlObj.searchParams.entries()) {
        proxyUrl.searchParams.set(key, value);
      }
      return proxyUrl.toString();
    };

    // Fast network loading with smart source selection
    const loadFromNetwork = () => {
      if (!navigator.onLine) {
        done(null, tile);
        return;
      }

      const abortController = new AbortController();
      let resolved = false;
      
      // Helper to fetch with timeout
      const fetchWithTimeout = (url: string, timeout: number, source: string): Promise<{ blob: Blob; source: string }> => {
        return new Promise((resolve, reject) => {
          if (resolved) {
            reject(new Error('already resolved'));
            return;
          }
          
          const timeoutId = setTimeout(() => {
            reject(new Error('timeout'));
          }, timeout);

          fetch(url, { 
            mode: 'cors', 
            credentials: 'omit',
            signal: abortController.signal,
          })
            .then(async res => {
              clearTimeout(timeoutId);
              if (resolved) {
                reject(new Error('already resolved'));
                return;
              }
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              
              const contentType = res.headers.get('Content-Type') || '';
              if (contentType.includes('xml') || contentType.includes('text/html')) {
                throw new Error('Invalid response type');
              }
              
              const blob = await res.blob();
              // Accept small transparent PNGs too (valid tiles)
              if (!blob.type.startsWith('image/')) {
                throw new Error('Not an image');
              }
              
              // Track success
              if (sourceHealth[source]) {
                sourceHealth[source].failures = 0;
                sourceHealth[source].lastSuccess = Date.now();
              }
              
              resolve({ blob, source });
            })
            .catch(err => {
              clearTimeout(timeoutId);
              // Track failure
              if (sourceHealth[source]) {
                sourceHealth[source].failures++;
              }
              reject(err);
            });
        });
      };

      // Build URLs
      const supabaseProxyUrl = buildSupabaseProxyUrl(tileUrl);
      
      // Sort sources by health (least failures first)
      const sortedSources = Object.entries(sourceHealth)
        .sort((a, b) => {
          // Prioritize by least failures, then by most recent success
          if (a[1].failures !== b[1].failures) return a[1].failures - b[1].failures;
          return b[1].lastSuccess - a[1].lastSuccess;
        })
        .map(([key]) => key);
      
      // Build attempts in order of health
      const attempts: Promise<{ blob: Blob; source: string }>[] = [];
      
      sortedSources.forEach((source, index) => {
        // Stagger starts slightly to reduce server load
        const delay = index * 100;
        let url: string;
        let timeout: number;
        
        if (source === 'supabase') {
          url = supabaseProxyUrl;
          timeout = 4000; // Supabase proxy - reliable but needs more time
        } else if (source === 'direct') {
          url = tileUrl;
          timeout = 1500; // Direct - fast timeout since usually blocked by CORS
        } else if (source.startsWith('public-')) {
          const proxyIndex = parseInt(source.split('-')[1]);
          url = `${PUBLIC_PROXIES[proxyIndex]}${encodeURIComponent(tileUrl)}`;
          timeout = 3000;
        } else {
          return;
        }
        
        if (delay > 0) {
          attempts.push(
            new Promise(resolve => setTimeout(resolve, delay))
              .then(() => fetchWithTimeout(url, timeout, source))
          );
        } else {
          attempts.push(fetchWithTimeout(url, timeout, source));
        }
      });

      // Race all attempts - first successful response wins
      Promise.any(attempts)
        .then(({ blob, source }) => {
          resolved = true;
          // Abort remaining requests
          try { abortController.abort(); } catch {}
          
          console.debug(`[WMS] Tile loaded via ${source}`);
          
          // Cache the tile asynchronously (don't wait) - only cache real content
          if (useCache && blob.type.startsWith('image/') && blob.size > 100) {
            cacheTile(tileUrl, blob, layerId).catch(() => {});
          }
          
          // Render tile immediately
          const objectUrl = URL.createObjectURL(blob);
          tile.onload = () => {
            URL.revokeObjectURL(objectUrl);
            done(null, tile);
          };
          tile.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            done(new Error('Render failed'), tile);
          };
          tile.src = objectUrl;
        })
        .catch(() => {
          // All attempts failed - silenced to reduce console noise in offline mode
          try { abortController.abort(); } catch {}
          // Use debug level instead of warn to reduce noise when offline or WMS unavailable
          console.debug(`[WMS] All sources failed for tile (offline or server unavailable)`);
          done(null, tile);
        });
    };

    if (useCache) {
      // Try cache first - but with minimal blocking
      getCachedTile(tileUrl).then(blob => {
        if (blob && blob.type.startsWith('image/') && blob.size > 100) {
          const objectUrl = URL.createObjectURL(blob);
          tile.onload = () => {
            URL.revokeObjectURL(objectUrl);
            done(null, tile);
          };
          tile.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            if (navigator.onLine) loadFromNetwork();
            else done(null, tile);
          };
          tile.src = objectUrl;
        } else if (navigator.onLine) {
          loadFromNetwork();
        } else {
          done(null, tile);
        }
      }).catch(() => {
        if (navigator.onLine) loadFromNetwork();
        else done(null, tile);
      });
    } else {
      if (navigator.onLine) loadFromNetwork();
      else done(null, tile);
    }

    return tile;
  }
});

export const CachedWMSTileLayer: React.FC<CachedWMSTileLayerProps> = ({
  url,
  layers,
  format = 'image/png',
  transparent = true,
  version = '1.1.1',
  opacity = 1,
  zIndex = 100,
  tileSize = 256,
  detectRetina = false,
  maxZoom = 18,
  layerId,
  useCache = true,
  useProxy = true,
  attribution
}) => {
  const map = useMap();
  const layerRef = useRef<L.TileLayer.WMS | null>(null);
  const prevUseCacheRef = useRef<boolean>(useCache);

  // Create/update layer
  useEffect(() => {
    if (!map) return;

    const wmsLayer = new CachedWMSLayer(url, {
      layers,
      format,
      transparent,
      version,
      opacity,
      zIndex,
      tileSize,
      detectRetina,
      maxZoom,
      layerId,
      useCache,
      useProxy: false,
      baseWmsUrl: BASE_WMS_URL,
      attribution,
      crs: L.CRS.EPSG3857,
      continuousWorld: true,
      // OPTIMIZED: Load during idle AND zooming for smoother experience
      updateWhenIdle: false,
      updateWhenZooming: true,
      // Larger buffer for smoother panning - preload more tiles
      keepBuffer: 8,
      // Aggressive tile loading
      tileLoadingPolicy: 'all'
    });

    if (typeof zIndex === 'number') {
      (wmsLayer as any).setZIndex(zIndex);
    }

    console.log(`[CachedWMSTileLayer] Adding layer ${layerId} to map`);

    wmsLayer.addTo(map);
    layerRef.current = wmsLayer;
    prevUseCacheRef.current = useCache;

    return () => {
      if (layerRef.current) {
        console.log(`[CachedWMSTileLayer] Removing layer ${layerId} from map`);
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, url, layers, format, transparent, version, zIndex, tileSize, detectRetina, maxZoom, layerId, useProxy, attribution]);

  // Update opacity without recreating layer
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.setOpacity(opacity);
    }
  }, [opacity]);

  // Update useCache option
  useEffect(() => {
    if (layerRef.current) {
      const wasUsingCache = prevUseCacheRef.current;
      (layerRef.current.options as any).useCache = useCache;
      
      if (useCache && !wasUsingCache) {
        layerRef.current.redraw();
        console.log(`[CachedWMSTileLayer] Enabled cache for ${layerId}, redrawing`);
      }
      
      prevUseCacheRef.current = useCache;
    }
  }, [useCache, layerId]);

  return null;
};

export default CachedWMSTileLayer;
