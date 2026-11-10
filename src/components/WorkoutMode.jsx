import { useEffect, useRef, useState } from 'react'
import Stepper from './Stepper'
import { fmtClock, fmtNum, strengthStats as sessionStats, hasPendingSets } from '../lib/stats'
import { DEFAULT_REST } from '../schema/constants'
import { fmtDate, toLocalISO } from '../lib/dates'
import { targetText } from './ExerciseCard'
import { finishPatch, withAutoStart } from '../lib/actions'
import PreviousPerformance from './PreviousPerformance'
import { Sheet, TextArea } from './ui'
import { useScrollLock } from '../lib/scrollLock'

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

export default function WorkoutMode({ session, onChange: save, timers, onClose, onFinish, previousFor }) {
  // La prima attività completata fissa l'inizio della seduta (riscaldamento compreso), se non già fissato dal cronometro
  const onChange = (s) => save(withAutoStart(session, s))
  const steps = buildSteps(session)
  const [currentId, setCurrentId] = useState(() => steps.find((s) => !isDone(s))?.id ?? null)
  const idx = steps.findIndex((s) => s.id === currentId)
  const step = idx >= 0 ? steps[idx] : null
  const stats = sessionStats(session)
  useWakeLock()
  useScrollLock()

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
    const nextSession = { ...session, exercises: session.exercises.map((e) => (e.id === ex.id ? updated : e)) }
    if (hasPendingSets(nextSession)) timers.startRest(ex.rest ?? DEFAULT_REST, 'Recupero', { target: { type: 'rest', sessionId: session.id, exId: ex.id, setIdx: i } })
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
      <div className="shrink-0 border-b border-line px-4 py-1.5 [@media(max-height:500px)]:py-1">
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
            aria-label={`Tempo totale ${fmtClock(timers.elapsed)}: ${timers.running ? 'metti in pausa' : 'in pausa, riprendi'}`}
          >
            {timers.running ? '' : '⏸ '}
            {fmtClock(timers.elapsed)}
          </button>
        </div>
        <div className="mx-auto mt-1.5 h-1.5 max-w-2xl overflow-hidden rounded-full bg-surface-muted [@media(max-height:500px)]:mt-1 [@media(max-height:500px)]:h-1">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${stats.totalSets ? (stats.doneSets / stats.totalSets) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex h-full min-h-[22rem] max-w-2xl flex-col px-4 py-2 [@media(max-height:620px)]:py-1 [@media(max-height:500px)]:min-h-[15rem]">
          {!step ? (
            <Finished stats={stats} timers={timers} session={session} onFinish={onFinish} />
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
              previous={previousFor?.(step.item)}
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
        <div className="shrink-0 border-t border-line px-4 py-1.5 [@media(max-height:500px)]:py-1">
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            <button onClick={() => go(-1)} disabled={idx === 0} className="btn-ghost w-11 shrink-0 px-0 disabled:opacity-30" aria-label="Passo precedente">
              ‹
            </button>
            <StepPicker steps={steps} currentId={currentId} onPick={setCurrentId} />
            <button onClick={() => go(1)} disabled={idx === steps.length - 1} className="btn-ghost w-11 shrink-0 px-0 disabled:opacity-30" aria-label="Passo successivo">
              ›
            </button>
            <button onClick={() => onFinish(session)} className="btn-ghost shrink-0 px-3 text-sm" aria-label="Termina allenamento">
              Termina
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ExerciseStep({ ex, onChange, resting, working, timers, onComplete, onStartTimed, onUndo, previous }) {
  const isTime = ex.type === 'time'
  const i = ex.sets.findIndex((s) => !s.done)
  const cur = i >= 0 ? ex.sets[i] : null
  const left = ex.sets.filter((s) => !s.done).length
  const rest = ex.rest ?? DEFAULT_REST
  // obiettivo senza RIR: in modalità allenamento il RIR non si mostra né si chiede
  const target = targetText({ ...ex, target: ex.target && { ...ex.target, rir: null }, sets: ex.sets.map((s) => ({ ...s, target: s.target && { ...s.target, rir: null } })) })
  const [noteOpen, setNoteOpen] = useState(false)
  // Nuova serie in coda con i valori dell'ultima (da fare)
  const addSet = () => {
    const { restSelectedSec, restActualSec, ...last } = ex.sets[ex.sets.length - 1] ?? {} // eslint-disable-line no-unused-vars
    const base = ex.sets.length ? last : isTime ? { durationSec: 30, target: null } : { reps: 10, weight: null, target: null }
    onChange({ ...ex, sets: [...ex.sets, { ...base, done: false, rir: null, rpe: null, pain: null, note: '', at: null }] })
  }

  // Modifica la serie corrente; le serie successive con lo stesso valore vengono aggiornate insieme
  const editCurrent = (field, value) => {
    const old = cur[field]
    onChange({
      ...ex,
      sets: ex.sets.map((s, j) => (j === i || (j > i && !s.done && s[field] === old) ? { ...s, [field]: value } : s)),
    })
  }

  const [prevOpen, setPrevOpen] = useState(false)
  // azioni secondarie: sotto i controlli in verticale, sotto l'azione principale in orizzontale
  const secondary = (
    <>
      {!working && (
        <button onClick={addSet} className="btn-ghost px-3 text-sm">
          + Serie
        </button>
      )}
      <button onClick={() => setNoteOpen(true)} className="btn-ghost px-3 text-sm" aria-label={ex.notes ? 'Modifica nota' : '+ Nota'}>
        {ex.notes ? 'Nota ✎' : '+ Nota'}
      </button>
      {ex.sets.some((s) => s.done) && !working && (
        <button onClick={onUndo} className="btn-ghost px-3 text-sm" aria-label="↶ Annulla ultima serie">
          ↶ Annulla
        </button>
      )}
    </>
  )

  return (
    // Tutto in una schermata: intestazione e controlli a misura fissa, il pulsante principale occupa lo spazio che resta.
    // In orizzontale (altezza ridotta) due colonne: informazioni e controlli a sinistra, azione principale a destra.
    <div className="flex min-h-0 flex-1 flex-col gap-2 [@media(max-height:620px)]:gap-1 [@media(max-height:500px)]:grid [@media(max-height:500px)]:grid-cols-2 [@media(max-height:500px)]:gap-4">
      <div className="flex shrink-0 flex-col gap-2 [@media(max-height:620px)]:gap-1">
        <div className="text-center">
          {resting && cur && <div className="text-xs font-semibold text-fg-soft [@media(max-height:500px)]:hidden">Prossima serie</div>}
          <h1 className="text-xl font-bold leading-tight text-fg [@media(max-height:620px)]:text-lg">{ex.name}</h1>
          <p className="line-clamp-2 text-sm text-muted [@media(max-height:620px)]:line-clamp-1">
            {ex.group}
            {target && (
              <>
                {ex.group ? ' · ' : ''}
                <span className="text-fg-soft">Obiettivo {target}</span>
              </>
            )}
          </p>
        </div>

        <PreviousLine prev={previous} ex={ex} onOpen={() => setPrevOpen(true)} />

        {/* Serie: quelle fatte vengono scalate */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <div className="flex flex-wrap justify-center gap-1.5">
            {ex.sets.map((s, j) => (
              <span
                key={j}
                className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold ${
                  s.done ? 'bg-primary-soft text-primary line-through' : j === i ? 'bg-fg text-bg ring-2 ring-primary' : 'bg-surface-muted text-fg-soft'
                }`}
              >
                {s.done ? <span className="anim-check inline-block">✓</span> : j + 1}
              </span>
            ))}
          </div>
          <p className="text-sm text-fg-soft">
            {cur ? (
              <>
                Serie <b className="text-fg">{i + 1}</b> di {ex.sets.length} · <b className="text-fg">{left === 1 ? 'ultima serie' : `ne restano ${left}`}</b>
              </>
            ) : (
              <span className="font-semibold text-primary">Esercizio completato ✓</span>
            )}
          </p>
        </div>

        {cur && (
          <div className="flex justify-center gap-4">
            {!isTime && <Stepper label={`Kg${ex.perHand ? ' per mano' : ''}`} value={cur.weight} step={ex.step || 1} onChange={(v) => editCurrent('weight', v)} />}
            {isTime ? (
              <Stepper label="Secondi" value={cur.durationSec} step={5} onChange={(v) => editCurrent('durationSec', v)} />
            ) : (
              <Stepper label="Ripetizioni eseguite" value={cur.reps} step={1} onChange={(v) => editCurrent('reps', v)} />
            )}
          </div>
        )}

        {ex.notes && <p className="truncate text-center text-sm text-fg-soft [@media(max-height:620px)]:hidden">Nota di oggi: “{ex.notes}”</p>}
        <div className="flex justify-center gap-2 whitespace-nowrap [@media(max-height:500px)]:hidden">{secondary}</div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1">
      <ActionArea>
        {resting ? (
          <Countdown timers={timers} color="sky" title="Recupero" />
        ) : working ? (
          <Countdown timers={timers} color="amber" title="In corso" />
        ) : cur ? (
          <>
            <BigButton onClick={isTime ? onStartTimed : onComplete} color={isTime ? 'amber' : 'emerald'} reserve={isTime ? '3.25rem' : '0px'}>
              <span style={{ fontSize: 'calc(var(--big) * 0.18)' }}>{isTime ? '▶' : '⏱'}</span>
              <span className="font-extrabold uppercase" style={{ fontSize: 'max(0.95rem, calc(var(--big) * 0.085))' }}>
                {isTime ? `Avvia ${cur.durationSec}s` : 'Serie fatta'}
              </span>
              <span className="font-medium opacity-80" style={{ fontSize: 'max(0.75rem, calc(var(--big) * 0.055))' }}>
                {isTime ? 'si segna da sola a fine tempo' : `poi recupero ${fmtClock(rest * 1000)}`}
              </span>
            </BigButton>
            {isTime && (
              <button onClick={onComplete} className="btn-ghost mt-2 shrink-0 text-sm">
                ✓ Segna fatta senza timer
              </button>
            )}
          </>
        ) : null}
      </ActionArea>
      <div className="hidden shrink-0 justify-center gap-2 [@media(max-height:500px)]:flex">{secondary}</div>
      </div>

      <Sheet open={prevOpen} onClose={() => setPrevOpen(false)} title={`Ultima volta · ${ex.name}`}>
        <PreviousPerformance prev={previous} ex={ex} />
      </Sheet>

      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title={`Nota · ${ex.name}`}>
        <div className="space-y-3">
          <TextArea value={ex.notes} onChange={(notes) => onChange({ ...ex, notes })} rows={3} placeholder="Sensazioni, regolazioni della macchina…" aria-label={`Nota ${ex.name}`} />
          <p className="text-xs text-muted">Si salva mentre scrivi e la ritrovi la prossima volta nel riquadro “Ultima volta”.</p>
          <button onClick={() => setNoteOpen(false)} className="btn-primary w-full">Fatto</button>
        </div>
      </Sheet>
    </div>
  )
}

function CardioStep({ c, section, onChange, resting, working, timers, onStart }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 [@media(max-height:620px)]:gap-1 [@media(max-height:500px)]:grid [@media(max-height:500px)]:grid-cols-2 [@media(max-height:500px)]:gap-4">
      <div className="flex shrink-0 flex-col gap-2 [@media(max-height:620px)]:gap-1">
        <div className="text-center">
          <div className="text-xs font-semibold text-muted">{section}</div>
          <h1 className="text-xl font-bold leading-tight text-fg">{c.name}</h1>
          {c.note && <p className="line-clamp-2 text-sm text-muted">{c.note}</p>}
          {c.done && <p className="font-semibold text-primary">Completato ✓</p>}
        </div>
        <div className="flex justify-center gap-4">
          <Stepper label="Minuti" value={c.minutes} step={0.5} onChange={(minutes) => onChange({ ...c, minutes })} />
          <Stepper label="km/h" value={c.speed} step={0.5} onChange={(speed) => onChange({ ...c, speed })} />
        </div>
        <p className="text-center text-sm text-muted">≈ {fmtNum(((Number(c.minutes) || 0) / 60) * (Number(c.speed) || 0), 2)} km</p>
        <div className="flex justify-center">
          {!working && (
            <button onClick={() => onChange({ ...c, done: !c.done })} className="btn-ghost text-sm">
              {c.done ? '↶ Segna da fare' : '✓ Segna fatto senza timer'}
            </button>
          )}
        </div>
      </div>
      <ActionArea>
        {working ? (
          <Countdown timers={timers} color="amber" title="In corso" />
        ) : resting ? (
          <Countdown timers={timers} color="sky" title="Recupero" />
        ) : !c.done ? (
          <BigButton onClick={onStart} color="amber">
            <span style={{ fontSize: 'calc(var(--big) * 0.18)' }}>▶</span>
            <span className="font-extrabold uppercase" style={{ fontSize: 'max(0.95rem, calc(var(--big) * 0.085))' }}>
              Avvia {fmtNum(c.minutes)} min
            </span>
            <span className="font-medium opacity-80" style={{ fontSize: 'max(0.75rem, calc(var(--big) * 0.055))' }}>
              si segna da solo a fine tempo
            </span>
          </BigButton>
        ) : null}
      </ActionArea>
    </div>
  )
}

// Area dell'azione principale: occupa lo spazio rimasto; pulsante e cerchio del timer si dimensionano su di essa
// (unità del contenitore: niente scorrimento su schermi bassi, grandi su quelli alti)
function ActionArea({ children }) {
  return (
    <div className="flex min-h-[7rem] flex-1 flex-col items-center justify-center" style={{ containerType: 'size' }}>
      {children}
    </div>
  )
}

// Riga compatta con l'ultima esecuzione; il dettaglio (note comprese) si apre toccandola
function PreviousLine({ prev, ex, onOpen }) {
  if (!prev) return <p className="text-center text-sm text-muted">Nessuna esecuzione precedente: valori dalla scheda.</p>
  const done = prev.exercise.sets.filter((s) => s.done)
  const vals =
    ex.type === 'time'
      ? done.map((s) => `${s.durationSec ?? '—'} s`).join(' · ')
      : `${done.map((s) => `${s.reps ?? '—'}×${s.weight == null ? '—' : fmtNum(s.weight, 2)}`).join(' · ')} kg`
  const hasNotes = !!prev.exercise.notes || prev.exercise.sets.some((s) => s.note)
  return (
    <button
      onClick={onOpen}
      data-testid="previous-line"
      className="mx-auto flex min-h-11 w-full max-w-md items-center gap-2 rounded-xl bg-surface-muted px-3 text-left text-sm"
      aria-label={`Ultima volta ${fmtDate(prev.date, { day: 'numeric', month: 'short' })}: ${vals}${hasNotes ? ', con note' : ''}. Mostra dettagli`}
    >
      <span className="shrink-0 font-semibold text-fg">Ultima volta</span>
      <span className="min-w-0 flex-1 truncate tabular-nums text-fg-soft">{vals}</span>
      {hasNotes && <span className="shrink-0 rounded-full border border-line-strong px-1.5 text-xs text-fg-soft">nota</span>}
      <span className="shrink-0 text-muted" aria-hidden="true">›</span>
    </button>
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
    <div className="flex flex-col items-center" style={{ '--ring': 'min(16rem, calc(100cqh - 3.5rem - 4px), 85cqw)' }}>
      <div className="relative" style={{ width: 'var(--ring)', height: 'var(--ring)' }}>
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
          <span className={`font-semibold uppercase tracking-widest ${RING[color].text}`} style={{ fontSize: 'max(0.7rem, calc(var(--ring) * 0.055))' }}>
            {title}
          </span>
          <span className="font-mono font-bold tabular-nums text-fg" style={{ fontSize: 'calc(var(--ring) * 0.23)', lineHeight: 1.1 }}>
            {fmtClock(left + 999)}
          </span>
          {color === 'amber' && <span className="max-w-[70%] truncate text-xs text-muted">{label}</span>}
        </div>
      </div>
      <div className="mt-2 flex gap-2 whitespace-nowrap">
        <button onClick={() => timers.addRest(-15)} className="btn-ghost px-3">−15s</button>
        <button onClick={() => timers.addRest(15)} className="btn-ghost px-3">+15s</button>
        <button onClick={timers.stopRest} className="btn bg-fg px-3 text-bg" aria-label={color === 'sky' ? 'Salta recupero' : 'Stop'}>
          {color === 'sky' ? (
            <>
              Salta<span className="max-[359px]:hidden"> recupero</span>
            </>
          ) : (
            'Stop'
          )}
        </button>
      </div>
    </div>
  )
}

const BIG = {
  emerald: 'bg-primary text-on-primary active:bg-primary',
  amber: 'bg-primary text-on-primary active:bg-primary',
}

function BigButton({ onClick, color, children, reserve = '0px' }) {
  return (
    <button
      onClick={onClick}
      style={{ '--big': `min(16rem, calc(100cqh - ${reserve} - 4px), 85cqw)`, width: 'var(--big)', height: 'var(--big)' }}
      className={`flex shrink-0 flex-col items-center justify-center gap-1 rounded-full shadow-lg transition-transform duration-150 active:scale-[0.98] ${BIG[color]}`}
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

function Finished({ stats, timers, session, onFinish }) {
  // stessa regola della scheda seduta: cronometro della seduta (pause escluse), altrimenti fine − inizio
  const minutes = finishPatch(session, { stopwatch: timers.stopwatchFor(session.id) }).durationMin ?? 0
  const save = () => onFinish(session)
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="text-6xl">🎉</div>
      <h1 className="mt-3 text-3xl font-bold text-fg">Allenamento completato!</h1>
      <dl className="mt-6 grid w-full grid-cols-2 gap-2">
        <Tile label="Durata salvata" value={minutes > 0 ? `${minutes} min` : 'ND'} />
        <Tile label="Cronometro" value={fmtClock(timers.elapsed)} />
        <Tile label="Serie" value={stats.doneSets} />
        <Tile label="Ripetizioni" value={fmtNum(stats.reps, 0)} />
        <Tile label="Volume" value={`${fmtNum(stats.volume, 0)} kg`} />
        <Tile label="Cardio" value={`${fmtNum(stats.cardioMin)} min`} />
        <Tile label="Distanza" value={`${fmtNum(stats.cardioKm, 2)} km`} />
      </dl>
      <button onClick={save} className="btn mt-6 w-full bg-primary py-4 text-lg text-on-primary">
        Termina allenamento{minutes > 0 ? ` (${minutes} min)` : ''}
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
