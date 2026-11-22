import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/RETRO-MIX/' : '/',
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
