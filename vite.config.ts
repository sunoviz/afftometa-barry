import { defineConfig } from 'vite'
// @ts-expect-error The server module runs directly on Node 22.
import { createApp } from './server/app.mjs'

// Keep local dev server private. Do not expose Vite on 0.0.0.0 because public
// scanners can spam /@fs requests for .env/.git files and exhaust memory.
export default defineConfig({
  plugins: [{
    name: 'satruk-server',
    configureServer(server) {
      const app = createApp()
      server.middlewares.use(app.middleware)
      server.httpServer?.once('close', app.close)
    },
    configurePreviewServer(server) {
      const app = createApp()
      server.middlewares.use(app.middleware)
      server.httpServer.once('close', app.close)
    },
  }],
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
