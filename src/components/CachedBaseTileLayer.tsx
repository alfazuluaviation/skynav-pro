/**
 * CachedBaseTileLayer
 * A TileLayer component for base maps (OSM, CartoDB, OpenTopo) with IndexedDB caching.
 * Tiles are served from cache when available, with network fallback.
 */

import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getCachedTile, cacheTile } from '../services/tileCache';

interface CachedBaseTileLayerProps {
  url: string;
  layerId: string;
  useCache?: boolean;
  maxZoom?: number;
  attribution?: string;
}

// Custom TileLayer class with IndexedDB caching
const CachedTileLayerClass = L.TileLayer.extend({
  options: {
    layerId: '',
    useCache: true
  },

  createTile: function (coords: L.Coords, done: L.DoneCallback) {
    const tile = document.createElement('img');
    const tileUrl = this.getTileUrl(coords);
    const layerId = this.options.layerId;
    const useCache = this.options.useCache;

    tile.alt = '';
    tile.setAttribute('role', 'presentation');
    tile.crossOrigin = 'anonymous';

    const loadFromNetwork = () => {
      tile.onload = () => {
        // Cache the tile after loading from network
        if (useCache) {
          fetch(tileUrl, { mode: 'cors', credentials: 'omit' })
            .then(res => {
              if (res.ok) return res.blob();
              throw new Error(`HTTP ${res.status}`);
            })
            .then(blob => {
              cacheTile(tileUrl, blob, layerId);
            })
            .catch((err) => {
              console.debug('[BASE TILE] Failed to cache:', err);
            });
        }
        done(null, tile);
      };

      tile.onerror = () => {
        console.debug(`[BASE TILE MISS] ${layerId} - network failed:`, tileUrl);
        // Return empty tile on error (for offline mode)
        done(null, tile);
      };

      tile.src = tileUrl;
    };

    if (useCache) {
      // Normalize URL for cache lookup (subdomains a/b/c/d -> a)
      // Esri URLs don't need normalization (single endpoint)
      const normalizedUrl = tileUrl
        .replace(/https:\/\/[abcd]\.tile\.openstreetmap\.org/, 'https://a.tile.openstreetmap.org')
        .replace(/https:\/\/[abcd]\.basemaps\.cartocdn\.com/, 'https://a.basemaps.cartocdn.com')
        .replace(/https:\/\/[abc]\.tile\.opentopomap\.org/, 'https://a.tile.opentopomap.org');
      // Note: Esri (arcgisonline.com) URLs are already normalized (no subdomains)
      
      // Try to load from cache first
      getCachedTile(normalizedUrl).then(blob => {
        if (blob && blob.size > 0) {
          console.log(`[BASE CACHE HIT] ${layerId} tile loaded from cache`);
          const objectUrl = URL.createObjectURL(blob);
          tile.onload = () => {
            URL.revokeObjectURL(objectUrl);
            done(null, tile);
          };
          tile.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            // Only try network if online
            if (navigator.onLine) {
              loadFromNetwork();
            } else {
              done(null, tile); // Return empty tile offline
            }
          };
          tile.src = objectUrl;
        } else {
          // Only try network if online
          if (navigator.onLine) {
            loadFromNetwork();
          } else {
            console.debug(`[BASE TILE] ${layerId} - offline and not cached:`, tileUrl);
            done(null, tile); // Return empty tile offline
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
      if (navigator.onLine) {
        loadFromNetwork();
      } else {
        done(null, tile);
      }
    }

    return tile;
  }
});

export const CachedBaseTileLayer: React.FC<CachedBaseTileLayerProps> = ({
  url,
  layerId,
  useCache = true,
  maxZoom = 19,
  attribution
}) => {
  const map = useMap();
  const layerRef = useRef<L.TileLayer | null>(null);

  const prevUseCacheRef = useRef<boolean>(useCache);

  // Create layer - NOT including useCache in deps to prevent recreation
  useEffect(() => {
    if (!map) return;

    const tileLayer = new CachedTileLayerClass(url, {
      layerId,
      useCache,
      maxZoom,
      attribution,
      crossOrigin: 'anonymous',
      // OPTIMIZED: Don't reload during zoom animation
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 4
    });

    tileLayer.addTo(map);
    layerRef.current = tileLayer;
    prevUseCacheRef.current = useCache;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
    // NOTE: Intentionally NOT including useCache to prevent layer recreation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, url, layerId, maxZoom, attribution]);

  // Update useCache option WITHOUT redraw when disabling cache
  // This prevents the layer from disappearing when clearing offline cache
  useEffect(() => {
    if (layerRef.current) {
      const wasUsingCache = prevUseCacheRef.current;
      (layerRef.current.options as any).useCache = useCache;
      
      // CRITICAL: Only redraw when ENABLING cache
      // When DISABLING, keep tiles visible - new ones load on next pan/zoom
      if (useCache && !wasUsingCache) {
        layerRef.current.redraw();
        console.log(`[CachedBaseTileLayer] Enabled cache for ${layerId}, redrawing`);
      } else if (!useCache && wasUsingCache) {
        console.log(`[CachedBaseTileLayer] Disabled cache for ${layerId}, keeping tiles visible`);
      }
      
      prevUseCacheRef.current = useCache;
    }
  }, [useCache, layerId]);

  return null;
};

export default CachedBaseTileLayer;
