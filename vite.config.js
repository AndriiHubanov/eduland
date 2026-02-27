import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/eduland/',  // GitHub Pages: https://<user>.github.io/eduland/
})
