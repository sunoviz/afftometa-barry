import assert from 'node:assert/strict'

const origin = process.env.PRODUCTION_URL || 'https://afftometa-barry.vercel.app'
for (const path of ['/', '/index.html', '/login']) {
  const res = await fetch(origin + path)
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, /name="email"/, `${path}: anonymous visitors must see login`)
  assert.doesNotMatch(html, /id="up-screen"/, `${path}: dashboard must require login`)
  assert.match(res.headers.get('cache-control'), /no-store/)
}
assert.equal((await fetch(origin + '/api/history/days')).status, 401)
const login = await fetch(origin + '/login', { method: 'POST', body: new URLSearchParams({ email: 'barry@gmail.com' }), redirect: 'manual' })
assert.equal(login.status, 303)
const headers = { cookie: login.headers.get('set-cookie').split(';')[0] }
try {
  for (const path of ['/', '/index.html']) {
    const res = await fetch(origin + path, { headers })
    assert.equal(res.status, 200)
    assert.match(await res.text(), /id="up-screen"/)
    assert.match(res.headers.get('cache-control'), /no-store/)
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.equal((await fetch(origin + '/api/history/days', { headers })).status, 200)
  }
} finally {
  assert.equal((await fetch(origin + '/logout', { method: 'POST', headers, redirect: 'manual' })).status, 303)
}
assert.equal((await fetch(origin + '/api/history/days', { headers })).status, 401)
assert.match(await (await fetch(origin, { headers })).text(), /name="email"/)
console.log('Production checks passed: anonymous login gate, authenticated dashboard, uncached HTML, repeated history requests, and revoked session.')
