// Pesi proposti: quelli effettivi dell'ultima seduta dello stesso esercizio, non quelli predefiniti della scheda
import { describe, expect, it } from 'vitest'
import { createStrengthSession, lastPerformance, exerciseKey } from '../src/schema/factories'

const tex = (id, name, extra = {}) => ({ id, name, type: 'reps', equipment: 'machine', sets: 2, repMin: 10, repMax: 12, suggestedWeightKg: 60, perHand: false, step: 2.5, ...extra })
const tpl = (id, exercises) => ({ id, name: id, label: '', revision: 1, warmup: [], cooldown: [], exercises })
const done = (date, exerciseId, name, weights, extra = {}) => ({
  id: `s-${date}-${exerciseId}`,
  kind: 'strength',
  date,
  startedAt: `${date}T18:00:00+01:00`,
  warmup: [],
  cooldown: [],
  exercises: [{ id: 'x', exerciseId, name, equipment: 'machine', perHand: false, type: 'reps', sets: weights.map((w) => ({ weight: w, reps: 10, done: w != null })), ...extra }],
})
const weightsOf = (session, i = 0) => session.exercises[i].sets.map((s) => s.weight)

describe('carico proposto nella nuova seduta', () => {
  it('stesso esercizio della scheda: pesi dell’ultima volta, serie per serie', () => {
    const s = createStrengthSession(tpl('A', [tex('leg-press', 'Leg Press')]), [done('2026-10-29', 'leg-press', 'Leg Press', [70, 72.5])], { date: '2026-11-03' })
    expect(weightsOf(s)).toEqual([70, 72.5])
    expect(s.exercises[0].target.weightKg).toBe(60) // l'obiettivo della scheda resta distinto dal carico proposto
  })
  it('programma reimportato o rigenerato (id diversi): riconosciuto per nome, attrezzo e carico per mano', () => {
    const s = createStrengthSession(tpl('A2', [tex('ex-9f2', 'leg  press')]), [done('2026-10-29', 'leg-press', 'Leg Press', [70, 70])], { date: '2026-11-03' })
    expect(weightsOf(s)).toEqual([70, 70])
  })
  it('stesso attrezzo nelle schede A e B: vale l’esecuzione più recente', () => {
    const sessions = [done('2026-10-27', 'a-leg-press', 'Leg Press', [65, 65]), done('2026-10-30', 'b-leg-press', 'Leg Press', [70, 70])]
    const a = createStrengthSession(tpl('A', [tex('a-leg-press', 'Leg Press')]), sessions, { date: '2026-11-03' })
    expect(weightsOf(a)).toEqual([70, 70])
  })
  it('attrezzo diverso o carico per mano diverso: non confuso', () => {
    const sessions = [done('2026-10-29', 'x', 'Curl', [10, 10])]
    const s = createStrengthSession(tpl('A', [tex('curl-m', 'Curl', { equipment: 'dumbbell', perHand: true, suggestedWeightKg: 6 })]), sessions, { date: '2026-11-03' })
    expect(weightsOf(s)).toEqual([6, 6])
  })
  it('serie non fatte ignorate; prima volta: peso suggerito dalla scheda', () => {
    const sessions = [done('2026-10-29', 'leg-press', 'Leg Press', [null, null])]
    const s = createStrengthSession(tpl('A', [tex('leg-press', 'Leg Press')]), sessions, { date: '2026-11-03' })
    expect(weightsOf(s)).toEqual([60, 60])
  })
  it('sedute future rispetto alla data della nuova seduta non usate', () => {
    const s = createStrengthSession(tpl('A', [tex('leg-press', 'Leg Press')]), [done('2026-11-10', 'leg-press', 'Leg Press', [90, 90])], { date: '2026-11-03' })
    expect(weightsOf(s)).toEqual([60, 60])
  })
  it('suggerimento di progressione: stesso criterio (id o identità di fatto)', () => {
    const last = lastPerformance([done('2026-10-29', 'old-id', 'Leg Press', [70, 70])], { exerciseId: 'new-id', name: 'Leg Press', equipment: 'machine', perHand: false })
    expect(last?.exercise.sets[0].weight).toBe(70)
    expect(exerciseKey({ name: ' Leg  Press ', equipment: 'machine' })).toBe(exerciseKey({ name: 'leg press', equipment: 'machine' }))
  })
})
