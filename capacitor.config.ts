import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shaurya.us',
  appName: 'us!!',
  webDir: 'dist',
  backgroundColor: '#0B0509',
  android: { allowMixedContent: false },
  plugins: { LocalNotifications: { iconColor: '#FF3E8A' } },
};
export default config;
