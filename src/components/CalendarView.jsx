import { useState } from 'react'
import { Chip, Empty, Sheet, Field } from './ui'
import { occurrencesOn, OCC_STATUS, templateName, mainProgram } from '../lib/calendar'
import { addDays, fmtDate, todayISO, weekdayOf, WEEKDAYS_SHORT } from '../lib/dates'
import { ACTIVITY_KINDS, SESSION_STATUS } from '../schema/constants'
import { blocksTotal } from '../lib/swim'
import * as A from '../lib/actions'

export function occurrenceTitle(state, o) {
  if (o.kind === 'strength') return o.templateId ? templateName(state, o.templateId) : 'Sala pesi'
  if (o.kind === 'swim') return o.swimPlan?.plannedBlocks?.length ? `Nuoto · ${blocksTotal(o.swimPlan.plannedBlocks)} m previsti` : 'Nuoto'
  return o.label || ACTIVITY_KINDS[o.kind]
}

export function OccurrenceItem({ state, occ, update, onOpenSession, onStart }) {
  const [postpone, setPostpone] = useState(false)
  const [date, setDate] = useState(addDays(occ.date, 1))
  const st = OCC_STATUS[occ.status] ?? OCC_STATUS.planned
  const template = state.workoutTemplates.find((t) => t.id === occ.templateId)
  const startable = occ.kind === 'strength' || occ.kind === 'swim'


  return (
    <div className="rounded-xl bg-slate-800/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-slate-400">{ACTIVITY_KINDS[occ.kind]}</div>
          <div className="font-semibold text-white">{occurrenceTitle(state, occ)}</div>
          {template?.estimatedMinutes && <div className="text-xs text-slate-400">~{template.estimatedMinutes} min</div>}
          {occ.movedFrom && <div className="text-xs text-sky-300">Rinviata dal {occ.movedFrom}</div>}
          {occ.status === 'postponed' && occ.movedTo && <div className="text-xs text-sky-300">Spostata al {occ.movedTo}</div>}
        </div>
        <Chip className={st.cls}>{st.label}</Chip>
      </div>
      {startable && !['skipped', 'postponed'].includes(occ.status) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {occ.sessionId ? (
            <button onClick={() => onOpenSession(occ.sessionId)} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950">
              {occ.status === 'completed' ? 'Apri' : 'Riprendi'}
            </button>
          ) : (
            <>
              <button onClick={() => onStart({ occ })} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950">▶ Avvia</button>
              <button onClick={() => update((s) => A.setOccurrenceStatus(s, occ, 'skipped'))} className="btn-ghost py-1.5 text-sm">Salta</button>
              <button onClick={() => setPostpone(true)} className="btn-ghost py-1.5 text-sm">Rinvia</button>
            </>
          )}
        </div>
      )}
      {['skipped', 'postponed'].includes(occ.status) && !occ.sessionId && (
        <button onClick={() => update((s) => A.setOccurrenceStatus(s, occ, null))} className="mt-2 text-xs text-slate-400 underline">
          Annulla ({OCC_STATUS[occ.status].label.toLowerCase()})
        </button>
      )}
      <Sheet open={postpone} onClose={() => setPostpone(false)} title="Rinvia attività">
        <Field label="Nuova data">
          <input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl bg-slate-800 px-3 py-2 text-slate-100 [color-scheme:dark]" />
        </Field>
        <button
          onClick={() => {
            update((s) => A.setOccurrenceStatus(s, occ, 'postponed', date))
            setPostpone(false)
          }}
          className="btn mt-4 w-full bg-emerald-500 text-slate-950"
        >
          Rinvia al {date}
        </button>
      </Sheet>
    </div>
  )
}

// Sedute registrate in un giorno senza un'occorrenza del calendario (attività libere)
export function freeSessionsOn(state, date, occs) {
  const linked = new Set(occs.map((o) => o.sessionId).filter(Boolean))
  return state.sessions.filter((s) => s.date === date && !linked.has(s.id))
}

export function SessionChip({ session, onOpen }) {
  return (
    <button onClick={() => onOpen(session.id)} className="flex w-full items-center justify-between rounded-xl bg-slate-800/60 p-3 text-left">
      <span>
        <span className="block text-xs uppercase tracking-wider text-slate-400">{session.kind === 'swim' ? 'Nuoto' : 'Sala pesi'} · attività libera</span>
        <span className="font-semibold text-white">{session.title || (session.kind === 'swim' ? 'Nuoto' : 'Seduta')}</span>
      </span>
      <Chip>{SESSION_STATUS[session.status]}</Chip>
    </button>
  )
}

export default function CalendarView({ state, update, onOpenSession, onStart }) {
  const today = todayISO()
  const [weekStart, setWeekStart] = useState(addDays(today, 1 - weekdayOf(today)))
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const program = mainProgram(state)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="btn-ghost text-sm" aria-label="Settimana precedente">‹</button>
        <div className="text-center text-sm">
          <div className="font-semibold text-white">
            {fmtDate(days[0], { day: 'numeric', month: 'short' })} – {fmtDate(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <div className="text-xs text-slate-400">{program ? program.name : 'Nessun programma principale'}</div>
        </div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="btn-ghost text-sm" aria-label="Settimana successiva">›</button>
      </div>
      {!program && <Empty>Imposta un programma principale in “Schede” per vedere le attività previste.</Empty>}
      {days.map((d) => {
        const occs = occurrencesOn(state, d)
        const free = freeSessionsOn(state, d, occs)
        return (
          <div key={d} className={`rounded-2xl border p-3 ${d === today ? 'border-emerald-600 bg-slate-900' : 'border-slate-800 bg-slate-900/60'}`}>
            <div className="mb-2 text-sm font-semibold text-slate-200">
              {WEEKDAYS_SHORT[weekdayOf(d)]} {fmtDate(d, { day: 'numeric', month: 'short' })}
              {d === today && <span className="ml-2 text-xs text-emerald-400">oggi</span>}
            </div>
            <div className="space-y-2">
              {occs.map((o) => (
                <OccurrenceItem key={o.key} state={state} occ={o} update={update} onOpenSession={onOpenSession} onStart={onStart} />
              ))}
              {free.map((s) => (
                <SessionChip key={s.id} session={s} onOpen={onOpenSession} />
              ))}
              {!occs.length && !free.length && <div className="text-xs text-slate-500">Nessuna attività</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
