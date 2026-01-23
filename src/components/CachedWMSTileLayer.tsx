/**
 * CachedWMSTileLayer
 * A WMS tile layer component that uses IndexedDB for offline caching.
 * Tiles are served from cache when available, with network fallback.
 * Uses a proxy to avoid CORS issues with DECEA GeoServer.
 */

import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getCachedTile, cacheTile } from '../services/tileCache';

// GeoServer direct URL (CORS usually works for viewing, download uses proxy fallback)
const BASE_WMS_URL = "https://geoaisweb.decea.mil.br/geoserver/wms";
const CORS_PROXY_URL = "https://api.allorigins.win/raw?url=";

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
  layerId: string; // Unique ID for caching
  useCache?: boolean; // Enable/disable cache
  useProxy?: boolean; // Use proxy for CORS
  attribution?: string;
}

// Custom TileLayer class with IndexedDB caching
// Uses direct GeoServer access for viewing (with CORS proxy fallback for download)
const CachedWMSLayer = L.TileLayer.WMS.extend({
  options: {
    layerId: '',
    useCache: true,
    useProxy: false, // Disabled - use direct access for viewing
    baseWmsUrl: BASE_WMS_URL
  },

  // Override getTileUrl to use proxy with correct EPSG:4326 coordinates
  // MUST match the URL format used in chartDownloader.ts for cache to work
  // Uses standard 256px tile size for simplicity and cache consistency
  getTileUrl: function (coords: L.Coords) {
    const zoom = coords.z;
    const x = coords.x;
    const y = coords.y;
    
    // Standard tile calculation (256px tiles)
    const n = Math.pow(2, zoom);
    
    const minLng = x / n * 360 - 180;
    const maxLng = (x + 1) / n * 360 - 180;
    
    const minLatRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)));
    const maxLatRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
    
    const minLat = minLatRad * 180 / Math.PI;
    const maxLat = maxLatRad * 180 / Math.PI;
    
    // WMS 1.1.1 bbox format: minx,miny,maxx,maxy (lon,lat,lon,lat for EPSG:4326)
    const bboxStr = `${minLng},${minLat},${maxLng},${maxLat}`;
    
    // Fixed 256px tile size for consistency with cache
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

    // Always use direct URL for cache key consistency
    // The cache was populated using direct URLs from chartDownloader
    return `${this.options.baseWmsUrl}?${params.toString()}`;
  },

  createTile: function (coords: L.Coords, done: L.DoneCallback) {
    const tile = document.createElement('img');
    const tileUrl = this.getTileUrl(coords);
    const layerId = this.options.layerId;
    const useCache = this.options.useCache;

    tile.alt = '';
    tile.setAttribute('role', 'presentation');

    // Set crossOrigin before src
    tile.crossOrigin = 'anonymous';

    const loadFromNetwork = () => {
      // Block network requests when offline
      if (!navigator.onLine) {
        console.debug(`[WMS OFFLINE] ${layerId} - skipping network request`);
        done(null, tile); // Return empty tile
        return;
      }

      // Helper function to load tile from a URL
      const attemptLoad = (url: string, isProxy: boolean = false): Promise<Blob> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        return fetch(url, { 
          mode: 'cors', 
          credentials: 'omit',
          signal: controller.signal 
        })
          .then(async res => {
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const contentType = res.headers.get('Content-Type') || '';
            
            // If server returned XML (error), handle gracefully
            if (contentType.includes('xml') || contentType.includes('text/')) {
              const text = await res.text();
              if (text.includes('ServiceException')) {
                console.warn(`[WMS ERROR] ${layerId} - GeoServer error`);
              }
              throw new Error('Server returned XML error');
            }
            
            const blob = await res.blob();
            if (isProxy) {
              console.debug(`[WMS PROXY] ${layerId} - received ${blob.size} bytes`);
            } else {
              console.debug(`[WMS DIRECT] ${layerId} - received ${blob.size} bytes`);
            }
            return blob;
          })
          .catch(err => {
            clearTimeout(timeoutId);
            throw err;
          });
      };

      // Try direct access first, then fallback to CORS proxy
      attemptLoad(tileUrl)
        .catch(err => {
          // Direct access failed (likely CORS) - try proxy
          console.debug(`[WMS] Direct access failed for ${layerId}, trying CORS proxy...`);
          const proxyUrl = `${CORS_PROXY_URL}${encodeURIComponent(tileUrl)}`;
          return attemptLoad(proxyUrl, true);
        })
        .then(blob => {
          // Cache valid image blobs (any size is fine for transparent tiles)
          if (useCache && blob.type.startsWith('image/')) {
            cacheTile(tileUrl, blob, layerId); // Always cache with direct URL as key
          }
          // Create object URL and load into tile
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
          // Both direct and proxy failed
          if (!navigator.onLine || err.name === 'AbortError' || err.message?.includes('Failed to fetch')) {
            console.debug(`[WMS OFFLINE] ${layerId} - network unavailable`);
          } else {
            console.debug(`[WMS FAILED] ${layerId}:`, err.message);
          }
          done(null, tile); // Return empty tile on error
        });
    };

    if (useCache) {
      // Try to load from cache first
      getCachedTile(tileUrl).then(blob => {
        // Validate blob: must be an image type (any size is valid - transparent tiles can be small)
        const isValidCachedTile = blob && blob.type.startsWith('image/');
        
        if (isValidCachedTile) {
          console.debug(`[CACHE HIT] ${layerId} tile loaded from cache, size: ${blob.size} bytes`);
          
          // Create object URL from cached blob
          const objectUrl = URL.createObjectURL(blob);
          tile.onload = () => {
            URL.revokeObjectURL(objectUrl);
            done(null, tile);
          };
          tile.onerror = (err) => {
            console.warn(`[CACHE ERROR] Failed to render ${layerId}:`, err);
            URL.revokeObjectURL(objectUrl);
            // Fallback to network only if online
            if (navigator.onLine) {
              loadFromNetwork();
            } else {
              done(null, tile);
            }
          };
          tile.src = objectUrl;
        } else {
          // Cache miss or invalid cache entry - load from network if online
          if (navigator.onLine) {
            if (blob) {
              console.debug(`[CACHE INVALID] ${layerId} - type: ${blob.type}, reloading`);
            } else {
              console.debug(`[CACHE MISS] ${layerId} - loading from network`);
            }
            loadFromNetwork();
          } else {
            // Offline with no valid cache - return empty tile
            console.debug(`[WMS OFFLINE] ${layerId} - not cached, returning empty tile`);
            done(null, tile);
          }
        }
      }).catch((err) => {
        // IndexedDB might not be available
        console.warn(`[CACHE UNAVAILABLE] ${layerId} - IndexedDB error:`, err.message || err);
        if (navigator.onLine) {
          loadFromNetwork();
        } else {
          done(null, tile);
        }
      });
    } else {
      // Cache disabled - only load from network if online
      if (navigator.onLine) {
        console.debug(`[CACHE DISABLED] ${layerId} - loading from network`);
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

  useEffect(() => {
    if (!map) return;

    // Create the cached WMS layer
    // IMPORTANT: Keep CRS consistent with Leaflet MapContainer (default EPSG:3857)
    // Our getTileUrl implementation assumes standard WebMercator tile coordinates (x/y/z)
    // and then converts to an EPSG:4326 bbox for the WMS request.
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
      useProxy: false, // Use direct access, cache handles offline
      baseWmsUrl: BASE_WMS_URL,
      attribution,
      // Keep WebMercator to avoid tile coord mismatches (this fixes charts disappearing on zoom)
      crs: L.CRS.EPSG3857,
      continuousWorld: true,
      // IMPORTANT: Allow updates during zoom for proper tile refresh
      updateWhenIdle: true,
      updateWhenZooming: true,
      keepBuffer: 2
    });

    // Set zIndex after creation
    if (typeof zIndex === 'number') {
      (wmsLayer as any).setZIndex(zIndex);
    }

    console.log(`[CachedWMSTileLayer] Adding layer ${layerId} to map with zIndex=${zIndex}, useCache=${useCache}, tileSize=${tileSize}`);

    wmsLayer.addTo(map);
    layerRef.current = wmsLayer;

    return () => {
      if (layerRef.current) {
        console.log(`[CachedWMSTileLayer] Removing layer ${layerId} from map`);
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, url, layers, format, transparent, version, opacity, zIndex, tileSize, detectRetina, maxZoom, layerId, useCache, useProxy, attribution]);

  // Update opacity if it changes
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.setOpacity(opacity);
    }
  }, [opacity]);

  return null;
};

export default CachedWMSTileLayer;