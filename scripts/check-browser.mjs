import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { readFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import assert from 'node:assert/strict'

const temp = mkdtempSync(join(tmpdir(), 'satruk-browser-'))
const port = process.env.TEST_PORT || '0'
let origin
const output = resolve('artifacts')
mkdirSync(output, { recursive: true })
const server = spawn(process.execPath, ['server/start.mjs'], { env: { ...process.env, PORT: port, HOST: '127.0.0.1', DATABASE_PATH: join(temp, 'history.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'] })
let startupLog = ''
server.stdout.on('data', (chunk) => {
  startupLog += chunk
  origin = startupLog.match(/Barry ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1]
})
let serverLog = ''
server.stderr.on('data', (chunk) => { serverLog += chunk })
const referencePath = process.env.REFERENCE_HTML || '/tmp/afftometa-current.html'
const files = ['MJO---Barry-HKM---1-Kampanye-2-Sep-2026-2-Sep-2026.csv', 'AffiliateCommissionReport_202609031508.csv', 'WebsiteClickReport202609031508.csv'].map((file) => resolve('file csv', file))
let browser
const errors = []
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(serverLog || 'Server exited before startup')
    try { if (origin && (await fetch(origin)).ok) break } catch { /* Wait for local server. */ }
    if (attempt === 99) throw new Error(serverLog || 'Server failed to start')
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('dialog', (dialog) => { errors.push(dialog.message()); void dialog.dismiss() })
  await page.goto(origin)
  await page.locator('input[name=email]').fill('barry@gmail.com')
  await Promise.all([page.waitForNavigation(), page.locator('button[type=submit]').click()])
  await page.waitForFunction(() => typeof runAnalysis === 'function')
  await page.screenshot({ path: join(output, 'upload.png'), fullPage: true })
  async function upload(target, offset = 0) {
    for (let index = 0; index < 3; index++) {
      await target.locator('input[type=file]').nth(offset + index).setInputFiles(files[index])
      await target.waitForFunction(({ index, offset }) => {
        const workspace = workspaces[offset / 3]
        return index === 0 ? workspace.metaDone && (workspace.metaRaw || workspace.metaRaws?.length) : index === 1 ? workspace.shopeeAccounts[0].done && workspace.shopeeAccounts[0].raw : workspace.clickDone && workspace.clickRaw
      }, { index, offset })
    }
  }
  await upload(page)
  const saved = page.waitForResponse((res) => res.url().endsWith('/api/snapshots') && res.request().method() === 'POST')
  await page.locator('#btn-go').click()
  assert.equal((await saved).status(), 201)
  await page.waitForSelector('#dash-screen', { state: 'visible' })
  const metrics = (target) => target.evaluate(() => {
    const filtered = getFiltered()
    return {
      spend: filtered.meta.reduce((sum, row) => sum + row.spend, 0),
      commission: filtered.shopee.reduce((sum, row) => sum + row.comm, 0),
      orders: new Set(filtered.shopee.map((row) => row.orderId)).size,
      clicks: filtered.shopeeClicks.reduce((sum, row) => sum + Number(row.count || 1), 0),
      tags: aggTag(filtered.shopee, filtered.meta, filtered.shopeeClicks).map((tag) => ({ tag: tag.tag, spend: tag.spend, commission: tag.comm, roas: tag.roas, normalRoas: tag.normalRoas, clicks: tag.shopeeClicks })),
    }
  })
  const actual = await metrics(page)
  assert.equal(actual.spend, 1269118)
  assert.equal(actual.orders, 789)
  assert.equal(await page.evaluate(() => shopeeClickData.length), 16360)
  assert.equal(actual.clicks, 16358)
  assert.ok(Math.abs(actual.commission - 2244552.43698) < 0.001)
  let baseline
  if (existsSync(referencePath)) {
    baseline = await context.newPage()
    baseline.on('pageerror', (error) => errors.push(`reference: ${error.message}`))
    await baseline.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: url.pathname === '/api/history/days' ? { days: [] } : { id: 1, duplicate: false } })
      const filename = url.pathname.split('/').pop()
      if (['papaparse.min.js', 'chart.umd.js', 'xlsx.full.min.js'].includes(filename)) return route.fulfill({ contentType: 'text/javascript', body: readFileSync(resolve('public/vendor', filename)) })
      if (url.href === 'http://reference.test/') return route.fulfill({ contentType: 'text/html', body: readFileSync(referencePath, 'utf8').replace(/Satruk/g, 'Barry').replace(/<div class="trakteer-sidebar"[^>]*>[\s\S]*?<\/div>/, '') })
      return route.abort()
    })
    await baseline.goto('http://reference.test/')
    await upload(baseline)
    await baseline.locator('#btn-go').click()
    assert.deepEqual(await metrics(baseline), actual)
  }
  for (const tab of ['overview', 'campaigns', 'products', 'funnel', 'attribution']) {
    for (const target of [page, baseline].filter(Boolean)) {
      await target.locator(`[data-tab="${tab}"]`).click()
      await target.addStyleTag({ content: '.toast-wrap { display:none !important; }' })
      await target.waitForTimeout(1200)
    }
    console.log(tab, await page.evaluate(() => ({ height: document.body.scrollHeight, width: document.body.scrollWidth })))
    await page.bringToFront()
    await page.evaluate(() => Object.values(charts).forEach((chart) => { chart.stop(); chart.update('none') }))
    await page.waitForTimeout(200)
    const screenshot = await page.screenshot({ path: join(output, `${tab}.png`), fullPage: true, animations: 'disabled' })
    if (baseline) {
      assert.equal(await page.locator('#tab-body').innerText(), await baseline.locator('#tab-body').innerText(), `${tab}: text parity`)
      await baseline.bringToFront()
      await baseline.evaluate(() => Object.values(charts).forEach((chart) => { chart.stop(); chart.update('none') }))
      await baseline.waitForTimeout(200)
      const reference = await baseline.screenshot({ path: join(output, `reference-${tab}.png`), fullPage: true, animations: 'disabled' })
      assert.ok(screenshot.equals(reference), `${tab}: screenshot parity`)
    }
  }
  await page.bringToFront()
  const downloadPromise = page.waitForEvent('download')
  await page.locator('#nav-export').click()
  const download = await downloadPromise
  const exportPath = join(output, download.suggestedFilename())
  await download.saveAs(exportPath)
  const sheetNames = await page.evaluate((bytes) => XLSX.read(new Uint8Array(bytes), { type: 'array' }).SheetNames, [...readFileSync(exportPath)])
  assert.deepEqual(sheetNames, ['Overview Harian', 'Campaigns', 'Produk & Kategori', 'Atribusi Tag', 'Raw Orders'])
  await page.reload()
  await page.locator('#history-list-upload button').first().click()
  await page.waitForSelector('#dash-screen', { state: 'visible' })
  assert.deepEqual(await metrics(page), actual)
  await page.evaluate(() => { backToUpload(); addWorkspace() })
  await upload(page, 3)
  // Restored snapshots intentionally do not retain raw uploads; reselect workspace 1.
  await upload(page)
  await page.locator('#btn-go').click()
  await page.waitForTimeout(500)
  const doubled = await metrics(page)
  assert.equal(doubled.spend, actual.spend * 2)
  await page.evaluate(() => toggleWorkspaceFilter(workspaces[1].id))
  assert.deepEqual(await metrics(page), actual)
  await page.evaluate(() => togglePlat('Facebook'))
  const platforms = await page.evaluate(() => getFiltered().shopeeClicks.map((row) => row.platform))
  assert.ok(!platforms.includes('Facebook'))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: join(output, 'mobile.png'), fullPage: true })
  await context.clearCookies()
  await page.evaluate(() => loadHistoryList())
  assert.equal(await page.locator('.toast-cta').filter({ hasText: 'Login kembali' }).count(), 1)
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ success: true, spend: actual.spend, commission: actual.commission, orders: actual.orders, clicks: actual.clicks, referenceCompared: Boolean(baseline), sheets: sheetNames, checks: ['five tab screenshots and text', 'multi-workspace filtering', 'platform click filtering', 'history restore', 'Excel workbook', 'no browser errors'] }, null, 2))
} finally {
  await browser?.close()
  server.kill('SIGTERM')
  await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve) })
  rmSync(temp, { recursive: true, force: true })
}
