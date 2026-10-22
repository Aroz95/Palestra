import { useState } from 'react'
import Stepper from './Stepper'

export default function ExerciseCard({ exercise, index, onChange, onRemove, onSetDone, onStartTimer }) {
  const ex = exercise
  const doneCount = ex.sets.filter((s) => s.done).length
  const allDone = ex.sets.length > 0 && doneCount === ex.sets.length
  const [open, setOpen] = useState(!allDone)
  const isTime = ex.type === 'time'

  const updateSet = (i, patch) => onChange({ ...ex, sets: ex.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  const toggleSet = (i) => {
    const done = !ex.sets[i].done
    updateSet(i, { done })
    if (done) onSetDone?.(ex, i)
  }

  const addSet = () => {
    const last = ex.sets[ex.sets.length - 1] ?? { reps: isTime ? 30 : 10, weight: 0 }
    onChange({ ...ex, sets: [...ex.sets, { reps: last.reps, weight: last.weight, done: false }] })
  }
  const removeSet = (i) => onChange({ ...ex, sets: ex.sets.filter((_, j) => j !== i) })
  const markAll = () => onChange({ ...ex, sets: ex.sets.map((s) => ({ ...s, done: !allDone })) })

  return (
    <div className={`rounded-2xl border ${allDone ? 'border-emerald-700/60 bg-emerald-950/30' : 'border-slate-800 bg-slate-900'}`}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            allDone ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
          }`}
        >
          {allDone ? '✓' : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-white">{ex.name}</div>
          <div className="truncate text-xs text-slate-400">
            {ex.group}
            {!open && ex.sets.length > 0 && <> · {summary(ex)}</>}
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${allDone ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
          {doneCount}/{ex.sets.length}
        </span>
        <span className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="border-t border-slate-800 px-3 pb-3 pt-2">
          {ex.sets.length > 0 && (
            <div className="mb-1 grid grid-cols-[1.5rem_1fr_1fr_3rem] items-center gap-2 px-1 text-[10px] uppercase tracking-wider text-slate-500">
              <span>#</span>
              <span className="text-center">{isTime ? '' : `Kg${ex.perHand ? ' / mano' : ''}`}</span>
              <span className="text-center">{isTime ? 'Secondi' : 'Ripetizioni'}</span>
              <span className="text-center">Fatto</span>
            </div>
          )}
          <ul className="space-y-2">
            {ex.sets.map((s, i) => (
              <li
                key={i}
                className={`grid grid-cols-[1.5rem_1fr_1fr_3rem] items-center gap-2 rounded-xl px-1 py-1 ${s.done ? 'bg-emerald-500/10' : ''}`}
              >
                <button
                  onClick={() => confirm(`Eliminare la serie ${i + 1}?`) && removeSet(i)}
                  className="text-sm font-semibold text-slate-400"
                  title="Elimina serie"
                >
                  {i + 1}
                </button>
                <div className="flex justify-center">
                  {isTime ? (
                    <button
                      onClick={() => onStartTimer?.(Number(s.reps) || 0, `${ex.name} — serie ${i + 1}`)}
                      className="rounded-xl bg-sky-700 px-3 py-2 text-sm font-semibold text-white active:bg-sky-600"
                    >
                      ▶ Avvia {s.reps}s
                    </button>
                  ) : (
                    <Stepper value={s.weight} step={ex.step || 1} onChange={(weight) => updateSet(i, { weight })} />
                  )}
                </div>
                <div className="flex justify-center">
                  <Stepper value={s.reps} step={isTime ? 5 : 1} onChange={(reps) => updateSet(i, { reps })} />
                </div>
                <button
                  onClick={() => toggleSet(i)}
                  aria-label={s.done ? 'Segna come non fatta' : 'Segna come fatta'}
                  className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl border-2 text-xl font-bold transition ${
                    s.done ? 'border-emerald-500 bg-emerald-500 text-slate-950' : 'border-slate-600 text-transparent active:border-emerald-500'
                  }`}
                >
                  ✓
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={addSet} className="btn-ghost text-sm">+ Serie</button>
            {ex.sets.length > 0 && (
              <button onClick={() => removeSet(ex.sets.length - 1)} className="btn-ghost text-sm">− Serie</button>
            )}
            {ex.sets.length > 0 && (
              <button onClick={markAll} className="btn-ghost text-sm">{allDone ? 'Annulla tutte' : 'Tutte fatte'}</button>
            )}
            <button
              onClick={() => confirm(`Rimuovere "${ex.name}" da questa seduta?`) && onRemove()}
              className="ml-auto rounded-xl px-3 py-2 text-sm text-rose-400 active:bg-rose-950"
            >
              Rimuovi
            </button>
          </div>

          <textarea
            value={ex.notes}
            onChange={(e) => onChange({ ...ex, notes: e.target.value })}
            placeholder="Note (sensazioni, regolazioni macchina…)"
            rows={1}
            className="mt-2 w-full resize-y rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      )}
    </div>
  )
}

function summary(ex) {
  if (ex.type === 'time') return `${ex.sets.length} × ${ex.sets.map((s) => s.reps).join('/')} s`
  const reps = [...new Set(ex.sets.map((s) => s.reps))].join('/')
  const kg = [...new Set(ex.sets.map((s) => s.weight))].join('/')
  return `${ex.sets.length} × ${reps} · ${kg} kg${ex.perHand ? ' per mano' : ''}`
}
