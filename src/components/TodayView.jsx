import { useState } from 'react'
import { Card, Empty, Section, Sheet } from './ui'
import { OccurrenceItem, SessionChip, freeSessionsOn } from './CalendarView'
import { occurrencesOn, mainProgram, activityOn } from '../lib/calendar'
import { fmtDate, todayISO, weekdayOf, timeOf, localDate } from '../lib/dates'
import { fmtNum } from '../lib/stats'
import { pickDay, nextMeal, optionOf, selectionsFor, sortedMeals } from '../lib/diet'
import { itemText } from '../lib/mealReminders'
import * as A from '../lib/actions'
import { SESSION_STATUS } from '../schema/constants'

export default function TodayView({ state, update, onStart, onOpenSession, go }) {
  const today = todayISO()
  const occs = occurrencesOn(state, today)
  const free = freeSessionsOn(state, today, occs)
  const active = state.sessions.find((s) => s.id === state.activeSessionId && ['planned', 'in_progress'].includes(s.status))
  const program = mainProgram(state)
  const templates = state.workoutTemplates.filter((t) => !t.archived && (!program || t.programId === program.id))
  const [choose, setChoose] = useState(false)
  const lastMeasure = [...state.measurements].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]
  const nothing = !state.programs.length && !state.sessions.length
  // CTA principale unica: riprendi la seduta aperta; altrimenti, se oggi non c'è un'attività da avviare, inizia un allenamento
  const pending = occs.some((o) => (o.kind === 'strength' || o.kind === 'swim') && ['planned', 'missed'].includes(o.status))

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[28px] font-bold leading-tight text-fg lg:text-[32px]">Oggi</h1>
        <p className="text-sm capitalize text-muted">{fmtDate(today)}</p>
      </header>

      {nothing && (
        <Empty
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={() => go('training', 'programs')} className="btn-primary">Crea un programma</button>
              <button onClick={() => go('more', 'import')} className="btn-ghost">Importa JSON</button>
            </div>
          }
        >
          <p className="mb-1 text-base font-semibold text-fg">Benvenuto!</p>
          Crea il tuo programma con le schede A/B e il calendario settimanale, oppure importa un file JSON (programma, piano alimentare, backup).
        </Empty>
      )}

      {active ? (
        <Card tone="done" className="anim-fade-up space-y-3">
          <div>
            <div className="text-xs font-semibold text-primary">{SESSION_STATUS[active.status]}</div>
            <div className="text-lg font-semibold text-fg">{active.title || (active.kind === 'swim' ? 'Nuoto' : 'Seduta')}</div>
            {active.date !== today && <div className="text-xs text-muted">{fmtDate(active.date)}</div>}
          </div>
          <button onClick={() => onOpenSession(active.id)} className="btn-primary w-full text-lg">Riprendi allenamento</button>
        </Card>
      ) : (
        !nothing &&
        !pending && (
          <button onClick={() => setChoose(true)} className="btn-primary anim-fade-up min-h-14 w-full text-lg">
            Inizia allenamento
          </button>
        )
      )}

      <Section title="Attività di oggi">
        <div className="space-y-2">
          {occs.map((o) => (
            <OccurrenceItem key={o.key} state={state} occ={o} update={update} onOpenSession={onOpenSession} onStart={onStart} />
          ))}
          {free.map((s) => (
            <SessionChip key={s.id} session={s} onOpen={onOpenSession} />
          ))}
          {!occs.length && !free.length && !nothing && <p className="px-1 text-sm text-muted">Nessuna attività prevista oggi.</p>}
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {pending && <button onClick={() => setChoose(true)} className="btn-ghost text-sm">Attività libera</button>}
        <button onClick={() => onStart({ kind: 'swim' })} className="btn-ghost text-sm">Aggiungi nuoto</button>
        <button onClick={() => go('more', 'measures')} className="btn-ghost text-sm">Registra misura</button>
      </div>

      {templates.length > 0 && (
        <Section title="Accesso rapido">
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button key={t.id} onClick={() => onStart({ templateId: t.id })} className="btn-ghost text-sm">
                ▶ {t.label ? `${t.label} · ` : ''}{t.name}
              </button>
            ))}
          </div>
        </Section>
      )}

      <NextMeal state={state} go={go} update={update} />

      {lastMeasure && (
        <Section title="Ultima misura">
          <Card className="flex items-center justify-between py-3 text-sm">
            <span className="text-fg-soft">
              {localDate(lastMeasure.at)} · {[lastMeasure.weightKg != null && `${fmtNum(lastMeasure.weightKg, 1)} kg`, lastMeasure.waistCm != null && `vita ${fmtNum(lastMeasure.waistCm, 1)} cm`, lastMeasure.abdomenCm != null && `addome ${fmtNum(lastMeasure.abdomenCm, 1)} cm`].filter(Boolean).join(' · ')}
            </span>
            <button onClick={() => go('more', 'measures')} className="text-xs text-primary">Misure</button>
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
              className="block w-full rounded-lg px-3 py-2 text-left text-fg active:bg-surface-muted"
            >
              {t.label ? `${t.label} · ` : ''}
              {t.name} <span className="text-xs text-muted">· {t.exercises.length} esercizi</span>
            </button>
          ))}
          <button
            onClick={() => {
              setChoose(false)
              onStart({ templateId: null })
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-primary active:bg-surface-muted"
          >
            + Seduta di palestra libera (vuota)
          </button>
        </div>
      </Sheet>
    </div>
  )
}

// Solo il pasto corrente/prossimo: il diario è facoltativo
function NextMeal({ state, go, update }) {
  const plan = state.dietPlans.find((d) => d.active && !d.archived)
  if (!plan) return null
  const today = todayISO()
  const training = activityOn(state, today)
  const { day } = pickDay(plan, today, { isTraining: training })
  if (!day?.meals.length) return null
  // il primo pasto non ancora registrato da adesso in poi (altrimenti quello d'orario), con l'alternativa scelta per oggi
  const logged = new Set(state.dietLog.filter((l) => l.date === today && l.planId === plan.id).map((l) => l.mealId))
  const now = timeOf(new Date().toISOString())
  const next = sortedMeals(day).find((m) => !logged.has(m.id) && m.time && m.time >= now) ?? nextMeal(day, now)
  const option = optionOf(next, selectionsFor(state, today, plan.id)[next.id])
  const done = logged.has(next.id)
  return (
    <Section title="Prossimo pasto" right={<button onClick={() => go('diet')} className="text-xs text-primary">Piano</button>}>
      <Card className="space-y-1 py-3">
        <div className="flex justify-between">
          <span className="font-semibold text-fg">{next.label}</span>
          <span className="text-sm text-muted">{next.time ?? ''}</span>
        </div>
        <p className="text-sm text-fg-soft">{option.items.map(itemText).join(' · ') || '—'}</p>
        {next.alternatives.length > 0 && <p className="text-xs text-muted">{option.id ? `Alternativa scelta: ${option.label}` : `${next.alternatives.length} alternative disponibili`}</p>}
        {done ? (
          <p className="text-sm font-semibold text-primary">✓ Registrato</p>
        ) : (
          <button onClick={() => update((s) => A.logMeal(s, { date: today, planId: plan.id, planRevision: plan.revision, mealId: next.id, status: 'followed' }))} className="btn-ghost mt-1 w-full text-sm">
            Segna consumato
          </button>
        )}
      </Card>
    </Section>
  )
}
