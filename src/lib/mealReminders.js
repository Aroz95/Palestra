// Promemoria dei pasti. Un'app web non può programmare notifiche ad app chiusa senza un server:
// - calendario (.ics): eventi con avviso, funzionano sempre perché li gestisce il telefono;
// - notifiche dell'app: solo mentre l'app è aperta (o da poco in secondo piano).
import { addDays } from './dates'
import { activityOn } from './calendar'
import { optionOf, pickDay, rangeStatus, selectionsFor, sortedMeals } from './diet'
import { fmtNum } from './stats'

export const LEAD_OPTIONS = [0, 10, 15, 30]
export const DEFAULT_REMINDERS = { enabled: false, leadMin: 10 }

export const itemText = (it) => `${it.name}${it.quantity != null ? ` ${fmtNum(it.quantity, 1)} ${it.unit}` : ''}`
export const mealText = (option) => (option?.items ?? []).map(itemText).join(', ')

// Pasti con orario dei prossimi giorni, già risolti: variante allenamento/riposo del giorno e alternativa scelta
export function mealEvents(state, plan, from, days = 28) {
  const out = []
  if (!plan) return out
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i)
    if (rangeStatus(plan, date)) continue
    const { day } = pickDay(plan, date, { isTraining: activityOn(state, date) })
    const sel = selectionsFor(state, date, plan.id)
    for (const m of sortedMeals(day)) {
      if (!m.time) continue
      const option = optionOf(m, sel[m.id])
      out.push({ id: `${plan.id}-${date}-${m.id}`, date, time: m.time, mealId: m.id, label: m.label, text: mealText(option), option })
    }
  }
  return out
}

// Pasti di oggi il cui promemoria è scattato da poco (entro `windowMin`) e che non sono ancora stati registrati
export function dueMeals(events, { date, hhmm, leadMin = 0, windowMin = 20, loggedMealIds = [], notified = [] }) {
  const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  const now = mins(hhmm)
  return events.filter((e) => {
    if (e.date !== date || loggedMealIds.includes(e.mealId) || notified.includes(e.id)) return false
    const at = mins(e.time) - leadMin
    return now >= at && now < at + windowMin
  })
}

// ---- Calendario (.ics) ----
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const stamp = (date, time) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`
// Righe di al più 75 ottetti (RFC 5545), senza spezzare i caratteri accentati
function fold(line) {
  const enc = new TextEncoder()
  const out = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

export function toICS(events, { name = 'Pasti', leadMin = 10, now = new Date() } = {}) {
  const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Palestra//Promemoria pasti//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`]
  for (const e of events) {
    const summary = e.text ? `${e.label}: ${e.text}` : e.label
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@palestra`, // stabile: reimportando il file gli eventi si aggiornano invece di duplicarsi
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${stamp(e.date, e.time)}`, // ora locale del telefono
      'DURATION:PT30M',
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc((e.text || 'Nessun alimento indicato').split(', ').join('\n'))}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(summary)}`,
      `TRIGGER:-PT${leadMin}M`,
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

// ---- Notifiche dell'app ----
export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window
export const notificationPermission = () => (notificationsSupported() ? Notification.permission : 'unsupported')

export async function showMealNotification(title, body, tag) {
  if (notificationPermission() !== 'granted') return false
  const opts = { body, tag, icon: './icon-180.png', badge: './icon-180.png', lang: 'it' }
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null
    if (reg) await reg.showNotification(title, opts)
    else new Notification(title, opts)
    return true
  } catch {
    return false
  }
}
