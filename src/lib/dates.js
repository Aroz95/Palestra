// Date in formato locale: 'AAAA-MM-GG' per i giorni, ISO con offset per gli istanti.
export const pad = (n) => String(n).padStart(2, '0')

export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Istante ISO con offset locale, es. 2026-10-22T18:20:00+02:00
export function toLocalISO(d = new Date()) {
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const a = Math.abs(off)
  return (
    `${todayISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`
  )
}

export function parseDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isValidDate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  return todayISO(parseDate(iso)) === iso
}

export function isValidDateTime(iso) {
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso) && !Number.isNaN(Date.parse(iso))
}

export function addDays(iso, n) {
  const d = parseDate(iso)
  d.setDate(d.getDate() + n)
  return todayISO(d)
}

// 1 = lunedì … 7 = domenica
export function weekdayOf(iso) {
  const w = parseDate(iso).getDay()
  return w === 0 ? 7 : w
}

export const WEEKDAYS = ['', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
export const WEEKDAYS_SHORT = ['', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export function daysInRange(from, to) {
  const out = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export function dayCount(from, to) {
  return Math.round((parseDate(to) - parseDate(from)) / 86400000) + 1
}

// Data + 'HH:MM' locali → ISO con offset
export function combineDateTime(dateISO, hhmm) {
  if (!dateISO || !/^\d{1,2}:\d{2}$/.test(hhmm ?? '')) return null
  const [h, m] = hhmm.split(':').map(Number)
  const d = parseDate(dateISO)
  d.setHours(h, m, 0, 0)
  return toLocalISO(d)
}

// Giorno locale di un istante ISO (un file importato può usare un altro fuso, es. "Z")
export function localDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso).slice(0, 10) : todayISO(d)
}

export function timeOf(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function minutesBetween(startISO, endISO) {
  if (!startISO || !endISO) return null
  const ms = Date.parse(endISO) - Date.parse(startISO)
  return Number.isFinite(ms) ? Math.round(ms / 60000) : null
}

// Periodi della dashboard
export const PERIODS = [
  { id: '7d', label: '7 giorni' },
  { id: '30d', label: '30 giorni' },
  { id: '90d', label: '90 giorni' },
  { id: 'month', label: 'Mese' },
  { id: 'year', label: 'Anno' },
  { id: 'custom', label: 'Personalizzato' },
]

export function periodRange(kind, ref = todayISO(), custom = {}) {
  const d = parseDate(ref)
  switch (kind) {
    case '7d':
      return { from: addDays(ref, -6), to: ref }
    case '30d':
      return { from: addDays(ref, -29), to: ref }
    case '90d':
      return { from: addDays(ref, -89), to: ref }
    case 'month':
      return { from: todayISO(new Date(d.getFullYear(), d.getMonth(), 1)), to: todayISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }
    case 'year':
      return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` }
    default: {
      const from = isValidDate(custom.from) ? custom.from : addDays(ref, -29)
      const to = isValidDate(custom.to) && custom.to >= from ? custom.to : ref
      return { from, to }
    }
  }
}

export function previousPeriod({ from, to }) {
  const n = dayCount(from, to)
  return { from: addDays(from, -n), to: addDays(from, -1) }
}

export function fmtDate(iso, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat('it-IT', opts).format(parseDate(iso))
}

export function fmtDateShort(iso) {
  return fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
