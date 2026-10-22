import { useState } from 'react'
import Stepper from './Stepper'
import { Rating, Sheet, TextInput, Field } from './ui'
import { fmtClock } from '../lib/stats'
import { toLocalISO } from '../lib/dates'
import { DEFAULT_REST } from '../schema/constants'

export function targetText(ex) {
  const t = ex.target ?? ex.sets[0]?.target
  if (!t) return null
  const parts = []
  if (ex.type === 'time') {
    if (t.durationSec) parts.push(`${t.sets ?? ex.sets.length} × ${t.durationSec} s`)
  } else {
    const reps = t.repMin != null && t.repMax != null && t.repMin !== t.repMax ? `${t.repMin}–${t.repMax}` : (t.repMax ?? t.repMin)
    if (reps != null) parts.push(`${t.sets ?? ex.sets.length} × ${reps}`)
    if (t.weightKg != null) parts.push(`${String(t.weightKg).replace('.', ',')} kg${ex.perHand ? ' per mano' : ''}`)
    if (t.rir != null) parts.push(`RIR ${t.rir}`)
  }
  return parts.join(' · ') || null
}

export function summaryText(ex) {
  if (ex.type === 'time') return `${ex.sets.length} × ${ex.sets.map((s) => s.durationSec).join('/')} s`
  const reps = [...new Set(ex.sets.map((s) => s.reps))].join('/')
  const kg = [...new Set(ex.sets.map((s) => (s.weight == null ? '?' : s.weight)))].join('/')
  return `${ex.sets.length} × ${reps} · ${kg} kg${ex.perHand ? ' per mano' : ''}`
}

export default function ExerciseCard({ exercise, index, onChange, onRemove, onSetDone, onStartTimer, hint }) {
  const ex = exercise
  const doneCount = ex.sets.filter((s) => s.done).length
  const allDone = ex.sets.length > 0 && doneCount === ex.sets.length
  const [open, setOpen] = useState(!allDone)
  const [detail, setDetail] = useState(null)
  const isTime = ex.type === 'time'
  const target = targetText(ex)

  const updateSet = (i, patch) => onChange({ ...ex, sets: ex.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  const toggleSet = (i) => {
    const done = !ex.sets[i].done
    updateSet(i, { done, at: done ? toLocalISO() : null })
    if (done) onSetDone?.(ex, i)
  }

  const addSet = () => {
    const last = ex.sets[ex.sets.length - 1]
    const base = last ? { ...last } : isTime ? { durationSec: 30, target: null } : { reps: 10, weight: null, target: null }
    onChange({ ...ex, sets: [...ex.sets, { ...base, done: false, rir: null, rpe: null, pain: null, note: '', at: null }] })
  }
  const removeSet = (i) => onChange({ ...ex, sets: ex.sets.filter((_, j) => j !== i) })
  const markAll = () => onChange({ ...ex, sets: ex.sets.map((s) => ({ ...s, done: !allDone, at: !allDone ? (s.at ?? toLocalISO()) : null })) })

  return (
    <div className={`rounded-2xl border ${allDone ? 'border-emerald-700/60 bg-emerald-950/30' : 'border-slate-800 bg-slate-900'}`}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open}>
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
            {!open && ex.sets.length > 0 && <> · {summaryText(ex)}</>}
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${allDone ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
          {doneCount}/{ex.sets.length}
        </span>
        <span className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="border-t border-slate-800 px-3 pb-3 pt-2">
          {(target || hint || ex.instructions) && (
            <div className="mb-2 space-y-1 px-1 text-xs">
              {target && (
                <div className="text-slate-300">
                  <span className="font-semibold text-sky-300">Obiettivo</span> {target} · recupero {fmtClock((ex.rest ?? DEFAULT_REST) * 1000)}
                </div>
              )}
              {ex.instructions && <div className="text-slate-400">{ex.instructions}</div>}
              {hint && <div className="text-amber-300/90">{hint}</div>}
            </div>
          )}
          {ex.sets.length > 0 && (
            <div className="mb-1 grid grid-cols-[1.75rem_1fr_1fr_3rem] items-center gap-2 px-1 text-[10px] uppercase tracking-wider text-slate-500">
              <span>#</span>
              <span className="text-center">{isTime ? '' : `Kg eseguiti${ex.perHand ? ' / mano' : ''}`}</span>
              <span className="text-center">{isTime ? 'Secondi' : 'Ripetizioni'}</span>
              <span className="text-center">Fatto</span>
            </div>
          )}
          <ul className="space-y-2">
            {ex.sets.map((s, i) => (
              <li key={i} className={`rounded-xl px-1 py-1 ${s.done ? 'bg-emerald-500/10' : ''}`}>
                <div className="grid grid-cols-[1.75rem_1fr_1fr_3rem] items-center gap-2">
                  <button
                    onClick={() => setDetail(i)}
                    className="h-9 rounded-lg bg-slate-800 text-sm font-semibold text-slate-300"
                    aria-label={`Dettagli serie ${i + 1}`}
                    title="RIR, fastidio, note, elimina"
                  >
                    {i + 1}
                  </button>
                  <div className="flex justify-center">
                    {isTime ? (
                      <button
                        onClick={() => onStartTimer?.(ex, i)}
                        className="rounded-xl bg-sky-700 px-3 py-2 text-sm font-semibold text-white active:bg-sky-600"
                      >
                        ▶ Avvia {s.durationSec}s
                      </button>
                    ) : (
                      <Stepper value={s.weight} step={ex.step || 1} onChange={(weight) => updateSet(i, { weight })} label={null} />
                    )}
                  </div>
                  <div className="flex justify-center">
                    {isTime ? (
                      <Stepper value={s.durationSec} step={5} onChange={(durationSec) => updateSet(i, { durationSec })} />
                    ) : (
                      <Stepper value={s.reps} step={1} onChange={(reps) => updateSet(i, { reps })} />
                    )}
                  </div>
                  <button
                    onClick={() => toggleSet(i)}
                    aria-label={s.done ? `Serie ${i + 1}: segna come non fatta` : `Serie ${i + 1}: segna come fatta`}
                    aria-pressed={s.done}
                    className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl border-2 text-xl font-bold transition ${
                      s.done ? 'border-emerald-500 bg-emerald-500 text-slate-950' : 'border-slate-600 text-transparent active:border-emerald-500'
                    }`}
                  >
                    ✓
                  </button>
                </div>
                {(s.rir != null || s.rpe != null || s.pain || s.note) && (
                  <div className="mt-1 flex flex-wrap gap-1 pl-9 text-[11px]">
                    {s.rir != null && <span className="rounded bg-slate-800 px-1.5 text-slate-300">RIR {s.rir}</span>}
                    {s.rpe != null && <span className="rounded bg-slate-800 px-1.5 text-slate-300">RPE {s.rpe}</span>}
                    {s.pain && <span className="rounded bg-rose-900/60 px-1.5 text-rose-200">Fastidio {s.pain.location} {s.pain.intensity ?? ''}</span>}
                    {s.note && <span className="rounded bg-slate-800 px-1.5 text-slate-400">{s.note}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={addSet} className="btn-ghost text-sm">+ Serie</button>
            {ex.sets.length > 0 && (
              <button
                onClick={() => (!ex.sets[ex.sets.length - 1].done || confirm('L’ultima serie è già registrata come fatta. Eliminarla?')) && removeSet(ex.sets.length - 1)}
                className="btn-ghost text-sm"
              >
                − Serie
              </button>
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
            aria-label={`Note ${ex.name}`}
            rows={1}
            className="mt-2 w-full resize-y rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      )}

      <SetDetail
        open={detail != null}
        set={detail != null ? ex.sets[detail] : null}
        index={detail}
        isTime={isTime}
        onClose={() => setDetail(null)}
        onChange={(patch) => updateSet(detail, patch)}
        onRemove={() => {
          if (!ex.sets[detail].done || confirm(`La serie ${detail + 1} è registrata come fatta. Eliminarla?`)) {
            removeSet(detail)
            setDetail(null)
          }
        }}
      />
    </div>
  )
}

// Campi facoltativi della serie: nessuno è obbligatorio
export function SetDetail({ open, set, index, isTime, onClose, onChange, onRemove }) {
  if (!open || !set) return null
  const t = set.target
  return (
    <Sheet open={open} onClose={onClose} title={`Serie ${index + 1}`}>
      <div className="space-y-4">
        {t && (
          <p className="text-sm text-slate-400">
            Obiettivo:{' '}
            {isTime
              ? `${t.durationSec ?? '—'} s`
              : `${t.repMin === t.repMax ? (t.repMax ?? '—') : `${t.repMin}–${t.repMax}`} rip.${t.weightKg != null ? ` · ${t.weightKg} kg` : ''}${t.rir != null ? ` · RIR ${t.rir}` : ''}`}
          </p>
        )}
        {!isTime && (
          <Field label="RIR — ripetizioni in riserva (facoltativo)" hint="0 = cedimento, 5 = molto facile">
            <Rating value={set.rir} onChange={(rir) => onChange({ rir })} min={0} max={5} />
          </Field>
        )}
        <Field label="RPE — sforzo percepito (facoltativo)">
          <Rating value={set.rpe} onChange={(rpe) => onChange({ rpe })} min={1} max={10} />
        </Field>
        <Field label="Dolore / fastidio (facoltativo)">
          <div className="space-y-2">
            <TextInput
              value={set.pain?.location ?? ''}
              placeholder="Zona (es. spalla destra)"
              onChange={(location) => onChange({ pain: location || set.pain?.intensity != null ? { location, intensity: set.pain?.intensity ?? null } : null })}
            />
            <Rating
              value={set.pain?.intensity ?? null}
              min={0}
              max={10}
              onChange={(intensity) => onChange({ pain: intensity != null || set.pain?.location ? { location: set.pain?.location ?? '', intensity } : null })}
            />
          </div>
        </Field>
        <Field label="Nota">
          <TextInput value={set.note} onChange={(note) => onChange({ note })} placeholder="Nota sulla serie" />
        </Field>
        <div className="flex justify-between">
          <button onClick={onRemove} className="rounded-xl px-3 py-2 text-sm text-rose-400 active:bg-rose-950">Elimina serie</button>
          <button onClick={onClose} className="btn bg-emerald-500 text-slate-950">Fatto</button>
        </div>
      </div>
    </Sheet>
  )
}
