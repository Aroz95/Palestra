import { useState } from 'react'
import ExerciseCard from './ExerciseCard'
import CardioList from './CardioList'
import { TimesCard, FeedbackCard, EnergyCard, StatusSelect } from './SessionShared'
import { Card, Section, Sheet, Metric } from './ui'
import { fmtNum, strengthStats, progressionHint, sessionDuration } from '../lib/stats'
import { fmtDate, toLocalISO, minutesBetween } from '../lib/dates'
import { lastPerformance, newSessionExercise, sessionExerciseFromTemplate } from '../schema/factories'
import { autoStart } from '../lib/actions'
import { DEFAULT_REST } from '../schema/constants'

export default function SessionView({ session, state, onChange, timers, settings, onStartWorkout, onDelete, onExport }) {
  const [adding, setAdding] = useState(false)
  const stats = strengthStats(session)
  const template = state.workoutTemplates.find((t) => t.id === session.templateId)

  const set = (patch) => onChange({ ...session, ...patch })

  // La prima serie registrata fissa l'inizio della seduta (se non già indicato)
  const withStart = (s) => (s.exercises.some((e) => e.sets.some((x) => x.done)) ? autoStart(s) : s)
  const updateExercise = (id, ex) => onChange(withStart({ ...session, exercises: session.exercises.map((e) => (e.id === id ? ex : e)) }))
  const removeExercise = (id) => set({ exercises: session.exercises.filter((e) => e.id !== id) })

  const onSetDone = (ex) => {
    if (settings.autoRest && ex.type !== 'time') timers.startRest(ex.rest ?? DEFAULT_REST)
    if (!timers.running && timers.elapsed === 0) timers.startStopwatch()
  }

  const startTimed = (ex, i) =>
    timers.startRest(Number(ex.sets[i].durationSec) || 30, `${ex.name} — serie ${i + 1}`, {
      kind: 'work',
      target: { type: 'set', sessionId: session.id, exId: ex.id, setIdx: i },
    })

  // Esercizi aggiungibili: quelli delle schede (identità stabile) non già presenti, oppure liberi
  const inSession = new Set(session.exercises.map((e) => e.exerciseId))
  const candidates = []
  const seen = new Set()
  for (const t of [template, ...state.workoutTemplates.filter((x) => x.id !== template?.id && !x.archived)].filter(Boolean)) {
    for (const tex of t.exercises) {
      if (inSession.has(tex.id) || seen.has(tex.id)) continue
      seen.add(tex.id)
      candidates.push({ tex, from: `${t.label ? `${t.label} · ` : ''}${t.name}` })
    }
  }
  const addExercise = (tex) => {
    const ex = tex ? sessionExerciseFromTemplate(tex, lastPerformance(state.sessions, tex.id, { excludeSessionId: session.id, beforeDate: session.date })) : newSessionExercise()
    set({ exercises: [...session.exercises, ex] })
    setAdding(false)
  }

  const finish = () => {
    const endedAt = session.endedAt ?? (session.startedAt ? toLocalISO() : null)
    const patch = { status: 'completed', endedAt }
    if (session.durationSource !== 'manual') {
      const computed = minutesBetween(session.startedAt, endedAt)
      if (computed != null && computed > 0) Object.assign(patch, { durationMin: computed, durationSource: 'computed' })
      else if (timers.elapsed > 0) Object.assign(patch, { durationMin: Math.round(timers.elapsed / 60000), durationSource: 'stopwatch' })
    }
    timers.pauseStopwatch()
    timers.stopRest()
    set(patch)
  }

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
            className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-white outline-none"
          />
          <input
            type="date"
            value={session.date}
            aria-label="Data seduta"
            onChange={(e) => e.target.value && set({ date: e.target.value })}
            className="rounded-lg bg-slate-800 px-2 py-1 text-sm text-slate-200 [color-scheme:dark]"
          />
        </div>
        <p className="text-sm capitalize text-slate-400">{fmtDate(session.date)}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="w-40">
            <StatusSelect value={session.status} onChange={(status) => set({ status })} />
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
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 py-5 text-xl font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 transition active:scale-[0.98] disabled:opacity-40"
        >
          <span className="text-2xl">▶</span>
          {stats.doneSets > 0 || session.warmup.some((c) => c.done) ? 'Riprendi allenamento' : 'Inizia allenamento'}
        </button>
      )}

      <Card>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-300">Serie completate</span>
          <span className="font-semibold text-white">
            {stats.doneSets}/{stats.totalSets} · {pct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
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
              hint={progressionHint(lastPerformance(state.sessions, ex.exerciseId, { excludeSessionId: session.id, beforeDate: session.date }), ex.step)}
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
          <button onClick={finish} className="btn flex-1 bg-emerald-500 text-slate-950">Termina seduta</button>
        )}
        <button onClick={onExport} className="btn-ghost">Esporta JSON</button>
        <button onClick={() => confirm('Eliminare definitivamente questa seduta?') && onDelete()} className="rounded-xl px-3 py-2 text-sm text-rose-400">
          Elimina
        </button>
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Aggiungi esercizio">
        <div className="space-y-1">
          {candidates.map(({ tex, from }) => (
            <button key={tex.id} onClick={() => addExercise(tex)} className="block w-full rounded-lg px-3 py-2 text-left text-slate-200 active:bg-slate-800">
              {tex.name} <span className="text-xs text-slate-500">· {tex.group || '—'} · {from}</span>
            </button>
          ))}
          <button onClick={() => addExercise(null)} className="block w-full rounded-lg px-3 py-2 text-left text-emerald-400 active:bg-slate-800">
            + Esercizio libero
          </button>
        </div>
      </Sheet>
    </div>
  )
}
