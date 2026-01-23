/**
 * CachedWMSTileLayer
 * A WMS tile layer component that uses IndexedDB for offline caching.
 * Tiles are served from cache when available, with network fallback.
 * 
 * OPTIMIZED v2:
 * - Promise.race for parallel proxy attempts (faster loading)
 * - Reduced timeouts for snappier fallback
 * - Larger keepBuffer for smoother panning
 */

import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getCachedTile, cacheTile } from '../services/tileCache';

// GeoServer direct URL
const BASE_WMS_URL = "https://geoaisweb.decea.mil.br/geoserver/wms";

// Multiple CORS proxies for redundancy
const CORS_PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://api.codetabs.com/v1/proxy?quest="
];

// Session-level preferred proxy index (learns which proxy works best)
let preferredProxyIndex = 0;

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

    // Network loading with Promise.race for faster response
    const loadFromNetwork = () => {
      if (!navigator.onLine) {
        console.debug(`[WMS OFFLINE] ${layerId} - skipping network request`);
        done(null, tile);
        return;
      }

      // Create abort controller for cleanup
      const masterController = new AbortController();
      
      // Helper to fetch with timeout
      const fetchWithTimeout = (url: string, timeout: number): Promise<Blob> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        // Link to master controller for cleanup
        masterController.signal.addEventListener('abort', () => controller.abort());

        return fetch(url, { 
          mode: 'cors', 
          credentials: 'omit',
          signal: controller.signal 
        })
          .then(async res => {
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const contentType = res.headers.get('Content-Type') || '';
            if (contentType.includes('xml') || contentType.includes('text/')) {
              throw new Error('Server returned XML error');
            }
            
            const blob = await res.blob();
            if (!blob.type.startsWith('image/')) {
              throw new Error('Not an image');
            }
            return blob;
          })
          .catch(err => {
            clearTimeout(timeoutId);
            throw err;
          });
      };

      // Build array of fetch promises: direct + preferred proxy first, then others
      const attempts: Promise<{ blob: Blob; source: string; proxyIndex: number }>[] = [];
      
      // Direct access (fastest if CORS works)
      attempts.push(
        fetchWithTimeout(tileUrl, 1500)
          .then(blob => ({ blob, source: 'direct', proxyIndex: -1 }))
      );
      
      // Preferred proxy (based on previous success)
      const preferredProxyUrl = `${CORS_PROXIES[preferredProxyIndex]}${encodeURIComponent(tileUrl)}`;
      attempts.push(
        fetchWithTimeout(preferredProxyUrl, 2500)
          .then(blob => ({ blob, source: 'proxy', proxyIndex: preferredProxyIndex }))
      );

      // Race direct + preferred proxy
      Promise.race(attempts)
        .catch(() => {
          // Both failed - try remaining proxies sequentially
          const otherProxies = CORS_PROXIES
            .map((proxy, i) => ({ proxy, i }))
            .filter(p => p.i !== preferredProxyIndex);
          
          const tryNext = (index: number): Promise<{ blob: Blob; source: string; proxyIndex: number }> => {
            if (index >= otherProxies.length) {
              return Promise.reject(new Error('All proxies failed'));
            }
            
            const { proxy, i } = otherProxies[index];
            const proxyUrl = `${proxy}${encodeURIComponent(tileUrl)}`;
            
            return fetchWithTimeout(proxyUrl, 3000)
              .then(blob => ({ blob, source: 'proxy', proxyIndex: i }))
              .catch(() => tryNext(index + 1));
          };
          
          return tryNext(0);
        })
        .then(({ blob, proxyIndex }) => {
          // Abort any pending requests
          masterController.abort();
          
          // Update preferred proxy if we used one
          if (proxyIndex >= 0 && proxyIndex !== preferredProxyIndex) {
            preferredProxyIndex = proxyIndex;
            console.debug(`[WMS] Updated preferred proxy to ${proxyIndex + 1}`);
          }
          
          // Cache the tile
          if (useCache && blob.type.startsWith('image/')) {
            cacheTile(tileUrl, blob, layerId);
          }
          
          // Render tile
          const objectUrl = URL.createObjectURL(blob);
          tile.onload = () => {
            URL.revokeObjectURL(objectUrl);
            done(null, tile);
          };
          tile.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            done(new Error('Failed to render tile'), tile);
          };
          tile.src = objectUrl;
        })
        .catch((err) => {
          masterController.abort();
          
          if (!navigator.onLine || err.name === 'AbortError') {
            console.debug(`[WMS OFFLINE] ${layerId} - network unavailable`);
          } else {
            console.debug(`[WMS FAILED] ${layerId}:`, err.message);
          }
          done(null, tile);
        });
    };

    if (useCache) {
      // Try cache first
      getCachedTile(tileUrl).then(blob => {
        const isValidCachedTile = blob && blob.type.startsWith('image/');
        
        if (isValidCachedTile) {
          const objectUrl = URL.createObjectURL(blob);
          tile.onload = () => {
            URL.revokeObjectURL(objectUrl);
            done(null, tile);
          };
          tile.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            if (navigator.onLine) {
              loadFromNetwork();
            } else {
              done(null, tile);
            }
          };
          tile.src = objectUrl;
        } else {
          // Cache miss - try network
          if (navigator.onLine) {
            loadFromNetwork();
          } else {
            done(null, tile);
          }
        }
      }).catch(() => {
        if (navigator.onLine) {
          loadFromNetwork();
        } else {
          done(null, tile);
        }
      });
    } else {
      // Cache disabled
      if (navigator.onLine) {
        loadFromNetwork();
      } else {
        done(null, tile);
      }
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
      updateWhenIdle: true,
      updateWhenZooming: false,
      // OPTIMIZED: Larger buffer for smoother panning
      keepBuffer: 6
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
      
      // Only redraw when ENABLING cache
      if (useCache && !wasUsingCache) {
        layerRef.current.redraw();
        console.log(`[CachedWMSTileLayer] Enabled cache for ${layerId}, redrawing`);
      } else if (!useCache && wasUsingCache) {
        console.log(`[CachedWMSTileLayer] Disabled cache for ${layerId}, keeping tiles visible`);
      }
      
      prevUseCacheRef.current = useCache;
    }
  }, [useCache, layerId]);

  return null;
};

export default CachedWMSTileLayer;
