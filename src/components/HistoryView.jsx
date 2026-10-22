import { fmtDate, fmtNum, sessionStats } from '../lib/stats'

export default function HistoryView({ sessions, activeId, onOpen, onDelete, onNewSession }) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Storico</h1>
        <button onClick={onNewSession} className="btn bg-emerald-500 text-slate-950">+ Nuova seduta</button>
      </div>
      {sorted.length === 0 && <p className="py-8 text-center text-slate-400">Nessuna seduta registrata.</p>}
      {sorted.map((s) => {
        const st = sessionStats(s)
        return (
          <div
            key={s.id}
            className={`rounded-2xl border p-4 ${s.id === activeId ? 'border-emerald-600 bg-slate-900' : 'border-slate-800 bg-slate-900'}`}
          >
            <button onClick={() => onOpen(s.id)} className="block w-full text-left">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold capitalize text-white">
                  {fmtDate(s.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {s.id === activeId && <span className="text-xs font-semibold text-emerald-400">In corso</span>}
              </div>
              <div className="text-sm text-slate-400">{s.title}</div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <Chip>{st.sets} serie pesi</Chip>
                <Chip>{fmtNum(st.reps, 0)} rip.</Chip>
                <Chip>{fmtNum(st.volume, 0)} kg</Chip>
                {st.timeSets > 0 && <Chip>Plank {st.timeSets} × · {st.timeSeconds}s</Chip>}
                <Chip>
                  Cardio {fmtNum(st.cardioMin)} min · {fmtNum(st.cardioKm, 2)} km
                </Chip>
                {s.durationMin ? <Chip>Durata {s.durationMin} min</Chip> : null}
              </div>
            </button>
            <div className="mt-3 flex gap-2">
              <button onClick={() => onOpen(s.id)} className="btn-ghost text-sm">Apri</button>
              <button
                onClick={() => confirm('Eliminare definitivamente questa seduta?') && onDelete(s.id)}
                className="ml-auto rounded-xl px-3 py-2 text-sm text-rose-400 active:bg-rose-950"
              >
                Elimina
              </button>
            </div>
          </div>
        )
      })}
      <p className="px-1 text-xs text-slate-500">
        Il volume è nominale (ripetizioni × carico; manubri contati ×2): indicativo e non direttamente comparabile tra macchine.
      </p>
    </div>
  )
}

function Chip({ children }) {
  return <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{children}</span>
}
