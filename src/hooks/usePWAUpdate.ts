import { useEffect, useState, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const LAST_UPDATE_KEY = 'pwa_last_update_date';

export const usePWAUpdate = () => {
  const [lastUpdateDate, setLastUpdateDate] = useState<string | null>(() => {
    return localStorage.getItem(LAST_UPDATE_KEY);
  });

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      console.log('SW Registered: ' + swUrl);
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
    const now = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    localStorage.setItem(LAST_UPDATE_KEY, now);
    setLastUpdateDate(now);
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  return {
    needRefresh,
    lastUpdateDate,
    handleUpdate,
    dismissUpdate,
  };
};
