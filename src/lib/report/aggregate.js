// Aggregazioni per periodo: unica fonte per la dashboard Progressi e per i report esportati.
import { strengthStats, sessionDuration, personalRecords } from '../stats'
import { swimDistances } from '../swim'
import { scheduleAdherence } from '../calendar'
import { addDays } from '../dates'

const inPeriod = (date, { from, to }) => date >= from && date <= to
const counted = (s) => ['completed', 'in_progress'].includes(s.status)
const sum = (arr) => arr.reduce((a, b) => a + b, 0)
const avg = (arr) => (arr.length ? sum(arr) / arr.length : null)

export function periodSessions(state, period) {
  return state.sessions.filter((s) => inPeriod(s.date, period) && counted(s)).sort((a, b) => a.date.localeCompare(b.date))
}

function minutes(list) {
  const d = list.map((s) => sessionDuration(s).min)
  const known = d.filter((x) => x != null)
  // null = nessuna durata registrata (diverso da 0 minuti)
  return { value: known.length ? sum(known) : list.length ? null : 0, missing: d.length - known.length }
}

export function aggregateTraining(state, period) {
  const sessions = periodSessions(state, period)
  const strength = sessions.filter((s) => s.kind === 'strength')
  const swim = sessions.filter((s) => s.kind === 'swim')
  return {
    strengthSessions: strength.length,
    swimSessions: swim.length,
    strengthMinutes: minutes(strength),
    swimMinutes: minutes(swim),
    daysTrained: new Set(sessions.map((s) => s.date)).size,
    adherence: scheduleAdherence(state, period.from, period.to),
  }
}

export function aggregateStrength(state, period) {
  const list = periodSessions(state, period).filter((s) => s.kind === 'strength')
  const st = list.map(strengthStats)
  const rirs = list.flatMap((s) => s.exercises.flatMap((e) => e.sets.filter((x) => x.done && x.rir != null).map((x) => x.rir)))
  return {
    sessions: list.length,
    sets: sum(st.map((x) => x.sets)),
    reps: sum(st.map((x) => x.reps)),
    volumeKg: sum(st.map((x) => x.volume)),
    volumePartial: st.some((x) => x.volumePartial),
    timeSets: sum(st.map((x) => x.timeSets)),
    timeSeconds: sum(st.map((x) => x.timeSeconds)),
    treadmillMin: sum(st.map((x) => x.cardioMin)),
    treadmillKm: sum(st.map((x) => x.cardioKm)),
    avgRir: avg(rirs),
    rirSamples: rirs.length,
    newRecords: personalRecords(state.sessions, period).newInPeriod,
  }
}

export function aggregateSwim(state, period) {
  const list = periodSessions(state, period).filter((s) => s.kind === 'swim')
  const d = list.map(swimDistances)
  const measured = d.filter((x) => x.measured != null)
  const estimated = d.filter((x) => x.estimated)
  const tech = (k) => avg(list.map((s) => s.technique?.[k]).filter((x) => x != null))
  return {
    sessions: list.length,
    minutes: minutes(list),
    measuredM: measured.length ? sum(measured.map((x) => x.measured)) : null,
    measuredSessions: measured.length,
    // Le stime restano un intervallo e non vengono sommate ai valori misurati
    estimatedM: estimated.length ? { min: sum(estimated.map((x) => x.estimated.min)), max: sum(estimated.map((x) => x.estimated.max)) } : null,
    estimatedSessions: estimated.length,
    unknownSessions: d.filter((x) => x.quality === 'unknown').length,
    plannedM: d.some((x) => x.planned != null) ? sum(d.map((x) => x.planned ?? 0)) : null,
    partialSessions: d.filter((x) => x.isPartial).length,
    technique: { catch: tech('catch'), strokeQuality: tech('strokeQuality'), shoulderFatigue: tech('shoulderFatigue'), breathing: tech('breathing') },
    quality: measured.length && estimated.length ? 'mixed' : measured.length ? 'measured' : estimated.length ? 'estimated' : 'none',
  }
}

// Media mobile a 7 giorni del peso: solo dove ci sono almeno 2 misure nella finestra
export function weightSeries(measurements) {
  const pts = measurements
    .filter((m) => m.weightKg != null)
    .map((m) => ({ date: m.at.slice(0, 10), at: m.at, value: m.weightKg }))
    .sort((a, b) => a.at.localeCompare(b.at))
  return pts.map((p) => {
    const win = pts.filter((q) => q.date <= p.date && q.date > addDays(p.date, -7))
    return { ...p, avg7: win.length >= 2 ? avg(win.map((q) => q.value)) : null }
  })
}

export function measurementSeries(measurements, key) {
  return measurements
    .filter((m) => m[key] != null)
    .map((m) => ({ date: m.at.slice(0, 10), at: m.at, value: m[key] }))
    .sort((a, b) => a.at.localeCompare(b.at))
}

export function aggregateBody(state, period) {
  const list = state.measurements.filter((m) => inPeriod(m.at.slice(0, 10), period))
  const stat = (key) => {
    const s = measurementSeries(list, key)
    if (!s.length) return null
    const vals = s.map((x) => x.value)
    return { samples: s.length, first: s[0], last: s[s.length - 1], delta: s.length > 1 ? s[s.length - 1].value - s[0].value : null, min: Math.min(...vals), max: Math.max(...vals) }
  }
  const ws = weightSeries(state.measurements).filter((p) => inPeriod(p.date, period))
  return {
    measurements: list.length,
    weight: stat('weightKg'),
    weightAvg7Last: ws.length ? ws[ws.length - 1].avg7 : null,
    waist: stat('waistCm'),
    abdomen: stat('abdomenCm'),
    hips: stat('hipsCm'),
    chest: stat('chestCm'),
    arm: stat('armCm'),
  }
}

// kcal/macro del piano: sommati solo se presenti per tutti i pasti del giorno, altrimenti "parziale"
export function dayNutrition(day) {
  const keys = ['kcal', 'proteinG', 'carbsG', 'fatG']
  const out = {}
  for (const k of keys) {
    const vals = day.meals.map((m) => m.nutrition?.[k])
    const known = vals.filter((x) => x != null)
    out[k] = { value: known.length ? sum(known) : null, partial: known.length > 0 && known.length < vals.length, missing: known.length === 0 }
  }
  return out
}

export function aggregateDiet(state, period) {
  const plan = state.dietPlans.find((d) => d.active && !d.archived) ?? null
  const log = state.dietLog.filter((l) => inPeriod(l.date, period))
  const byStatus = (s) => log.filter((l) => l.status === s).length
  return {
    activePlan: plan ? { id: plan.id, name: plan.name, status: plan.status, revision: plan.revision, validatedBy: plan.validatedBy || null } : null,
    programmed: plan
      ? plan.days.map((d) => ({ weekday: d.weekday, date: d.date, dayType: d.dayType, label: d.label, ...dayNutrition(d) }))
      : [],
    adherence: log.length ? { logged: log.length, followed: byStatus('followed'), modified: byStatus('modified'), skipped: byStatus('skipped') } : null,
  }
}

export function aggregateEnergy(state, period) {
  const list = periodSessions(state, period)
  const withE = list.filter((s) => s.energy?.activeKcal || s.energy?.totalKcal)
  const range = (k) => {
    const r = withE.map((s) => s.energy[k]).filter(Boolean)
    return r.length ? { min: sum(r.map((x) => x.min)), max: sum(r.map((x) => x.max)) } : null
  }
  return {
    sessionsWithValue: withE.length,
    sessionsWithout: list.length - withE.length,
    activeKcal: range('activeKcal'),
    totalKcal: range('totalKcal'),
    sources: [...new Set(withE.map((s) => s.energy.source))],
    methods: [...new Set(withE.map((s) => s.energy.method).filter(Boolean))],
  }
}

export function aggregateAll(state, period) {
  return {
    training: aggregateTraining(state, period),
    strength: aggregateStrength(state, period),
    swim: aggregateSwim(state, period),
    body: aggregateBody(state, period),
    diet: aggregateDiet(state, period),
    energy: aggregateEnergy(state, period),
  }
}
