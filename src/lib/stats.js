import { minutesBetween } from './dates'
export { fmtDate } from './dates'

// ---- Sala pesi ----

export function cardioMinutes(session, { onlyDone = true } = {}) {
  return [...(session.warmup ?? []), ...(session.cooldown ?? [])]
    .filter((c) => !onlyDone || c.done)
    .reduce((a, c) => a + (Number(c.minutes) || 0), 0)
}

// Volume = somma reps effettive × carico effettivo (× 2 se per mano), solo serie completate con carico noto
export function strengthStats(session) {
  const r = { sets: 0, reps: 0, volume: 0, volumePartial: false, timeSets: 0, timeSeconds: 0, totalSets: 0, doneSets: 0, cardioMin: 0, cardioKm: 0 }
  for (const ex of session.exercises ?? []) {
    for (const s of ex.sets) {
      r.totalSets++
      if (!s.done) continue
      r.doneSets++
      if (ex.type === 'time') {
        r.timeSets++
        r.timeSeconds += Number(s.durationSec) || 0
        continue
      }
      r.sets++
      r.reps += Number(s.reps) || 0
      if (s.weight == null || s.reps == null) r.volumePartial = true
      else r.volume += s.reps * s.weight * (ex.perHand ? 2 : 1)
    }
  }
  for (const c of [...(session.warmup ?? []), ...(session.cooldown ?? [])]) {
    if (!c.done) continue
    const m = Number(c.minutes) || 0
    r.cardioMin += m
    r.cardioKm += (m / 60) * (Number(c.speed) || 0)
  }
  return r
}

// Compatibilità con i componenti esistenti
export const sessionStats = strengthStats

export function hasPendingSets(session) {
  return (session.exercises ?? []).some((ex) => ex.sets.some((s) => !s.done))
}

// ---- Durata ----
// Preferisce fine − inizio se coerenti; una durata manuale prevale ma l'eventuale differenza viene segnalata.
export function sessionDuration(s) {
  const computed = minutesBetween(s.startedAt, s.endedAt)
  const validComputed = computed != null && computed > 0 && computed < 24 * 60 ? computed : null
  if (s.durationSource === 'manual' && s.durationMin != null) {
    return { min: s.durationMin, source: 'manual', computed: validComputed, mismatch: validComputed != null && Math.abs(validComputed - s.durationMin) > 5 }
  }
  if (validComputed != null) return { min: validComputed, source: 'computed', computed: validComputed, mismatch: false }
  if (s.durationMin != null) return { min: s.durationMin, source: s.durationSource ?? 'legacy', computed: null, mismatch: false }
  return { min: null, source: null, computed: null, mismatch: false }
}

export const DURATION_SOURCES = {
  computed: 'da orari inizio/fine',
  manual: 'inserita a mano',
  stopwatch: 'da cronometro',
  legacy: 'versione precedente',
}

// ---- Progressione e record ----

// Chiave di confrontabilità: stesso esercizio (stessa macchina/movimento) e stessa modalità di carico
export const comparableKey = (ex) => `${ex.exerciseId ?? ex.name}|${ex.equipment ?? ''}|${ex.perHand ? 'mano' : ''}`

export function progressionHint(prev, step) {
  if (!prev) return null
  const done = prev.exercise.sets.filter((s) => s.done && s.reps != null)
  if (!done.length || prev.exercise.type === 'time') return null
  const repMax = done[0].target?.repMax
  const allTop = repMax != null && done.every((s) => s.reps >= repMax)
  const rirs = done.map((s) => s.rir).filter((x) => x != null)
  const easy = rirs.length ? Math.min(...rirs) >= 2 : null
  const weights = [...new Set(done.map((s) => s.weight))].join('/')
  const base = `Ultima volta (${prev.date}): ${done.length}×${[...new Set(done.map((s) => s.reps))].join('/')} a ${weights} kg${rirs.length ? `, RIR ${rirs.join('/')}` : ''}`
  if (allTop && easy !== false) {
    return `${base}. Hai raggiunto il massimo del range: valuta un incremento minimo${step ? ` (+${String(step).replace('.', ',')} kg)` : ''}.`
  }
  return base
}

// Miglior carico per esercizio confrontabile (solo serie completate con carico noto)
export function personalRecords(sessions, { from, to } = {}) {
  const best = new Map()
  const sorted = sessions.filter((s) => s.kind === 'strength').sort((a, b) => a.date.localeCompare(b.date))
  for (const s of sorted) {
    for (const ex of s.exercises) {
      if (ex.type === 'time') continue
      for (const st of ex.sets) {
        if (!st.done || st.weight == null || st.reps == null || st.weight <= 0) continue
        const k = comparableKey(ex)
        const cur = best.get(k)
        const better = !cur || st.weight > cur.weight || (st.weight === cur.weight && st.reps > cur.reps)
        if (better) {
          const prevBest = cur ? { weight: cur.weight, reps: cur.reps, date: cur.date } : null
          best.set(k, { key: k, name: ex.name, perHand: ex.perHand, weight: st.weight, reps: st.reps, date: s.date, prevBest })
        }
      }
    }
  }
  const all = [...best.values()]
  return {
    all,
    newInPeriod: from ? all.filter((r) => r.date >= from && r.date <= to && r.prevBest) : [],
  }
}

// Serie storica di un esercizio confrontabile
export function exerciseHistory(sessions, key) {
  const out = []
  for (const s of sessions.filter((x) => x.kind === 'strength').sort((a, b) => a.date.localeCompare(b.date))) {
    for (const ex of s.exercises) {
      if (comparableKey(ex) !== key) continue
      const done = ex.sets.filter((st) => st.done)
      if (!done.length) continue
      const weights = done.map((st) => st.weight).filter((w) => w != null)
      const rirs = done.map((st) => st.rir).filter((x) => x != null)
      out.push({
        date: s.date,
        maxWeight: weights.length ? Math.max(...weights) : null,
        reps: done.map((st) => st.reps ?? st.durationSec),
        totalReps: done.reduce((a, st) => a + (st.reps ?? 0), 0),
        avgRir: rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null,
      })
    }
  }
  return out
}

// ---- Formattazione ----

const nf = (d) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: d })

export function fmtNum(n, digits = 1) {
  return n == null || Number.isNaN(n) ? 'ND' : nf(digits).format(n)
}

export function fmtRange(r, digits = 0, unit = '') {
  if (!r) return 'ND'
  const u = unit ? ` ${unit}` : ''
  return r.min === r.max ? `${fmtNum(r.min, digits)}${u}` : `${fmtNum(r.min, digits)}–${fmtNum(r.max, digits)}${u}`
}

export function fmtMinutes(min) {
  if (min == null) return 'ND'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? `${h} h ${m} min` : `${m} min`
}

export function fmtClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}
