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

// EXE-01 / TIM-01
import { chooseRest, recordRest } from '../src/lib/actions'
import { parseImport, previewImport, applyImport } from '../src/lib/import'
import { exportSession } from '../src/lib/report'
import { emptyState } from '../src/schema/factories'

const exec = (date, sets, extra = {}) => ({
  id: `s-${date}`,
  kind: 'strength',
  date,
  status: 'completed',
  startedAt: `${date}T18:00:00+01:00`,
  warmup: [],
  cooldown: [],
  exercises: [{ id: 'x1', exerciseId: 'chest-press', name: 'Chest Press', equipment: 'machine', perHand: false, type: 'reps', rest: 120, notes: '', sets, ...extra }],
})
const S = (reps, weight, extra = {}) => ({ reps, weight, done: true, note: '', ...extra })

describe('EXE-01: precompilazione dalla precedente esecuzione', () => {
  const chest = tex('chest-press', 'Chest Press', { sets: 4, repMin: 8, repMax: 12, suggestedWeightKg: 20, restSeconds: 120 })
  it('12×25, 10×30, 8×35, 6×40 → stessi valori, nessuna serie fatta', () => {
    const prev = exec('2026-11-03', [S(12, 25), S(10, 30), S(8, 35), S(6, 40, { note: '40 kg × 6 pesante' })])
    const s = createStrengthSession(tpl('A', [chest]), [prev], { date: '2026-11-05' })
    expect(s.exercises[0].sets.map((x) => [x.reps, x.weight, x.done])).toEqual([[12, 25, false], [10, 30, false], [8, 35, false], [6, 40, false]])
    expect(s.exercises[0].notes).toBe('') // le note precedenti si mostrano a parte, non vengono copiate
    expect(prev.exercises[0].sets.every((x) => x.done)).toBe(true) // seduta precedente intatta
  })
  it('ripetizioni mancanti nello storico: si usa la scheda (piano), il peso noto resta', () => {
    const s = createStrengthSession(tpl('A', [chest]), [exec('2026-11-03', [S(null, 25), S(10, 30)])], { date: '2026-11-05' })
    expect(s.exercises[0].sets.map((x) => [x.reps, x.weight])).toEqual([[12, 25], [10, 30], [10, 30], [10, 30]])
  })
  it('esercizi a tempo: durata dell’ultima volta', () => {
    const plank = tex('plank', 'Plank', { type: 'time', equipment: 'bodyweight', durationSec: 30, sets: 2 })
    const prev = { ...exec('2026-11-03', []), exercises: [{ exerciseId: 'plank', name: 'Plank', type: 'time', equipment: 'bodyweight', sets: [{ durationSec: 45, done: true }, { durationSec: 40, done: true }] }] }
    expect(createStrengthSession(tpl('A', [plank]), [prev], { date: '2026-11-05' }).exercises[0].sets.map((x) => x.durationSec)).toEqual([45, 40])
  })
})

describe('TIM-01: recupero scelto con ±15 s', () => {
  const chest = tex('chest-press', 'Chest Press', { sets: 2, restSeconds: 120 })
  const base = () => {
    const st = { ...emptyState(), sessions: [] }
    const sess = createStrengthSession(tpl('A', [chest]), [], { date: '2026-11-03' })
    sess.exercises[0].sets = sess.exercises[0].sets.map((x) => ({ ...x, done: true }))
    return { ...st, sessions: [sess] }
  }
  const target = (st, setIdx = 0) => ({ type: 'rest', sessionId: st.sessions[0].id, exId: st.sessions[0].exercises[0].id, setIdx })
  it('120 s → −15 −15 = 90 s salvati e riproposti la volta successiva', () => {
    let st = base()
    st = chooseRest(st, target(st), 105)
    st = chooseRest(st, target(st), 90)
    expect(st.sessions[0].exercises[0]).toMatchObject({ rest: 90, restChosen: true })
    const next = createStrengthSession(tpl('A', [chest]), st.sessions, { date: '2026-11-05' })
    expect(next.exercises[0]).toMatchObject({ rest: 90, restChosen: true })
    // senza ulteriori modifiche resta 90 anche la volta dopo
    next.exercises[0].sets = next.exercises[0].sets.map((x) => ({ ...x, done: true }))
    expect(createStrengthSession(tpl('A', [chest]), [...st.sessions, next], { date: '2026-11-07' }).exercises[0].rest).toBe(90)
  })
  it('120 s → +15 +15 = 150 s', () => {
    let st = base()
    st = chooseRest(chooseRest(st, target(st), 135), target(st), 150)
    expect(createStrengthSession(tpl('A', [chest]), st.sessions, { date: '2026-11-05' }).exercises[0].rest).toBe(150)
  })
  it('stop anticipato senza regolazioni: misura effettiva separata, preferenza invariata', () => {
    let st = base()
    st = recordRest(st, target(st), { selectedSec: 120, actualSec: 40 })
    const ex = st.sessions[0].exercises[0]
    expect(ex.sets[0]).toMatchObject({ restSelectedSec: 120, restActualSec: 40 })
    expect(ex.restChosen).toBeUndefined()
    expect(createStrengthSession(tpl('A', [chest]), st.sessions, { date: '2026-11-05' }).exercises[0].rest).toBe(120)
  })
  it('la modifica di un esercizio non cambia il recupero degli altri; export → import conserva i dati', () => {
    let st = base()
    const other = tex('leg-press', 'Leg Press', { restSeconds: 120 })
    st.sessions[0].exercises.push({ ...createStrengthSession(tpl('A', [other]), [], { date: '2026-11-03' }).exercises[0] })
    st = recordRest(chooseRest(st, target(st), 90), target(st), { selectedSec: 90, actualSec: 95 })
    expect(st.sessions[0].exercises[1].rest).toBe(120)
    const r = parseImport(JSON.stringify(exportSession(st.sessions[0])))
    expect(r.errors).toEqual([])
    const back = applyImport(emptyState(), r.batch, previewImport(emptyState(), r.batch), { decisions: {} }).state.sessions[0]
    expect(back.exercises[0]).toMatchObject({ rest: 90, restChosen: true })
    expect(back.exercises[0].sets[0]).toMatchObject({ restSelectedSec: 90, restActualSec: 95 })
  })
})
