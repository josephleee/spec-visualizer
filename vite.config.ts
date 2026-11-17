import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist/web', emptyOutDir: true },
  // changeOrigin: the server answers only Host 127.0.0.1:4321 or localhost:4321, not the dev server's own.
  server: { proxy: { '/api': { target: 'http://127.0.0.1:4321', changeOrigin: true } } },
  test: { root: '.', include: ['test/**/*.test.ts'] },
})
