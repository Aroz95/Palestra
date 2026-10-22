import { useEffect, useState } from 'react'
import { Card, Chip, Field, NumberInput, Section, Segmented, Select, TextArea, TextInput, Toggle } from './ui'
import MeasurementsView from './MeasurementsView'
import ImportView from './ImportView'
import Stepper from './Stepper'
import { newGoal } from '../schema/factories'
import { toLocalISO } from '../lib/dates'
import * as A from '../lib/actions'
import { exportBackup, exportProgram, exportDietPlan, exportMeasurements, fileNames } from '../lib/report'
import { downloadJSON } from '../lib/download'
import { getLegacySnapshot } from '../lib/persist'

export const MORE_TABS = [
  { id: 'profile', label: 'Profilo' },
  { id: 'measures', label: 'Misure' },
  { id: 'import', label: 'Importa' },
  { id: 'export', label: 'Esporta' },
  { id: 'settings', label: 'Opzioni' },
]

export default function MoreView({ state, update, sub, setSub, status, importProps, onReset }) {
  return (
    <div className="space-y-4">
      <Segmented options={MORE_TABS} value={sub} onChange={setSub} />
      {sub === 'profile' && <ProfileView state={state} update={update} />}
      {sub === 'measures' && <MeasurementsView state={state} update={update} />}
      {sub === 'import' && <ImportView state={state} {...importProps} />}
      {sub === 'export' && <ExportView state={state} />}
      {sub === 'settings' && <SettingsView state={state} update={update} status={status} onReset={onReset} />}
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
        <p className="text-xs text-slate-500">
          Tutti i campi sono facoltativi e restano su questo dispositivo. {p.updatedAt ? `Aggiornato il ${p.updatedAt.slice(0, 10)}.` : ''}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Altezza (cm)">
            <NumberInput value={p.heightCm} onChange={(heightCm) => set({ heightCm })} />
          </Field>
          <Field label="Data di nascita">
            <input type="date" value={p.birthDate ?? ''} onChange={(e) => set({ birthDate: e.target.value || null })} className="w-full rounded-xl bg-slate-800 px-3 py-2 text-slate-100 [color-scheme:dark]" />
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

      <Section title="Obiettivi" right={<button onClick={() => setGoal(newGoal({ label: 'Nuovo obiettivo' }))} className="text-sm text-emerald-400">+ Obiettivo</button>}>
        <div className="space-y-2">
          {state.goals.length === 0 && <p className="px-1 text-sm text-slate-500">Nessun obiettivo.</p>}
          {state.goals.map((g) => (
            <GoalCard key={g.id} goal={g} onChange={setGoal} onRemove={() => confirm('Eliminare questo obiettivo?') && update((s) => A.removeIn(s, 'goals', g.id))} />
          ))}
        </div>
      </Section>
    </div>
  )
}

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
      <div className="grid grid-cols-3 gap-2">
        <Field label="Valore">
          <NumberInput value={g.targetValue} onChange={(targetValue) => set({ targetValue })} min={-1e9} />
        </Field>
        <Field label="Unità">
          <TextInput value={g.unit} onChange={(unit) => onChange({ ...g, unit })} placeholder="kg, m…" />
        </Field>
        <Field label="Entro il">
          <input type="date" value={g.targetDate ?? ''} onChange={(e) => set({ targetDate: e.target.value || null })} className="w-full rounded-xl bg-slate-800 px-2 py-2 text-sm text-slate-100 [color-scheme:dark]" />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select value={g.status} onChange={(status) => set({ status })} options={Object.entries(GOAL_STATUS).map(([value, label]) => ({ value, label }))} />
        </div>
        <button onClick={onRemove} className="text-sm text-rose-400">Elimina</button>
      </div>
      {g.history.length > 0 && <p className="text-[11px] text-slate-500">{g.history.length} modifiche registrate (ultima {g.history[g.history.length - 1].at.slice(0, 10)})</p>}
    </Card>
  )
}

function ExportView({ state }) {
  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <div className="font-semibold text-white">Backup completo</div>
        <p className="text-sm text-slate-400">Tutti i dati, ripristinabili con “Importa”. È l’unico modo per spostare i dati su un altro dispositivo.</p>
        <button onClick={() => downloadJSON(fileNames.backup(), exportBackup(state))} className="btn bg-emerald-500 text-slate-950">Scarica backup</button>
      </Card>
      <Card className="space-y-2">
        <div className="font-semibold text-white">Programmi (schede A/B)</div>
        {state.programs.length === 0 && <p className="text-sm text-slate-500">Nessun programma.</p>}
        {state.programs.map((p) => (
          <button key={p.id} onClick={() => downloadJSON(fileNames.program(p), exportProgram(state, p.id))} className="btn-ghost mr-2 text-sm">{p.name}</button>
        ))}
      </Card>
      <Card className="space-y-2">
        <div className="font-semibold text-white">Piani alimentari</div>
        {state.dietPlans.length === 0 && <p className="text-sm text-slate-500">Nessun piano.</p>}
        {state.dietPlans.map((d) => (
          <button key={d.id} onClick={() => downloadJSON(fileNames.diet(d), exportDietPlan(d))} className="btn-ghost mr-2 text-sm">{d.name}</button>
        ))}
      </Card>
      <Card className="space-y-2">
        <div className="font-semibold text-white">Misure corporee</div>
        <button disabled={!state.measurements.length} onClick={() => downloadJSON(fileNames.measurements(), exportMeasurements(state))} className="btn-ghost text-sm disabled:opacity-40">
          Scarica {state.measurements.length} misure
        </button>
      </Card>
      <p className="px-1 text-xs text-slate-500">Le singole sedute si esportano dallo storico; i report per periodo da Progressi.</p>
    </div>
  )
}

function SettingsView({ state, update, status, onReset }) {
  const s = state.settings
  const set = (patch) => update((st) => ({ ...st, settings: { ...st.settings, ...patch } }))
  const [quota, setQuota] = useState(null)
  const [persisted, setPersisted] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  useEffect(() => {
    navigator.storage?.estimate?.().then(setQuota).catch(() => {})
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {})
    getLegacySnapshot().then(setSnapshot)
  }, [])
  const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`

  return (
    <div className="space-y-4">
      <Section title="Timer">
        <Card className="space-y-4">
          <Stepper label="Recupero evidenziato nella barra (s)" value={s.restSeconds} step={15} min={15} onChange={(restSeconds) => set({ restSeconds: Math.round(restSeconds) })} />
          <p className="text-xs text-slate-400">Il recupero dopo ogni serie si imposta per esercizio nella scheda.</p>
          <Toggle checked={s.autoRest} onChange={(autoRest) => set({ autoRest })} label="Avvia il recupero quando segno una serie come fatta" />
          <Toggle checked={s.sound} onChange={(sound) => set({ sound })} label="Suono a fine recupero" />
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
          {status.warning && <p className="text-xs text-amber-300">{status.warning}</p>}
          <p className="text-slate-400">
            I dati (allenamenti, misure, alimentazione) restano solo in questo browser: nessun account, nessun server, nessun invio a terzi. Cancellando i dati del sito o cambiando dispositivo si perdono: scarica un backup regolarmente.
          </p>
          {persisted === false && navigator.storage?.persist && (
            <button onClick={() => navigator.storage.persist().then(setPersisted)} className="btn-ghost text-sm">Chiedi archiviazione persistente</button>
          )}
          {snapshot && (
            <div className="rounded-xl bg-slate-800/60 p-3 text-xs text-slate-300">
              Copia dei dati della versione precedente (salvata il {snapshot.savedAt.slice(0, 10)} prima dell’aggiornamento).
              <button onClick={() => downloadJSON(`palestra-dati-versione-precedente-${snapshot.savedAt.slice(0, 10)}.json`, snapshot.data)} className="ml-2 underline">Scarica</button>
            </div>
          )}
          <Toggle checked={s.reportExcludeNotes} onChange={(reportExcludeNotes) => set({ reportExcludeNotes })} label="Escludi le note dai report condivisi (predefinito)" />
          <button
            onClick={() => confirm('Cancellare programmi, sedute, misure, piani e profilo? L’operazione non si può annullare: scarica prima un backup.') && confirm('Conferma definitiva: cancellare tutti i dati?') && onReset()}
            className="rounded-xl px-3 py-2 text-sm text-rose-400 active:bg-rose-950"
          >
            Cancella tutti i dati
          </button>
        </Card>
      </Section>
    </div>
  )
}
