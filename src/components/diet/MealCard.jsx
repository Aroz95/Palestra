import { useState } from 'react'
import { Chip, Disclosure, Field, NumberInput, Sheet, TextInput } from '../ui'
import { NutritionLine, fmtDelta } from './NutritionView'
import { optionsOf, optionOf, optionNutrition, optionDelta, consumptionQuality, MAIN_KEYS, NUTRIENTS } from '../../lib/diet'
import { ADHERENCE } from '../../schema/constants'
import { clone } from '../../schema/factories'
import { fmtNum } from '../../lib/stats'
import * as A from '../../lib/actions'

const BASIS = { raw: 'a crudo', cooked: 'cotto', drained: 'scolato', packaged: 'confezionato', unspecified: '' }
const QUALITY = {
  complete: { label: 'consumo completo', cls: 'bg-primary-soft text-primary' },
  partial: { label: 'consumo parziale', cls: 'bg-warning-soft text-warning' },
  missing: { label: 'quantità non registrate', cls: 'bg-surface-strong text-fg-soft' },
}
const SHORT = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n.short]))

// Elenco alimenti: nome e quantità sono l'informazione primaria (quantità allineate a destra, cifre tabulari)
export function ItemList({ items }) {
  if (!items?.length) return <p className="text-sm text-muted">Nessun alimento indicato.</p>
  return (
    <ul className="divide-y divide-line">
      {items.map((it, i) => (
        <li key={i} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <span className="text-base text-fg">{it.name}</span>
            {it.notes && <p className="text-sm text-muted">{it.notes}</p>}
            {it.alternatives?.length > 0 && <p className="text-sm text-muted">oppure: {it.alternatives.map((a) => `${a.name}${a.quantity != null ? ` ${fmtNum(a.quantity, 1)} ${a.unit}` : ''}`).join(' · ')}</p>}
          </div>
          {it.quantity != null && (
            <div className="shrink-0 text-right">
              <span className="text-base font-semibold tabular-nums text-fg">
                {fmtNum(it.quantity, 1)} {it.unit}
              </span>
              {it.quantityBasis && BASIS[it.quantityBasis] && <p className="text-sm text-muted">{BASIS[it.quantityBasis]}</p>}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

// Macro essenziali in una riga (livello secondario); provenienza e dettagli restano nei "Dettagli"
function MacroLine({ n }) {
  if (MAIN_KEYS.every((k) => n[k].value == null)) return <p className="text-sm text-muted">Valori nutrizionali non disponibili</p>
  const v = (k) => (n[k].value == null ? 'ND' : `${fmtNum(n[k].value, k === 'kcal' ? 0 : 1)}${k === 'kcal' ? ' kcal' : ' g'}`)
  return (
    <p className="text-sm tabular-nums text-fg-soft">
      <span className="font-semibold text-fg">{v('kcal')}</span> · P {v('proteinG')} · C {v('carbsG')} · G {v('fatG')}
    </p>
  )
}

const LOGGED = {
  followed: 'Consumato come previsto',
  modified: 'Consumato con modifiche',
  skipped: 'Pasto saltato',
}

export default function MealCard({ meal: m, plan, date, state, update, next, workoutRole, selectedId, savedId, onPreview }) {
  const [logging, setLogging] = useState(false)
  const [details, setDetails] = useState(false)
  const options = optionsOf(m)
  const option = optionOf(m, selectedId)
  const n = optionNutrition(option)
  const main = optionNutrition(options[0])
  const isAlt = option.id != null
  const delta = isAlt ? optionDelta(n, main) : null
  const log = state.dietLog.find((l) => l.date === date && l.planId === plan.id && l.mealId === m.id)
  const ref = { date, planId: plan.id, planRevision: plan.revision, mealId: m.id }
  const previewing = options.length > 1 && selectedId !== savedId
  const titleId = `meal-${m.id}-${date}`

  return (
    <article aria-labelledby={titleId} className={`rounded-2xl border bg-surface p-4 ${next ? 'border-primary/60 ring-1 ring-primary/30' : 'border-line'}`}>
      {/* Livello primario: nome, orario, alimenti e quantità */}
      <header className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h3 id={titleId} className="text-lg font-semibold leading-tight text-fg">
            {m.label}
          </h3>
          {next && <span className="text-sm font-semibold text-primary">Prossimo</span>}
          {workoutRole && <span className="text-sm text-fg-soft">{workoutRole === 'pre' ? 'Pre-allenamento' : 'Post-allenamento'}</span>}
        </div>
        {m.time && <time className="shrink-0 text-base font-semibold tabular-nums text-fg-soft">{m.time}</time>}
      </header>

      {options.length > 1 && (
        <div className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1" role="group" aria-label={`Opzioni ${m.label}`}>
          {options.map((o) => {
            const on = option.id === o.id
            return (
              <button
                key={o.id ?? 'main'}
                onClick={() => onPreview(o.id)}
                aria-pressed={on}
                className={`min-h-11 shrink-0 rounded-xl border px-3 text-sm font-medium transition-colors duration-150 ${on ? 'border-fg bg-fg text-bg' : 'border-line bg-surface-muted text-fg-soft'}`}
              >
                {o.label}
                {savedId === o.id && o.id != null ? ' ✓' : ''}
              </button>
            )
          })}
        </div>
      )}

      <div key={option.id ?? 'main'} className="anim-swap mt-3 space-y-3">
        <ItemList items={option.items} />

        {/* Livello secondario: macro essenziali, indicazioni, avvisi che richiedono attenzione */}
        <div className="space-y-1">
          <MacroLine n={n} />
          {n.mismatch.length > 0 && <p className="text-sm font-medium text-warning">⚠ Valori dichiarati diversi dalla somma degli alimenti: verifica il piano (vedi dettagli).</p>}
          {m.guidance?.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-fg-soft">
              {m.guidance.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {previewing && (
        <div className="anim-pop mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface-muted px-3 py-2 text-sm text-fg-soft" role="status">
          <span className="w-full">
            <b className="font-semibold text-fg">Anteprima</b> · non ancora salvata: i totali del giorno la includono
          </span>
          <button onClick={() => update((s) => A.selectAlternative(s, { ...ref, alternativeId: selectedId }))} className="btn-primary min-h-11 flex-1 px-3 text-sm">
            {isAlt ? 'Scegli per questa data' : 'Torna al principale per questa data'}
          </button>
          <button onClick={() => onPreview(savedId)} className="min-h-11 px-3 text-sm font-medium text-fg-soft underline underline-offset-4">
            Annulla
          </button>
        </div>
      )}
      {!previewing && savedId && (
        <p key={savedId} className="anim-pop mt-3 text-sm font-medium text-primary" role="status">
          ✓ Alternativa scelta per questa data (il piano non cambia)
        </p>
      )}

      {/* Stato del consumo e azione principale */}
      <div className="mt-3 border-t border-line pt-3">
        {log ? (
          <div key={log.status} className="anim-pop flex flex-wrap items-center gap-2" role="status">
            <span className={`flex w-full items-center gap-2 text-sm font-semibold ${log.status === 'skipped' ? 'text-fg-soft' : 'text-primary'}`}>
              <span className={`anim-check flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${log.status === 'skipped' ? 'bg-surface-strong text-fg' : 'bg-primary text-on-primary'}`} aria-hidden="true">
                {log.status === 'skipped' ? '–' : '✓'}
              </span>
              {LOGGED[log.status]}
              {log.status !== 'skipped' && <span className="font-normal text-muted">· {log.consumption ? 'quantità registrate' : 'senza quantità'}</span>}
            </span>
            <button onClick={() => setLogging(true)} className="btn-ghost min-h-11 flex-1 text-sm">
              Modifica registrazione
            </button>
            <button onClick={() => update((s) => A.logMeal(s, { ...ref, status: null }))} className="min-h-11 px-2 text-sm text-muted underline underline-offset-4" aria-label={`Annulla registrazione ${m.label}`}>
              Annulla
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => update((s) => A.logMeal(s, { ...ref, status: 'followed' }))} className="btn-primary flex-1 text-sm">
              Segna consumato
            </button>
            <button onClick={() => setLogging(true)} className="btn-ghost flex-1 text-sm">
              Registra dettagli
            </button>
          </div>
        )}
      </div>

      {/* Su richiesta: provenienza dei valori, confronto con il principale, note, dettaglio del consumo */}
      <Disclosure open={details} onToggle={setDetails} className="mt-1" buttonClassName="text-sm font-medium text-fg-soft" summary="Dettagli">
        <div className="space-y-2 pb-1 text-sm">
          <div>
            <NutritionLine n={n} items={option.items} />
          </div>
          {n.mismatch.length > 0 && (
            <p className="text-warning">
              Dichiarato e somma degli alimenti non coincidono: {n.mismatch.map((x) => `${SHORT[x.key]} ${fmtNum(x.declared, 0)} vs ${fmtNum(x.items, 0)}`).join(', ')}.
            </p>
          )}
          {isAlt && (
            <p className="text-fg-soft">
              Rispetto al principale: {MAIN_KEYS.map((k) => `${SHORT[k]} ${fmtDelta(delta[k], k)}`).join(' · ')}
              {MAIN_KEYS.some((k) => delta[k] == null) && ' (— = non confrontabile, dati mancanti)'}
            </p>
          )}
          {option.notes && <p className="text-fg-soft">{option.notes}</p>}
          {m.notes && <p className="text-fg-soft">{m.notes}</p>}
          {log && log.status !== 'skipped' && (
            <div className="flex flex-wrap items-center gap-2">
              <Chip className={QUALITY[consumptionQuality(log)].cls}>{QUALITY[consumptionQuality(log)].label}</Chip>
              {log.consumption ? <NutritionLine n={optionNutrition(log.consumption)} /> : <span className="text-muted">“{ADHERENCE[log.status]}” indica l’aderenza, non i nutrienti consumati.</span>}
            </div>
          )}
          {log && log.planRevision != null && log.planRevision !== plan.revision && <p className="text-fg-soft">Registrato sulla revisione {log.planRevision} del piano (il pasto può essere cambiato).</p>}
        </div>
      </Disclosure>

      <ConsumptionSheet
        open={logging}
        title={`${m.label} · consumato`}
        option={option}
        log={log}
        onClose={() => setLogging(false)}
        onSave={({ status, consumption, note }) => {
          update((s) => A.logMeal(s, { ...ref, status, consumption, note }))
          setLogging(false)
        }}
        onRemove={log ? () => (update((s) => A.logMeal(s, { ...ref, status: null })), setLogging(false)) : null}
      />
    </article>
  )
}

const emptyN = () => ({ kcal: null, proteinG: null, carbsG: null, fatG: null, fiberG: null })
const scale = (nut, f) => (nut ? Object.fromEntries(Object.entries(nut).map(([k, v]) => [k, typeof v === 'number' && k !== 'source' ? Math.round(v * f * 10) / 10 : v])) : null)

// Registrazione di ciò che è stato realmente consumato. Precompilata con l'opzione scelta:
// i nutrienti degli alimenti seguono la quantità solo se nel piano erano noti; nulla viene aggiunto d'ufficio.
export function ConsumptionSheet({ open = true, title, onClose, ...props }) {
  // il modulo è montato solo da aperto (stato iniziale dai dati correnti); in chiusura il pannello mostra l'ultimo contenuto
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {open && <ConsumptionForm {...props} />}
    </Sheet>
  )
}

function ConsumptionForm({ option, log, onSave, onRemove, extra = false }) {
  const [status, setStatus] = useState(log?.status ?? (extra ? 'extra' : option?.id ? 'modified' : 'followed'))
  const [label, setLabel] = useState(log?.label ?? '')
  const [items, setItems] = useState(() =>
    (log?.consumption?.items ?? option?.items ?? []).map((it) => ({ ...clone(it), _base: log?.consumption ? null : { quantity: it.quantity, nutrition: clone(it.nutrition) } })),
  )
  const optionItemsHaveN = (option?.items ?? []).some((it) => it.nutrition)
  const [mealN, setMealN] = useState(() => clone(log?.consumption?.nutrition ?? (!log && !optionItemsHaveN ? option?.nutrition : null) ?? null))
  const [note, setNote] = useState(log?.note ?? '')

  const updItem = (i, patch) =>
    setItems(
      items.map((it, j) => {
        if (j !== i) return it
        const next = { ...it, ...patch }
        // Quantità cambiata: nutrienti ricalcolati in proporzione solo se noti nel piano
        if ('quantity' in patch && it._base?.quantity && it._base.nutrition && patch.quantity != null) next.nutrition = scale(it._base.nutrition, patch.quantity / it._base.quantity)
        return next
      }),
    )
  const setItemN = (i, k, v) => updItem(i, { nutrition: { ...(items[i].nutrition ?? emptyN()), [k]: v }, _base: null })

  const consumption = { source: 'manual', chosenAlternativeId: option?.id ?? null, items: items.map(({ _base, ...it }) => it), nutrition: mealN && Object.values(mealN).some((x) => typeof x === 'number') ? mealN : null }
  const quality = status === 'skipped' ? 'complete' : consumptionQuality({ status, consumption })

  return (
    <div className="space-y-3">
      {extra ? (
        <Field label="Cosa hai mangiato (fuori piano)">
          <TextInput value={label} onChange={setLabel} placeholder="es. Spuntino al bar" />
        </Field>
      ) : (
        <div className="flex gap-1">
          {Object.entries(ADHERENCE).map(([k, l]) => (
            <button key={k} onClick={() => setStatus(k)} aria-pressed={status === k} className={`min-h-11 flex-1 rounded-xl text-sm font-semibold transition-colors duration-150 ${status === k ? 'bg-primary text-on-primary' : 'border border-line bg-surface-muted text-fg-soft'}`}>
              {l}
            </button>
          ))}
        </div>
      )}
      {status !== 'skipped' && (
        <>
          <p className="text-sm text-muted">Modifica quantità e alimenti come li hai consumati. Nutrienti facoltativi: lasciali vuoti se non li conosci.</p>
          {items.map((it, i) => (
            <div key={i} className="space-y-2 rounded-xl bg-surface-muted/60 p-2">
              <div className="grid grid-cols-[1fr_4.5rem_3.5rem_1.5rem] items-end gap-2">
                <Field label="Alimento">
                  <TextInput value={it.name} onChange={(name) => updItem(i, { name })} />
                </Field>
                <Field label="Q.tà">
                  <NumberInput value={it.quantity} onChange={(quantity) => updItem(i, { quantity })} aria-label={`Quantità ${it.name}`} />
                </Field>
                <Field label="Unità">
                  <TextInput value={it.unit} onChange={(unit) => updItem(i, { unit })} />
                </Field>
                <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="h-11 w-6 text-danger" aria-label={`Rimuovi ${it.name}`}>
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {MAIN_KEYS.map((k) => (
                  <Field key={k} label={SHORT[k]}>
                    <NumberInput value={it.nutrition?.[k] ?? null} onChange={(v) => setItemN(i, k, v)} aria-label={`${SHORT[k]} ${it.name}`} />
                  </Field>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => setItems([...items, { name: '', quantity: null, unit: 'g', notes: '', nutrition: null, alternatives: [], _base: null }])} className="btn-ghost w-full text-sm">
            + Alimento
          </button>
          <div>
            <div className="mb-1 text-[13px] font-medium text-muted">Totale del pasto (facoltativo: se indicato prevale sulla somma degli alimenti)</div>
            <div className="grid grid-cols-4 gap-2">
              {MAIN_KEYS.map((k) => (
                <NumberInput key={k} value={mealN?.[k] ?? null} onChange={(v) => setMealN({ ...(mealN ?? emptyN()), [k]: v })} aria-label={`Totale ${SHORT[k]}`} placeholder={SHORT[k]} />
              ))}
            </div>
          </div>
        </>
      )}
      <Field label="Nota (privata)">
        <TextInput value={note} onChange={setNote} />
      </Field>
      <div className="flex items-center justify-between text-xs">
        <Chip className={QUALITY[quality].cls}>{status === 'skipped' ? 'pasto saltato (0)' : QUALITY[quality].label}</Chip>
        {onRemove && (
          <button onClick={onRemove} className="min-h-11 px-1 text-danger underline">
            Elimina registrazione
          </button>
        )}
      </div>
      <button
        disabled={extra && !label.trim()}
        onClick={() => onSave({ status, consumption: status === 'skipped' ? null : consumption, note, label })}
        className="btn-primary w-full"
      >
        Salva
      </button>
    </div>
  )
}
