import { createHash } from 'node:crypto'
import * as blob from '@vercel/blob'

const hash = (value) => createHash('sha256').update(value).digest('hex')

// Each snapshot is immutable and scoped by email. Independent uploads never
// overwrite a shared database file; atomic creation also deduplicates retries.
export function createBlobStore(sdk = blob) {
  const options = { access: 'private', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 0 }
  const prefix = (email) => `satruk/snapshots/${hash(email)}/`
  const path = (id, email) => `${prefix(email)}${id}.json`
  async function read(pathname) {
    const result = await sdk.get(pathname, { access: 'private', useCache: false })
    if (!result) return null
    return new Response(result.stream).json()
  }
  return {
    async sessionGet(token, now) {
      const session = await read(`satruk/sessions/${token}.json`)
      return session && session.expires > now ? session : null
    },
    sessionCreate: (token, email, expires) => sdk.put(`satruk/sessions/${token}.json`, JSON.stringify({ email, expires }), options),
    sessionDelete: (token) => sdk.del(`satruk/sessions/${token}.json`),
    async snapshotSave(email, title, fingerprint, payload, createdAt) {
      // 52 bits fit exactly into the numeric IDs expected by the reference UI.
      const id = Number.parseInt(hash(`${email}:${fingerprint}`).slice(0, 13), 16)
      const row = { id, email, title, fingerprint, payload, created_at: createdAt }
      const previous = await read(path(id, email))
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new Error('Snapshot identifier collision; original data preserved.')
        return { id, duplicate: true }
      }
      try {
        await sdk.put(path(id, email), JSON.stringify(row), options)
        return { id, duplicate: false }
      } catch (error) {
        const existing = await read(path(id, email))
        if (!existing) throw error
        if (existing.fingerprint !== fingerprint) throw new Error('Snapshot identifier collision; original data preserved.')
        return { id, duplicate: true }
      }
    },
    async snapshotsList(email) {
      const rows = []
      let cursor
      do {
        const result = await sdk.list({ prefix: prefix(email), cursor, limit: 100 })
        const batch = await Promise.all(result.blobs.map((item) => read(item.pathname)))
        rows.push(...batch.filter(Boolean))
        cursor = result.hasMore ? result.cursor : undefined
      } while (cursor)
      return rows.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
    },
    snapshotGet: (id, email) => read(path(id, email)),
    snapshotDelete: (id, email) => sdk.del(path(id, email)),
    close() {},
  }
}
