import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.3bbf9660ca4040b3b3ab021f8768f84c',
  appName: 'SkyFPL',
  // Vite builds to 'dist/' by default - Capacitor will use this
  webDir: 'dist',
  server: {
    // For development: hot-reload from Lovable preview
    // Comment this out for production builds
    url: 'https://3bbf9660-ca40-40b3-b3ab-021f8768f84c.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    // Filesystem plugin configuration
    Filesystem: {
      // Allow access to external storage on Android
      // requestLegacyExternalStorage: true // Only needed for Android < 10
    }
  },
  android: {
    // Android-specific settings
    allowMixedContent: true, // Allow HTTP content in HTTPS context (for dev)
  },
  ios: {
    // iOS-specific settings
    contentInset: 'automatic'
  }
};

export default config;
