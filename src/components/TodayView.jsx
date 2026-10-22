import { useState } from 'react'
import { Card, Empty, Section, Sheet } from './ui'
import { OccurrenceItem, SessionChip, freeSessionsOn } from './CalendarView'
import { occurrencesOn, mainProgram } from '../lib/calendar'
import { fmtDate, todayISO, weekdayOf, timeOf } from '../lib/dates'
import { fmtNum } from '../lib/stats'
import { SESSION_STATUS } from '../schema/constants'

export default function TodayView({ state, update, onStart, onOpenSession, go }) {
  const today = todayISO()
  const occs = occurrencesOn(state, today)
  const free = freeSessionsOn(state, today, occs)
  const active = state.sessions.find((s) => s.id === state.activeSessionId && ['planned', 'in_progress'].includes(s.status))
  const program = mainProgram(state)
  const templates = state.workoutTemplates.filter((t) => !t.archived && (!program || t.programId === program.id))
  const [choose, setChoose] = useState(false)
  const lastMeasure = [...state.measurements].sort((a, b) => b.at.localeCompare(a.at))[0]
  const nothing = !state.programs.length && !state.sessions.length

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-white">Oggi</h1>
        <p className="text-sm capitalize text-slate-400">{fmtDate(today)}</p>
      </header>

      {nothing && (
        <Empty
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={() => go('training', 'programs')} className="btn bg-emerald-500 text-slate-950">Crea un programma</button>
              <button onClick={() => go('more', 'import')} className="btn-ghost">Importa JSON</button>
            </div>
          }
        >
          <p className="mb-1 text-base font-semibold text-white">Benvenuto!</p>
          Crea il tuo programma con le schede A/B e il calendario settimanale, oppure importa un file JSON (programma, piano alimentare, backup).
        </Empty>
      )}

      {active && active.date !== today && (
        <Card tone="info" className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-sky-300">{SESSION_STATUS[active.status]}</div>
            <div className="font-semibold text-white">{active.title || (active.kind === 'swim' ? 'Nuoto' : 'Seduta')}</div>
            <div className="text-xs text-slate-400">{active.date}</div>
          </div>
          <button onClick={() => onOpenSession(active.id)} className="btn bg-emerald-500 text-slate-950">Riprendi</button>
        </Card>
      )}

      <Section title="Attività di oggi">
        <div className="space-y-2">
          {occs.map((o) => (
            <OccurrenceItem key={o.key} state={state} occ={o} update={update} onOpenSession={onOpenSession} onStart={onStart} />
          ))}
          {free.map((s) => (
            <SessionChip key={s.id} session={s} onOpen={onOpenSession} />
          ))}
          {!occs.length && !free.length && !nothing && <p className="px-1 text-sm text-slate-400">Nessuna attività prevista oggi.</p>}
        </div>
      </Section>

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setChoose(true)} className="btn-ghost py-3 text-sm">🏋️ Attività libera</button>
        <button onClick={() => onStart({ kind: 'swim' })} className="btn-ghost py-3 text-sm">🏊 Aggiungi nuoto</button>
        <button onClick={() => go('more', 'measures')} className="btn-ghost py-3 text-sm">📏 Registra misura</button>
      </div>

      {templates.length > 0 && (
        <Section title="Accesso rapido">
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button key={t.id} onClick={() => onStart({ templateId: t.id })} className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-100">
                ▶ {t.label ? `${t.label} · ` : ''}{t.name}
              </button>
            ))}
          </div>
        </Section>
      )}

      <NextMeal state={state} go={go} />

      {lastMeasure && (
        <Section title="Ultima misura">
          <Card className="flex items-center justify-between py-3 text-sm">
            <span className="text-slate-300">
              {lastMeasure.at.slice(0, 10)} · {[lastMeasure.weightKg != null && `${fmtNum(lastMeasure.weightKg, 1)} kg`, lastMeasure.waistCm != null && `vita ${fmtNum(lastMeasure.waistCm, 1)} cm`, lastMeasure.abdomenCm != null && `addome ${fmtNum(lastMeasure.abdomenCm, 1)} cm`].filter(Boolean).join(' · ')}
            </span>
            <button onClick={() => go('more', 'measures')} className="text-xs text-emerald-400">Misure</button>
          </Card>
        </Section>
      )}

      <Sheet open={choose} onClose={() => setChoose(false)} title="Attività libera">
        <div className="space-y-1">
          {state.workoutTemplates.filter((t) => !t.archived).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setChoose(false)
                onStart({ templateId: t.id })
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-slate-200 active:bg-slate-800"
            >
              {t.label ? `${t.label} · ` : ''}
              {t.name} <span className="text-xs text-slate-500">· {t.exercises.length} esercizi</span>
            </button>
          ))}
          <button
            onClick={() => {
              setChoose(false)
              onStart({ templateId: null })
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-emerald-400 active:bg-slate-800"
          >
            + Seduta di palestra libera (vuota)
          </button>
        </div>
      </Sheet>
    </div>
  )
}

// Solo il pasto corrente/prossimo: il diario è facoltativo
function NextMeal({ state, go }) {
  const plan = state.dietPlans.find((d) => d.active && !d.archived)
  if (!plan) return null
  const today = todayISO()
  const days = plan.days.filter((d) => (d.date ? d.date === today : d.weekday === weekdayOf(today)))
  const training = occurrencesOn(state, today).some((o) => o.kind === 'strength' || o.kind === 'swim')
  const day = days.find((d) => d.dayType === (training ? 'training' : 'rest')) ?? days.find((d) => d.dayType === 'any') ?? days[0]
  if (!day?.meals.length) return null
  const now = timeOf(new Date().toISOString())
  const meals = [...day.meals].sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
  const next = meals.find((m) => m.time && m.time >= now) ?? meals[meals.length - 1]
  return (
    <Section title="Prossimo pasto" right={<button onClick={() => go('diet')} className="text-xs text-emerald-400">Piano</button>}>
      <Card className="space-y-1 py-3">
        <div className="flex justify-between">
          <span className="font-semibold text-white">{next.label}</span>
          <span className="text-sm text-slate-400">{next.time ?? ''}</span>
        </div>
        <p className="text-sm text-slate-300">{next.items.map((i) => `${i.name}${i.quantity != null ? ` ${fmtNum(i.quantity, 1)} ${i.unit}` : ''}`).join(' · ') || '—'}</p>
        {next.alternatives.length > 0 && <p className="text-xs text-slate-500">{next.alternatives.length} alternative disponibili</p>}
      </Card>
    </Section>
  )
}
