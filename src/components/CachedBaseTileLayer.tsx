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
      const normalizedUrl = tileUrl
        .replace(/https:\/\/[abcd]\.tile\.openstreetmap\.org/, 'https://a.tile.openstreetmap.org')
        .replace(/https:\/\/[abcd]\.basemaps\.cartocdn\.com/, 'https://a.basemaps.cartocdn.com')
        .replace(/https:\/\/[abc]\.tile\.opentopomap\.org/, 'https://a.tile.opentopomap.org');
      
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

  useEffect(() => {
    if (!map) return;

    const tileLayer = new CachedTileLayerClass(url, {
      layerId,
      useCache,
      maxZoom,
      attribution,
      crossOrigin: 'anonymous'
    });

    tileLayer.addTo(map);
    layerRef.current = tileLayer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, url, layerId, useCache, maxZoom, attribution]);

  return null;
};

export default CachedBaseTileLayer;
