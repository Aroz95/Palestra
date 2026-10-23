import { describe, expect, it } from 'vitest'
import { parseBlock, blocksTotal, swimDistances } from '../src/lib/swim'
import { aggregateSwim } from '../src/lib/report/aggregate'
import { emptyState } from '../src/schema/factories'

describe('blocchi di nuoto', () => {
  it('(200+100+2×75)×2', () => {
    expect(parseBlock('(200+100+2×75)×2')).toEqual([200, 100, 75, 75, 200, 100, 75, 75])
    expect(parseBlock('4x50 + 100m')).toEqual([50, 50, 50, 50, 100])
    expect(parseBlock('2×(100+50)')).toEqual([100, 50, 100, 50])
  })
  it('errori leggibili', () => {
    expect(() => parseBlock('200+')).toThrow()
    expect(() => parseBlock('abc')).toThrow(/Carattere non valido/)
  })
  it('blocchi dell’esempio = 2450 m', () => {
    const blocks = [
      { repeats: 1, segmentsM: [500] },
      { repeats: 2, segmentsM: [200, 100, 75, 75] },
      { repeats: 3, segmentsM: [100, 100, 75, 75] },
    ]
    expect(blocksTotal(blocks)).toBe(2450)
  })
})

describe('nuotata abbreviata (RF-05 / US-04)', () => {
  const swim = {
    id: 'swim-2026-10-21',
    kind: 'swim',
    date: '2026-10-21',
    status: 'completed',
    durationMin: 60,
    durationSource: 'manual',
    poolLengthM: 25,
    plannedDistanceM: 2450,
    plannedBlocks: [],
    actualDistanceM: null,
    estimatedDistanceM: { min: 1500, max: 1800 },
    distanceSource: 'estimated',
    isPartial: true,
  }

  it('la distanza prevista non diventa effettiva', () => {
    const d = swimDistances(swim)
    expect(d.planned).toBe(2450)
    expect(d.measured).toBeNull()
    expect(d.estimated).toEqual({ min: 1500, max: 1800 })
    expect(d.quality).toBe('estimated')
  })

  it('passo e vasche solo come intervallo stimato', () => {
    const d = swimDistances(swim)
    expect(d.pace.estimated).toBe(true)
    expect(d.pace.min).toBe(200) // 60 min su 1800 m → 3:20/100 m
    expect(d.pace.max).toBe(240) // 60 min su 1500 m → 4:00/100 m
    expect(d.laps).toEqual({ min: 60, max: 72, estimated: true })
  })

  it('in dashboard 2450 non è conteggiato come nuotato e le stime restano intervallo separato', () => {
    const state = { ...emptyState(), sessions: [swim, { ...swim, id: 'b', date: '2026-10-23', actualDistanceM: 1000, distanceSource: 'measured', estimatedDistanceM: null }] }
    const a = aggregateSwim(state, { from: '2026-10-01', to: '2026-10-31' })
    expect(a.measuredM).toBe(1000)
    expect(a.estimatedM).toEqual({ min: 1500, max: 1800 })
    expect(a.plannedM).toBe(4900)
    expect(a.quality).toBe('mixed')
  })
})

describe('ND distinto da 0', () => {
  it('minuti non registrati = null, nessuna seduta = 0', async () => {
    const { aggregateTraining } = await import('../src/lib/report/aggregate')
    const period = { from: '2026-10-01', to: '2026-10-31' }
    const s = { id: 'x', kind: 'strength', date: '2026-10-10', status: 'completed', exercises: [], warmup: [], cooldown: [] }
    expect(aggregateTraining({ ...emptyState(), sessions: [s] }, period).strengthMinutes).toEqual({ value: null, missing: 1 })
    expect(aggregateTraining(emptyState(), period).strengthMinutes).toEqual({ value: 0, missing: 0 })
  })
})

// BUG P1: "(100x3)x4" letto come 100 tratti da 3 m
describe('parser dei blocchi: ripetizioni annidate e sintassi', async () => {
  const { previewBlock, blockIssues, regenerateBlocks } = await import('../src/lib/swim')
  const { parseImport, previewImport, applyImport } = await import('../src/lib/import')
  const { exportSession } = await import('../src/lib/report')
  const sum = (a) => a.reduce((x, y) => x + y, 0)

  it('500 · (200)x2 · (100x3)x4 = 15 tratti, 2.100 m', () => {
    expect(parseBlock('500')).toEqual([500])
    expect(parseBlock('(200)x2')).toEqual([200, 200])
    expect(parseBlock('(100x3)x4')).toEqual(Array(12).fill(100))
    const blocks = ['500', '(200)x2', '(100x3)x4'].map((text, i) => ({ id: `b${i}`, text, repeats: 1, segmentsM: parseBlock(text) }))
    expect(blocks.flatMap((b) => b.segmentsM)).toHaveLength(15)
    expect(blocksTotal(blocks)).toBe(2100)
  })
  it('ripetizioni prima o dopo la distanza, separatori x × * X', () => {
    for (const t of ['3x100', '100x3', '3×100', '100*3', '3X100']) expect(parseBlock(t)).toEqual([100, 100, 100])
    expect(parseBlock('(200+100)x2')).toEqual([200, 100, 200, 100])
    expect(parseBlock('2x(200+100)')).toEqual([200, 100, 200, 100])
    expect(parseBlock('4x100x2')).toHaveLength(8)
    expect(parseBlock('30x(50)')).toEqual(Array(30).fill(50))
    expect(sum(parseBlock('((100x3)+50)x2'))).toBe(700)
    expect(parseBlock('100m x 4')).toEqual([100, 100, 100, 100])
  })
  it('espressioni non valide o ambigue: errore leggibile', () => {
    expect(() => parseBlock('50x50')).toThrow(/ambiguo/)
    expect(() => parseBlock('3x4')).toThrow(/nessuna distanza/)
    expect(() => parseBlock('(100x3')).toThrow(/parentesi di chiusura/)
    expect(() => parseBlock('100)')).toThrow(/senza apertura/)
    expect(() => parseBlock('(100)x(2)')).toThrow(/due gruppi/)
    expect(() => parseBlock('(100)x500')).toThrow(/ripetizioni/)
    expect(() => parseBlock('12.5')).toThrow(/interi/)
    expect(() => parseBlock('')).toThrow(/vuoto/)
    expect(previewBlock('(100x3)x4')).toMatchObject({ ok: true, count: 12, totalM: 1200 })
    expect(previewBlock('50x50')).toMatchObject({ ok: false })
  })
  it('blocchi salvati male: segnalati, rigenerati solo su richiesta, distanza effettiva invariata', () => {
    const bad = [{ id: 'b1', text: '500', repeats: 1, segmentsM: [500] }, { id: 'b3', text: '(100x3)x4', repeats: 1, segmentsM: Array(400).fill(3) }]
    const issues = blockIssues(bad)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ id: 'b3', saved: { count: 400, totalM: 1200 }, regenerated: { count: 12, totalM: 1200 } })
    const fixed = regenerateBlocks(bad, issues)
    expect(fixed[1].segmentsM).toEqual(Array(12).fill(100))
    expect(fixed[0]).toBe(bad[0])
    expect(blockIssues(fixed)).toEqual([])
    // blocchi senza testo o con ripetizioni coerenti non sono segnalati
    expect(blockIssues([{ id: 'r', text: '(200+100)x2', repeats: 2, segmentsM: [200, 100] }, { id: 'n', text: null, repeats: 1, segmentsM: [3] }])).toEqual([])
  })
  it('export → import: tratti invariati; file con tratti errati importato com’è, con avviso', () => {
    const session = {
      id: 'swim-2026-10-23', kind: 'swim', date: '2026-10-23', title: 'Nuoto', status: 'completed', durationMin: 60, durationSource: 'manual', poolLengthM: 25,
      plannedBlocks: ['500', '(200)x2', '(100x3)x4'].map((text, i) => ({ id: `b${i}`, text, repeats: 1, segmentsM: parseBlock(text), restSec: null, note: '' })),
      plannedDistanceM: 2100, actualDistanceM: 2100, distanceSource: 'manually_counted', estimatedDistanceM: null, isPartial: false, technique: {}, feedback: {}, notes: '',
    }
    const roundtrip = (s) => {
      const r = parseImport(JSON.stringify(exportSession(s)))
      expect(r.errors).toEqual([])
      const pv = previewImport(emptyState(), r.batch)
      return { r, state: applyImport(emptyState(), r.batch, pv, { decisions: {} }).state }
    }
    const { r, state } = roundtrip(session)
    expect(r.warnings).toEqual([])
    const back = state.sessions[0]
    expect(back.plannedBlocks.map((b) => b.segmentsM)).toEqual(session.plannedBlocks.map((b) => b.segmentsM))
    expect(back.plannedBlocks[2].segmentsM).toEqual(Array(12).fill(100))
    expect(back).toMatchObject({ plannedDistanceM: 2100, actualDistanceM: 2100 })
    const d = swimDistances(back)
    expect(d).toMatchObject({ planned: 2100, measured: 2100, plannedMismatch: false })
    expect(d.laps.value).toBe(84)

    const broken = { ...session, plannedBlocks: session.plannedBlocks.map((b, i) => (i === 2 ? { ...b, segmentsM: Array(300).fill(3) } : b)), plannedDistanceM: 1800 }
    const b2 = roundtrip(broken)
    expect(b2.r.warnings.some((w) => /non corrispondono al testo/.test(w.message ?? w.msg ?? String(w)))).toBe(true)
    expect(b2.state.sessions[0].plannedBlocks[2].segmentsM).toHaveLength(300) // nessuna correzione automatica
    expect(b2.state.sessions[0].actualDistanceM).toBe(2100)
  })
})
