/**
 * MBTiles Tile Layer Component
 * 
 * Leaflet tile layer that reads tiles from MBTiles files for offline use.
 * Uses the MBTiles reader service to extract tiles from SQLite databases.
 * 
 * This component is ONLY used for offline mode.
 * When online, the standard CachedWMSTileLayer is used.
 */

import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getMBTile, getMBTilesFileIds } from '../services/mbtilesReader';
import { getMBTilesConfig } from '../config/mbtilesConfig';

interface MBTilesTileLayerProps {
  chartId: string;
  opacity?: number;
  zIndex?: number;
  minZoom?: number;
  maxZoom?: number;
}

// Custom TileLayer class that reads from MBTiles
const MBTilesTileLayerClass = L.TileLayer.extend({
  options: {
    chartId: '',
    fileIds: [] as string[],
    minZoom: 4,
    maxZoom: 11,
  },

  initialize: function(options: L.TileLayerOptions & { chartId: string; fileIds: string[] }) {
    L.TileLayer.prototype.initialize.call(this, '', options);
    this.options.chartId = options.chartId;
    this.options.fileIds = options.fileIds;
  },

  createTile: function(coords: L.Coords, done: L.DoneCallback) {
    const tile = document.createElement('img');
    tile.alt = '';
    tile.setAttribute('role', 'presentation');
    
    const { x, y, z } = coords;
    const fileIds = this.options.fileIds as string[];

    // Try to get tile from any of the MBTiles files
    // IMPORTANT: Each file covers a different geographic region, so we must try ALL files
    // Use Promise.all to query ALL files simultaneously for faster loading
    const tryLoadTile = async () => {
      // Query all files in parallel for this tile coordinate
      const results = await Promise.all(
        fileIds.map(async (fileId) => {
          try {
            const blob = await getMBTile(fileId, z, x, y);
            if (blob && blob.size > 0) {
              return { fileId, blob };
            }
            return null;
          } catch {
            return null;
          }
        })
      );

      // Find the first valid result
      const validResult = results.find(r => r !== null);
      
      if (validResult) {
        const { fileId, blob } = validResult;
        const objectUrl = URL.createObjectURL(blob);
        
        tile.onload = () => {
          URL.revokeObjectURL(objectUrl);
          // Log which file provided the tile (first 20 per session)
          if (!tileSourceLog.has(`${z}_${x}_${y}`)) {
            tileSourceLog.add(`${z}_${x}_${y}`);
            if (tileSourceLog.size <= 20) {
              console.log(`[MBTiles Layer] 🗺️ Tile z=${z} x=${x} y=${y} loaded from: ${fileId}`);
            }
          }
          done(null, tile);
        };
        
        tile.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          console.warn(`[MBTiles Layer] ❌ Failed to load tile z=${z} x=${x} y=${y} from ${fileId}`);
          // Return transparent tile on error
          tile.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
          done(null, tile);
        };
        
        tile.src = objectUrl;
      } else {
        // No tile found in any file - return transparent tile
        tile.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        done(null, tile);
      }
    };
    
    // Track which files provided tiles (for debugging)
    const tileSourceLog = (window as any).__mbtilesSourceLog || new Set<string>();
    (window as any).__mbtilesSourceLog = tileSourceLog;

    tryLoadTile();
    return tile;
  },

  getTileUrl: function() {
    // Not used - tiles are loaded from MBTiles
    return '';
  }
});

export const MBTilesTileLayer: React.FC<MBTilesTileLayerProps> = ({
  chartId,
  opacity = 1,
  zIndex = 100,
  minZoom = 4,
  maxZoom = 11,
}) => {
  const map = useMap();
  const layerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!map) return;

    const initLayer = async () => {
      // Get all MBTiles file IDs for this chart
      const fileIds = await getMBTilesFileIds(chartId);
      
      if (fileIds.length === 0) {
        console.warn(`[MBTiles Layer] No MBTiles files available for ${chartId}`);
        return;
      }

      console.log(`[MBTiles Layer] Loading ${chartId} with ${fileIds.length} MBTiles files`);

      // Get zoom config from MBTiles config
      const config = getMBTilesConfig(chartId);
      const effectiveMinZoom = config?.zoomLevels.min || minZoom;
      const effectiveMaxZoom = config?.zoomLevels.max || maxZoom;

      const layer = new MBTilesTileLayerClass({
        chartId,
        fileIds,
        opacity,
        zIndex,
        minZoom: effectiveMinZoom,
        maxZoom: effectiveMaxZoom,
        tileSize: 256,
        attribution: '© DECEA (MBTiles offline)',
         // Avoid world wrapping which can display duplicated/"out of bounds" copies
         // when tiles are misaligned or when panning far from the coverage area.
         noWrap: true,
        // Larger buffer for smoother panning
        keepBuffer: 4,
      });

      layer.addTo(map);
      layerRef.current = layer;

      console.log(`[MBTiles Layer] Added ${chartId} layer to map`);
    };

    initLayer();

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
        console.log(`[MBTiles Layer] Removed ${chartId} layer from map`);
      }
    };
  }, [map, chartId, minZoom, maxZoom]);

  // Update opacity
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.setOpacity(opacity);
    }
  }, [opacity]);

  // Update zIndex
  useEffect(() => {
    if (layerRef.current) {
      (layerRef.current as any).setZIndex(zIndex);
    }
  }, [zIndex]);

  return null;
};

export default MBTilesTileLayer;
