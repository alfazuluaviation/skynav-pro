/**
 * CachedWMSTileLayer
 * A WMS tile layer component that uses IndexedDB for offline caching.
 * Tiles are served from cache when available, with network fallback.
 */

import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getCachedTile, cacheTile } from '../services/tileCache';

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
  attribution?: string;
}

// Custom TileLayer class with IndexedDB caching
const CachedWMSLayer = L.TileLayer.WMS.extend({
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

    // Set crossOrigin before src
    tile.crossOrigin = 'anonymous';

    const loadFromNetwork = () => {
      tile.onload = () => {
        // Cache the tile after loading from network
        if (useCache) {
          fetch(tileUrl, { mode: 'cors', credentials: 'omit' })
            .then(res => res.blob())
            .then(blob => {
              cacheTile(tileUrl, blob, layerId);
            })
            .catch(() => {
              // Ignore caching errors
            });
        }
        done(null, tile);
      };

      tile.onerror = () => {
        done(new Error('Failed to load tile'), tile);
      };

      tile.src = tileUrl;
    };

    if (useCache) {
      // Try to load from cache first
      getCachedTile(tileUrl).then(blob => {
        if (blob) {
          // Create object URL from cached blob
          const objectUrl = URL.createObjectURL(blob);
          tile.onload = () => {
            URL.revokeObjectURL(objectUrl);
            done(null, tile);
          };
          tile.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            // Fallback to network
            loadFromNetwork();
          };
          tile.src = objectUrl;
        } else {
          loadFromNetwork();
        }
      }).catch(() => {
        loadFromNetwork();
      });
    } else {
      loadFromNetwork();
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
  attribution
}) => {
  const map = useMap();
  const layerRef = useRef<L.TileLayer.WMS | null>(null);

  useEffect(() => {
    if (!map) return;

    // Create the cached WMS layer
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
      attribution,
      // Additional WMS options for better quality
      crs: L.CRS.EPSG3857,
      // Optimize loading
      updateWhenIdle: false,
      updateWhenZooming: false,
      keepBuffer: 4
    });

    wmsLayer.addTo(map);
    layerRef.current = wmsLayer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, url, layers, format, transparent, version, opacity, zIndex, tileSize, detectRetina, maxZoom, layerId, useCache, attribution]);

  // Update opacity if it changes
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.setOpacity(opacity);
    }
  }, [opacity]);

  return null;
};

export default CachedWMSTileLayer;
