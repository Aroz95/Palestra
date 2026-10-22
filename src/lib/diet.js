// Regole di consultazione del piano alimentare, condivise da Oggi, Alimentazione e report.
import { weekdayOf } from './dates'

// Giorni applicabili a una data: un giorno con data specifica ha la precedenza sul giorno della settimana
export function dayCandidates(plan, date) {
  if (!plan) return []
  const dated = plan.days.filter((d) => d.date === date)
  return dated.length ? dated : plan.days.filter((d) => !d.date && d.weekday === weekdayOf(date))
}

// Variante allenamento/riposo: scelta esplicita, altrimenti in base all'attività del giorno, altrimenti "generico"
export function pickDay(plan, date, { isTraining = false, dayType = null } = {}) {
  const c = dayCandidates(plan, date)
  if (!c.length) return { day: null, types: [], type: null }
  const types = [...new Set(c.map((d) => d.dayType))]
  const auto = isTraining ? 'training' : 'rest'
  const type = dayType && types.includes(dayType) ? dayType : types.includes(auto) ? auto : types.includes('any') ? 'any' : types[0]
  return { day: c.find((d) => d.dayType === type) ?? c[0], types, type }
}

export function sortedMeals(day) {
  return day ? [...day.meals].sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99')) : []
}

// Pasto corrente/prossimo: il primo non ancora passato, altrimenti l'ultimo
export function nextMeal(day, hhmm) {
  const meals = sortedMeals(day)
  return meals.find((m) => m.time && m.time >= hhmm) ?? meals[meals.length - 1] ?? null
}

export const isValidated = (plan) => plan.status === 'validated' && !!plan.validatedBy?.trim()
