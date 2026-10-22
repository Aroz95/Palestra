import { useState } from 'react'
import { fmtClock } from '../lib/stats'

const PRESETS = [30, 45, 60, 90, 120]

export default function TimerBar({ timers, restSeconds }) {
  const [showLaps, setShowLaps] = useState(false)
  const { elapsed, running, laps, rest } = timers
  const pct = rest.active && rest.duration ? 100 - (rest.left / (rest.duration * 1000)) * 100 : 0

  return (
    <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur pt-[env(safe-area-inset-top)]">
      <div className="mx-auto max-w-2xl px-4 py-2">
        {/* Cronometro */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Cronometro</div>
            <div className={`font-mono text-3xl font-bold tabular-nums ${running ? 'text-emerald-400' : 'text-slate-100'}`}>
              {fmtClock(elapsed)}
            </div>
          </div>
          {running ? (
            <>
              <button onClick={timers.lap} className="btn-ghost">Giro</button>
              <button onClick={timers.pauseStopwatch} className="btn bg-amber-500 text-slate-950">Pausa</button>
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
              <button onClick={timers.startStopwatch} className="btn bg-emerald-500 text-slate-950">
                {elapsed > 0 ? 'Riprendi' : 'Avvia'}
              </button>
            </>
          )}
        </div>

        {laps.length > 0 && (
          <button onClick={() => setShowLaps((v) => !v)} className="mt-1 text-xs text-slate-400 underline">
            {showLaps ? 'Nascondi giri' : `Giri (${laps.length})`}
          </button>
        )}
        {showLaps && (
          <ol className="mt-1 flex flex-wrap gap-1 text-xs text-slate-300">
            {laps.map((t, i) => (
              <li key={i} className="rounded bg-slate-800 px-2 py-0.5 font-mono">
                {i + 1}. {fmtClock(t)} <span className="text-slate-500">(+{fmtClock(t - (laps[i - 1] ?? 0))})</span>
              </li>
            ))}
          </ol>
        )}

        {/* Recupero */}
        {rest.active ? (
          <div className={`mt-2 overflow-hidden rounded-xl ${rest.kind === 'work' ? 'bg-amber-900/60' : 'bg-sky-900/60'}`}>
            <div className="h-1 bg-sky-400 transition-all" style={{ width: `${pct}%` }} />
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-200">
                  {rest.label}
                </div>
                <div className="font-mono text-2xl font-bold tabular-nums text-white">{fmtClock(rest.left + 999)}</div>
              </div>
              <button onClick={() => timers.addRest(15)} className="btn-ghost">+15s</button>
              <button onClick={timers.stopRest} className="btn bg-white text-slate-900">Stop</button>
            </div>
          </div>
        ) : timers.finished ? (
          <div className="mt-2 rounded-xl bg-emerald-600 px-3 py-3 text-center font-semibold text-white">
            {timers.finished.kind === 'work' ? `${timers.finished.label}: completato` : 'Recupero finito — via!'}
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="shrink-0 text-xs text-slate-400">Recupero:</span>
            {PRESETS.map((s) => (
              <button
                key={s}
                onClick={() => timers.startRest(s)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
                  s === restSeconds ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-200'
                }`}
              >
                {s < 60 ? `${s}s` : `${s / 60}${s % 60 ? `:${String(s % 60).padStart(2, '0')}` : ''} min`}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
