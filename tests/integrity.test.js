// P1-02: integrità di programmi A/B, revisioni e storico lungo un percorso completo
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseImport, previewImport, applyImport } from '../src/lib/import'
import { emptyState } from '../src/schema/factories'
import * as A from '../src/lib/actions'
import { occurrencesOn } from '../src/lib/calendar'
import { progressionHint } from '../src/lib/stats'
import { lastPerformance, lastPerformance as lp } from '../src/schema/factories'

const PROGRAM = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../docs/examples/programma-ab.json'), 'utf8'))
const importObj = (state, obj, opts) => {
  const r = parseImport(JSON.stringify(obj))
  expect(r.errors).toEqual([])
  const pv = previewImport(state, r.batch)
  const decisions = Object.fromEntries(pv.items.map((i) => [i.key, opts?.choice ?? 'skip']))
  return applyImport(state, r.batch, pv, { ...opts, decisions }).state
}
const start = (state, templateId, date) => {
  const session = A.buildSession(state, { templateId, date })
  return { state: A.addStartedSession(state, session), session }
}
const doAll = (s) => ({ ...s, status: 'completed', exercises: s.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, done: true })) })) })

describe('percorso A/B con revisioni, aggiornamento, clonazione e archiviazione', () => {
  let state = importObj(emptyState(), PROGRAM)
  const tplA = () => state.workoutTemplates.find((t) => t.id === 'full-body-a')

  it('prima seduta A usa la revisione 1', () => {
    const r = start(state, 'full-body-a', '2026-11-02')
    state = A.upsertSession(r.state, doAll(r.session))
    expect(r.session.templateRevision).toBe(1)
    expect(tplA().revisionInUse).toBe(true)
  })

  it('modifica di A già usata → revisione 2, prima seduta invariata', () => {
    const first = structuredClone(state.sessions[0])
    state = A.upsertTemplate(state, { ...tplA(), exercises: tplA().exercises.map((e) => (e.id === 'leg-press' ? { ...e, repMin: 8, repMax: 10, suggestedWeightKg: 70 } : e)) })
    expect(tplA().revision).toBe(2)
    expect(tplA().history.map((h) => h.revision)).toEqual([1])
    expect(state.sessions[0]).toEqual(first)
    // altre modifiche prima di un nuovo utilizzo non creano revisioni a raffica
    state = A.upsertTemplate(state, { ...tplA(), name: 'Full Body A+' })
    expect(tplA().revision).toBe(2)
  })

  it('seconda seduta usa la revisione 2 e i nuovi obiettivi', () => {
    const r = start(state, 'full-body-a', '2026-11-09')
    state = A.upsertSession(r.state, doAll(r.session))
    const lpEx = r.session.exercises.find((e) => e.exerciseId === 'leg-press')
    expect(r.session.templateRevision).toBe(2)
    expect(lpEx.target).toMatchObject({ repMin: 8, repMax: 10, weightKg: 70 })
    // carico proposto dall'ultima esecuzione reale dello stesso esercizio (60 kg della prima seduta)
    expect(lpEx.sets[0].weight).toBe(60)
  })

  it('aggiornamento del programma da JSON → revisione 3, storico completo, sedute immutate', () => {
    const sessionsBefore = structuredClone(state.sessions)
    const changed = structuredClone(PROGRAM)
    changed.workoutTemplates[0].exercises[0].suggestedWeightKg = 65
    changed.workoutTemplates.pop() // la scheda B non è più nel file (né nel calendario)
    changed.weeklySchedule = changed.weeklySchedule.filter((sl) => sl.templateId !== 'full-body-b')
    state = importObj(state, changed, { choice: 'update' })
    expect(tplA().revision).toBe(3)
    expect(tplA().history.map((h) => h.revision)).toEqual([1, 2])
    expect(state.workoutTemplates.find((t) => t.id === 'full-body-b').archived).toBe(true)
    expect(state.sessions).toEqual(sessionsBefore)
    expect(state.sessions.map((s) => s.templateRevision)).toEqual([1, 2])
  })

  it('reimport identico → nessuna nuova revisione', () => {
    const changed = structuredClone(PROGRAM)
    changed.workoutTemplates[0].exercises[0].suggestedWeightKg = 65
    changed.workoutTemplates.pop()
    changed.weeklySchedule = changed.weeklySchedule.filter((sl) => sl.templateId !== 'full-body-b')
    state = importObj(state, changed, { choice: 'update' })
    expect(tplA().revision).toBe(3)
  })

  it('clonazione: nuovi id coerenti, calendario rimappato, originale intatto', () => {
    const before = structuredClone(state.workoutTemplates)
    state = importObj(state, PROGRAM, { choice: 'clone' })
    const copy = state.programs.find((p) => p.name.endsWith('(copia)'))
    const copyTpl = state.workoutTemplates.filter((t) => t.programId === copy.id)
    expect(copyTpl).toHaveLength(2)
    expect(copy.weeklySchedule.filter((s) => s.templateId).every((s) => copyTpl.some((t) => t.id === s.templateId))).toBe(true)
    expect(state.workoutTemplates.slice(0, before.length)).toEqual(before)
  })

  it('archiviazione: il programma archiviato non genera più attività, lo storico resta', () => {
    const main = state.programs.find((p) => p.isMain)
    expect(occurrencesOn(state, '2026-11-16').length).toBeGreaterThan(0)
    state = A.upsertProgram(state, { ...main, status: 'archived', isMain: false })
    expect(occurrencesOn(state, '2026-11-16')).toHaveLength(0)
    expect(state.sessions).toHaveLength(2)
  })

  it('nessun riferimento orfano', () => {
    const tplIds = new Set(state.workoutTemplates.map((t) => t.id))
    const progIds = new Set(state.programs.map((p) => p.id))
    expect(state.sessions.every((s) => !s.templateId || tplIds.has(s.templateId))).toBe(true)
    expect(state.workoutTemplates.every((t) => progIds.has(t.programId))).toBe(true)
    for (const p of state.programs) for (const sl of p.weeklySchedule) if (sl.templateId) expect(tplIds.has(sl.templateId)).toBe(true)
  })

  it('progressione confronta solo lo stesso esercizio (stesso id) tra revisioni', () => {
    const prev = lp(state.sessions, 'leg-press', { beforeDate: '2026-11-20' })
    expect(prev.date).toBe('2026-11-09')
    expect(progressionHint(prev, 5)).toMatch(/Ultima volta \(2026-11-09\)/)
    expect(lastPerformance(state.sessions, 'inesistente')).toBeNull()
  })
})
