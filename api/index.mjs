import { readFileSync } from 'node:fs'
import { createApp } from '../server/app.mjs'
import { createBlobStore } from '../server/blob-store.mjs'

const dashboard = readFileSync(new URL('../server/dashboard.html', import.meta.url), 'utf8')
const app = createApp({ store: createBlobStore(), secureCookies: true })

export default async function handler(req, res) {
  const requestUrl = new URL(req.url, 'https://localhost')
  const route = requestUrl.searchParams.get('route') || req.query?.route
  if (route) req.url = route
  await app.middleware(req, res, () => {
    if (!['/', '/index.html', '/login'].includes(new URL(req.url, 'https://localhost').pathname)) {
      res.writeHead(404)
      return res.end('Not found')
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
    res.end(dashboard)
  })
}
