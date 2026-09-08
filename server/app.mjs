import { createSqliteStore } from './sqlite-store.mjs'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const loginHtml = readFileSync(new URL('./login.html', import.meta.url), 'utf8')
const digest = (value) => createHash('sha256').update(value).digest('hex')
const sessionAge = 7 * 24 * 60 * 60 * 1000

export function createApp({ databasePath = process.env.DATABASE_PATH || resolve('.data/history.sqlite'), allowedEmails = process.env.ALLOWED_EMAILS || 'barry@gmail.com,fadli@gmail.com', secureCookies = process.env.COOKIE_SECURE === 'true', store } = {}) {
  store ||= createSqliteStore(databasePath)
  const whitelist = new Set(allowedEmails.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
  const cookie = (token, age) => `satruk_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secureCookies ? '; Secure' : ''}`
  function respond(res, status, body, type = 'application/json; charset=utf-8') {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    res.end(type.startsWith('application/json') ? JSON.stringify(body) : body)
  }
  async function body(req) {
    if (req.body !== undefined) {
      if (typeof req.body === 'string') return req.body
      if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
      return req.headers['content-type']?.includes('application/x-www-form-urlencoded') ? new URLSearchParams(req.body).toString() : JSON.stringify(req.body)
    }
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > 32 * 1024 * 1024) throw Object.assign(new Error('File terlalu besar (maksimal 32 MB).'), { status: 413 })
      chunks.push(chunk)
    }
    return Buffer.concat(chunks).toString('utf8')
  }
  const redirect = (res) => { res.writeHead(303, { Location: '/', 'Cache-Control': 'no-store' }); res.end() }
  async function middleware(req, res, next) {
    const pathname = new URL(req.url, 'http://localhost').pathname
    const token = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('satruk_session='))?.slice(15) || ''
    try {
      const session = token ? await store.sessionGet(digest(token), Date.now()) : null
      const email = session && whitelist.has(session.email) ? session.email : null
      if (['POST', 'DELETE', 'PUT', 'PATCH'].includes(req.method) && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
        return respond(res, 403, { message: 'Origin tidak diizinkan.' })
      }
      if (pathname === '/login' && req.method === 'POST') {
        const submitted = new URLSearchParams(await body(req)).get('email')?.trim().toLowerCase()
        if (!whitelist.has(submitted)) return respond(res, 403, loginHtml.replace('</form>', '</form><div class="err">Email ini belum terdaftar di whitelist.</div>'), 'text/html; charset=utf-8')
        const nextToken = randomBytes(32).toString('hex')
        await store.sessionCreate(digest(nextToken), submitted, Date.now() + sessionAge)
        res.setHeader('Set-Cookie', cookie(nextToken, sessionAge / 1000))
        return redirect(res)
      }
      if (pathname === '/logout' && req.method === 'POST') {
        await store.sessionDelete(digest(token))
        res.setHeader('Set-Cookie', cookie('', 0))
        return redirect(res)
      }
      if (pathname.startsWith('/api/')) {
        if (!email) return respond(res, 401, { message: 'Silakan login kembali.' })
        if (pathname === '/api/snapshots' && req.method === 'POST') {
          let input
          try { input = JSON.parse(await body(req)) } catch (error) { if (error.status) throw error; return respond(res, 400, { message: 'JSON tidak valid.' }) }
          const payload = input?.payload
          if (!payload || typeof payload !== 'object' || !Array.isArray(payload.metaData) || !Array.isArray(payload.shopeeData) || !payload.metaData.length && !payload.shopeeData.length) return respond(res, 400, { message: 'Snapshot harus berisi data Meta atau Shopee.' })
          const encoded = JSON.stringify(payload)
          const fingerprint = digest(encoded)
          const result = await store.snapshotSave(email, String(input.title || 'Analisa Affiliate').slice(0, 500), fingerprint, encoded, new Date().toISOString())
          return respond(res, result.duplicate ? 200 : 201, result)
        }
        if (pathname === '/api/history/days' && req.method === 'GET') {
          const rows = await store.snapshotsList(email)
          const days = new Map()
          for (const row of rows) {
            const payload = JSON.parse(row.payload)
            const dates = new Set([...payload.metaData.map((item) => item.date || item.rangeStart), ...payload.shopeeData.map((item) => item.filterDate)].filter(Boolean))
            if (!dates.size) dates.add(payload.rawMax || payload.rawMin || row.created_at.slice(0, 10))
            for (const date of dates) {
              const day = days.get(date) || { date, latest_snapshot_id: row.id, latest_created_at: row.created_at, snapshot_count: 0, total_meta_rows: 0, total_shopee_rows: 0 }
              day.snapshot_count++
              day.total_meta_rows += payload.metaData.filter((item) => (item.date || item.rangeStart) === date).length
              day.total_shopee_rows += payload.shopeeData.filter((item) => item.filterDate === date).length
              days.set(date, day)
            }
          }
          return respond(res, 200, { days: [...days.values()].sort((a, b) => b.date.localeCompare(a.date)) })
        }
        const match = pathname.match(/^\/api\/snapshots\/(\d+)$/)
        if (match && ['GET', 'DELETE'].includes(req.method)) {
          const row = await store.snapshotGet(Number(match[1]), email)
          if (!row) return respond(res, 404, { message: 'Snapshot tidak ditemukan.' })
          if (req.method === 'DELETE') { await store.snapshotDelete(row.id, email); return respond(res, 200, { deleted: true }) }
          return respond(res, 200, { id: row.id, title: row.title, created_at: row.created_at, payload: JSON.parse(row.payload) })
        }
        return respond(res, 404, { message: 'Endpoint tidak ditemukan.' })
      }
      if ((pathname === '/' || pathname === '/index.html' || pathname === '/login') && !email) return respond(res, 200, loginHtml, 'text/html; charset=utf-8')
      next()
    } catch (error) {
      console.error(error)
      respond(res, error.status || 500, { message: error.status ? error.message : 'Gagal memproses data server.' })
    }
  }
  return { middleware, close: () => store.close() }
}
