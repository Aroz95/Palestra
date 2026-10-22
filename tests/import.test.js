import { describe, expect, it } from 'vitest'
import { createInitialState as legacyV2State } from './fixtures/legacyV2'
import { parseImport, previewImport, applyImport } from '../src/lib/import'
import { migrateToV3 } from '../src/schema/migrate'
import { emptyState } from '../src/schema/factories'
import { exportBackup, exportSession, buildReport, reportToCSV } from '../src/lib/report'
import { strengthStats } from '../src/lib/stats'

const run = (state, obj, opts) => {
  const parsed = parseImport(JSON.stringify(obj))
  if (parsed.errors.length) return { parsed }
  const preview = previewImport(state, parsed.batch)
  const res = applyImport(state, parsed.batch, preview, opts)
  return { parsed, preview, ...res }
}

const PROGRAM = {
  type: 'palestra-program',
  schemaVersion: 3,
  id: 'program-2026-autunno',
  name: 'Ricomposizione + nuoto',
  validFrom: '2026-11-02',
  workoutTemplates: [
    {
      id: 'full-body-a',
      name: 'Full Body A',
      label: 'A',
      revision: 1,
      estimatedMinutes: 75,
      exercises: [{ id: 'leg-press', name: 'Leg Press', group: 'Gambe / glutei', type: 'reps', sets: 2, repMin: 10, repMax: 12, suggestedWeightKg: 60, perHand: false, targetRir: 3, restSeconds: 120 }],
    },
    { id: 'full-body-b', name: 'Full Body B', label: 'B', revision: 1, exercises: [] },
  ],
  weeklySchedule: [
    { weekday: 1, kind: 'strength', templateId: 'full-body-a' },
    { weekday: 2, kind: 'swim' },
    { weekday: 4, kind: 'strength', templateId: 'full-body-b' },
    { weekday: 5, kind: 'swim' },
  ],
}

describe('compatibilità legacy (US-06)', () => {
  it('seduta singola v2 esportata dalla versione precedente', () => {
    const legacy = legacyV2State()
    const file = { type: 'palestra-seduta', version: 2, exportedAt: '2026-10-22T17:00:00.000Z', summary: { seriePesi: 999 }, session: legacy.sessions[0] }
    const state = migrateToV3(legacyV2State())
    const { preview, state: next } = run(state, file)
    // stessa seduta già presente con lo stesso id → riconosciuta, non duplicata
    expect(preview.items[0].status).not.toBe('new')
    expect(next.sessions).toHaveLength(2)
    // in uno stato vuoto viene aggiunta, e il summary del file viene ignorato
    const r2 = run(emptyState(), file)
    expect(r2.state.sessions).toHaveLength(1)
    expect(strengthStats(r2.state.sessions[0]).sets).toBe(30)
  })

  it('backup v2 completo: anteprima e migrazione', () => {
    const { preview, state } = run(emptyState(), legacyV2State())
    expect(preview.canReplace).toBe(true)
    expect(preview.summary).toContain('2 sedute')
    expect(state.sessions).toHaveLength(2)
    expect(state.workoutTemplates).toHaveLength(1)
  })
})

describe('programma A/B (US-01, US-07)', () => {
  it('import con anteprima, senza toccare lo storico', () => {
    const base = migrateToV3(legacyV2State())
    const { parsed, preview, state } = run(base, PROGRAM)
    expect(parsed.warnings.some((w) => /Full Body B.*incompleta/.test(w.message))).toBe(true)
    expect(preview.summary).toBe('1 programma, 2 schede')
    expect(state.sessions).toEqual(base.sessions)
    expect(state.workoutTemplates.map((t) => t.id)).toEqual(['scheda-a', 'full-body-a', 'full-body-b'])
    // esiste già un programma principale: quello importato non lo sostituisce senza scelta esplicita
    expect(state.programs.find((p) => p.isMain).id).toBe('program-principale')
    const r = run(base, PROGRAM, { setMainProgram: true })
    expect(r.state.programs.find((p) => p.isMain).id).toBe('program-2026-autunno')
  })

  it('seconda importazione: duplicato riconosciuto, mai duplicato in silenzio', () => {
    const once = run(emptyState(), PROGRAM).state
    const parsed = parseImport(JSON.stringify(PROGRAM))
    const preview = previewImport(once, parsed.batch)
    expect(preview.items[0].status).toBe('identical')
    const skipped = applyImport(once, parsed.batch, preview)
    expect(skipped.state.programs).toHaveLength(1)
    expect(skipped.log.skipped).toHaveLength(1)
    const cloned = applyImport(once, parsed.batch, preview, { decisions: { [preview.items[0].key]: 'clone' } })
    expect(cloned.state.programs).toHaveLength(2)
    const copy = cloned.state.programs[1]
    const copyTemplates = cloned.state.workoutTemplates.filter((t) => t.programId === copy.id)
    expect(copyTemplates).toHaveLength(2)
    expect(copy.weeklySchedule.filter((s) => s.templateId).every((s) => copyTemplates.some((t) => t.id === s.templateId))).toBe(true)
  })

  it('aggiornamento esplicito di un programma modificato', () => {
    const once = run(emptyState(), PROGRAM).state
    const changed = { ...PROGRAM, name: 'Ricomposizione v2' }
    const parsed = parseImport(JSON.stringify(changed))
    const preview = previewImport(once, parsed.batch)
    expect(preview.items[0].status).toBe('conflict')
    const upd = applyImport(once, parsed.batch, preview, { decisions: { [preview.items[0].key]: 'update' } })
    expect(upd.state.programs).toHaveLength(1)
    expect(upd.state.programs[0].name).toBe('Ricomposizione v2')
  })
})

describe('validazione', () => {
  it('errori leggibili con percorso', () => {
    const bad = structuredClone(PROGRAM)
    bad.workoutTemplates[0].exercises[0].repMin = 15
    bad.workoutTemplates[0].exercises[0].restSeconds = -5
    const { errors } = parseImport(JSON.stringify(bad))
    const paths = errors.map((e) => e.path)
    expect(paths).toContain('(radice).workoutTemplates[0].exercises[0].repMin')
    expect(paths).toContain('(radice).workoutTemplates[0].exercises[0].restSeconds')
  })
  it('report, versioni future, JSON rotto e tipo ignoto vengono rifiutati', () => {
    expect(parseImport(JSON.stringify({ type: 'palestra-report', schemaVersion: 3 })).errors[0].message).toMatch(/report/)
    expect(parseImport(JSON.stringify({ ...PROGRAM, schemaVersion: 9 })).errors[0].message).toMatch(/più recente/)
    expect(parseImport('{nope').errors[0].message).toMatch(/JSON non valido/)
    expect(parseImport(JSON.stringify({ foo: 1 })).errors[0].message).toMatch(/type/)
  })
  it('import atomico: con errori nessun dato viene prodotto', () => {
    const file = [PROGRAM, { type: 'palestra-body-measurements', measurements: [{ at: 'ieri', weightKg: 75 }] }]
    const { errors, batch } = parseImport(JSON.stringify(file))
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].path).toBe('[1].measurements[0].at')
    expect(batch.programs).toHaveLength(1) // letto ma non applicabile: l'interfaccia blocca l'import
  })
})

describe('misure e dieta', () => {
  it('nuova misura distinta, senza sovrascrivere le precedenti (RF-02)', () => {
    const base = migrateToV3(legacyV2State())
    const { state } = run(base, { type: 'palestra-body-measurements', schemaVersion: 3, measurements: [{ date: '2026-10-22', weightKg: 75, waistCm: 90, abdomenCm: 100 }] })
    expect(state.measurements).toHaveLength(2)
    const m = state.measurements[1]
    expect(m).toMatchObject({ weightKg: 75, waistCm: 90, abdomenCm: 100, source: 'imported' })
  })

  it('piano alimentare: nutrienti assenti restano null, piano non attivato in automatico (US-05)', () => {
    const plan = {
      type: 'palestra-diet-plan',
      schemaVersion: 3,
      id: 'diet-plan-001',
      name: 'Piano alimentare settimanale',
      status: 'draft',
      validFrom: '2026-11-02',
      days: [
        {
          weekday: 1,
          meals: [
            { id: 'breakfast-1', category: 'breakfast', time: '08:00', items: [{ name: 'Yogurt greco', quantity: 170, unit: 'g' }], alternatives: [{ name: 'Latte', quantity: 200, unit: 'ml' }], nutrition: null },
          ],
        },
      ],
    }
    const base = run(emptyState(), plan).state
    expect(base.dietPlans[0].active).toBe(false)
    expect(base.dietPlans[0].days[0].meals[0].nutrition).toBeNull()
    expect(base.dietPlans[0].days[0].meals[0].alternatives[0].items[0].name).toBe('Latte')
    const active = run(emptyState(), plan, { activateDietPlan: true }).state
    expect(active.dietPlans[0].active).toBe(true)
  })
})

describe('roundtrip e report', () => {
  it('backup v3 → import sostitutivo → stessi dati', () => {
    let state = migrateToV3(legacyV2State())
    state = run(state, PROGRAM).state
    const file = exportBackup(state)
    const r = run(emptyState(), file, { mode: 'replace' })
    for (const k of ['programs', 'workoutTemplates', 'sessions', 'measurements', 'dietPlans', 'activeSessionId']) {
      expect(r.state[k]).toEqual(state[k])
    }
  })

  it('export seduta v3 reimportabile', () => {
    const state = migrateToV3(legacyV2State())
    const file = exportSession(state.sessions[0])
    const r = run(emptyState(), file)
    expect(r.state.sessions[0]).toEqual(state.sessions[0])
  })

  it('report: stime nuoto come intervallo, nessun dato inventato', () => {
    const state = {
      ...emptyState(),
      sessions: [{ id: 'swim-2026-10-21', kind: 'swim', date: '2026-10-21', status: 'completed', durationMin: 60, durationSource: 'manual', poolLengthM: 25, plannedDistanceM: 2450, plannedBlocks: [], actualDistanceM: null, estimatedDistanceM: { min: 1500, max: 1800 }, distanceSource: 'estimated', isPartial: true }],
    }
    const period = { from: '2026-10-20', to: '2026-10-22' }
    const rep = buildReport(state, period)
    expect(rep.type).toBe('palestra-report')
    expect(rep.summary.swim.measuredM).toBeNull()
    expect(rep.summary.swim.estimatedM).toEqual({ min: 1500, max: 1800 })
    expect(rep.dataQuality).toMatchObject({ swimDistance: 'estimated', energyExpenditure: 'not_provided' })
    const csv = reportToCSV(state, period)
    expect(csv).toContain('2026-10-21,swim,distance,,1500,1800,m,estimated,estimated')
    expect(csv).toContain('2026-10-21,swim,planned_distance,2450,,,m,planned')
  })
})

describe('percorso degli errori sulle misure', () => {
  it('data non valida segnalata sul campo "date" presente nel file', () => {
    const { errors } = parseImport(JSON.stringify({ type: 'palestra-body-measurements', measurements: [{ date: '2026-13-40', time: '25:00', weightKg: -3 }] }))
    expect(errors.map((e) => e.path)).toEqual(['measurements[0].date', 'measurements[0].time', 'measurements[0].weightKg'])
  })
})
