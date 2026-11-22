import { createApp } from 'vue'
import { Capacitor } from '@capacitor/core'
import App from './App.vue'
import './style.scss'

createApp(App).mount('#app')

if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
