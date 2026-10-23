import { useEffect, useRef, useState } from 'react'
import Stepper from './Stepper'
import { fmtClock, fmtNum, strengthStats as sessionStats, hasPendingSets, minutesBetweenSafe } from '../lib/stats'
import { DEFAULT_REST } from '../schema/constants'
import { toLocalISO } from '../lib/dates'
import { targetText } from './ExerciseCard'
import { autoStart } from '../lib/actions'

// Sequenza dei passi: riscaldamento → esercizi → defaticamento
export function buildSteps(session) {
  return [
    ...session.warmup.map((c) => ({ kind: 'cardio', section: 'Riscaldamento', id: c.id, item: c })),
    ...session.exercises.map((ex) => ({ kind: 'exercise', section: 'Sala pesi', id: ex.id, item: ex })),
    ...session.cooldown.map((c) => ({ kind: 'cardio', section: 'Defaticamento', id: c.id, item: c })),
  ]
}

const isDone = (step) => (step.kind === 'cardio' ? step.item.done : step.item.sets.every((s) => s.done))

export { hasPendingSets }

// La prima attività registrata fissa l'orario di inizio della seduta
const withStart = autoStart

export default function WorkoutMode({ session, onChange: save, timers, onClose, hintFor }) {
  const onChange = (s) => save(s.exercises.some((e) => e.sets.some((x) => x.done)) || [...s.warmup, ...s.cooldown].some((c) => c.done) ? withStart(s) : s)
  const steps = buildSteps(session)
  const [currentId, setCurrentId] = useState(() => steps.find((s) => !isDone(s))?.id ?? null)
  const idx = steps.findIndex((s) => s.id === currentId)
  const step = idx >= 0 ? steps[idx] : null
  const stats = sessionStats(session)
  useWakeLock()

  const nextIncompleteId = (fromIdx) => {
    const after = steps.slice(fromIdx + 1).find((s) => !isDone(s))
    return (after ?? steps.find((s) => !isDone(s)))?.id ?? null
  }

  // Quando il passo corrente viene completato, passa automaticamente al successivo da fare
  const curDone = step ? isDone(step) : true
  const prev = useRef({ id: currentId, done: curDone })
  useEffect(() => {
    if (prev.current.id === currentId && !prev.current.done && curDone) setCurrentId(nextIncompleteId(idx))
    prev.current = { id: currentId, done: curDone }
  })

  const setExercise = (ex) => onChange({ ...session, exercises: session.exercises.map((e) => (e.id === ex.id ? ex : e)) })
  const setCardio = (section, item) => {
    const key = section === 'Riscaldamento' ? 'warmup' : 'cooldown'
    onChange({ ...session, [key]: session[key].map((c) => (c.id === item.id ? item : c)) })
  }

  // Ultima serie completata: il RIR si può indicare durante il recupero anche se si è già passati all'esercizio successivo
  const [lastDone, setLastDone] = useState(null)
  const lastEx = session.exercises.find((e) => e.id === lastDone?.exId)
  const lastSet = lastEx?.sets[lastDone.idx]?.done ? lastEx.sets[lastDone.idx] : null
  const rirPrompt =
    lastSet && lastEx.type !== 'time'
      ? { value: lastSet.rir, name: lastEx.name, onChange: (rir) => setExercise({ ...lastEx, sets: lastEx.sets.map((s, j) => (j === lastDone.idx ? { ...s, rir } : s)) }) }
      : null

  const working = timers.rest.active && timers.rest.kind === 'work'
  const resting = timers.rest.active && timers.rest.kind !== 'work'

  const ensureStopwatch = () => {
    if (!timers.running) timers.startStopwatch()
  }

  // Pulsante cronometro: segna la serie corrente come fatta e avvia il recupero
  const completeSet = (ex) => {
    const i = ex.sets.findIndex((s) => !s.done)
    if (i < 0) return
    ensureStopwatch()
    const updated = { ...ex, sets: ex.sets.map((s, j) => (j === i ? { ...s, done: true, at: toLocalISO() } : s)) }
    setExercise(updated)
    setLastDone({ exId: ex.id, idx: i })
    const nextSession = { ...session, exercises: session.exercises.map((e) => (e.id === ex.id ? updated : e)) }
    if (hasPendingSets(nextSession)) timers.startRest(ex.rest ?? DEFAULT_REST, 'Recupero')
    else timers.stopRest()
  }

  // Esercizio a tempo (Plank): parte il conto alla rovescia, a fine tempo la serie viene segnata da sola
  const startTimedSet = (ex) => {
    const i = ex.sets.findIndex((s) => !s.done)
    if (i < 0) return
    ensureStopwatch()
    timers.startRest(Number(ex.sets[i].durationSec) || 30, `${ex.name} — serie ${i + 1}`, {
      kind: 'work',
      target: { type: 'set', sessionId: session.id, exId: ex.id, setIdx: i },
    })
  }

  const startCardio = (section, c) => {
    ensureStopwatch()
    timers.startRest(Math.round((Number(c.minutes) || 0) * 60), c.name, {
      kind: 'work',
      target: { type: 'cardio', sessionId: session.id, itemId: c.id },
    })
  }

  const undoLast = (ex) => {
    const i = ex.sets.map((s) => s.done).lastIndexOf(true)
    if (i < 0) return
    timers.stopRest()
    setExercise({ ...ex, sets: ex.sets.map((s, j) => (j === i ? { ...s, done: false, at: null } : s)) })
  }

  const go = (dir) => {
    const j = idx + dir
    if (j >= 0 && j < steps.length) setCurrentId(steps[j].id)
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Modalità allenamento" className="fixed inset-0 z-50 flex flex-col bg-bg pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-fg">
      {/* Barra superiore */}
      <div className="border-b border-line px-4 py-2">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button onClick={onClose} className="btn-ghost text-sm">✕ Esci</button>
          <div className="flex-1 text-center text-xs text-muted">
            {step ? `${step.section} · ${idx + 1}/${steps.length}` : 'Fine'}
            <div className="text-sm font-semibold text-fg">
              Serie {stats.doneSets}/{stats.totalSets}
            </div>
          </div>
          <button
            onClick={timers.running ? timers.pauseStopwatch : timers.startStopwatch}
            className={`rounded-xl px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${
              timers.running ? 'bg-surface-muted text-primary' : 'bg-surface-muted text-muted'
            }`}
            title={timers.running ? 'Metti in pausa il tempo totale' : 'Riprendi il tempo totale'}
          >
            {timers.running ? '' : '⏸ '}
            {fmtClock(timers.elapsed)}
          </button>
        </div>
        <div className="mx-auto mt-2 h-1.5 max-w-2xl overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${stats.totalSets ? (stats.doneSets / stats.totalSets) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-4">
          {!step ? (
            <Finished stats={stats} timers={timers} session={session} onChange={onChange} onClose={onClose} />
          ) : step.kind === 'exercise' ? (
            <ExerciseStep
              ex={step.item}
              onChange={setExercise}
              resting={resting}
              working={working && timers.rest.target?.exId === step.id}
              timers={timers}
              onComplete={() => completeSet(step.item)}
              onStartTimed={() => startTimedSet(step.item)}
              onUndo={() => undoLast(step.item)}
              hint={hintFor?.(step.item)}
              rirPrompt={rirPrompt}
            />
          ) : (
            <CardioStep
              c={step.item}
              section={step.section}
              onChange={(c) => setCardio(step.section, c)}
              resting={resting}
              working={working && timers.rest.target?.itemId === step.id}
              timers={timers}
              onStart={() => startCardio(step.section, step.item)}
            />
          )}
        </div>
      </div>

      {/* Navigazione */}
      {step && (
        <div className="border-t border-line px-4 py-2">
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            <button onClick={() => go(-1)} disabled={idx === 0} className="btn-ghost text-sm disabled:opacity-30">
              ‹ Precedente
            </button>
            <StepPicker steps={steps} currentId={currentId} onPick={setCurrentId} />
            <button onClick={() => go(1)} disabled={idx === steps.length - 1} className="btn-ghost text-sm disabled:opacity-30">
              Successivo ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ExerciseStep({ ex, onChange, resting, working, timers, onComplete, onStartTimed, onUndo, hint, rirPrompt }) {
  const isTime = ex.type === 'time'
  const i = ex.sets.findIndex((s) => !s.done)
  const cur = i >= 0 ? ex.sets[i] : null
  const left = ex.sets.filter((s) => !s.done).length
  const rest = ex.rest ?? DEFAULT_REST
  const target = targetText(ex)

  // Modifica la serie corrente; le serie successive con lo stesso valore vengono aggiornate insieme
  const editCurrent = (field, value) => {
    const old = cur[field]
    onChange({
      ...ex,
      sets: ex.sets.map((s, j) => (j === i || (j > i && !s.done && s[field] === old) ? { ...s, [field]: value } : s)),
    })
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        {resting && cur && <div className="text-xs font-semibold text-fg-soft">Prossima serie</div>}
        <h1 className="text-2xl font-bold text-fg">{ex.name}</h1>
        <p className="text-sm text-muted">{ex.group}</p>
        {target && (
          <p className="mt-1 text-sm text-swim">
            Obiettivo: <span className="text-fg">{target}</span>
          </p>
        )}
        {hint && <p className="mt-1 text-xs text-warning">{hint}</p>}
      </div>

      {/* Serie: quelle fatte vengono scalate */}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {ex.sets.map((s, j) => (
          <span
            key={j}
            className={`flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-semibold ${
              s.done
                ? 'bg-primary-soft text-primary line-through'
                : j === i
                  ? 'bg-fg text-bg ring-2 ring-primary'
                  : 'bg-surface-muted text-fg-soft'
            }`}
          >
            {s.done ? <span className="anim-check inline-block">✓</span> : j + 1}
          </span>
        ))}
      </div>
      <p className="mt-2 text-center text-base text-fg-soft">
        {cur ? (
          <>
            Serie <b className="text-fg">{i + 1}</b> di {ex.sets.length} ·{' '}
            <b className="text-fg">{left === 1 ? 'ultima serie' : `ne restano ${left}`}</b>
          </>
        ) : (
          <span className="font-semibold text-primary">Esercizio completato ✓</span>
        )}
      </p>

      {cur && (
        <div className="mt-4 flex justify-center gap-4">
          {!isTime && (
            <Stepper
              label={`Kg${ex.perHand ? ' per mano' : ''}`}
              value={cur.weight}
              step={ex.step || 1}
              onChange={(v) => editCurrent('weight', v)}
            />
          )}
          {isTime ? (
            <Stepper label="Secondi" value={cur.durationSec} step={5} onChange={(v) => editCurrent('durationSec', v)} />
          ) : (
            <Stepper label="Ripetizioni eseguite" value={cur.reps} step={1} onChange={(v) => editCurrent('reps', v)} />
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center py-6">
        {resting ? (
          <>
            <Countdown timers={timers} color="sky" title="Recupero" />
            {rirPrompt && (
              <div className="mt-4 text-center">
                <div className="mb-1 text-xs text-muted">RIR della serie appena fatta · {rirPrompt.name} (facoltativo)</div>
                <div className="flex justify-center gap-1">
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => rirPrompt.onChange(rirPrompt.value === n ? null : n)}
                      aria-pressed={rirPrompt.value === n}
                      aria-label={`RIR ${n}`}
                      className={`h-10 w-10 rounded-lg text-sm font-semibold ${rirPrompt.value === n ? 'bg-swim text-on-swim' : 'bg-surface-muted text-fg-soft'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : working ? (
          <Countdown timers={timers} color="amber" title="In corso" />
        ) : cur ? (
          <BigButton onClick={isTime ? onStartTimed : onComplete} color={isTime ? 'amber' : 'emerald'}>
            <span className="text-5xl">{isTime ? '▶' : '⏱'}</span>
            <span className="mt-2 text-xl font-extrabold uppercase">{isTime ? `Avvia ${cur.durationSec}s` : 'Serie fatta'}</span>
            <span className="mt-1 text-sm font-medium opacity-80">
              {isTime ? 'si segna da sola a fine tempo' : `poi recupero ${fmtClock(rest * 1000)}`}
            </span>
          </BigButton>
        ) : null}
      </div>

      <div className="flex justify-center gap-2">
        {cur && isTime && !working && !resting && (
          <button onClick={onComplete} className="btn-ghost text-sm">✓ Segna fatta senza timer</button>
        )}
        {ex.sets.some((s) => s.done) && !working && (
          <button onClick={onUndo} className="btn-ghost text-sm">↶ Annulla ultima serie</button>
        )}
      </div>
    </div>
  )
}

function CardioStep({ c, section, onChange, resting, working, timers, onStart }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <div className="text-xs font-semibold text-muted">{section}</div>
        <h1 className="text-2xl font-bold text-fg">{c.name}</h1>
        {c.note && <p className="text-sm text-muted">{c.note}</p>}
        {c.done && <p className="mt-1 font-semibold text-primary">Completato ✓</p>}
      </div>
      <div className="mt-4 flex justify-center gap-4">
        <Stepper label="Minuti" value={c.minutes} step={0.5} onChange={(minutes) => onChange({ ...c, minutes })} />
        <Stepper label="km/h" value={c.speed} step={0.5} onChange={(speed) => onChange({ ...c, speed })} />
      </div>
      <p className="mt-2 text-center text-sm text-muted">
        ≈ {fmtNum(((Number(c.minutes) || 0) / 60) * (Number(c.speed) || 0), 2)} km
      </p>
      <div className="flex flex-1 flex-col items-center justify-center py-6">
        {working ? (
          <Countdown timers={timers} color="amber" title="In corso" />
        ) : resting ? (
          <Countdown timers={timers} color="sky" title="Recupero" />
        ) : !c.done ? (
          <BigButton onClick={onStart} color="amber">
            <span className="text-5xl">▶</span>
            <span className="mt-2 text-xl font-extrabold uppercase">Avvia {fmtNum(c.minutes)} min</span>
            <span className="mt-1 text-sm font-medium opacity-80">si segna da solo a fine tempo</span>
          </BigButton>
        ) : null}
      </div>
      <div className="flex justify-center">
        {!working && (
          <button onClick={() => onChange({ ...c, done: !c.done })} className="btn-ghost text-sm">
            {c.done ? '↶ Segna da fare' : '✓ Segna fatto senza timer'}
          </button>
        )}
      </div>
    </div>
  )
}

const RING = {
  // recupero: neutro; tempo di lavoro: colore delle azioni (l'ambra resta riservata agli avvisi)
  sky: { stroke: 'stroke-fg-soft', text: 'text-fg-soft' },
  amber: { stroke: 'stroke-primary', text: 'text-primary' },
}

// Conto alla rovescia grande: si ferma da solo a zero
function Countdown({ timers, color, title }) {
  const { left, duration, label } = timers.rest
  const frac = duration ? Math.min(1, left / (duration * 1000)) : 0
  const r = 110
  const len = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-64 w-64">
        <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90">
          <circle cx="120" cy="120" r={r} className="fill-none stroke-line" strokeWidth="14" />
          <circle
            cx="120"
            cy="120"
            r={r}
            className={`fill-none ${RING[color].stroke} transition-[stroke-dashoffset] duration-200`}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={len}
            strokeDashoffset={len * (1 - frac)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-sm font-semibold uppercase tracking-widest ${RING[color].text}`}>{title}</span>
          <span className="font-mono text-6xl font-bold tabular-nums text-fg">{fmtClock(left + 999)}</span>
          {color === 'amber' && <span className="mt-1 max-w-44 truncate text-xs text-muted">{label}</span>}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => timers.addRest(-15)} className="btn-ghost">−15s</button>
        <button onClick={() => timers.addRest(15)} className="btn-ghost">+15s</button>
        <button onClick={timers.stopRest} className="btn bg-fg text-bg">
          {color === 'sky' ? 'Salta recupero' : 'Stop'}
        </button>
      </div>
    </div>
  )
}

const BIG = {
  emerald: 'bg-primary text-on-primary active:bg-primary',
  amber: 'bg-primary text-on-primary active:bg-primary',
}

function BigButton({ onClick, color, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-64 w-64 flex-col items-center justify-center rounded-full shadow-lg transition-transform duration-150 active:scale-[0.98] ${BIG[color]}`}
    >
      {children}
    </button>
  )
}

function StepPicker({ steps, currentId, onPick }) {
  return (
    <select
      value={currentId ?? ''}
      onChange={(e) => onPick(e.target.value)}
      className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-2 py-2 text-center text-sm text-fg"
      aria-label="Vai al passo"
    >
      {steps.map((s, i) => (
        <option key={s.id} value={s.id}>
          {isDone(s) ? '✓ ' : ''}
          {i + 1}. {s.item.name}
        </option>
      ))}
    </select>
  )
}

function Finished({ stats, timers, session, onChange, onClose }) {
  const endedAt = session.endedAt ?? toLocalISO()
  const fromTimes = minutesBetweenSafe(session.startedAt, endedAt)
  const minutes = fromTimes ?? Math.round(timers.elapsed / 60000)
  const save = () => {
    timers.pauseStopwatch()
    timers.stopRest()
    const patch = { status: 'completed', endedAt: session.startedAt ? endedAt : session.endedAt }
    if (session.durationSource !== 'manual' && minutes > 0) Object.assign(patch, { durationMin: minutes, durationSource: fromTimes != null ? 'computed' : 'stopwatch' })
    onChange({ ...session, ...patch })
    onClose()
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="text-6xl">🎉</div>
      <h1 className="mt-3 text-3xl font-bold text-fg">Allenamento completato!</h1>
      <dl className="mt-6 grid w-full grid-cols-2 gap-2">
        <Tile label="Tempo totale" value={fmtClock(timers.elapsed)} />
        <Tile label="Serie" value={stats.doneSets} />
        <Tile label="Ripetizioni" value={fmtNum(stats.reps, 0)} />
        <Tile label="Volume" value={`${fmtNum(stats.volume, 0)} kg`} />
        <Tile label="Cardio" value={`${fmtNum(stats.cardioMin)} min`} />
        <Tile label="Distanza" value={`${fmtNum(stats.cardioKm, 2)} km`} />
      </dl>
      <button onClick={save} className="btn mt-6 w-full bg-primary py-4 text-lg text-on-primary">
        Salva {minutes > 0 ? `durata (${minutes} min) ` : ''}e chiudi
      </button>
    </div>
  )
}

function Tile({ label, value }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-3">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="text-xl font-semibold text-fg">{value}</dd>
    </div>
  )
}

// Tiene lo schermo acceso durante l'allenamento (se il browser lo supporta)
function useWakeLock() {
  useEffect(() => {
    let lock = null
    const request = async () => {
      try {
        lock = await navigator.wakeLock?.request('screen')
      } catch {
        /* non supportato o negato */
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && request()
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release?.()
    }
  }, [])
}
