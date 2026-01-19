import { useState, useCallback, useRef, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const LAST_UPDATE_KEY = 'pwa_last_update_date';

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
      console.log('SW Registered: ' + swUrl);
      registrationRef.current = r || null;
      // Check for updates every 30 seconds
      if (r) {
        setInterval(() => {
          r.update();
        }, 30 * 1000);
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const handleUpdate = useCallback(() => {
    const now = formatDate();
    localStorage.setItem(LAST_UPDATE_KEY, now);
    setLastUpdateDate(now);
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
      }
      // Update last check time
      const now = formatDate();
      localStorage.setItem(LAST_UPDATE_KEY, now);
      setLastUpdateDate(now);
    } catch (error) {
      console.error('Error checking for updates:', error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    needRefresh,
    lastUpdateDate,
    handleUpdate,
    dismissUpdate,
    checkForUpdate,
    isChecking,
  };
};
