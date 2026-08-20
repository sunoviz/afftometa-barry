import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronDown, CircleHelp, Menu, Plus, RefreshCw, Upload } from 'lucide-react'
import { analyze, type Analysis } from './lib/parser'
import { deleteRun, listRuns, saveRun, type SavedRun } from './lib/history'
import './App.css'

const fmt = new Intl.NumberFormat('id-ID')
const rp = (n: number) => `Rp ${fmt.format(Math.round(n || 0))}`
const pct = (n: number) => `${((n || 0) * 100).toFixed(1)}%`
const readText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })

type GuideStepId = 'persiapan' | 'meta' | 'shopee' | 'dashboard' | 'atribusi'
type WorkspaceShopeeAccount = { id: number; name: string; file: File | null }
type WorkspaceState = {
  id: number
  name: string
  metaFile: File | null
  shopeeAccounts: WorkspaceShopeeAccount[]
  clickFile: File | null
}

const GUIDE_STEPS: Array<{ id: GuideStepId; label: string; title: string; body: React.ReactNode }> = [
  {
    id: 'persiapan',
    label: 'Persiapan',
    title: 'Apa yang dibutuhkan',
    body: (
      <>
        <GuidePoint
          number={1}
          title="Apa yang dibutuhkan"
          text={
            <>
              Dashboard ini menggabungkan dua sumber data: <strong>Meta Ads CSV</strong> (data spend & klik
              iklan) dan <strong>Shopee Affiliate CSV</strong> (data komisi). Di versi Satruk, hasil analisa
              bisa disimpan ke server dan dibuka lagi lewat menu History.
            </>
          }
        />
        <GuidePoint
          number={2}
          title="Samakan range tanggal"
          text={
            <>
              Pastikan range tanggal Meta CSV dan Shopee CSV <strong>sama persis</strong>. Kalau Meta hanya 1
              hari tapi Shopee 7 hari, ROAS yang muncul akan menyesatkan — dashboard akan otomatis kasih
              peringatan kuning.
              <div className="guideExample">
                <strong>Contoh yang benar:</strong> Meta export 24–30 Mar · Shopee export 24–30 Mar
                <br />
                <strong>Contoh yang salah:</strong> Meta export 30 Mar · Shopee export 24–30 Mar
              </div>
            </>
          }
        />
        <GuidePoint
          number={3}
          title="Format file"
          text={
            <>
              Kedua file harus dalam format <strong>.CSV</strong>. Jangan ubah nama kolom atau format isi file —
              dashboard membaca nama kolom secara langsung dari header CSV.
            </>
          }
        />
      </>
    ),
  },
  {
    id: 'meta',
    label: 'Export Meta',
    title: 'Buka Meta Ads Manager',
    body: (
      <>
        <GuidePoint
          number={1}
          title="Buka Meta Ads Manager"
          text={
            <>
              Pergi ke <strong>Ads Manager → Campaigns</strong>. Pastikan lo berada di level Campaign, bukan Ad
              Sets atau Ads.
            </>
          }
        />
        <GuidePoint
          number={2}
          title="Set kolom yang dibutuhkan"
          text={
            <>
              Klik <strong>Columns → Customize Columns</strong>, tambahkan:
              <div className="guideCodeLine">
                <code>Amount spent</code> · <code>Link clicks</code> atau <code>Unique link clicks</code> ·{' '}
                <code>Landing page views</code> · <code>Impressions</code> · <code>CPC (link)</code> ·{' '}
                <code>CPM</code> · <code>CTR (link)</code>
              </div>
            </>
          }
        />
        <GuidePoint
          number={3}
          title="Set breakdown dan export"
          text={
            <>
              Klik <strong>Breakdown → By Time → Day</strong> supaya data per hari muncul. Pilih range tanggal yang
              diinginkan, lalu klik <strong>Export → Export Table Data (CSV)</strong>.
              <div className="guideExample">
                <strong>Penting:</strong> Tanpa breakdown by Day, semua data akan jadi satu baris dan chart harian
                tidak bisa ditampilkan.
              </div>
            </>
          }
        />
      </>
    ),
  },
  {
    id: 'shopee',
    label: 'Export Shopee',
    title: 'Buka panel Shopee Affiliate',
    body: (
      <>
        <GuidePoint
          number={1}
          title="Buka panel Shopee Affiliate"
          text={
            <>
              Login ke <strong>affiliate.shopee.co.id</strong> → pilih menu <strong>Komisi</strong> atau{' '}
              <strong>Commission Report</strong>.
            </>
          }
        />
        <GuidePoint
          number={2}
          title="Set filter tanggal"
          text={
            <>
              Set range tanggal yang <strong>sama dengan Meta CSV</strong>. Shopee menggunakan{' '}
              <strong>Waktu Pemesanan</strong> (tanggal order) sebagai basis filter.
            </>
          }
        />
        <GuidePoint
          number={3}
          title="Export CSV"
          text={
            <>
              Klik tombol <strong>Export</strong> atau <strong>Unduh</strong>. File yang didownload langsung bisa
              diupload ke dashboard tanpa modifikasi apapun.
              <div className="guideExample">
                <strong>Catatan:</strong> Order dengan status <strong>Dibatalkan</strong> otomatis dikeluarkan.
                Order <strong>Tertunda</strong> tetap dihitung karena cancel rate hanya sekitar 1–2%.
                <br />
                <br />
                <strong>Soal perbedaan angka komisi:</strong> Wajar kalau total komisi di sini lebih rendah dari
                angka di dashboard Shopee. CSV pakai <em>Komisi Bersih</em> (sudah diverifikasi), dashboard Shopee
                pakai <em>Komisi Kotor</em> (belum final). Selisihnya mengecil kalau export dilakukan beberapa hari
                setelah periode berakhir.
              </div>
            </>
          }
        />
      </>
    ),
  },
  {
    id: 'dashboard',
    label: 'Baca Dashboard',
    title: 'Cara baca hasil analisa',
    body: (
      <>
        <GuidePoint
          number={1}
          title="Kartu KPI"
          text={
            <>
              Kartu paling atas nunjukkin spend + PPN, total komisi, net profit, ROAS, ROI, clicks, LP Views,
              dan zero komisi. Ini ringkasan paling cepat buat tahu campaign lagi sehat atau nggak.
            </>
          }
        />
        <GuidePoint
          number={2}
          title="Chart harian"
          text={
            <>
              Grafik Spend vs Komisi dan Net Profit Harian dipakai buat ngeliat pola performa per hari. Kalau ada
              hari spend tinggi tapi komisi turun, biasanya masalahnya ada di kreatif, landing, atau range tanggal.
            </>
          }
        />
        <GuidePoint
          number={3}
          title="History"
          text={
            <>
              Setiap hasil analisa yang disimpan bakal masuk ke history per email. Jadi kalau halaman ke-reload,
              lo tinggal buka snapshot terakhir tanpa upload ulang file.
            </>
          }
        />
      </>
    ),
  },
  {
    id: 'atribusi',
    label: 'Atribusi Tag',
    title: 'Cara kerja Tag_link1',
    body: (
      <>
        <GuidePoint
          number={1}
          title="Gunakan nama campaign Meta"
          text={
            <>
              Isi <strong>Tag_link1</strong> di link Shopee dengan nama campaign Meta saat bikin link. Dashboard akan
              berusaha match Tag_link1 ke nama campaign biar spend bisa dibaca per campaign.
            </>
          }
        />
        <GuidePoint
          number={2}
          title="Jenis pencocokan"
          text={
            <>
              Match type bisa <strong>exact</strong>, <strong>contains</strong>, atau <strong>unmatched</strong>.
              Exact paling bagus. Kalau contains, cek lagi karena kemungkinan ada nama campaign yang mirip.
            </>
          }
        />
        <GuidePoint
          number={3}
          title="Kalau ROAS nggak nyambung"
          text={
            <>
              Biasanya karena tag beda penulisan, campaign rename setelah link dibuat, atau range tanggal Meta dan
              Shopee nggak sinkron. Rapihin Tag_link1 dulu baru baca ROAS per tag.
            </>
          }
        />
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

function Kpi({
  label,
  value,
  sub,
  tone = '',
}: {
  label: string
  value: string
  sub?: string
  tone?: string
}) {
  return (
    <div className={`kpiCard ${tone}`.trim()}>
      <div className="kpiLabel">{label}</div>
      <div className="kpiValue">{value}</div>
      {sub && <div className="kpiSub">{sub}</div>}
    </div>
  )
}

function SummaryCard({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section className="summaryCard">
      <h3>{title}</h3>
      <ul>
        {rows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </section>
  )
}

function FileUploadButton({
  label,
  onFile,
  className,
}: {
  label: string
  onFile: (file: File) => void
  className?: string
}) {
  return (
    <label className={className || 'ghostButton'}>
      {label}
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.currentTarget.value = ''
        }}
      />
    </label>
  )
}

function formatHistoryLabel(createdAt: string) {
  const created = new Date(createdAt)
  const now = new Date()
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startCreated = new Date(created.getFullYear(), created.getMonth(), created.getDate())
  const diffDays = Math.round((startNow.getTime() - startCreated.getTime()) / 86_400_000)

  if (diffDays === 0) return 'Hari ini'
  if (diffDays === 1) return 'Kemarin'
  if (diffDays === 2) return '2 hari lalu'
  if (diffDays === 3) return '3 hari lalu'
  if (diffDays === 4) return '4 hari lalu'
  if (diffDays === 5) return '5 hari lalu'
  if (diffDays === 6) return '6 hari lalu'
  return created.toLocaleDateString('id-ID')
}

function Header({ onOpenGuide }: { onOpenGuide: () => void }) {
  return (
    <header className="heroHeader">
      <div className="heroBrand">
        <span className="heroLogo">
          <Menu size={18} />
        </span>
        <div>
          <h1>Satruk Affiliate Tracker</h1>
          <p>Shopee × Meta Ads History Tracker</p>
        </div>
      </div>
      <button type="button" className="guideButton" onClick={onOpenGuide}>
        <CircleHelp size={14} />
        Panduan
      </button>
    </header>
  )
}

function GuideModal({
  active,
  onClose,
  step,
  setStep,
}: {
  active: boolean
  onClose: () => void
  step: GuideStepId
  setStep: (step: GuideStepId) => void
}) {
  if (!active) return null

  const index = GUIDE_STEPS.findIndex((item) => item.id === step)
  const current = GUIDE_STEPS[index]
  const prev = index > 0 ? GUIDE_STEPS[index - 1] : null
  const next = index < GUIDE_STEPS.length - 1 ? GUIDE_STEPS[index + 1] : null

  return (
    <div className="guideOverlay" role="dialog" aria-modal="true">
      <div className="guideModal">
        <div className="guideModalHeader">
          <div>
            <h2>Panduan Penggunaan Dashboard</h2>
            <p>5 langkah untuk mulai tracking affiliate lo</p>
          </div>
          <button type="button" className="closeButton" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="guideTabs">
          {GUIDE_STEPS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === step ? 'guideTab active' : 'guideTab'}
              onClick={() => setStep(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="guideContent">
          <div className="guideGrid">
            <div className="guideNumber">1</div>
            <div className="guideTitle">{current.title}</div>
            <div className="guideTextBlock">{current.body}</div>
          </div>
        </div>

        <div className="guideFooter">
          <button type="button" className="guideNav" onClick={() => prev && setStep(prev.id)} disabled={!prev}>
            ← Sebelumnya
          </button>
          <button type="button" className="guideNav primary" onClick={() => next && setStep(next.id)} disabled={!next}>
            Selanjutnya →
          </button>
        </div>
      </div>
    </div>
  )
}

function UploadScreen({
  email,
  workspaces,
  setWorkspaces,
  onAnalyze,
  historyRuns,
  onRestore,
  onRefreshHistory,
  error,
  onOpenGuide,
}: {
  email: string
  workspaces: WorkspaceState[]
  setWorkspaces: React.Dispatch<React.SetStateAction<WorkspaceState[]>>
  onAnalyze: () => void
  historyRuns: SavedRun[]
  onRestore: (run: SavedRun) => void
  onRefreshHistory: () => void
  error: string
  onOpenGuide: () => void
}) {
  const primary = workspaces[0]
  const metaReady = !!primary?.metaFile
  const shopeeCount = primary?.shopeeAccounts.filter((item) => item.file).length || 0
  const ready = metaReady && shopeeCount > 0

  const updateWorkspace = (updater: (current: WorkspaceState) => WorkspaceState) => {
    setWorkspaces((current) => current.map((workspace, index) => (index === 0 ? updater(workspace) : workspace)))
  }

  const addShopeeAccount = () => {
    updateWorkspace((current) => ({
      ...current,
      shopeeAccounts: [
        ...current.shopeeAccounts,
        { id: Date.now(), name: '', file: null },
      ],
    }))
  }

  const updateShopeeAccount = (id: number, patch: Partial<WorkspaceShopeeAccount>) => {
    updateWorkspace((current) => ({
      ...current,
      shopeeAccounts: current.shopeeAccounts.map((account) =>
        account.id === id ? { ...account, ...patch } : account,
      ),
    }))
  }

  return (
    <main className="uploadPage">
      <div className="uploadShell">
        <Header onOpenGuide={onOpenGuide} />

        <div className="workspaceHeading">Workspace</div>
        <p className="workspaceSubheading">1 workspace = 1 akun Meta + akun Shopee yang dipairing</p>

        <section className="workspacePanel">
          <div className="workspaceBar">
            <span className="workspaceIndex">1</span>
            <input
              className="workspaceNameInput"
              value={primary.name}
              onChange={(event) => updateWorkspace((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nama workspace (contoh: Aisyah Store)"
            />
            <span className="workspaceStatus">
              Meta {metaReady ? '✓' : '—'} · Shopee {shopeeCount}/1
              <ChevronDown size={14} />
            </span>
          </div>

          <div className="workspaceBody">
            <div className="sectionCaption">META ADS CSV — BREAKDOWN BY CAMPAIGN + DAY</div>
            <div className="uploadCard">
              <div className="uploadIconWrap">
                <Upload size={14} />
              </div>
              <div className="uploadContent">
                <strong>Meta Ads Manager Export</strong>
                <span>Amount spent · Link clicks · LP Views · Impressions</span>
              </div>
              <FileUploadButton
                label="Upload CSV"
                onFile={(file) => updateWorkspace((current) => ({ ...current, metaFile: file }))}
              />
            </div>

            <div className="sectionDivider" />

            <div className="sectionCaption">SHOPEE AFFILIATE CSV — BISA LEBIH DARI 1 AKUN</div>
            <div className="shopeeAccounts">
              {primary.shopeeAccounts.map((account, index) => (
                <div className="shopeeAccountRow" key={account.id}>
                  <span className="workspaceIndex small">{index + 1}</span>
                  <input
                    value={account.name}
                    onChange={(event) => updateShopeeAccount(account.id, { name: event.target.value })}
                    placeholder="Nama akun (contoh: Akun Gamis)"
                  />
                  <FileUploadButton
                    label="Pilih CSV"
                    className="ghostButton compact"
                    onFile={(file) => updateShopeeAccount(account.id, { file })}
                  />
                  <span className="fileState">{account.file?.name || 'Belum ada'}</span>
                </div>
              ))}
            </div>
            <button type="button" className="ghostButton addButton" onClick={addShopeeAccount}>
              <Plus size={14} />
              Tambah Akun Shopee
            </button>

            <div className="sectionCaption topGap">SHOPEE CLICK REPORT — OPSIONAL (BISA DIUPLOAD SORE/H+1)</div>
            <div className="uploadCard slim">
              <div className="uploadIconWrap">
                <Upload size={14} />
              </div>
              <div className="uploadContent">
                <strong>WebsiteClickReport Shopee</strong>
                <span>Opsional · Klik ID · Waktu Klik · Tag_link · Perujuk</span>
              </div>
              <FileUploadButton
                label="Upload Klik"
                className="ghostButton"
                onFile={(file) => updateWorkspace((current) => ({ ...current, clickFile: file }))}
              />
            </div>
          </div>
        </section>

        <button type="button" className="ghostButton workspaceAddButton">
          <Plus size={14} />
          Tambah Workspace (Akun Meta baru)
        </button>

        <section className="notesPanel">
          <p>
            <strong>Workspace:</strong> Tiap workspace punya 1 akun Meta + akun Shopee yang dipasangin. Data
            antar workspace dipisah — ROAS dan spend nggak akan nyampur.
          </p>
          <p>
            <strong>Tag_link1:</strong> Isi dengan nama campaign Meta saat buat link Shopee untuk tracking ROAS
            per-campaign.
          </p>
          <p>
            <strong>PPN:</strong> Set di topbar dashboard setelah upload.
          </p>
          <p>
            <strong>Catatan komisi:</strong> Angka di CSV affiliate (<em>Komisi Bersih</em>) bisa lebih rendah dari
            dashboard performa Shopee (<em>Komisi Kotor</em>) — ini normal. Shopee butuh waktu untuk memproses
            dan memverifikasi order sebelum masuk ke CSV. Selisih akan mengecil saat order makin banyak yang
            selesai.
          </p>
        </section>

        <section className="historyPanel">
          <div className="historyPanelHeader">
            <div>
              <h3>Pulihkan History Terakhir</h3>
              <p>
                Kalau halaman ke-reload, buka snapshot tersimpan tanpa upload ulang file. History tetap per-email
                dan tidak digabung antar periode.
              </p>
            </div>
            <button type="button" className="ghostButton refreshButton" onClick={onRefreshHistory}>
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          <div className="historyItems">
            {historyRuns.length === 0 && <p className="historyEmpty">Belum ada history tersimpan untuk {email}.</p>}
            {historyRuns.map((run) => (
              <div className="historyRow" key={run.id}>
                <div>
                  <div className="historyDateLine">
                    <strong>{formatHistoryLabel(run.createdAt)}</strong>
                    <span>· {new Date(run.createdAt).toLocaleDateString('id-ID')}</span>
                  </div>
                  <div className="historyMetaLine">
                    1 upload tersimpan · Meta {run.analysis.quality.metaRowsUsed} rows · Shopee{' '}
                    {run.analysis.quality.shopeeRowsUsed} rows · update{' '}
                    {new Date(run.createdAt).toLocaleString('sv-SE').replace('T', ' ')}
                  </div>
                </div>
                <button type="button" className="ghostButton openButton" onClick={() => onRestore(run)}>
                  Buka
                </button>
              </div>
            ))}
          </div>
        </section>

        <button type="button" className={ready ? 'analyzeButton ready' : 'analyzeButton'} disabled={!ready} onClick={onAnalyze}>
          Mulai Analisa →
        </button>

        {error && <p className="errorText">{error}</p>}

        <footer className="uploadFooter">© 2026 Satruk Affiliate Tracker — private server build</footer>
      </div>
    </main>
  )
}

function DashboardView({
  analysis,
  ppn,
  setPpn,
  source,
  setSource,
  saveCurrent,
  goBack,
  clearHistory,
}: {
  analysis: Analysis
  ppn: number
  setPpn: (n: number) => void
  source: string
  setSource: (source: string) => void
  saveCurrent: () => void
  goBack: () => void
  clearHistory: () => void
}) {
  const platforms = useMemo(
    () => ['Semua', ...Array.from(new Set(analysis.shopee.map((row) => row.platform))).filter(Boolean)],
    [analysis],
  )
  const filteredShopee = useMemo(
    () => analysis.shopee.filter((row) => source === 'Semua' || row.platform === source),
    [analysis, source],
  )
  const zeroOrders = filteredShopee.filter((row) => row.commission <= 0).length
  const products = useMemo(() => {
    const map = new Map<string, { product: string; orders: number; purchase: number; commission: number; zero: number }>()
    for (const row of filteredShopee) {
      const product = row.product || '(tanpa produk)'
      const current = map.get(product) || { product, orders: 0, purchase: 0, commission: 0, zero: 0 }
      current.orders += 1
      current.purchase += row.purchase
      current.commission += row.commission
      if (row.commission <= 0) current.zero += 1
      map.set(product, current)
    }
    return [...map.values()].sort((a, b) => b.commission - a.commission)
  }, [filteredShopee])

  const dailyRows = analysis.daily.map((row) => ({
    ...row,
    roi: row.spend ? (row.commission - row.spend * (1 + ppn / 100)) / (row.spend * (1 + ppn / 100)) : 0,
  }))

  const topTags = analysis.tags.slice(0, 12)
  const totals = analysis.totals

  return (
    <main className="dashboardPage">
      <div className="dashboardShell">
        <Header onOpenGuide={() => undefined} />

        <div className="dashboardTopbar">
          <span>
            {analysis.daily[0]?.date || '-'} s/d {analysis.daily.at(-1)?.date || '-'}
          </span>
          <label>
            PPN
            <input value={ppn} type="number" onChange={(event) => setPpn(Number(event.target.value) || 0)} />%
          </label>
          <button type="button" className="ghostButton compact" onClick={saveCurrent}>
            Simpan Snapshot
          </button>
          <button type="button" className="ghostButton compact" onClick={goBack}>
            Ganti file
          </button>
          <button type="button" className="ghostButton compact danger" onClick={clearHistory}>
            Hapus History
          </button>
        </div>

        <section className="filterPanel">
          <strong>FILTER SUMBER TRAFIK</strong>
          <div className="chipRow">
            {platforms.map((platform) => (
              <button
                type="button"
                key={platform}
                className={platform === source ? 'chip active' : 'chip'}
                onClick={() => setSource(platform)}
              >
                {platform}
              </button>
            ))}
          </div>
        </section>

        <section className="warningBanner">
          ⚠ Range tanggal berbeda? Pastikan tanggal Meta dan Shopee sama biar ROAS harian akurat.
        </section>
        <section className="infoBanner">
          ℹ Kenapa komisi di sini beda dengan dashboard Shopee? Ini pakai Komisi Bersih dari CSV.
        </section>

        <section className="kpiGrid">
          <Kpi label="Spend + PPN" value={rp(totals.spendPpn)} sub={`Biaya iklan Meta · PPN ${ppn}%`} />
          <Kpi label="Total Komisi" value={rp(totals.commission)} />
          <Kpi label="Net Profit" value={rp(totals.net)} tone={totals.net >= 0 ? 'positive' : 'negative'} />
          <Kpi label="ROAS" value={`${totals.roas.toFixed(2)}x`} />
          <Kpi label="ROI" value={pct(totals.roi)} tone={totals.roi >= 0 ? 'positive' : 'negative'} />
          <Kpi
            label="Meta Clicks"
            value={fmt.format(totals.clicks)}
            sub={`CPC: ${rp(totals.clicks ? totals.spend / totals.clicks : 0)}`}
          />
          <Kpi
            label="LP Views (Meta)"
            value={fmt.format(totals.lpViews)}
            sub={`LP rate: ${pct(totals.clicks ? totals.lpViews / totals.clicks : 0)}`}
          />
          <Kpi
            label="Zero Komisi"
            value={pct(filteredShopee.length ? zeroOrders / filteredShopee.length : 0)}
            sub={`${zeroOrders} dari ${filteredShopee.length} order`}
          />
        </section>

        <section className="chartGrid">
          <div className="chartPanel">
            <h3>SPEND VS KOMISI</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={analysis.daily}>
                <CartesianGrid stroke="#2a2a2d" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#6e727b" />
                <YAxis stroke="#6e727b" />
                <Tooltip formatter={(value) => rp(Number(value))} />
                <Area dataKey="spend" stroke="#8c8f99" fill="#393b40" />
                <Area dataKey="commission" stroke="#ff5d3f" fill="#3a1712" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chartPanel">
            <h3>NET PROFIT HARIAN</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analysis.daily}>
                <CartesianGrid stroke="#2a2a2d" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#6e727b" />
                <YAxis stroke="#6e727b" />
                <Tooltip formatter={(value) => rp(Number(value))} />
                <Bar dataKey="net" fill="#c94b4b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="summaryGrid">
          <SummaryCard
            title="Rekap Harian"
            rows={dailyRows.slice(0, 8).map(
              (row) => `${row.date} · Spend ${rp(row.spend)} · Komisi ${rp(row.commission)} · Net ${rp(row.net)}`,
            )}
          />
          <SummaryCard
            title="Top Campaigns"
            rows={analysis.campaigns.slice(0, 8).map(
              (row) => `${row.campaign} · Spend ${rp(row.spend)} · Clicks ${fmt.format(row.clicks)} · LPV ${fmt.format(row.lpViews)}`,
            )}
          />
          <SummaryCard
            title="Top Produk"
            rows={products.slice(0, 8).map(
              (row) => `${row.product} · Order ${fmt.format(row.orders)} · Komisi ${rp(row.commission)} · Zero ${row.zero}`,
            )}
          />
          <SummaryCard
            title="Atribusi Tag"
            rows={topTags.map(
              (row) => `${row.tag} · ${row.matchType} (${row.matchScore}) · Spend ${rp(row.spend)} · ROAS ${row.roas.toFixed(2)}x`,
            )}
          />
        </section>
      </div>
    </main>
  )
}

const makeWorkspace = (): WorkspaceState => ({
  id: Date.now(),
  name: '',
  metaFile: null,
  shopeeAccounts: [{ id: Date.now() + 1, name: '', file: null }],
  clickFile: null,
})

export default function App() {
  const [emailInput, setEmailInput] = useState('')
  const [email, setEmail] = useState('')
  const [workspaces, setWorkspaces] = useState<WorkspaceState[]>([makeWorkspace()])
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [runs, setRuns] = useState<SavedRun[]>([])
  const [error, setError] = useState('')
  const [ppn, setPpn] = useState(11)
  const [source, setSource] = useState('Semua')
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideStep, setGuideStep] = useState<GuideStepId>('persiapan')

  const refreshHistory = async (currentEmail = email) => {
    if (!currentEmail) {
      setRuns([])
      return
    }
    setRuns(await listRuns(currentEmail))
  }

  useEffect(() => {
    const savedEmail = window.localStorage.getItem('afftometa_email') || ''
    if (savedEmail) {
      setEmail(savedEmail)
      setEmailInput(savedEmail)
      void refreshHistory(savedEmail)
    }
  }, [])

  const primaryWorkspace = workspaces[0]

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

  async function handleAnalyze() {
    try {
      setError('')
      if (!primaryWorkspace.metaFile) throw new Error('Upload Meta CSV dulu.')
      const shopeeFiles = primaryWorkspace.shopeeAccounts.filter((account) => account.file).map((account) => account.file as File)
      if (!shopeeFiles.length) throw new Error('Upload minimal 1 Shopee CSV.')

      const [metaText, ...shopeeTexts] = await Promise.all([
        readText(primaryWorkspace.metaFile),
        ...shopeeFiles.map((file) => readText(file)),
      ])

      const mergedShopee = shopeeTexts
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text, index) => {
          const lines = text.split(/\r?\n/)
          return index === 0 ? lines.join('\n') : lines.slice(1).join('\n')
        })
        .join('\n')

      const result = analyze(metaText, mergedShopee, ppn / 100)
      setAnalysis(result)
      setGuideOpen(false)
      await saveRun({
        email,
        name: primaryWorkspace.name || 'Workspace',
        metaFile: primaryWorkspace.metaFile.name,
        shopeeFile: shopeeFiles.map((file) => file.name).join(', '),
        ppn: ppn / 100,
        analysis: result,
      })
      await refreshHistory(email)
    } catch (err: any) {
      setError(err.message || String(err))
    }
  }

  async function restoreRun(run: SavedRun) {
    setAnalysis(run.analysis)
    setPpn(Math.round(run.ppn * 100))
    setSource('Semua')
    setWorkspaces([
      {
        ...makeWorkspace(),
        name: run.name,
      },
    ])
  }

  async function clearHistory() {
    if (!email) return
    const items = await listRuns(email)
    await Promise.all(items.map((item) => (item.id ? deleteRun(item.id) : Promise.resolve())))
    await refreshHistory(email)
  }

  async function saveCurrentSnapshot() {
    if (!analysis || !email) return
    await saveRun({
      email,
      name: primaryWorkspace.name || 'Workspace',
      metaFile: primaryWorkspace.metaFile?.name || 'Meta CSV',
      shopeeFile:
        primaryWorkspace.shopeeAccounts.filter((item) => item.file).map((item) => item.file?.name || '').join(', ') ||
        'Shopee CSV',
      ppn: ppn / 100,
      analysis,
    })
    await refreshHistory(email)
  }

  if (!email) {
    return (
      <main className="loginPage">
        <div className="loginCard">
          <div className="loginEyebrow">PRIVATE MEMBER AREA</div>
          <h1>Satruk Affiliate Tracker</h1>
          <p>
            Masukkan email yang sudah di-whitelist buat akses dashboard tracking Shopee Affiliate × Meta Ads dan
            history campaign.
          </p>
          <input
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
            placeholder="emailkamu@gmail.com"
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleLogin()
            }}
          />
          <button type="button" className="loginButton" onClick={() => void handleLogin()}>
            Masuk Dashboard
          </button>
          {error && <p className="errorText centered">{error}</p>}
        </div>
      </main>
    )
  }

  return (
    <>
      {!analysis ? (
        <UploadScreen
          email={email}
          workspaces={workspaces}
          setWorkspaces={setWorkspaces}
          onAnalyze={() => void handleAnalyze()}
          historyRuns={runs}
          onRestore={(run) => void restoreRun(run)}
          onRefreshHistory={() => void refreshHistory(email)}
          error={error}
          onOpenGuide={() => {
            setGuideOpen(true)
            setGuideStep('persiapan')
          }}
        />
      ) : (
        <DashboardView
          analysis={analysis}
          ppn={ppn}
          setPpn={setPpn}
          source={source}
          setSource={setSource}
          saveCurrent={() => void saveCurrentSnapshot()}
          goBack={() => setAnalysis(null)}
          clearHistory={() => void clearHistory()}
        />
      )}

      <GuideModal active={guideOpen} onClose={() => setGuideOpen(false)} step={guideStep} setStep={setGuideStep} />
    </>
  )
}
