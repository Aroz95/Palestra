import Stepper from './Stepper'
import { DEFAULT_REST, uid } from '../data/defaultData'

// Modifica della scheda: valori predefiniti usati quando si crea una nuova seduta.
export default function TemplateView({ template, onChange }) {
  const set = (patch) => onChange({ ...template, ...patch })
  const updateEx = (id, patch) => set({ exercises: template.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  const move = (i, dir) => {
    const list = [...template.exercises]
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    set({ exercises: list })
  }
  const addEx = () =>
    set({
      exercises: [
        ...template.exercises,
        { id: uid(), name: 'Nuovo esercizio', group: '', type: 'reps', perHand: false, step: 2.5, sets: 3, reps: 10, weight: 10, rest: DEFAULT_REST },
      ],
    })

  return (
    <div className="space-y-5">
      <header>
        <input
          value={template.name}
          onChange={(e) => set({ name: e.target.value })}
          className="w-full bg-transparent text-2xl font-bold text-white outline-none"
        />
        <p className="text-sm text-slate-400">
          Valori predefiniti per le nuove sedute. Le sedute già registrate non vengono modificate.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl bg-slate-900 p-4">
        <div className="flex items-end gap-3">
          <Stepper label="Peso corporeo (kg)" value={template.bodyWeight} step={0.5} onChange={(bodyWeight) => set({ bodyWeight })} />
        </div>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Obiettivo</span>
          <textarea
            value={template.goal}
            onChange={(e) => set({ goal: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>
      </section>

      <CardioTemplate title="Riscaldamento" items={template.warmup} onChange={(warmup) => set({ warmup })} />

      <section>
        <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-slate-300">Esercizi</h2>
        <div className="space-y-2">
          {template.exercises.map((ex, i) => (
            <div key={ex.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
              <div className="flex items-center gap-2">
                <span className="w-5 text-sm font-semibold text-slate-500">{i + 1}</span>
                <input
                  value={ex.name}
                  onChange={(e) => updateEx(ex.id, { name: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent font-semibold text-white outline-none"
                />
                <button onClick={() => move(i, -1)} className="px-1.5 text-slate-400" aria-label="Sposta su">↑</button>
                <button onClick={() => move(i, 1)} className="px-1.5 text-slate-400" aria-label="Sposta giù">↓</button>
                <button
                  onClick={() => confirm(`Eliminare "${ex.name}" dalla scheda?`) && set({ exercises: template.exercises.filter((e) => e.id !== ex.id) })}
                  className="px-1.5 text-rose-400"
                  aria-label="Elimina"
                >
                  ✕
                </button>
              </div>
              <input
                value={ex.group}
                onChange={(e) => updateEx(ex.id, { group: e.target.value })}
                placeholder="Gruppo muscolare"
                className="ml-7 w-[calc(100%-1.75rem)] bg-transparent text-sm text-slate-400 outline-none placeholder:text-slate-600"
              />
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <Stepper label="Serie" value={ex.sets} onChange={(sets) => updateEx(ex.id, { sets: Math.round(sets) })} />
                <Stepper
                  label={ex.type === 'time' ? 'Secondi' : 'Ripetizioni'}
                  value={ex.reps}
                  step={ex.type === 'time' ? 5 : 1}
                  onChange={(reps) => updateEx(ex.id, { reps })}
                />
                {ex.type !== 'time' && (
                  <Stepper label={ex.perHand ? 'Kg per mano' : 'Kg'} value={ex.weight} step={ex.step || 1} onChange={(weight) => updateEx(ex.id, { weight })} />
                )}
                <Stepper
                  label="Recupero (s)"
                  value={ex.rest ?? DEFAULT_REST}
                  step={15}
                  min={0}
                  onChange={(rest) => updateEx(ex.id, { rest: Math.round(rest) })}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-300">
                <label className="flex items-center gap-1.5">
                  Tipo
                  <select
                    value={ex.type}
                    onChange={(e) => updateEx(ex.id, { type: e.target.value })}
                    className="rounded-lg bg-slate-800 px-2 py-1"
                  >
                    <option value="reps">Ripetizioni</option>
                    <option value="time">A tempo</option>
                  </select>
                </label>
                {ex.type !== 'time' && (
                  <>
                    <label className="flex items-center gap-1.5">
                      Incremento
                      <select
                        value={ex.step}
                        onChange={(e) => updateEx(ex.id, { step: Number(e.target.value) })}
                        className="rounded-lg bg-slate-800 px-2 py-1"
                      >
                        {[0.5, 1, 2, 2.5, 5, 10].map((v) => (
                          <option key={v} value={v}>{String(v).replace('.', ',')} kg</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={ex.perHand}
                        onChange={(e) => updateEx(ex.id, { perHand: e.target.checked })}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      Manubri (per mano)
                    </label>
                  </>
                )}
              </div>
            </div>
          ))}
          <button onClick={addEx} className="btn-ghost w-full text-sm">+ Aggiungi esercizio alla scheda</button>
        </div>
      </section>

      <CardioTemplate title="Defaticamento" items={template.cooldown} onChange={(cooldown) => set({ cooldown })} />
    </div>
  )
}

function CardioTemplate({ title, items, onChange }) {
  const update = (id, patch) => onChange(items.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-slate-300">{title}</h2>
      <div className="space-y-2">
        {items.map((c) => (
          <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
            <div className="flex items-center gap-2">
              <input
                value={c.name}
                onChange={(e) => update(c.id, { name: e.target.value })}
                className="min-w-0 flex-1 bg-transparent font-semibold text-white outline-none"
              />
              <button onClick={() => onChange(items.filter((x) => x.id !== c.id))} className="px-1.5 text-rose-400" aria-label="Elimina">
                ✕
              </button>
            </div>
            <div className="mt-2 flex gap-3">
              <Stepper label="Minuti" value={c.minutes} step={0.5} onChange={(minutes) => update(c.id, { minutes })} />
              <Stepper label="km/h" value={c.speed} step={0.5} onChange={(speed) => update(c.id, { speed })} />
            </div>
          </div>
        ))}
        <button
          onClick={() => onChange([...items, { id: uid(), name: 'Tapis roulant', minutes: 5, speed: 5.5, note: '' }])}
          className="btn-ghost w-full text-sm"
        >
          + Aggiungi attività
        </button>
      </div>
    </section>
  )
}
