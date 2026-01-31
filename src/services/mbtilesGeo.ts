/**
 * Geographic helpers for MBTiles / Slippy Map tiles.
 *
 * We keep these helpers separate to avoid growing mbtilesReader.ts even more.
 */

export type GeoBounds = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

export type TileBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/**
 * Returns [lat, lng] of tile center (XYZ / Slippy Map coordinates).
 */
export function getTileCenter(z: number, x: number, y: number): { lat: number; lng: number } {
  const n = Math.pow(2, z);
  const lng = ((x + 0.5) / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n)));
  const lat = latRad * (180 / Math.PI);
  return { lat, lng };
}

/**
 * Returns the geographic bounds of a tile (XYZ / Slippy Map coordinates).
 */
export function getTileBounds(z: number, x: number, y: number): TileBounds {
  const n = Math.pow(2, z);
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;

  // y is north->south
  const latNorthRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  const latSouthRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)));

  const north = latNorthRad * (180 / Math.PI);
  const south = latSouthRad * (180 / Math.PI);

  return { west, south, east, north };
}

/**
 * Higher score = point is more centered within bounds (further from edges).
 */
export function calculateMarginScore(lat: number, lng: number, bounds: GeoBounds): number {
  const marginLeft = lng - bounds.minLng;
  const marginRight = bounds.maxLng - lng;
  const marginBottom = lat - bounds.minLat;
  const marginTop = bounds.maxLat - lat;
  return Math.min(marginLeft, marginRight, marginBottom, marginTop);
}

/**
 * Computes how much the tile overlaps the file bounds.
 * Returns a ratio [0..1] of (intersection area / tile area) in degrees.
 *
 * Note: it's not true surface area (Mercator), but it's a stable heuristic
 * to disambiguate large tiles at low zoom.
 */
export function calculateOverlapRatio(tile: TileBounds, bounds: GeoBounds, toleranceDeg = 0): number {
  const minLng = bounds.minLng - toleranceDeg;
  const minLat = bounds.minLat - toleranceDeg;
  const maxLng = bounds.maxLng + toleranceDeg;
  const maxLat = bounds.maxLat + toleranceDeg;

  const ixWest = Math.max(tile.west, minLng);
  const ixEast = Math.min(tile.east, maxLng);
  const ixSouth = Math.max(tile.south, minLat);
  const ixNorth = Math.min(tile.north, maxLat);

  const ixW = ixEast - ixWest;
  const ixH = ixNorth - ixSouth;
  if (ixW <= 0 || ixH <= 0) return 0;

  const tileW = tile.east - tile.west;
  const tileH = tile.north - tile.south;
  const tileArea = tileW * tileH;
  if (tileArea <= 0) return 0;

  const ixArea = ixW * ixH;
  return Math.max(0, Math.min(1, ixArea / tileArea));
}
