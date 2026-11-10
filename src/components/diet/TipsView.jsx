// Suggerimenti personali: alternative per i pasti, come gestire la fame, fuori casa… L'elenco è dell'utente,
// separato dalla guida del piano (che arriva dal professionista e resta consultabile qui sotto).
import { useState } from 'react'
import { Disclosure, Empty, Field, Select, Sheet, TextArea } from '../ui'
import { GuideView, hasGuide } from './GuideView'
import { MEAL_CATEGORIES } from '../../schema/constants'
import { EXAMPLE_TIPS, TIP_CATEGORIES, groupTips, newTip } from '../../lib/dietTips'
import * as A from '../../lib/actions'

export default function TipsView({ state, update, plan }) {
  const tips = state.dietTips ?? []
  const [filter, setFilter] = useState('all')
  const [draft, setDraft] = useState(null) // suggerimento in scrittura (nuovo o esistente)
  const groups = groupTips(tips).filter((g) => filter === 'all' || g.category === filter)
  const isNew = draft && !tips.some((t) => t.id === draft.id)
  const save = () => {
    const text = draft.text.trim()
    if (!text) return
    update((s) => A.upsertIn(s, 'dietTips', { ...draft, text, meal: draft.category === 'alternative' ? draft.meal : null }))
    setDraft(null)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-soft">Le tue idee a portata di mano: cosa sostituire in un pasto, come gestire la fame, cosa fare fuori casa.</p>
      <button onClick={() => setDraft(newTip({ category: filter === 'all' ? 'hunger' : filter }))} className="btn-primary w-full text-sm">
        + Aggiungi
      </button>

      {tips.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtra i suggerimenti">
          {[['all', 'Tutti'], ...Object.entries(TIP_CATEGORIES)].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              className={`min-h-11 rounded-full border px-3 text-sm font-medium transition-colors duration-150 ${filter === k ? 'border-fg bg-fg text-bg' : 'border-line bg-surface text-fg-soft'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tips.length === 0 ? (
        <Empty
          action={
            <button onClick={() => update((s) => ({ ...s, dietTips: [...(s.dietTips ?? []), ...EXAMPLE_TIPS.map((t) => newTip(t))] }))} className="btn-ghost text-sm">
              Parti da qualche esempio
            </button>
          }
        >
          Nessun suggerimento. Aggiungi i tuoi, oppure parti da qualche esempio generico da modificare: non sono indicazioni del professionista.
        </Empty>
      ) : groups.length === 0 ? (
        <p className="px-1 text-sm text-muted">Nessun suggerimento in questa categoria.</p>
      ) : (
        groups.map((g) => (
          <section key={g.category} aria-label={g.label} className="space-y-2">
            <h2 className="px-1 text-sm font-semibold text-fg-soft">{g.label}</h2>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {g.tips.map((t) => (
                <li key={t.id}>
                  <button onClick={() => setDraft({ ...t })} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left" aria-label={`Modifica suggerimento: ${t.text}`}>
                    <span className="min-w-0 flex-1">
                      {t.category === 'alternative' && <span className="mb-0.5 block text-xs font-semibold text-primary">{t.meal ? MEAL_CATEGORIES[t.meal] : 'Qualsiasi pasto'}</span>}
                      <span className="block whitespace-pre-line text-base text-fg">{t.text}</span>
                    </span>
                    <span className="shrink-0 text-muted" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {plan && (
        <Disclosure
          className="rounded-2xl border border-line bg-surface px-4"
          buttonClassName="py-2"
          summary={
            <span className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-fg">Guida del piano</span>
              <span className="text-sm text-muted">{hasGuide(plan.guidelines) ? 'dal professionista' : 'vuota'}</span>
            </span>
          }
        >
          <div className="pb-4">
            <GuideView plan={plan} />
          </div>
        </Disclosure>
      )}

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={isNew ? 'Nuovo suggerimento' : 'Modifica suggerimento'}>
        {draft && (
          <div className="space-y-3">
            <Field label="Categoria">
              <Select value={draft.category} onChange={(category) => setDraft({ ...draft, category })} options={Object.entries(TIP_CATEGORIES).map(([value, label]) => ({ value, label }))} aria-label="Categoria" />
            </Field>
            {draft.category === 'alternative' && (
              <Field label="Per quale pasto" hint="Lo ritrovi anche dentro quel pasto, nel giorno.">
                <Select value={draft.meal ?? ''} onChange={(meal) => setDraft({ ...draft, meal: meal || null })} options={[{ value: '', label: 'Qualsiasi pasto' }, ...Object.entries(MEAL_CATEGORIES).map(([value, label]) => ({ value, label }))]} aria-label="Per quale pasto" />
              </Field>
            )}
            <Field label="Suggerimento">
              <TextArea value={draft.text} onChange={(text) => setDraft({ ...draft, text })} rows={4} placeholder="es. Al posto del riso: 300 g di patate" aria-label="Testo del suggerimento" />
            </Field>
            <div className="flex flex-col gap-2">
              <button onClick={save} disabled={!draft.text.trim()} className="btn-primary">Salva</button>
              {!isNew && (
                <button
                  onClick={() => {
                    update((s) => A.removeIn(s, 'dietTips', draft.id))
                    setDraft(null)
                  }}
                  className="btn-ghost text-sm text-danger"
                >
                  Elimina suggerimento
                </button>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
