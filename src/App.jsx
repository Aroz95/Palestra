import { useRef, useState } from 'react'
import TimerBar from './components/TimerBar'
import TodayView from './components/TodayView'
import SessionView from './components/SessionView'
import SwimSessionView from './components/SwimSessionView'
import CalendarView from './components/CalendarView'
import ProgramsView from './components/ProgramsView'
import HistoryView from './components/HistoryView'
import DietView from './components/DietView'
import ProgressView from './components/ProgressView'
import MoreView from './components/MoreView'
import WorkoutMode from './components/WorkoutMode'
import { Empty, Segmented } from './components/ui'
import { usePersistentState } from './lib/persist'
import { useLocalStorage } from './lib/storage'
import { useTimers } from './lib/useTimers'
import { hasPendingSets, progressionHint } from './lib/stats'
import { toLocalISO } from './lib/dates'
import { emptyState, lastPerformance } from './schema/factories'
import { DEFAULT_REST } from './schema/constants'
import * as A from './lib/actions'
import { exportBackup, exportSession, fileNames } from './lib/report'
import { downloadJSON } from './lib/download'

const TABS = [
  { id: 'today', label: 'Oggi', icon: '🏠' },
  { id: 'training', label: 'Allenamenti', icon: '🏋️' },
  { id: 'diet', label: 'Alimentazione', icon: '🥗' },
  { id: 'progress', label: 'Progressi', icon: '📈' },
  { id: 'more', label: 'Altro', icon: '⋯' },
]

const TRAINING_TABS = [
  { id: 'session', label: 'Seduta' },
  { id: 'calendar', label: 'Calendario' },
  { id: 'programs', label: 'Schede' },
  { id: 'history', label: 'Storico' },
]

export default function App() {
  const [state, setState, status, commit] = usePersistentState()
  const [tab, setTab] = useLocalStorage('palestra:tab', 'today')
  const [sub, setSub] = useLocalStorage('palestra:subtabs', { training: 'session', more: 'profile' })
  const [workout, setWorkout] = useLocalStorage('palestra:workout-mode', false)
  const [undo, setUndo] = useState(null)
  const [hideMigrated, setHideMigrated] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const timers = useTimers({ sound: state?.settings.sound ?? true, onCountdownEnd: (c) => onCountdownEnd(c) })

  // Fine di una serie/cardio a tempo: la segna come fatta e, se restano serie, avvia il recupero
  function onCountdownEnd({ kind, target }) {
    if (kind !== 'work' || !target) return
    const session = stateRef.current?.sessions.find((s) => s.id === target.sessionId)
    if (!session) return
    let updated = session
    if (target.type === 'set') {
      updated = {
        ...session,
        exercises: session.exercises.map((ex) =>
          ex.id !== target.exId ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === target.setIdx ? { ...s, done: true, at: toLocalISO() } : s)) },
        ),
      }
      const ex = updated.exercises.find((e) => e.id === target.exId)
      if (ex && hasPendingSets(updated)) timers.startRest(ex.rest ?? DEFAULT_REST, 'Recupero')
    } else if (target.type === 'cardio') {
      const mark = (list) => list.map((c) => (c.id === target.itemId ? { ...c, done: true } : c))
      updated = { ...session, warmup: mark(session.warmup), cooldown: mark(session.cooldown) }
    }
    updated = A.autoStart(updated)
    setState((s) => A.upsertSession(s, updated))
  }

  if (status.loading || !state) {
    return <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-400">Caricamento…</div>
  }

  const update = (fn) => setState((s) => fn(s))
  const go = (t, subId) => {
    setTab(t)
    if (subId) setSub((s) => ({ ...s, [t]: subId }))
    window.scrollTo(0, 0)
  }
  const openSession = (id) => {
    setState((s) => ({ ...s, activeSessionId: id }))
    go('training', 'session')
  }
  // La seduta viene creata una sola volta qui (id stabile), poi inserita nello stato
  const startSession = (spec) => {
    const session = A.buildSession(stateRef.current, spec)
    setState((s) => A.addStartedSession(s, session))
    if (!timers.running) timers.resetStopwatch()
    go('training', 'session')
  }
  const active = state.sessions.find((s) => s.id === state.activeSessionId) ?? null
  const updateSession = (session) => setState((s) => A.upsertSession(s, session))
  const deleteSession = (id) => setState((s) => A.deleteSession(s, id))
  const hintFor = (ex) => progressionHint(lastPerformance(state.sessions, ex.exerciseId, { excludeSessionId: active?.id, beforeDate: active?.date }), ex.step)
  const showTimer = tab === 'today' || tab === 'training' || timers.running || timers.rest.active

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      {status.error && (
        <div role="alert" className="sticky top-0 z-40 bg-rose-700 px-4 py-2 text-sm text-white">
          {status.error}
          <button onClick={() => downloadJSON(fileNames.backup(), exportBackup(state))} className="ml-2 font-semibold underline">Esporta backup</button>
        </div>
      )}
      {showTimer && <TimerBar timers={timers} restSeconds={state.settings.restSeconds} />}

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-4">
        <SaveBadge status={status} />
        {status.migrated && !hideMigrated && (
          <div className="mb-4 rounded-2xl border border-sky-800/60 bg-sky-950/40 p-3 text-sm text-sky-100">
            Dati aggiornati alla nuova versione: sedute, scheda e storico sono stati conservati (la scheda è ora la “Scheda A” del programma principale). Una copia dei dati precedenti è salvata in Altro → Opzioni.
            <button onClick={() => setHideMigrated(true)} className="ml-2 underline">OK</button>
          </div>
        )}

        {tab === 'today' && <TodayView state={state} update={update} onStart={startSession} onOpenSession={openSession} go={go} />}

        {tab === 'training' && (
          <div className="space-y-4">
            <Segmented options={TRAINING_TABS} value={sub.training} onChange={(v) => setSub((s) => ({ ...s, training: v }))} />
            {sub.training === 'session' &&
              (active ? (
                active.kind === 'swim' ? (
                  <SwimSessionView
                    session={active}
                    state={state}
                    onChange={updateSession}
                    timers={timers}
                    onDelete={() => deleteSession(active.id)}
                    onExport={() => downloadJSON(fileNames.session(active), exportSession(active))}
                  />
                ) : (
                  <SessionView
                    session={active}
                    state={state}
                    onChange={updateSession}
                    timers={timers}
                    settings={state.settings}
                    onStartWorkout={() => setWorkout(true)}
                    onDelete={() => deleteSession(active.id)}
                    onExport={() => downloadJSON(fileNames.session(active), exportSession(active))}
                  />
                )
              ) : (
                <Empty
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <button onClick={() => go('today')} className="btn bg-emerald-500 text-slate-950">Vai a Oggi</button>
                      <button onClick={() => startSession({ kind: 'swim' })} className="btn-ghost">Nuova nuotata</button>
                      <button onClick={() => setSub((s) => ({ ...s, training: 'programs' }))} className="btn-ghost">Schede</button>
                    </div>
                  }
                >
                  Nessuna seduta aperta. Avviane una da Oggi, dal calendario o da una scheda.
                </Empty>
              ))}
            {sub.training === 'calendar' && <CalendarView state={state} update={update} onOpenSession={openSession} onStart={startSession} />}
            {sub.training === 'programs' && <ProgramsView state={state} update={update} onStartTemplate={(templateId) => startSession({ templateId })} onImport={() => go('more', 'import')} />}
            {sub.training === 'history' && <HistoryView state={state} onOpen={openSession} onDelete={deleteSession} />}
          </div>
        )}

        {tab === 'diet' && <DietView state={state} update={update} onImport={() => go('more', 'import')} />}
        {tab === 'progress' && <ProgressView state={state} settings={state.settings} />}
        {tab === 'more' && (
          <MoreView
            state={state}
            update={update}
            sub={sub.more}
            setSub={(v) => setSub((s) => ({ ...s, more: v }))}
            status={status}
            importProps={{
              // L'importazione è considerata applicata solo dopo il salvataggio riuscito (con snapshot dello stato precedente)
              onApply: async (next, label) => {
                const prev = stateRef.current
                await commit(next, { kind: 'import', label, state: prev })
                setUndo({ label, prev, after: next })
              },
              // Annullabile solo finché non ci sono modifiche successive all'importazione
              undo: undo ? { label: undo.label, available: state === undo.after } : null,
              onUndo: async () => {
                if (stateRef.current !== undo.after) return
                await commit(undo.prev, { kind: 'undo-import', label: undo.label, state: undo.after })
                setUndo(null)
              },
            }}
            onReset={async () => {
              await commit(emptyState(), { kind: 'reset', label: 'Cancella tutti i dati', state: stateRef.current })
              setUndo(null)
              timers.resetStopwatch()
              timers.stopRest()
              setWorkout(false)
            }}
          />
        )}
      </main>

      {workout && active?.kind === 'strength' && (
        <WorkoutMode session={active} onChange={updateSession} timers={timers} onClose={() => setWorkout(false)} hintFor={hintFor} />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Navigazione principale">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${tab === t.id ? 'text-emerald-400' : 'text-slate-400'}`}
            >
              <span className="text-xl leading-none" aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

// Stato del salvataggio sempre visibile: salvato / in corso / non salvato
function SaveBadge({ status }) {
  const map = {
    saved: ['text-emerald-400', '● Salvato sul dispositivo'],
    saving: ['text-slate-400', '○ Salvataggio…'],
    error: ['text-rose-400', '▲ Non salvato'],
    idle: ['text-slate-500', ''],
  }
  const [cls, label] = map[status.save] ?? map.idle
  return (
    <div className={`-mt-2 mb-2 text-right text-[11px] ${cls}`} role="status" aria-live="polite">
      {label}
      {status.backend === 'localstorage' && status.save !== 'error' ? ' (archivio di ripiego)' : ''}
    </div>
  )
}
