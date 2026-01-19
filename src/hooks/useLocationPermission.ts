import { useState, useEffect, useCallback } from 'react';

export type LocationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

// Detect iOS/iPad
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const useLocationPermission = () => {
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>('unknown');
  const [isRequesting, setIsRequesting] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Check permission status on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        // iOS Safari doesn't support permissions.query for geolocation
        // We need to handle it differently
        if (isIOS()) {
          // On iOS, we can't check permission status without requesting
          // So we start with 'prompt' status
          setPermissionStatus('prompt');
          return;
        }

        // Check if Permissions API is available (works on Android/Chrome)
        if ('permissions' in navigator) {
          try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            setPermissionStatus(result.state as LocationPermissionStatus);
            
            // Listen for permission changes
            result.addEventListener('change', () => {
              setPermissionStatus(result.state as LocationPermissionStatus);
            });
          } catch {
            // Permissions API not supported for geolocation
            if ('geolocation' in navigator) {
              setPermissionStatus('prompt');
            } else {
              setPermissionStatus('denied');
            }
          }
        } else {
          // Fallback: check if geolocation is available
          if ('geolocation' in navigator) {
            setPermissionStatus('prompt');
          } else {
            setPermissionStatus('denied');
          }
        }
      } catch (error) {
        console.error('Error checking location permission:', error);
        if ('geolocation' in navigator) {
          setPermissionStatus('prompt');
        } else {
          setPermissionStatus('denied');
        }
      }
    };

    checkPermission();
  }, []);

  const requestPermission = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setPermissionStatus('denied');
      return;
    }

    setIsRequesting(true);
    setShowIOSInstructions(false);

    // For iOS, we need to use getCurrentPosition with specific options
    // This should trigger the native permission dialog
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Success - permission granted
        setPermissionStatus('granted');
        setIsRequesting(false);
        setShowIOSInstructions(false);
        console.log('Location permission granted:', position.coords);
      },
      (error) => {
        setIsRequesting(false);
        console.error('Geolocation error:', error.code, error.message);
        
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionStatus('denied');
          
          // On iOS, if permission was denied, user needs to go to Settings
          if (isIOS()) {
            setShowIOSInstructions(true);
          }
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          // Position unavailable doesn't mean denied
          // Keep current status or set to prompt for retry
          console.warn('Position unavailable, GPS may be off');
        } else if (error.code === error.TIMEOUT) {
          // Timeout doesn't mean denied, just slow GPS
          console.warn('Geolocation timeout, try again');
          // Reset to prompt so user can try again
          setPermissionStatus('prompt');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout for iOS
        maximumAge: 0
      }
    );
  }, []);

  return {
    permissionStatus,
    isRequesting,
    requestPermission,
    showIOSInstructions,
    isIOS: isIOS(),
  };
};
