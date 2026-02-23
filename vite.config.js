import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/quadrature-signal-lab/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        simple: resolve(__dirname, 'simple/index.html'),
        real: resolve(__dirname, 'real/index.html'),
      },
    },
  },
})
