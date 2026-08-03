
import { describe, expect, it } from 'vitest'
import { analyze, parseIdr, parseMetaCsv } from './parser'

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
})
