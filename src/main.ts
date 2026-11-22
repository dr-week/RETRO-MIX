import { createApp } from 'vue'
import App from './App.vue'
import './style.scss'

createApp(App).mount('#app')

if ('serviceWorker' in navigator && !location.protocol.startsWith('capacitor')) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
