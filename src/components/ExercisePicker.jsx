// CAT-01 — Selettore "Aggiungi esercizio": ricerca (nome, alias italiano/inglese, gruppo, attrezzo), ordine A–Z
// in italiano, filtri per gruppo e attrezzo, schede/tutti; un solo risultato per esercizio canonico.
// Gli esercizi personalizzati sono una sezione separata in fondo.
import { useMemo, useState } from 'react'
import ExerciseThumb from './ExerciseThumb'
import { EQUIPMENT } from '../schema/constants'
import { CATALOG, GROUPS, catalogMatch, groupOf, normText } from '../schema/catalog'
import { exerciseKey, newTemplateExercise } from '../schema/factories'

const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true })

// Voce del catalogo come esercizio di scheda (valori iniziali generici: i carichi arrivano dallo storico se esiste)
export function texFromCatalog(c) {
  return newTemplateExercise({
    id: c.id,
    name: c.name,
    group: c.group,
    type: c.type,
    equipment: c.equipment,
    perHand: c.perHand,
    step: c.equipment === 'dumbbell' ? 1 : 2.5,
    sets: 3,
    repMin: c.type === 'time' ? null : 8,
    repMax: c.type === 'time' ? null : 12,
    durationSec: c.type === 'time' ? 30 : null,
    suggestedWeightKg: c.equipment === 'bodyweight' ? 0 : null,
    restSeconds: 90,
  })
}

// Elenco unico: esercizi delle schede (con i loro valori) + catalogo, senza doppioni dello stesso esercizio canonico
export function buildCandidates({ templates, currentTemplateId, sessionExercises }) {
  const inSession = new Set(sessionExercises.map((e) => exerciseKey(e)))
  const byKey = new Map()
  const ordered = [...templates].sort((a, b) => (a.id === currentTemplateId ? -1 : b.id === currentTemplateId ? 1 : 0))
  for (const t of ordered) {
    for (const tex of t.exercises) {
      const key = exerciseKey(tex)
      const prev = byKey.get(key)
      const from = `${t.label ? `${t.label} · ` : ''}${t.name}`
      if (prev) {
        prev.from.push(from)
        prev.inCurrent ||= t.id === currentTemplateId
        continue
      }
      const entry = catalogMatch(tex)
      byKey.set(key, { key, tex, entry, from: [from], inCurrent: t.id === currentTemplateId })
    }
  }
  for (const c of CATALOG) {
    const tex = texFromCatalog(c)
    const key = exerciseKey(tex)
    if (!byKey.has(key)) byKey.set(key, { key, tex, entry: c, from: [], inCurrent: false })
  }
  return [...byKey.values()].map((x) => {
    const name = x.entry?.name ?? x.tex.name
    const group = groupOf(x.tex) ?? x.entry?.group ?? null
    const equipment = x.entry?.equipment ?? x.tex.equipment
    return {
      ...x,
      name,
      originalName: normText(x.tex.name) !== normText(name) ? x.tex.name : null,
      group,
      equipment,
      inSession: inSession.has(x.key),
      haystack: normText([name, x.tex.name, ...(x.entry?.aliases ?? []), group, x.tex.group, EQUIPMENT[equipment]].filter(Boolean).join(' ')),
    }
  })
}

export function filterCandidates(list, { query = '', group = '', equipment = '', scope = 'all' } = {}) {
  const words = normText(query).split(' ').filter(Boolean)
  return list
    .filter((x) => (scope === 'templates' ? x.from.length > 0 : true))
    .filter((x) => !group || x.group === group)
    .filter((x) => !equipment || x.equipment === equipment)
    .filter((x) => words.every((w) => x.haystack.includes(w)))
    .sort((a, b) => collator.compare(a.name, b.name))
}

export default function ExercisePicker({ candidates, onPick, onCustom }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [equipment, setEquipment] = useState('')
  const [scope, setScope] = useState('all')
  const results = useMemo(() => filterCandidates(candidates, { query, group, equipment, scope }), [candidates, query, group, equipment, scope])
  const selectCls = 'min-h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-2 text-sm text-fg'

  return (
    <div className="space-y-3">
      <div className="sticky -top-4 z-10 -mx-4 space-y-2 border-b border-line bg-surface px-4 pb-3 pt-1">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca: lat, chest press, alzate laterali…"
          aria-label="Cerca esercizio"
          className="min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-base text-fg placeholder:text-muted"
        />
        <div className="flex gap-2">
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Gruppo muscolare" className={selectCls}>
            <option value="">Gruppi</option>
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select value={equipment} onChange={(e) => setEquipment(e.target.value)} aria-label="Attrezzo" className={selectCls}>
            <option value="">Attrezzi</option>
            {Object.entries(EQUIPMENT).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Provenienza" className={selectCls}>
            <option value="all">Tutti</option>
            <option value="templates">Schede</option>
          </select>
        </div>
        <p className="text-xs text-muted" aria-live="polite">
          {results.length} {results.length === 1 ? 'esercizio' : 'esercizi'} · ordine alfabetico
        </p>
      </div>

      {results.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">Nessun esercizio trovato. Puoi crearne uno personalizzato qui sotto.</p>
      ) : (
        <ul className="divide-y divide-line" aria-label="Esercizi">
          {results.map((x) => (
            <li key={x.key}>
              <button
                onClick={() => onPick(x.tex)}
                disabled={x.inSession}
                className="flex min-h-14 w-full items-center gap-3 py-2 text-left disabled:opacity-60"
                aria-label={`${x.name}${x.inSession ? ', già nella seduta' : ''}`}
              >
                <ExerciseThumb ex={x.tex} entry={x.entry} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-fg">{x.name}</span>
                  <span className="block truncate text-sm text-muted">
                    {[x.group, EQUIPMENT[x.equipment], x.originalName && `nella scheda: ${x.originalName}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {x.inSession ? (
                  <span className="shrink-0 text-xs font-medium text-muted">Già nella seduta</span>
                ) : x.from.length > 0 ? (
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-fg-soft">{x.inCurrent ? 'Scheda' : 'Altra scheda'}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line pt-3">
        <button onClick={() => onCustom(query.trim())} className="btn-ghost w-full text-sm">
          + Esercizio personalizzato{query.trim() ? `: “${query.trim()}”` : ''}
        </button>
      </div>
    </div>
  )
}
