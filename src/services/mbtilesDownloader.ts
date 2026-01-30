/**
 * MBTiles Downloader Service
 * 
 * Downloads MBTiles packages from Google Drive.
 * Extracts ZIP files and stores individual .mbtiles files in IndexedDB.
 * 
 * This is ISOLATED from the WMS tile download system.
 * Only used for ENRC LOW in this test phase.
 */

import JSZip from 'jszip';
import { getMBTilesConfig, MBTILES_PACKAGES } from '../config/mbtilesConfig';
import { storeMBTilesFile, isMBTilesFileAvailable, deleteMBTilesFile } from './mbtilesStorage';

export interface MBTilesDownloadProgress {
  phase: 'downloading' | 'extracting' | 'storing' | 'complete' | 'error';
  progress: number; // 0-100
  bytesDownloaded: number;
  totalBytes: number;
  currentFile?: string;
  message: string;
}

export type ProgressCallback = (progress: MBTilesDownloadProgress) => void;

/**
 * Download MBTiles package for a chart
 */
export async function downloadMBTilesPackage(
  chartId: string,
  onProgress?: ProgressCallback
): Promise<boolean> {
  const config = getMBTilesConfig(chartId);
  if (!config) {
    console.error(`[MBTiles Downloader] No config for chart: ${chartId}`);
    onProgress?.({
      phase: 'error',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: 0,
      message: `Configuração não encontrada para ${chartId}`
    });
    return false;
  }

  console.log(`[MBTiles Downloader] Starting download of ${config.name}`);

  try {
    // Phase 1: Download ZIP file from Google Drive
    onProgress?.({
      phase: 'downloading',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: config.expectedSize,
      message: 'Iniciando download...'
    });

    const zipData = await downloadZipFile(config.directDownloadUrl, (downloaded, total) => {
      const progress = total > 0 ? Math.round((downloaded / total) * 50) : 0; // 0-50%
      onProgress?.({
        phase: 'downloading',
        progress,
        bytesDownloaded: downloaded,
        totalBytes: total || config.expectedSize,
        message: `Baixando ${(downloaded / 1024 / 1024).toFixed(1)} MB...`
      });
    });

    if (!zipData) {
      throw new Error('Falha ao baixar arquivo ZIP');
    }

    console.log(`[MBTiles Downloader] Downloaded ${(zipData.byteLength / 1024 / 1024).toFixed(2)} MB`);

    // Phase 2: Extract ZIP file
    onProgress?.({
      phase: 'extracting',
      progress: 50,
      bytesDownloaded: zipData.byteLength,
      totalBytes: zipData.byteLength,
      message: 'Extraindo arquivos...'
    });

    const extractedFiles = await extractZipFile(zipData, (fileName, fileProgress) => {
      const progress = 50 + Math.round(fileProgress * 30); // 50-80%
      onProgress?.({
        phase: 'extracting',
        progress,
        bytesDownloaded: zipData.byteLength,
        totalBytes: zipData.byteLength,
        currentFile: fileName,
        message: `Extraindo ${fileName}...`
      });
    });

    console.log(`[MBTiles Downloader] Extracted ${Object.keys(extractedFiles).length} files`);

    // Phase 3: Parse manifest and store MBTiles files
    let manifestData = null;
    if (extractedFiles[config.manifestFileName]) {
      try {
        const manifestText = new TextDecoder().decode(extractedFiles[config.manifestFileName]);
        manifestData = JSON.parse(manifestText);
        console.log(`[MBTiles Downloader] Manifest parsed:`, manifestData);
      } catch (e) {
        console.warn(`[MBTiles Downloader] Failed to parse manifest:`, e);
      }
    }

    // Store each .mbtiles file
    const mbtilesFiles = Object.entries(extractedFiles).filter(([name]) => 
      name.endsWith('.mbtiles')
    );

    if (mbtilesFiles.length === 0) {
      throw new Error('Nenhum arquivo .mbtiles encontrado no pacote');
    }

    onProgress?.({
      phase: 'storing',
      progress: 80,
      bytesDownloaded: zipData.byteLength,
      totalBytes: zipData.byteLength,
      message: `Salvando ${mbtilesFiles.length} arquivos...`
    });

    let storedCount = 0;
    for (const [fileName, fileData] of mbtilesFiles) {
      const fileId = `${config.id}_${fileName.replace('.mbtiles', '')}`;
      
      onProgress?.({
        phase: 'storing',
        progress: 80 + Math.round((storedCount / mbtilesFiles.length) * 20),
        bytesDownloaded: zipData.byteLength,
        totalBytes: zipData.byteLength,
        currentFile: fileName,
        message: `Salvando ${fileName}...`
      });

      await storeMBTilesFile(fileId, chartId, fileName, fileData, manifestData);
      storedCount++;
    }

    // Store a combined reference for the entire package
    await storeMBTilesFile(
      config.id,
      chartId,
      config.fileName,
      new ArrayBuffer(0), // Empty data, just for tracking
      manifestData
    );

    onProgress?.({
      phase: 'complete',
      progress: 100,
      bytesDownloaded: zipData.byteLength,
      totalBytes: zipData.byteLength,
      message: 'Download concluído!'
    });

    console.log(`[MBTiles Downloader] Successfully downloaded and stored ${config.name}`);
    return true;

  } catch (error) {
    console.error(`[MBTiles Downloader] Error:`, error);
    onProgress?.({
      phase: 'error',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: config.expectedSize,
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
    return false;
  }
}

/**
 * Download ZIP file with progress tracking
 */
async function downloadZipFile(
  url: string,
  onProgress: (downloaded: number, total: number) => void
): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0');
    
    if (!response.body) {
      // Fallback: no streaming support
      const buffer = await response.arrayBuffer();
      onProgress(buffer.byteLength, buffer.byteLength);
      return buffer;
    }

    // Stream download with progress
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let downloaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      if (value) {
        chunks.push(value);
        downloaded += value.length;
        onProgress(downloaded, contentLength);
      }
    }

    // Combine chunks
    const combined = new Uint8Array(downloaded);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return combined.buffer;
  } catch (error) {
    console.error('[MBTiles Downloader] Download error:', error);
    return null;
  }
}

/**
 * Extract ZIP file
 */
async function extractZipFile(
  zipData: ArrayBuffer,
  onProgress: (fileName: string, progress: number) => void
): Promise<Record<string, ArrayBuffer>> {
  const zip = await JSZip.loadAsync(zipData);
  const files: Record<string, ArrayBuffer> = {};
  
  const fileNames = Object.keys(zip.files).filter(name => !zip.files[name].dir);
  let processed = 0;

  for (const fileName of fileNames) {
    const file = zip.files[fileName];
    if (!file.dir) {
      // Extract only the file name (not the path)
      const baseName = fileName.split('/').pop() || fileName;
      const data = await file.async('arraybuffer');
      files[baseName] = data;
      
      processed++;
      onProgress(baseName, processed / fileNames.length);
    }
  }

  return files;
}

/**
 * Check if MBTiles package is downloaded
 */
export async function isMBTilesPackageDownloaded(chartId: string): Promise<boolean> {
  const config = getMBTilesConfig(chartId);
  if (!config) return false;

  return await isMBTilesFileAvailable(config.id);
}

/**
 * Delete MBTiles package
 */
export async function deleteMBTilesPackage(chartId: string): Promise<void> {
  const config = getMBTilesConfig(chartId);
  if (!config) return;

  // Delete the main package reference
  await deleteMBTilesFile(config.id);

  // Note: Individual .mbtiles files would need to be tracked and deleted separately
  // For simplicity in this test, we delete the main reference
  console.log(`[MBTiles Downloader] Deleted package ${config.id}`);
}
