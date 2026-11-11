// Telegram: invio di un pasto o del menù del giorno.
// - Senza configurazione: link di condivisione (si apre Telegram e si sceglie la chat).
// - Con un bot personale (token di @BotFather + chat): invio diretto nella chat, anche automatico all'ora del pasto.
// Token e chat restano SOLO su questo dispositivo (localStorage): non entrano nei backup, nei report né nello stato.
import { useSyncExternalStore } from 'react'
import { readJSON, writeJSON } from './storage'
import { MAIN_KEYS, optionNutrition } from './diet'
import { fmtNum } from './stats'
import { itemText, mealEvents } from './mealReminders'
import { addDays } from './dates'

const KEY = 'palestra:telegram'
const SENT_KEY = 'palestra:telegram-sent'
const API = 'https://api.telegram.org'

export const DEFAULT_TELEGRAM = { token: '', chatId: '', chatName: '', auto: false, serverUntil: null, serverCopiedAt: null }
export const loadTelegram = () => ({ ...DEFAULT_TELEGRAM, ...readJSON(KEY, {}) })
// Configurazione condivisa tra i componenti: chi la usa si aggiorna appena cambia
const listeners = new Set()
let snapshot = null
export function saveTelegram(cfg) {
  writeJSON(KEY, { ...DEFAULT_TELEGRAM, ...cfg })
  snapshot = null
  listeners.forEach((l) => l())
}
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l))
const getSnapshot = () => (snapshot ??= loadTelegram())
export const useTelegram = () => useSyncExternalStore(subscribe, getSnapshot)
export const botReady = (cfg) => !!(cfg?.token && cfg?.chatId)
// Formato del token di BotFather: "123456789:AA…" (numero, due punti, almeno 30 caratteri)
export const isToken = (t) => /^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(String(t ?? '').trim())

// ---- Testo del messaggio (testo semplice: nessuna formattazione da proteggere) ----
const SHORT = { proteinG: 'P', carbsG: 'C', fatG: 'G' }
export function macroLine(n) {
  if (!n || n.kcal.value == null) return ''
  return [`${fmtNum(n.kcal.value, 0)} kcal`, ...MAIN_KEYS.filter((k) => k !== 'kcal' && n[k].value != null).map((k) => `${SHORT[k]} ${fmtNum(n[k].value, 0)} g`)].join(' · ')
}

// { label, time, option } → "🍽 Pranzo · 13:00" + alimenti uno per riga + macro
export function mealMessage({ label, time, option, when = '' }) {
  const title = `🍽 ${label}${option?.id ? ` (${option.label})` : ''}${time ? ` · ${when ? `${when} ` : ''}${time}` : when ? ` · ${when}` : ''}`
  const lines = (option?.items ?? []).map((it) => `• ${itemText(it)}`)
  const macros = macroLine(optionNutrition(option))
  return { title, body: [...(lines.length ? lines : ['Nessun alimento indicato']), ...(macros ? ['', macros] : [])].join('\n') }
}
export const asText = (m) => `${m.title}\n${m.body}`

export function dayMessage(dateLabel, meals) {
  return { title: `📅 Menù di ${dateLabel}`, body: meals.map((m) => asText(mealMessage(m))).join('\n\n') || 'Nessun pasto previsto.' }
}

// Link di condivisione ufficiale: il titolo va nel campo "url" (prima riga del messaggio), il resto nel testo
export const shareUrl = (m) => `https://t.me/share/url?url=${encodeURIComponent(m.title)}&text=${encodeURIComponent(m.body)}`

// ---- Bot API ----
// Richieste "semplici" (corpo form-urlencoded): nessuna richiesta preliminare CORS.
async function call(token, method, params = {}) {
  const body = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  let res
  try {
    res = await fetch(`${API}/bot${token.trim()}/${method}`, { method: 'POST', body })
  } catch {
    throw new Error('Telegram non raggiungibile: controlla la connessione')
  }
  const data = await res.json().catch(() => null)
  if (!data?.ok) {
    if (res.status === 401 || data?.error_code === 401) throw new Error('token del bot non valido')
    if (/chat not found/i.test(data?.description ?? '')) throw new Error('chat non trovata: scrivi prima /start al bot')
    if (/bot was blocked/i.test(data?.description ?? '')) throw new Error('il bot è stato bloccato in questa chat')
    throw new Error(data?.description || `errore ${res.status}`)
  }
  return data.result
}

export const botInfo = (token) => call(token, 'getMe')

// Chat che hanno scritto al bot di recente (serve aver inviato /start): da qui si sceglie dove inviare
export async function findChats(token) {
  const updates = await call(token, 'getUpdates', { limit: 100 })
  const chats = new Map()
  for (const u of updates) {
    const c = (u.message ?? u.channel_post ?? u.my_chat_member ?? u.edited_message)?.chat
    if (!c) continue
    const name = c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || (c.username ? `@${c.username}` : String(c.id))
    chats.set(String(c.id), { id: String(c.id), name, type: c.type })
  }
  return [...chats.values()]
}

// ---- Invio da GitHub (anche ad app chiusa) ----
// Programma per il segreto PALESTRA_TELEGRAM: token, chat, anticipo e i pasti dei prossimi giorni già risolti
// (variante allenamento/riposo, alternative scelte). Testi uguali salvati una volta sola (limite dei segreti: 48 KB).
export const SECRET_NAME = 'PALESTRA_TELEGRAM'
export const SECRET_MAX = 47_000
export function buildSchedule(state, plan, cfg, { from, leadMin = 10, days = 28, tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome' }) {
  for (let d = days; d >= 3; d -= 3) {
    const texts = []
    const index = new Map()
    const events = mealEvents(state, plan, from, d).map((e) => {
      const t = asText(mealMessage({ label: e.label, time: e.time, option: e.option }))
      if (!index.has(t)) index.set(t, texts.push(t) - 1)
      return [e.date, e.time, index.get(t)]
    })
    const s = { v: 1, token: cfg.token, chatId: cfg.chatId, tz, leadMin, until: addDays(from, d - 1), texts, events }
    const json = JSON.stringify(s)
    if (new TextEncoder().encode(json).length <= SECRET_MAX) return { json, until: s.until, count: events.length }
  }
  throw new Error('piano troppo grande per un segreto di GitHub')
}
// Indirizzo del repository dell'app (pubblicata su <utente>.github.io/<repository>)
export function repoUrl(loc = typeof location !== 'undefined' ? location : null) {
  const m = loc?.hostname?.match(/^([^.]+)\.github\.io$/)
  const repo = loc?.pathname?.split('/').filter(Boolean)[0]
  return m && repo ? `https://github.com/${m[1]}/${repo}` : 'https://github.com/Aroz95/Palestra'
}
export const serverActive = (cfg, today) => !!cfg?.serverUntil && cfg.serverUntil >= today

export const sendText = (cfg, text) => call(cfg.token, 'sendMessage', { chat_id: cfg.chatId, text, disable_web_page_preview: true })

// Invii automatici già fatti oggi (un solo invio per pasto e per giorno)
export function sentToday(date) {
  const v = readJSON(SENT_KEY, null)
  return v?.date === date ? v.ids : []
}
export const markSent = (date, ids) => writeJSON(SENT_KEY, { date, ids })
