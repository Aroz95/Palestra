// BUG data seduta: data effettiva (svolgimento) distinta dalla data programmata del calendario
process.env.TZ = 'Europe/Rome' // giorni calcolati nel fuso del dispositivo
import { describe, expect, it } from 'vitest'
import { buildSession, upsertSession } from '../src/lib/actions'
import { repairSessionDate, plannedDateOf, isRescheduled } from '../src/lib/sessionDates'
import { migrateToLatest } from '../src/schema/migrate'
import { parseImport, previewImport, applyImport } from '../src/lib/import'
import { exportSession, fileNames } from '../src/lib/report'
import { emptyState, newProgram, newTemplate, newTemplateExercise } from '../src/schema/factories'
import { occurrencesOn } from '../src/lib/calendar'
import { aggregateAll } from '../src/lib/report/aggregate'

const tpl = newTemplate({ id: 'tpl-a', name: 'Full Body A', label: 'A', exercises: [newTemplateExercise({ id: 'leg-press', name: 'Leg Press', sets: 2 })] })
const program = newProgram({ id: 'prog', isMain: true, weeklySchedule: [{ id: 'slot-ven', weekday: 5, kind: 'strength', templateId: 'tpl-a', label: '' }] })
const base = () => ({ ...emptyState(), programs: [program], workoutTemplates: [{ ...tpl, programId: 'prog' }] })

// Caso reale: seduta del 5/11 registrata con la data dell'attività del 6/11
const bugged = {
  id: 'session-8q0wjpss2fi2',
  kind: 'strength',
  date: '2026-11-06',
  title: 'A · Full Body A',
  status: 'completed',
  occurrenceKey: 'prog:2026-11-06:slot-ven',
  templateId: 'tpl-a',
  startedAt: '2026-11-05T18:42:58+01:00',
  endedAt: '2026-11-05T19:49:56+01:00',
  durationMin: 67,
  durationSource: 'stopwatch',
  warmup: [],
  cooldown: [],
  exercises: [{ id: 'x', exerciseId: 'leg-press', name: 'Leg Press', type: 'reps', equipment: 'machine', perHand: false, rest: 90, restChosen: true, notes: 'sedile 4', sets: [{ reps: 12, weight: 70, done: true, restSelectedSec: 90, restActualSec: 95 }] }],
}

describe('creazione della seduta dal calendario', () => {
  it('attività di venerdì 6/11 avviata giovedì 5/11: data effettiva 5/11, programmata 6/11', () => {
    const st = base()
    const [occ] = occurrencesOn(st, '2026-11-06')
    const s = buildSession(st, { occ, date: '2026-11-05' })
    expect(s).toMatchObject({ date: '2026-11-05', plannedDate: '2026-11-06', occurrenceKey: 'prog:2026-11-06:slot-ven' })
    expect(isRescheduled(s)).toBe(true)
    // l'attività del 6/11 risulta svolta (collegata), nessuna seduta duplicata
    const after = upsertSession({ ...st, sessions: [] }, { ...s, status: 'completed' })
    expect(occurrencesOn(after, '2026-11-06')[0]).toMatchObject({ status: 'completed', sessionId: s.id })
    expect(after.sessions).toHaveLength(1)
  })
  it('stesso giorno: nessuna differenza; recupero di un’attività passata: data di oggi', () => {
    const st = base()
    const [occ] = occurrencesOn(st, '2026-11-06')
    expect(isRescheduled(buildSession(st, { occ, date: '2026-11-06' }))).toBe(false)
    expect(buildSession(st, { occ, date: '2026-11-08' })).toMatchObject({ date: '2026-11-08', plannedDate: '2026-11-06' })
  })
})

describe('correzione delle sedute già registrate', () => {
  it('caso del 5/11: data 5/11, programmata 6/11; esercizi, serie, carichi e recuperi invariati', () => {
    const r = repairSessionDate(bugged)
    expect(r).toMatchObject({ date: '2026-11-05', plannedDate: '2026-11-06', occurrenceKey: bugged.occurrenceKey, durationMin: 67 })
    expect(r.exercises).toEqual(bugged.exercises)
    expect(repairSessionDate(r)).toBe(r) // idempotente
  })
  it('non tocca: data cambiata a mano, sedute libere, senza orario, orari incoerenti', () => {
    expect(repairSessionDate({ ...bugged, date: '2026-11-04' }).date).toBe('2026-11-04')
    expect(repairSessionDate({ ...bugged, occurrenceKey: null }).date).toBe('2026-11-06')
    expect(repairSessionDate({ ...bugged, startedAt: null }).date).toBe('2026-11-06')
    expect(repairSessionDate({ ...bugged, endedAt: '2026-11-08T10:00:00+01:00' }).date).toBe('2026-11-06')
  })
  it('allenamento oltre la mezzanotte: vale il giorno di inizio', () => {
    const s = { ...bugged, startedAt: '2026-11-05T23:30:00+01:00', endedAt: '2026-11-06T00:40:00+01:00' }
    expect(repairSessionDate(s).date).toBe('2026-11-05')
  })
  it('fusi orari: il giorno è quello locale del dispositivo, non quello UTC né quello dell’offset del file', () => {
    // 23:30 UTC del 5/11 = 00:30 del 6/11 a Roma: la seduta è del 6/11 (nessuna correzione)
    expect(repairSessionDate({ ...bugged, startedAt: '2026-11-05T23:30:00Z', endedAt: '2026-11-06T00:30:00Z' }).date).toBe('2026-11-06')
    // 18:42 a New York (−05:00) del 5/11 = 00:42 del 6/11 a Roma
    expect(repairSessionDate({ ...bugged, startedAt: '2026-11-05T18:42:00-05:00', endedAt: '2026-11-05T19:49:00-05:00' }).date).toBe('2026-11-06')
  })
  it('attività aggiunta al calendario (chiave senza data): data programmata dalla lista delle aggiunte', () => {
    const s = { ...bugged, occurrenceKey: 'occ-extra-1' }
    expect(plannedDateOf(s, [{ id: 'occ-extra-1', date: '2026-11-06' }])).toBe('2026-11-06')
    expect(repairSessionDate(s, [{ id: 'occ-extra-1', date: '2026-11-06' }]).date).toBe('2026-11-05')
  })
  it('all’avvio dell’app i dati salvati vengono corretti; calendario e statistiche coerenti', () => {
    const st = migrateToLatest({ ...base(), schemaVersion: 4, sessions: [bugged] })
    expect(st.sessions[0]).toMatchObject({ date: '2026-11-05', plannedDate: '2026-11-06' })
    expect(occurrencesOn(st, '2026-11-06')[0]).toMatchObject({ status: 'completed', sessionId: bugged.id })
    expect(aggregateAll(st, { from: '2026-11-05', to: '2026-11-05' }).training.strengthSessions).toBe(1)
    expect(aggregateAll(st, { from: '2026-11-06', to: '2026-11-06' }).training.strengthSessions).toBe(0)
  })
})

describe('esportazione e importazione', () => {
  it('il JSON esportato del 5/11 ha data effettiva, data programmata e nome file corretti; reimport senza duplicati', () => {
    const fixed = repairSessionDate(bugged)
    const json = exportSession(fixed)
    expect(json.session).toMatchObject({ date: '2026-11-05', plannedDate: '2026-11-06' })
    expect(fileNames.session(fixed)).toBe('palestra-seduta-2026-11-05.json')
    const r = parseImport(JSON.stringify(json))
    expect(r.errors).toEqual([])
    let st = applyImport(emptyState(), r.batch, previewImport(emptyState(), r.batch), { decisions: {} }).state
    const again = parseImport(JSON.stringify(json))
    st = applyImport(st, again.batch, previewImport(st, again.batch), { decisions: {} }).state
    expect(st.sessions).toHaveLength(1)
    expect(st.sessions[0].exercises).toMatchObject(fixed.exercises)
  })
  it('il file già esportato con la data sbagliata (palestra-seduta-2026-11-06.json) viene importato con la data corretta', () => {
    const r = parseImport(JSON.stringify({ type: 'palestra-seduta', schemaVersion: 4, session: bugged }))
    expect(r.errors).toEqual([])
    const st = applyImport(emptyState(), r.batch, previewImport(emptyState(), r.batch), { decisions: {} }).state
    expect(st.sessions[0]).toMatchObject({ id: bugged.id, date: '2026-11-05', plannedDate: '2026-11-06', durationMin: 67 })
    expect(st.sessions[0].exercises[0].sets[0]).toMatchObject({ reps: 12, weight: 70, done: true, restSelectedSec: 90, restActualSec: 95 })
  })
})
