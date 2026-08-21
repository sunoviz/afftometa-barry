import { useEffect, useState } from 'react'
import { CircleHelp, Menu, Plus, Upload } from 'lucide-react'
import { analyze, type Analysis } from './lib/parser'
import { listRuns, saveRun, type SavedRun } from './lib/history'
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

type ResultRow = {
  campaign: string
  spend: number
  clicks: number
  commission: number
  net: number
}

const APP_NAME = 'Satruk Affiliate Tracker'
const APP_SUBTITLE = 'Shopee × Meta Ads History Tracker'
const FOOTER_TEXT = '© 2026 Satruk Affiliate Tracker — private server build'
const SAMPLE_MODE = true
const fmt = new Intl.NumberFormat('id-ID')
const rp = (n: number) => `Rp ${fmt.format(Math.round(n || 0))}`
const readText = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = reject; reader.readAsText(file, 'UTF-8') })

const GUIDE_STEPS: Array<{ id: GuideStepId; label: string; title: string; body: React.ReactNode }> = [
  { id: 'persiapan', label: 'Persiapan', title: 'Apa yang dibutuhkan', body: <><GuidePoint number={1} title="Apa yang dibutuhkan" text={<>Dashboard ini menggabungkan dua sumber data: <strong>Meta Ads CSV</strong> (data spend & klik iklan) dan <strong>Shopee Affiliate CSV</strong> (data komisi). Di versi Satruk, hasil analisa bisa disimpan ke server dan dibuka lagi lewat menu History.</>} /><GuidePoint number={2} title="Samakan range tanggal" text={<>Pastikan range tanggal Meta CSV dan Shopee CSV <strong>sama persis</strong>. Kalau Meta hanya 1 hari tapi Shopee 7 hari, ROAS yang muncul akan menyesatkan — dashboard akan otomatis kasih peringatan kuning.<div className="guideExample"><strong>Contoh yang benar:</strong> Meta export 24–30 Mar · Shopee export 24–30 Mar<br /><strong>Contoh yang salah:</strong> Meta export 30 Mar · Shopee export 24–30 Mar</div></>} /><GuidePoint number={3} title="Format file" text={<>Kedua file harus dalam format <strong>.CSV</strong>. Jangan ubah nama kolom atau format isi file — dashboard membaca nama kolom secara langsung dari header CSV.</>} /></> },
  { id: 'meta', label: 'Export Meta', title: 'Buka Meta Ads Manager', body: <><GuidePoint number={1} title="Buka Meta Ads Manager" text={<>Pergi ke <strong>Ads Manager → Campaigns</strong>. Pastikan lo berada di level Campaign, bukan Ad Sets atau Ads.</>} /><GuidePoint number={2} title="Set kolom yang dibutuhkan" text={<>Klik <strong>Columns → Customize Columns</strong>, tambahkan:<div className="guideCodeLine"><code>Amount spent</code> · <code>Link clicks</code> atau <code>Unique link clicks</code> · <code>Landing page views</code> · <code>Impressions</code> · <code>CPC (link)</code> · <code>CPM</code> · <code>CTR (link)</code></div></>} /><GuidePoint number={3} title="Set breakdown dan export" text={<>Klik <strong>Breakdown → By Time → Day</strong> supaya data per hari muncul. Pilih range tanggal yang diinginkan, lalu klik <strong>Export → Export Table Data (CSV)</strong>.<div className="guideExample"><strong>Penting:</strong> Tanpa breakdown by Day, semua data akan jadi satu baris dan chart harian tidak bisa ditampilkan.</div></>} /></> },
  { id: 'shopee', label: 'Export Shopee', title: 'Buka panel Shopee Affiliate', body: <><GuidePoint number={1} title="Buka panel Shopee Affiliate" text={<>Login ke <strong>affiliate.shopee.co.id</strong> → pilih menu <strong>Komisi</strong> atau <strong>Commission Report</strong>.</>} /><GuidePoint number={2} title="Set filter tanggal" text={<>Set range tanggal yang <strong>sama dengan Meta CSV</strong>. Shopee menggunakan <strong>Waktu Pemesanan</strong> (tanggal order) sebagai basis filter.</>} /><GuidePoint number={3} title="Export CSV" text={<>Klik tombol <strong>Export</strong> atau <strong>Unduh</strong>. File yang didownload langsung bisa diupload ke dashboard tanpa modifikasi apapun.<div className="guideExample"><strong>Catatan:</strong> Order dengan status <strong>Dibatalkan</strong> otomatis dikeluarkan. Order <strong>Tertunda</strong> tetap dihitung karena cancel rate hanya sekitar 1–2%.<br /><br /><strong>Soal perbedaan angka komisi:</strong> Wajar kalau total komisi di sini lebih rendah dari angka di dashboard Shopee. CSV pakai <em>Komisi Bersih</em> (sudah diverifikasi), dashboard Shopee pakai <em>Komisi Kotor</em> (belum final). Selisihnya mengecil kalau export dilakukan beberapa hari setelah periode berakhir.</div></>} /></> },
  { id: 'dashboard', label: 'Baca Dashboard', title: 'Cara baca hasil analisa', body: <><GuidePoint number={1} title="Kartu KPI" text={<>Kartu paling atas nunjukkin spend + PPN, total komisi, net profit, ROAS, ROI, clicks, LP Views, dan zero komisi. Ini ringkasan paling cepat buat tahu campaign lagi sehat atau nggak.</>} /><GuidePoint number={2} title="Chart harian" text={<>Grafik Spend vs Komisi dan Net Profit Harian dipakai buat ngeliat pola performa per hari. Kalau ada hari spend tinggi tapi komisi turun, biasanya masalahnya ada di kreatif, landing, atau range tanggal.</>} /><GuidePoint number={3} title="History" text={<>Setiap hasil analisa yang disimpan bakal masuk ke history per email. Jadi kalau halaman ke-reload, lo tinggal buka snapshot terakhir tanpa upload ulang file.</>} /></> },
  { id: 'atribusi', label: 'Atribusi Tag', title: 'Cara kerja Tag_link1', body: <><GuidePoint number={1} title="Gunakan nama campaign Meta" text={<>Isi <strong>Tag_link1</strong> di link Shopee dengan nama campaign Meta saat bikin link. Dashboard akan berusaha match Tag_link1 ke nama campaign biar spend bisa dibaca per campaign.</>} /><GuidePoint number={2} title="Jenis pencocokan" text={<>Match type bisa <strong>exact</strong>, <strong>contains</strong>, atau <strong>unmatched</strong>. Exact paling bagus. Kalau contains, cek lagi karena kemungkinan ada nama campaign yang mirip.</>} /><GuidePoint number={3} title="Kalau ROAS nggak nyambung" text={<>Biasanya karena tag beda penulisan, campaign rename setelah link dibuat, atau range tanggal Meta dan Shopee nggak sinkron. Rapihin Tag_link1 dulu baru baca ROAS per tag.</>} /></> },
]

function GuidePoint({ number, title, text }: { number: number; title: string; text: React.ReactNode }) { return <><div className="guideNumber">{number}</div><div className="guideTitle">{title}</div><div className="guideText">{text}</div></> }
function Header({ onOpenGuide }: { onOpenGuide: () => void }) { return <section className="heroHeader"><div className="heroBrand"><span className="heroLogo"><Menu size={15} strokeWidth={2.4} /></span><div><h1>{APP_NAME}</h1><p>{APP_SUBTITLE}</p></div></div><button type="button" className="guideButton" onClick={onOpenGuide}><CircleHelp size={13} />Panduan</button></section> }

function GuideModal({ active, onClose, step, setStep }: { active: boolean; onClose: () => void; step: GuideStepId; setStep: (step: GuideStepId) => void }) {
  if (!active) return null
  const index = GUIDE_STEPS.findIndex((item) => item.id === step)
  const current = GUIDE_STEPS[index]
  const prev = index > 0 ? GUIDE_STEPS[index - 1] : null
  const next = index < GUIDE_STEPS.length - 1 ? GUIDE_STEPS[index + 1] : null
  return <div className="guideOverlay" onClick={onClose}><div className="guideModal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><div className="guideModalHeader"><div><h2>Panduan Penggunaan Dashboard</h2><p>5 langkah untuk mulai tracking affiliate lo</p></div><button type="button" className="closeButton" onClick={onClose}>×</button></div><div className="guideTabs">{GUIDE_STEPS.map((item) => <button key={item.id} type="button" className={item.id === step ? 'guideTab active' : 'guideTab'} onClick={() => setStep(item.id)}>{item.label}</button>)}</div><div className="guideContent"><div className="guideHeaderRow"><div className="guideHeaderIndex">1</div><div className="guideHeaderTitle">{current.title}</div></div><div className="guideBodyGrid">{current.body}</div></div><div className="guideFooter"><button type="button" className="guideNav" onClick={() => prev && setStep(prev.id)} disabled={!prev}>← Sebelumnya</button><button type="button" className="guideNav primary" onClick={() => next && setStep(next.id)} disabled={!next}>Selanjutnya →</button></div></div></div>
}

function makeWorkspace(): WorkspaceState { return { id: 1, name: '', metaFileName: '', metaFile: null, shopeeAccounts: [{ id: 1, name: '', fileName: '', file: null }], clickFileName: '', clickFile: null } }
function formatHistoryHeadline(createdAt: string) { const created = new Date(createdAt); const today = new Date(); const startA = new Date(today.getFullYear(), today.getMonth(), today.getDate()); const startB = new Date(created.getFullYear(), created.getMonth(), created.getDate()); const diffDays = Math.round((startA.getTime() - startB.getTime()) / 86400000); if (diffDays === 1) return `Kemarin · ${created.toLocaleDateString('sv-SE')}`; if (diffDays > 1 && diffDays <= 6) return `${diffDays} hari lalu · ${created.toLocaleDateString('sv-SE')}`; return `${created.toLocaleDateString('sv-SE')} · ${created.toLocaleDateString('sv-SE')}` }

function ResultScreen({ analysis, onBack }: { analysis: Analysis; onBack: () => void }) {
  const rows: ResultRow[] = analysis.tags.map((tag) => ({ campaign: tag.campaign || tag.tag, spend: tag.spend, clicks: tag.clickCount || 0, commission: tag.commission, net: tag.commission - tag.spend }))
  const topRows = rows.sort((a,b)=>b.commission-a.commission).slice(0,12)
  return <main className="resultPage"><div className="resultShell"><Header onOpenGuide={() => {}} /><section className="resultTop"><div className="resultKpis"><div className="resultKpi"><span>Spend + PPN</span><strong>{rp(analysis.totals.spendPpn)}</strong></div><div className="resultKpi"><span>Total Komisi</span><strong>{rp(analysis.totals.commission)}</strong></div><div className="resultKpi"><span>Net Profit</span><strong>{rp(analysis.totals.net)}</strong></div><div className="resultKpi"><span>ROAS</span><strong>{analysis.totals.roas.toFixed(2)}x</strong></div></div><button type="button" className="outlineButton" onClick={onBack}>Kembali</button></section><section className="resultTablePanel"><h3>Ringkasan Campaign / Tag</h3><div className="resultTableWrap"><table><thead><tr><th>Campaign</th><th>Spend</th><th>Klik</th><th>Komisi</th><th>Net</th></tr></thead><tbody>{topRows.map((row, i) => <tr key={i}><td>{row.campaign}</td><td>{rp(row.spend)}</td><td>{fmt.format(row.clicks)}</td><td>{rp(row.commission)}</td><td>{rp(row.net)}</td></tr>)}</tbody></table></div></section></div></main>
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

  async function refreshHistory(currentEmail = email) { if (!currentEmail) return; setRuns(await listRuns(currentEmail)) }
  useEffect(() => { const savedEmail = window.localStorage.getItem('afftometa_email') || ''; if (savedEmail) { setEmail(savedEmail); setEmailInput(savedEmail); void refreshHistory(savedEmail) } }, [])

  async function handleLogin() {
    const normalized = emailInput.trim().toLowerCase()
    if (!normalized) { setError('Masukkan email yang sudah di-whitelist.'); return }
    setError(''); setEmail(normalized); window.localStorage.setItem('afftometa_email', normalized); await refreshHistory(normalized)
  }

  async function handleAnalyze() {
    try {
      if (SAMPLE_MODE && !workspace.metaFile) {
        const [metaText, shopeeText] = await Promise.all([
          fetch('/sample/meta.csv').then((r) => r.text()),
          fetch('/sample/shopee.csv').then((r) => r.text()),
        ])
        const result = analyze(metaText, shopeeText, 0.11)
        setAnalysis(result)
        return
      }
      if (!workspace.metaFile) throw new Error('Upload Meta CSV dulu.')
      const shopeeFiles = workspace.shopeeAccounts.filter((x) => x.file).map((x) => x.file as File)
      if (!shopeeFiles.length) throw new Error('Upload Shopee CSV dulu.')
      const metaText = await readText(workspace.metaFile)
      const shopeeTexts = await Promise.all(shopeeFiles.map((f) => readText(f)))
      const mergedShopee = shopeeTexts.map((text, index) => { const lines = text.split(/\r?\n/); return index === 0 ? lines.join('\n') : lines.slice(1).join('\n') }).join('\n')
      const result = analyze(metaText, mergedShopee, 0.11)
      setAnalysis(result)
      await saveRun({ email, name: workspace.name || 'Workspace', metaFile: workspace.metaFileName, shopeeFile: shopeeFiles.map((f) => f.name).join(', '), ppn: 0.11, analysis: result })
      await refreshHistory(email)
    } catch (err: any) { setError(err.message || String(err)) }
  }

  const metaReady = !!workspace.metaFileName
  const shopeeReadyCount = workspace.shopeeAccounts.filter((account) => account.fileName).length
  const ready = SAMPLE_MODE || (metaReady && shopeeReadyCount > 0)

  if (!email) return <main className="loginPage"><section className="loginCard"><div className="loginEyebrow">PRIVATE MEMBER AREA</div><h1>{APP_NAME}</h1><p>Masukkan email yang sudah di-whitelist buat akses dashboard tracking Shopee Affiliate × Meta Ads dan history campaign.</p><label className="loginLabel">Email akses</label><input value={emailInput} onChange={(event) => setEmailInput(event.target.value)} placeholder="emailkamu@gmail.com" onKeyDown={(event) => { if (event.key === 'Enter') void handleLogin() }} /><button type="button" className="loginButton" onClick={() => void handleLogin()}>Masuk Dashboard</button><div className="loginFooterNote">Private tools untuk circle terdekat.</div>{error && <p className="errorText">{error}</p>}</section></main>
  if (analysis) return <ResultScreen analysis={analysis} onBack={() => setAnalysis(null)} />

  return <><main className="uploadPage"><div className="uploadShell"><Header onOpenGuide={() => { setGuideOpen(true); setGuideStep('persiapan') }} /><div className="workspaceHeading">Workspace</div><p className="workspaceSubheading">1 workspace = 1 akun Meta + akun Shopee yang dipairing</p><section className="workspacePanel"><div className="workspaceBar"><span className="workspaceIndex">1</span><input className="workspaceNameInput" value={workspace.name} onChange={(event) => setWorkspace((current) => ({ ...current, name: event.target.value }))} placeholder="Nama workspace (contoh: Aisyah Store)" /><span className="workspaceStatus">Meta {metaReady ? '✓' : '—'} · Shopee {shopeeReadyCount}/1 ▾</span></div><div className="workspaceBody"><div className="sectionCaption">META ADS CSV — BREAKDOWN BY CAMPAIGN + DAY</div><div className="uploadCard"><div className="uploadIconWrap"><Upload size={12} strokeWidth={2.2} /></div><div className="uploadContent"><strong>Meta Ads Manager Export</strong><span>Amount spent · Link clicks · LP Views · Impressions</span></div><label className="outlineButton">Upload CSV<input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) setWorkspace((current) => ({ ...current, metaFileName: file.name, metaFile: file })); event.currentTarget.value = '' }} /></label></div><div className="sectionDivider" /><div className="sectionCaption">SHOPEE AFFILIATE CSV — BISA LEBIH DARI 1 AKUN</div><div className="shopeeAccounts">{workspace.shopeeAccounts.map((account, index) => <div className="shopeeAccountRow" key={account.id}><span className="workspaceIndex small">{index + 1}</span><input value={account.name} onChange={(event) => setWorkspace((current) => ({ ...current, shopeeAccounts: current.shopeeAccounts.map((item) => item.id === account.id ? { ...item, name: event.target.value } : item) }))} placeholder="Nama akun (contoh: Akun Gamis)" /><label className="outlineButton compact">Pilih CSV<input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) setWorkspace((current) => ({ ...current, shopeeAccounts: current.shopeeAccounts.map((item) => item.id === account.id ? { ...item, fileName: file.name, file } : item) })) ; event.currentTarget.value = '' }} /></label><span className="fileState">{account.fileName || 'Belum ada'}</span></div>)}</div><button type="button" className="dashedAction" onClick={() => setWorkspace((current) => ({ ...current, shopeeAccounts: [...current.shopeeAccounts, { id: Date.now(), name: '', fileName: '', file: null }] }))}><Plus size={13} /> Tambah Akun Shopee</button><div className="sectionCaption topGap">SHOPEE CLICK REPORT — OPSIONAL (BISA DIUPLOAD SORE/H+1)</div><div className="uploadCard slim"><div className="uploadIconWrap"><Upload size={12} strokeWidth={2.2} /></div><div className="uploadContent"><strong>WebsiteClickReport Shopee</strong><span>Opsional · Klik ID · Waktu Klik · Tag_link · Perujuk</span></div><label className="outlineButton">Upload Klik<input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) setWorkspace((current) => ({ ...current, clickFileName: file.name, clickFile: file })); event.currentTarget.value = '' }} /></label></div></div></section><button type="button" className="dashedAction workspaceActionStub"><Plus size={13} /> Tambah Workspace (Akun Meta baru)</button><section className="notesPanel"><p><strong>Workspace:</strong> Tiap workspace punya 1 akun Meta + akun Shopee yang dipasangin. Data antar workspace dipisah — ROAS dan spend nggak akan nyampur.</p><p><strong>Tag_link1:</strong> Isi dengan nama campaign Meta saat buat link Shopee untuk tracking ROAS per-campaign.</p><p><strong>PPN:</strong> Set di topbar dashboard setelah upload.</p><p><strong>Catatan komisi:</strong> Angka di CSV affiliate (<em>Komisi Bersih</em>) bisa lebih rendah dari dashboard performa Shopee (<em>Komisi Kotor</em>) — ini normal. Shopee butuh waktu untuk memproses dan memverifikasi order sebelum masuk ke CSV. Selisih akan mengecil saat order makin banyak yang selesai.</p></section><section className="historyPanel"><div className="historyPanelHeader"><div><h3>Pulihkan History Terakhir</h3><p>Kalau halaman ke-reload, buka snapshot tersimpan tanpa upload ulang file. History tetap per-email dan tidak digabung antar periode.</p></div><button type="button" className="outlineButton refreshButton" onClick={() => void refreshHistory(email)}>Refresh</button></div><div className="historyItems">{runs.length === 0 && <p className="historyEmpty">Belum ada history tersimpan untuk {email}.</p>}{runs.map((run) => <div className="historyRow" key={run.id}><div><div className="historyDateLine">{formatHistoryHeadline(run.createdAt)}</div><div className="historyMetaLine">1 upload tersimpan · Meta {run.analysis.quality.metaRowsUsed} rows · Shopee {run.analysis.quality.shopeeRowsUsed} rows · update {new Date(run.createdAt).toLocaleString('sv-SE').replace('T', ' ')}</div></div><button type="button" className="outlineButton historyOpenButton">Buka</button></div>)}</div></section><button type="button" className={ready ? 'analyzeButton ready' : 'analyzeButton'} disabled={!ready} onClick={() => void handleAnalyze()}>Mulai Analisa →</button>{error && <p className="errorText">{error}</p>}<footer className="uploadFooter">{FOOTER_TEXT}</footer></div></main><GuideModal active={guideOpen} onClose={() => setGuideOpen(false)} step={guideStep} setStep={setGuideStep} /></>
}
