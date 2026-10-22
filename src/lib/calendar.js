// Calendario: le ricorrenze del programma principale generano occorrenze programmate.
// Un'occorrenza diventa "in corso/completata" solo quando esiste una seduta collegata.
import { daysInRange, todayISO, weekdayOf } from './dates'

export function mainProgram(state) {
  return state.programs.find((p) => p.isMain && p.status !== 'archived') ?? null
}

function inValidity(program, date) {
  return (!program.validFrom || program.validFrom <= date) && (!program.validTo || date <= program.validTo)
}

export function occurrencesOn(state, date) {
  const out = []
  const program = mainProgram(state)
  if (program && inValidity(program, date)) {
    for (const slot of program.weeklySchedule) {
      if (slot.weekday !== weekdayOf(date)) continue
      out.push({ key: `${program.id}:${date}:${slot.id}`, date, programId: program.id, ...pickSlot(slot) })
    }
  }
  for (const ex of state.calendar?.extra ?? []) {
    if (ex.date === date) out.push({ key: ex.id, date, programId: ex.programId ?? null, ...pickSlot(ex), movedFrom: ex.movedFrom ?? null })
  }
  return out.map((o) => ({ ...o, ...occurrenceState(state, o) }))
}

const pickSlot = (s) => ({ kind: s.kind, templateId: s.templateId ?? null, label: s.label ?? '', swimPlan: s.swimPlan ?? null })

export function occurrenceState(state, occ) {
  const session = state.sessions.find((s) => s.occurrenceKey === occ.key)
  if (session) return { status: session.status === 'planned' ? 'in_progress' : session.status, sessionId: session.id }
  const ov = state.calendar?.overrides?.[occ.key]
  if (ov) return { status: ov.status, movedTo: ov.movedTo ?? null, sessionId: null }
  if (occ.kind === 'rest') return { status: 'rest', sessionId: null }
  return { status: occ.date < todayISO() ? 'missed' : 'planned', sessionId: null }
}

export function occurrencesInRange(state, from, to) {
  return daysInRange(from, to).flatMap((d) => occurrencesOn(state, d))
}

// Aderenza al calendario: completate / previste (escluse quelle di recupero, future e rinviate)
export function scheduleAdherence(state, from, to) {
  const today = todayISO()
  const occ = occurrencesInRange(state, from, to < today ? to : today).filter((o) => o.kind !== 'rest' && o.status !== 'postponed')
  const completed = occ.filter((o) => o.status === 'completed').length
  return { planned: occ.length, completed, ratio: occ.length ? completed / occ.length : null }
}

export function templateName(state, id) {
  const t = state.workoutTemplates.find((x) => x.id === id)
  return t ? `${t.label ? `${t.label} · ` : ''}${t.name}` : 'Scheda non trovata'
}

export const OCC_STATUS = {
  planned: { label: 'Prevista', cls: 'bg-slate-700 text-slate-200' },
  in_progress: { label: 'In corso', cls: 'bg-amber-500 text-slate-950' },
  completed: { label: 'Completata', cls: 'bg-emerald-500 text-slate-950' },
  skipped: { label: 'Saltata', cls: 'bg-rose-900 text-rose-200' },
  postponed: { label: 'Rinviata', cls: 'bg-sky-900 text-sky-200' },
  missed: { label: 'Non registrata', cls: 'bg-slate-800 text-slate-400' },
  rest: { label: 'Recupero', cls: 'bg-slate-800 text-slate-300' },
}
