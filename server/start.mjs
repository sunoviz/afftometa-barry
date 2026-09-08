import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { createApp } from './app.mjs'

const root = resolve('dist')
const app = createApp()
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' }
const server = createServer((req, res) => app.middleware(req, res, async () => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    const file = resolve(root, `.${path === '/' ? '/index.html' : path}`)
    if (!file.startsWith(root + sep) || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); return res.end() }
    const content = await readFile(file)
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' })
    res.end(req.method === 'HEAD' ? undefined : content)
  } catch { res.writeHead(404); res.end('Not found') }
}))
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`Barry ready at http://${process.env.HOST || '127.0.0.1'}:${server.address().port}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { app.close(); process.exit(0) }))
