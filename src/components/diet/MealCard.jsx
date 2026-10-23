import { useState } from 'react'
import { Card, Chip, Field, NumberInput, Sheet, TextInput } from '../ui'
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

export function ItemList({ items }) {
  if (!items?.length) return <p className="text-sm text-muted">Nessun alimento indicato.</p>
  return (
    <ul className="space-y-1 text-sm">
      {items.map((it, i) => (
        <li key={i}>
          <span className="text-fg">{it.name}</span>
          {it.quantity != null && (
            <span className="text-muted">
              {' '}
              · {fmtNum(it.quantity, 1)} {it.unit}
              {it.quantityBasis && BASIS[it.quantityBasis] ? ` ${BASIS[it.quantityBasis]}` : ''}
            </span>
          )}
          {it.notes && <div className="text-xs text-muted">{it.notes}</div>}
          {it.alternatives?.length > 0 && <div className="text-xs text-muted">oppure: {it.alternatives.map((a) => `${a.name}${a.quantity != null ? ` ${fmtNum(a.quantity, 1)} ${a.unit}` : ''}`).join(' · ')}</div>}
        </li>
      ))}
    </ul>
  )
}

export default function MealCard({ meal: m, plan, date, state, update, next, workoutRole, selectedId, savedId, onPreview }) {
  const [logging, setLogging] = useState(false)
  const options = optionsOf(m)
  const option = optionOf(m, selectedId)
  const n = optionNutrition(option)
  const main = optionNutrition(options[0])
  const isAlt = option.id != null
  const delta = isAlt ? optionDelta(n, main) : null
  const log = state.dietLog.find((l) => l.date === date && l.planId === plan.id && l.mealId === m.id)
  const ref = { date, planId: plan.id, planRevision: plan.revision, mealId: m.id }

  return (
    <Card tone={next ? 'info' : 'default'} className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-semibold text-fg">{m.label}</span>
          {next && <span className="text-xs text-swim">prossimo</span>}
          {workoutRole && <Chip className="bg-swim-soft text-fg">{workoutRole === 'pre' ? 'pre-allenamento' : 'post-allenamento'}</Chip>}
        </div>
        <span className="text-sm text-muted">{m.time ?? ''}</span>
      </div>

      {options.length > 1 && (
        <div className="flex flex-wrap gap-1" role="group" aria-label={`Opzioni ${m.label}`}>
          {options.map((o) => (
            <button
              key={o.id ?? 'main'}
              onClick={() => onPreview(o.id)}
              aria-pressed={option.id === o.id}
              className={`rounded-lg px-2 py-1 text-xs font-medium ${option.id === o.id ? 'bg-fg text-bg' : 'bg-surface-muted text-fg-soft'}`}
            >
              {o.label}
              {savedId === o.id && o.id != null ? ' ✓' : ''}
            </button>
          ))}
        </div>
      )}

      <ItemList items={option.items} />
      <div className="text-xs">
        <NutritionLine n={n} items={option.items} />
      </div>
      {n.mismatch.length > 0 && (
        <p className="text-[11px] text-warning">
          Attenzione: il valore dichiarato non coincide con la somma degli alimenti ({n.mismatch.map((x) => `${SHORT[x.key]} ${fmtNum(x.declared, 0)} vs ${fmtNum(x.items, 0)}`).join(', ')}). Verificare il piano.
        </p>
      )}
      {isAlt && (
        <p className="text-[11px] text-muted">
          Rispetto al principale: {MAIN_KEYS.map((k) => `${SHORT[k]} ${fmtDelta(delta[k], k)}`).join(' · ')}
          {MAIN_KEYS.some((k) => delta[k] == null) && ' (— = non confrontabile, dati mancanti)'}
        </p>
      )}
      {option.notes && <p className="text-xs text-muted">{option.notes}</p>}
      {m.guidance?.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-fg-soft">
          {m.guidance.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      )}
      {m.notes && <p className="text-xs text-muted">{m.notes}</p>}

      {options.length > 1 && selectedId !== savedId && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-muted/60 p-2 text-[11px] text-fg-soft">
          <span>Anteprima: i totali del giorno mostrano questa opzione; nulla è registrato.</span>
          <button onClick={() => update((s) => A.selectAlternative(s, { ...ref, alternativeId: selectedId }))} className="rounded-lg bg-primary px-2 py-1 font-semibold text-on-primary">
            {isAlt ? 'Scegli per questa data' : 'Torna al principale per questa data'}
          </button>
        </div>
      )}
      {savedId && selectedId === savedId && <p className="text-[11px] text-primary">Alternativa scelta per questa data (il piano non cambia).</p>}

      {log && log.planRevision != null && log.planRevision !== plan.revision && (
        <p className="text-[11px] text-warning">Registrato come “{ADHERENCE[log.status]}” sulla revisione {log.planRevision} del piano (il pasto può essere cambiato).</p>
      )}
      <div className="flex flex-wrap items-center gap-1 pt-1">
        <span className="text-[11px] text-muted">Diario (facoltativo):</span>
        {Object.entries(ADHERENCE).map(([k, label]) => (
          <button
            key={k}
            onClick={() => update((s) => A.logMeal(s, { ...ref, status: log?.status === k ? null : k }))}
            aria-pressed={log?.status === k}
            className={`rounded-lg px-2 py-1 text-xs font-medium ${log?.status === k ? 'bg-primary text-on-primary' : 'bg-surface-muted text-fg-soft'}`}
          >
            {label}
          </button>
        ))}
        <button onClick={() => setLogging(true)} className="rounded-lg px-2 py-1 text-xs text-primary underline">
          {log?.consumption ? 'Modifica quantità' : 'Registra quantità'}
        </button>
      </div>
      {log && log.status !== 'skipped' && (
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <Chip className={QUALITY[consumptionQuality(log)].cls}>{QUALITY[consumptionQuality(log)].label}</Chip>
          {log.consumption && <NutritionLine n={optionNutrition(log.consumption)} />}
          {!log.consumption && <span className="text-muted">“{ADHERENCE[log.status]}” indica l’aderenza, non i nutrienti consumati.</span>}
        </div>
      )}

      {logging && (
        <ConsumptionSheet
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
      )}
    </Card>
  )
}

const emptyN = () => ({ kcal: null, proteinG: null, carbsG: null, fatG: null, fiberG: null })
const scale = (nut, f) => (nut ? Object.fromEntries(Object.entries(nut).map(([k, v]) => [k, typeof v === 'number' && k !== 'source' ? Math.round(v * f * 10) / 10 : v])) : null)

// Registrazione di ciò che è stato realmente consumato. Precompilata con l'opzione scelta:
// i nutrienti degli alimenti seguono la quantità solo se nel piano erano noti; nulla viene aggiunto d'ufficio.
export function ConsumptionSheet({ title, option, log, onClose, onSave, onRemove, extra = false }) {
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
    <Sheet open onClose={onClose} title={title}>
      <div className="space-y-3">
        {extra ? (
          <Field label="Cosa hai mangiato (fuori piano)">
            <TextInput value={label} onChange={setLabel} placeholder="es. Spuntino al bar" />
          </Field>
        ) : (
          <div className="flex gap-1">
            {Object.entries(ADHERENCE).map(([k, l]) => (
              <button key={k} onClick={() => setStatus(k)} aria-pressed={status === k} className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${status === k ? 'bg-primary text-on-primary' : 'bg-surface-muted text-fg-soft'}`}>
                {l}
              </button>
            ))}
          </div>
        )}
        {status !== 'skipped' && (
          <>
            <p className="text-xs text-muted">Modifica quantità e alimenti come li hai consumati. Nutrienti facoltativi: lasciali vuoti se non li conosci.</p>
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
                  <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="pb-2 text-danger" aria-label={`Rimuovi ${it.name}`}>
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
            <button onClick={onRemove} className="text-danger underline">
              Elimina registrazione
            </button>
          )}
        </div>
        <button
          disabled={extra && !label.trim()}
          onClick={() => onSave({ status, consumption: status === 'skipped' ? null : consumption, note, label })}
          className="btn w-full bg-primary text-on-primary disabled:opacity-40"
        >
          Salva
        </button>
      </div>
    </Sheet>
  )
}
