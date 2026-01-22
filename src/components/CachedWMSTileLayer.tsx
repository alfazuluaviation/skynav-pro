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
    // Convert tile coordinates to bounding box using same logic as chartDownloader.
    // IMPORTANT: Leaflet tile coords depend on tileSize. When tileSize=512,
    // the tile grid is HALF the size compared to 256px tiles.
    const zoom = coords.z;
    const x = coords.x;
    const y = coords.y;
    
    // Use tileSize from options (512px for better quality on aeronautical charts)
    const tileSize = this.options.tileSize || 512;

    // Grid size must match Leaflet's internal grid for the configured tileSize.
    // baseTileSize=256 is Leaflet's default.
    const baseTileSize = 256;
    const n = Math.max(1, Math.round(Math.pow(2, zoom) * (baseTileSize / tileSize)));

    // Normalize X for world wrap (Leaflet can request x outside 0..n-1)
    const xNorm = ((x % n) + n) % n;
    const yClamped = Math.max(0, Math.min(y, n - 1));

    const minLng = (xNorm / n) * 360 - 180;
    const maxLng = ((xNorm + 1) / n) * 360 - 180;
    
    const minLatRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (yClamped + 1)) / n)));
    const maxLatRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * yClamped) / n)));
    
    const minLat = minLatRad * 180 / Math.PI;
    const maxLat = maxLatRad * 180 / Math.PI;
    
    // WMS 1.1.1 bbox format: minx,miny,maxx,maxy (lon,lat,lon,lat for EPSG:4326)
    const bboxStr = `${minLng},${minLat},${maxLng},${maxLat}`;
    
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
          console.debug(`[WMS LOAD] ${layerId} - received ${blob.size} bytes, type: ${blob.type || contentType}`);
          return blob;
        })
        .then(blob => {
          // Cache valid image blobs (any size is fine for transparent tiles)
          if (useCache && blob.type.startsWith('image/')) {
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
  tileSize = 512,
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