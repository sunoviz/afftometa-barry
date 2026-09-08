import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from './app.mjs'

test('default whitelist allows Barry and Fadli accounts only', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'satruk-default-whitelist-'))
  const app = createApp({ databasePath: join(directory, 'history.sqlite') })
  const server = createServer((req, res) => app.middleware(req, res, () => res.end('dashboard')))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    for (const email of ['barry@gmail.com', 'fadli@gmail.com']) {
      const res = await fetch(`${origin}/login`, { method: 'POST', body: new URLSearchParams({ email }), redirect: 'manual' })
      assert.equal(res.status, 303)
    }
    const denied = await fetch(`${origin}/login`, { method: 'POST', body: new URLSearchParams({ email: 'other@example.com' }), redirect: 'manual' })
    assert.equal(denied.status, 403)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('server login, isolation, duplicate detection, persistence and deletion', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'satruk-test-'))
  const options = { databasePath: join(directory, 'history.sqlite'), allowedEmails: 'barry@gmail.com,second@example.com' }
  let app, server, origin
  async function start() {
    app = createApp(options)
    server = createServer((req, res) => app.middleware(req, res, () => res.end('dashboard')))
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    origin = `http://127.0.0.1:${server.address().port}`
  }
  async function stop() { await new Promise((resolve) => server.close(resolve)); app.close() }
  async function login(email) {
    const res = await fetch(`${origin}/login`, { method: 'POST', body: new URLSearchParams({ email }), redirect: 'manual' })
    assert.equal(res.status, 303)
    assert.match(res.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/)
    return res.headers.get('set-cookie').split(';')[0]
  }
  try {
    await start()
    assert.match(await (await fetch(origin)).text(), /PRIVATE MEMBER AREA/)
    assert.equal((await fetch(`${origin}/api/history/days`)).status, 401)
    assert.equal((await fetch(`${origin}/login`, { method: 'POST', body: new URLSearchParams({ email: 'unknown@example.com' }) })).status, 403)
    const cookie = await login(' BARRY@gmail.com ')
    const headers = { cookie, 'Content-Type': 'application/json' }
    const payload = { metaData: [{ date: '2026-09-02', spend: 100 }], shopeeData: [{ filterDate: '2026-09-02', comm: 150 }], shopeeClickData: [], rawMin: '2026-09-02', rawMax: '2026-09-02' }
    const upload = () => fetch(`${origin}/api/snapshots`, { method: 'POST', headers, body: JSON.stringify({ title: 'Workspace A', payload }) })
    const saved = await (await upload()).json()
    assert.equal(saved.duplicate, false)
    assert.deepEqual(await (await upload()).json(), { id: saved.id, duplicate: true })
    assert.equal((await fetch(`${origin}/api/snapshots`, { method: 'POST', headers, body: '{}' })).status, 400)
    assert.equal((await fetch(`${origin}/api/snapshots`, { method: 'POST', headers: { ...headers, Origin: 'https://other.example' }, body: '{}' })).status, 403)
    const other = { cookie: await login('second@example.com') }
    assert.deepEqual(await (await fetch(`${origin}/api/history/days`, { headers: other })).json(), { days: [] })
    assert.equal((await fetch(`${origin}/api/snapshots/${saved.id}`, { headers: other })).status, 404)
    assert.equal((await fetch(`${origin}/api/snapshots/${saved.id}`, { headers: other, method: 'DELETE' })).status, 404)
    await stop()
    await start()
    const restored = await (await fetch(`${origin}/api/snapshots/${saved.id}`, { headers })).json()
    assert.deepEqual(restored.payload, payload)
    const history = await (await fetch(`${origin}/api/history/days`, { headers })).json()
    assert.equal(history.days[0].snapshot_count, 1)
    assert.equal(history.days[0].total_meta_rows, 1)
    assert.equal(history.days[0].total_shopee_rows, 1)
    assert.equal((await fetch(`${origin}/api/snapshots/${saved.id}`, { method: 'DELETE', headers })).status, 200)
    assert.equal((await fetch(`${origin}/api/snapshots/${saved.id}`, { headers })).status, 404)
    await fetch(`${origin}/logout`, { method: 'POST', headers, redirect: 'manual' })
    assert.equal((await fetch(`${origin}/api/history/days`, { headers })).status, 401)
  } finally {
    if (server?.listening) await stop()
    rmSync(directory, { recursive: true, force: true })
  }
})
