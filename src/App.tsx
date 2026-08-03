
import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, History, Save, Trash2, UploadCloud } from 'lucide-react'
import { analyze, type Analysis } from './lib/parser'
import { deleteRun, listRuns, saveRun, type SavedRun } from './lib/history'
import './App.css'

const fmt = new Intl.NumberFormat('id-ID')
const rp = (n: number) => 'Rp ' + fmt.format(Math.round(n || 0))
const pct = (n: number) => ((n || 0) * 100).toFixed(1) + '%'
const readText = (file: File) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || '')); r.onerror = reject; r.readAsText(file, 'UTF-8') })

function Kpi({ label, value, sub, tone = '' }: {label:string; value:string; sub?:string; tone?:string}) {
  return <div className={`kpi ${tone}`}><div className="label">{label}</div><div className="value">{value}</div>{sub && <div className="sub">{sub}</div>}</div>
}
function FileBox({ title, file, onFile, hint }: {title:string; file?: File | null; hint:string; onFile:(f:File)=>void}) {
  return <label className="fileBox"><UploadCloud size={24}/><div><b>{file?.name || title}</b><span>{file ? 'File siap dianalisa' : hint}</span></div><input type="file" accept=".csv,text/csv" onChange={e=>{ const f=e.target.files?.[0]; if(f) onFile(f)}} /></label>
}
function downloadCsv(name: string, rows: any[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
}

export default function App() {
  const [metaFile, setMetaFile] = useState<File|null>(null)
  const [shopeeFile, setShopeeFile] = useState<File|null>(null)
  const [ppn, setPpn] = useState(11)
  const [name, setName] = useState('Barry Affiliate')
  const [analysis, setAnalysis] = useState<Analysis|null>(null)
  const [runs, setRuns] = useState<SavedRun[]>([])
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview'|'campaign'|'tag'|'history'>('overview')

  async function refreshHistory(){ setRuns(await listRuns()) }
  useEffect(()=>{ refreshHistory() }, [])

  async function runAnalyze() {
    setError('')
    try {
      if (!metaFile || !shopeeFile) throw new Error('Upload Meta CSV dan Shopee CSV dulu.')
      const [m, s] = await Promise.all([readText(metaFile), readText(shopeeFile)])
      setAnalysis(analyze(m, s, ppn/100))
      setTab('overview')
    } catch (e:any) { setError(e.message || String(e)) }
  }
  async function saveCurrent() {
    if (!analysis || !metaFile || !shopeeFile) return
    await saveRun({ name, metaFile: metaFile.name, shopeeFile: shopeeFile.name, ppn: ppn/100, analysis })
    await refreshHistory(); setTab('history')
  }
  const totals = analysis?.totals
  const ready = metaFile && shopeeFile
  const exportRows = useMemo(()=>analysis?.tags.map(t=>({ tag:t.tag, campaign:t.campaign, match_type:t.matchType, match_score:t.matchScore, spend:t.spend, commission:t.commission, net:t.net, roas:t.roas, orders:t.orders })) || [], [analysis])

  return <main>
    <section className="hero">
      <div><p className="eyebrow">Shopee Affiliate × Meta Ads</p><h1>AffToMeta Barry</h1><p>Upload CSV, auto-skip row summary Meta biar spend nggak dobel, simpan history lokal, dan baca ROAS per campaign/tag.</p></div>
      <div className="badge">Local-first · Supabase-ready</div>
    </section>

    <section className="panel uploadPanel">
      <div className="inputs"><label>Nama analisa/workspace<input value={name} onChange={e=>setName(e.target.value)} /></label><label>PPN Meta (%)<input type="number" value={ppn} onChange={e=>setPpn(Number(e.target.value)||0)} /></label></div>
      <div className="grid2"><FileBox title="Upload Meta Ads CSV" hint="Campaign + day export dari Ads Manager" file={metaFile} onFile={setMetaFile}/><FileBox title="Upload Shopee Affiliate CSV" hint="Affiliate commission report" file={shopeeFile} onFile={setShopeeFile}/></div>
      <div className="actions"><button disabled={!ready} onClick={runAnalyze}>Mulai Analisa →</button>{analysis && <button className="secondary" onClick={saveCurrent}><Save size={16}/> Simpan History</button>}</div>
      {!ready && <p className="hint">Butuh 2 file: Meta CSV + Shopee CSV.</p>}{error && <p className="error">{error}</p>}
    </section>

    {analysis && <>
      <section className="quality panel"><b>Data quality:</b> Meta {analysis.quality.metaRowsUsed}/{analysis.quality.metaRows} row dipakai · Shopee {analysis.quality.shopeeRowsUsed}/{analysis.quality.shopeeRows} row dipakai · Raw Meta {rp(analysis.quality.metaSpendRaw)} → Used {rp(analysis.quality.metaSpendUsed)}{analysis.quality.warnings.map((w,i)=><span className="warn" key={i}>⚠ {w}</span>)}</section>
      <nav className="tabs"><button className={tab==='overview'?'on':''} onClick={()=>setTab('overview')}>Overview</button><button className={tab==='campaign'?'on':''} onClick={()=>setTab('campaign')}>Campaign</button><button className={tab==='tag'?'on':''} onClick={()=>setTab('tag')}>Tag_link1</button><button className={tab==='history'?'on':''} onClick={()=>setTab('history')}><History size={15}/> History</button></nav>
      {tab==='overview' && totals && <section className="space"><div className="kpis"><Kpi label="Spend + PPN" value={rp(totals.spendPpn)} sub={`Spend: ${rp(totals.spend)} · PPN ${ppn}%`} tone="red"/><Kpi label="Total Komisi" value={rp(totals.commission)} tone="green"/><Kpi label="Net Profit" value={rp(totals.net)} tone={totals.net>=0?'green':'red'}/><Kpi label="ROAS" value={totals.roas.toFixed(2)+'x'} sub={`ROI ${pct(totals.roi)}`} tone={totals.roas>=1?'green':'red'}/><Kpi label="Clicks" value={fmt.format(totals.clicks)} /><Kpi label="LP Views" value={fmt.format(totals.lpViews)} sub={totals.clicks ? `LP rate ${pct(totals.lpViews/totals.clicks)}` : ''}/><Kpi label="Orders" value={fmt.format(totals.orders)} /></div><div className="charts"><div className="chart panel"><h3>Spend vs Komisi Harian</h3><ResponsiveContainer width="100%" height={260}><AreaChart data={analysis.daily}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip formatter={(v:any)=>rp(Number(v))}/><Area dataKey="spend" stroke="#ef4444" fill="#fecaca"/><Area dataKey="commission" stroke="#16a34a" fill="#bbf7d0"/></AreaChart></ResponsiveContainer></div><div className="chart panel"><h3>Net Profit Harian</h3><ResponsiveContainer width="100%" height={260}><BarChart data={analysis.daily}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip formatter={(v:any)=>rp(Number(v))}/><Bar dataKey="net" fill="#6366f1"/></BarChart></ResponsiveContainer></div></div></section>}
      {tab==='campaign' && <section className="panel"><h2>Campaign Performance</h2><Table rows={analysis.campaigns} cols={[['campaign','Campaign'],['spend','Spend',rp],['clicks','Clicks',fmt.format],['lpViews','LP Views',fmt.format],['lpRate','LP Rate',pct],['cpc','CPC',rp]]}/></section>}
      {tab==='tag' && <section className="panel"><div className="tableHead"><h2>Atribusi Tag_link1</h2><button className="secondary" onClick={()=>downloadCsv('afftometa-tags.csv', exportRows)}><Download size={16}/> Export CSV</button></div><Table rows={analysis.tags} cols={[['tag','Tag'],['campaign','Campaign Match'],['matchType','Match'],['matchScore','Score',(v:number)=>v+'%'],['spend','Spend',rp],['commission','Komisi',rp],['net','Net',rp],['roas','ROAS',(v:number)=>v.toFixed(2)+'x'],['orders','Orders',fmt.format]]}/></section>}
    </>}
    {tab==='history' && <section className="panel"><h2>History Lokal</h2>{!runs.length && <p className="hint">Belum ada history. Setelah analisa, klik Simpan History.</p>}<div className="historyList">{runs.map(r=><div className="historyItem" key={r.id}><button onClick={()=>{setAnalysis(r.analysis); setPpn(Math.round(r.ppn*100)); setName(r.name); setTab('overview')}}><b>{r.name}</b><span>{new Date(r.createdAt).toLocaleString('id-ID')} · {rp(r.analysis.totals.spend)} spend · ROAS {r.analysis.totals.roas.toFixed(2)}x</span></button><button className="icon" onClick={async()=>{if(r.id) await deleteRun(r.id); refreshHistory()}}><Trash2 size={16}/></button></div>)}</div></section>}
  </main>
}

function Table({ rows, cols }: { rows:any[]; cols:any[] }) {
  return <div className="tableWrap"><table><thead><tr>{cols.map((c:any)=><th key={c[0]}>{c[1]}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{cols.map((c:any)=>{ const v=r[c[0]]; return <td key={c[0]} className={typeof v==='number'&&v<0?'neg':''}>{c[2]?c[2](v):v}</td>})}</tr>)}</tbody></table></div>
}
