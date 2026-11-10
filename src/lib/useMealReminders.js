// Notifiche dei pasti mentre l'app è aperta: controllo ogni mezzo minuto, una sola notifica per pasto e per giorno.
import { useEffect, useRef } from 'react'
import { DEFAULT_REMINDERS, dueMeals, mealEvents, notificationPermission, showMealNotification } from './mealReminders'
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
  const enabled = !!state?.settings.mealReminders?.enabled
  useEffect(() => {
    if (!enabled) return
    const check = async () => {
      const st = ref.current
      const plan = st?.dietPlans.find((d) => d.active && !d.archived)
      if (!plan || notificationPermission() !== 'granted') return
      const date = todayISO()
      const cfg = { ...DEFAULT_REMINDERS, ...st.settings.mealReminders }
      const notified = readNotified(date)
      const due = dueMeals(mealEvents(st, plan, date, 1), {
        date,
        hhmm: new Date().toTimeString().slice(0, 5),
        leadMin: cfg.leadMin,
        loggedMealIds: st.dietLog.filter((l) => l.date === date && l.planId === plan.id).map((l) => l.mealId),
        notified,
      })
      for (const e of due) {
        if (await showMealNotification(`${e.label} · ${e.time}`, e.text || 'Apri il piano per i dettagli.', e.id)) notified.push(e.id)
      }
      if (due.length) localStorage.setItem(KEY, JSON.stringify({ date, ids: notified }))
    }
    check()
    const id = setInterval(check, 30_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [enabled])
}
