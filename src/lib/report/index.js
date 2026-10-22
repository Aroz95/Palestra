// Report riepilogativi (JSON/CSV) ed esportazioni tipizzate.
// Un report NON è un backup: non contiene dati ripristinabili.
import { aggregateAll, periodSessions, weightSeries, measurementSeries } from './aggregate'
import { strengthStats, sessionDuration } from '../stats'
import { swimDistances } from '../swim'
import { toLocalISO, todayISO, localDate } from '../dates'
import { FILE_TYPES, SCHEMA_VERSION } from '../../schema/constants'
import { clone } from '../../schema/factories'

export const REPORT_SECTIONS = {
  training: 'Frequenza e minuti',
  strength: 'Sala pesi',
  swim: 'Nuoto',
  body: 'Misure corporee',
  diet: 'Alimentazione',
  energy: 'Dispendio energetico (stime)',
}

const UNITS = { weight: 'kg', length: 'cm', distance: 'm', duration: 'min', energy: 'kcal' }

function dataQuality(agg) {
  return {
    swimDistance: agg.swim.quality,
    energyExpenditure: agg.energy.sessionsWithValue ? (agg.energy.sources.includes('estimate') ? 'estimated' : 'device') : 'not_provided',
    strengthVolume: agg.strength.volumePartial ? 'partial' : 'nominal',
    durations: agg.training.strengthMinutes.missing + agg.training.swimMinutes.missing ? 'partial' : 'complete',
  }
}

function sessionDetail(s, excludeNotes) {
  const d = sessionDuration(s)
  const base = { id: s.id, kind: s.kind, date: s.date, title: s.title, status: s.status, durationMin: d.min, durationSource: d.source }
  if (s.kind === 'swim') {
    const sw = swimDistances(s)
    Object.assign(base, {
      poolLengthM: s.poolLengthM,
      plannedDistanceM: sw.planned,
      actualDistanceM: sw.measured,
      estimatedDistanceM: sw.estimated,
      distanceSource: s.distanceSource,
      isPartial: s.isPartial,
      rpe: s.rpe,
    })
  } else {
    const st = strengthStats(s)
    Object.assign(base, {
      templateId: s.templateId ?? null,
      templateRevision: s.templateRevision ?? null,
      sets: st.sets,
      reps: st.reps,
      volumeKg: st.volume,
      exercises: s.exercises.map((e) => ({
        name: e.name,
        perHand: e.perHand,
        sets: e.sets.filter((x) => x.done).map((x) => (e.type === 'time' ? { durationSec: x.durationSec } : { reps: x.reps, weightKg: x.weight, rir: x.rir ?? null })),
      })),
    })
  }
  base.energy = s.energy ?? null
  if (!excludeNotes) {
    base.note = s.note || null
    base.feedback = s.feedback ?? null
  } else if (s.feedback) {
    base.feedback = { fatigue: s.feedback.fatigue, energy: s.feedback.energy, technique: s.feedback.technique }
  }
  return base
}

export function buildReport(state, period, { sections = Object.keys(REPORT_SECTIONS), detail = 'summary', excludeNotes = true } = {}) {
  const agg = aggregateAll(state, period)
  const summary = {}
  for (const k of sections) summary[k] = clone(agg[k])
  if (summary.diet?.activePlan && excludeNotes) delete summary.diet.activePlan.validatedBy
  const report = {
    type: FILE_TYPES.report,
    schemaVersion: SCHEMA_VERSION,
    generatedAt: toLocalISO(),
    period,
    units: UNITS,
    filters: { sections, detail, excludeNotes },
    summary,
    dataQuality: dataQuality(agg),
    notes: [
      'Report riepilogativo: non è un backup e non può essere reimportato.',
      'Volume pesi nominale (ripetizioni × carico, manubri ×2): indicativo, non confrontabile tra macchine diverse.',
      'Le distanze di nuoto stimate sono riportate come intervallo e non sono sommate a quelle misurate.',
      'Le calorie, se presenti, sono stime con metodo dichiarato o valori da dispositivo; null = non disponibile.',
    ],
  }
  if (detail === 'detailed') {
    report.details = {}
    if (sections.some((k) => ['training', 'strength', 'swim', 'energy'].includes(k))) {
      report.details.sessions = periodSessions(state, period)
        .filter((s) => (s.kind === 'swim' ? sections.includes('swim') || sections.includes('training') : sections.includes('strength') || sections.includes('training')))
        .map((s) => sessionDetail(s, excludeNotes))
    }
    if (sections.includes('body')) {
      report.details.measurements = state.measurements
        .filter((m) => localDate(m.at) >= period.from && localDate(m.at) <= period.to)
        .map(({ notes, ...m }) => (excludeNotes ? m : { ...m, notes }))
    }
  }
  return report
}

// ---- CSV: una riga per valore, con unità e indicatori di stima ----

const CSV_HEADER = ['date', 'section', 'metric', 'value', 'min', 'max', 'unit', 'quality', 'source']

// Dialetti: 'excel' (Excel/Numbers in italiano: separatore ";" e virgola decimale) o 'standard' ("," e punto)
export const CSV_DIALECTS = {
  excel: { sep: ';', decimal: ',', label: 'Excel / Numbers (italiano)' },
  standard: { sep: ',', decimal: '.', label: 'CSV standard' },
}

export function csvCell(v, dialect = CSV_DIALECTS.standard) {
  if (v === null || v === undefined) return ''
  let s
  if (typeof v === 'number') {
    s = String(Math.round(v * 100) / 100).replace('.', dialect.decimal)
  } else {
    s = String(v)
    // Testo che Excel/Numbers interpreterebbero come formula: neutralizzato con un apostrofo
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  }
  return s.includes(dialect.sep) || /["\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function reportToCSV(state, period, { sections = Object.keys(REPORT_SECTIONS), dialect = 'standard' } = {}) {
  const fmt = CSV_DIALECTS[dialect] ?? CSV_DIALECTS.standard
  const rows = []
  const row = (date, section, metric, value, unit, quality = 'measured', source = '', min = null, max = null) =>
    rows.push([date, section, metric, value, min, max, unit, quality, source])
  const sessions = periodSessions(state, period)

  for (const s of sessions) {
    const d = sessionDuration(s)
    if (s.kind === 'strength' && (sections.includes('strength') || sections.includes('training'))) {
      const st = strengthStats(s)
      row(s.date, 'strength', 'duration', d.min, 'min', d.min == null ? 'missing' : 'measured', d.source ?? '')
      row(s.date, 'strength', 'sets', st.sets, 'count')
      row(s.date, 'strength', 'reps', st.reps, 'count')
      row(s.date, 'strength', 'volume', st.volume, 'kg', st.volumePartial ? 'partial' : 'nominal')
      if (st.cardioMin) row(s.date, 'strength', 'treadmill_distance', st.cardioKm * 1000, 'm', 'computed', 'speed×time')
    }
    if (s.kind === 'swim' && (sections.includes('swim') || sections.includes('training'))) {
      const sw = swimDistances(s)
      row(s.date, 'swim', 'duration', d.min, 'min', d.min == null ? 'missing' : 'measured', d.source ?? '')
      row(s.date, 'swim', 'planned_distance', sw.planned, 'm', 'planned')
      if (sw.measured != null) row(s.date, 'swim', 'distance', sw.measured, 'm', 'measured', s.distanceSource)
      if (sw.estimated) row(s.date, 'swim', 'distance', null, 'm', 'estimated', s.distanceSource, sw.estimated.min, sw.estimated.max)
    }
    if (sections.includes('energy') && s.energy) {
      const e = s.energy
      const q = e.source === 'estimate' ? 'estimated' : 'device'
      if (e.activeKcal) row(s.date, 'energy', 'active_kcal', null, 'kcal', q, e.method || e.source, e.activeKcal.min, e.activeKcal.max)
      if (e.totalKcal) row(s.date, 'energy', 'total_kcal', null, 'kcal', q, e.method || e.source, e.totalKcal.min, e.totalKcal.max)
    }
  }
  if (sections.includes('body')) {
    const inP = (p) => p.date >= period.from && p.date <= period.to
    for (const p of weightSeries(state.measurements).filter(inP)) {
      row(p.date, 'body', 'weight', p.value, 'kg')
      if (p.avg7 != null) row(p.date, 'body', 'weight_avg7', p.avg7, 'kg', 'computed', 'media mobile 7 giorni')
    }
    for (const [key, metric] of [['waistCm', 'waist'], ['abdomenCm', 'abdomen'], ['hipsCm', 'hips'], ['chestCm', 'chest'], ['armCm', 'arm']]) {
      for (const p of measurementSeries(state.measurements, key).filter(inP)) row(p.date, 'body', metric, p.value, 'cm')
    }
  }
  if (sections.includes('diet')) {
    for (const l of state.dietLog.filter((x) => x.date >= period.from && x.date <= period.to)) {
      row(l.date, 'diet', `meal_${l.mealId}`, l.status, 'status', 'recorded')
    }
  }
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  return [CSV_HEADER, ...rows].map((r) => r.map((c) => csvCell(c, fmt)).join(fmt.sep)).join('\r\n')
}

// ---- Esportazioni tipizzate (ripristinabili) ----

const meta = (type) => ({ type, schemaVersion: SCHEMA_VERSION, generatedAt: toLocalISO() })

export function exportBackup(state) {
  return { ...meta(FILE_TYPES.backup), ...clone(state), schemaVersion: SCHEMA_VERSION }
}

export function exportProgram(state, programId) {
  const program = state.programs.find((p) => p.id === programId)
  return { ...meta(FILE_TYPES.program), ...clone(program), workoutTemplates: clone(state.workoutTemplates.filter((t) => t.programId === programId)) }
}

export function exportSession(session) {
  if (session.kind === 'swim') return { ...meta(FILE_TYPES.swim), ...clone(session) }
  const st = strengthStats(session)
  // summary solo informativo: in import viene ignorato e ricalcolato
  return {
    ...meta(FILE_TYPES.strength),
    summary: { sets: st.sets, reps: st.reps, volumeKg: Math.round(st.volume), timeSets: st.timeSets, timeSeconds: st.timeSeconds, durationMin: sessionDuration(session).min },
    session: clone(session),
  }
}

export function exportDietPlan(plan) {
  const { active, ...p } = clone(plan)
  return { ...meta(FILE_TYPES.diet), ...p }
}

export function exportMeasurements(state) {
  return { ...meta(FILE_TYPES.measurements), units: { weight: 'kg', length: 'cm' }, measurements: clone(state.measurements) }
}

const safe = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

export const fileNames = {
  backup: () => `palestra-backup-${todayISO()}.json`,
  program: (p) => `palestra-program-${safe(p.name || p.id)}-${todayISO()}.json`,
  session: (s) => (s.kind === 'swim' ? `palestra-swim-session-${s.date}.json` : `palestra-seduta-${s.date}.json`),
  diet: (d) => `palestra-diet-plan-${safe(d.name || d.id)}-${todayISO()}.json`,
  measurements: () => `palestra-body-measurements-${todayISO()}.json`,
  report: (period, ext) => `palestra-report-${period.from}_${period.to}.${ext}`,
}
