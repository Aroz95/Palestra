// P1-04: un test per ciascun KPI con input e valore atteso calcolati a mano.
import { describe, expect, it } from 'vitest'
import { emptyState } from '../src/schema/factories'
import { aggregateAll } from '../src/lib/report/aggregate'
import { buildReport, reportToCSV, csvCell, CSV_DIALECTS } from '../src/lib/report'

const set = (reps, weight, done, rir = null, extra = {}) => ({ reps, weight, done, rir, target: null, rpe: null, pain: null, note: '', at: null, ...extra })
const tset = (durationSec, done) => ({ durationSec, done, target: null, rpe: null, pain: null, note: '', at: null })
const ex = (exerciseId, sets, extra = {}) => ({ id: exerciseId + Math.random(), exerciseId, name: exerciseId, group: '', type: 'reps', equipment: 'machine', perHand: false, step: 2.5, rest: 60, notes: '', target: null, sets, ...extra })
const strength = (id, date, exercises, extra = {}) => ({
  id, kind: 'strength', date, title: id, status: 'completed', startedAt: null, endedAt: null, durationMin: null, durationSource: null, note: '', feedback: {}, energy: null, warmup: [], cooldown: [], exercises, ...extra,
})
const swim = (id, date, extra) => ({ id, kind: 'swim', date, title: id, status: 'completed', durationMin: 60, durationSource: 'manual', poolLengthM: 25, plannedBlocks: [], technique: {}, notes: '', feedback: {}, energy: null, ...extra })

const s1 = strength(
  's1',
  '2026-10-05',
  [
    ex('leg-press', [set(10, 60, true, 2, { note: 'NOTA-SERIE-PRIVATA', pain: { location: 'ginocchio', intensity: 2 } }), set(8, 60, true, 3), set(10, 60, false)]),
    ex('curl', [set(10, 8, true)], { perHand: true, equipment: 'dumbbell' }),
    ex('plank', [tset(30, true), tset(30, false)], { type: 'time', equipment: 'bodyweight' }),
  ],
  {
    startedAt: '2026-10-05T18:00:00+02:00',
    endedAt: '2026-10-05T19:00:00+02:00',
    note: 'NOTA-PRIVATA-1',
    feedback: { fatigue: 7, energy: 3, technique: 4, pain: 'DOLORE-PRIVATO', notes: 'FEEDBACK-PRIVATO', nextDayRecovery: null },
    warmup: [{ id: 'w', name: 'Tapis roulant', minutes: 10, speed: 6, done: true, note: '' }],
    cooldown: [{ id: 'c', name: 'Tapis roulant', minutes: 5, speed: 5, done: false, note: '' }],
    energy: { source: 'estimate', method: '=cmd|calc', activeKcal: { min: 200, max: 300 }, totalKcal: { min: 300, max: 400 } },
  },
)
const s2 = strength('s2', '2026-10-20', [ex('leg-press', [set(10, 65, true)])], { durationMin: 45, durationSource: 'manual' })
const before = strength('s0', '2026-09-30', [ex('leg-press', [set(10, 55, true)])], { durationMin: 50 })
const skipped = strength('s4', '2026-10-31', [ex('leg-press', [set(10, 200, true)])], { status: 'skipped', durationMin: 30 })
const after = strength('s5', '2026-11-01', [ex('leg-press', [set(10, 300, true)])], { durationMin: 30 })
const w1 = swim('w1', '2026-10-10', { durationMin: 40, plannedDistanceM: 1500, actualDistanceM: 1200, distanceSource: 'measured', estimatedDistanceM: null, isPartial: false, technique: { catch: 4, strokeQuality: 3 } })
const w2 = swim('w2', '2026-10-21', {
  plannedDistanceM: 2450, actualDistanceM: null, estimatedDistanceM: { min: 1500, max: 1800 }, distanceSource: 'estimated', isPartial: true, technique: { catch: 2 },
  energy: { source: 'device', method: 'dispositivo', activeKcal: { min: 400, max: 400 }, totalKcal: { min: 500, max: 500 } },
})
const m = (at, v) => ({ id: at, at, weightKg: null, waistCm: null, abdomenCm: null, hipsCm: null, chestCm: null, armCm: null, notes: 'MISURA-PRIVATA', source: 'manual', ...v })

const state = {
  ...emptyState(),
  sessions: [s1, s2, before, skipped, after, w1, w2],
  measurements: [m('2026-10-01T08:00:00+02:00', { weightKg: 76, waistCm: 91 }), m('2026-10-04T08:00:00+02:00', { weightKg: 75.5 }), m('2026-10-30T12:00:00Z', { weightKg: 75, abdomenCm: 100 }), m('2026-11-02T08:00:00+01:00', { weightKg: 74 })],
  dietPlans: [
    {
      id: 'p', name: 'Piano', status: 'validated', validatedBy: 'Dott. PRIVATO', active: true, archived: false, revision: 1, history: [],
      days: [{ id: 'd1', weekday: 1, date: null, dayType: 'any', label: '', meals: [{ id: 'a', nutrition: { kcal: 400, proteinG: 30, carbsG: null, fatG: null } }, { id: 'b', nutrition: null }] }],
    },
  ],
  dietLog: [
    { id: '1', date: '2026-10-05', planId: 'p', mealId: 'a', status: 'followed' },
    { id: '2', date: '2026-10-06', planId: 'p', mealId: 'b', status: 'skipped' },
    { id: '3', date: '2026-09-30', planId: 'p', mealId: 'a', status: 'followed' },
  ],
}
const period = { from: '2026-10-01', to: '2026-10-31' }
const a = aggregateAll(state, period)

describe('KPI per periodo (confini inclusi, sedute saltate e fuori periodo escluse)', () => {
  it('frequenza e minuti', () => {
    expect(a.training).toMatchObject({ strengthSessions: 2, swimSessions: 2, daysTrained: 4 })
    expect(a.training.strengthMinutes).toEqual({ value: 105, missing: 0 }) // 60 da orari + 45 manuali
    expect(a.training.swimMinutes).toEqual({ value: 100, missing: 0 })
    expect(a.training.adherence).toEqual({ planned: 0, completed: 0, ratio: null })
  })
  it('sala pesi: solo serie completate, per mano ×2, a tempo escluse dalle ripetizioni', () => {
    expect(a.strength).toMatchObject({ sets: 4, reps: 38, volumeKg: 1890, volumePartial: false, timeSets: 1, timeSeconds: 30, treadmillMin: 10, treadmillKm: 1, avgRir: 2.5, rirSamples: 2 })
    // 65 kg (20/10) migliora i 60 kg del 05/10; i 60 kg migliorano i 55 del 30/09. Nel periodo: da 55 a 65.
    // Le sedute saltate (200 kg) non contano; quelle dopo il periodo (300 kg) non cancellano il record del periodo.
    expect(a.strength.newRecords.map((r) => [r.weight, r.prevBest.weight])).toEqual([[65, 55]])
  })
  it('nuoto: misurato e stimato separati, previsto mai contato come svolto', () => {
    expect(a.swim).toMatchObject({ sessions: 2, measuredM: 1200, measuredSessions: 1, estimatedM: { min: 1500, max: 1800 }, estimatedSessions: 1, plannedM: 3950, partialSessions: 1, quality: 'mixed' })
    expect(a.swim.technique).toEqual({ catch: 3, strokeQuality: 3, shoulderFatigue: null, breathing: null })
  })
  it('misure: peso, girovita e addome distinti; media 7 giorni solo con ≥ 2 campioni', () => {
    expect(a.body.measurements).toBe(3)
    expect(a.body.weight).toMatchObject({ samples: 3, delta: -1, min: 75, max: 76 })
    expect(a.body.waist).toMatchObject({ samples: 1, delta: null })
    expect(a.body.abdomen.last.value).toBe(100)
    expect(a.body.weightAvg7Last).toBeNull()
  })
  it('alimentazione: macro sommati solo se dichiarati, aderenza solo se registrata', () => {
    expect(a.diet.programmed[0].kcal).toEqual({ value: 400, partial: true, missing: false })
    expect(a.diet.programmed[0].carbsG).toEqual({ value: null, partial: false, missing: true })
    expect(a.diet.adherence).toEqual({ logged: 2, followed: 1, modified: 0, skipped: 1 })
  })
  it('energia: attive e totali separate, sedute senza valore non stimate', () => {
    expect(a.energy).toMatchObject({ sessionsWithValue: 2, sessionsWithout: 2, activeKcal: { min: 600, max: 700 }, totalKcal: { min: 800, max: 900 } })
    expect([...a.energy.sources].sort()).toEqual(['device', 'estimate'])
  })
  it('periodo personalizzato di un giorno', () => {
    const one = aggregateAll(state, { from: '2026-10-20', to: '2026-10-20' })
    expect(one.training.strengthSessions).toBe(1)
    expect(one.strength.volumeKg).toBe(650)
  })
})

describe('report coerente con la dashboard e rispettoso della privacy', () => {
  it('summary del report = aggregati mostrati in Progressi', () => {
    const rep = buildReport(state, period, { excludeNotes: false })
    for (const k of ['training', 'strength', 'swim', 'body', 'energy']) expect(rep.summary[k]).toEqual(JSON.parse(JSON.stringify(a[k])))
    expect(rep.dataQuality).toMatchObject({ swimDistance: 'mixed', strengthVolume: 'nominal', durations: 'complete' })
  })
  it('“Escludi note” rimuove note, dolore, misure e validatore dal report dettagliato', () => {
    const txt = JSON.stringify(buildReport(state, period, { detail: 'detailed', excludeNotes: true }))
    for (const secret of ['NOTA-PRIVATA-1', 'DOLORE-PRIVATO', 'FEEDBACK-PRIVATO', 'MISURA-PRIVATA', 'NOTA-SERIE-PRIVATA', 'Dott. PRIVATO', 'ginocchio']) expect(txt).not.toContain(secret)
    const open = JSON.stringify(buildReport(state, period, { detail: 'detailed', excludeNotes: false }))
    expect(open).toContain('NOTA-PRIVATA-1')
  })
})

describe('CSV', () => {
  it('formule neutralizzate, separatori e virgolette gestiti', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('+39 333')).toBe("'+39 333")
    expect(csvCell('@cmd')).toBe("'@cmd")
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('detto "x"')).toBe('"detto ""x"""')
    expect(csvCell(-1)).toBe('-1') // i numeri negativi restano numeri
    expect(csvCell(75.5, CSV_DIALECTS.excel)).toBe('75,5')
  })
  it('dialetto Excel italiano: ";" e virgola decimale; accenti preservati', () => {
    const csv = reportToCSV(state, period, { dialect: 'excel' })
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('date;section;metric;value;min;max;unit;quality;source')
    expect(csv).toContain('2026-10-10;swim;distance;1200;;;m;measured;measured')
    expect(csv).toContain('2026-10-21;swim;distance;;1500;1800;m;estimated;estimated')
    expect(csv).toContain('2026-10-04;body;weight;75,5;;;kg;measured;')
    expect(csv).toContain("'=cmd|calc") // metodo importato da file: neutralizzato
  })
  it('dialetto standard', () => {
    const csv = reportToCSV(state, period, { dialect: 'standard' })
    expect(csv).toContain('2026-10-04,body,weight,75.5,,,kg,measured,')
    expect(csv).not.toContain('2026-11-01') // fuori periodo
    expect(csv).not.toContain('2026-10-31,strength') // seduta saltata
  })
})
