// Stima del dispendio energetico: sempre un intervallo, con metodo dichiarato.
// - Tapis roulant: equazioni metaboliche ACSM (camminata ≤ 7,5 km/h, corsa oltre).
// - Pesi: MET 3,5–5,0 (Compendium of Physical Activities) sul tempo in sala pesi.
// - Nuoto: MET 5,8–8,3 (Compendium, nuoto in vasca da moderato a sostenuto).
// kcal totali = MET × peso × ore; kcal attive = (MET − 1) × peso × ore (esclude il metabolismo a riposo).
import { cardioMinutes } from './stats'
import { localDate } from './dates'

const KCAL_PER_L_O2 = 5

function treadmillKcalPerMin(speedKmh, weightKg) {
  const v = (speedKmh * 1000) / 60 // m/min
  const vo2 = 3.5 + (speedKmh <= 7.5 ? 0.1 : 0.2) * v // ml/kg/min
  const total = (vo2 * weightKg * KCAL_PER_L_O2) / 1000
  const active = ((vo2 - 3.5) * weightKg * KCAL_PER_L_O2) / 1000
  return { total, active }
}

const metKcal = (met, weightKg, minutes) => (met * weightKg * minutes) / 60
const round10 = (n) => Math.round(n / 10) * 10

export function estimateEnergy(session, weightKg, durationMin) {
  if (!weightKg || !durationMin) return null
  let tot = { min: 0, max: 0 }
  let act = { min: 0, max: 0 }
  let method
  if (session.kind === 'swim') {
    tot = { min: metKcal(5.8, weightKg, durationMin), max: metKcal(8.3, weightKg, durationMin) }
    act = { min: metKcal(4.8, weightKg, durationMin), max: metKcal(7.3, weightKg, durationMin) }
    method = 'MET nuoto 5,8–8,3 (Compendium)'
  } else {
    for (const c of [...(session.warmup ?? []), ...(session.cooldown ?? [])]) {
      if (!c.done || !c.minutes || !c.speed) continue
      const k = treadmillKcalPerMin(c.speed, weightKg)
      tot.min += k.total * c.minutes
      tot.max += k.total * c.minutes
      act.min += k.active * c.minutes
      act.max += k.active * c.minutes
    }
    const weightsMin = Math.max(0, durationMin - cardioMinutes(session))
    tot.min += metKcal(3.5, weightKg, weightsMin)
    tot.max += metKcal(5.0, weightKg, weightsMin)
    act.min += metKcal(2.5, weightKg, weightsMin)
    act.max += metKcal(4.0, weightKg, weightsMin)
    method = 'ACSM tapis roulant + MET pesi 3,5–5,0 (Compendium)'
  }
  return {
    source: 'estimate',
    method,
    bodyWeightKg: weightKg,
    durationMin,
    activeKcal: { min: round10(act.min), max: round10(act.max) },
    totalKcal: { min: round10(tot.min), max: round10(tot.max) },
  }
}

// Peso più recente registrato fino alla data indicata (nessun valore inventato)
export function bodyWeightAt(measurements, date) {
  const m = measurements
    .filter((x) => x.weightKg != null && localDate(x.at) <= date)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]
  return m ? { weightKg: m.weightKg, date: localDate(m.at) } : null
}
