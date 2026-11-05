// Data effettiva e data programmata di una seduta.
// - date: giorno in cui la seduta è stata svolta (ora locale del dispositivo).
// - plannedDate: giorno dell'attività del calendario a cui la seduta è collegata, se diverso o se avviata dal calendario.
// - occurrenceKey identifica l'attività programmata (`programma:AAAA-MM-GG:slot`), quindi contiene la data programmata:
//   è corretto che resti quella anche quando la seduta viene anticipata o recuperata in un altro giorno.
import { addDays, localDate } from './dates'

export function plannedDateOf(session, extras = []) {
  if (session.plannedDate) return session.plannedDate
  const m = /:(\d{4}-\d{2}-\d{2}):/.exec(session.occurrenceKey ?? '')
  if (m) return m[1]
  return extras.find((e) => e.id === session.occurrenceKey)?.date ?? null
}

export const isRescheduled = (s) => !!s.plannedDate && s.plannedDate !== s.date

// Sedute registrate con la data dell'attività programmata invece che con quella in cui sono state svolte
// (difetto corretto il 06/11/2026). Si corregge solo se: la seduta è collegata al calendario, ha ancora come data
// quella programmata (mai cambiata a mano) e inizio e fine indicano con chiarezza un altro giorno. Nient'altro cambia.
export function repairSessionDate(session, extras = []) {
  if (!session?.occurrenceKey || !session.startedAt) return session
  const planned = plannedDateOf(session, extras)
  const actual = localDate(session.startedAt)
  if (!planned || !actual || session.date !== planned || actual === planned) return session
  const end = session.endedAt ? localDate(session.endedAt) : null
  if (end && end !== actual && end !== addDays(actual, 1)) return session // orari incoerenti: non si indovina
  return { ...session, date: actual, plannedDate: planned }
}
