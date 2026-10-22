export function sessionStats(session, { onlyDone = true } = {}) {
  let sets = 0
  let reps = 0
  let volume = 0
  let timeSets = 0
  let timeSeconds = 0
  let totalSets = 0
  let doneSets = 0

  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      totalSets++
      if (s.done) doneSets++
      if (onlyDone && !s.done) continue
      if (ex.type === 'time') {
        timeSets++
        timeSeconds += Number(s.reps) || 0
      } else {
        sets++
        reps += Number(s.reps) || 0
        volume += (Number(s.reps) || 0) * (Number(s.weight) || 0) * (ex.perHand ? 2 : 1)
      }
    }
  }

  let cardioMin = 0
  let cardioKm = 0
  for (const c of [...session.warmup, ...session.cooldown]) {
    if (onlyDone && !c.done) continue
    const m = Number(c.minutes) || 0
    cardioMin += m
    cardioKm += (m / 60) * (Number(c.speed) || 0)
  }

  return { sets, reps, volume, timeSets, timeSeconds, cardioMin, cardioKm, totalSets, doneSets }
}

const nf = (d) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: d })

export function fmtNum(n, digits = 1) {
  return nf(digits).format(n)
}

export function fmtMinutes(min) {
  const m = Math.floor(min)
  const s = Math.round((min - m) * 60)
  if (!s) return `${m} min`
  return `${m} min ${s} s`
}

export function fmtClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function fmtDate(iso, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  const [y, mo, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('it-IT', opts).format(new Date(y, mo - 1, d))
}
