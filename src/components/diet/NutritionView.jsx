// Visualizzazione dei nutrienti: valori con unità, ND distinto da 0, stato del dato sempre esplicito.
import { NUTRIENTS, MAIN_KEYS } from '../../lib/diet'
import { fmtNum } from '../../lib/stats'

const META = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n]))
export const fmtN = (v, k) => (v == null ? 'ND' : `${fmtNum(v, k === 'kcal' ? 0 : 1)}${META[k].unit === 'g' ? ' g' : ''}`)
export const fmtDelta = (v, k) => (v == null ? '—' : `${v > 0 ? '+' : ''}${fmtNum(v, k === 'kcal' ? 0 : 1)}${META[k].unit === 'g' ? ' g' : ''}`)

const STATUS_LABEL = {
  declared: 'dichiarato',
  computed: 'somma degli alimenti',
  missing: 'non disponibile',
}

// Riga compatta "420 kcal · P 28 g · C 45 g · G 12 g" con l'origine del dato
export function NutritionLine({ n, showSource = true, items }) {
  if (!n) return <span className="text-slate-500">Valori nutrizionali non disponibili</span>
  const allMissing = MAIN_KEYS.every((k) => n[k].value == null)
  if (allMissing) {
    // Totale non calcolabile: indica quanti alimenti hanno valori (il totale resta ND, nessuna stima)
    const withN = (items ?? []).filter((it) => it.nutrition && MAIN_KEYS.some((k) => it.nutrition[k] != null)).length
    return (
      <span className="text-slate-500">
        Valori nutrizionali non disponibili{withN > 0 ? ` · noti per ${withN} alimenti su ${items.length}, totale non calcolabile` : ''}
      </span>
    )
  }
  const sources = [...new Set(MAIN_KEYS.map((k) => n[k].status))]
  return (
    <span>
      <span className="text-slate-200">{MAIN_KEYS.map((k) => (k === 'kcal' ? `${fmtN(n.kcal.value, 'kcal')} kcal` : `${META[k].short} ${fmtN(n[k].value, k)}`)).join(' · ')}</span>
      {n.fiberG?.value != null && <span className="text-slate-400"> · fibre {fmtN(n.fiberG.value, 'fiberG')}</span>}
      {showSource && <span className="ml-1 text-[11px] text-slate-500">({sources.map((s) => STATUS_LABEL[s]).join(' / ')})</span>}
    </span>
  )
}

const TOTAL_STATUS = {
  complete: { label: '', cls: 'text-white' },
  partial: { label: 'parziale', cls: 'text-amber-200' },
  missing: { label: 'ND', cls: 'text-slate-500' },
}

// Tabella del giorno: Obiettivo / Programmato / Consumato (+ scostamenti), per kcal e macro
export function DayTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-400">
            <th className="py-1 text-left font-medium" />
            {MAIN_KEYS.map((k) => (
              <th key={k} className="py-1 pl-2 font-medium" title={META[k].label}>
                {k === 'kcal' ? 'kcal' : META[k].short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={`border-t border-slate-800 ${r.muted ? 'text-slate-400' : ''}`}>
              <th scope="row" className="py-1.5 pr-2 text-left font-medium text-slate-300">
                {r.label}
                {r.hint && <div className="text-[10px] font-normal text-slate-500">{r.hint}</div>}
              </th>
              {MAIN_KEYS.map((k) => {
                const c = r.cells[k]
                if (r.kind === 'delta') return <td key={k} className="py-1.5 tabular-nums text-slate-300">{fmtDelta(c, k)}</td>
                if (r.kind === 'target') return <td key={k} className="py-1.5 tabular-nums text-white">{fmtN(c, k)}</td>
                const st = TOTAL_STATUS[c?.status ?? 'missing']
                return (
                  <td key={k} className={`py-1.5 tabular-nums ${st.cls}`}>
                    {c?.value == null ? 'ND' : fmtN(c.value, k)}
                    {c?.status === 'partial' && <div className="text-[10px] text-amber-300">parziale {c.known}/{c.total}</div>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
