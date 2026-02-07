import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jobmate.app',
  appName: 'JobMate',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Camera: {
      presentationStyle: 'fullScreen'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
