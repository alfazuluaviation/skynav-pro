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

// Supabase edge function URL for WMS proxy
const SUPABASE_URL = "https://gongoqjjpwphhttumdjm.supabase.co";
const WMS_PROXY_URL = `${SUPABASE_URL}/functions/v1/proxy-wms`;

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

// Custom TileLayer class with IndexedDB caching and proxy support
const CachedWMSLayer = L.TileLayer.WMS.extend({
  options: {
    layerId: '',
    useCache: true,
    useProxy: true,
    proxyUrl: WMS_PROXY_URL
  },

  // Override getTileUrl to use proxy with correct EPSG:4326 coordinates
  // MUST match the URL format used in chartDownloader.ts for cache to work
  getTileUrl: function (coords: L.Coords) {
    // Convert tile coordinates to bounding box using same logic as chartDownloader
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
    
    // WMS 1.1.1 bbox format: minx,miny,maxx,maxy (lon,lat,lon,lat for EPSG:4326)
    const bboxStr = `${minLng},${minLat},${maxLng},${maxLat}`;
    
    // 256px tiles are significantly lighter (esp. iOS) and match Leaflet defaults.
    const tileSize = this.options.tileSize || 256;
    
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

    // Use proxy if enabled, otherwise direct URL
    if (this.options.useProxy) {
      return `${this.options.proxyUrl}?${params.toString()}`;
    }
    
    return `${this._url}?${params.toString()}`;
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

      // Use fetch with AbortController for better offline handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      fetch(tileUrl, { 
        mode: 'cors', 
        credentials: 'omit',
        signal: controller.signal 
      })
        .then(res => {
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        })
        .then(blob => {
          // Cache the blob
          if (useCache) {
            cacheTile(tileUrl, blob, layerId);
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
          clearTimeout(timeoutId);
          // Silently handle network errors when offline
          if (!navigator.onLine || err.name === 'AbortError' || err.message?.includes('Failed to fetch')) {
            console.debug(`[WMS OFFLINE] ${layerId} - network unavailable`);
          } else {
            console.debug('Failed to load tile:', err.message);
          }
          done(null, tile); // Return empty tile on error
        });
    };

    if (useCache) {
      // Try to load from cache first
      getCachedTile(tileUrl).then(blob => {
        if (blob && blob.size > 0) {
          console.log(`[CACHE HIT] ${layerId} tile loaded from cache, size: ${blob.size} bytes, type: ${blob.type}`);
          
          // Validate blob type is an image
          if (!blob.type.startsWith('image/')) {
            console.warn(`[CACHE INVALID] ${layerId} - cached blob is not an image: ${blob.type}`);
            if (navigator.onLine) {
              loadFromNetwork();
            } else {
              done(null, tile);
            }
            return;
          }
          
          // Create object URL from cached blob
          const objectUrl = URL.createObjectURL(blob);
          tile.onload = () => {
            console.debug(`[CACHE RENDER OK] ${layerId} tile rendered successfully`);
            URL.revokeObjectURL(objectUrl);
            done(null, tile);
          };
          tile.onerror = (err) => {
            console.warn(`[CACHE ERROR] Failed to render cached tile for ${layerId}:`, err);
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
          // No cache - only load from network if online
          if (navigator.onLine) {
            console.debug(`[CACHE MISS] ${layerId} - loading from network`);
            console.debug(`[MISS URL] ${tileUrl.substring(0, 150)}...`);
            loadFromNetwork();
          } else {
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

    // Create the cached WMS layer - use simple Mercator for tile coords
    // but generate EPSG:4326 bbox in getTileUrl to match chartDownloader
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
      useProxy,
      proxyUrl: WMS_PROXY_URL,
      attribution,
      // Use simple Mercator CRS for tile coordinate system
      // but we convert to EPSG:4326 bbox in getTileUrl
      crs: L.CRS.EPSG3857,
      continuousWorld: true,
      // Optimize loading
      updateWhenIdle: false,
      updateWhenZooming: false,
      keepBuffer: 4
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