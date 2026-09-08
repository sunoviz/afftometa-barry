
import Papa from 'papaparse'

export type MetaRow = { date: string; endDate: string; rangeDays: number; campaign: string; spend: number; clicks: number; lpViews: number; impressions: number }
export type ShopeeRow = { orderId: string; status: string; productStatus: string; purchaseStatus: string; orderDate: string; clickDate: string; product: string; category: string; purchase: number; commission: number; tag: string; platform: string; isNewUser: boolean }
export type ClickRow = { clickId: string; clickDate: string; tag: string; referrer: string }
export type QualityReport = {
  metaRows: number; metaRowsUsed: number; metaSummaryRowsSkipped: number; metaZeroRowsSkipped: number;
  shopeeRows: number; shopeeRowsUsed: number; warnings: string[]; metaSpendRaw: number; metaSpendUsed: number; shopeeCommission: number;
}
export type Analysis = {
  meta: MetaRow[]; shopee: ShopeeRow[]; clicks: ClickRow[]; quality: QualityReport; daily: any[]; campaigns: any[]; tags: any[]; totals: any;
}

const norm = (s: string) => String(s || '').trim()
function col(row: Record<string, any>, ...keys: string[]) {
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v)
  }
  return ''
}

export function parseIdr(input: any): number {
  if (input === null || input === undefined) return 0
  let s = String(input).trim().replace(/^="|"$/g, '').replace(/Rp/gi, '').replace(/\s/g, '')
  if (!s) return 0
  const neg = s.includes('-')
  s = s.replace(/[^0-9,.-]/g, '')
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    const decimalSep = lastComma > lastDot ? ',' : '.'
    const thousandsSep = decimalSep === ',' ? '.' : ','
    s = s.replace(new RegExp('\\' + thousandsSep, 'g'), '').replace(decimalSep, '.')
  } else if (hasComma) {
    const parts = s.split(',')
    s = parts.length > 2 || parts[parts.length - 1].length === 3 ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (hasDot) {
    const parts = s.split('.')
    s = parts.length > 2 || parts[parts.length - 1].length === 3 ? s.replace(/\./g, '') : s
  }
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? (neg ? -Math.abs(n) : n) : 0
}

export function parseShopeeMoney(input: any): number {
  if (input === null || input === undefined) return 0
  const raw = String(input).trim().replace(/^="|"$/g, '').replace(/Rp/gi, '').replace(/\s/g, '')
  if (!raw) return 0
  // Shopee commission export uses dot as decimal separator, e.g. 769.945 = Rp 769.945,
  // not Rp 769.945 ribu. Keep simple decimal values as decimals.
  if (/^-?\d+\.\d+$/.test(raw)) return Number(raw)
  if (/^-?\d+,\d+$/.test(raw)) return Number(raw.replace(',', '.'))
  return parseIdr(raw)
}

function parseCsv(text: string) {
  return Papa.parse<Record<string, any>>(text.replace(/^\uFEFF/, '').trim(), { header: true, skipEmptyLines: true, transformHeader: h => h.replace(/^\uFEFF/, '').trim() })
}

const isoDate = (value: string) => {
  const raw = norm(value)
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const rangeDays = (start: string, end: string) => {
  if (!start || !end) return 1
  const a = new Date(`${start}T00:00:00`).getTime()
  const b = new Date(`${end}T00:00:00`).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1
  return Math.round((b - a) / 86400000) + 1
}

function metaClicks(row: Record<string, any>) {
  const direct = parseIdr(col(row, 'Link clicks', 'Unique link clicks', 'Clicks', 'Clicks (all)', 'Outbound clicks', 'Unique outbound clicks', 'Klik tautan', 'Klik Tautan', 'Klik Tautan Unik', 'Klik tautan unik', 'Klik Unik Tautan', 'Klik', 'Klik (semua)', 'Klik keluar', 'Klik keluar unik'))
  if (direct) return direct
  const indicator = norm(col(row, 'Indikator Hasil', 'Indikator hasil', 'Result indicator'))
  if (/link[_\s-]?click/i.test(indicator) || /klik tautan/i.test(indicator)) return parseIdr(col(row, 'Hasil', 'Results'))
  const spend = parseIdr(col(row, 'Amount spent (IDR)', 'Jumlah yang dibelanjakan (IDR)'))
  const cpc = parseIdr(col(row, 'CPC (cost per link click) (IDR)', 'CPC (cost per click) (IDR)', 'CPC (all) (IDR)', 'Cost per result', 'Biaya per hasil', 'Biaya per Hasil', 'BPK (biaya per klik tautan) (IDR)', 'CPC (Biaya per Klik Tautan) (IDR)'))
  if (spend && cpc) return spend / cpc
  return 0
}

function metaLpViews(row: Record<string, any>) {
  const direct = parseIdr(col(row, 'Landing page views', 'Tampilan halaman landing', 'Tayangan Halaman Landas', 'Tampilan Halaman Landing', 'Tayangan halaman tujuan'))
  if (direct) return direct
  const indicator = norm(col(row, 'Indikator Hasil', 'Indikator hasil', 'Result indicator'))
  if (/landing|halaman/i.test(indicator)) return parseIdr(col(row, 'Hasil', 'Results'))
  return 0
}

export function parseMetaCsv(text: string) {
  const parsed = parseCsv(text)
  let summarySkipped = 0, zeroSkipped = 0, rawSpend = 0
  const rows = (parsed.data || []).map(row => {
    const campaign = norm(col(row, 'Campaign name', 'Nama kampanye', 'Nama Kampanye'))
    const spend = parseIdr(col(row, 'Amount spent (IDR)', 'Jumlah yang dibelanjakan (IDR)'))
    rawSpend += spend
    const date = isoDate(col(row, 'Reporting starts', 'Awal pelaporan', 'Laporan mulai'))
    const endDate = isoDate(col(row, 'Reporting ends', 'Akhir pelaporan', 'Laporan berakhir')) || date
    return {
      date,
      endDate,
      rangeDays: rangeDays(date, endDate),
      campaign,
      spend,
      clicks: metaClicks(row),
      lpViews: metaLpViews(row),
      impressions: parseIdr(col(row, 'Impressions', 'Tayangan', 'Impresi')),
    }
  }).filter(r => {
    if (!r.campaign) { if (r.spend > 0) summarySkipped++; return false }
    if (r.spend <= 0 && r.clicks <= 0 && r.lpViews <= 0 && r.impressions <= 0) { zeroSkipped++; return false }
    return true
  })
  return { rows, stats: { totalRows: parsed.data.length, usedRows: rows.length, summarySkipped, zeroSkipped, rawSpend, usedSpend: rows.reduce((a, r) => a + r.spend, 0), errors: parsed.errors } }
}

export function parseShopeeCsv(text: string) {
  const parsed = parseCsv(text)
  const rows = (parsed.data || []).map(row => {
    const status = norm(col(row, 'Order Status', 'Status Pesanan'))
    const productStatus = norm(col(row, 'Status Produk Affiliate', 'Affiliate Product Status', 'Product Affiliate Status')) || status
    const purchaseStatus = norm(col(row, 'Status Pemebelian', 'Status Pembelian', 'Purchase Status', 'Buyer Status', 'Status Pembeli'))
    return {
      orderId: norm(col(row, 'Order id', 'Order ID', 'ID Pemesanan')),
      status,
      productStatus,
      purchaseStatus,
      orderDate: norm(col(row, 'Order Time', 'Waktu Pemesanan')).slice(0, 10),
      clickDate: norm(col(row, 'Click Time', 'Waktu Klik')).slice(0, 10),
      product: norm(col(row, 'Item Name', 'Nama Barange', 'Nama Barang')),
      category: norm(col(row, 'L1 Kategori Global', 'L1 Global Category', 'Kategori Global L1')) || 'Tanpa kategori',
      purchase: parseIdr(col(row, 'Purchase Value(Rp)', 'Purchase Value (Rp)', 'Nilai Pembelian(Rp)', 'Nilai Pembelian (Rp)')),
      commission: parseShopeeMoney(col(row, 'Affiliate Net Commission(Rp)', 'Affiliate Net Commission (Rp)', 'Komisi Bersih Affiliate (Rp)')),
      tag: norm(col(row, 'Tag_link1')),
      platform: norm(col(row, 'Channel', 'Platform')) || 'Others',
      isNewUser: /^(baru|new|new buyer|new user)$/i.test(purchaseStatus) && parseShopeeMoney(col(row, 'Affiliate Net Commission(Rp)', 'Affiliate Net Commission (Rp)', 'Komisi Bersih Affiliate (Rp)')) >= 50000,
    }
  }).filter(r => {
    const invalid = new Set(['cancelled', 'canceled', 'dibatalkan', 'unpaid', 'belum dibayar'])
    return r.status && !invalid.has(r.status.toLowerCase()) && !invalid.has(r.productStatus.toLowerCase())
  })
  return { rows, stats: { totalRows: parsed.data.length, usedRows: rows.length, errors: parsed.errors } }
}

export function parseClickCsv(text = '') {
  if (!text.trim()) return { rows: [] as ClickRow[], stats: { totalRows: 0, usedRows: 0, errors: [] as any[] } }
  const parsed = parseCsv(text)
  const rows = (parsed.data || []).map(row => ({
    clickId: norm(col(row, 'Klik ID', 'Click ID', 'Click id')),
    clickDate: norm(col(row, 'Waktu Klik', 'Click Time')).slice(0, 10),
    tag: norm(col(row, 'Tag_link', 'Tag_link1', 'Tag')).replace(/[-_\s]+$/g, ''),
    referrer: norm(col(row, 'Perujuk', 'Referrer', 'Referer')) || 'Others',
  })).filter(r => r.clickId && r.tag && r.clickDate)
  return { rows, stats: { totalRows: parsed.data.length, usedRows: rows.length, errors: parsed.errors } }
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
function matchCampaignForTag(tag: string, campaigns: MetaRow[]) {
  const kt = key(tag)
  if (!kt) return { campaign: '', score: 0, type: 'unmatched' }
  let best = { campaign: '', score: 0, type: 'unmatched' }
  for (const c of campaigns) {
    const kc = key(c.campaign)
    let score = 0, type = 'unmatched'
    if (kc === kt) { score = 100; type = 'exact' }
    else if (kc.includes(kt) || kt.includes(kc)) { score = Math.min(95, Math.round(Math.min(kc.length, kt.length) / Math.max(kc.length, kt.length) * 100)); type = 'contains' }
    if (score > best.score) best = { campaign: c.campaign, score, type }
  }
  return best
}

export function analyze(metaText: string, shopeeText: string, ppn = 0.11, clickText = ''): Analysis {
  const metaParsed = parseMetaCsv(metaText)
  const shopeeParsed = parseShopeeCsv(shopeeText)
  const clickParsed = parseClickCsv(clickText)
  const meta = metaParsed.rows
  const shopee = shopeeParsed.rows
  const clicksReport = clickParsed.rows
  const spend = meta.reduce((a, r) => a + r.spend, 0)
  const spendPpn = spend * (1 + ppn)
  const commission = shopee.reduce((a, r) => a + r.commission, 0)
  const orderIds = new Set(shopee.map(r => r.orderId).filter(Boolean))
  const clicks = meta.reduce((a, r) => a + r.clicks, 0)
  const lpViews = meta.reduce((a, r) => a + r.lpViews, 0)
  const impressions = meta.reduce((a, r) => a + r.impressions, 0)
  const byDate = new Map<string, any>()
  for (const r of meta) {
    if (r.rangeDays > 1) continue
    const o = byDate.get(r.date) || { date: r.date, spend: 0, commission: 0, orders: 0, clicks: 0, lpViews: 0, impressions: 0 }
    o.spend += r.spend
    o.clicks += r.clicks
    o.lpViews += r.lpViews
    o.impressions += r.impressions
    byDate.set(r.date, o)
  }
  const dailyOrderIds = new Map<string, Set<string>>()
  for (const r of shopee) {
    const d = r.orderDate || r.clickDate
    const o = byDate.get(d) || { date: d, spend: 0, commission: 0, orders: 0, clicks: 0, lpViews: 0, impressions: 0 }
    o.commission += r.commission
    const ids = dailyOrderIds.get(d) || new Set<string>()
    if (r.orderId) ids.add(r.orderId)
    dailyOrderIds.set(d, ids)
    o.orders = ids.size
    byDate.set(d, o)
  }
  const daily = [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(r => ({ ...r, net: r.commission - r.spend * (1+ppn), roas: r.spend ? r.commission/(r.spend*(1+ppn)) : 0 }))
  const campaignMap = new Map<string, any>()
  for (const r of meta) { const o = campaignMap.get(r.campaign) || { campaign: r.campaign, spend: 0, clicks: 0, lpViews: 0, impressions: 0 }; o.spend += r.spend; o.clicks += r.clicks; o.lpViews += r.lpViews; o.impressions += r.impressions; campaignMap.set(r.campaign, o) }
  const campaigns = [...campaignMap.values()].sort((a,b)=>b.spend-a.spend).map(r => ({ ...r, cpc: r.clicks ? r.spend/r.clicks : 0, lpRate: r.clicks ? r.lpViews/r.clicks : 0 }))
  const tagMap = new Map<string, any>()
  for (const s of shopee) {
    const tag = s.tag || '(no tag)'
    const o = tagMap.get(tag) || { tag, commission: 0, orders: 0, orderIds: new Set<string>(), purchase: 0, clickCount: 0, newUserCount: 0, newUserCommission: 0, campaign: '', matchScore: 0, matchType: 'unmatched' }
    o.commission += s.commission
    o.purchase += s.purchase
    if (s.orderId) o.orderIds.add(s.orderId)
    if (s.isNewUser) { o.newUserCount += 1; o.newUserCommission += 50000 }
    tagMap.set(tag, o)
  }
  for (const c of clicksReport) {
    const tag = c.tag || '(no tag)'
    const o = tagMap.get(tag) || { tag, commission: 0, orders: 0, orderIds: new Set<string>(), purchase: 0, clickCount: 0, newUserCount: 0, newUserCommission: 0, campaign: '', matchScore: 0, matchType: 'unmatched' }
    o.clickCount += 1
    tagMap.set(tag, o)
  }
  const tags = [...tagMap.values()].map(t => {
    const m = matchCampaignForTag(t.tag, meta)
    const c = campaignMap.get(m.campaign)
    const spendTag = c?.spend || 0
    const orders = t.orderIds.size
    const { orderIds: _orderIds, ...rest } = t
    return { ...rest, orders, campaign: m.campaign, matchScore: m.score, matchType: m.type, spend: spendTag, metaClicks: c?.clicks || 0, net: t.commission - spendTag*(1+ppn), roas: spendTag ? t.commission/(spendTag*(1+ppn)) : 0 }
  }).sort((a,b)=>b.commission-a.commission)
  const warnings = [] as string[]
  if (metaParsed.stats.summarySkipped) warnings.push(`${metaParsed.stats.summarySkipped} row summary Meta diskip biar spend tidak double count.`)
  if (metaParsed.stats.zeroSkipped) warnings.push(`${metaParsed.stats.zeroSkipped} row Meta nol diskip.`)
  const quality = { metaRows: metaParsed.stats.totalRows, metaRowsUsed: metaParsed.stats.usedRows, metaSummaryRowsSkipped: metaParsed.stats.summarySkipped, metaZeroRowsSkipped: metaParsed.stats.zeroSkipped, shopeeRows: shopeeParsed.stats.totalRows, shopeeRowsUsed: shopeeParsed.stats.usedRows, warnings, metaSpendRaw: metaParsed.stats.rawSpend, metaSpendUsed: spend, shopeeCommission: commission }
  return { meta, shopee, clicks: clicksReport, quality, daily, campaigns, tags, totals: { spend, spendPpn, commission, net: commission - spendPpn, roas: spendPpn ? commission/spendPpn : 0, roi: spendPpn ? (commission-spendPpn)/spendPpn : 0, clicks, lpViews, impressions, orders: orderIds.size || shopee.length, ppn } }
}
