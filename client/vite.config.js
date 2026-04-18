import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  build: {
    sourcemap: false, // Disabling sourcemaps significantly speeds up builds
    minify: 'esbuild', // Fast minification
    reportCompressedSize: false // Saves time during build output reporting
  }
})
