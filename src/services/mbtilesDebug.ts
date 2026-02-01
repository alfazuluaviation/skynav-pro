/**
 * MBTiles runtime debug helpers.
 *
 * This module is intentionally console-driven (no UI) to avoid impacting
 * existing map behavior. It lets us audit which candidates exist for a tile,
 * their computed scores, and which one is selected.
 */

import {
  getCachedMetadata,
  getMBTileWithBoundsCheck,
  getMBTilesFileIds,
  isStrictBoundsEnabled,
  selectBestFile,
  setStrictBoundsEnabled,
  MBTILES_SELECTION_THRESHOLDS,
} from './mbtilesReader';

import {
  calculateBoundsArea,
  calculateMarginScore,
  calculateOverlapRatio,
  getTileBounds,
  getTileCenter,
} from './mbtilesGeo';

type DebugCandidate = {
  fileId: string;
  fileName?: string;
  rejectedByBounds: boolean;
  rejectReason?: string;
  hasTile: boolean;
  tileBytes?: number;
  isBlank?: boolean;
  overlap?: number;
  margin?: number;
  boundsArea?: number;
  meetsOverlap?: boolean;
  meetsMargin?: boolean;
  meetsThresholds?: boolean;
};

export async function debugTileSelection(chartId: string, z: number, x: number, y: number) {
  const fileIds = await getMBTilesFileIds(chartId);
  const center = getTileCenter(z, x, y);
  const tileBounds = getTileBounds(z, x, y);

  const candidates: DebugCandidate[] = await Promise.all(
    fileIds.map(async (fileId) => {
      const { blob, rejected, reason } = await getMBTileWithBoundsCheck(fileId, z, x, y);
      const meta = getCachedMetadata(fileId);

      const base: DebugCandidate = {
        fileId,
        fileName: meta?.fileName,
        rejectedByBounds: Boolean(rejected),
        rejectReason: reason,
        hasTile: Boolean(blob),
        tileBytes: blob?.size,
      };

      if (!meta?.parsedBounds) return base;

      const overlap = calculateOverlapRatio(tileBounds, meta.parsedBounds, MBTILES_SELECTION_THRESHOLDS.BOUNDS_TOLERANCE);
      const margin = calculateMarginScore(center.lat, center.lng, meta.parsedBounds);
      const boundsArea = calculateBoundsArea(meta.parsedBounds);
      const isBlank = Boolean(blob && blob.size > 0 && blob.size <= MBTILES_SELECTION_THRESHOLDS.BLANK_TILE_MAX_BYTES);
      const meetsOverlap = overlap >= MBTILES_SELECTION_THRESHOLDS.MIN_OVERLAP_RATIO;
      const meetsMargin = margin >= MBTILES_SELECTION_THRESHOLDS.MIN_MARGIN_SCORE;

      return {
        ...base,
        overlap,
        margin,
        boundsArea,
        isBlank,
        meetsOverlap,
        meetsMargin,
        meetsThresholds: meetsOverlap && meetsMargin,
      };
    })
  );

  // Re-fetch blobs for selection (keeps candidates list lightweight and avoids storing blobs twice)
  const selectionInputs = await Promise.all(
    candidates
      .filter((c) => c.hasTile && !c.rejectedByBounds)
      .map(async (c) => {
        const { blob } = await getMBTileWithBoundsCheck(c.fileId, z, x, y);
        return blob ? { fileId: c.fileId, blob } : null;
      })
  );

  const selectionPool = selectionInputs.filter(Boolean) as Array<{ fileId: string; blob: Blob }>;
  const winner = selectBestFile(selectionPool, z, x, y);

  const fmtPct = (v?: number) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : 'n/a');
  const fmtNum = (v?: number) => (typeof v === 'number' ? v.toFixed(2) : 'n/a');

  console.groupCollapsed(
    `[MBTiles DEBUG] ${chartId} tile z=${z} x=${x} y=${y} | strictBounds=${isStrictBoundsEnabled() ? 'ON' : 'OFF'}`
  );
  console.log('[MBTiles DEBUG] thresholds:', MBTILES_SELECTION_THRESHOLDS);
  console.log('[MBTiles DEBUG] tileCenter:', center);
  console.log('[MBTiles DEBUG] tileBounds:', tileBounds);

  for (const c of candidates) {
    const shortName = c.fileName || c.fileId.split('_').pop() || c.fileId;
    console.log(
      `→ ${shortName}: ` +
        `hasTile=${c.hasTile} bytes=${c.tileBytes ?? 'n/a'} ` +
        `rejected=${c.rejectedByBounds ? `yes(${c.rejectReason || 'bounds'})` : 'no'} ` +
        `overlap=${fmtPct(c.overlap)} margin=${fmtNum(c.margin)} area=${fmtNum(c.boundsArea)} blank=${c.isBlank ? 'yes' : 'no'} ` +
        `meets=${c.meetsThresholds ? 'yes' : 'no'}`
    );
  }

  if (winner) {
    const meta = getCachedMetadata(winner.fileId);
    console.log(`✔️ Selected: ${meta?.fileName || winner.fileId}`);
  } else {
    console.warn('✔️ Selected: <none> (no candidate returned by selector)');
  }
  console.groupEnd();

  return { chartId, z, x, y, candidates, winnerFileId: winner?.fileId ?? null };
}

export async function debugLastTile() {
  const last = (window as any).__mbtilesLastTile as
    | { chartId?: string; z: number; x: number; y: number; ts?: number }
    | undefined;

  if (!last) {
    console.warn('[MBTiles DEBUG] No last tile recorded yet. Pan/zoom the map with MBTiles active and try again.');
    return null;
  }

  return debugTileSelection(last.chartId || 'LOW', last.z, last.x, last.y);
}

export function installMBTilesDebug() {
  const w = window as any;
  if (w.__mbtilesDebugInstalled) return;

  w.__mbtilesDebugInstalled = true;
  w.__mbtilesDebug = {
    debugTileSelection,
    debugLastTile,
    setStrictBoundsEnabled,
    isStrictBoundsEnabled,
    thresholds: MBTILES_SELECTION_THRESHOLDS,
  };

  console.log('[MBTiles DEBUG] Installed. Try: window.__mbtilesDebug.debugLastTile()');
}
