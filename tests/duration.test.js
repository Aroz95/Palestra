// BUG durata: la seduta comprende riscaldamento, esercizi, recuperi e defaticamento, senza doppi conteggi
import { describe, expect, it } from 'vitest'
import { autoStart, withAutoStart, finishPatch, activeMs } from '../src/lib/actions'
import { sessionDuration } from '../src/lib/stats'
import { exportSession } from '../src/lib/report'

const T = (hhmmss) => new Date(`2026-10-29T${hhmmss}+01:00`).getTime()
const iso = (ms) => new Date(ms).toISOString()
const base = (extra = {}) => ({
  id: 'session-p1se3657364h',
  kind: 'strength',
  date: '2026-10-29',
  status: 'in_progress',
  startedAt: null,
  endedAt: null,
  durationMin: null,
  durationSource: null,
  warmup: [{ id: 'w', name: 'Tapis roulant', minutes: 10, speed: 5.5, done: false }],
  exercises: [{ id: 'e1', name: 'Leg Press', type: 'reps', sets: [{ done: false }, { done: false }] }],
  cooldown: [{ id: 'c', name: 'Tapis roulant', minutes: 5, speed: 5, done: false }],
  ...extra,
})
const doneWarmup = (s) => ({ ...s, warmup: s.warmup.map((c) => ({ ...c, done: true })) })
const doneSet = (s, i = 0) => ({ ...s, exercises: s.exercises.map((e) => ({ ...e, sets: e.sets.map((x, j) => (j === i ? { ...x, done: true } : x)) })) })
const doneCooldown = (s) => ({ ...s, cooldown: s.cooldown.map((c) => ({ ...c, done: true })) })
const ms = (s) => Date.parse(s.startedAt)

describe('inizio della seduta', () => {
  it('riscaldamento a tempo concluso: l’inizio è anticipato dei suoi minuti (prima veniva fissato a fine riscaldamento)', () => {
    const s0 = base()
    const s1 = withAutoStart(s0, doneWarmup(s0), T('18:29:41'))
    expect(ms(s1)).toBe(T('18:19:41'))
    expect(s1.status).toBe('in_progress')
  })
  it('senza riscaldamento: la prima serie fissa l’inizio adesso', () => {
    const s0 = base({ warmup: [] })
    expect(ms(withAutoStart(s0, doneSet(s0), T('18:20:00')))).toBe(T('18:20:00'))
  })
  it('modifiche che non completano attività non fissano l’inizio', () => {
    const s0 = base()
    const s1 = withAutoStart(s0, { ...s0, warmup: s0.warmup.map((c) => ({ ...c, minutes: 12 })) }, T('18:20:00'))
    expect(s1.startedAt).toBeNull()
  })
  it('inizio già fissato (avvio del cronometro): non viene spostato da riscaldamento o defaticamento', () => {
    const s0 = autoStart(base(), { at: T('18:19:41') })
    const s1 = withAutoStart(s0, doneWarmup(s0), T('18:29:41'))
    const s2 = withAutoStart(s1, doneCooldown(s1), T('19:03:11'))
    expect(s2.startedAt).toBe(s0.startedAt)
  })
  it('sedute migrate dalla versione precedente: nessun orario inventato', () => {
    const s = autoStart(base({ origin: 'legacy-v2', status: 'planned' }), { at: T('18:00:00') })
    expect(s.startedAt).toBeNull()
  })
})

describe('durata salvata', () => {
  it('caso reale 29/10: cronometro avviato col riscaldamento → 44 min, coerente con inizio e fine', () => {
    const s = autoStart(base(), { at: T('18:19:41') })
    const stopwatch = { activeMs: T('19:03:11') - T('18:19:41'), firstStartAt: T('18:19:41') } // 43:30 senza pause
    const done = { ...s, ...finishPatch(doneCooldown(doneSet(doneWarmup(s))), { at: T('19:03:11'), stopwatch }) }
    expect(done).toMatchObject({ status: 'completed', durationMin: 44, durationSource: 'stopwatch' })
    expect(sessionDuration(done)).toMatchObject({ min: 44, computed: 44, pausedMin: null, mismatch: false })
    // JSON v4: stessi valori nella seduta e nel riepilogo
    const json = exportSession(done)
    expect(json.session).toMatchObject({ durationMin: 44, durationSource: 'stopwatch', startedAt: done.startedAt, endedAt: done.endedAt })
    expect(json.summary.durationMin).toBe(44)
  })
  it('riscaldamento e defaticamento non vengono sommati una seconda volta', () => {
    const s = autoStart(base(), { at: T('18:00:00') })
    const done = { ...s, ...finishPatch(doneCooldown(doneSet(doneWarmup(s))), { at: T('18:45:00') }) }
    // 10 + 5 minuti di cardio sono già dentro l'intervallo 18:00–18:45
    expect(sessionDuration(done)).toMatchObject({ min: 45, source: 'computed' })
  })
  it('pause: il cronometro fermato non conta, la differenza con gli orari è mostrata come pausa', () => {
    const s = autoStart(base(), { at: T('18:00:00') })
    const stopwatch = { activeMs: 40 * 60000, firstStartAt: T('18:00:00') } // 50 minuti di orologio, 10 in pausa
    const done = { ...s, ...finishPatch(s, { at: T('18:50:00'), stopwatch }) }
    expect(sessionDuration(done)).toMatchObject({ min: 40, source: 'stopwatch', computed: 50, pausedMin: 10 })
  })
  it('riscaldamento segnato “fatto senza timer” prima di avviare il cronometro: incluso una sola volta', () => {
    const s0 = base()
    const s1 = withAutoStart(s0, doneWarmup(s0), T('18:10:00')) // inizio 18:00
    const stopwatch = { activeMs: 30 * 60000, firstStartAt: T('18:10:00') } // poi 30 minuti di cronometro
    expect(activeMs(s1, stopwatch)).toBe(40 * 60000)
    const done = { ...s1, ...finishPatch(s1, { at: T('18:40:00'), stopwatch }) }
    expect(sessionDuration(done)).toMatchObject({ min: 40, computed: 40, pausedMin: null })
  })
  it('cronometro di un’altra seduta o assente: durata da inizio e fine', () => {
    const s = autoStart(base(), { at: T('18:00:00') })
    expect(finishPatch(s, { at: T('18:35:00'), stopwatch: null })).toMatchObject({ durationMin: 35, durationSource: 'computed' })
  })
  it('durata corretta a mano: resta quella, la fine viene comunque registrata', () => {
    const s = { ...autoStart(base(), { at: T('18:00:00') }), durationMin: 50, durationSource: 'manual' }
    const p = finishPatch(s, { at: T('18:35:00'), stopwatch: { activeMs: 35 * 60000, firstStartAt: T('18:00:00') } })
    expect(p).toEqual({ status: 'completed', endedAt: expect.any(String) })
  })
  it('cronometro più lungo degli orari: segnalato (inizio registrato in ritardo), non nascosto', () => {
    const d = sessionDuration({ startedAt: iso(T('18:29:41')), endedAt: iso(T('19:03:11')), durationMin: 44, durationSource: 'stopwatch' })
    expect(d).toMatchObject({ min: 44, computed: 34, mismatch: true })
  })
})
