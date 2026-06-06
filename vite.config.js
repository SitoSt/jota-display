import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  server: {
    proxy: {
      '/events': { target: 'http://localhost:8766', changeOrigin: false },
      '/state':  { target: 'http://localhost:8766', changeOrigin: false },
      '/listen': { target: 'http://localhost:8766', changeOrigin: false },
      '/config': { target: 'http://localhost:8766', changeOrigin: false },
    },
  },
})
