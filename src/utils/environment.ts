/**
 * Environment Detection Utilities
 * 
 * Provides functions to detect whether the app is running as:
 * - PWA (web browser, installable web app)
 * - Capacitor Native (Android/iOS via Capacitor)
 * 
 * This allows a single codebase to adapt behavior based on runtime environment.
 */

/**
 * Check if running inside Capacitor native environment
 */
export function isCapacitorNative(): boolean {
  return typeof (window as any).Capacitor !== 'undefined' && 
         (window as any).Capacitor.isNativePlatform?.() === true;
}

/**
 * Check if running as web (PWA or regular browser)
 */
export function isWeb(): boolean {
  return !isCapacitorNative();
}

/**
 * Get the current platform
 */
export function getPlatform(): 'android' | 'ios' | 'web' {
  if (!isCapacitorNative()) return 'web';
  
  const platform = (window as any).Capacitor?.getPlatform?.();
  if (platform === 'android') return 'android';
  if (platform === 'ios') return 'ios';
  return 'web';
}

/**
 * Check if running on Android native
 */
export function isAndroid(): boolean {
  return getPlatform() === 'android';
}

/**
 * Check if running on iOS native
 */
export function isIOS(): boolean {
  return getPlatform() === 'ios';
}

/**
 * Get the appropriate storage path for the current platform
 */
export function getStoragePath(subPath: string = ''): string {
  const platform = getPlatform();
  
  switch (platform) {
    case 'android':
      return `skyfpl/${subPath}`;
    case 'ios':
      return `Documents/skyfpl/${subPath}`;
    default:
      return subPath; // Web uses IndexedDB, no file path needed
  }
}

/**
 * Log environment info (useful for debugging)
 */
export function logEnvironmentInfo(): void {
  console.log('[Environment] Platform:', getPlatform());
  console.log('[Environment] Is Capacitor Native:', isCapacitorNative());
  console.log('[Environment] Is Web:', isWeb());
}
