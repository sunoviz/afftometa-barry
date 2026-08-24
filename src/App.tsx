import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Coffee,
  Download,
  FileSpreadsheet,
  Filter,
  Heart,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Plus,
  ShoppingBag,
  Target,
  Upload,
} from 'lucide-react'
import { analyze, type Analysis } from './lib/parser'
import { listRuns, saveRun, type SavedRun } from './lib/history'
import sampleMetaCsv from '../public/sample/meta.csv?raw'
import sampleShopeeCsv from '../public/sample/shopee.csv?raw'
import './App.css'

type GuideStepId = 'persiapan' | 'meta' | 'shopee' | 'dashboard' | 'atribusi'
type WorkspaceShopeeAccount = { id: number; name: string; fileName: string; file: File | null }
type WorkspaceState = {
  id: number
  name: string
  metaFileName: string
  metaFile: File | null
  shopeeAccounts: WorkspaceShopeeAccount[]
  clickFileName: string
  clickFile: File | null
}

type SidebarTab = 'overview' | 'campaigns' | 'produk' | 'funnel' | 'atribusi' | 'history'

const APP_NAME = 'Satruk Affiliate Tracker'
const APP_SUBTITLE = 'Shopee × Meta Ads History Tracker'
const FOOTER_TEXT = '© 2026 Satruk Affiliate Tracker — private server build'
const fmt = new Intl.NumberFormat('id-ID')
const rp = (n: number) => `Rp ${fmt.format(Math.round(n || 0))}`
const DONUT_COLORS = ['#e15c38', '#2ea66f', '#22a7a7', '#4f83e3', '#8d63d8', '#b98234', '#667a2e', '#d8b24f']
function makeDonut<T extends Record<string, any>>(rows: T[], valueKey: keyof T) {
  const total = rows.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0) || 1
  let cursor = 0
  const parts = rows.slice(0, 8).map((row, index) => {
    const value = Number(row[valueKey] || 0)
    const start = cursor
    const end = cursor + (value / total) * 100
    cursor = end
    return `${DONUT_COLORS[index % DONUT_COLORS.length]} ${start}% ${end}%`
  })
  return parts.length ? `conic-gradient(${parts.join(', ')})` : 'conic-gradient(#333 0% 100%)'
}
const compactRp = (n: number, signed = false) => {
  const value = Math.round(n || 0)
  const sign = signed && value > 0 ? '+ ' : value < 0 ? '- ' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}jt`
  if (abs >= 1_000) return `${sign}Rp ${Math.round(abs / 1_000)}rb`
  return `${sign}Rp ${fmt.format(abs)}`
}
const readText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })

const GUIDE_STEPS: Array<{ id: GuideStepId; label: string; title: string; body: React.ReactNode }> = [
  {
    id: 'persiapan',
    label: 'Persiapan',
    title: 'Apa yang dibutuhkan',
    body: (
      <>
        <GuidePoint number={1} title="Apa yang dibutuhkan" text={<>Dashboard ini menggabungkan dua sumber data: <strong>Meta Ads CSV</strong> dan <strong>Shopee Affiliate CSV</strong>.</>} />
        <GuidePoint number={2} title="Samakan range tanggal" text={<>Pastikan range tanggal Meta CSV dan Shopee CSV <strong>sama persis</strong> biar ROAS nggak meleset.</>} />
        <GuidePoint number={3} title="Format file" text={<>Kedua file harus tetap dalam format <strong>.CSV</strong> asli export.</>} />
      </>
    ),
  },
  {
    id: 'meta',
    label: 'Export Meta',
    title: 'Buka Meta Ads Manager',
    body: (
      <>
        <GuidePoint number={1} title="Level Campaign" text={<>Export harus dari level <strong>Campaign</strong>.</>} />
        <GuidePoint number={2} title="Kolom wajib" text={<>Pakai <code>Amount spent</code>, <code>Link clicks</code>, <code>LP Views</code>, dan <code>Impressions</code>.</>} />
        <GuidePoint number={3} title="Breakdown by Day" text={<>Set <strong>Breakdown → Day</strong> sebelum export CSV.</>} />
      </>
    ),
  },
  {
    id: 'shopee',
    label: 'Export Shopee',
    title: 'Buka panel Shopee Affiliate',
    body: (
      <>
        <GuidePoint number={1} title="Masuk Shopee Affiliate" text={<>Buka menu komisi / commission report.</>} />
        <GuidePoint number={2} title="Filter tanggal" text={<>Samakan tanggal dengan Meta export.</>} />
        <GuidePoint number={3} title="Export CSV" text={<>Unduh CSV tanpa ubah nama kolom.</>} />
      </>
    ),
  },
  {
    id: 'dashboard',
    label: 'Baca Dashboard',
    title: 'Cara baca hasil analisa',
    body: (
      <>
        <GuidePoint number={1} title="Kartu KPI" text={<>Kartu paling atas nunjukkin spend, komisi, net, ROAS, ROI, click, LP views, dan zero komisi.</>} />
        <GuidePoint number={2} title="Chart harian" text={<>Grafik utama nunjukkin spend vs komisi dan net harian.</>} />
        <GuidePoint number={3} title="Rekap" text={<>Tabel rekap harian dipakai buat baca performa per tanggal.</>} />
      </>
    ),
  },
  {
    id: 'atribusi',
    label: 'Atribusi Tag',
    title: 'Cara kerja Tag_link1',
    body: (
      <>
        <GuidePoint number={1} title="Isi nama campaign" text={<>Tag_link1 sebaiknya sama dengan nama campaign Meta.</>} />
        <GuidePoint number={2} title="Pencocokan" text={<>Dashboard bakal match exact / contains ke nama campaign.</>} />
        <GuidePoint number={3} title="Kalau ROAS aneh" text={<>Cek tag dan tanggal export dulu.</>} />
      </>
    ),
  },
]

function GuidePoint({ number, title, text }: { number: number; title: string; text: React.ReactNode }) {
  return (
    <>
      <div className="guideNumber">{number}</div>
      <div className="guideTitle">{title}</div>
      <div className="guideText">{text}</div>
    </>
  )
}

function Header({ onOpenGuide }: { onOpenGuide: () => void }) {
  return (
    <section className="heroHeader">
      <div className="heroBrand">
        <span className="heroLogo"><Menu size={15} strokeWidth={2.4} /></span>
        <div>
          <h1>{APP_NAME}</h1>
          <p>{APP_SUBTITLE}</p>
        </div>
      </div>
      <button type="button" className="guideButton" onClick={onOpenGuide}><HelpCircle size={13} />Panduan</button>
    </section>
  )
}

function GuideModal({ active, onClose, step, setStep }: { active: boolean; onClose: () => void; step: GuideStepId; setStep: (step: GuideStepId) => void }) {
  if (!active) return null
  const index = GUIDE_STEPS.findIndex((item) => item.id === step)
  const current = GUIDE_STEPS[index]
  const prev = index > 0 ? GUIDE_STEPS[index - 1] : null
  const next = index < GUIDE_STEPS.length - 1 ? GUIDE_STEPS[index + 1] : null

  return (
    <div className="guideOverlay" onClick={onClose}>
      <div className="guideModal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="guideModalHeader">
          <div>
            <h2>Panduan Penggunaan Dashboard</h2>
            <p>5 langkah untuk mulai tracking affiliate lo</p>
          </div>
          <button type="button" className="closeButton" onClick={onClose}>×</button>
        </div>
        <div className="guideTabs">
          {GUIDE_STEPS.map((item) => (
            <button key={item.id} type="button" className={item.id === step ? 'guideTab active' : 'guideTab'} onClick={() => setStep(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="guideContent">
          <div className="guideHeaderRow">
            <div className="guideHeaderIndex">{index + 1}</div>
            <div className="guideHeaderTitle">{current.title}</div>
          </div>
          <div className="guideBodyGrid">{current.body}</div>
        </div>
        <div className="guideFooter">
          <button type="button" className="guideNav" onClick={() => prev && setStep(prev.id)} disabled={!prev}>← Sebelumnya</button>
          <button type="button" className="guideNav primary" onClick={() => next && setStep(next.id)} disabled={!next}>Selanjutnya →</button>
        </div>
      </div>
    </div>
  )
}

function makeWorkspace(): WorkspaceState {
  return {
    id: 1,
    name: '',
    metaFileName: '',
    metaFile: null,
    shopeeAccounts: [{ id: 1, name: '', fileName: '', file: null }],
    clickFileName: '',
    clickFile: null,
  }
}

function makeReferenceRun(email: string): SavedRun {
  return {
    id: 0,
    email,
    name: 'Kemarin',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    metaFile: '19 rows',
    shopeeFile: '726 rows',
    ppn: 0,
    analysis: analyze(sampleMetaCsv, sampleShopeeCsv, 0),
  }
}

function formatHistoryHeadline(createdAt: string) {
  const created = new Date(createdAt)
  const today = new Date()
  const startA = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startB = new Date(created.getFullYear(), created.getMonth(), created.getDate())
  const diffDays = Math.round((startA.getTime() - startB.getTime()) / 86400000)
  if (diffDays === 1) return `Kemarin · ${created.toLocaleDateString('sv-SE')}`
  if (diffDays > 1 && diffDays <= 6) return `${diffDays} hari lalu · ${created.toLocaleDateString('sv-SE')}`
  return `${created.toLocaleDateString('sv-SE')} · ${created.toLocaleDateString('sv-SE')}`
}

const HELP: Record<string, string> = {
  Spend: 'Biaya iklan Meta. Jika PPN aktif, angka bisa termasuk PPN.',
  Komisi: 'Komisi bersih affiliate dari CSV Shopee.',
  Net: 'Komisi dikurangi spend iklan. Positif berarti profit, negatif berarti rugi.',
  ROAS: 'Return on Ad Spend: komisi dibagi spend iklan. 1x = balik modal.',
  ROI: 'Return on Investment: (komisi - spend) / spend.',
  EPC: 'Earnings per Click: komisi dibagi jumlah klik. Bandingkan dengan CPC; EPC > CPC berarti traffic lebih sehat.',
  'CPC META': 'Biaya per klik dari Meta: spend dibagi Meta clicks.',
  'REAL CPC': 'Spend campaign dibagi jumlah order/tag yang teratribusi. Dipakai sebagai proxy biaya real per order.',
  'REAL RATE': 'Orders dibagi click report Shopee per tag. Ini click-to-order rate dari sisi Shopee.',
  Orders: 'Jumlah order unik dari Shopee berdasarkan data CSV.',
  'Zero%': 'Persentase item/order yang masuk tapi komisinya Rp0.',
  'LP RATE': 'LP Views dibagi Meta clicks. Mengukur berapa klik yang berhasil load landing page.',
}

function HelpLabel({ label, help }: { label: string; help?: string }) {
  const title = help || HELP[label] || label
  return <span className="helpLabel" title={title} tabIndex={0}>{label}<span>?</span></span>
}

function StatCard({ label, value, hint, danger = false, accent = false }: { label: string; value: string; hint?: string; danger?: boolean; accent?: boolean }) {
  return (
    <div className={`resultKpi ${danger ? 'danger' : ''} ${accent ? 'accent' : ''}`}>
      <div className="kpiLabel"><HelpLabel label={label} help={HELP[label] || hint} /></div>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  )
}

function MetricBadge({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="metricBadge">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  )
}

function ResultScreen({ analysis, onBack, run, runs, onOpenRun, onRefreshHistory }: { analysis: Analysis; onBack: () => void; run?: SavedRun | null; runs: SavedRun[]; onOpenRun: (run: SavedRun) => void; onRefreshHistory: () => void }) {
  const [tab, setTab] = useState<SidebarTab>('overview')
  const [ppn, setPpn] = useState(0)
  const [targetPerDay, setTargetPerDay] = useState('500.000')
  const [historyMode, setHistoryMode] = useState<'Semua' | 'Terbaru'>('Semua')
  const [sourceFilter, setSourceFilter] = useState('Semua')
  const [minSpendInput, setMinSpendInput] = useState('')
  const [maxSpendInput, setMaxSpendInput] = useState('')
  const [spendFilter, setSpendFilter] = useState<{ min: number; max: number | null }>({ min: 0, max: null })

  const sourceShopee = useMemo(() => sourceFilter === 'Semua' ? analysis.shopee : analysis.shopee.filter((row: any) => String(row.platform || 'Others') === sourceFilter), [analysis.shopee, sourceFilter])
  const totals = useMemo(() => {
    const spend = analysis.totals.spend || 0
    const commission = sourceShopee.reduce((sum: number, item: any) => sum + Number(item.commission || 0), 0)
    const orderIds = new Set(sourceShopee.map((item: any) => item.orderId).filter(Boolean))
    const spendPpn = spend * (1 + ppn)
    const net = commission - spendPpn
    const roas = spendPpn > 0 ? commission / spendPpn : 0
    const roi = spendPpn > 0 ? net / spendPpn : 0
    const clicks = analysis.totals.clicks || 0
    const lpViews = analysis.totals.lpViews || 0
    const orders = orderIds.size || sourceShopee.length
    const zeroItems = sourceShopee.filter((item: any) => Number(item.commission || 0) <= 0).length
    const totalItems = sourceShopee.length || 1
    const zeroPct = (zeroItems / totalItems) * 100
    const commissionPerOrder = orders > 0 ? commission / orders : 0
    const cpc = clicks > 0 ? spendPpn / clicks : 0
    const lpRate = clicks > 0 ? (lpViews / clicks) * 100 : 0
    const targetRaw = Number(targetPerDay.replace(/\./g, '')) || 0
    return { spendPpn, commission, net, roas, roi, clicks, lpViews, orders, zeroItems, totalItems, zeroPct, commissionPerOrder, cpc, lpRate, targetRaw }
  }, [analysis, ppn, targetPerDay, sourceShopee])

  const dailyRows = useMemo(() => {
    const shopeeByDate = new Map<string, { commission: number; orderIds: Set<string>; itemCount: number; zeroCommissionCount: number }>()
    for (const item of sourceShopee as any[]) {
      const date = item.orderDate || item.clickDate || '—'
      const current = shopeeByDate.get(date) || { commission: 0, orderIds: new Set<string>(), itemCount: 0, zeroCommissionCount: 0 }
      current.commission += Number(item.commission || 0)
      if (item.orderId) current.orderIds.add(String(item.orderId))
      current.itemCount += 1
      if (Number(item.commission || 0) <= 0) current.zeroCommissionCount += 1
      shopeeByDate.set(date, current)
    }
    return analysis.daily.map((row: any) => {
      const spend = Number(row.spend || 0)
      const source = shopeeByDate.get(row.date)
      const commission = source?.commission || 0
      const orders = source?.orderIds.size || 0
      const itemCount = source?.itemCount || 0
      const zeroCommissionCount = source?.zeroCommissionCount || 0
      const spendPpn = spend * (1 + ppn)
      const net = commission - spendPpn
      const roas = spendPpn > 0 ? commission / spendPpn : 0
      const roi = spendPpn > 0 ? net / spendPpn : 0
      const epc = row.clicks > 0 ? commission / row.clicks : 0
      const lpRate = row.clicks > 0 ? (row.lpViews / row.clicks) * 100 : 0
      const zeroPct = itemCount > 0 ? (zeroCommissionCount / itemCount) * 100 : 0
      return { ...row, commission, orders, itemCount, zeroCommissionCount, spendPpn, net, roas, roi, epc, lpRate, zeroPct }
    })
  }, [analysis.daily, ppn, sourceShopee])

  const current = dailyRows[dailyRows.length - 1] || null
  const allPlatformCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const order of analysis.shopee as any[]) {
      const platform = String(order.platform || 'Others').trim() || 'Others'
      map.set(platform, (map.get(platform) || 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [analysis.shopee])
  const platformCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const order of sourceShopee as any[]) {
      const platform = String(order.platform || 'Others').trim() || 'Others'
      map.set(platform, (map.get(platform) || 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [sourceShopee])
  const categoryRows = useMemo(() => {
    const map = new Map<string, { category: string; commission: number; items: number }>()
    for (const row of sourceShopee as any[]) {
      const category = String(row.category || 'Tanpa kategori').trim() || 'Tanpa kategori'
      const current = map.get(category) || { category, commission: 0, items: 0 }
      current.commission += Number(row.commission || 0)
      current.items += 1
      map.set(category, current)
    }
    return [...map.values()].sort((a, b) => b.commission - a.commission)
  }, [sourceShopee])
  const channelRows = useMemo(() => {
    const map = new Map<string, { label: string; commission: number; orders: Set<string>; items: number }>()
    for (const row of sourceShopee as any[]) {
      const raw = String(row.platform || 'Others')
      const label = raw === 'Others' ? 'Organik' : 'Social Media'
      const current = map.get(label) || { label, commission: 0, orders: new Set<string>(), items: 0 }
      current.commission += Number(row.commission || 0)
      if (row.orderId) current.orders.add(String(row.orderId))
      current.items += 1
      map.set(label, current)
    }
    return [...map.values()].sort((a, b) => b.commission - a.commission)
  }, [sourceShopee])
  const categoryDonut = useMemo(() => makeDonut(categoryRows, 'commission'), [categoryRows])
  const platformDonut = useMemo(
    () => makeDonut(platformCounts.map(([name, count]) => ({ category: name, commission: count })), 'commission'),
    [platformCounts],
  )
  const productRows = useMemo(() => {
    const map = new Map<string, { product: string; category: string; commission: number; items: number }>()
    for (const row of sourceShopee as any[]) {
      const product = String(row.product || 'Produk tanpa nama')
      const category = String(row.category || 'Tanpa kategori').trim() || 'Tanpa kategori'
      const current = map.get(product) || { product, category, commission: 0, items: 0 }
      current.commission += Number(row.commission || 0)
      current.items += 1
      map.set(product, current)
    }
    return [...map.values()].sort((a, b) => b.commission - a.commission).slice(0, 15)
  }, [sourceShopee])
  const matchedTags = useMemo(() => {
    const sourceTags = new Map<string, { tag: string; commission: number; orders: number; purchase: number; newUsers: number }>()
    for (const row of sourceShopee as any[]) {
      const tag = row.tag || '(no tag)'
      const current = sourceTags.get(tag) || { tag, commission: 0, orders: 0, purchase: 0, newUsers: 0 }
      current.commission += Number(row.commission || 0)
      current.purchase += Number(row.purchase || 0)
      current.orders += 1
      if (row.isNewUser) current.newUsers += 1
      sourceTags.set(tag, current)
    }
    return [...sourceTags.values()].map((tag: any) => {
      const base = analysis.tags.find((item: any) => item.tag === tag.tag) || tag
      const spend = Number(base.spend || 0)
      const net = tag.commission - spend * (1 + ppn)
      const roas = spend > 0 ? tag.commission / (spend * (1 + ppn)) : 0
      const roi = spend > 0 ? net / (spend * (1 + ppn)) : 0
      const status = roas >= 1.5 ? 'SCALE' : roas >= 1 ? 'HOLD' : spend > 0 ? 'KILL' : 'TAHAN'
      return {
        ...base,
        ...tag,
        spend,
        net,
        roas,
        roi,
        recommendation: status,
        avgOrder: tag.orders ? tag.commission / tag.orders : 0,
        realRate: base.clickCount ? (tag.orders / base.clickCount) * 100 : null,
        realCpc: base.clickCount ? spend / base.clickCount : null,
      }
    }).sort((a: any, b: any) => b.commission - a.commission)
  }, [analysis.tags, ppn, sourceShopee])
  const visibleTags = useMemo(() => matchedTags.filter((item: any) => {
    const spend = Number(item.spend || 0)
    if (spend < spendFilter.min) return false
    if (spendFilter.max !== null && spend > spendFilter.max) return false
    return true
  }), [matchedTags, spendFilter])
  const scaleCount = visibleTags.filter((item: any) => item.recommendation === 'SCALE').length
  const holdCount = visibleTags.filter((item: any) => item.recommendation === 'HOLD').length
  const tahanCount = visibleTags.filter((item: any) => item.recommendation === 'TAHAN').length
  const killCount = visibleTags.filter((item: any) => item.recommendation === 'KILL').length

  const trafficLabel = `${sourceShopee.length} / ${analysis.shopee.length} orders (${analysis.shopee.length ? Math.round((sourceShopee.length / analysis.shopee.length) * 100) : 0}%)`
  const targetPct = totals.targetRaw > 0 ? Math.max(0, Math.round((totals.net / totals.targetRaw) * 100)) : 0
  const targetPctCapped = Math.min(100, targetPct)
  const charts = current ? [
    { label: 'Spend', value: current.spendPpn, tone: 'gray' },
    { label: 'Komisi', value: current.commission, tone: 'orange' },
  ] : []
  const maxSpendCommission = Math.max(...charts.map((x) => x.value), 1)
  const maxNet = Math.max(...dailyRows.map((x: any) => Math.abs(x.net)), 1)

  const visibleRuns = historyMode === 'Terbaru' ? runs.slice(0, 1) : runs
  const funnelRows = [
    { label: 'Impresi', value: analysis.totals.impressions || 0, pct: 100, sub: 'Tayangan iklan Meta', tone: 'gray' },
    { label: 'Link Clicks', value: totals.clicks, pct: analysis.totals.impressions ? (totals.clicks / analysis.totals.impressions) * 100 : 0, sub: 'Klik iklan (Meta)', tone: 'red' },
    { label: 'Landing Page Views', value: totals.lpViews, pct: totals.clicks ? (totals.lpViews / totals.clicks) * 100 : 0, sub: 'Pixel load berhasil (Meta)', tone: 'amber' },
    { label: 'Unique Orders', value: totals.orders, pct: totals.clicks ? (totals.orders / totals.clicks) * 100 : 0, sub: 'Pesanan di Shopee (by order date)', tone: 'green' },
  ]

  function applySpendFilter() {
    const min = Number(minSpendInput.replace(/\D/g, '')) || 0
    const maxRaw = Number(maxSpendInput.replace(/\D/g, '')) || 0
    setSpendFilter({ min, max: maxRaw > 0 ? maxRaw : null })
  }

  function resetSpendFilter() {
    setMinSpendInput('')
    setMaxSpendInput('')
    setSpendFilter({ min: 0, max: null })
  }

  function exportDailyCsv() {
    const header = ['TANGGAL','SPEND','KOMISI','NET','ROAS','ROI','EPC','META CLICKS','LP VIEWS','LP RATE','ORDERS','ZERO%']
    const rows = dailyRows.map((row: any) => [row.date, Math.round(row.spendPpn), Math.round(row.commission), Math.round(row.net), `${row.roas.toFixed(2)}x`, `${(row.roi * 100).toFixed(1)}%`, Math.round(row.epc), row.clicks || 0, row.lpViews || 0, `${row.lpRate.toFixed(1)}%`, row.orders || 0, `${row.zeroPct.toFixed(1)}%`])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `afftometa-rekap-${current?.date || 'dashboard'}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="dashboardPage">
      <div className="dashboardLayout">
        <aside className="dashboardSidebar">
          <div className="sidebarBrand">
            <span className="heroLogo"><Menu size={15} strokeWidth={2.4} /></span>
            <div>
              <div className="sidebarTitle">Affiliate</div>
              <div className="sidebarSub">Dashboard</div>
            </div>
          </div>
          <nav className="sidebarNav">
            <button type="button" className={tab === 'overview' ? 'sidebarLink active' : 'sidebarLink'} onClick={() => setTab('overview')}><LayoutDashboard size={15} />Overview</button>
            <button type="button" className={tab === 'campaigns' ? 'sidebarLink active' : 'sidebarLink'} onClick={() => setTab('campaigns')}><BarChart3 size={15} />Campaigns</button>
            <button type="button" className={tab === 'produk' ? 'sidebarLink active' : 'sidebarLink'} onClick={() => setTab('produk')}><ShoppingBag size={15} />Produk</button>
            <button type="button" className={tab === 'funnel' ? 'sidebarLink active' : 'sidebarLink'} onClick={() => setTab('funnel')}><Filter size={15} />Funnel</button>
            <button type="button" className={tab === 'atribusi' ? 'sidebarLink active' : 'sidebarLink'} onClick={() => setTab('atribusi')}><Target size={15} />Atribusi</button>
            <button type="button" className={tab === 'history' ? 'sidebarLink active' : 'sidebarLink'} onClick={() => setTab('history')}><Calendar size={15} />History</button>
          </nav>
          <div className="sidebarActions">
            <button type="button" className="coffeeButton"><Heart size={13} />Traktir kopi developer <Coffee size={13} /></button>
            <button type="button" className="sidebarAction" onClick={exportDailyCsv}><Download size={15} />Export Excel</button>
            <button type="button" className="sidebarAction" onClick={onBack}><Upload size={15} />Ganti file</button>
          </div>
        </aside>

        <section className="dashboardMain">
          <div className="dashboardTopbar">
            <div>
              <h2>{tab === 'overview' ? 'Overview' : tab === 'campaigns' ? 'Campaigns' : tab === 'produk' ? 'Produk & Kategori' : tab === 'funnel' ? 'Funnel Konversi' : tab === 'atribusi' ? 'Atribusi Tag' : 'History'}</h2>
              <div className="dashboardDateText">{tab === 'history' ? 'Snapshot analisa tersimpan · membuka history tidak menggabungkan data' : `Tanggal: ${current?.date || run?.createdAt?.slice(0, 10) || '—'}`}</div>
            </div>
            {tab !== 'history' ? null : null}
          </div>

          <div className="toolbarRow">
            <div className="datePillGroup">
              <label className="datePill"><input type="date" value={current?.date || ''} readOnly /></label>
              <span className="dateSep">s/d</span>
              <label className="datePill"><input type="date" value={current?.date || ''} readOnly /></label>
            </div>
            <div className="toolbarButtons">
              <button type="button" className={historyMode === 'Semua' ? 'pillButton active' : 'pillButton'} onClick={() => setHistoryMode('Semua')}>Semua</button>
              <button type="button" className={historyMode === 'Terbaru' ? 'pillButton active' : 'pillButton'} onClick={() => setHistoryMode('Terbaru')}>Terbaru</button>
            </div>
            <div className="toolbarField compactField">
              <span>PPN Meta</span>
              <label className="selectShell">
                <select value={String(ppn)} onChange={(e) => setPpn(Number(e.target.value))}>
                  <option value="0">Tanpa PPN</option>
                  <option value="0.05">5%</option>
                  <option value="0.1">10%</option>
                  <option value="0.11">11%</option>
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
            <div className="toolbarField targetField">
              <span>Target/hari</span>
              <label className="currencyInput"><span>Rp</span><input value={targetPerDay} onChange={(e) => setTargetPerDay(e.target.value)} /></label>
            </div>
          </div>

          {tab === 'history' ? (
            <section className="historyStandalonePanel">
              <div className="historyStandaloneHeader">
                <div>
                  <h3>History Analisa</h3>
                  <p>Pilih 1 snapshot untuk dibuka. History tidak digabung, jadi periode yang overlap tidak bikin data dobel.</p>
                </div>
                <button type="button" className="outlineButton" onClick={onRefreshHistory}>Refresh</button>
              </div>
              <div className="historyItems standalone">
                {visibleRuns.map((saved) => (
                  <div key={saved.id} className="historyStandaloneRow">
                    <div>
                      <div className="historyDateLine">{formatHistoryHeadline(saved.createdAt)}</div>
                      <div className="historyMetaLine">Meta {saved.metaFile || '—'} · Shopee {saved.shopeeFile || '—'} · update {new Date(saved.createdAt).toLocaleString('sv-SE').replace('T', ' ')}</div>
                    </div>
                    <button type="button" className="outlineButton" onClick={() => onOpenRun(saved)}>Buka</button>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <>
              <div className="trafficPanel">
                <div className="trafficPanelHeader"><Filter size={14} />FILTER SUMBER TRAFIK</div>
                <div className="trafficPanelBody">
                  <div className="trafficFilters">
                    <button type="button" className={sourceFilter === 'Semua' ? 'sourceChip active' : 'sourceChip'} onClick={() => setSourceFilter('Semua')}>Semua</button>
                    {allPlatformCounts[0] ? <button type="button" className={sourceFilter === allPlatformCounts[0][0] ? 'sourceChip active' : 'sourceChip'} onClick={() => setSourceFilter(allPlatformCounts[0][0])}>{allPlatformCounts[0][0]}</button> : null}
                  </div>
                  <div className="trafficSummary">{trafficLabel}</div>
                  <div className="platformRow"><span>Per platform:</span>{allPlatformCounts.map(([name, count]) => <button key={name} type="button" className={sourceFilter === name ? 'platformChip active' : 'platformChip'} onClick={() => setSourceFilter(name)}>{name} <strong>{count}</strong></button>)}</div>
                </div>
              </div>

              <div className="infoBanner accent">ℹ Meta CSV terdeteksi dalam <strong>Bahasa Indonesia</strong> — semua kolom terbaca normal.</div>
              <div className="infoBanner muted">ℹ Kenapa komisi di sini beda dengan dashboard Shopee? — Ini normal. CSV ini pakai <strong>Komisi Bersih</strong> (sudah diproses), sedangkan dashboard Shopee nampilkan <strong>Komisi Kotor</strong> (belum final). <button type="button">Selengkapnya</button></div>

              {current ? (
                <div className="summaryStrip">
                  <div className="summaryHeadline">{current.date} · Net {rp(totals.net)} / target {rp(totals.targetRaw)}</div>
                  <div className={targetPct >= 100 ? 'summaryProgress positive' : 'summaryProgress'}>{targetPct}%</div>
                  <div className="targetProgressTrack"><div className={targetPct >= 100 ? 'targetProgressBar positive' : 'targetProgressBar'} style={{ width: `${targetPctCapped}%` }} /></div>
                  <div className="summaryMeta">
                    <span>Spend: <strong>{rp(current.spendPpn)}</strong></span>
                    <span>Komisi: <strong>{rp(current.commission)}</strong></span>
                    <span>ROAS: <strong>{current.roas.toFixed(2)}x</strong></span>
                    <span>ROI: <strong>{(current.roi * 100).toFixed(1)}%</strong></span>
                    <span>Orders: <strong>{fmt.format(current.orders || 0)}</strong></span>
                  </div>
                </div>
              ) : null}

              <div className="statsGrid">
                <StatCard label="Spend + PPN" value={compactRp(totals.spendPpn)} hint="Biaya iklan Meta" />
                <StatCard label="Total Komisi" value={compactRp(totals.commission)} accent />
                <StatCard label="Net Profit" value={compactRp(totals.net, true)} danger={totals.net < 0} accent={totals.net >= 0} />
                <StatCard label="ROAS" value={`${totals.roas.toFixed(2)}x`} accent />
                <StatCard label="ROI" value={`${(totals.roi * 100).toFixed(1)}%`} hint="(Komisi−Spend)/Spend" danger={totals.roi < 0} accent={totals.roi >= 0} />
                <StatCard label="Meta Clicks" value={fmt.format(totals.clicks)} hint={`CPC: ${rp(totals.cpc)}`} />
                <StatCard label="LP Views (Meta)" value={fmt.format(totals.lpViews)} hint={`LP rate: ${totals.lpRate.toFixed(1)}%`} />
                <StatCard label="Unique Orders" value={fmt.format(totals.orders)} hint={`Komisi/order: ${rp(totals.commissionPerOrder)}`} />
                <StatCard label="Zero Komisi" value={`${totals.zeroPct.toFixed(1)}%`} hint={`${totals.zeroItems} dari ${totals.totalItems} item`} accent />
              </div>

              {tab === 'overview' ? (
                <>
                  <div className="chartGrid">
                    <section className="chartPanel">
                      <h3>SPEND VS KOMISI</h3>
                      <div className="chartLegend"><span><i className="legend legendGray" />Spend</span><span><i className="legend legendOrange" />Komisi</span></div>
                      <div className="axisChartShell">
                        <div className="yAxisLabels"><span>{compactRp(maxSpendCommission)}</span><span>{compactRp(maxSpendCommission * 0.66)}</span><span>{compactRp(maxSpendCommission * 0.33)}</span><span>Rp0</span></div>
                        <div className="barChartArea">
                          {charts.map((item) => (
                            <div key={item.label} className="barColumn">
                              <div className={`bar bar-${item.tone}`} style={{ height: `${Math.max(18, (item.value / maxSpendCommission) * 160)}px` }} />
                              <div className="barLabel">{current?.date?.slice(5) || '—'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                    <section className="chartPanel">
                      <h3>NET PROFIT HARIAN</h3>
                      <div className="axisChartShell">
                        <div className="yAxisLabels"><span>{compactRp(maxNet)}</span><span>{compactRp(maxNet * 0.66)}</span><span>{compactRp(maxNet * 0.33)}</span><span>Rp0</span></div>
                        <div className="netChartArea">
                          {dailyRows.map((row: any) => (
                            <div key={row.date} className="netColumn">
                              <div className={`netBar ${row.net < 0 ? 'negative' : 'positive'}`} style={{ height: `${Math.max(18, (Math.abs(row.net) / maxNet) * 170)}px` }} />
                              <div className="barLabel">{row.date.slice(5)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  </div>

                  <section className="resultTablePanel dashboardTablePanel">
                    <div className="tableHeaderRow">
                      <h3>REKAP HARIAN</h3>
                      <div className="tableHeaderHint">komisi by Waktu Pemesanan (tanggal order)</div>
                    </div>
                    <div className="resultTableWrap">
                      <table>
                        <thead>
                          <tr>
                            <th>TANGGAL</th>
                            <th><HelpLabel label="Spend" /></th>
                            <th><HelpLabel label="Komisi" /></th>
                            <th><HelpLabel label="Net" /></th>
                            <th><HelpLabel label="ROAS" /></th>
                            <th><HelpLabel label="ROI" /></th>
                            <th><HelpLabel label="EPC" /></th>
                            <th>META CLICKS</th>
                            <th>LP VIEWS</th>
                            <th><HelpLabel label="LP RATE" /></th>
                            <th><HelpLabel label="Orders" /></th>
                            <th><HelpLabel label="Zero%" /></th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyRows.map((row: any) => (
                            <tr key={row.date}>
                              <td>{row.date}</td>
                              <td>{fmt.format(Math.round(row.spendPpn))}</td>
                              <td>{fmt.format(Math.round(row.commission))}</td>
                              <td>{fmt.format(Math.round(row.net))}</td>
                              <td>{row.roas.toFixed(2)}x</td>
                              <td>{(row.roi * 100).toFixed(1)}%</td>
                              <td>{rp(row.epc)}</td>
                              <td>{fmt.format(row.clicks || 0)}</td>
                              <td>{fmt.format(row.lpViews || 0)}</td>
                              <td>{row.lpRate.toFixed(1)}%</td>
                              <td>{fmt.format(row.orders || 0)}</td>
                              <td>{row.zeroPct.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              ) : null}

              {tab === 'campaigns' ? (
                <section className="resultTablePanel dashboardTablePanel">
                  <div className="tableHeaderRow stack">
                    <h3>PERFORMA CAMPAIGN</h3>
                    <div className="tableHeaderHint">Klik header kolom untuk sortir · LP Rate: hijau ≥40% · amber 20–40% · merah &lt;20%</div>
                  </div>
                  <div className="resultTableWrap">
                    <table>
                      <thead>
                        <tr><th>CAMPAIGN</th><th>SPEND</th><th>CLICKS</th><th>LP VIEWS</th><th>LP RATE</th><th>CTR</th><th>CPC (RP)</th><th>CPM (RP)</th><th>HARI</th></tr>
                      </thead>
                      <tbody>
                        {analysis.campaigns.map((row: any) => (
                          <tr key={row.campaign}><td>{row.campaign}</td><td>{fmt.format(Math.round(row.spend))}</td><td>{fmt.format(row.clicks || 0)}</td><td>{fmt.format(row.lpViews || 0)}</td><td>{((row.lpRate || 0) * 100).toFixed(1)}%</td><td>{row.impressions ? `${((row.clicks / row.impressions) * 100).toFixed(1)}%` : '0.0%'}</td><td>{fmt.format(Math.round(row.cpc || 0))}</td><td>{row.impressions ? fmt.format(Math.round((row.spend / row.impressions) * 1000)) : '0'}</td><td>{dailyRows.length}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="subtleFooterNote">ℹ ROAS per campaign tersedia di tab Atribusi setelah Tag_link1 diisi saat buat link Shopee Affiliate.</div>
                </section>
              ) : null}

              {tab === 'produk' ? (
                <div className="produkGrid">
                  <section className="resultTablePanel dashboardTablePanel produkChannelPanel">
                    <h3>KOMISI PER CHANNEL</h3>
                    <div className="channelCards">
                      {channelRows.map((row) => <MetricBadge key={row.label} label={row.label} value={compactRp(row.commission)} sub={`${Math.round((row.commission / Math.max(1, totals.commission)) * 100)}% dari total · ${row.orders.size || row.items} orders`} />)}
                    </div>
                  </section>
                  <section className="resultTablePanel dashboardTablePanel donutPanel">
                    <h3>KOMISI PER KATEGORI</h3>
                    <div className="donutRow">
                      <div className="donutChart" style={{ background: categoryDonut }} />
                      <div className="donutLegend">{categoryRows.slice(0, 8).map((row, idx) => <div key={row.category}><i style={{ background: DONUT_COLORS[idx % DONUT_COLORS.length] }} />{row.category}</div>)}</div>
                    </div>
                  </section>
                  <section className="resultTablePanel dashboardTablePanel donutPanel">
                    <h3>PLATFORM KLIK</h3>
                    <div className="donutRow">
                      <div className="donutChart" style={{ background: platformDonut }} />
                      <div className="donutLegend">{platformCounts.map(([name], idx) => <div key={name}><i style={{ background: DONUT_COLORS[idx % DONUT_COLORS.length] }} />{name}</div>)}</div>
                    </div>
                  </section>
                  <section className="resultTablePanel dashboardTablePanel sideStatsPanel produkStatsRow">
                    <MetricBadge label="Zero commission rate" value={`${totals.zeroPct.toFixed(1)}%`} sub={`${totals.zeroItems} dari ${totals.totalItems} items`} />
                    <MetricBadge label="Avg komisi / item (non-zero)" value={rp((totals.commission || 0) / Math.max(1, totals.totalItems - totals.zeroItems))} sub={`${Math.max(0, totals.totalItems - totals.zeroItems)} item yang dapat komisi`} />
                  </section>
                  <section className="resultTablePanel dashboardTablePanel produkTablePanel">
                    <div className="tableHeaderRow"><h3>TOP 15 PRODUK BY KOMISI</h3></div>
                    <div className="resultTableWrap">
                      <table>
                        <thead><tr><th>PRODUK</th><th>KATEGORI</th><th>KOMISI (RP)</th><th>ITEMS</th><th>AVG / ITEM</th></tr></thead>
                        <tbody>
                          {productRows.map((row) => <tr key={row.product}><td title={row.product}>{row.product}</td><td>{row.category}</td><td>{fmt.format(Math.round(row.commission))}</td><td>{row.items}</td><td>{rp(row.commission / Math.max(1, row.items))}</td></tr>)}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              ) : null}

              {tab === 'funnel' ? (
                <div className="funnelLayout">
                  <section className="resultTablePanel dashboardTablePanel funnelBreakdownPanel">
                    <div className="funnelRows">
                      {funnelRows.map((row) => <div key={row.label} className="funnelStep">
                        <div className="funnelStepTop"><span>{row.label}</span><strong>{fmt.format(Math.round(row.value))}</strong><b className={row.pct < 20 && row.label !== 'Impresi' ? 'badRate' : ''}>{row.label === 'Impresi' ? '' : `${row.pct.toFixed(1)}%`}</b></div>
                        <div className="funnelBarTrack"><div className={`funnelBar ${row.tone}`} style={{ width: `${Math.min(100, Math.max(1, row.pct))}%` }} /></div>
                        <small>{row.sub}</small>
                      </div>)}
                      <div className="funnelCommission"><span>Total Komisi</span><strong>{rp(totals.commission)}</strong><small>Komisi bersih affiliate (Rp)</small></div>
                    </div>
                  </section>
                  <section className="funnelSideGrid">
                    <MetricBadge label="CLICK TO LP" value={`${totals.lpRate.toFixed(1)}%`} sub="LP views / Clicks" />
                    <MetricBadge label="CLICK-TO-ORDER" value={`${totals.clicks ? ((totals.orders / totals.clicks) * 100).toFixed(1) : '0.0'}%`} sub="Orders / Clicks" />
                    <MetricBadge label="COST PER ORDER" value={rp(totals.orders ? totals.spendPpn / totals.orders : 0)} sub="Spend+PPN / Orders" />
                    <MetricBadge label="KOMISI PER ORDER" value={rp(totals.commissionPerOrder)} sub="Komisi / Order" />
                    <MetricBadge label="EPC (KOMISI/KLIK)" value={rp(totals.clicks ? totals.commission / totals.clicks : 0)} sub="Komisi / Meta clicks" />
                    <MetricBadge label="ROI" value={`${(totals.roi * 100).toFixed(1)}%`} sub="(Komisi - Spend) / Spend" />
                    <MetricBadge label="CPC EFEKTIF" value={rp(totals.cpc)} sub="Spend+PPN / Clicks" />
                  </section>
                </div>
              ) : null}

              {tab === 'atribusi' ? (
                <>
                  <section className="resultTablePanel dashboardTablePanel">
                    <div className="tableHeaderRow stack">
                      <h3>ATRIBUSI PER TAG</h3>
                      <div className="tableHeaderHint">Klik baris untuk lihat detail produk per tag</div>
                      <div className="atribusiFilters">
                        <label><span>MIN SPEND</span><input value={minSpendInput} onChange={(e) => setMinSpendInput(e.target.value)} placeholder="contoh 60000" /></label>
                        <label><span>MAX SPEND</span><input value={maxSpendInput} onChange={(e) => setMaxSpendInput(e.target.value)} placeholder="opsional" /></label>
                        <button type="button" className="outlineButton" onClick={applySpendFilter}>Terapkan</button>
                        <button type="button" className="outlineButton reset" onClick={resetSpendFilter}>Reset</button>
                        <small>Tampil {visibleTags.length} dari {matchedTags.length} tag</small>
                      </div>
                    </div>
                    <div className="resultTableWrap">
                      <table>
                        <thead><tr><th></th><th>TAG (LINK1)</th><th>AKUN</th><th>MATCH</th><th><HelpLabel label="Spend" /></th><th><HelpLabel label="Komisi" /></th><th><HelpLabel label="Net" /></th><th><HelpLabel label="ROAS" /></th><th><HelpLabel label="ROI" /></th><th><HelpLabel label="CPC META" /></th><th><HelpLabel label="EPC" /></th><th>NEW USER</th><th>REKOMENDASI</th><th><HelpLabel label="Orders" /></th><th>AVG/ORDER</th><th><HelpLabel label="REAL CPC" /></th><th><HelpLabel label="REAL RATE" /></th></tr></thead>
                        <tbody>
                          {visibleTags.map((row: any) => <tr key={row.tag}><td>▸</td><td>{row.tag}</td><td>Akun 1</td><td>{row.campaign || '–'}</td><td>{row.spend ? fmt.format(Math.round(row.spend)) : '–'}</td><td>{fmt.format(Math.round(row.commission || 0))}</td><td>{row.net >= 0 ? `+${fmt.format(Math.round(row.net))}` : fmt.format(Math.round(row.net))}</td><td>{row.roas ? `${row.roas.toFixed(2)}x` : '–'}</td><td>{row.roi ? `${(row.roi * 100).toFixed(1)}%` : '–'}</td><td>{row.metaClicks ? rp(row.spend / row.metaClicks) : '–'}</td><td>{row.metaClicks ? rp(row.commission / row.metaClicks) : '–'}</td><td>{row.newUsers || 0}</td><td><span className={`recommendation ${String(row.recommendation).toLowerCase()}`}>{row.recommendation}</span></td><td>{row.orders || 0}</td><td>{row.orders ? rp(row.avgOrder) : '–'}</td><td>{row.realCpc ? rp(row.realCpc) : '–'}</td><td>{row.realRate !== null ? `${row.realRate.toFixed(1)}%` : '–'}</td></tr>)}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <section className="resultTablePanel dashboardTablePanel actionSummaryPanel">
                    <h3>RANGKUMAN AKSI BERDASARKAN DATA DI ATAS</h3>
                    <p>Ringkasan ini mengikuti rekomendasi per tag/campaign yang sedang tampil setelah filter tanggal/akun/platform.</p>
                    <div className="actionCounts"><MetricBadge label="SCALE — hanya ≥1.5x" value={String(scaleCount)} /><MetricBadge label="HOLD — 1.0–1.49x jangan scale" value={String(holdCount)} /><MetricBadge label="KILL — stop spend" value={String(killCount)} /></div>
                    <div className="actionNarrative">TAHAN: {holdCount + tahanCount} tag/campaign jangan discale. ROAS 1.0–1.49x tetap HOLD selama masih profit; tunggu EPC normal, order, dan Real Rate lebih jelas.</div>
                    <div className="actionNarrative subtle">Real Rate sebagian kosong: beberapa baris belum punya klik Shopee. Keputusan baris itu masih pakai proxy Meta + komisi.</div>
                  </section>
                </>
              ) : null}
            </>
          )}

          <footer className="uploadFooter dashboardFooter">{FOOTER_TEXT}</footer>
        </section>
      </div>
    </main>
  )
}

export default function App() {
  const [emailInput, setEmailInput] = useState('')
  const [email, setEmail] = useState('')
  const [workspace, setWorkspace] = useState<WorkspaceState>(makeWorkspace())
  const [runs, setRuns] = useState<SavedRun[]>([])
  const [error, setError] = useState('')
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideStep, setGuideStep] = useState<GuideStepId>('persiapan')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [activeRun, setActiveRun] = useState<SavedRun | null>(null)

  async function refreshHistory(currentEmail = email) {
    if (!currentEmail) return
    const fallback = makeReferenceRun(currentEmail)
    const storedRuns = await listRuns(currentEmail)
    const hydratedRuns = storedRuns.map((run) => run.analysis ? run : { ...run, analysis: fallback.analysis })
    setRuns(hydratedRuns.length ? hydratedRuns : [fallback])
  }

  useEffect(() => {
    const savedEmail = window.localStorage.getItem('afftometa_email') || ''
    if (savedEmail) {
      setEmail(savedEmail)
      setEmailInput(savedEmail)
      void refreshHistory(savedEmail)
    }
  }, [])

  async function handleLogin() {
    const normalized = emailInput.trim().toLowerCase()
    if (!normalized) {
      setError('Masukkan email yang sudah di-whitelist.')
      return
    }
    setError('')
    setEmail(normalized)
    window.localStorage.setItem('afftometa_email', normalized)
    await refreshHistory(normalized)
  }

  function openRun(run: SavedRun) {
    if (!run.analysis) {
      setError('Snapshot history ini belum punya data analisa.')
      return
    }
    setError('')
    setActiveRun(run)
    setAnalysis(run.analysis)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  async function handleAnalyze() {
    try {
      if (!workspace.metaFile) throw new Error('Upload Meta CSV dulu.')
      const shopeeFiles = workspace.shopeeAccounts.filter((x) => x.file).map((x) => x.file as File)
      if (!shopeeFiles.length) throw new Error('Upload Shopee CSV dulu.')
      const metaText = await readText(workspace.metaFile)
      const shopeeTexts = await Promise.all(shopeeFiles.map((f) => readText(f)))
      const mergedShopee = shopeeTexts.map((text, index) => {
        const lines = text.split(/\r?\n/)
        return index === 0 ? lines.join('\n') : lines.slice(1).join('\n')
      }).join('\n')
      const clickText = workspace.clickFile ? await readText(workspace.clickFile) : ''
      const result = analyze(metaText, mergedShopee, 0, clickText)
      setAnalysis(result)
      const savedRun = {
        email,
        name: workspace.name || 'Workspace',
        metaFile: workspace.metaFileName,
        shopeeFile: shopeeFiles.map((f) => f.name).join(', '),
        ppn: 0,
        analysis: result,
      }
      setActiveRun({ ...savedRun, createdAt: new Date().toISOString() })
      await saveRun(savedRun)
      await refreshHistory(email)
    } catch (err: any) {
      setError(err.message || String(err))
    }
  }

  const metaReady = !!workspace.metaFileName
  const shopeeReadyCount = workspace.shopeeAccounts.filter((account) => account.fileName).length
  const ready = metaReady && shopeeReadyCount > 0

  if (!email) {
    return (
      <main className="loginPage">
        <section className="loginCard">
          <div className="loginEyebrow">PRIVATE MEMBER AREA</div>
          <h1>{APP_NAME}</h1>
          <p>Masukkan email yang sudah di-whitelist buat akses dashboard tracking Shopee Affiliate × Meta Ads dan history campaign.</p>
          <input value={emailInput} onChange={(event) => setEmailInput(event.target.value)} placeholder="emailkamu@gmail.com" onKeyDown={(event) => { if (event.key === 'Enter') void handleLogin() }} />
          <button type="button" className="loginButton" onClick={() => void handleLogin()}>Masuk Dashboard</button>
          {error ? <p className="errorText">{error}</p> : null}
        </section>
      </main>
    )
  }

  if (analysis) {
    return <ResultScreen analysis={analysis} onBack={() => { setAnalysis(null); setActiveRun(null) }} run={activeRun} runs={runs} onOpenRun={openRun} onRefreshHistory={() => void refreshHistory(email)} />
  }

  return (
    <>
      <main className="uploadPage">
        <div className="uploadShell">
          <Header onOpenGuide={() => { setGuideOpen(true); setGuideStep('persiapan') }} />
          <div className="workspaceHeading">Workspace</div>
          <p className="workspaceSubheading">1 workspace = 1 akun Meta + akun Shopee yang dipairing</p>

          <section className="workspacePanel">
            <div className="workspaceBar">
              <span className="workspaceIndex">1</span>
              <input className="workspaceNameInput" value={workspace.name} onChange={(event) => setWorkspace((current) => ({ ...current, name: event.target.value }))} placeholder="Nama workspace (contoh: Aisyah Store)" />
              <span className="workspaceStatus">Meta {metaReady ? '✓' : '—'} · Shopee {shopeeReadyCount}/1 ▾</span>
            </div>
            <div className="workspaceBody">
              <div className="sectionCaption">META ADS CSV — BREAKDOWN BY CAMPAIGN + DAY</div>
              <div className="uploadCard">
                <div className="uploadIconWrap"><Upload size={12} strokeWidth={2.2} /></div>
                <div className="uploadContent">
                  <strong>Meta Ads Manager Export</strong>
                  <span>Amount spent · Link clicks · LP Views · Impressions</span>
                </div>
                <label className="outlineButton">Upload CSV<input type="file" accept=".csv,text/csv" onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) setWorkspace((current) => ({ ...current, metaFileName: file.name, metaFile: file }))
                  event.currentTarget.value = ''
                }} /></label>
              </div>

              <div className="sectionDivider" />
              <div className="sectionCaption">SHOPEE AFFILIATE CSV — BISA LEBIH DARI 1 AKUN</div>
              <div className="shopeeAccounts">
                {workspace.shopeeAccounts.map((account, index) => (
                  <div className="shopeeAccountRow" key={account.id}>
                    <span className="workspaceIndex small">{index + 1}</span>
                    <input value={account.name} onChange={(event) => setWorkspace((current) => ({ ...current, shopeeAccounts: current.shopeeAccounts.map((item) => item.id === account.id ? { ...item, name: event.target.value } : item) }))} placeholder="Nama akun (contoh: Akun Gamis)" />
                    <label className="outlineButton compact">Pilih CSV<input type="file" accept=".csv,text/csv" onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) setWorkspace((current) => ({ ...current, shopeeAccounts: current.shopeeAccounts.map((item) => item.id === account.id ? { ...item, fileName: file.name, file } : item) }))
                      event.currentTarget.value = ''
                    }} /></label>
                    <span className="fileState">{account.fileName || 'Belum ada'}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="dashedAction" onClick={() => setWorkspace((current) => ({ ...current, shopeeAccounts: [...current.shopeeAccounts, { id: Date.now(), name: '', fileName: '', file: null }] }))}><Plus size={14} />Tambah Akun Shopee</button>

              <div className="sectionCaption topGap">SHOPEE CLICK REPORT — OPSIONAL (BISA DIUPLOAD SORE/H+1)</div>
              <div className="uploadCard">
                <div className="uploadIconWrap"><FileSpreadsheet size={12} strokeWidth={2.2} /></div>
                <div className="uploadContent">
                  <strong>WebsiteClickReport Shopee</strong>
                  <span>Opsional · Klik ID · Waktu Klik · Tag_link · Perujuk</span>
                </div>
                <label className="outlineButton">Upload Klik<input type="file" accept=".csv,text/csv" onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) setWorkspace((current) => ({ ...current, clickFileName: file.name, clickFile: file }))
                  event.currentTarget.value = ''
                }} /></label>
              </div>
            </div>
          </section>

          <button type="button" className="dashedAction workspaceActionStub"><Plus size={14} />Tambah Workspace (Akun Meta baru)</button>

          <section className="notesPanel">
            <p><strong>Workspace:</strong> Tiap workspace punya 1 akun Meta + akun Shopee yang dipasangin. Data antar workspace dipisah — ROAS dan spend nggak akan nyampur.</p>
            <p><strong>Tag_link1:</strong> Isi dengan nama campaign Meta saat buat link Shopee untuk tracking ROAS per-campaign.</p>
            <p><strong>PPN:</strong> Set di topbar dashboard setelah upload.</p>
            <p><strong>Catatan komisi:</strong> Angka di CSV affiliate (<em>Komisi Bersih</em>) bisa lebih rendah dari dashboard performa Shopee (<em>Komisi Kotor</em>) — ini normal. Shopee butuh waktu untuk memproses dan memverifikasi order sebelum masuk ke CSV. Selisih akan mengecil saat order makin banyak yang selesai.</p>
          </section>

          <section className="historyPanel">
            <div className="historyPanelHeader">
              <div>
                <h3>Pulihkan History Terakhir</h3>
                <p>Kalau halaman ke-reload, buka snapshot tersimpan tanpa upload ulang file. History tetap per-email dan tidak digabung antar periode.</p>
              </div>
              <button type="button" className="outlineButton" onClick={() => void refreshHistory(email)}>Refresh</button>
            </div>
            <div className="historyItems">
              {runs.length === 0 ? <p className="historyEmpty">Belum ada history tersimpan untuk {email}.</p> : null}
              {runs.map((run) => (
                <div className="historyRow" key={run.id} onClick={() => openRun(run)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') openRun(run) }}>
                  <div>
                    <div className="historyDateLine">{formatHistoryHeadline(run.createdAt)}</div>
                    <div className="historyMetaLine">1 upload tersimpan · Meta {run.metaFile || '—'} · Shopee {run.shopeeFile || '—'} · update {new Date(run.createdAt).toLocaleString('sv-SE').replace('T', ' ')}</div>
                  </div>
                  <button type="button" className="outlineButton" onClick={(event) => { event.stopPropagation(); openRun(run) }}>Buka</button>
                </div>
              ))}
            </div>
          </section>

          <button type="button" className={ready ? 'analyzeButton ready' : 'analyzeButton'} disabled={!ready} onClick={() => void handleAnalyze()}>Mulai Analisa →</button>
          <footer className="uploadFooter">{FOOTER_TEXT}</footer>
          {error ? <p className="errorText">{error}</p> : null}
        </div>
      </main>
      <GuideModal active={guideOpen} onClose={() => setGuideOpen(false)} step={guideStep} setStep={setGuideStep} />
    </>
  )
}
