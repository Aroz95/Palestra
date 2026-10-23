import { useState } from 'react'
import { Card, Chip, Empty, Field, NumberInput, Section, Select, Sheet, TextArea, TextInput, Toggle } from './ui'
import { EQUIPMENT, ACTIVITY_KINDS, SWIM_STYLES } from '../schema/constants'
import { newProgram, newTemplateExercise, newCardio, uid } from '../schema/factories'
import { exampleProgram } from '../schema/example'
import * as A from '../lib/actions'
import { WEEKDAYS } from '../lib/dates'
import { previewBlock, blockIssues, regenerateBlocks, expandedSegments, blockTotal, blocksTotal, formatBlock } from '../lib/swim'
import { exportProgram, fileNames } from '../lib/report'
import { downloadJSON } from '../lib/download'
import { fmtNum } from '../lib/stats'

export default function ProgramsView({ state, update, onStartTemplate, onImport }) {
  const [openId, setOpenId] = useState(() => (state.programs.find((p) => p.isMain) ?? state.programs[0])?.id ?? null)
  const [editing, setEditing] = useState(null) // id scheda
  const [showArchived, setShowArchived] = useState(false)
  const programs = state.programs.filter((p) => showArchived || p.status !== 'archived')

  const addProgram = () => {
    const p = newProgram({ isMain: !state.programs.some((x) => x.isMain) })
    update((s) => A.upsertProgram(s, p))
    setOpenId(p.id)
  }
  const loadExample = () => {
    const { program, templates } = exampleProgram()
    program.isMain = !state.programs.some((x) => x.isMain)
    update((s) => ({ ...A.upsertProgram(s, program), workoutTemplates: [...s.workoutTemplates, ...templates] }))
    setOpenId(program.id)
  }

  const editingTemplate = state.workoutTemplates.find((t) => t.id === editing)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={addProgram} className="btn-primary">+ Programma</button>
        <button onClick={onImport} className="btn-ghost">Importa JSON</button>
        <button onClick={loadExample} className="btn-ghost">Carica esempio</button>
      </div>
      <Toggle checked={showArchived} onChange={setShowArchived} label="Mostra programmi archiviati" />

      {programs.length === 0 && (
        <Empty>
          Nessun programma. Creane uno, importa un file JSON (ad esempio un programma A/B) oppure carica l’esempio “Total Body”.
        </Empty>
      )}

      {programs.map((p) => (
        <ProgramCard
          key={p.id}
          program={p}
          state={state}
          update={update}
          open={openId === p.id}
          onToggle={() => setOpenId(openId === p.id ? null : p.id)}
          onEditTemplate={setEditing}
          onStartTemplate={onStartTemplate}
        />
      ))}

      {/* Schede senza programma (es. importate da backup) */}
      {state.workoutTemplates.some((t) => !t.programId || !state.programs.some((p) => p.id === t.programId)) && (
        <Section title="Schede senza programma">
          <TemplateList
            templates={state.workoutTemplates.filter((t) => !t.programId || !state.programs.some((p) => p.id === t.programId))}
            update={update}
            onEdit={setEditing}
            onStart={onStartTemplate}
          />
        </Section>
      )}

      <Sheet open={!!editingTemplate} onClose={() => setEditing(null)} title={editingTemplate ? `Scheda ${editingTemplate.label} · ${editingTemplate.name}` : ''}>
        {editingTemplate && <TemplateEditor template={editingTemplate} sessions={state.sessions} onChange={(t) => update((s) => A.upsertTemplate(s, t))} />}
      </Sheet>
    </div>
  )
}

function ProgramCard({ program: p, state, update, open, onToggle, onEditTemplate, onStartTemplate }) {
  const templates = state.workoutTemplates.filter((t) => t.programId === p.id)
  const set = (patch) => update((s) => A.upsertProgram(s, { ...p, ...patch }))
  const nextLabel = String.fromCharCode(65 + templates.length)
  const remove = () => {
    if (!confirm(`Eliminare il programma "${p.name}" e le sue ${templates.length} schede? Le sedute già svolte restano nello storico.`)) return
    update((s) => ({ ...s, programs: s.programs.filter((x) => x.id !== p.id), workoutTemplates: s.workoutTemplates.filter((t) => t.programId !== p.id) }))
  }

  return (
    <Card tone={p.isMain ? 'info' : 'default'} className="space-y-3">
      <button onClick={onToggle} className="flex w-full items-center gap-2 text-left" aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-fg">{p.name}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {p.isMain && <Chip className="bg-swim text-on-swim">Principale</Chip>}
            <Chip>{{ active: 'Attivo', draft: 'Bozza', archived: 'Archiviato' }[p.status]}</Chip>
            <Chip>{templates.filter((t) => !t.archived).length} schede</Chip>
            {p.validFrom && <Chip>dal {p.validFrom}</Chip>}
          </div>
        </div>
        <span className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-line pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome">
              <TextInput value={p.name} onChange={(name) => set({ name })} />
            </Field>
            <Field label="Stato">
              <Select
                value={p.status}
                onChange={(status) => set({ status, isMain: status === 'archived' ? false : p.isMain })}
                options={[
                  { value: 'active', label: 'Attivo' },
                  { value: 'draft', label: 'Bozza' },
                  { value: 'archived', label: 'Archiviato' },
                ]}
              />
            </Field>
            <Field label="Valido dal">
              <input type="date" value={p.validFrom ?? ''} onChange={(e) => set({ validFrom: e.target.value || null })} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-fg" />
            </Field>
            <Field label="Valido fino al (facoltativo)">
              <input type="date" value={p.validTo ?? ''} onChange={(e) => set({ validTo: e.target.value || null })} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-fg" />
            </Field>
          </div>
          <Field label="Descrizione">
            <TextArea value={p.description} onChange={(description) => set({ description })} />
          </Field>
          {!p.isMain && p.status !== 'archived' && (
            <button onClick={() => update((s) => A.setMainProgram(s, p.id))} className="btn-ghost text-sm">Imposta come principale</button>
          )}

          <Section title="Schede" right={<button onClick={() => update((s) => A.addTemplate(s, p.id, nextLabel).state)} className="text-sm text-primary">+ Scheda {nextLabel}</button>}>
            <TemplateList templates={templates} update={update} onEdit={onEditTemplate} onStart={onStartTemplate} />
          </Section>

          <ScheduleEditor program={p} templates={templates} onChange={(weeklySchedule) => set({ weeklySchedule })} />

          <div className="flex flex-wrap gap-2">
            <button onClick={() => downloadJSON(fileNames.program(p), exportProgram(state, p.id))} className="btn-ghost text-sm">Esporta JSON</button>
            <button onClick={remove} className="rounded-xl px-3 py-2 text-sm text-danger">Elimina programma</button>
          </div>
        </div>
      )}
    </Card>
  )
}

function TemplateList({ templates, update, onEdit, onStart }) {
  if (!templates.length) return <Empty>Nessuna scheda.</Empty>
  return (
    <div className="space-y-2">
      {templates.map((t) => (
        <div key={t.id} className={`rounded-xl bg-surface-muted/60 p-3 ${t.archived ? 'opacity-60' : ''}`}>
          <div className="flex items-start gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-strong font-bold text-fg">{t.label || '·'}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-fg">{t.name}</div>
              <div className="text-xs text-muted">
                {t.exercises.length} esercizi · revisione {t.revision}
                {t.estimatedMinutes ? ` · ~${t.estimatedMinutes} min` : ''}
                {t.archived ? ' · archiviata' : ''}
                {!t.exercises.length && <span className="text-warning"> · incompleta</span>}
              </div>
            </div>
            <button onClick={() => update((s) => A.moveTemplate(s, t.id, -1))} className="px-1 text-muted" aria-label={`Sposta su ${t.name}`}>↑</button>
            <button onClick={() => update((s) => A.moveTemplate(s, t.id, 1))} className="px-1 text-muted" aria-label={`Sposta giù ${t.name}`}>↓</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {!t.archived && (
              <button onClick={() => onStart(t.id)} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary">▶ Avvia</button>
            )}
            <button onClick={() => onEdit(t.id)} className="btn-ghost py-1.5 text-sm">Modifica</button>
            <button onClick={() => update((s) => A.duplicateTemplate(s, t.id))} className="btn-ghost py-1.5 text-sm">Duplica</button>
            <button onClick={() => update((s) => ({ ...s, workoutTemplates: s.workoutTemplates.map((x) => (x.id === t.id ? { ...x, archived: !x.archived } : x)) }))} className="btn-ghost py-1.5 text-sm">
              {t.archived ? 'Ripristina' : 'Archivia'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ScheduleEditor({ program, templates, onChange }) {
  const slots = program.weeklySchedule
  const add = (weekday) => onChange([...slots, { id: uid('slot'), weekday, kind: templates.length ? 'strength' : 'swim', templateId: templates.find((t) => !t.archived)?.id ?? null, label: '', swimPlan: null }])
  const upd = (id, patch) => onChange(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const [swimEdit, setSwimEdit] = useState(null)
  const swimSlot = slots.find((s) => s.id === swimEdit)
  return (
    <Section title="Calendario settimanale">
      <p className="mb-2 px-1 text-xs text-muted">Le ricorrenze creano attività previste, non sedute svolte. Puoi mettere più attività nello stesso giorno.</p>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
          <div key={wd} className="rounded-xl bg-surface-muted/40 p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-fg">{WEEKDAYS[wd]}</span>
              <button onClick={() => add(wd)} className="text-xs text-primary" aria-label={`Aggiungi attività ${WEEKDAYS[wd]}`}>+ attività</button>
            </div>
            {slots.filter((s) => s.weekday === wd).map((s) => (
              <div key={s.id} className="mt-2 flex flex-wrap items-center gap-2">
                <select value={s.kind} onChange={(e) => upd(s.id, { kind: e.target.value, swimPlan: null })} className="rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm text-fg" aria-label="Tipo attività">
                  {Object.entries(ACTIVITY_KINDS).map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
                {s.kind === 'strength' && (
                  <select value={s.templateId ?? ''} onChange={(e) => upd(s.id, { templateId: e.target.value || null })} className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm text-fg" aria-label="Scheda">
                    <option value="">— scheda —</option>
                    {templates.filter((t) => !t.archived).map((t) => (
                      <option key={t.id} value={t.id}>{t.label ? `${t.label} · ` : ''}{t.name}</option>
                    ))}
                  </select>
                )}
                {s.kind === 'swim' && (
                  <button onClick={() => setSwimEdit(s.id)} className="btn-ghost flex-1 py-1.5 text-left text-sm">
                    {s.swimPlan?.plannedBlocks?.length ? `Piano: ${blocksTotal(s.swimPlan.plannedBlocks)} m` : 'Nuoto libero (aggiungi piano)'}
                  </button>
                )}
                {(s.kind === 'other' || s.kind === 'rest') && (
                  <input value={s.label} onChange={(e) => upd(s.id, { label: e.target.value })} placeholder="Etichetta" className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm text-fg" />
                )}
                <button onClick={() => onChange(slots.filter((x) => x.id !== s.id))} className="px-2 text-danger" aria-label="Rimuovi attività">✕</button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <Sheet open={!!swimSlot} onClose={() => setSwimEdit(null)} title="Piano di nuoto">
        {swimSlot && <SwimPlanEditor plan={swimSlot.swimPlan} onChange={(swimPlan) => upd(swimSlot.id, { swimPlan })} />}
      </Sheet>
    </Section>
  )
}

export function SwimPlanEditor({ plan, onChange }) {
  const p = plan ?? { title: 'Nuoto', poolLengthM: 25, style: 'Stile libero', goal: '', estimatedMinutes: null, plannedBlocks: [], plannedDistanceM: null }
  const set = (patch) => {
    const next = { ...p, ...patch }
    next.plannedDistanceM = next.plannedBlocks.length ? blocksTotal(next.plannedBlocks) : null
    onChange(next)
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vasca (m)">
          <NumberInput value={p.poolLengthM} onChange={(poolLengthM) => set({ poolLengthM })} min={1} />
        </Field>
        <Field label="Durata prevista (min)">
          <NumberInput value={p.estimatedMinutes} onChange={(estimatedMinutes) => set({ estimatedMinutes })} />
        </Field>
      </div>
      <Field label="Stile">
        <Select value={p.style} onChange={(style) => set({ style })} options={SWIM_STYLES.map((x) => ({ value: x, label: x }))} />
      </Field>
      <Field label="Obiettivo">
        <TextInput value={p.goal} onChange={(goal) => set({ goal })} placeholder="es. tecnica, resistenza" />
      </Field>
      <BlocksEditor blocks={p.plannedBlocks} onChange={(plannedBlocks) => set({ plannedBlocks })} />
    </div>
  )
}

export function BlocksEditor({ blocks, onChange }) {
  const [text, setText] = useState('')
  const pv = previewBlock(text)
  const issues = blockIssues(blocks)
  const add = () => {
    if (!pv?.ok) return // i blocchi non validi non vengono salvati
    onChange([...blocks, { id: uid('block'), text: text.trim(), repeats: 1, segmentsM: pv.segments, restSec: null, note: '' }])
    setText('')
  }
  const regenerate = () => {
    const lines = issues.map((i) => `${i.text}: ${i.saved.count} tratti, ${fmtNum(i.saved.totalM, 0)} m → ${i.regenerated.count} tratti, ${fmtNum(i.regenerated.totalM, 0)} m`)
    if (window.confirm(`Rigenerare i tratti dal testo dei blocchi?\n\n${lines.join('\n')}\n\nCambia solo il piano (distanza prevista). La distanza effettivamente nuotata non viene modificata.`)) onChange(regenerateBlocks(blocks, issues))
  }
  return (
    // Non dentro un <label>: un tocco sul testo attiverebbe il primo pulsante (✕ del primo blocco)
    <div role="group" aria-labelledby="blocks-label">
      <span id="blocks-label" className="text-[13px] font-medium text-fg-soft">Blocchi previsti</span>
      <div className="mt-1 space-y-2">
        {blocks.map((b) => {
          const issue = issues.find((i) => i.id === b.id)
          return (
            <div key={b.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${issue ? 'bg-warning-soft' : 'bg-surface-muted'}`} data-testid="swim-block">
              <span className="flex-1 font-mono text-fg">{formatBlock(b)}</span>
              <span className="text-xs text-muted">{expandedSegments(b).length} tratti</span>
              <span className="text-fg-soft">{fmtNum(blockTotal(b), 0)} m</span>
              <button onClick={() => onChange(blocks.filter((x) => x.id !== b.id))} className="text-danger" aria-label={`Rimuovi blocco ${formatBlock(b)}`}>✕</button>
            </div>
          )
        })}
        {issues.length > 0 && (
          <div role="alert" className="space-y-2 rounded-xl border border-warning/60 bg-warning-soft p-3 text-xs text-fg">
            <p>
              {issues.length === 1 ? 'Un blocco salvato ha' : `${issues.length} blocchi salvati hanno`} tratti che non corrispondono al testo (errore di lettura di una versione precedente):
            </p>
            <ul className="list-disc pl-4">
              {issues.map((i) => (
                <li key={i.id}>
                  <span className="font-mono">{i.text}</span>: salvati {i.saved.count} tratti ({fmtNum(i.saved.totalM, 0)} m), dal testo {i.regenerated.count} tratti ({fmtNum(i.regenerated.totalM, 0)} m)
                </li>
              ))}
            </ul>
            <button onClick={regenerate} className="rounded-lg bg-warning px-3 py-1.5 font-semibold text-on-warning">Rigenera i tratti dal testo</button>
          </div>
        )}
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="(100×3)×4" className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 font-mono text-fg" aria-label="Nuovo blocco" aria-invalid={pv?.ok === false} />
          <button onClick={add} disabled={!pv?.ok} className="btn-ghost disabled:opacity-40">Aggiungi</button>
        </div>
        {pv?.ok && (
          <p className="text-xs text-fg-soft" aria-live="polite" data-testid="block-preview">
            Anteprima: {pv.count} {pv.count === 1 ? 'tratto' : 'tratti'} · {fmtNum(pv.totalM, 0)} m
            {pv.count > 1 && pv.count <= 30 && <span className="text-muted"> ({pv.segments.join(' + ')})</span>}
          </p>
        )}
        {pv?.ok === false && <p className="text-xs text-danger" aria-live="polite">{pv.error}</p>}
        {blocks.length > 0 && <p className="text-sm text-fg-soft">Totale previsto: <b className="text-fg">{fmtNum(blocksTotal(blocks), 0)} m</b></p>}
      </div>
      <span className="mt-1 block text-xs text-muted">Es. 500 · (200)×2 · (100×3)×4 · (200+100+2×75)×2. In «4×100» o «100×4» il numero minore di 25 indica le ripetizioni; accanto a un gruppo tra parentesi ogni numero è un numero di ripetizioni. Separatori: x, ×, *.</span>
    </div>
  )
}

function TemplateEditor({ template: t, sessions, onChange }) {
  const set = (patch) => onChange({ ...t, ...patch })
  const updEx = (id, patch) => set({ exercises: t.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  const move = (i, dir) => {
    const list = [...t.exercises]
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    set({ exercises: list })
  }
  const used = sessions.filter((s) => s.templateId === t.id).length

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-surface-muted/60 p-3 text-xs text-fg-soft">
        Revisione {t.revision}
        {t.revisionInUse ? ' — già usata: la prossima modifica crea una nuova revisione.' : '.'} {used} sedute svolte con questa scheda mantengono gli obiettivi del momento.
        {t.history?.length ? ` Revisioni precedenti: ${t.history.map((h) => `${h.revision} (${h.savedAt.slice(0, 10)})`).join(', ')}.` : ''}
      </p>
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <Field label="Etichetta">
          <TextInput value={t.label} onChange={(label) => set({ label })} maxLength={20} />
        </Field>
        <Field label="Nome">
          <TextInput value={t.name} onChange={(name) => set({ name })} />
        </Field>
      </div>
      <Field label="Durata stimata (min)">
        <NumberInput value={t.estimatedMinutes} onChange={(estimatedMinutes) => set({ estimatedMinutes })} />
      </Field>

      <CardioTemplate title="Riscaldamento" items={t.warmup} onChange={(warmup) => set({ warmup })} />

      <Section title="Esercizi">
        <div className="space-y-3">
          {t.exercises.map((ex, i) => (
            <div key={ex.id} className="space-y-3 rounded-xl bg-surface-muted/60 p-3">
              <div className="flex items-center gap-2">
                <span className="w-5 text-sm font-semibold text-muted">{i + 1}</span>
                <input value={ex.name} onChange={(e) => updEx(ex.id, { name: e.target.value })} aria-label="Nome esercizio" className="min-w-0 flex-1 bg-transparent font-semibold text-fg outline-none" />
                <button onClick={() => move(i, -1)} className="px-1 text-muted" aria-label="Sposta su">↑</button>
                <button onClick={() => move(i, 1)} className="px-1 text-muted" aria-label="Sposta giù">↓</button>
                <button onClick={() => confirm(`Eliminare "${ex.name}" dalla scheda?`) && set({ exercises: t.exercises.filter((e) => e.id !== ex.id) })} className="px-1 text-danger" aria-label="Elimina esercizio">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Field label="Gruppo">
                  <TextInput value={ex.group} onChange={(group) => updEx(ex.id, { group })} />
                </Field>
                <Field label="Tipo">
                  <Select value={ex.type} onChange={(type) => updEx(ex.id, { type, durationSec: type === 'time' ? (ex.durationSec ?? 30) : null })} options={[{ value: 'reps', label: 'Ripetizioni' }, { value: 'time', label: 'A tempo' }]} />
                </Field>
                <Field label="Attrezzo">
                  <Select value={ex.equipment} onChange={(equipment) => updEx(ex.id, { equipment, perHand: equipment === 'dumbbell' ? ex.perHand : false, suggestedWeightKg: equipment === 'bodyweight' ? (ex.suggestedWeightKg ?? 0) : ex.suggestedWeightKg })} options={Object.entries(EQUIPMENT).map(([value, label]) => ({ value, label }))} />
                </Field>
                <Field label="Serie">
                  <NumberInput value={ex.sets} onChange={(sets) => updEx(ex.id, { sets: sets == null ? 0 : Math.round(sets) })} step={1} max={20} />
                </Field>
                {ex.type === 'time' ? (
                  <Field label="Secondi">
                    <NumberInput value={ex.durationSec} onChange={(durationSec) => updEx(ex.id, { durationSec })} step={5} />
                  </Field>
                ) : (
                  <>
                    <Field label="Rip. min">
                      <NumberInput value={ex.repMin} onChange={(repMin) => updEx(ex.id, { repMin })} step={1} />
                    </Field>
                    <Field label="Rip. max">
                      <NumberInput value={ex.repMax} onChange={(repMax) => updEx(ex.id, { repMax })} step={1} />
                    </Field>
                    <Field label={ex.perHand ? 'Kg suggeriti / mano' : 'Kg suggeriti'} hint={ex.equipment === 'bodyweight' ? '0 = corpo libero' : 'vuoto = non indicato'}>
                      <NumberInput value={ex.suggestedWeightKg} onChange={(suggestedWeightKg) => updEx(ex.id, { suggestedWeightKg })} />
                    </Field>
                    <Field label="RIR obiettivo">
                      <NumberInput value={ex.targetRir} onChange={(targetRir) => updEx(ex.id, { targetRir })} step={1} max={5} />
                    </Field>
                    <Field label="Incremento kg">
                      <NumberInput value={ex.step} onChange={(step) => updEx(ex.id, { step })} />
                    </Field>
                  </>
                )}
                <Field label="Recupero (s)">
                  <NumberInput value={ex.restSeconds} onChange={(restSeconds) => updEx(ex.id, { restSeconds })} step={15} />
                </Field>
              </div>
              {ex.repMin != null && ex.repMax != null && ex.repMin > ex.repMax && <p className="text-xs text-danger">Le ripetizioni minime superano le massime.</p>}
              {ex.equipment === 'dumbbell' && <Toggle checked={ex.perHand} onChange={(perHand) => updEx(ex.id, { perHand })} label="Carico per mano (volume ×2)" />}
              <Field label="Variante">
                <TextInput value={ex.variant} onChange={(variant) => updEx(ex.id, { variant })} placeholder="es. presa stretta" />
              </Field>
              <Field label="Istruzioni">
                <TextArea value={ex.instructions} onChange={(instructions) => updEx(ex.id, { instructions })} rows={1} placeholder="es. sedile posizione 4" />
              </Field>
            </div>
          ))}
          <button onClick={() => set({ exercises: [...t.exercises, newTemplateExercise()] })} className="btn-ghost w-full text-sm">+ Aggiungi esercizio</button>
        </div>
      </Section>

      <CardioTemplate title="Defaticamento" items={t.cooldown} onChange={(cooldown) => set({ cooldown })} />
      <Field label="Note">
        <TextArea value={t.notes} onChange={(notes) => set({ notes })} />
      </Field>
    </div>
  )
}

function CardioTemplate({ title, items, onChange }) {
  const upd = (id, patch) => onChange(items.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  return (
    <Section title={title}>
      <div className="space-y-2">
        {items.map((c) => (
          <div key={c.id} className="grid grid-cols-[1fr_5rem_5rem_2rem] items-end gap-2">
            <Field label="Attività">
              <TextInput value={c.name} onChange={(name) => upd(c.id, { name })} />
            </Field>
            <Field label="Min">
              <NumberInput value={c.minutes} onChange={(minutes) => upd(c.id, { minutes })} step={0.5} />
            </Field>
            <Field label="km/h">
              <NumberInput value={c.speed} onChange={(speed) => upd(c.id, { speed })} step={0.5} />
            </Field>
            <button onClick={() => onChange(items.filter((x) => x.id !== c.id))} className="pb-2 text-danger" aria-label="Rimuovi attività">✕</button>
          </div>
        ))}
        <button onClick={() => onChange([...items, newCardio()])} className="btn-ghost w-full text-sm">+ Aggiungi attività</button>
      </div>
    </Section>
  )
}
