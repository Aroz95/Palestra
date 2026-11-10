import { useEffect, useRef, useState } from 'react'
import Stepper from './Stepper'
import { Rating, Sheet, TextInput, Field } from './ui'
import { fmtClock } from '../lib/stats'
import { toLocalISO } from '../lib/dates'
import { DEFAULT_REST } from '../schema/constants'
import PreviousPerformance from './PreviousPerformance'
import ExerciseThumb from './ExerciseThumb'

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

export default function ExerciseCard({ exercise, index, onChange, onRemove, onSetDone, onStartTimer, onCompleted, previous }) {
  const ex = exercise
  const doneCount = ex.sets.filter((s) => s.done).length
  const allDone = ex.sets.length > 0 && doneCount === ex.sets.length
  const [open, setOpen] = useState(!allDone)
  // Si chiude da sola quando l'ultima serie viene completata e si riapre se una serie torna da fare;
  // un'apertura manuale di una card completata non viene più toccata (solo i passaggi di stato contano)
  const wasDone = useRef(allDone)
  useEffect(() => {
    if (allDone && !wasDone.current) {
      setOpen(false)
      onCompleted?.()
    } else if (!allDone && wasDone.current) setOpen(true)
    wasDone.current = allDone
  }, [allDone]) // eslint-disable-line react-hooks/exhaustive-deps
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
    <div id={`exercise-${ex.id}`} className={`scroll-mt-28 rounded-2xl border ${allDone ? 'border-primary/50 bg-primary-soft' : 'border-line bg-surface'}`}>
      <button onClick={() => setOpen((v) => !v)} className="flex min-h-16 w-full items-center gap-2.5 px-3 py-3 text-left min-[360px]:gap-3 min-[360px]:px-4" aria-expanded={open}>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            allDone ? 'bg-primary text-on-primary' : 'bg-surface-muted text-fg-soft'
          }`}
        >
          {allDone ? '✓' : index + 1}
        </span>
        <ExerciseThumb ex={ex} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-fg">{ex.name}</div>
          <div className="truncate text-xs text-muted">
            {ex.group}
            {!open && ex.sets.length > 0 && <> · {summaryText(ex)}</>}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${allDone ? 'bg-primary-soft text-primary' : 'bg-surface-muted text-fg-soft'}`}>
          {doneCount}/{ex.sets.length}
        </span>
        <span className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="border-t border-line px-2 pb-3 pt-2 min-[360px]:px-3">
          <div className="mb-2 space-y-2 px-1">
            {(target || ex.instructions) && (
              <div className="space-y-1 text-sm">
                {target && (
                  <div className="text-fg-soft">
                    <span className="font-semibold text-fg">Obiettivo</span> {target} · recupero {fmtClock((ex.rest ?? DEFAULT_REST) * 1000)}
                    {ex.restChosen && <span className="text-muted"> (scelto l’ultima volta)</span>}
                  </div>
                )}
                {ex.instructions && <div className="text-muted">{ex.instructions}</div>}
              </div>
            )}
            <PreviousPerformance prev={previous} ex={ex} />
          </div>
          {ex.sets.length > 0 && (
            <div className="mb-1 grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-1.5 text-xs font-medium text-muted min-[360px]:px-1">
              <span>#</span>
              <span className="text-center">{isTime ? '' : `Kg${ex.perHand ? ' / mano' : ''}`}</span>
              <span className="text-center">{isTime ? 'Secondi' : 'Ripetizioni'}</span>
              <span className="text-center">Fatto</span>
            </div>
          )}
          <ul className="space-y-2">
            {ex.sets.map((s, i) => (
              <li key={i} className={`rounded-xl py-1 min-[360px]:px-1 ${s.done ? 'bg-primary-soft' : ''}`}>
                <div className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-1.5">
                  <button
                    onClick={() => setDetail(i)}
                    className="h-11 rounded-lg bg-surface-muted text-sm font-semibold text-fg-soft"
                    aria-label={`Dettagli serie ${i + 1}`}
                    title="RIR, fastidio, note, elimina"
                  >
                    {i + 1}
                  </button>
                  <div className="flex min-w-0 justify-center">
                    {isTime ? (
                      <button
                        onClick={() => onStartTimer?.(ex, i)}
                        className="min-h-11 w-full rounded-xl bg-swim px-2 text-sm font-semibold text-on-swim active:bg-swim"
                      >
                        ▶ Avvia {s.durationSec}s
                      </button>
                    ) : (
                      <Stepper value={s.weight} step={ex.step || 1} onChange={(weight) => updateSet(i, { weight })} label={null} />
                    )}
                  </div>
                  <div className="flex min-w-0 justify-center">
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
                      s.done ? 'border-primary bg-primary text-on-primary' : 'border-line text-transparent active:border-primary'
                    }`}
                  >
                    <span className="anim-check inline-block">✓</span>
                  </button>
                </div>
                {(s.rir != null || s.rpe != null || s.pain || s.note) && (
                  <div className="mt-1 flex flex-wrap gap-1 pl-9 text-[11px]">
                    {s.rir != null && <span className="rounded bg-surface-muted px-1.5 text-fg-soft">RIR {s.rir}</span>}
                    {s.rpe != null && <span className="rounded bg-surface-muted px-1.5 text-fg-soft">RPE {s.rpe}</span>}
                    {s.pain && <span className="rounded bg-danger-soft px-1.5 text-danger">Fastidio {s.pain.location} {s.pain.intensity ?? ''}</span>}
                    {s.note && <span className="rounded bg-surface-muted px-1.5 text-muted">{s.note}</span>}
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
              className="link-btn link-btn-danger ml-auto"
            >
              Rimuovi esercizio
            </button>
          </div>

          <textarea
            value={ex.notes}
            onChange={(e) => onChange({ ...ex, notes: e.target.value })}
            placeholder="Note di oggi"
            aria-label={`Note ${ex.name}`}
            rows={1}
            className="mt-2 min-h-11 w-full resize-y rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted outline-none focus:ring-2 focus:ring-primary"
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
          <p className="text-sm text-muted">
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
          <button onClick={onRemove} className="link-btn link-btn-danger -ml-2">Elimina serie</button>
          <button onClick={onClose} className="btn-primary">Fatto</button>
        </div>
      </div>
    </Sheet>
  )
}
