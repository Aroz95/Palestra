import { useState } from 'react'
import { Card, Chip, Empty, Field, NumberInput, Section, Select, TextArea, TextInput } from './ui'
import { ADHERENCE, MEAL_CATEGORIES } from '../schema/constants'
import { newDietPlan, uid, clone } from '../schema/factories'
import { addDays, fmtDate, todayISO, toLocalISO, weekdayOf, WEEKDAYS_SHORT } from '../lib/dates'
import { dayNutrition } from '../lib/report/aggregate'
import { pickDay, sortedMeals, nextMeal, isValidated } from '../lib/diet'
import { occurrencesOn } from '../lib/calendar'
import { fmtNum } from '../lib/stats'
import * as A from '../lib/actions'
import { exportDietPlan, fileNames } from '../lib/report'
import { downloadJSON } from '../lib/download'

const nowHHMM = () => new Date().toTimeString().slice(0, 5)

export default function DietView({ state, update, onImport }) {
  const plans = state.dietPlans
  const [planId, setPlanId] = useState(() => (plans.find((p) => p.active) ?? plans.find((p) => !p.archived))?.id ?? null)
  const plan = plans.find((p) => p.id === planId) ?? null
  const [date, setDate] = useState(todayISO())
  const [dayType, setDayType] = useState(null)
  const [editing, setEditing] = useState(null) // bozza del piano in modifica

  const createPlan = () => {
    const p = newDietPlan({ days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ id: uid('day'), weekday, date: null, dayType: 'any', label: '', meals: [] })) })
    update((s) => A.upsertIn(s, 'dietPlans', p))
    setPlanId(p.id)
    setEditing(clone(p))
  }

  if (!plans.length) {
    return (
      <Empty
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={onImport} className="btn bg-emerald-500 text-slate-950">Importa piano JSON</button>
            <button onClick={createPlan} className="btn-ghost">Crea piano vuoto</button>
          </div>
        }
      >
        Nessun piano alimentare. Importa un piano in formato JSON (per giorni e pasti) oppure creane uno a mano. Il diario dei pasti è facoltativo.
      </Empty>
    )
  }

  const shown = editing ?? plan
  const datedDays = shown ? shown.days.filter((d) => d.date).sort((a, b) => a.date.localeCompare(b.date)) : []
  const wd = weekdayOf(date)
  // Giorni di allenamento/riposo: scelta automatica in base al calendario, modificabile
  const isTraining = occurrencesOn(state, date).some((o) => o.kind === 'strength' || o.kind === 'swim') || state.sessions.some((s) => s.date === date)
  const { day, types, type: effType } = pickDay(shown, date, { isTraining, dayType })
  const meals = sortedMeals(day)
  const isToday = date === todayISO()
  const nextMealId = isToday ? nextMeal(day, nowHHMM())?.id : null
  const nutrition = day ? dayNutrition(day) : null
  const weekStart = addDays(date, 1 - wd)

  const setPlan = (p) => update((s) => A.upsertIn(s, 'dietPlans', p))
  const saveRevision = () => {
    // "Validato" solo con l'indicazione di chi l'ha validato: nessuna autocertificazione implicita
    if (editing.status === 'validated' && !editing.validatedBy?.trim()) return alert('Per segnare il piano come validato indica il professionista che l’ha validato, altrimenti lascialo come bozza.')
    const prev = plan
    const { history, ...snapshot } = prev
    setPlan({ ...editing, revision: prev.revision + 1, updatedAt: toLocalISO(), history: [...(prev.history ?? []), { revision: prev.revision, savedAt: toLocalISO(), snapshot: clone(snapshot) }] })
    setEditing(null)
  }
  const editDay = (patch) => setEditing({ ...editing, days: editing.days.map((d) => (d.id === day.id ? { ...d, ...patch } : d)) })

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Select
            value={planId ?? ''}
            onChange={(id) => {
              setPlanId(id)
              setEditing(null)
            }}
            aria-label="Piano alimentare"
            options={plans.map((p) => ({ value: p.id, label: `${p.active ? '★ ' : ''}${p.name}${p.archived ? ' (archiviato)' : ''}` }))}
          />
        </div>
        <button onClick={onImport} className="btn-ghost text-sm">Importa</button>
      </div>

      {plan && (
        <Card className="space-y-2">
          <div className="flex flex-wrap items-center gap-1">
            {plan.active && <Chip className="bg-emerald-600 text-white">Attivo</Chip>}
            {isValidated(plan) ? (
              <Chip className="bg-sky-700 text-white">Validato{plan.validatedBy ? ` da ${plan.validatedBy}` : ''}</Chip>
            ) : (
              <Chip className="bg-amber-500/20 text-amber-200">Bozza — non validato da un professionista</Chip>
            )}
            <Chip>rev. {plan.revision}</Chip>
            {(plan.validFrom || plan.validTo) && <Chip>{plan.validFrom ?? '…'} → {plan.validTo ?? '…'}</Chip>}
          </div>
          {plan.author && <p className="text-xs text-slate-400">Autore: {plan.author}</p>}
          {plan.goal && <p className="text-sm text-slate-300">{plan.goal}</p>}
          {plan.notes && <p className="text-xs text-slate-400">{plan.notes}</p>}
          <p className="text-[11px] text-slate-500">Strumento di consultazione: l’app non crea prescrizioni né calcola nutrienti non indicati nel piano.</p>
          {!editing && (
            <div className="flex flex-wrap gap-2 pt-1">
              {!plan.active && !plan.archived && <button onClick={() => update((s) => A.setActiveDiet(s, plan.id))} className="btn-ghost py-1.5 text-sm">Imposta attivo</button>}
              <button onClick={() => setEditing(clone(plan))} className="btn-ghost py-1.5 text-sm">Modifica</button>
              <button
                onClick={() => {
                  const copy = { ...clone(plan), id: uid('diet'), name: `${plan.name} (copia)`, active: false, revision: 1, history: [], createdAt: toLocalISO() }
                  update((s) => A.upsertIn(s, 'dietPlans', copy))
                  setPlanId(copy.id)
                }}
                className="btn-ghost py-1.5 text-sm"
              >
                Duplica
              </button>
              <button onClick={() => setPlan({ ...plan, archived: !plan.archived, active: plan.archived ? plan.active : false })} className="btn-ghost py-1.5 text-sm">
                {plan.archived ? 'Ripristina' : 'Archivia'}
              </button>
              <button onClick={() => downloadJSON(fileNames.diet(plan), exportDietPlan(plan))} className="btn-ghost py-1.5 text-sm">Esporta JSON</button>
              <button onClick={createPlan} className="btn-ghost py-1.5 text-sm">+ Nuovo</button>
              <button
                onClick={() => confirm(`Eliminare il piano "${plan.name}"? Il diario dei pasti collegato resta.`) && (update((s) => A.removeIn(s, 'dietPlans', plan.id)), setPlanId(null))}
                className="rounded-xl px-3 py-1.5 text-sm text-rose-400"
              >
                Elimina
              </button>
            </div>
          )}
          {plan.history?.length > 0 && !editing && (
            <details className="text-xs text-slate-400">
              <summary>Revisioni precedenti ({plan.history.length})</summary>
              <ul className="mt-1 space-y-1">
                {plan.history.map((h) => (
                  <li key={h.revision} className="flex items-center justify-between">
                    Rev. {h.revision} · {h.savedAt.slice(0, 10)}
                    <button
                      onClick={() => confirm(`Ripristinare la revisione ${h.revision}? Verrà salvata come nuova revisione.`) && setPlan({ ...h.snapshot, id: plan.id, active: plan.active, archived: plan.archived, revision: plan.revision + 1, updatedAt: toLocalISO(), history: [...plan.history, { revision: plan.revision, savedAt: toLocalISO(), snapshot: clone((({ history, ...x }) => x)(plan)) }] })}
                      className="underline"
                    >
                      Ripristina
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      )}

      {editing && <PlanMetaEditor plan={editing} onChange={setEditing} onSave={saveRevision} onCancel={() => setEditing(null)} />}

      {/* Navigazione giorni */}
      {datedDays.length > 0 && (
        <Select
          value={datedDays.some((d) => d.date === date) ? date : ''}
          onChange={(v) => v && setDate(v)}
          aria-label="Giorni con data specifica"
          options={[{ value: '', label: `Giorni con data specifica (${datedDays.length})` }, ...datedDays.map((d) => ({ value: d.date, label: `${fmtDate(d.date)}${d.label ? ` · ${d.label}` : ''}` }))]}
        />
      )}
      {(
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => {
            const d = addDays(weekStart, n - 1)
            return (
              <button
                key={n}
                onClick={() => {
                  setDate(d)
                  setDayType(null)
                }}
                aria-pressed={n === wd}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold ${n === wd ? 'bg-emerald-500 text-slate-950' : d === todayISO() ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                {WEEKDAYS_SHORT[n]}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex items-center justify-between px-1 text-sm">
        <span className="capitalize text-slate-300">{fmtDate(date)}</span>
        {(
          <span className="flex gap-1">
            <button onClick={() => setDate(addDays(date, -7))} className="text-slate-400" aria-label="Settimana precedente">‹</button>
            <button onClick={() => setDate(todayISO())} className="text-xs text-emerald-400">oggi</button>
            <button onClick={() => setDate(addDays(date, 7))} className="text-slate-400" aria-label="Settimana successiva">›</button>
          </span>
        )}
      </div>
      {types.length > 1 && (
        <div className="flex gap-1">
          {types.map((t) => (
            <button key={t} onClick={() => setDayType(t)} aria-pressed={effType === t} className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${effType === t ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
              {{ training: 'Giorno di allenamento', rest: 'Giorno di riposo', any: 'Generico' }[t]}
            </button>
          ))}
        </div>
      )}

      {nutrition && (
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          {[
            ['kcal', 'kcal', ''],
            ['proteinG', 'Proteine', 'g'],
            ['carbsG', 'Carboidrati', 'g'],
            ['fatG', 'Grassi', 'g'],
          ].map(([k, label, u]) => (
            <div key={k} className="rounded-xl bg-slate-900 px-1 py-2">
              <div className="text-[10px] uppercase text-slate-400">{label}</div>
              <div className="font-semibold text-white">{nutrition[k].missing ? 'ND' : `${fmtNum(nutrition[k].value, 0)}${u ? ` ${u}` : ''}`}</div>
              {nutrition[k].partial && <div className="text-[10px] text-amber-300">parziale</div>}
            </div>
          ))}
        </div>
      )}

      {!day && (
        <Empty
          action={
            editing && (
              <button onClick={() => setEditing({ ...editing, days: [...editing.days, { id: uid('day'), weekday: wd, date: null, dayType: 'any', label: '', meals: [] }] })} className="btn-ghost text-sm">
                + Aggiungi questo giorno al piano
              </button>
            )
          }
        >
          Nessun pasto previsto per questo giorno nel piano.
        </Empty>
      )}
      {day && (
        <div className="space-y-2">
          {meals.map((m) =>
            editing ? (
              <MealEditor key={m.id} meal={m} onChange={(meal) => editDay({ meals: day.meals.map((x) => (x.id === m.id ? meal : x)) })} onRemove={() => editDay({ meals: day.meals.filter((x) => x.id !== m.id) })} />
            ) : (
              <MealCard key={m.id} meal={m} next={m.id === nextMealId} state={state} update={update} plan={plan} date={date} />
            ),
          )}
          {editing && (
            <button
              onClick={() => editDay({ meals: [...day.meals, { id: uid('meal'), category: 'other', label: 'Nuovo pasto', time: null, items: [], alternatives: [], nutrition: null, notes: '' }] })}
              className="btn-ghost w-full text-sm"
            >
              + Aggiungi pasto
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function MealCard({ meal: m, next, state, update, plan, date }) {
  const log = state.dietLog.find((l) => l.date === date && l.planId === plan.id && l.mealId === m.id)
  const n = m.nutrition
  return (
    <Card tone={next ? 'info' : 'default'} className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <span className="font-semibold text-white">{m.label}</span>
          {next && <span className="ml-2 text-xs text-sky-300">prossimo</span>}
        </div>
        <span className="text-sm text-slate-400">{m.time ?? ''}</span>
      </div>
      {m.items.length === 0 && <p className="text-sm text-slate-500">Nessun alimento indicato.</p>}
      <ul className="space-y-1 text-sm">
        {m.items.map((it, i) => (
          <li key={i}>
            <span className="text-slate-100">{it.name}</span>
            {it.quantity != null && (
              <span className="text-slate-400">
                {' '}
                · {fmtNum(it.quantity, 1)} {it.unit}
              </span>
            )}
            {it.notes && <div className="text-xs text-slate-500">{it.notes}</div>}
            {it.alternatives?.length > 0 && (
              <div className="text-xs text-slate-400">oppure: {it.alternatives.map((a) => `${a.name}${a.quantity != null ? ` ${fmtNum(a.quantity, 1)} ${a.unit}` : ''}`).join(' · ')}</div>
            )}
          </li>
        ))}
      </ul>
      {m.alternatives.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-300">Alternative ({m.alternatives.length})</summary>
          <ul className="mt-1 space-y-1 text-slate-400">
            {m.alternatives.map((a, i) => (
              <li key={i}>
                {a.label && <b className="text-slate-300">{a.label}: </b>}
                {a.items.map((it) => `${it.name}${it.quantity != null ? ` ${fmtNum(it.quantity, 1)} ${it.unit}` : ''}`).join(', ')}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="text-xs text-slate-400">
        {n && [n.kcal, n.proteinG, n.carbsG, n.fatG].some((x) => x != null)
          ? `${n.kcal != null ? `${fmtNum(n.kcal, 0)} kcal` : 'kcal ND'} · P ${n.proteinG ?? 'ND'} · C ${n.carbsG ?? 'ND'} · G ${n.fatG ?? 'ND'}`
          : 'Valori nutrizionali non disponibili'}
      </div>
      {m.notes && <p className="text-xs text-slate-400">{m.notes}</p>}
      {log && log.planRevision != null && log.planRevision !== plan.revision && (
        <p className="text-[11px] text-amber-300">Registrato come “{ADHERENCE[log.status]}” sulla revisione {log.planRevision} del piano (il pasto può essere cambiato).</p>
      )}
      <div className="flex flex-wrap items-center gap-1 pt-1">
        <span className="text-[11px] text-slate-500">Diario (facoltativo):</span>
        {Object.entries(ADHERENCE).map(([k, label]) => (
          <button
            key={k}
            onClick={() => update((s) => A.logMeal(s, { date, planId: plan.id, planRevision: plan.revision, mealId: m.id, status: log?.status === k ? null : k }))}
            aria-pressed={log?.status === k}
            className={`rounded-lg px-2 py-1 text-xs font-medium ${log?.status === k ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </Card>
  )
}

function PlanMetaEditor({ plan, onChange, onSave, onCancel }) {
  const set = (patch) => onChange({ ...plan, ...patch })
  return (
    <Section title={`Modifica piano · salverà la revisione ${plan.revision + 1}`}>
      <Card className="space-y-3">
        <Field label="Nome">
          <TextInput value={plan.name} onChange={(name) => set({ name })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Autore / nota">
            <TextInput value={plan.author} onChange={(author) => set({ author })} />
          </Field>
          <Field label="Stato">
            <Select value={plan.status} onChange={(status) => set({ status })} options={[{ value: 'draft', label: 'Bozza' }, { value: 'validated', label: 'Validato da professionista' }]} />
          </Field>
          {plan.status === 'validated' && (
            <Field label="Validato da">
              <TextInput value={plan.validatedBy} onChange={(validatedBy) => set({ validatedBy })} />
            </Field>
          )}
          <Field label="Valido dal">
            <input type="date" value={plan.validFrom ?? ''} onChange={(e) => set({ validFrom: e.target.value || null })} className="w-full rounded-xl bg-slate-800 px-3 py-2 text-slate-100 [color-scheme:dark]" />
          </Field>
          <Field label="Valido fino al">
            <input type="date" value={plan.validTo ?? ''} onChange={(e) => set({ validTo: e.target.value || null })} className="w-full rounded-xl bg-slate-800 px-3 py-2 text-slate-100 [color-scheme:dark]" />
          </Field>
        </div>
        <Field label="Obiettivo">
          <TextInput value={plan.goal} onChange={(goal) => set({ goal })} />
        </Field>
        <Field label="Note">
          <TextArea value={plan.notes} onChange={(notes) => set({ notes })} />
        </Field>
        <p className="text-xs text-slate-500">Modifica i pasti qui sotto, giorno per giorno, poi salva.</p>
        <div className="flex gap-2">
          <button onClick={onSave} className="btn flex-1 bg-emerald-500 text-slate-950">Salva revisione</button>
          <button onClick={onCancel} className="btn-ghost">Annulla</button>
        </div>
      </Card>
    </Section>
  )
}

function MealEditor({ meal: m, onChange, onRemove }) {
  const set = (patch) => onChange({ ...m, ...patch })
  const updItem = (i, patch) => set({ items: m.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) })
  const n = m.nutrition ?? { kcal: null, proteinG: null, carbsG: null, fatG: null }
  const setN = (patch) => {
    const next = { ...n, ...patch }
    set({ nutrition: Object.values(next).every((x) => x == null) ? null : next })
  }
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
      {m.items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_4.5rem_4rem_2rem] items-end gap-2">
          <Field label="Alimento">
            <TextInput value={it.name} onChange={(name) => updItem(i, { name })} />
          </Field>
          <Field label="Q.tà">
            <NumberInput value={it.quantity} onChange={(quantity) => updItem(i, { quantity })} />
          </Field>
          <Field label="Unità">
            <TextInput value={it.unit} onChange={(unit) => updItem(i, { unit })} />
          </Field>
          <button onClick={() => set({ items: m.items.filter((_, j) => j !== i) })} className="pb-2 text-rose-400" aria-label="Rimuovi alimento">✕</button>
        </div>
      ))}
      <button onClick={() => set({ items: [...m.items, { name: '', quantity: null, unit: 'g', notes: '', alternatives: [] }] })} className="btn-ghost w-full text-sm">+ Alimento</button>
      <div className="grid grid-cols-4 gap-2">
        {[
          ['kcal', 'kcal'],
          ['proteinG', 'P (g)'],
          ['carbsG', 'C (g)'],
          ['fatG', 'G (g)'],
        ].map(([k, l]) => (
          <Field key={k} label={l}>
            <NumberInput value={n[k]} onChange={(v) => setN({ [k]: v })} />
          </Field>
        ))}
      </div>
      <Field label="Note">
        <TextInput value={m.notes} onChange={(notes) => set({ notes })} />
      </Field>
      <button onClick={() => confirm('Eliminare questo pasto?') && onRemove()} className="text-sm text-rose-400">Elimina pasto</button>
    </Card>
  )
}
