import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    proxy: {
      '/api/youtube': 'http://127.0.0.1:8787',
      '/api/ai': 'http://127.0.0.1:8787'
    }
  },
  preview: {
    proxy: {
      '/api/youtube': 'http://127.0.0.1:8787',
      '/api/ai': 'http://127.0.0.1:8787'
    }
  }
})
