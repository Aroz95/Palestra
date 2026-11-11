// Promemoria dei pasti mentre l'app è aperta: controllo ogni mezzo minuto.
// - notifica del telefono (se attivata e consentita);
// - messaggio Telegram tramite il bot personale (se configurato con invio automatico).
// Ogni pasto viene ricordato una sola volta al giorno per canale; i pasti già registrati vengono saltati.
import { useEffect, useRef } from 'react'
import { DEFAULT_REMINDERS, dueMeals, mealEvents, notificationPermission, showMealNotification } from './mealReminders'
import { asText, botReady, loadTelegram, markSent, mealMessage, sendText, sentToday, serverActive } from './telegram'
import { todayISO } from './dates'

const KEY = 'palestra:meal-notified'
const readNotified = (date) => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return v?.date === date ? v.ids : []
  } catch {
    return []
  }
}

export function useMealReminders(state) {
  const ref = useRef(state)
  ref.current = state
  useEffect(() => {
    let busy = false
    const check = async () => {
      const st = ref.current
      const plan = st?.dietPlans.find((d) => d.active && !d.archived)
      if (!plan || busy) return
      const cfg = { ...DEFAULT_REMINDERS, ...st.settings.mealReminders }
      const tg = loadTelegram()
      const notify = cfg.enabled && notificationPermission() === 'granted'
      // se l'invio lo fa GitHub, l'app non invia (niente doppioni)
      const telegram = tg.auto && botReady(tg) && !serverActive(tg, todayISO())
      if (!notify && !telegram) return
      busy = true
      try {
        const date = todayISO()
        const events = mealEvents(st, plan, date, 1)
        const base = { date, hhmm: new Date().toTimeString().slice(0, 5), leadMin: cfg.leadMin, loggedMealIds: st.dietLog.filter((l) => l.date === date && l.planId === plan.id).map((l) => l.mealId) }
        if (notify) {
          const notified = readNotified(date)
          const due = dueMeals(events, { ...base, notified })
          for (const e of due) if (await showMealNotification(`${e.label} · ${e.time}`, e.text || 'Apri il piano per i dettagli.', e.id)) notified.push(e.id)
          if (due.length) localStorage.setItem(KEY, JSON.stringify({ date, ids: notified }))
        }
        if (telegram) {
          const sent = sentToday(date)
          for (const e of dueMeals(events, { ...base, notified: sent })) {
            try {
              await sendText(tg, asText(mealMessage({ label: e.label, time: e.time, option: e.option })))
              sent.push(e.id)
              markSent(date, sent)
            } catch (err) {
              console.warn('Invio Telegram non riuscito', err) // riprova al controllo successivo, finché il pasto è nella finestra
            }
          }
        }
      } finally {
        busy = false
      }
    }
    check()
    const id = setInterval(check, 30_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
}
