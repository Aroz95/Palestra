// Editor delle proprietà v4 del piano: obiettivi, guida, pasti con nutrienti e alternative.
import { useState } from 'react'
import { Card, Field, NumberInput, Section, Select, TextArea, TextInput } from '../ui'
import { MEAL_CATEGORIES } from '../../schema/constants'
import { uid } from '../../schema/factories'
import { NUTRIENTS } from '../../lib/diet'
import { GUIDE_SECTIONS } from './GuideView'

const GOAL_KEYS = [...NUTRIENTS.map((n) => [n.key, `${n.short}${n.unit === 'g' ? ' (g)' : ''}`]), ['waterMl', 'Acqua (ml)']]
const N_KEYS = NUTRIENTS.slice(0, 4).map((n) => [n.key, `${n.short}${n.unit === 'g' ? ' (g)' : ''}`])
const isBlank = (o) => !o || Object.values(o).every((v) => v == null || v === '')
const lines = (arr) => (arr ?? []).join('\n')
const toList = (text) => text.split('\n').map((x) => x.trim()).filter(Boolean)

function GoalGrid({ goal, onChange, label }) {
  const g = goal ?? {}
  const set = (k, v) => {
    const next = { ...Object.fromEntries(GOAL_KEYS.map(([key]) => [key, g[key] ?? null])), [k]: v }
    onChange(isBlank(next) ? null : next)
  }
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-slate-300">{label}</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {GOAL_KEYS.map(([k, l]) => (
          <Field key={k} label={l}>
            <NumberInput value={g[k] ?? null} onChange={(v) => set(k, v)} aria-label={`${label} ${l}`} />
          </Field>
        ))}
      </div>
    </div>
  )
}

export function TargetsEditor({ targets, onChange }) {
  const t = targets ?? { default: null, training: null, rest: null, weightLossKgPerWeek: null }
  const set = (patch) => {
    const next = { ...t, ...patch }
    onChange(['default', 'training', 'rest', 'weightLossKgPerWeek'].every((k) => isBlank(next[k])) ? null : next)
  }
  const loss = t.weightLossKgPerWeek ?? { min: null, max: null }
  return (
    <Section title="Obiettivi nutrizionali">
      <Card className="space-y-3">
        <p className="text-xs text-slate-500">Obiettivi, non consumi. I campi vuoti restano “non specificati”; allenamento e riposo prevalgono sul generale solo per i valori indicati.</p>
        <GoalGrid label="Generale" goal={t.default} onChange={(g) => set({ default: g })} />
        <GoalGrid label="Giorni di allenamento" goal={t.training} onChange={(g) => set({ training: g })} />
        <GoalGrid label="Giorni di riposo" goal={t.rest} onChange={(g) => set({ rest: g })} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Calo indicativo min (kg/sett.)">
            <NumberInput value={loss.min} onChange={(min) => set({ weightLossKgPerWeek: isBlank({ ...loss, min }) ? null : { ...loss, min } })} />
          </Field>
          <Field label="Calo indicativo max (kg/sett.)">
            <NumberInput value={loss.max} onChange={(max) => set({ weightLossKgPerWeek: isBlank({ ...loss, max }) ? null : { ...loss, max } })} />
          </Field>
        </div>
      </Card>
    </Section>
  )
}

export function DayTargetEditor({ day, onChange }) {
  return (
    <Card className="space-y-2">
      <GoalGrid label={`Obiettivo specifico di questo giorno${day.date ? ` (${day.date})` : ''} — facoltativo, prevale sugli altri`} goal={day.nutritionTarget} onChange={(nutritionTarget) => onChange({ nutritionTarget })} />
    </Card>
  )
}

export function GuidelinesEditor({ guidelines, onChange }) {
  const g = guidelines ?? { general: [], foodWeighing: [], hydration: [], preWorkout: null, postWorkout: null, notes: [] }
  const set = (patch) => {
    const next = { ...g, ...patch }
    const empty = GUIDE_SECTIONS.every(([k]) => (Array.isArray(next[k]) ? !next[k].length : !next[k]))
    onChange(empty ? null : next)
  }
  const setGuidance = (k, patch) => {
    const cur = g[k] ?? { timing: '', advice: [], mealCategories: [] }
    const next = { ...cur, ...patch }
    set({ [k]: !next.timing && !next.advice.length && !next.mealCategories.length ? null : next })
  }
  return (
    <Section title="Guida alimentare">
      <Card className="space-y-3">
        <p className="text-xs text-slate-500">Una voce per riga.</p>
        {GUIDE_SECTIONS.map(([k, label]) =>
          k === 'preWorkout' || k === 'postWorkout' ? (
            <div key={k} className="space-y-2 rounded-xl bg-slate-800/40 p-2">
              <div className="text-xs font-semibold text-slate-300">{label}</div>
              <Field label="Quando (orientativo)">
                <TextInput value={g[k]?.timing ?? ''} onChange={(timing) => setGuidance(k, { timing })} placeholder="es. circa 60–90 minuti prima" />
              </Field>
              <Field label="Consigli">
                <ListArea value={g[k]?.advice} onChange={(advice) => setGuidance(k, { advice })} label={`${label} consigli`} />
              </Field>
              <div className="flex flex-wrap gap-1">
                {Object.entries(MEAL_CATEGORIES).map(([c, l]) => {
                  const on = g[k]?.mealCategories?.includes(c)
                  return (
                    <button
                      key={c}
                      onClick={() => setGuidance(k, { mealCategories: on ? g[k].mealCategories.filter((x) => x !== c) : [...(g[k]?.mealCategories ?? []), c] })}
                      aria-pressed={!!on}
                      className={`rounded-lg px-2 py-1 text-xs ${on ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                    >
                      {l}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <Field key={k} label={label}>
              <ListArea value={g[k]} onChange={(v) => set({ [k]: v })} label={label} />
            </Field>
          ),
        )}
      </Card>
    </Section>
  )
}

// Testo multilinea ↔ elenco (le righe vuote vengono ignorate al salvataggio)
function ListArea({ value, onChange, label }) {
  const [text, setText] = useState(lines(value))
  return (
    <TextArea
      value={text}
      rows={3}
      aria-label={label}
      onChange={(t) => {
        setText(t)
        onChange(toList(t))
      }}
    />
  )
}

function NutritionFields({ nutrition, onChange, label }) {
  const n = nutrition ?? {}
  const set = (k, v) => {
    const next = { kcal: n.kcal ?? null, proteinG: n.proteinG ?? null, carbsG: n.carbsG ?? null, fatG: n.fatG ?? null, fiberG: n.fiberG ?? null, source: n.source ?? null, sourceNote: n.sourceNote ?? '', [k]: v }
    onChange(['kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG'].every((x) => next[x] == null) ? null : next)
  }
  return (
    <div className="grid grid-cols-4 gap-2">
      {N_KEYS.map(([k, l]) => (
        <Field key={k} label={l}>
          <NumberInput value={n[k] ?? null} onChange={(v) => set(k, v)} aria-label={`${label} ${l}`} />
        </Field>
      ))}
    </div>
  )
}

function ItemsEditor({ items, onChange }) {
  const upd = (i, patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="space-y-2 rounded-xl bg-slate-800/40 p-2">
          <div className="grid grid-cols-[1fr_4.5rem_3.5rem_1.5rem] items-end gap-2">
            <Field label="Alimento">
              <TextInput value={it.name} onChange={(name) => upd(i, { name })} />
            </Field>
            <Field label="Q.tà">
              <NumberInput value={it.quantity} onChange={(quantity) => upd(i, { quantity })} />
            </Field>
            <Field label="Unità">
              <TextInput value={it.unit} onChange={(unit) => upd(i, { unit })} />
            </Field>
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="pb-2 text-rose-400" aria-label="Rimuovi alimento">
              ✕
            </button>
          </div>
          <details>
            <summary className="cursor-pointer text-xs text-slate-400">Base della quantità e nutrienti dell’alimento</summary>
            <div className="mt-2 space-y-2">
              <Select
                value={it.quantityBasis ?? ''}
                onChange={(v) => upd(i, { quantityBasis: v || null })}
                aria-label="Base della quantità"
                options={[{ value: '', label: 'Base non indicata' }, { value: 'raw', label: 'a crudo' }, { value: 'cooked', label: 'cotto' }, { value: 'drained', label: 'scolato' }, { value: 'packaged', label: 'confezionato' }]}
              />
              <NutritionFields nutrition={it.nutrition} onChange={(nutrition) => upd(i, { nutrition })} label={it.name || 'alimento'} />
            </div>
          </details>
        </div>
      ))}
      <button onClick={() => onChange([...items, { id: null, name: '', quantity: null, unit: 'g', quantityBasis: null, notes: '', nutrition: null, alternatives: [] }])} className="btn-ghost w-full text-sm">
        + Alimento
      </button>
    </div>
  )
}

export function MealEditor({ meal: m, onChange, onRemove }) {
  const set = (patch) => onChange({ ...m, ...patch })
  const updAlt = (i, patch) => set({ alternatives: m.alternatives.map((a, j) => (j === i ? { ...a, ...patch } : a)) })
  return (
    <Card className="space-y-3">
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Field label="Pasto">
          <TextInput value={m.label} onChange={(label) => set({ label })} />
        </Field>
        <Field label="Ora">
          <input type="time" value={m.time ?? ''} onChange={(e) => set({ time: e.target.value || null })} className="w-full rounded-xl bg-slate-800 px-2 py-2 text-slate-100 [color-scheme:dark]" />
        </Field>
      </div>
      <Field label="Categoria">
        <Select value={m.category} onChange={(category) => set({ category })} options={Object.entries(MEAL_CATEGORIES).map(([value, label]) => ({ value, label }))} />
      </Field>
      <ItemsEditor items={m.items} onChange={(items) => set({ items })} />
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">Totale dichiarato del pasto (facoltativo)</div>
        <NutritionFields nutrition={m.nutrition} onChange={(nutrition) => set({ nutrition })} label="Pasto" />
      </div>
      <Field label="Indicazioni del pasto (una per riga)">
        <ListArea value={m.guidance} onChange={(guidance) => set({ guidance })} label="Indicazioni del pasto" />
      </Field>
      <Field label="Note">
        <TextInput value={m.notes} onChange={(notes) => set({ notes })} />
      </Field>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-300">Alternative</div>
        {m.alternatives.map((a, i) => (
          <div key={a.id} className="space-y-2 rounded-xl border border-slate-700 p-2">
            <div className="flex items-end gap-2">
              <Field label="Nome alternativa" className="flex-1">
                <TextInput value={a.label} onChange={(label) => updAlt(i, { label })} />
              </Field>
              <button onClick={() => confirm('Eliminare questa alternativa?') && set({ alternatives: m.alternatives.filter((_, j) => j !== i) })} className="pb-2 text-sm text-rose-400">
                Elimina
              </button>
            </div>
            <ItemsEditor items={a.items} onChange={(items) => updAlt(i, { items })} />
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Totale dell’alternativa (facoltativo, mai copiato dal principale)</div>
            <NutritionFields nutrition={a.nutrition} onChange={(nutrition) => updAlt(i, { nutrition })} label={a.label || 'alternativa'} />
          </div>
        ))}
        <button onClick={() => set({ alternatives: [...m.alternatives, { id: `${m.id}-alt-${uid()}`, label: '', items: [], nutrition: null, notes: '' }] })} className="btn-ghost w-full text-sm">
          + Alternativa
        </button>
      </div>
      <button onClick={() => confirm('Eliminare questo pasto?') && onRemove()} className="text-sm text-rose-400">Elimina pasto</button>
    </Card>
  )
}
