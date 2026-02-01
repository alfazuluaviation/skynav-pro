/**
 * Native Storage Service for Capacitor
 * 
 * Provides file system operations using @capacitor/filesystem for native apps.
 * Falls back gracefully to IndexedDB operations for web.
 */

import { isCapacitorNative, getStoragePath } from '../utils/environment';

// Dynamic import of Capacitor Filesystem (only loaded in native context)
let Filesystem: any = null;
let Directory: any = null;
let Encoding: any = null;

/**
 * Initialize Capacitor Filesystem (lazy load)
 */
async function initFilesystem(): Promise<boolean> {
  if (!isCapacitorNative()) return false;
  
  if (Filesystem) return true;
  
  try {
    const module = await import('@capacitor/filesystem');
    Filesystem = module.Filesystem;
    Directory = module.Directory;
    Encoding = module.Encoding;
    console.log('[NativeStorage] Capacitor Filesystem initialized');
    return true;
  } catch (error) {
    console.error('[NativeStorage] Failed to load Capacitor Filesystem:', error);
    return false;
  }
}

/**
 * Ensure a directory exists in native storage
 */
export async function ensureDirectory(path: string): Promise<boolean> {
  if (!await initFilesystem()) return false;
  
  try {
    await Filesystem.mkdir({
      path: getStoragePath(path),
      directory: Directory.Data,
      recursive: true
    });
    return true;
  } catch (error: any) {
    // Directory might already exist
    if (error?.message?.includes('exists')) return true;
    console.error('[NativeStorage] Failed to create directory:', error);
    return false;
  }
}

/**
 * Write a file to native storage
 */
export async function writeFile(
  path: string, 
  data: ArrayBuffer | Blob | string,
  encoding?: 'utf8' | 'base64'
): Promise<boolean> {
  if (!await initFilesystem()) return false;
  
  try {
    let dataToWrite: string;
    let finalEncoding = Encoding.UTF8;
    
    if (typeof data === 'string') {
      dataToWrite = data;
      finalEncoding = encoding === 'base64' ? undefined : Encoding.UTF8;
    } else if (data instanceof Blob) {
      // Convert Blob to base64
      dataToWrite = await blobToBase64(data);
      finalEncoding = undefined; // Base64 doesn't use encoding
    } else {
      // ArrayBuffer - convert to base64
      dataToWrite = arrayBufferToBase64(data);
      finalEncoding = undefined;
    }
    
    await Filesystem.writeFile({
      path: getStoragePath(path),
      data: dataToWrite,
      directory: Directory.Data,
      encoding: finalEncoding,
      recursive: true
    });
    
    console.log(`[NativeStorage] File written: ${path}`);
    return true;
  } catch (error) {
    console.error('[NativeStorage] Failed to write file:', error);
    return false;
  }
}

/**
 * Read a file from native storage as ArrayBuffer
 */
export async function readFile(path: string): Promise<ArrayBuffer | null> {
  if (!await initFilesystem()) return null;
  
  try {
    const result = await Filesystem.readFile({
      path: getStoragePath(path),
      directory: Directory.Data
    });
    
    // Result is base64 string, convert to ArrayBuffer
    if (typeof result.data === 'string') {
      return base64ToArrayBuffer(result.data);
    }
    
    // If it's already a Blob (newer Capacitor versions)
    if (result.data instanceof Blob) {
      return await result.data.arrayBuffer();
    }
    
    console.warn('[NativeStorage] Unexpected data type:', typeof result.data);
    return null;
  } catch (error) {
    console.error('[NativeStorage] Failed to read file:', error);
    return null;
  }
}

/**
 * Read a file from native storage as string
 */
export async function readFileAsString(path: string): Promise<string | null> {
  if (!await initFilesystem()) return null;
  
  try {
    const result = await Filesystem.readFile({
      path: getStoragePath(path),
      directory: Directory.Data,
      encoding: Encoding.UTF8
    });
    
    return result.data as string;
  } catch (error) {
    console.error('[NativeStorage] Failed to read file as string:', error);
    return null;
  }
}

/**
 * Check if a file exists in native storage
 */
export async function fileExists(path: string): Promise<boolean> {
  if (!await initFilesystem()) return false;
  
  try {
    await Filesystem.stat({
      path: getStoragePath(path),
      directory: Directory.Data
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a file from native storage
 */
export async function deleteFile(path: string): Promise<boolean> {
  if (!await initFilesystem()) return false;
  
  try {
    await Filesystem.deleteFile({
      path: getStoragePath(path),
      directory: Directory.Data
    });
    console.log(`[NativeStorage] File deleted: ${path}`);
    return true;
  } catch (error) {
    console.error('[NativeStorage] Failed to delete file:', error);
    return false;
  }
}

/**
 * List files in a directory
 */
export async function listDirectory(path: string): Promise<string[]> {
  if (!await initFilesystem()) return [];
  
  try {
    const result = await Filesystem.readdir({
      path: getStoragePath(path),
      directory: Directory.Data
    });
    
    return result.files.map((f: any) => f.name || f);
  } catch (error) {
    console.error('[NativeStorage] Failed to list directory:', error);
    return [];
  }
}

/**
 * Get file info (size, modification time)
 */
export async function getFileInfo(path: string): Promise<{ size: number; mtime: number } | null> {
  if (!await initFilesystem()) return null;
  
  try {
    const result = await Filesystem.stat({
      path: getStoragePath(path),
      directory: Directory.Data
    });
    
    return {
      size: result.size || 0,
      mtime: result.mtime || Date.now()
    };
  } catch (error) {
    return null;
  }
}

// ============ Utility Functions ============

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
