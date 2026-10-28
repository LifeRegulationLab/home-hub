import type { CapacitorConfig } from '@capacitor/cli';

// The phone shell: the same Vite build, copied into ios/ by `npm run build:shell`.
const config: CapacitorConfig = {
  appId: 'com.liferegulationlab.homehub',
  appName: 'Home hub',
  webDir: 'dist',
  backgroundColor: '#0d2730',
};

export default config;
