import { useMemo, useState } from 'react'
import ExerciseCard from './ExerciseCard'
import CardioList from './CardioList'
import { TimesCard, FeedbackCard, EnergyCard, StatusSelect } from './SessionShared'
import { Card, Section, Sheet, Metric } from './ui'
import { fmtNum, strengthStats, sessionDuration } from '../lib/stats'
import { fmtDate } from '../lib/dates'
import { lastPerformance, newSessionExercise, sessionExerciseFromTemplate } from '../schema/factories'
import { withAutoStart } from '../lib/actions'
import { DEFAULT_REST } from '../schema/constants'
import ExercisePicker, { buildCandidates } from './ExercisePicker'

export default function SessionView({ session, state, onChange, timers, settings, onStartWorkout, onFinish, onDelete, onExport }) {
  const [adding, setAdding] = useState(false)
  const stats = strengthStats(session)
  const template = state.workoutTemplates.find((t) => t.id === session.templateId)

  // La prima attività completata (serie, riscaldamento, defaticamento) fissa l'inizio della seduta, se non già indicato
  const set = (patch) => onChange(withAutoStart(session, { ...session, ...patch }))
  const updateExercise = (id, ex) => set({ exercises: session.exercises.map((e) => (e.id === id ? ex : e)) })
  const removeExercise = (id) => set({ exercises: session.exercises.filter((e) => e.id !== id) })

  const onSetDone = (ex, i) => {
    if (settings.autoRest && ex.type !== 'time') timers.startRest(ex.rest ?? DEFAULT_REST, 'Recupero', { target: { type: 'rest', sessionId: session.id, exId: ex.id, setIdx: i } })
    if (!timers.running && timers.elapsed === 0) timers.startStopwatch()
  }

  const startTimed = (ex, i) =>
    timers.startRest(Number(ex.sets[i].durationSec) || 30, `${ex.name} — serie ${i + 1}`, {
      kind: 'work',
      target: { type: 'set', sessionId: session.id, exId: ex.id, setIdx: i },
    })

  // Esercizi aggiungibili (CAT-01): schede + catalogo, un risultato per esercizio canonico; quelli già presenti segnalati
  const candidates = useMemo(
    () => (adding ? buildCandidates({ templates: state.workoutTemplates.filter((t) => !t.archived || t.id === template?.id), currentTemplateId: template?.id, sessionExercises: session.exercises }) : []),
    [adding, state.workoutTemplates, template?.id, session.exercises],
  )
  const addExercise = (tex, customName) => {
    const ex = tex ? sessionExerciseFromTemplate(tex, lastPerformance(state.sessions, tex, { excludeSessionId: session.id, beforeDate: session.date })) : newSessionExercise(customName ? { name: customName } : {})
    set({ exercises: [...session.exercises, ex] })
    setAdding(false)
    // riscontro immediato: il nuovo esercizio viene portato in vista
    requestAnimationFrame(() => document.getElementById(`exercise-${ex.id}`)?.scrollIntoView({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
  }

  // Esercizio completato: porta in vista il successivo da fare (solo se fuori schermo; nessuno spostamento del focus)
  const revealNext = (id) => {
    const i = session.exercises.findIndex((e) => e.id === id)
    const next = [...session.exercises.slice(i + 1), ...session.exercises.slice(0, i)].find((e) => e.sets.some((s) => !s.done))
    if (!next) return
    requestAnimationFrame(() => {
      const el = document.getElementById(`exercise-${next.id}`)
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.top >= 0 && r.top + Math.min(r.height, 160) <= window.innerHeight - 80) return
      const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' })
    })
  }

  // Fine seduta (anche scegliendo "Completata" dallo stato): flusso unico di App (avviso, salvataggio, esportazione, riepilogo)
  const finish = () => onFinish(session)

  const pct = stats.totalSets ? Math.round((stats.doneSets / stats.totalSets) * 100) : 0
  const hasSteps = session.exercises.length + session.warmup.length + session.cooldown.length > 0
  const d = sessionDuration(session)

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={session.title}
            onChange={(e) => set({ title: e.target.value })}
            aria-label="Titolo seduta"
            className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-fg outline-none"
          />
          <input
            type="date"
            value={session.date}
            aria-label="Data seduta"
            onChange={(e) => e.target.value && set({ date: e.target.value })}
            className="rounded-lg border border-line-strong bg-surface px-2 py-1 text-sm text-fg"
          />
        </div>
        <p className="text-sm capitalize text-muted">{fmtDate(session.date)}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="w-40">
            <StatusSelect value={session.status} onChange={(status) => (status === 'completed' && session.status !== 'completed' ? finish() : onChange({ ...session, status }))} />
          </span>
          {template ? (
            <span>
              Scheda {template.label} · revisione {session.templateRevision ?? 'non nota'}
              {session.templateRevision && template.revision !== session.templateRevision ? ` (attuale: ${template.revision})` : ''}
            </span>
          ) : (
            <span>{session.templateId ? 'Scheda non più presente' : 'Seduta libera'}</span>
          )}
        </div>
      </header>

      {session.status !== 'completed' && (
        <button
          onClick={onStartWorkout}
          disabled={!hasSteps}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-5 text-xl font-extrabold text-on-primary shadow-lg transition active:scale-[0.98] disabled:opacity-40"
        >
          <span className="text-2xl">▶</span>
          {stats.doneSets > 0 || session.warmup.some((c) => c.done) ? 'Riprendi allenamento' : 'Inizia allenamento'}
        </button>
      )}

      <Card>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-fg-soft">Serie completate</span>
          <span className="font-semibold text-fg">
            {stats.doneSets}/{stats.totalSets} · {pct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Metric label="Ripetizioni" value={fmtNum(stats.reps, 0)} />
          <Metric label="Volume" value={fmtNum(stats.volume, 0)} unit="kg" hint={stats.volumePartial ? 'parziale' : 'nominale'} />
          <Metric label="Durata" value={d.min} unit="min" />
        </dl>
      </Card>

      <CardioList title="Riscaldamento" items={session.warmup} onChange={(warmup) => set({ warmup })} />

      <Section title="Sala pesi">
        <div className="space-y-2">
          {session.exercises.map((ex, i) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              index={i}
              onChange={(e) => updateExercise(ex.id, e)}
              onRemove={() => removeExercise(ex.id)}
              onSetDone={onSetDone}
              onStartTimer={startTimed}
              onCompleted={() => revealNext(ex.id)}
              previous={lastPerformance(state.sessions, ex, { excludeSessionId: session.id, beforeDate: session.date })}
            />
          ))}
        </div>
        <button onClick={() => setAdding(true)} className="btn-ghost mt-2 w-full text-sm">+ Aggiungi esercizio</button>
      </Section>

      <CardioList title="Defaticamento" items={session.cooldown} onChange={(cooldown) => set({ cooldown })} />

      <TimesCard session={session} onChange={onChange} timers={timers} />
      <FeedbackCard session={session} onChange={onChange} />
      <EnergyCard session={session} onChange={onChange} measurements={state.measurements} />

      <div className="flex flex-wrap gap-2">
        {session.status !== 'completed' && (
          <button onClick={finish} className="btn flex-1 bg-primary text-on-primary">Termina seduta</button>
        )}
        <button onClick={onExport} className="btn-ghost">Esporta JSON</button>
        <button onClick={() => confirm('Eliminare definitivamente questa seduta?') && onDelete()} className="rounded-xl px-3 py-2 text-sm text-danger">
          Elimina
        </button>
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Aggiungi esercizio">
        <ExercisePicker candidates={candidates} onPick={(tex) => addExercise(tex)} onCustom={(name) => addExercise(null, name)} />
      </Sheet>
    </div>
  )
}
