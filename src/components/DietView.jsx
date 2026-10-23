import { useState } from 'react'
import { Card, Chip, Empty, Field, Section, Segmented, Select, TextArea, TextInput } from './ui'
import { newDietPlan, uid, clone } from '../schema/factories'
import { addDays, fmtDate, todayISO, toLocalISO, weekdayOf, WEEKDAYS_SHORT } from '../lib/dates'
import { pickDay, sortedMeals, nextMeal, isValidated, isTrainingDay, resolveTarget, hasTargets, dayPlanned, dayConsumed, deltaToTarget, selectionsFor, planCompleteness } from '../lib/diet'
import { activityOn } from '../lib/calendar'
import * as A from '../lib/actions'
import MealCard, { ConsumptionSheet } from './diet/MealCard'
import { DayTable, NutritionLine } from './diet/NutritionView'
import { GuideView, WorkoutTips, hasGuide } from './diet/GuideView'
import { TargetsEditor, GuidelinesEditor, DayTargetEditor, MealEditor } from './diet/editors'
import { optionNutrition } from '../lib/diet'
import { ADHERENCE } from '../schema/constants'
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
  const [sub, setSub] = useState('day')
  const [preview, setPreview] = useState({}) // anteprima delle alternative: { [data]: { [mealId]: alternativeId|null } }
  const [extraOpen, setExtraOpen] = useState(false)

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
            <button onClick={onImport} className="btn-primary">Importa piano JSON</button>
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
  const activity = activityOn(state, date)
  const { day, types, type: effType } = pickDay(shown, date, { isTraining: activity, dayType })
  const training = isTrainingDay(day, activity)
  const meals = sortedMeals(day)
  const isToday = date === todayISO()
  const nextMealId = isToday ? nextMeal(day, nowHHMM())?.id : null
  const weekStart = addDays(date, 1 - wd)

  // Obiettivo / programmato (con anteprima delle alternative) / consumato registrato
  const saved = plan ? selectionsFor(state, date, plan.id) : {}
  const datePreview = preview[date] ?? {}
  const selections = { ...saved, ...datePreview }
  const previewing = Object.entries(datePreview).some(([mid, alt]) => (saved[mid] ?? null) !== alt)
  const target = shown ? resolveTarget(shown, day, training) : null
  const planned = day ? dayPlanned(day, selections) : null
  const logs = plan ? state.dietLog.filter((l) => l.date === date) : []
  const consumed = logs.length ? dayConsumed(day, logs) : null
  const extras = logs.filter((l) => l.status === 'extra')
  const sourceLabel = { day: 'specifico del giorno', training: 'giorno di allenamento', rest: 'giorno di riposo', default: 'generale' }
  const targetSources = target ? [...new Set(['kcal', 'proteinG', 'carbsG', 'fatG'].map((k) => target[k].source).filter(Boolean))] : []
  const completeness = shown ? planCompleteness(shown) : null
  const prePost = (m) => (training && shown?.guidelines?.preWorkout?.mealCategories?.includes(m.category) ? 'pre' : training && shown?.guidelines?.postWorkout?.mealCategories?.includes(m.category) ? 'post' : null)

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

      {plan && !editing && (
        <Segmented
          value={sub}
          onChange={setSub}
          options={[
            { id: 'day', label: 'Giorno' },
            { id: 'guide', label: `Guida${hasGuide(plan.guidelines) ? '' : ' (vuota)'}` },
          ]}
        />
      )}

      {plan && (
        <Card className="space-y-2">
          <div className="flex flex-wrap items-center gap-1">
            {plan.active && <Chip className="bg-primary text-on-primary">Attivo</Chip>}
            {isValidated(plan) ? (
              <Chip className="bg-swim text-on-swim">Validato{plan.validatedBy ? ` da ${plan.validatedBy}` : ''}</Chip>
            ) : (
              <Chip className="bg-warning-soft text-warning">Bozza — non validato da un professionista</Chip>
            )}
            <Chip>rev. {plan.revision}</Chip>
            {(plan.validFrom || plan.validTo) && <Chip>{plan.validFrom ?? '…'} → {plan.validTo ?? '…'}</Chip>}
          </div>
          {plan.author && <p className="text-xs text-muted">Autore: {plan.author}</p>}
          {plan.goal && <p className="text-sm text-fg-soft">{plan.goal}</p>}
          {plan.notes && <p className="text-xs text-muted">{plan.notes}</p>}
          <p className="text-[11px] text-muted">Strumento di consultazione: l’app non crea prescrizioni né calcola nutrienti non indicati nel piano.</p>
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
                className="rounded-xl px-3 py-1.5 text-sm text-danger"
              >
                Elimina
              </button>
            </div>
          )}
          {plan.history?.length > 0 && !editing && (
            <details className="text-xs text-muted">
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

      {editing && (
        <>
          <PlanMetaEditor plan={editing} onChange={setEditing} onSave={saveRevision} onCancel={() => setEditing(null)} />
          <TargetsEditor targets={editing.nutritionTargets} onChange={(nutritionTargets) => setEditing({ ...editing, nutritionTargets })} />
          <GuidelinesEditor guidelines={editing.guidelines} onChange={(guidelines) => setEditing({ ...editing, guidelines })} />
        </>
      )}

      {editing && (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-line bg-bg/95 px-4 py-2 backdrop-blur">
          <div className="mx-auto flex max-w-2xl gap-2">
            <button onClick={saveRevision} className="btn flex-1 bg-primary text-on-primary">Salva revisione {editing.revision + 1}</button>
            <button onClick={() => setEditing(null)} className="btn-ghost">Annulla</button>
          </div>
        </div>
      )}

      {sub === 'guide' && !editing && plan && <GuideView plan={plan} />}

      {(sub === 'day' || editing) && (
        <>
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
                className={`flex-1 rounded-lg py-2 text-xs font-semibold ${n === wd ? 'bg-primary text-on-primary' : d === todayISO() ? 'bg-surface-strong text-fg' : 'bg-surface-muted text-fg-soft'}`}
              >
                {WEEKDAYS_SHORT[n]}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex items-center justify-between px-1 text-sm">
        <span className="capitalize text-fg-soft">{fmtDate(date)}</span>
        {(
          <span className="flex gap-1">
            <button onClick={() => setDate(addDays(date, -7))} className="text-muted" aria-label="Settimana precedente">‹</button>
            <button onClick={() => setDate(todayISO())} className="text-xs text-primary">oggi</button>
            <button onClick={() => setDate(addDays(date, 7))} className="text-muted" aria-label="Settimana successiva">›</button>
          </span>
        )}
      </div>
      {types.length > 1 && (
        <div className="flex gap-1">
          {types.map((t) => (
            <button key={t} onClick={() => setDayType(t)} aria-pressed={effType === t} className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${effType === t ? 'bg-swim text-on-swim' : 'bg-surface-muted text-fg-soft'}`}>
              {{ training: 'Giorno di allenamento', rest: 'Giorno di riposo', any: 'Generico' }[t]}
            </button>
          ))}
        </div>
      )}

      {day && target && !editing && (
        <Card className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-sm font-semibold text-fg">{training ? 'Giorno di allenamento' : 'Giorno di riposo'}</span>
            {previewing && <Chip className="bg-warning-soft text-warning">anteprima alternative</Chip>}
          </div>
          <DayTable
            rows={[
              { label: 'Obiettivo', kind: 'target', hint: hasTargets(target) ? targetSources.map((x) => sourceLabel[x]).join(', ') : 'non specificato', cells: Object.fromEntries(['kcal', 'proteinG', 'carbsG', 'fatG'].map((k) => [k, target[k].value])) },
              { label: 'Programmato', kind: 'total', hint: 'dal piano, non consumato', cells: planned },
              ...(hasTargets(target) ? [{ label: 'Scostamento', kind: 'delta', hint: 'programmato − obiettivo', cells: deltaToTarget(planned, target), muted: true }] : []),
              ...(consumed ? [{ label: 'Consumato', kind: 'total', hint: 'solo quanto registrato', cells: consumed }] : []),
              ...(consumed && hasTargets(target) ? [{ label: 'Scostamento', kind: 'delta', hint: 'consumato − obiettivo', cells: deltaToTarget(consumed, target), muted: true }] : []),
            ]}
          />
          <p className="text-[11px] text-muted">
            ND = non disponibile. Gli scostamenti compaiono solo con totali completi. {completeness?.total ? `Pasti del piano con valori completi: ${completeness.complete}/${completeness.total}.` : ''}
          </p>
        </Card>
      )}
      {!editing && <WorkoutTips plan={shown} training={training} onOpenGuide={() => setSub('guide')} />}

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
      {day && editing && <DayTargetEditor key={day.id} day={day} onChange={editDay} />}
      {day && (
        <div className="space-y-2">
          {meals.map((m) =>
            editing ? (
              <MealEditor key={m.id} meal={m} onChange={(meal) => editDay({ meals: day.meals.map((x) => (x.id === m.id ? meal : x)) })} onRemove={() => editDay({ meals: day.meals.filter((x) => x.id !== m.id) })} />
            ) : (
              <MealCard
                key={m.id}
                meal={m}
                next={m.id === nextMealId}
                state={state}
                update={update}
                plan={plan}
                date={date}
                workoutRole={prePost(m)}
                selectedId={selections[m.id] ?? null}
                savedId={saved[m.id] ?? null}
                onPreview={(altId) => setPreview({ ...preview, [date]: { ...datePreview, [m.id]: altId } })}
              />
            ),
          )}
          {editing && (
            <button
              onClick={() => editDay({ meals: [...day.meals, { id: uid('meal'), category: 'other', label: 'Nuovo pasto', time: null, items: [], alternatives: [], nutrition: null, guidance: [], notes: '' }] })}
              className="btn-ghost w-full text-sm"
            >
              + Aggiungi pasto
            </button>
          )}
        </div>
      )}

      {day && !editing && plan && (
        <Section title="Fuori piano" right={<button onClick={() => setExtraOpen(true)} className="text-sm text-primary">+ Aggiungi</button>}>
          {extras.length === 0 ? (
            <p className="px-1 text-xs text-muted">Nessuna aggiunta registrata per questo giorno.</p>
          ) : (
            <div className="space-y-2">
              {extras.map((l) => (
                <Card key={l.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <div className="font-medium text-fg">{l.label}</div>
                    <div className="text-xs">
                      <NutritionLine n={optionNutrition(l.consumption ?? { items: [] })} />
                    </div>
                  </div>
                  <button onClick={() => update((s) => A.removeLog(s, l.id))} className="text-xs text-danger underline">Elimina</button>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}
      {extraOpen && (
        <ConsumptionSheet
          extra
          title="Consumo fuori piano"
          option={{ id: null, items: [{ name: '', quantity: null, unit: 'g', notes: '', nutrition: null, alternatives: [] }], nutrition: null }}
          onClose={() => setExtraOpen(false)}
          onSave={({ consumption, note, label }) => {
            update((s) => A.addExtraFood(s, { date, planId: plan.id, planRevision: plan.revision, label, consumption, note }))
            setExtraOpen(false)
          }}
        />
      )}
        </>
      )}
    </div>
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
            <input type="date" value={plan.validFrom ?? ''} onChange={(e) => set({ validFrom: e.target.value || null })} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-fg" />
          </Field>
          <Field label="Valido fino al">
            <input type="date" value={plan.validTo ?? ''} onChange={(e) => set({ validTo: e.target.value || null })} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-fg" />
          </Field>
        </div>
        <Field label="Obiettivo">
          <TextInput value={plan.goal} onChange={(goal) => set({ goal })} />
        </Field>
        <Field label="Note">
          <TextArea value={plan.notes} onChange={(notes) => set({ notes })} />
        </Field>
        <p className="text-xs text-muted">Modifica i pasti qui sotto, giorno per giorno, poi salva.</p>
        <div className="flex gap-2">
          <button onClick={onSave} className="btn flex-1 bg-primary text-on-primary">Salva revisione</button>
          <button onClick={onCancel} className="btn-ghost">Annulla</button>
        </div>
      </Card>
    </Section>
  )
}
