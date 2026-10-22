import { describe, expect, it } from 'vitest'
import { strengthStats, sessionDuration, personalRecords, progressionHint } from '../src/lib/stats'
import { createStrengthSession, newTemplate, newTemplateExercise } from '../src/schema/factories'
import { combineDateTime } from '../src/lib/dates'
import { estimateEnergy, bodyWeightAt } from '../src/lib/energy'

const tpl = newTemplate({
  id: 'full-body-a',
  label: 'A',
  name: 'Full Body A',
  exercises: [newTemplateExercise({ id: 'leg-press', name: 'Leg Press', sets: 2, repMin: 10, repMax: 12, suggestedWeightKg: 60, targetRir: 3 })],
})

describe('target vs eseguito (US-03)', () => {
  it('target 10–12, eseguite 2×10 → 20 ripetizioni effettive', () => {
    const s = createStrengthSession(tpl, [], { date: '2026-11-02' })
    const ex = s.exercises[0]
    expect(ex.target).toMatchObject({ repMin: 10, repMax: 12, rir: 3 })
    ex.sets = ex.sets.map((x) => ({ ...x, reps: 10, done: true, rir: 3 }))
    expect(ex.sets[0].target).toMatchObject({ repMin: 10, repMax: 12 })
    const st = strengthStats(s)
    expect(st.reps).toBe(20)
    expect(st.volume).toBe(1200)
  })

  it('le serie non completate non contano e il carico ignoto rende il volume parziale', () => {
    const s = createStrengthSession(tpl, [], { date: '2026-11-02' })
    s.exercises[0].sets[0] = { ...s.exercises[0].sets[0], done: true, weight: null }
    const st = strengthStats(s)
    expect(st.reps).toBe(12)
    expect(st.volume).toBe(0)
    expect(st.volumePartial).toBe(true)
  })

  it('il numero di serie viene dalla scheda, il carico dall’ultima esecuzione dello stesso esercizio', () => {
    const prev = createStrengthSession(tpl, [], { date: '2026-11-02' })
    prev.exercises[0].sets = [
      { ...prev.exercises[0].sets[0], weight: 65, done: true },
      { ...prev.exercises[0].sets[0], weight: 70, done: true },
      { ...prev.exercises[0].sets[0], weight: 70, done: true },
    ]
    const next = createStrengthSession(tpl, [prev], { date: '2026-11-05' })
    expect(next.exercises[0].sets).toHaveLength(2)
    expect(next.exercises[0].sets.map((x) => x.weight)).toEqual([65, 70])
    expect(next.templateId).toBe('full-body-a')
  })
})

describe('durata (US-11)', () => {
  it('inizio 18:20 e fine 19:55 → 95 minuti', () => {
    const s = { startedAt: combineDateTime('2026-10-22', '18:20'), endedAt: combineDateTime('2026-10-22', '19:55'), durationMin: 62, durationSource: 'stopwatch' }
    expect(sessionDuration(s)).toMatchObject({ min: 95, source: 'computed' })
  })
  it('una durata manuale diversa dagli orari viene segnalata, non cancellata', () => {
    const s = { startedAt: combineDateTime('2026-10-22', '18:20'), endedAt: combineDateTime('2026-10-22', '19:55'), durationMin: 62, durationSource: 'manual' }
    expect(sessionDuration(s)).toMatchObject({ min: 62, computed: 95, mismatch: true })
  })
})

describe('record e progressione', () => {
  const mk = (date, weight, reps, rir = null, exId = 'leg-press') => ({
    id: date,
    kind: 'strength',
    status: 'completed',
    date,
    exercises: [{ exerciseId: exId, name: 'Leg Press', equipment: 'machine', perHand: false, type: 'reps', sets: [{ reps, weight, done: true, rir, target: { repMin: 10, repMax: 12 } }] }],
    warmup: [],
    cooldown: [],
  })
  it('record solo su esercizi confrontabili e serie eseguite', () => {
    const sessions = [mk('2026-10-01', 60, 12), mk('2026-10-10', 65, 10), mk('2026-10-12', 100, 10, null, 'altra-pressa')]
    const pr = personalRecords(sessions, { from: '2026-10-05', to: '2026-10-31' })
    const lp = pr.all.find((r) => r.key.startsWith('leg-press'))
    expect(lp.weight).toBe(65)
    expect(pr.newInPeriod.map((r) => r.weight)).toEqual([65]) // la macchina diversa non è un "record" confrontabile
  })
  it('suggerimento non prescrittivo a fine range con RIR alto', () => {
    const prev = { date: '2026-10-01', exercise: mk('2026-10-01', 60, 12, 3).exercises[0] }
    expect(progressionHint(prev, 2.5)).toMatch(/valuta un incremento minimo/)
  })
})

describe('stima energia', () => {
  it('restituisce intervalli e richiede peso e durata', () => {
    const s = { kind: 'strength', warmup: [{ minutes: 10, speed: 5.5, done: true }], cooldown: [], exercises: [] }
    expect(estimateEnergy(s, null, 60)).toBeNull()
    const e = estimateEnergy(s, 75, 70)
    expect(e.activeKcal.min).toBeLessThan(e.totalKcal.min)
    expect(e.totalKcal.min).toBeLessThan(e.totalKcal.max)
    expect(e.method).toMatch(/ACSM/)
  })
  it('usa solo misure di peso registrate entro la data', () => {
    const m = [{ at: '2026-10-25T08:00:00+02:00', weightKg: 74 }, { at: '2026-10-20T08:00:00+02:00', weightKg: 75 }]
    expect(bodyWeightAt(m, '2026-10-22').weightKg).toBe(75)
    expect(bodyWeightAt(m, '2026-10-01')).toBeNull()
  })
})

describe('orario di inizio', () => {
  it('non viene inventato per le sedute migrate, ma lo stato passa a "in corso"', async () => {
    const { autoStart } = await import('../src/lib/actions')
    const legacy = autoStart({ status: 'planned', startedAt: null, origin: 'legacy-v2' })
    expect(legacy).toMatchObject({ startedAt: null, status: 'in_progress' })
    expect(autoStart({ status: 'planned', startedAt: null }).startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
