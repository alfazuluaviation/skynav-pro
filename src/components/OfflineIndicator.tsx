/**
 * OfflineIndicator
 * Visual indicator that displays when the device is offline.
 * Helps pilots know they're using cached data.
 */

import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[2000] 
                    bg-amber-500/90 text-black px-4 py-2 rounded-full 
                    font-bold text-sm flex items-center gap-2 shadow-lg
                    animate-pulse">
      <WifiOff className="w-4 h-4" />
      MODO OFFLINE
    </div>
  );
};

export default OfflineIndicator;
