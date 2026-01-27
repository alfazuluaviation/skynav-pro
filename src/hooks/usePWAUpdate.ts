import { useState, useCallback, useRef, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const LAST_UPDATE_KEY = 'pwa_last_update_date';
const APP_VERSION_KEY = 'pwa_app_version';
const UPDATE_DISMISSED_KEY = 'pwa_update_dismissed_version';

// Increment this version whenever you want to notify users of an update
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
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

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
      
      // Only check for updates when online and less frequently
      if (r && navigator.onLine) {
        r.update().catch(err => console.log('[PWA] Initial update check failed:', err));
        
        // Check for updates every 10 minutes (only when online)
        setInterval(() => {
          if (navigator.onLine) {
            console.log('[PWA] Checking for updates...');
            r.update().catch(err => console.log('[PWA] Update check failed:', err));
          }
        }, 10 * 60 * 1000); // 10 minutes
      }
    },
    onRegisterError(error) {
      console.log('[PWA] SW registration error', error);
    },
    onNeedRefresh() {
      console.log('[PWA] New content available, refresh needed');
      // Only show update prompt if online AND user hasn't dismissed this version
      if (navigator.onLine) {
        const dismissedVersion = localStorage.getItem(UPDATE_DISMISSED_KEY);
        const storedVersion = localStorage.getItem(APP_VERSION_KEY);
        
        // Only show if this is a genuinely new version
        if (storedVersion !== CURRENT_APP_VERSION && dismissedVersion !== CURRENT_APP_VERSION) {
          setShowUpdatePrompt(true);
          setNeedRefresh(true);
        }
      }
    },
    onOfflineReady() {
      console.log('[PWA] App ready to work offline');
    },
  });

  // Check on mount if we should show update prompt (only if online)
  useEffect(() => {
    if (!navigator.onLine) {
      console.log('[PWA] Offline - skipping update check');
      return;
    }
    
    const storedVersion = localStorage.getItem(APP_VERSION_KEY);
    const dismissedVersion = localStorage.getItem(UPDATE_DISMISSED_KEY);
    
    // Only show prompt if version is different AND user hasn't dismissed
    if (storedVersion !== CURRENT_APP_VERSION && dismissedVersion !== CURRENT_APP_VERSION) {
      console.log(`[PWA] Version mismatch: stored=${storedVersion}, current=${CURRENT_APP_VERSION}`);
      setShowUpdatePrompt(true);
    }
  }, []);

  const handleUpdate = useCallback(() => {
    const now = formatDate();
    localStorage.setItem(LAST_UPDATE_KEY, now);
    localStorage.setItem(APP_VERSION_KEY, CURRENT_APP_VERSION);
    localStorage.removeItem(UPDATE_DISMISSED_KEY);
    setLastUpdateDate(now);
    setShowUpdatePrompt(false);
    
    console.log('[PWA] Updating service worker and reloading...');
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  const dismissUpdate = useCallback(() => {
    // Save that user dismissed this specific version - won't show again until next version
    localStorage.setItem(UPDATE_DISMISSED_KEY, CURRENT_APP_VERSION);
    localStorage.setItem(APP_VERSION_KEY, CURRENT_APP_VERSION);
    setNeedRefresh(false);
    setShowUpdatePrompt(false);
    console.log('[PWA] Update dismissed for version:', CURRENT_APP_VERSION);
  }, [setNeedRefresh]);

  const checkForUpdate = useCallback(async () => {
    if (!navigator.onLine) {
      console.log('[PWA] Cannot check for updates while offline');
      return;
    }
    
    setIsChecking(true);
    try {
      if (registrationRef.current) {
        await registrationRef.current.update();
        console.log('[PWA] Manual update check completed');
      }
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
    if (!navigator.onLine) {
      console.log('[PWA] Cannot force refresh while offline');
      return;
    }
    
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
      const cacheNames = await caches.keys();
      console.log('[PWA] Clearing caches:', cacheNames);
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('[PWA] All caches cleared');
      
      // 3. Update version
      localStorage.setItem(APP_VERSION_KEY, CURRENT_APP_VERSION);
      localStorage.removeItem(UPDATE_DISMISSED_KEY);
      const now = formatDate();
      localStorage.setItem(LAST_UPDATE_KEY, now);
      
      // 4. Hard reload
      console.log('[PWA] Performing hard reload...');
      window.location.reload();
    } catch (error) {
      console.error('[PWA] Error during force refresh:', error);
      window.location.reload();
    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    needRefresh: showUpdatePrompt && navigator.onLine,
    lastUpdateDate,
    handleUpdate,
    dismissUpdate,
    checkForUpdate,
    forceRefresh,
    isChecking,
    currentVersion: CURRENT_APP_VERSION,
    forceUpdateRequired: false, // Never force, always let user decide
  };
};
