import { useState } from 'react'
import ExerciseCard from './ExerciseCard'
import CardioList from './CardioList'
import Stepper from './Stepper'
import { fmtDate, fmtNum, sessionStats } from '../lib/stats'
import { DEFAULT_REST, newExerciseFromTemplate, uid } from '../data/defaultData'

export default function SessionView({ session, template, onChange, timers, settings, onNewSession, onStartWorkout }) {
  const [adding, setAdding] = useState(false)

  if (!session) {
    return (
      <div className="py-16 text-center">
        <p className="mb-4 text-slate-400">Nessuna seduta selezionata.</p>
        <button onClick={onNewSession} className="btn bg-emerald-500 text-slate-950">Inizia nuova seduta</button>
      </div>
    )
  }

  const stats = sessionStats(session)
  const set = (patch) => onChange({ ...session, ...patch })
  const updateExercise = (id, ex) => set({ exercises: session.exercises.map((e) => (e.id === id ? ex : e)) })
  const removeExercise = (id) => set({ exercises: session.exercises.filter((e) => e.id !== id) })

  const onSetDone = (ex) => {
    if (settings.autoRest && ex.type !== 'time') timers.startRest(ex.rest ?? DEFAULT_REST)
    if (!timers.running && timers.elapsed === 0) timers.startStopwatch()
  }

  const missing = template.exercises.filter((t) => !session.exercises.some((e) => e.templateId === t.id))
  const addExercise = (tpl) => {
    const ex = tpl
      ? newExerciseFromTemplate(tpl)
      : { id: uid(), templateId: null, name: 'Nuovo esercizio', group: '', type: 'reps', perHand: false, step: 2.5, rest: DEFAULT_REST, notes: '', sets: [{ reps: 10, weight: 10, done: false }] }
    set({ exercises: [...session.exercises, ex] })
    setAdding(false)
  }

  const pct = stats.totalSets ? Math.round((stats.doneSets / stats.totalSets) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Intestazione */}
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={session.title}
            onChange={(e) => set({ title: e.target.value })}
            className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-white outline-none"
          />
          <input
            type="date"
            value={session.date}
            onChange={(e) => e.target.value && set({ date: e.target.value })}
            className="rounded-lg bg-slate-800 px-2 py-1 text-sm text-slate-200 [color-scheme:dark]"
          />
        </div>
        <p className="text-sm capitalize text-slate-400">{fmtDate(session.date)}</p>
        {session.note && (
          <div className="rounded-xl border border-amber-700/50 bg-amber-950/40 p-3 text-sm text-amber-200">
            <span className="font-semibold">Nota: </span>
            {session.note}
          </div>
        )}
      </header>

      <button
        onClick={onStartWorkout}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 py-5 text-xl font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        <span className="text-2xl">▶</span>
        {stats.doneSets > 0 || session.warmup.some((c) => c.done) ? 'Riprendi allenamento' : 'Inizia allenamento'}
      </button>

      {/* Avanzamento */}
      <div className="rounded-2xl bg-slate-900 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-300">Serie completate</span>
          <span className="font-semibold text-white">
            {stats.doneSets}/{stats.totalSets} · {pct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Ripetizioni" value={fmtNum(stats.reps, 0)} />
          <Stat label="Volume" value={`${fmtNum(stats.volume, 0)} kg`} />
          <Stat label="Cardio" value={`${fmtNum(stats.cardioMin)} min`} />
        </dl>
      </div>

      <CardioList title="Riscaldamento" items={session.warmup} onChange={(warmup) => set({ warmup })} />

      <section>
        <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-slate-300">Sala pesi</h2>
        <div className="space-y-2">
          {session.exercises.map((ex, i) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              index={i}
              onChange={(e) => updateExercise(ex.id, e)}
              onRemove={() => removeExercise(ex.id)}
              onSetDone={onSetDone}
              onStartTimer={(sec, label) => timers.startRest(sec, label)}
            />
          ))}
        </div>
        {adding ? (
          <div className="mt-2 space-y-1 rounded-2xl border border-slate-800 bg-slate-900 p-2">
            {missing.map((t) => (
              <button key={t.id} onClick={() => addExercise(t)} className="block w-full rounded-lg px-3 py-2 text-left text-slate-200 active:bg-slate-800">
                {t.name} <span className="text-xs text-slate-500">· {t.group}</span>
              </button>
            ))}
            <button onClick={() => addExercise(null)} className="block w-full rounded-lg px-3 py-2 text-left text-emerald-400 active:bg-slate-800">
              + Esercizio libero
            </button>
            <button onClick={() => setAdding(false)} className="block w-full rounded-lg px-3 py-2 text-left text-slate-500">
              Annulla
            </button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="btn-ghost mt-2 w-full text-sm">+ Aggiungi esercizio</button>
        )}
      </section>

      <CardioList title="Defaticamento" items={session.cooldown} onChange={(cooldown) => set({ cooldown })} />

      {/* Chiusura seduta */}
      <section className="rounded-2xl bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-300">Durata seduta</h2>
        <div className="flex flex-wrap items-end gap-3">
          <Stepper label="Minuti" value={session.durationMin ?? 0} step={5} onChange={(durationMin) => set({ durationMin })} />
          {timers.elapsed > 0 && (
            <button onClick={() => set({ durationMin: Math.round(timers.elapsed / 60000) })} className="btn-ghost text-sm">
              Usa cronometro ({Math.round(timers.elapsed / 60000)} min)
            </button>
          )}
        </div>
        <textarea
          value={session.note}
          onChange={(e) => set({ note: e.target.value })}
          placeholder="Note sulla seduta"
          rows={2}
          className="mt-3 w-full rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </section>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-800/60 px-2 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="font-semibold text-white">{value}</dd>
    </div>
  )
}
