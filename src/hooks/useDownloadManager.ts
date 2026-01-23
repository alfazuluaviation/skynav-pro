/**
 * React hook for the Download Manager
 * Provides reactive access to download state and actions
 */

import { useState, useEffect, useCallback } from 'react';
import { DownloadTask, getDownloadManager } from '../services/downloadManager';
import { BaseMapLayerId } from '../config/chartLayers';
import { DownloadStats } from '../services/chartDownloader';

export function useDownloadManager() {
  const [tasks, setTasks] = useState<Record<string, DownloadTask>>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const manager = getDownloadManager();
    
    // Subscribe to task updates
    const unsubscribe = manager.subscribe(setTasks);
    
    // Subscribe to online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const downloadChart = useCallback(async (layerId: string): Promise<boolean> => {
    const manager = getDownloadManager();
    return manager.downloadChart(layerId);
  }, []);
  
  const downloadBaseMap = useCallback(async (layerId: string): Promise<boolean> => {
    const manager = getDownloadManager();
    // Extract actual ID if it has BASEMAP_ prefix
    const baseMapId = layerId.startsWith('BASEMAP_') 
      ? layerId.replace('BASEMAP_', '') as BaseMapLayerId
      : layerId as BaseMapLayerId;
    return manager.downloadBaseMap(baseMapId);
  }, []);
  
  const getProgress = useCallback((layerId: string): number | undefined => {
    const manager = getDownloadManager();
    return manager.getProgress(layerId);
  }, []);
  
  const isDownloading = useCallback((layerId: string): boolean => {
    const manager = getDownloadManager();
    return manager.isDownloading(layerId);
  }, []);
  
  const clearTask = useCallback((layerId: string) => {
    const manager = getDownloadManager();
    manager.clearTask(layerId);
  }, []);

  // Get syncing layers as a Record<string, number> for compatibility
  const syncingLayers = Object.entries(tasks).reduce((acc, [id, task]) => {
    if (task.status === 'downloading') {
      acc[id] = task.progress;
    }
    return acc;
  }, {} as Record<string, number>);

  // Get download stats for each layer
  const downloadStats = Object.entries(tasks).reduce((acc, [id, task]) => {
    if (task.stats) {
      acc[id] = task.stats;
    }
    return acc;
  }, {} as Record<string, DownloadStats>);

  // Get error message for a layer
  const getError = useCallback((layerId: string): string | undefined => {
    return tasks[layerId]?.error;
  }, [tasks]);
  
  return {
    tasks,
    syncingLayers,
    downloadStats,
    isOnline,
    downloadChart,
    downloadBaseMap,
    getProgress,
    isDownloading,
    clearTask,
    getError
  };
}
