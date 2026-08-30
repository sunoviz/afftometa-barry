import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Keep local dev server private. Do not expose Vite on 0.0.0.0 because public
// scanners can spam /@fs requests for .env/.git files and exhaust memory.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    fs: {
      strict: true,
      allow: [process.cwd()],
    },
    sourcemapIgnoreList: () => true,
  },
  preview: {
    host: '127.0.0.1',
  },
})
