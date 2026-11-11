// Invio automatico dei pasti su Telegram, eseguito da GitHub Actions ogni 5 minuti (.github/workflows/telegram-pasti.yml).
// Funziona anche con l'app chiusa. Il programma (token del bot, chat, pasti dei prossimi giorni) arriva dal segreto
// PALESTRA_TELEGRAM, copiato dall'app: nel repository non c'è nessun dato. Il registro è pubblico: qui non si
// stampano mai il contenuto dei messaggi, il token o la chat, solo dei conteggi.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const WINDOW_MIN = 60 // ritardo massimo accettato (le esecuzioni programmate di GitHub possono slittare)
const EXPIRY_WARN_DAYS = 2

// "YYYY-MM-DD HH:mm" nel fuso dell'utente → minuti "da orologio da parete" (confrontabili tra loro)
const wallMinutes = (date, time) => {
  const [y, m, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  return Date.UTC(y, m - 1, d, h, mi) / 60000
}
export function nowIn(tz, now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

export function parseSchedule(raw) {
  let s
  try {
    s = JSON.parse(raw)
  } catch {
    s = null // il messaggio di JSON.parse riporterebbe parte del testo (e quindi del token) nel registro pubblico
  }
  if (s?.v !== 1 || !s.token || !s.chatId || !Array.isArray(s.events) || !Array.isArray(s.texts)) throw new Error('programma non valido: copialo di nuovo dall’app')
  return s
}

// Messaggi da inviare adesso: orario del pasto − anticipo già passato, da non più di WINDOW_MIN minuti, non ancora inviati
export function dueMessages(s, now, sent = []) {
  const at = wallMinutes(now.date, now.time)
  const out = []
  for (const [date, time, i] of s.events) {
    const id = `${date}|${time}|${i}`
    const sendAt = wallMinutes(date, time) - (s.leadMin ?? 0)
    if (at >= sendAt && at - sendAt <= WINDOW_MIN && !sent.includes(id)) out.push({ id, text: s.texts[i] })
  }
  // programma in scadenza: un solo avviso al giorno negli ultimi giorni (alle 9 o dopo)
  const last = s.until ?? s.events.at(-1)?.[0]
  if (last && wallMinutes(last, '00:00') - wallMinutes(now.date, '00:00') <= EXPIRY_WARN_DAYS * 1440 && now.time >= '09:00') {
    const id = `scadenza|${now.date}`
    if (!sent.includes(id)) out.push({ id, text: `⏳ Il programma dei pasti su Telegram finisce il ${last.split('-').reverse().join('/')}.\nApri l’app → Alimentazione → campanella → “Copia il programma” e aggiornalo su GitHub.` })
  }
  return out
}

// Registro degli invii (tenuto nella cache di Actions): solo gli ultimi giorni
export function pruneSent(sent, today) {
  const keep = wallMinutes(today, '00:00') - 3 * 1440
  return sent.filter((id) => {
    const d = id.match(/\d{4}-\d{2}-\d{2}/)?.[0]
    return d && wallMinutes(d, '00:00') >= keep
  })
}

export async function send(s, text, fetchImpl = fetch) {
  const res = await fetchImpl(`https://api.telegram.org/bot${s.token}/sendMessage`, {
    method: 'POST',
    body: new URLSearchParams({ chat_id: String(s.chatId), text, disable_web_page_preview: 'true' }),
  })
  const data = await res.json().catch(() => null)
  if (!data?.ok) throw new Error(`Telegram ha risposto ${data?.error_code ?? res.status}`)
}

async function main() {
  const raw = process.env.PALESTRA_TELEGRAM
  if (!raw) return console.log('Invio automatico non configurato (manca il segreto PALESTRA_TELEGRAM).')
  const s = parseSchedule(raw)
  const file = path.resolve('.tg-sent/sent.json')
  const sent = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []
  const now = nowIn(s.tz || 'Europe/Rome')
  const due = process.env.PROVA === 'true' ? [{ id: `prova|${now.date}|${now.time}`, text: `✅ Invio automatico attivo.\nI pasti arriveranno qui ${s.leadMin ? `${s.leadMin} minuti prima` : 'all’orario'}, anche con l’app chiusa (programma fino al ${(s.until ?? '').split('-').reverse().join('/')}).` }] : dueMessages(s, now, sent)
  let ok = 0
  let failed = 0
  for (const m of due) {
    try {
      await send(s, m.text)
      sent.push(m.id)
      ok++
    } catch (e) {
      failed++
      console.log(`Invio non riuscito: ${e.message}`)
    }
  }
  console.log(`Messaggi inviati: ${ok}${failed ? `, non riusciti: ${failed} (nuovo tentativo al prossimo giro)` : ''}.`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(pruneSent(sent, now.date)))
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `sent=${ok > 0}\n`)
  if (failed && !ok) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // solo il messaggio, mai la traccia completa: nessun dato del programma nel registro
  await main().catch((e) => {
    console.log(`Errore: ${e.message}`)
    process.exitCode = 1
  })
}
