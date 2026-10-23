// Regole del modulo Alimentazione, condivise da Oggi, Alimentazione, Progressi e report.
// Principio: obiettivo ≠ programmato ≠ consumato. Nessun nutriente viene inventato o copiato da un'altra opzione.
import { weekdayOf } from './dates'

export const NUTRIENTS = [
  { key: 'kcal', label: 'kcal', short: 'kcal', unit: 'kcal' },
  { key: 'proteinG', label: 'Proteine', short: 'P', unit: 'g' },
  { key: 'carbsG', label: 'Carboidrati', short: 'C', unit: 'g' },
  { key: 'fatG', label: 'Grassi', short: 'G', unit: 'g' },
  { key: 'fiberG', label: 'Fibre', short: 'F', unit: 'g' },
]
export const MAIN_KEYS = ['kcal', 'proteinG', 'carbsG', 'fatG']
const ALL_KEYS = NUTRIENTS.map((n) => n.key)

// ---- Giorni ----

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

// Il giorno è di allenamento? Variante esplicita del piano, altrimenti l'attività prevista o svolta quel giorno
export function isTrainingDay(day, activityOnDate) {
  if (day?.dayType === 'training') return true
  if (day?.dayType === 'rest') return false
  return !!activityOnDate
}

// ---- Obiettivi ----

// Per ogni nutriente: obiettivo del giorno (anche con data specifica) → tipo di giornata → generale → ND
export function resolveTarget(plan, day, training) {
  const t = plan?.nutritionTargets ?? {}
  const layers = [
    ['day', day?.nutritionTarget],
    [training ? 'training' : 'rest', training ? t.training : t.rest],
    ['default', t.default],
  ]
  const out = {}
  for (const k of [...ALL_KEYS, 'waterMl']) {
    const hit = layers.find(([, g]) => g?.[k] != null)
    out[k] = hit ? { value: hit[1][k], source: hit[0] } : { value: null, source: null }
  }
  return out
}

export const hasTargets = (target) => MAIN_KEYS.some((k) => target[k]?.value != null)

// ---- Nutrienti di un pasto o di un'alternativa ----

export function optionsOf(meal) {
  return [{ id: null, label: 'Principale', items: meal.items, nutrition: meal.nutrition, notes: '' }, ...(meal.alternatives ?? []).map((a, i) => ({ ...a, label: a.label || `Alternativa ${i + 1}` }))]
}

export function optionOf(meal, alternativeId) {
  return optionsOf(meal).find((o) => o.id === (alternativeId ?? null)) ?? optionsOf(meal)[0]
}

const tolerance = (k, v) => (k === 'kcal' ? Math.max(20, 0.1 * v) : Math.max(3, 0.1 * v))

// Una sola fonte per il totale: valore dichiarato per il pasto/alternativa; altrimenti somma degli alimenti
// solo se TUTTI hanno il valore; altrimenti mancante. Nessun doppio conteggio tra pasto e alimenti.
export function optionNutrition(option) {
  const items = option?.items ?? []
  const out = {}
  const mismatch = []
  for (const k of ALL_KEYS) {
    const declared = option?.nutrition?.[k]
    const itemVals = items.map((it) => it.nutrition?.[k])
    const itemsComplete = items.length > 0 && itemVals.every((x) => x != null)
    const sum = itemsComplete ? itemVals.reduce((a, b) => a + b, 0) : null
    if (declared != null) {
      out[k] = { value: declared, status: 'declared' }
      if (sum != null && Math.abs(sum - declared) > tolerance(k, declared)) mismatch.push({ key: k, declared, items: sum })
    } else if (sum != null) out[k] = { value: sum, status: 'computed' }
    else out[k] = { value: null, status: 'missing' }
  }
  const statuses = MAIN_KEYS.map((k) => out[k].status)
  const source = statuses.every((s) => s === 'declared') ? 'declared_meal' : statuses.every((s) => s === 'computed') ? 'sum_items' : statuses.every((s) => s === 'missing') ? 'unknown' : 'mixed'
  return { ...out, source, mismatch }
}

// Differenza tra un'alternativa e il principale, solo dove entrambi i valori sono noti
export function optionDelta(a, b) {
  const out = {}
  for (const k of ALL_KEYS) out[k] = a[k].value != null && b[k].value != null ? a[k].value - b[k].value : null
  return out
}

// ---- Totali del giorno ----

// Somma per nutriente con indicazione di completezza: complete | partial | missing
function sumWithQuality(values) {
  const known = values.filter((x) => x != null)
  const status = !values.length || !known.length ? 'missing' : known.length === values.length ? 'complete' : 'partial'
  return { value: known.length ? known.reduce((a, b) => a + b, 0) : null, status, known: known.length, total: values.length }
}

// Programmato: opzione scelta per ogni pasto (principale se nessuna scelta). selections: { [mealId]: alternativeId }
export function dayPlanned(day, selections = {}) {
  const meals = day?.meals ?? []
  const per = meals.map((m) => optionNutrition(optionOf(m, selections[m.id])))
  const out = {}
  for (const k of ALL_KEYS) out[k] = sumWithQuality(per.map((n) => n[k].value))
  return out
}

// Scostamento programmato/consumato − obiettivo: solo con totale completo e obiettivo presente
export function deltaToTarget(totals, target) {
  const out = {}
  for (const k of ALL_KEYS) out[k] = totals[k]?.status === 'complete' && target[k]?.value != null ? totals[k].value - target[k].value : null
  return out
}

// Nutrienti realmente consumati secondo una registrazione del diario.
// "Saltato" = nulla consumato (0); "seguito" senza quantità registrate NON attesta i nutrienti consumati.
export function logNutrition(log) {
  if (log.status === 'skipped') return Object.fromEntries(ALL_KEYS.map((k) => [k, { value: 0, status: 'declared' }]))
  if (!log.consumption) return Object.fromEntries(ALL_KEYS.map((k) => [k, { value: null, status: 'missing' }]))
  return optionNutrition(log.consumption)
}

export function consumptionQuality(log) {
  if (log.status === 'skipped') return 'complete'
  if (!log.consumption) return 'missing'
  const n = optionNutrition(log.consumption)
  const known = MAIN_KEYS.filter((k) => n[k].value != null).length
  return known === MAIN_KEYS.length ? 'complete' : known ? 'partial' : 'missing'
}

// Consumato del giorno: completo solo se ogni pasto previsto ha una registrazione con valori noti
// (le aggiunte extra vengono sommate); i pasti non registrati rendono il totale parziale.
export function dayConsumed(day, logs) {
  const planned = new Set((day?.meals ?? []).map((m) => m.id))
  const byMeal = new Map(logs.map((l) => [l.mealId, l]))
  const values = {}
  for (const k of ALL_KEYS) values[k] = []
  for (const id of planned) {
    const l = byMeal.get(id)
    const n = l ? logNutrition(l) : null
    for (const k of ALL_KEYS) values[k].push(n ? n[k].value : null)
  }
  for (const l of logs.filter((x) => !planned.has(x.mealId))) {
    const n = logNutrition(l)
    for (const k of ALL_KEYS) values[k].push(n[k].value)
  }
  const out = {}
  for (const k of ALL_KEYS) out[k] = logs.length ? sumWithQuality(values[k]) : { value: null, status: 'missing', known: 0, total: values[k].length }
  return out
}

// Scelte delle alternative salvate per una data (mealId → alternativeId)
export function selectionsFor(state, date, planId) {
  return Object.fromEntries((state.dietSelections ?? []).filter((s) => s.date === date && s.planId === planId).map((s) => [s.mealId, s.alternativeId]))
}

// Completezza nutrizionale del piano: pasti principali con kcal/P/C/G noti su totale
export function planCompleteness(plan) {
  const meals = (plan?.days ?? []).flatMap((d) => d.meals)
  const complete = meals.filter((m) => {
    const n = optionNutrition(optionOf(m, null))
    return MAIN_KEYS.every((k) => n[k].value != null)
  }).length
  return { complete, total: meals.length, ratio: meals.length ? complete / meals.length : null }
}
