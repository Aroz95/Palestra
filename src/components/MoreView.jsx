import { useEffect, useState } from 'react'
import { Card, Chip, Field, NumberInput, Section, Segmented, Select, TextArea, TextInput, Toggle } from './ui'
import MeasurementsView from './MeasurementsView'
import ImportView from './ImportView'
import Stepper from './Stepper'
import { newGoal } from '../schema/factories'
import { fmtDate, toLocalISO } from '../lib/dates'

const DAY = { day: 'numeric', month: 'short', year: 'numeric' }
import * as A from '../lib/actions'
import { THEMES } from '../lib/theme'
import { exportBackup, exportProgram, exportDietPlan, exportMeasurements, fileNames } from '../lib/report'
import { downloadJSON } from '../lib/download'
import { getLegacySnapshot, getSnapshot } from '../lib/persist'

export const MORE_TABS = [
  { id: 'profile', label: 'Profilo', hint: 'Dati personali e obiettivi', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0' },
  { id: 'measures', label: 'Misure', hint: 'Peso e circonferenze nel tempo', icon: 'M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4' },
  { id: 'import', label: 'Importa', hint: 'Programmi, piani alimentari, backup', icon: 'M12 3v12M7 10l5 5 5-5M4 21h16' },
  { id: 'export', label: 'Esporta', hint: 'Backup completo e singoli file', icon: 'M12 15V3M7 8l5-5 5 5M4 21h16' },
  { id: 'settings', label: 'Opzioni', hint: 'Tema, timer, dati e privacy', icon: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0M6 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0' },
]

export default function MoreView({ state, update, sub, setSub, status, importProps, onReset, theme, setTheme, pinchLock, setPinchLock }) {
  const current = MORE_TABS.find((t) => t.id === sub)
  // Elenco delle sezioni: ogni voce apre la propria pagina (niente barra di schede che scorre di lato)
  if (!current) {
    return (
      <div className="space-y-4">
        <h1 className="text-[28px] font-bold leading-tight text-fg lg:text-[32px]">Altro</h1>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {MORE_TABS.map((t) => (
            <li key={t.id}>
              <button onClick={() => setSub(t.id)} aria-label={t.label} aria-describedby={`more-${t.id}`} className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-muted">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={t.icon} />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-fg">{t.label}</span>
                  <span id={`more-${t.id}`} className="block text-sm text-muted">{t.hint}</span>
                </span>
                <span className="shrink-0 text-muted" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <header>
        <button onClick={() => setSub(null)} className="link-btn -ml-2" aria-label="Torna ad Altro">
          ‹ Altro
        </button>
        <h1 className="text-[28px] font-bold leading-tight text-fg lg:text-[32px]">{current.label}</h1>
      </header>
      {sub === 'profile' && <ProfileView state={state} update={update} />}
      {sub === 'measures' && <MeasurementsView state={state} update={update} />}
      {sub === 'import' && <ImportView state={state} {...importProps} />}
      {sub === 'export' && <ExportView state={state} />}
      {sub === 'settings' && <SettingsView state={state} update={update} status={status} onReset={onReset} theme={theme} setTheme={setTheme} pinchLock={pinchLock} setPinchLock={setPinchLock} />}
    </div>
  )
}

function ProfileView({ state, update }) {
  const p = state.profile
  const set = (patch) => update((s) => ({ ...s, profile: { ...s.profile, ...patch, updatedAt: toLocalISO() } }))
  const setGoal = (g) => update((s) => A.upsertIn(s, 'goals', g))
  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="text-xs text-muted">
          Tutti i campi sono facoltativi e restano su questo dispositivo. {p.updatedAt ? `Aggiornato il ${fmtDate(p.updatedAt.slice(0, 10), DAY)}.` : ''}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Altezza (cm)">
            <NumberInput value={p.heightCm} onChange={(heightCm) => set({ heightCm })} />
          </Field>
          <Field label="Data di nascita">
            <input type="date" value={p.birthDate ?? ''} onChange={(e) => set({ birthDate: e.target.value || null })} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-fg" />
          </Field>
          <Field label="oppure età">
            <NumberInput value={p.age} onChange={(age) => set({ age })} step={1} />
          </Field>
          <Field label="Sesso" hint="Usato solo da formule che lo richiedono">
            <Select value={p.sex ?? ''} onChange={(sex) => set({ sex: sex || null })} options={[{ value: '', label: 'Non indicato' }, { value: 'male', label: 'Maschile' }, { value: 'female', label: 'Femminile' }]} />
          </Field>
          <Field label="Peso di riferimento (kg)" hint="Solo un riferimento: nessuna notifica o promessa">
            <NumberInput value={p.referenceWeightKg} onChange={(referenceWeightKg) => set({ referenceWeightKg })} />
          </Field>
        </div>
        <Field label="Obiettivo generale">
          <TextArea value={p.goal} onChange={(goal) => set({ goal })} />
        </Field>
        <Field label="Disponibilità settimanale">
          <TextInput value={p.weeklyAvailability} onChange={(weeklyAvailability) => set({ weeklyAvailability })} placeholder="es. lun–ven, 75 min" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Obiettivo pesi">
            <TextInput value={p.strengthGoal} onChange={(strengthGoal) => set({ strengthGoal })} />
          </Field>
          <Field label="Obiettivo nuoto">
            <TextInput value={p.swimGoal} onChange={(swimGoal) => set({ swimGoal })} />
          </Field>
        </div>
        <Field label="Limitazioni fisiche (facoltativo, esclusa dai report condivisi)">
          <TextArea value={p.limitations} onChange={(limitations) => set({ limitations })} />
        </Field>
      </Card>

      <Section title="Obiettivi" right={<button onClick={() => setGoal(newGoal({ label: 'Nuovo obiettivo' }))} className="link-btn">+ Obiettivo</button>}>
        <div className="space-y-2">
          {state.goals.length === 0 && <p className="px-1 text-sm text-muted">Nessun obiettivo.</p>}
          {state.goals.map((g) => (
            <GoalCard key={g.id} goal={g} onChange={setGoal} onRemove={() => confirm('Eliminare questo obiettivo?') && update((s) => A.removeIn(s, 'goals', g.id))} />
          ))}
        </div>
      </Section>
    </div>
  )
}

const SNAPSHOT_LABELS = { import: 'Prima dell’ultima importazione', 'undo-import': 'Prima dell’ultimo annullamento', reset: 'Prima della cancellazione dei dati' }

const GOAL_STATUS = { active: 'Attivo', achieved: 'Raggiunto', paused: 'In pausa', abandoned: 'Abbandonato' }

function GoalCard({ goal: g, onChange, onRemove }) {
  // Ogni modifica di valore, data o stato viene registrata nello storico dell'obiettivo
  const set = (patch) => {
    const tracked = ['targetValue', 'targetDate', 'status'].some((k) => k in patch && patch[k] !== g[k])
    onChange({ ...g, ...patch, history: tracked ? [...g.history, { at: toLocalISO(), targetValue: g.targetValue, targetDate: g.targetDate, status: g.status }] : g.history })
  }
  return (
    <Card className="space-y-2">
      <TextInput value={g.label} onChange={(label) => onChange({ ...g, label })} aria-label="Obiettivo" />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Valore">
          <NumberInput value={g.targetValue} onChange={(targetValue) => set({ targetValue })} min={-1e9} />
        </Field>
        <Field label="Unità">
          <TextInput value={g.unit} onChange={(unit) => onChange({ ...g, unit })} placeholder="kg, m…" />
        </Field>
        <Field label="Entro il" className="col-span-2">
          <input type="date" value={g.targetDate ?? ''} onChange={(e) => set({ targetDate: e.target.value || null })} className="w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 py-2 text-fg" />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select value={g.status} onChange={(status) => set({ status })} options={Object.entries(GOAL_STATUS).map(([value, label]) => ({ value, label }))} />
        </div>
        <button onClick={onRemove} className="link-btn link-btn-danger">Elimina</button>
      </div>
      {g.history.length > 0 && <p className="text-[11px] text-muted">{g.history.length} modifiche registrate (ultima {fmtDate(g.history[g.history.length - 1].at.slice(0, 10), DAY)})</p>}
    </Card>
  )
}

function ExportView({ state }) {
  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <div className="font-semibold text-fg">Backup completo</div>
        <p className="text-sm text-muted">Tutti i dati, ripristinabili con “Importa”. È l’unico modo per spostare i dati su un altro dispositivo.</p>
        <button onClick={() => downloadJSON(fileNames.backup(), exportBackup(state))} className="btn-primary w-full">Scarica backup</button>
      </Card>
      <Card className="space-y-2">
        <div className="font-semibold text-fg">Programmi (schede A/B)</div>
        {state.programs.length === 0 && <p className="text-sm text-muted">Nessun programma.</p>}
        {state.programs.map((p) => (
          <button key={p.id} onClick={() => downloadJSON(fileNames.program(p), exportProgram(state, p.id))} className="btn-ghost w-full justify-between text-left text-sm">
            <span className="min-w-0">{p.name}</span>
            <span className="shrink-0 text-muted" aria-hidden="true">↓</span>
          </button>
        ))}
      </Card>
      <Card className="space-y-2">
        <div className="font-semibold text-fg">Piani alimentari</div>
        {state.dietPlans.length === 0 && <p className="text-sm text-muted">Nessun piano.</p>}
        {state.dietPlans.map((d) => (
          <button key={d.id} onClick={() => downloadJSON(fileNames.diet(d), exportDietPlan(d))} className="btn-ghost w-full justify-between text-left text-sm">
            <span className="min-w-0">{d.name}</span>
            <span className="shrink-0 text-muted" aria-hidden="true">↓</span>
          </button>
        ))}
      </Card>
      <Card className="space-y-2">
        <div className="font-semibold text-fg">Misure corporee</div>
        <button disabled={!state.measurements.length} onClick={() => downloadJSON(fileNames.measurements(), exportMeasurements(state))} className="btn-ghost w-full text-sm disabled:opacity-40">
          Scarica {state.measurements.length} misure
        </button>
      </Card>
      <p className="px-1 text-xs text-muted">Le singole sedute si esportano dallo storico; i report per periodo da Progressi.</p>
    </div>
  )
}

function SettingsView({ state, update, status, onReset, theme, setTheme, pinchLock, setPinchLock }) {
  const s = state.settings
  const set = (patch) => update((st) => ({ ...st, settings: { ...st.settings, ...patch } }))
  const [quota, setQuota] = useState(null)
  const [persisted, setPersisted] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [copies, setCopies] = useState([])
  useEffect(() => {
    navigator.storage?.estimate?.().then(setQuota).catch(() => {})
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {})
    getLegacySnapshot().then(setSnapshot)
    Promise.all(Object.keys(SNAPSHOT_LABELS).map((k) => getSnapshot(k).then((v) => v && { kind: k, ...v }))).then((l) => setCopies(l.filter(Boolean)))
  }, [status.savedAt])
  const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`

  return (
    <div className="space-y-4">
      <Section title="Aspetto">
        <Card className="space-y-2">
          <div className="text-[13px] font-medium text-fg-soft" id="theme-label">Tema</div>
          <Segmented options={THEMES} value={theme} onChange={setTheme} aria-labelledby="theme-label" />
          <p className="text-xs text-muted">“Automatico” segue l’impostazione chiaro/scuro del dispositivo. Le animazioni si riducono se il dispositivo lo richiede.</p>
          <Toggle checked={pinchLock} onChange={setPinchLock} label="Blocca lo zoom con due dita" />
          <p className="text-xs text-muted">Evita che la pagina si ingrandisca o si sposti durante l’allenamento. Disattivalo se usi lo zoom della pagina per leggere meglio; lo Zoom di accessibilità di iOS e la dimensione del testo di Safari funzionano comunque.</p>
        </Card>
      </Section>

      <Section title="Timer">
        <Card className="space-y-4">
          <Stepper label="Recupero evidenziato nella barra (s)" value={s.restSeconds} step={15} min={15} onChange={(restSeconds) => set({ restSeconds: Math.round(restSeconds) })} />
          <p className="text-xs text-muted">Il recupero dopo ogni serie si imposta per esercizio nella scheda.</p>
          <Toggle checked={s.autoRest} onChange={(autoRest) => set({ autoRest })} label="Avvia il recupero quando segno una serie come fatta" />
          <Toggle checked={s.sound} onChange={(sound) => set({ sound })} label="Suono a fine recupero" />
        </Card>
      </Section>

      <Section title="Crediti">
        <Card className="space-y-1 text-sm text-fg-soft">
          <p>
            Illustrazioni degli esercizi:{' '}
            <a href="https://github.com/everkinetic/data" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
              Everkinetic
            </a>{' '}
            (Greg Priday), licenza{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.it" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
              CC BY-SA 4.0
            </a>
            , ridimensionate e convertite (un fotogramma per esercizio).
          </p>
        </Card>
      </Section>

      <Section title="Dati e privacy">
        <Card className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-1">
            <Chip>Archivio: {status.backend === 'indexeddb' ? 'IndexedDB (locale)' : 'localStorage (ripiego)'}</Chip>
            {quota?.quota ? <Chip>Usati {mb(quota.usage)} di {mb(quota.quota)}</Chip> : null}
            {persisted != null && <Chip>{persisted ? 'Archiviazione persistente' : 'Archiviazione non garantita'}</Chip>}
            {status.savedAt && <Chip>Ultimo salvataggio {status.savedAt.slice(11, 19)}</Chip>}
          </div>
          {status.warning && <p className="text-xs text-warning">{status.warning}</p>}
          <p className="text-muted">
            I dati (allenamenti, misure, alimentazione) restano solo in questo browser: nessun account, nessun server, nessun invio a terzi. Cancellando i dati del sito o cambiando dispositivo si perdono: scarica un backup regolarmente.
          </p>
          {persisted === false && navigator.storage?.persist && (
            <button onClick={() => navigator.storage.persist().then(setPersisted)} className="btn-ghost text-sm">Chiedi archiviazione persistente</button>
          )}
          {snapshot && (
            <div className="rounded-xl bg-surface-muted/60 p-3 text-sm text-fg-soft">
              <p>Copia dei dati della versione precedente (salvata il {fmtDate(snapshot.savedAt.slice(0, 10), DAY)} prima dell’aggiornamento).</p>
              <button onClick={() => downloadJSON(`palestra-dati-versione-precedente-${snapshot.savedAt.slice(0, 10)}.json`, snapshot.data)} className="link-btn -ml-2">Scarica</button>
            </div>
          )}
          {copies.length > 0 && (
            <div className="rounded-xl bg-surface-muted/60 p-3 text-sm text-fg-soft">
              <div className="font-semibold text-fg">Copie di sicurezza automatiche</div>
              <ul className="divide-y divide-line">
                {copies.map((c) => (
                  <li key={c.kind} className="flex items-center gap-2 py-1">
                    <span className="min-w-0 flex-1">
                      <span className="block text-fg">{SNAPSHOT_LABELS[c.kind]}</span>
                      <span className="block text-xs text-muted">
                        {fmtDate(c.savedAt.slice(0, 10), DAY)}, {c.savedAt.slice(11, 16)}
                        {c.label ? ` · ${c.label}` : ''}
                      </span>
                    </span>
                    <button onClick={() => downloadJSON(`palestra-copia-${c.kind}-${c.savedAt.slice(0, 10)}.json`, exportBackup(c.state))} className="link-btn shrink-0" aria-label={`Scarica la copia: ${SNAPSHOT_LABELS[c.kind]}`}>
                      Scarica
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">Ogni copia è un backup completo reimportabile con “Importa”.</p>
            </div>
          )}
          <Toggle checked={s.reportExcludeNotes} onChange={(reportExcludeNotes) => set({ reportExcludeNotes })} label="Escludi le note dai report condivisi (predefinito)" />
          <button
            onClick={async () => {
              if (!confirm('Cancellare programmi, sedute, misure, piani e profilo? Scarica prima un backup.') || !confirm('Conferma definitiva: cancellare tutti i dati?')) return
              try {
                await onReset()
              } catch (e) {
                alert(`Cancellazione non eseguita: ${e.message}`)
              }
            }}
            className="link-btn link-btn-danger -ml-2"
          >
            Cancella tutti i dati
          </button>
        </Card>
      </Section>
    </div>
  )
}
