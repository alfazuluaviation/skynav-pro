/**
 * Download Manager Service
 * Singleton that manages all downloads in background with:
 * - Network connectivity checks before starting
 * - Persistent downloads that continue in background
 * - Progress tracking across page navigation
 * - Real-time stats with time estimates
 */

import { downloadChartLayer, DownloadStats } from './chartDownloader';
import { downloadBaseMapLayer } from './baseMapDownloader';
import { BaseMapLayerId } from '../config/chartLayers';

export interface DownloadTask {
  id: string;
  type: 'chart' | 'basemap';
  status: 'pending' | 'downloading' | 'complete' | 'error';
  progress: number;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  stats?: DownloadStats;
}

type DownloadListener = (tasks: Record<string, DownloadTask>) => void;

class DownloadManager {
  private static instance: DownloadManager;
  private tasks: Record<string, DownloadTask> = {};
  private listeners: Set<DownloadListener> = new Set();
  private activeDownloads: Set<string> = new Set();

  private constructor() {
    // Restore any pending downloads from localStorage on init
    this.restoreState();
    
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  public static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager();
    }
    return DownloadManager.instance;
  }

  /**
   * Check if we have internet connectivity
   */
  public isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Subscribe to download state changes
   */
  public subscribe(listener: DownloadListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener({ ...this.tasks });
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get all current tasks
   */
  public getTasks(): Record<string, DownloadTask> {
    return { ...this.tasks };
  }

  /**
   * Get progress for a specific layer
   */
  public getProgress(layerId: string): number | undefined {
    const task = this.tasks[layerId];
    if (task && (task.status === 'downloading' || task.status === 'pending')) {
      return task.progress;
    }
    return undefined;
  }

  /**
   * Check if a download is in progress
   */
  public isDownloading(layerId: string): boolean {
    return this.activeDownloads.has(layerId);
  }

  /**
   * Start a chart layer download
   */
  public async downloadChart(layerId: string): Promise<boolean> {
    // Check connectivity first
    if (!this.isOnline()) {
      console.warn('[DownloadManager] Cannot start download - no internet connection');
      this.notifyError(layerId, 'Sem conexão com a internet');
      return false;
    }

    // Check if already downloading
    if (this.activeDownloads.has(layerId)) {
      console.log('[DownloadManager] Download already in progress:', layerId);
      return true;
    }

    return this.startDownload(layerId, 'chart');
  }

  /**
   * Start a base map layer download
   */
  public async downloadBaseMap(layerId: BaseMapLayerId): Promise<boolean> {
    const fullId = `BASEMAP_${layerId}`;
    
    // Check connectivity first
    if (!this.isOnline()) {
      console.warn('[DownloadManager] Cannot start download - no internet connection');
      this.notifyError(fullId, 'Sem conexão com a internet');
      return false;
    }

    // Check if already downloading
    if (this.activeDownloads.has(fullId)) {
      console.log('[DownloadManager] Download already in progress:', fullId);
      return true;
    }

    return this.startDownload(fullId, 'basemap');
  }

  /**
   * Start a download task
   */
  private async startDownload(layerId: string, type: 'chart' | 'basemap'): Promise<boolean> {
    // Create task
    this.tasks[layerId] = {
      id: layerId,
      type,
      status: 'downloading',
      progress: 0,
      startedAt: Date.now()
    };
    
    this.activeDownloads.add(layerId);
    this.saveState();
    this.notifyListeners();

    try {
      const progressCallback = (progress: number, stats?: DownloadStats) => {
        this.updateProgress(layerId, progress, stats);
      };

      let success: boolean;
      
      if (type === 'basemap') {
        // Extract the actual layer ID (remove BASEMAP_ prefix)
        const baseMapId = layerId.replace('BASEMAP_', '') as BaseMapLayerId;
        success = await downloadBaseMapLayer(baseMapId, progressCallback);
      } else {
        success = await downloadChartLayer(layerId, progressCallback);
      }

      if (success) {
        this.completeDownload(layerId);
      } else {
        this.failDownload(layerId, 'Falha ao baixar');
      }

      return success;
    } catch (error) {
      console.error('[DownloadManager] Download failed:', error);
      this.failDownload(layerId, error instanceof Error ? error.message : 'Erro desconhecido');
      return false;
    }
  }

  /**
   * Update progress for a download
   */
  private updateProgress(layerId: string, progress: number, stats?: DownloadStats) {
    if (this.tasks[layerId]) {
      this.tasks[layerId].progress = progress;
      if (stats) {
        this.tasks[layerId].stats = stats;
      }
      this.saveState();
      this.notifyListeners();
    }
  }

  /**
   * Mark a download as complete
   */
  private completeDownload(layerId: string) {
    if (this.tasks[layerId]) {
      this.tasks[layerId].status = 'complete';
      this.tasks[layerId].progress = 100;
      this.tasks[layerId].completedAt = Date.now();
    }
    this.activeDownloads.delete(layerId);
    this.saveState();
    this.notifyListeners();
  }

  /**
   * Mark a download as failed
   */
  private failDownload(layerId: string, error: string) {
    if (this.tasks[layerId]) {
      this.tasks[layerId].status = 'error';
      this.tasks[layerId].error = error;
    }
    this.activeDownloads.delete(layerId);
    this.saveState();
    this.notifyListeners();
  }

  /**
   * Notify error without starting download
   */
  private notifyError(layerId: string, error: string) {
    this.tasks[layerId] = {
      id: layerId,
      type: layerId.startsWith('BASEMAP_') ? 'basemap' : 'chart',
      status: 'error',
      progress: 0,
      error
    };
    this.notifyListeners();
    
    // Clear error after 3 seconds
    setTimeout(() => {
      if (this.tasks[layerId]?.status === 'error') {
        delete this.tasks[layerId];
        this.notifyListeners();
      }
    }, 3000);
  }

  /**
   * Clear a completed/failed task
   */
  public clearTask(layerId: string) {
    delete this.tasks[layerId];
    this.saveState();
    this.notifyListeners();
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners() {
    const tasksCopy = { ...this.tasks };
    this.listeners.forEach(listener => listener(tasksCopy));
  }

  /**
   * Save state to localStorage
   */
  private saveState() {
    try {
      // Only save downloading/pending tasks
      const toSave: Record<string, DownloadTask> = {};
      for (const [id, task] of Object.entries(this.tasks)) {
        if (task.status === 'downloading' || task.status === 'pending') {
          toSave[id] = task;
        }
      }
      localStorage.setItem('downloadManager_tasks', JSON.stringify(toSave));
      localStorage.setItem('downloadManager_active', JSON.stringify([...this.activeDownloads]));
    } catch (e) {
      console.warn('[DownloadManager] Failed to save state:', e);
    }
  }

  /**
   * Restore state from localStorage
   */
  private restoreState() {
    try {
      const tasksJson = localStorage.getItem('downloadManager_tasks');
      const activeJson = localStorage.getItem('downloadManager_active');
      
      if (tasksJson) {
        const savedTasks = JSON.parse(tasksJson) as Record<string, DownloadTask>;
        // Mark any previously downloading tasks as needing resume
        for (const task of Object.values(savedTasks)) {
          if (task.status === 'downloading') {
            // Task was interrupted - mark as pending for manual resume
            task.status = 'error';
            task.error = 'Download interrompido. Clique para tentar novamente.';
          }
        }
        this.tasks = savedTasks;
      }
      
      // Clear active downloads on restore - they need to be restarted manually
      if (activeJson) {
        localStorage.removeItem('downloadManager_active');
      }
    } catch (e) {
      console.warn('[DownloadManager] Failed to restore state:', e);
    }
  }

  /**
   * Handle coming back online
   */
  private handleOnline = () => {
    console.log('[DownloadManager] Connection restored');
    this.notifyListeners();
  };

  /**
   * Handle going offline
   */
  private handleOffline = () => {
    console.log('[DownloadManager] Connection lost');
    // Downloads will continue with cached data but new requests will fail
    this.notifyListeners();
  };
}

// Export singleton getter
export const getDownloadManager = () => DownloadManager.getInstance();

// Hook is exported from src/hooks/useDownloadManager.ts
