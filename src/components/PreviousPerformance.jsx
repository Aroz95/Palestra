// Ultima esecuzione dello stesso esercizio (sola lettura): serie realmente eseguite, recupero scelto e note.
// Distinta dai valori della seduta in corso, che sono solo proposti a partire da questa.
import { fmtClock, fmtNum, progressionAdvice } from '../lib/stats'
import { fmtDate } from '../lib/dates'

const setText = (s, ex) =>
  ex.type === 'time'
    ? `${s.durationSec ?? '—'} s`
    : `${s.reps ?? '—'} × ${s.weight == null ? '—' : fmtNum(s.weight, 2)} kg${ex.perHand ? '/mano' : ''}`

export default function PreviousPerformance({ prev, ex, className = '' }) {
  if (!prev) return <p className={`text-sm text-muted ${className}`}>Nessuna esecuzione precedente: valori dalla scheda.</p>
  const p = prev.exercise
  const done = p.sets.filter((s) => s.done)
  const setNotes = p.sets.map((s, i) => ({ i, note: s.note })).filter((x) => x.note)
  const advice = progressionAdvice(prev, ex.step)
  return (
    <section aria-label="Ultima volta" data-testid="previous-performance" className={`rounded-xl bg-surface-muted px-3 py-2 text-sm ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-fg">Ultima volta</span>
        <span className="text-muted">{fmtDate(prev.date, { day: 'numeric', month: 'short' })}</span>
      </div>
      <ol className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums text-fg">
        {done.map((s, i) => (
          <li key={i}>
            <span className="text-muted">{i + 1}.</span> {setText(s, p)}
          </li>
        ))}
      </ol>
      {done.length !== ex.sets.length && (
        <p className="text-fg-soft">
          L’ultima volta {done.length} {done.length === 1 ? 'serie' : 'serie'}, oggi {ex.sets.length} previste.
        </p>
      )}
      {p.restChosen && p.rest != null && <p className="text-fg-soft">Recupero scelto: {fmtClock(p.rest * 1000)}</p>}
      {advice && <p className="text-fg-soft">{advice}</p>}
      {(p.notes || setNotes.length > 0) && (
        <div className="mt-1 space-y-0.5 border-l-2 border-line-strong pl-2 text-fg-soft" aria-label="Note della volta scorsa">
          {p.notes && <p>“{p.notes}”</p>}
          {setNotes.map((x) => (
            <p key={x.i}>
              Serie {x.i + 1}: “{x.note}”
            </p>
          ))}
        </div>
      )}
    </section>
  )
}
