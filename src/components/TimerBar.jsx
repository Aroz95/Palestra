import { useState } from 'react'
import { fmtClock } from '../lib/stats'

const PRESETS = [30, 45, 60, 90, 120]

export default function TimerBar({ timers, restSeconds }) {
  const [showLaps, setShowLaps] = useState(false)
  const { elapsed, running, laps, rest } = timers
  const pct = rest.active && rest.duration ? 100 - (rest.left / (rest.duration * 1000)) * 100 : 0

  return (
    <div className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur pt-[env(safe-area-inset-top)]">
      <div className="mx-auto max-w-2xl px-4 py-2 sm:px-6 lg:max-w-3xl lg:px-8">
        {/* Cronometro */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-muted">Cronometro</div>
            <div className={`font-mono text-3xl font-bold tabular-nums ${running ? 'text-primary' : 'text-fg'}`}>
              {fmtClock(elapsed)}
            </div>
          </div>
          {running ? (
            <>
              <button onClick={timers.lap} className="btn-ghost">Giro</button>
              <button onClick={timers.pauseStopwatch} className="btn-secondary">Pausa</button>
            </>
          ) : (
            <>
              {elapsed > 0 && (
                <button
                  onClick={() => confirm('Azzerare il cronometro?') && timers.resetStopwatch()}
                  className="btn-ghost"
                >
                  Azzera
                </button>
              )}
              <button onClick={timers.startStopwatch} className="btn-primary">
                {elapsed > 0 ? 'Riprendi' : 'Avvia'}
              </button>
            </>
          )}
        </div>

        {laps.length > 0 && (
          <button onClick={() => setShowLaps((v) => !v)} className="mt-1 text-xs text-muted underline">
            {showLaps ? 'Nascondi giri' : `Giri (${laps.length})`}
          </button>
        )}
        {showLaps && (
          <ol className="mt-1 flex flex-wrap gap-1 text-xs text-fg-soft">
            {laps.map((t, i) => (
              <li key={i} className="rounded bg-surface-muted px-2 py-0.5 font-mono">
                {i + 1}. {fmtClock(t)} <span className="text-muted">(+{fmtClock(t - (laps[i - 1] ?? 0))})</span>
              </li>
            ))}
          </ol>
        )}

        {/* Recupero */}
        {rest.active ? (
          <div className={`mt-2 overflow-hidden rounded-xl ${rest.kind === 'work' ? 'bg-warning-soft' : 'bg-swim-soft'}`}>
            <div className="h-1 bg-swim transition-all" style={{ width: `${pct}%` }} />
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1">
                <div className="text-xs font-semibold text-fg-soft">
                  {rest.label}
                </div>
                <div className="font-mono text-2xl font-bold tabular-nums text-fg">{fmtClock(rest.left + 999)}</div>
              </div>
              <button onClick={() => timers.addRest(15)} className="btn-ghost">+15s</button>
              <button onClick={timers.stopRest} className="btn bg-fg text-bg">Stop</button>
            </div>
          </div>
        ) : timers.finished ? (
          <div className="mt-2 rounded-xl bg-primary px-3 py-3 text-center font-semibold text-on-primary">
            {timers.finished.kind === 'work' ? `${timers.finished.label}: completato` : 'Recupero finito — via!'}
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="shrink-0 text-xs text-muted">Recupero:</span>
            {PRESETS.map((s) => (
              <button
                key={s}
                onClick={() => timers.startRest(s)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
                  s === restSeconds ? 'bg-swim text-on-swim' : 'bg-surface-muted text-fg'
                }`}
              >
                {s < 60 ? `${s}s` : s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s / 60} min`}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
