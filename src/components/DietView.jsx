import { useState } from 'react'
import { Card, Disclosure, Empty, Field, Section, Segmented, Select, Sheet, TextArea, TextInput } from './ui'
import { newDietPlan, uid, clone } from '../schema/factories'
import { addDays, fmtDate, todayISO, toLocalISO, weekdayOf, WEEKDAYS_SHORT } from '../lib/dates'
import { pickDay, sortedMeals, nextMeal, isValidated, isTrainingDay, resolveTarget, hasTargets, dayPlanned, dayConsumed, deltaToTarget, selectionsFor, planCompleteness, initialDate, rangeStatus } from '../lib/diet'
import { activityOn } from '../lib/calendar'
import * as A from '../lib/actions'
import MealCard, { ConsumptionSheet } from './diet/MealCard'
import { DayTable, NutritionLine } from './diet/NutritionView'
import { GuideView, WorkoutTips, hasGuide } from './diet/GuideView'
import { TargetsEditor, GuidelinesEditor, DayTargetEditor, MealEditor } from './diet/editors'
import { optionNutrition } from '../lib/diet'
import { exportDietPlan, fileNames } from '../lib/report'
import { downloadJSON } from '../lib/download'
import { fmtNum } from '../lib/stats'

const nowHHMM = () => new Date().toTimeString().slice(0, 5)

const DAY_TYPE_LABEL = { training: 'Allenamento', rest: 'Riposo', any: 'Generico' }
const fmtLong = (d) => fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })

// Gerarchia (CR-UX-ALIM-001): intestazione compatta → giorno → pasti → informazioni secondarie.
// La gestione del piano (stato, revisioni, azioni) sta in "Gestisci piano" e non precede i pasti.
export default function DietView({ state, update, onImport }) {
  const plans = state.dietPlans
  const defaultPlan = () => plans.find((p) => p.active && !p.archived) ?? plans.find((p) => !p.archived) ?? plans[0] ?? null
  const [planId, setPlanId] = useState(() => defaultPlan()?.id ?? null)
  const plan = plans.find((p) => p.id === planId) ?? defaultPlan()
  // unica sorgente di verità del giorno consultato: resta invariata aprendo "Gestisci piano" o la guida
  const [date, setDate] = useState(() => initialDate(defaultPlan(), todayISO()))
  const [dayType, setDayType] = useState(null)
  const [editing, setEditing] = useState(null) // bozza del piano in modifica
  const [manageOpen, setManageOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [preview, setPreview] = useState({}) // anteprima delle alternative: { [data]: { [mealId]: alternativeId|null } }
  const [extraOpen, setExtraOpen] = useState(false)
  const [dir, setDir] = useState('next') // direzione dell'ultimo cambio giorno, per la transizione

  const createPlan = () => {
    const p = newDietPlan({ days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ id: uid('day'), weekday, date: null, dayType: 'any', label: '', meals: [] })) })
    update((s) => A.upsertIn(s, 'dietPlans', p))
    setPlanId(p.id)
    setEditing(clone(p))
    setManageOpen(false)
  }

  if (!plans.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-[28px] font-bold leading-tight text-fg lg:text-[32px]">Alimentazione</h1>
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
      </div>
    )
  }

  const shown = editing ?? plan
  const today = todayISO()
  const datedDays = shown ? shown.days.filter((d) => d.date).sort((a, b) => a.date.localeCompare(b.date)) : []
  const wd = weekdayOf(date)
  // Giorni di allenamento/riposo: scelta automatica in base al calendario, modificabile
  const activity = activityOn(state, date)
  const { day, types, type: effType } = pickDay(shown, date, { isTraining: activity, dayType })
  const training = isTrainingDay(day, activity)
  const meals = sortedMeals(day)
  const isToday = date === today
  const nextMealId = isToday ? nextMeal(day, nowHHMM())?.id : null
  const weekStart = addDays(date, 1 - wd)
  const outOfRange = rangeStatus(shown, date)
  const todayOutOfRange = rangeStatus(shown, today)

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
  const loggedCount = meals.filter((m) => logs.some((l) => l.mealId === m.id && l.status !== 'extra')).length
  const plannedKcal = planned?.kcal.status === 'complete' ? planned.kcal.value : null
  const targetKcal = target?.kcal.value ?? null
  const status = !plan ? '' : plan.archived ? 'Archiviato' : isValidated(plan) ? 'Validato' : 'Bozza'

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
  const goDate = (d) => {
    if (d !== date) setDir(d > date ? 'next' : 'prev')
    setDate(d)
    setDayType(null)
  }
  const switchPlan = (id) => {
    setPlanId(id)
    setEditing(null)
  }

  return (
    <div className="space-y-4">
      {/* 1. Intestazione compatta: piano consultato e stato come testo, gestione in posizione secondaria */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight text-fg lg:text-[32px]">Alimentazione</h1>
          <p className="mt-0.5 flex min-w-0 items-center gap-x-1.5 whitespace-nowrap text-sm text-muted">
            {plans.length > 1 ? (
              <select
                value={plan?.id ?? ''}
                onChange={(e) => switchPlan(e.target.value)}
                aria-label="Piano alimentare"
                className="min-w-0 max-w-[14rem] truncate rounded-md bg-transparent py-0.5 pr-1 font-medium text-fg-soft underline decoration-line-strong underline-offset-4"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.active ? ' (attivo)' : ''}
                    {p.archived ? ' (archiviato)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className="min-w-0 truncate font-medium text-fg-soft" title={plan?.name}>{plan?.name}</span>
            )}
            <span aria-hidden="true">·</span>
            <span data-testid="plan-status" className="shrink-0">{status}</span>
            {plan && !plan.active && !plan.archived && (
              <>
                <span aria-hidden="true">·</span>
                <span className="shrink-0">non attivo</span>
              </>
            )}
          </p>
        </div>
        {!editing && (
          <button onClick={() => setManageOpen(true)} className="btn-ghost shrink-0 text-sm" aria-haspopup="dialog">
            Gestisci piano
          </button>
        )}
      </header>

      {plan && !plan.active && !plan.archived && !editing && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-fg-soft">
          Stai consultando un piano non attivo.
          <button onClick={() => update((s) => A.setActiveDiet(s, plan.id))} className="font-semibold text-primary underline underline-offset-4">
            Imposta attivo
          </button>
        </p>
      )}

      {editing && (
        <>
          <PlanMetaEditor plan={editing} onChange={setEditing} onSave={saveRevision} onCancel={() => setEditing(null)} />
          <TargetsEditor targets={editing.nutritionTargets} onChange={(nutritionTargets) => setEditing({ ...editing, nutritionTargets })} />
          <GuidelinesEditor guidelines={editing.guidelines} onChange={(guidelines) => setEditing({ ...editing, guidelines })} />
        </>
      )}

      {editing && (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-line bg-bg/95 px-4 py-2 backdrop-blur lg:bottom-0 lg:left-60">
          <div className="mx-auto flex max-w-2xl gap-2">
            <button onClick={saveRevision} className="btn-primary flex-1">Salva revisione {editing.revision + 1}</button>
            <button onClick={() => setEditing(null)} className="btn-ghost">Annulla</button>
          </div>
        </div>
      )}

      {/* 2. Navigazione del giorno: settimana compatta con indicatore scorrevole; oggi riconoscibile anche senza colore */}
      <nav aria-label="Giorno del piano">
        <div className="relative grid grid-cols-7 rounded-2xl bg-surface-muted p-1">
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 rounded-xl bg-primary shadow-sm transition-transform duration-[var(--motion-indicator)] ease-[var(--ease-out-soft)]"
            style={{ width: 'calc((100% - 0.5rem) / 7)', transform: `translateX(${(wd - 1) * 100}%)` }}
          />
          {[1, 2, 3, 4, 5, 6, 7].map((n) => {
            const d = addDays(weekStart, n - 1)
            const sel = d === date
            const isT = d === today
            const special = datedDays.some((x) => x.date === d)
            return (
              <button
                key={n}
                onClick={() => goDate(d)}
                aria-current={sel ? 'date' : undefined}
                aria-label={`${fmtLong(d)}${isT ? ', oggi' : ''}${special ? ', giorno con piano specifico' : ''}`}
                className={`relative flex min-h-12 flex-col items-center justify-center rounded-xl leading-none transition-colors duration-[var(--motion-indicator)] ${sel ? 'font-bold text-on-primary' : 'text-fg-soft'}`}
              >
                <span className="text-xs">{WEEKDAYS_SHORT[n]}</span>
                <span className={`mt-1 text-base tabular-nums ${isT && !sel ? 'font-bold text-fg underline decoration-2 underline-offset-4' : ''}`}>{Number(d.slice(8))}</span>
                {special && <span className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${sel ? 'bg-on-primary' : 'bg-primary'}`} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </nav>

      {/* 3. Contenuto del giorno: titolo e pasti subito sotto */}
      <section aria-labelledby="diet-day-title" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="diet-day-title" className="min-w-0 text-xl font-semibold capitalize leading-tight text-fg">
            {fmtLong(date)}
          </h2>
          <div className="flex shrink-0 gap-1">
            <button onClick={() => goDate(addDays(date, -7))} className="btn-ghost h-11 w-11 px-0" aria-label="Settimana precedente">
              ‹
            </button>
            <button onClick={() => goDate(addDays(date, 7))} className="btn-ghost h-11 w-11 px-0" aria-label="Settimana successiva">
              ›
            </button>
          </div>
        </div>

        {/* Mini-riepilogo (solo valori disponibili e completi, niente stime) e ritorno a oggi */}
        <div className="-mt-1 flex min-h-11 flex-wrap items-center justify-between gap-x-3 text-sm text-fg-soft">
          <p data-testid="day-summary">
            {isToday && <span className="mr-1.5 rounded-full border border-line-strong px-2 py-0.5 text-xs font-semibold text-fg">Oggi</span>}
            {day && meals.length > 0 && !editing && (
              <>
                {meals.length} {meals.length === 1 ? 'pasto' : 'pasti'}
                {plannedKcal != null && <> · <b className="font-semibold text-fg">{fmtNum(plannedKcal, 0)} kcal</b> programmate</>}
                {targetKcal != null && <> · obiettivo {fmtNum(targetKcal, 0)} kcal</>}
                {loggedCount > 0 && <> · {loggedCount} di {meals.length} registrati</>}
              </>
            )}
          </p>
          {!isToday && (
            <button onClick={() => goDate(today)} className="min-h-11 font-medium text-primary underline underline-offset-4">
              Torna a oggi
            </button>
          )}
        </div>

        {outOfRange && (
          <p role="note" className="text-sm text-fg-soft">
            {outOfRange === 'before' ? `Il piano inizia il ${fmtDate(shown.validFrom)}` : `Il piano è terminato il ${fmtDate(shown.validTo)}`}: questo giorno è fuori dal periodo del piano.{' '}
            <button onClick={() => goDate(initialDate(shown, date))} className="font-medium text-primary underline underline-offset-4">
              Vai al {outOfRange === 'before' ? 'primo' : 'ultimo'} giorno
            </button>
          </p>
        )}
        {!outOfRange && todayOutOfRange && date === initialDate(shown, today) && !isToday && (
          <p role="note" className="text-sm text-fg-soft">
            Oggi è fuori dal periodo del piano: mostro il {todayOutOfRange === 'before' ? 'primo' : 'ultimo'} giorno utile.
          </p>
        )}

        {types.length > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Variante</span>
            <Segmented
              className="flex-1"
              value={effType}
              onChange={setDayType}
              aria-label="Variante del giorno"
              options={types.map((t) => ({ id: t, label: DAY_TYPE_LABEL[t] }))}
            />
          </div>
        )}

        {/* annuncio sobrio per gli screen reader al cambio di giorno */}
        <p className="sr-only" aria-live="polite">
          {`${fmtLong(date)}: ${day ? `${meals.length} ${meals.length === 1 ? 'pasto' : 'pasti'}` : 'nessun pasto previsto'}`}
        </p>

        <div key={`${date}|${effType}`} className={`${dir === 'prev' ? 'anim-day-prev' : 'anim-day-next'} space-y-3`}>
          {!day && (
            <Empty
              action={
                editing ? (
                  <button onClick={() => setEditing({ ...editing, days: [...editing.days, { id: uid('day'), weekday: wd, date: null, dayType: 'any', label: '', meals: [] }] })} className="btn-ghost text-sm">
                    + Aggiungi questo giorno al piano
                  </button>
                ) : (
                  plan && (
                    <button onClick={() => setEditing(clone(plan))} className="btn-ghost text-sm">
                      Modifica il piano
                    </button>
                  )
                )
              }
            >
              Nessun pasto previsto per questo giorno.
            </Empty>
          )}
          {day && editing && <DayTargetEditor key={day.id} day={day} onChange={editDay} />}
          {day && !meals.length && !editing && <Empty>Nessun pasto previsto per questo giorno.</Empty>}
          {day &&
            meals.map((m) =>
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
          {day && editing && (
            <button
              onClick={() => editDay({ meals: [...day.meals, { id: uid('meal'), category: 'other', label: 'Nuovo pasto', time: null, items: [], alternatives: [], nutrition: null, guidance: [], notes: '' }] })}
              className="btn-ghost w-full text-sm"
            >
              + Aggiungi pasto
            </button>
          )}
        </div>
      </section>

      {/* 4. Informazioni secondarie */}
      {day && target && !editing && (
        <Disclosure
          className="rounded-2xl border border-line bg-surface px-4"
          buttonClassName="py-2"
          summary={
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-lg font-semibold text-fg">Riepilogo nutrizionale</span>
              <span className="text-sm text-muted">obiettivo · programmato{consumed ? ' · consumato' : ''}</span>
              {previewing && <span className="text-sm font-medium text-fg-soft">con anteprima alternative</span>}
            </span>
          }
        >
          <div className="space-y-2 pb-4">
            <p className="text-sm text-fg-soft">{training ? 'Giorno di allenamento' : 'Giorno di riposo'}</p>
            <DayTable
              rows={[
                { label: 'Obiettivo', kind: 'target', hint: hasTargets(target) ? targetSources.map((x) => sourceLabel[x]).join(', ') : 'non specificato', cells: Object.fromEntries(['kcal', 'proteinG', 'carbsG', 'fatG'].map((k) => [k, target[k].value])) },
                { label: 'Programmato', kind: 'total', hint: 'dal piano, non consumato', cells: planned },
                ...(hasTargets(target) ? [{ label: 'Scostamento', kind: 'delta', hint: 'programmato − obiettivo', cells: deltaToTarget(planned, target), muted: true }] : []),
                ...(consumed ? [{ label: 'Consumato', kind: 'total', hint: 'solo quanto registrato', cells: consumed }] : []),
                ...(consumed && hasTargets(target) ? [{ label: 'Scostamento', kind: 'delta', hint: 'consumato − obiettivo', cells: deltaToTarget(consumed, target), muted: true }] : []),
              ]}
            />
            <p className="text-xs text-muted">
              ND = non disponibile. Gli scostamenti compaiono solo con totali completi. {completeness?.total ? `Pasti del piano con valori completi: ${completeness.complete}/${completeness.total}.` : ''}
            </p>
          </div>
        </Disclosure>
      )}
      {!editing && <WorkoutTips plan={shown} training={training} onOpenGuide={() => setGuideOpen(true)} />}

      {day && !editing && plan && (
        <Section title="Fuori piano" right={<button onClick={() => setExtraOpen(true)} className="min-h-11 px-1 text-sm font-medium text-primary">+ Aggiungi</button>}>
          {extras.length === 0 ? (
            <p className="px-1 text-sm text-muted">Nessuna aggiunta registrata per questo giorno.</p>
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
                  <button onClick={() => update((s) => A.removeLog(s, l.id))} className="min-h-11 px-1 text-sm text-danger underline">Elimina</button>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}

      {plan && !editing && (
        <Disclosure
          open={guideOpen}
          onToggle={setGuideOpen}
          className="rounded-2xl border border-line bg-surface px-4"
          buttonClassName="py-2"
          summary={
            <span className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-fg">Guida del piano</span>
              {!hasGuide(plan.guidelines) && <span className="text-sm text-muted">vuota</span>}
            </span>
          }
        >
          <div className="pb-4">
            <GuideView plan={plan} />
          </div>
        </Disclosure>
      )}

      {plan && (
        <ConsumptionSheet
          open={extraOpen}
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

      <Sheet open={manageOpen} onClose={() => setManageOpen(false)} title="Gestisci piano">
        {plan && (
          <ManagePlan
            plan={plan}
            plans={plans}
            datedDays={datedDays}
            onGoDate={(d) => {
              goDate(d)
              setManageOpen(false)
            }}
            onSwitch={switchPlan}
            onActivate={() => update((s) => A.setActiveDiet(s, plan.id))}
            onEdit={() => {
              setEditing(clone(plan))
              setManageOpen(false)
            }}
            onDuplicate={() => {
              const copy = { ...clone(plan), id: uid('diet'), name: `${plan.name} (copia)`, active: false, revision: 1, history: [], createdAt: toLocalISO() }
              update((s) => A.upsertIn(s, 'dietPlans', copy))
              setPlanId(copy.id)
            }}
            onArchive={() => setPlan({ ...plan, archived: !plan.archived, active: plan.archived ? plan.active : false })}
            onExport={() => downloadJSON(fileNames.diet(plan), exportDietPlan(plan))}
            onNew={createPlan}
            onImport={onImport}
            onDelete={() => {
              if (!confirm(`Eliminare il piano "${plan.name}"? Il diario dei pasti collegato resta.`)) return
              update((s) => A.removeIn(s, 'dietPlans', plan.id))
              setPlanId(null)
              setManageOpen(false)
            }}
            onRestore={(h) =>
              confirm(`Ripristinare la revisione ${h.revision}? Verrà salvata come nuova revisione.`) &&
              setPlan({ ...h.snapshot, id: plan.id, active: plan.active, archived: plan.archived, revision: plan.revision + 1, updatedAt: toLocalISO(), history: [...plan.history, { revision: plan.revision, savedAt: toLocalISO(), snapshot: clone((({ history, ...x }) => x)(plan)) }] })
            }
          />
        )}
      </Sheet>
    </div>
  )
}

// Pannello "Gestisci piano": stato, dati del piano, revisioni e azioni (prima erano una card sopra i pasti)
function ManagePlan({ plan, plans, datedDays, onGoDate, onSwitch, onActivate, onEdit, onDuplicate, onArchive, onExport, onNew, onImport, onDelete, onRestore }) {
  return (
    <div className="space-y-4 text-sm">
      {plans.length > 1 && (
        <Field label="Piano consultato">
          <Select value={plan.id} onChange={onSwitch} options={plans.map((p) => ({ value: p.id, label: `${p.name}${p.active ? ' (attivo)' : ''}${p.archived ? ' (archiviato)' : ''}` }))} />
        </Field>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted">Stato</dt>
        <dd className="text-fg">{isValidated(plan) ? `Validato${plan.validatedBy ? ` da ${plan.validatedBy}` : ''}` : 'Bozza — non validato da un professionista'}</dd>
        <dt className="text-muted">Piano attivo</dt>
        <dd className="text-fg">{plan.active ? 'Sì' : plan.archived ? 'No (archiviato)' : 'No'}</dd>
        <dt className="text-muted">Revisione</dt>
        <dd className="text-fg">{plan.revision}</dd>
        {(plan.validFrom || plan.validTo) && (
          <>
            <dt className="text-muted">Periodo</dt>
            <dd className="text-fg">{plan.validFrom ? fmtDate(plan.validFrom) : '…'} → {plan.validTo ? fmtDate(plan.validTo) : '…'}</dd>
          </>
        )}
        {plan.author && (
          <>
            <dt className="text-muted">Autore</dt>
            <dd className="text-fg">{plan.author}</dd>
          </>
        )}
      </dl>
      {plan.goal && <p className="text-fg-soft">{plan.goal}</p>}
      {plan.notes && <p className="text-xs text-muted">{plan.notes}</p>}
      <p className="text-xs text-muted">Strumento di consultazione: l’app non crea prescrizioni né calcola nutrienti non indicati nel piano.</p>

      {datedDays.length > 0 && (
        <div>
          <h3 className="mb-1 font-semibold text-fg">Giorni con piano specifico</h3>
          <ul className="divide-y divide-line">
            {datedDays.map((d) => (
              <li key={d.date}>
                <button onClick={() => onGoDate(d.date)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-fg">
                  <span className="capitalize">
                    {fmtLong(d.date)}
                    {d.label ? <span className="text-muted"> · {d.label}</span> : null}
                  </span>
                  <span className="text-primary" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {!plan.active && !plan.archived && (
          <button onClick={onActivate} className="btn-primary col-span-2">Imposta attivo</button>
        )}
        <button onClick={onEdit} className="btn-ghost">Modifica</button>
        <button onClick={onDuplicate} className="btn-ghost">Duplica</button>
        <button onClick={onExport} className="btn-ghost">Esporta JSON</button>
        <button onClick={onImport} className="btn-ghost">Importa</button>
        <button onClick={onNew} className="btn-ghost">+ Nuovo piano</button>
        <button onClick={onArchive} className="btn-ghost">{plan.archived ? 'Ripristina' : 'Archivia'}</button>
      </div>

      {plan.history?.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer py-2">Revisioni precedenti ({plan.history.length})</summary>
          <ul className="mt-1 space-y-1">
            {plan.history.map((h) => (
              <li key={h.revision} className="flex items-center justify-between">
                Rev. {h.revision} · {h.savedAt.slice(0, 10)}
                <button onClick={() => onRestore(h)} className="min-h-11 px-2 underline">
                  Ripristina
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="border-t border-line pt-3">
        <button onClick={onDelete} className="btn-danger w-full">Elimina piano</button>
      </div>
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
          <button onClick={onSave} className="btn-primary flex-1">Salva revisione</button>
          <button onClick={onCancel} className="btn-ghost">Annulla</button>
        </div>
      </Card>
    </Section>
  )
}
