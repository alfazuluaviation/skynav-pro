import { useState, useEffect, useCallback } from 'react';

export type LocationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

export const useLocationPermission = () => {
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>('unknown');
  const [isRequesting, setIsRequesting] = useState(false);

  // Check permission status on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        // Check if Permissions API is available
        if ('permissions' in navigator) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          setPermissionStatus(result.state as LocationPermissionStatus);
          
          // Listen for permission changes
          result.addEventListener('change', () => {
            setPermissionStatus(result.state as LocationPermissionStatus);
          });
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
        // For iOS Safari which doesn't support permissions.query for geolocation
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

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Success - permission granted
        setPermissionStatus('granted');
        setIsRequesting(false);
        console.log('Location permission granted:', position.coords);
      },
      (error) => {
        // Error - permission denied or unavailable
        setIsRequesting(false);
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionStatus('denied');
        } else {
          // Other errors (timeout, position unavailable) don't mean denied
          console.error('Geolocation error:', error.message);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, []);

  return {
    permissionStatus,
    isRequesting,
    requestPermission,
  };
};
