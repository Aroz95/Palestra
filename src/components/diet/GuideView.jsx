// Guida alimentare del piano: sezioni consultabili, richiamo compatto nei giorni di allenamento.
import { MEAL_CATEGORIES } from '../../schema/constants'
import { Empty } from '../ui'
import { fmtNum } from '../../lib/stats'

export const GUIDE_SECTIONS = [
  ['general', 'Indicazioni generali'],
  ['foodWeighing', 'Come pesare gli alimenti'],
  ['hydration', 'Idratazione'],
  ['preWorkout', 'Prima dell’allenamento'],
  ['postWorkout', 'Dopo l’allenamento'],
  ['notes', 'Note e avvertenze'],
]

const isEmptyGuidance = (g) => !g || (!g.timing && !g.advice?.length)
export const hasGuide = (gl) => !!gl && GUIDE_SECTIONS.some(([k]) => (Array.isArray(gl[k]) ? gl[k].length : !isEmptyGuidance(gl[k])))

function Guidance({ g }) {
  return (
    <div className="space-y-1">
      {g.timing && (
        <p className="text-fg">
          <span className="text-muted">Quando: </span>
          {g.timing}
        </p>
      )}
      <List items={g.advice} />
      {g.mealCategories?.length > 0 && <p className="text-xs text-muted">Pasti interessati: {g.mealCategories.map((c) => MEAL_CATEGORIES[c]).join(', ')}</p>}
    </div>
  )
}

function List({ items }) {
  if (!items?.length) return null
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((t, i) => (
        <li key={i} className="whitespace-pre-line">{t}</li>
      ))}
    </ul>
  )
}

export function GuideView({ plan }) {
  const gl = plan.guidelines
  const loss = plan.nutritionTargets?.weightLossKgPerWeek
  if (!hasGuide(gl) && !loss) return <Empty>Il piano non contiene una guida alimentare. Puoi aggiungerla con “Modifica”.</Empty>
  return (
    <div className="space-y-2 text-sm text-fg-soft">
      {loss && (loss.min != null || loss.max != null) && (
        <p className="rounded-xl bg-surface p-3 text-xs text-muted">
          Andamento di peso indicato dal piano: {fmtNum(loss.min, 1)}–{fmtNum(loss.max, 1)} kg a settimana. È un obiettivo orientativo, non una promessa di risultato.
        </p>
      )}
      {GUIDE_SECTIONS.map(([k, label]) => {
        const v = gl?.[k]
        const empty = Array.isArray(v) ? !v.length : isEmptyGuidance(v)
        if (empty) return null
        return (
          <details key={k} open={k === 'general'} className="rounded-2xl border border-line bg-surface p-3">
            <summary className="cursor-pointer font-semibold text-fg">{label}</summary>
            <div className="mt-2">{Array.isArray(v) ? <List items={v} /> : <Guidance g={v} />}</div>
          </details>
        )
      })}
    </div>
  )
}

// Richiamo compatto per la giornata: consigli prima/dopo l'allenamento nei giorni di allenamento
export function WorkoutTips({ plan, training, onOpenGuide }) {
  const gl = plan?.guidelines
  if (!training || !gl || (isEmptyGuidance(gl.preWorkout) && isEmptyGuidance(gl.postWorkout))) return null
  const line = (g) => [g.timing, g.advice?.[0]].filter(Boolean).join(' · ')
  return (
    <div className="space-y-1 rounded-2xl border border-swim/40 bg-swim-soft p-3 text-xs text-fg">
      {!isEmptyGuidance(gl.preWorkout) && (
        <p>
          <b>Prima dell’allenamento:</b> {line(gl.preWorkout)}
        </p>
      )}
      {!isEmptyGuidance(gl.postWorkout) && (
        <p>
          <b>Dopo l’allenamento:</b> {line(gl.postWorkout)}
        </p>
      )}
      <button onClick={onOpenGuide} className="underline">Guida completa</button>
    </div>
  )
}
