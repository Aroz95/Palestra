import { useState } from 'react'
import TimerBar from './components/TimerBar'
import SessionView from './components/SessionView'
import HistoryView from './components/HistoryView'
import TemplateView from './components/TemplateView'
import SettingsView from './components/SettingsView'
import WorkoutMode, { hasPendingSets } from './components/WorkoutMode'
import { useLocalStorage } from './lib/storage'
import { useTimers } from './lib/useTimers'
import { createInitialState, createSessionFromTemplate, DEFAULT_REST, migrate, todayISO } from './data/defaultData'

const TABS = [
  { id: 'session', label: 'Seduta', icon: '🏋️' },
  { id: 'history', label: 'Storico', icon: '📅' },
  { id: 'template', label: 'Scheda', icon: '📝' },
  { id: 'settings', label: 'Opzioni', icon: '⚙️' },
]

export default function App() {
  const [state, setState] = useLocalStorage('palestra:data', createInitialState, migrate)
  const [tab, setTab] = useState('session')
  const [workout, setWorkout] = useLocalStorage('palestra:workout-mode', false)
  const timers = useTimers({ sound: state.settings.sound, onCountdownEnd: (c) => onCountdownEnd(c) })

  // Fine di un esercizio/cardio a tempo: lo segna come fatto e, se restano serie, avvia il recupero
  function onCountdownEnd({ kind, target }) {
    if (kind !== 'work' || !target) return
    const session = state.sessions.find((s) => s.id === target.sessionId)
    if (!session) return
    let updated = session
    if (target.type === 'set') {
      updated = {
        ...session,
        exercises: session.exercises.map((ex) =>
          ex.id !== target.exId ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === target.setIdx ? { ...s, done: true } : s)) },
        ),
      }
      const ex = updated.exercises.find((e) => e.id === target.exId)
      if (ex && hasPendingSets(updated)) timers.startRest(ex.rest ?? DEFAULT_REST, 'Recupero')
    } else if (target.type === 'cardio') {
      const mark = (list) => list.map((c) => (c.id === target.itemId ? { ...c, done: true } : c))
      updated = { ...session, warmup: mark(session.warmup), cooldown: mark(session.cooldown) }
    }
    updateSession(updated)
  }

  const active = state.sessions.find((s) => s.id === state.activeSessionId) ?? null

  const updateSession = (session) =>
    setState((st) => ({ ...st, sessions: st.sessions.map((s) => (s.id === session.id ? session : s)) }))

  const newSession = () => {
    const today = todayISO()
    const existing = state.sessions.find((s) => s.date === today)
    if (existing && !confirm('Esiste già una seduta con la data di oggi. Crearne comunque un’altra?')) {
      setState((st) => ({ ...st, activeSessionId: existing.id }))
      setTab('session')
      return
    }
    const s = createSessionFromTemplate(state.template, state.sessions, { date: today })
    setState((st) => ({ ...st, sessions: [...st.sessions, s], activeSessionId: s.id }))
    timers.resetStopwatch()
    setTab('session')
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <TimerBar timers={timers} restSeconds={state.settings.restSeconds} />

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-4">
        {tab === 'session' && (
          <SessionView
            session={active}
            template={state.template}
            onChange={updateSession}
            timers={timers}
            settings={state.settings}
            onNewSession={newSession}
            onStartWorkout={() => setWorkout(true)}
          />
        )}
        {tab === 'history' && (
          <HistoryView
            sessions={state.sessions}
            activeId={state.activeSessionId}
            onOpen={(id) => {
              setState((st) => ({ ...st, activeSessionId: id }))
              setTab('session')
            }}
            onDelete={(id) =>
              setState((st) => ({
                ...st,
                sessions: st.sessions.filter((s) => s.id !== id),
                activeSessionId: st.activeSessionId === id ? null : st.activeSessionId,
              }))
            }
            onNewSession={newSession}
          />
        )}
        {tab === 'template' && (
          <TemplateView template={state.template} onChange={(template) => setState((st) => ({ ...st, template }))} />
        )}
        {tab === 'settings' && (
          <SettingsView
            settings={state.settings}
            onSettings={(settings) => setState((st) => ({ ...st, settings }))}
            state={state}
            onImport={(data) => setState(data)}
            onReset={() => {
              setState(createInitialState())
              timers.resetStopwatch()
              timers.stopRest()
            }}
          />
        )}
      </main>

      {workout && active && (
        <WorkoutMode session={active} onChange={updateSession} timers={timers} onClose={() => setWorkout(false)} />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                tab === t.id ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
