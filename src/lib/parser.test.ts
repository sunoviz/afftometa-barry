
import { describe, expect, it } from 'vitest'
import { analyze, parseClickCsv, parseIdr, parseMetaCsv } from './parser'

const metaBarry = `"Reporting starts","Reporting ends","Campaign name","Campaign delivery","Amount spent (IDR)",Impressions,"Link clicks","Landing page views"
2026-08-02,2026-08-02,,0,314467,93675,,
2026-08-02,2026-08-02,pernikahan,active,13254,3268,920,218
2026-08-02,2026-08-02,manurung,active,38983,8866,2084,569
2026-08-02,2026-08-02,manurung,active,78162,23276,4299,1022
2026-08-02,2026-08-02,manurung,active,91074,28932,4858,1189
2026-08-02,2026-08-02,manurung,active,92994,29333,5057,1332`
const shopeeBarry = `ID Pemesanan,Status Pesanan,Waktu Pemesanan,Waktu Klik,Nama Barange,Nilai Pembelian(Rp),Komisi Bersih Affiliate (Rp),Tag_link1,Platform
260803BA4WYXED,Tertunda,2026-08-02 23:54:21,2026-08-02 21:33:02,Produk A,22824,1711.8,manurung,Facebook
260803B9F6SXBW,Tertunda,2026-08-02 23:42:13,2026-08-02 17:29:21,Produk B,13999,769.945,manurung,Facebook`
const metaIndonesianActions = `Awal pelaporan,Akhir pelaporan,Nama kampanye,Penayangan kampanye,Hasil,Indikator Hasil,Jumlah yang dibelanjakan (IDR),Impresi,Klik Tautan Unik
2026-08-19,2026-08-19,manurung,active,2846,actions:link_click,82353,19116,2788`
const clickReport = `Klik ID,Waktu Klik,Wilayah Klik,Tag_link,Perujuk
abc,2026-08-19 23:59:39,Indonesia,manurung----,Facebook
xyz,2026-08-19 22:00:00,Indonesia,newmanurung----,Facebook`

describe('parser', () => {
  it('parses IDR formats robustly', () => {
    expect(parseIdr('314467')).toBe(314467)
    expect(parseIdr('314,467')).toBe(314467)
    expect(parseIdr('314.467')).toBe(314467)
    expect(parseIdr('Rp 1.234.567')).toBe(1234567)
    expect(parseIdr('1711.8')).toBe(1711.8)
  })
  it('skips Meta summary row with blank campaign to prevent double spend', () => {
    const parsed = parseMetaCsv(metaBarry)
    expect(parsed.stats.rawSpend).toBe(628934)
    expect(parsed.stats.usedSpend).toBe(314467)
    expect(parsed.stats.summarySkipped).toBe(1)
  })
  it('analyzes Barry sample spend and Shopee decimal commission correctly', () => {
    const result = analyze(metaBarry, shopeeBarry, 0)
    expect(result.totals.spend).toBe(314467)
    expect(result.quality.metaSpendRaw).toBe(628934)
    expect(result.quality.metaSummaryRowsSkipped).toBe(1)
    expect(result.totals.commission).toBeCloseTo(2481.745)
    expect(result.shopee.map(r => r.commission)).toEqual([1711.8, 769.945])
    expect(result.tags[0].tag).toBe('manurung')
    expect(result.tags[0].campaign).toBe('manurung')
    expect(result.tags[0].matchScore).toBe(100)
  })
  it('parses Indonesian Meta action exports and Shopee click reports', () => {
    const meta = parseMetaCsv(metaIndonesianActions)
    expect(meta.rows[0].clicks).toBe(2788)
    const clicks = parseClickCsv(clickReport)
    expect(clicks.rows.map(r => r.tag)).toEqual(['manurung', 'newmanurung'])
    const result = analyze(metaIndonesianActions, shopeeBarry, 0, clickReport)
    expect(result.totals.clicks).toBe(2788)
    const metaDay = result.daily.find(row => row.date === '2026-08-19')
    expect(metaDay.clicks).toBe(2788)
    expect(metaDay.impressions).toBe(19116)
    expect(result.clicks).toHaveLength(2)
    expect(result.tags.find(t => t.tag === 'manurung')?.clickCount).toBe(1)
  })
})
