import Stepper from './Stepper'
import { fmtNum } from '../lib/stats'
import { uid } from '../schema/factories'

export default function CardioList({ title, items, onChange }) {
  const update = (id, patch) => onChange(items.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const remove = (id) => onChange(items.filter((c) => c.id !== id))
  const add = () =>
    onChange([...items, { id: uid(), name: 'Tapis roulant', minutes: 5, speed: 5.5, note: '', done: false }])

  const doneMin = items.filter((c) => c.done).reduce((a, c) => a + (Number(c.minutes) || 0), 0)
  const km = items.filter((c) => c.done).reduce((a, c) => a + ((Number(c.minutes) || 0) / 60) * (Number(c.speed) || 0), 0)

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-lg font-semibold leading-tight text-fg">{title}</h2>
        <span className="text-xs text-muted">
          {fmtNum(doneMin)} min · {fmtNum(km, 2)} km
        </span>
      </div>
      <div className="space-y-2">
        {items.map((c) => (
          <div
            key={c.id}
            className={`rounded-2xl border p-3 ${c.done ? 'border-primary/50 bg-primary-soft' : 'border-line bg-surface'}`}
          >
            <div className="flex items-center gap-2">
              <input
                value={c.name}
                onChange={(e) => update(c.id, { name: e.target.value })}
                className="min-w-0 flex-1 bg-transparent font-semibold text-fg outline-none"
              />
              <button
                onClick={() => confirm('Eliminare questa attività?') && remove(c.id)}
                className="px-2 text-muted"
                aria-label="Elimina"
              >
                ✕
              </button>
            </div>
            <div className="mt-2 flex items-end gap-3">
              <Stepper label="Minuti" value={c.minutes} step={0.5} onChange={(minutes) => update(c.id, { minutes })} />
              <Stepper label="km/h" value={c.speed} step={0.5} onChange={(speed) => update(c.id, { speed })} />
              <button
                onClick={() => update(c.id, { done: !c.done })}
                aria-label={c.done ? 'Segna come non fatta' : 'Segna come fatta'}
                className={`ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 text-xl font-bold ${
                  c.done ? 'border-primary bg-primary text-on-primary' : 'border-line text-transparent'
                }`}
              >
                <span className="anim-check inline-block">✓</span>
              </button>
            </div>
            {c.note && <p className="mt-2 text-xs text-muted">{c.note}</p>}
          </div>
        ))}
        <button onClick={add} className="btn-ghost w-full text-sm">+ Aggiungi attività</button>
      </div>
    </section>
  )
}
