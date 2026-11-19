import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.afterglow.player',
  appName: 'Retro Mix',
  webDir: 'dist',
  android: { backgroundColor: '#0b0b0f' },
  plugins: { SystemBars: { style: 'DARK' } },
}

export default config
