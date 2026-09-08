import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBlobStore } from './blob-store.mjs'

test('private cloud storage survives new instances and concurrent duplicate uploads', async () => {
  const files = new Map()
  const sdk = {
    async get(path, options) {
      assert.equal(options.access, 'private')
      assert.equal(options.useCache, false)
      return files.has(path) ? { stream: new Response(files.get(path)).body } : null
    },
    async put(path, content, options) {
      assert.equal(options.access, 'private')
      assert.equal(options.addRandomSuffix, false)
      if (files.has(path)) throw new Error('Already exists')
      files.set(path, content)
    },
    async del(path) { files.delete(path) },
    async list({ prefix }) { return { blobs: [...files.keys()].filter((key) => key.startsWith(prefix)).map((pathname) => ({ pathname })), hasMore: false } },
  }
  const first = createBlobStore(sdk)
  await first.sessionCreate('hashed-token', 'one@example.com', 2000)
  assert.equal((await first.sessionGet('hashed-token', 1000)).email, 'one@example.com')
  assert.equal(await first.sessionGet('hashed-token', 3000), null)
  const args = ['one@example.com', 'Test', 'fingerprint-a', '{}', '2026-09-08T00:00:00Z']
  const results = await Promise.all([first.snapshotSave(...args), first.snapshotSave(...args)])
  assert.equal(results.filter((row) => row.duplicate).length, 1)
  assert.equal(results[0].id, results[1].id)
  const second = createBlobStore(sdk)
  assert.equal((await second.snapshotsList('one@example.com')).length, 1)
  assert.equal((await second.snapshotGet(results[0].id, 'one@example.com')).fingerprint, 'fingerprint-a')
  assert.equal(await second.snapshotGet(results[0].id, 'other@example.com'), null)
  await second.snapshotDelete(results[0].id, 'other@example.com')
  assert.equal((await second.snapshotsList('one@example.com')).length, 1)
  await second.snapshotDelete(results[0].id, 'one@example.com')
  assert.equal(await second.snapshotGet(results[0].id, 'one@example.com'), null)
  await second.sessionDelete('hashed-token')
  assert.equal(await second.sessionGet('hashed-token', 1000), null)
})
