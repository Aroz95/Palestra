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
