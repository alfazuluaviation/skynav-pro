/**
 * CachedWMSTileLayer
 * A WMS tile layer component that uses IndexedDB for offline caching.
 * Tiles are served from cache when available, with network fallback.
 * 
 * OPTIMIZED v3:
 * - Concurrent fetches with Promise.any() for fastest response
 * - Aggressive caching with preload buffer
 * - Reduced timeouts and instant fallback
 * - Connection pooling via keepalive
 */

import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getCachedTile, cacheTile } from '../services/tileCache';

// GeoServer direct URL
const BASE_WMS_URL = "https://geoaisweb.decea.mil.br/geoserver/wms";

// Multiple CORS proxies for redundancy - ordered by reliability
const CORS_PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://api.codetabs.com/v1/proxy?quest="
];

// Session-level preferred proxy index (learns which proxy works best)
let preferredProxyIndex = 0;
let consecutiveProxySuccesses = 0;

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

    // Fast network loading with concurrent requests
    const loadFromNetwork = () => {
      if (!navigator.onLine) {
        done(null, tile);
        return;
      }

      const abortController = new AbortController();
      
      // Helper to fetch with timeout - optimized for speed
      const fetchWithTimeout = (url: string, timeout: number, source: string): Promise<{ blob: Blob; source: string }> => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('timeout'));
          }, timeout);

          fetch(url, { 
            mode: 'cors', 
            credentials: 'omit',
            signal: abortController.signal,
            // Keep connection alive for faster subsequent requests
            keepalive: true
          })
            .then(async res => {
              clearTimeout(timeoutId);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              
              const contentType = res.headers.get('Content-Type') || '';
              if (contentType.includes('xml') || contentType.includes('text/')) {
                throw new Error('XML error response');
              }
              
              const blob = await res.blob();
              if (!blob.type.startsWith('image/') || blob.size < 100) {
                throw new Error('Invalid image');
              }
              resolve({ blob, source });
            })
            .catch(err => {
              clearTimeout(timeoutId);
              reject(err);
            });
        });
      };

      // Build concurrent fetch attempts - fire all at once for speed
      const attempts: Promise<{ blob: Blob; source: string }>[] = [];
      
      // Direct access - fastest if CORS works (short timeout)
      attempts.push(
        fetchWithTimeout(tileUrl, 1200, 'direct')
      );
      
      // Preferred proxy (slightly longer timeout)
      const preferredProxyUrl = `${CORS_PROXIES[preferredProxyIndex]}${encodeURIComponent(tileUrl)}`;
      attempts.push(
        fetchWithTimeout(preferredProxyUrl, 2000, `proxy-${preferredProxyIndex}`)
      );

      // Add other proxies with staggered start for fallback
      CORS_PROXIES.forEach((proxy, i) => {
        if (i !== preferredProxyIndex) {
          const proxyUrl = `${proxy}${encodeURIComponent(tileUrl)}`;
          // Stagger start to reduce server load but still compete
          attempts.push(
            new Promise(resolve => setTimeout(resolve, 300 * (i + 1)))
              .then(() => fetchWithTimeout(proxyUrl, 2500, `proxy-${i}`))
          );
        }
      });

      // Race all attempts - first successful response wins
      Promise.any(attempts)
        .then(({ blob, source }) => {
          // Abort remaining requests
          abortController.abort();
          
          // Update preferred proxy based on success
          if (source.startsWith('proxy-')) {
            const proxyIndex = parseInt(source.split('-')[1]);
            if (proxyIndex !== preferredProxyIndex) {
              consecutiveProxySuccesses++;
              if (consecutiveProxySuccesses >= 3) {
                preferredProxyIndex = proxyIndex;
                consecutiveProxySuccesses = 0;
              }
            }
          }
          
          // Cache the tile asynchronously (don't wait)
          if (useCache && blob.type.startsWith('image/')) {
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
          // All attempts failed
          abortController.abort();
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
