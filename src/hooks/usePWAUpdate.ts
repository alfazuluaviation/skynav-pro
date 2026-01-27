import { useState, useCallback, useRef, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const LAST_UPDATE_KEY = 'pwa_last_update_date';
const APP_VERSION_KEY = 'pwa_app_version';
const FORCE_UPDATE_KEY = 'pwa_force_update_pending';

// Increment this version whenever you want to force all users to update
const CURRENT_APP_VERSION = '1.0.1';

const formatDate = () => {
  return new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const usePWAUpdate = () => {
  const [lastUpdateDate, setLastUpdateDate] = useState<string | null>(() => {
    return localStorage.getItem(LAST_UPDATE_KEY);
  });
  const [isChecking, setIsChecking] = useState(false);
  const [forceUpdateRequired, setForceUpdateRequired] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Check if version mismatch requires force update
  useEffect(() => {
    const storedVersion = localStorage.getItem(APP_VERSION_KEY);
    const forcePending = localStorage.getItem(FORCE_UPDATE_KEY);
    
    if (storedVersion !== CURRENT_APP_VERSION || forcePending === 'true') {
      console.log(`[PWA] Version mismatch: stored=${storedVersion}, current=${CURRENT_APP_VERSION}`);
      setForceUpdateRequired(true);
    }
  }, []);

  // Set initial date if none exists
  useEffect(() => {
    if (!lastUpdateDate) {
      const now = formatDate();
      localStorage.setItem(LAST_UPDATE_KEY, now);
      setLastUpdateDate(now);
    }
  }, [lastUpdateDate]);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      console.log('[PWA] SW Registered: ' + swUrl);
      registrationRef.current = r || null;
      
      // Check for updates only when online and less frequently (every 5 minutes)
      if (r) {
        // Only check if online
        if (navigator.onLine) {
          r.update().catch(err => console.log('[PWA] Initial update check failed:', err));
        }
        
        // Check for updates every 5 minutes (only when online)
        setInterval(() => {
          if (navigator.onLine) {
            console.log('[PWA] Checking for updates...');
            r.update().catch(err => console.log('[PWA] Update check failed:', err));
          }
        }, 5 * 60 * 1000); // 5 minutes instead of 30 seconds
      }
    },
    onRegisterError(error) {
      console.log('[PWA] SW registration error', error);
    },
    onNeedRefresh() {
      console.log('[PWA] New content available, refresh needed');
      // Only show update prompt if online
      if (navigator.onLine) {
        setNeedRefresh(true);
      }
    },
    onOfflineReady() {
      console.log('[PWA] App ready to work offline');
    },
  });

  // Force update when version mismatch is detected
  useEffect(() => {
    if (forceUpdateRequired && registrationRef.current) {
      console.log('[PWA] Force update required - triggering update');
      localStorage.setItem(FORCE_UPDATE_KEY, 'true');
      
      // Clear all caches and force reload
      clearAllCaches().then(() => {
        handleUpdate();
      });
    }
  }, [forceUpdateRequired]);

  const clearAllCaches = async () => {
    try {
      // Clear all service worker caches
      const cacheNames = await caches.keys();
      console.log('[PWA] Clearing caches:', cacheNames);
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('[PWA] All caches cleared');
    } catch (error) {
      console.error('[PWA] Error clearing caches:', error);
    }
  };

  const handleUpdate = useCallback(() => {
    const now = formatDate();
    localStorage.setItem(LAST_UPDATE_KEY, now);
    localStorage.setItem(APP_VERSION_KEY, CURRENT_APP_VERSION);
    localStorage.removeItem(FORCE_UPDATE_KEY);
    setLastUpdateDate(now);
    setForceUpdateRequired(false);
    
    console.log('[PWA] Updating service worker and reloading...');
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  const checkForUpdate = useCallback(async () => {
    setIsChecking(true);
    try {
      if (registrationRef.current) {
        await registrationRef.current.update();
        console.log('[PWA] Manual update check completed');
      }
      // Update last check time
      const now = formatDate();
      localStorage.setItem(LAST_UPDATE_KEY, now);
      setLastUpdateDate(now);
    } catch (error) {
      console.error('[PWA] Error checking for updates:', error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const forceRefresh = useCallback(async () => {
    console.log('[PWA] Force refresh initiated');
    setIsChecking(true);
    
    try {
      // 1. Unregister all service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('[PWA] Service worker unregistered');
      }
      
      // 2. Clear all caches
      await clearAllCaches();
      
      // 3. Update version
      localStorage.setItem(APP_VERSION_KEY, CURRENT_APP_VERSION);
      localStorage.removeItem(FORCE_UPDATE_KEY);
      const now = formatDate();
      localStorage.setItem(LAST_UPDATE_KEY, now);
      
      // 4. Hard reload
      console.log('[PWA] Performing hard reload...');
      window.location.reload();
    } catch (error) {
      console.error('[PWA] Error during force refresh:', error);
      // Fallback: just reload
      window.location.reload();
    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    needRefresh: needRefresh || forceUpdateRequired,
    lastUpdateDate,
    handleUpdate,
    dismissUpdate,
    checkForUpdate,
    forceRefresh,
    isChecking,
    currentVersion: CURRENT_APP_VERSION,
    forceUpdateRequired,
  };
};
