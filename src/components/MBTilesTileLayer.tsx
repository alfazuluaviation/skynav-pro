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
import { getMBTileWithBoundsCheck, getMBTilesFileIds, logMultiHit, isStrictBoundsEnabled, selectBestFile } from '../services/mbtilesReader';
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

    // Track which files provided tiles (for debugging)
    const tileSourceLog = (window as any).__mbtilesSourceLog || new Set<string>();
    (window as any).__mbtilesSourceLog = tileSourceLog;
    
    // Track failed tile coordinates for detailed logging
    const tileFailLog = (window as any).__mbtilesFailLog || new Set<string>();
    (window as any).__mbtilesFailLog = tileFailLog;

    // Try to get tile from MBTiles files WITH geographic bounds validation
    // This prevents "patchwork" errors where tiles from wrong subcharts appear
    const tryLoadTile = async () => {
      // Query all files in parallel with bounds checking
      const results = await Promise.all(
        fileIds.map(async (fileId) => {
          try {
            const { blob, rejected, reason } = await getMBTileWithBoundsCheck(fileId, z, x, y);
            if (blob && blob.size > 0 && !rejected) {
              return { fileId, blob, rejected: false };
            }
            return { fileId, blob: null, rejected, reason };
          } catch {
            return { fileId, blob: null, rejected: false };
          }
        })
      );

      // Filter to only valid results (not rejected by bounds, has data)
      const validResults = results.filter(r => r.blob !== null && !r.rejected) as Array<{ fileId: string; blob: Blob; rejected: boolean }>;
      
      // Log multi-hit if more than one file has this tile (potential overlap issue)
      if (validResults.length > 1) {
        logMultiHit(z, x, y, validResults.map(r => r.fileId));
      }
      
      // Use DETERMINISTIC selection based on margin score
      // This ensures the same file is always chosen for overlapping regions
      const selectedResult = selectBestFile(
        validResults.map(r => ({ fileId: r.fileId, blob: r.blob })),
        z, x, y
      );
      
      if (selectedResult && selectedResult.blob) {
        const { fileId, blob } = selectedResult;
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
          console.warn(`[MBTiles Layer] ❌ Render failed for tile z=${z} x=${x} y=${y} from ${fileId}`);
          // Return transparent tile on error
          tile.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
          done(null, tile);
        };
        
        tile.src = objectUrl;
      } else {
        // No valid tile found - check if all were rejected by bounds
        const rejectedCount = results.filter(r => r.rejected).length;
        const notFoundCount = results.filter(r => !r.rejected && !r.blob).length;
        
        // Log detailed failure info (first 15 per session)
        const failKey = `${z}_${x}_${y}`;
        if (!tileFailLog.has(failKey)) {
          tileFailLog.add(failKey);
          if (tileFailLog.size <= 15) {
            const strictMode = isStrictBoundsEnabled() ? 'ON' : 'OFF';
            console.debug(
              `[MBTiles Layer] 📭 No tile: z=${z} x=${x} y=${y} | ` +
              `Rejected: ${rejectedCount}, NotFound: ${notFoundCount} | ` +
              `StrictBounds: ${strictMode}`
            );
          }
        }
        // Return transparent tile
        tile.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        done(null, tile);
      }
    };

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
        // OPTIMIZED: Larger buffer for pre-loading neighboring tiles (6 tiles in each direction)
        keepBuffer: 6,
        // OPTIMIZED: Update tiles during map movement, not just when idle
        // This makes panning feel much smoother as tiles load continuously
        updateWhenIdle: false,
        updateWhenZooming: true,
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
