/**
 * MBTiles Configuration for Offline Charts
 * 
 * This configuration is for the TEST phase with ENRC LOW only.
 * If successful, it can be expanded to other charts.
 */

import { supabase } from '@/integrations/supabase/client';

export interface MBTilesPackageConfig {
  id: string;
  chartId: string;
  name: string;
  description: string;
  // Google Drive file ID
  gdriveFileId: string;
  fileName: string;
  expectedSize: number; // in bytes
  zoomLevels: { min: number; max: number };
  manifestFileName: string;
  // Tile coordinate scheme: 'xyz' (web standard) or 'tms' (inverted Y)
  tileScheme: 'xyz' | 'tms';
}

// Google Drive file ID for ENRC LOW (v2026.01 - corrected package)
const ENRC_LOW_FILE_ID = '1PBeSyP3cj9tbMa2A-XXwgIqKt_QIoAwg';

// Get the proxy URL for downloading from Google Drive
export function getProxyDownloadUrl(fileId: string): string {
  // Use Supabase Edge Function as proxy to bypass CORS
  const supabaseUrl = (supabase as any).supabaseUrl || 'https://gongoqjjpwphhttumdjm.supabase.co';
  return `${supabaseUrl}/functions/v1/proxy-gdrive?fileId=${encodeURIComponent(fileId)}`;
}

export const MBTILES_PACKAGES: Record<string, MBTilesPackageConfig> = {
  LOW: {
    id: 'ENRC_LOW_MBTILES',
    chartId: 'LOW',
    name: 'ENRC LOW (MBTiles)',
    description: 'Cartas de Rota IFR Baixa Altitude - Pacote Offline MBTiles',
    gdriveFileId: ENRC_LOW_FILE_ID,
    fileName: 'ENRC_LOW_2026_01.zip',
    expectedSize: 338 * 1024 * 1024, // ~338MB
    zoomLevels: { min: 4, max: 11 },
    manifestFileName: 'manifest.json',
    // QGIS exports use XYZ scheme - forced, no auto-detection
    tileScheme: 'xyz',
  }
};

// Storage paths by platform
export const STORAGE_PATHS = {
  // Web: Uses Origin Private File System (OPFS) or IndexedDB fallback
  web: 'mbtiles/',
  // Android: External storage
  android: '/storage/emulated/0/skyfpl/mbtiles/',
  // iOS: Documents directory
  ios: 'Documents/mbtiles/',
};

// MBTiles database constants
export const MBTILES_CONSTANTS = {
  DB_NAME: 'skyfpl-mbtiles-cache',
  DB_VERSION: 1,
  STORE_NAME: 'mbtiles_files',
  METADATA_STORE: 'mbtiles_metadata',
  // IndexedDB store for mbtiles file chunks (for large files)
  CHUNKS_STORE: 'mbtiles_chunks',
  CHUNK_SIZE: 4 * 1024 * 1024, // 4MB chunks for storing large files
};

// Check if MBTiles is available for a given chart
export function isMBTilesAvailable(chartId: string): boolean {
  return chartId in MBTILES_PACKAGES;
}

// Get MBTiles config for a chart
export function getMBTilesConfig(chartId: string): MBTilesPackageConfig | null {
  return MBTILES_PACKAGES[chartId] || null;
}
