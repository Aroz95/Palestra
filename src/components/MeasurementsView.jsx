import { useState } from 'react'
import { Card, Empty, Field, NumberInput, Section, Select, TextInput } from './ui'
import LineChart from './LineChart'
import { MEASUREMENT_FIELDS } from '../schema/constants'
import { newMeasurement } from '../schema/factories'
import { combineDateTime, todayISO, timeOf, fmtDateShort, localDate } from '../lib/dates'
import { weightSeries } from '../lib/report/aggregate'
import { fmtNum } from '../lib/stats'
import * as A from '../lib/actions'
import { exportMeasurements, fileNames } from '../lib/report'
import { downloadJSON } from '../lib/download'

const SOURCES = { manual: 'Manuale', imported: 'Importata', device: 'Dispositivo' }

export default function MeasurementsView({ state, update }) {
  const [draft, setDraft] = useState(null)
  const list = [...state.measurements].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const ws = weightSeries(state.measurements)

  const startNew = () => setDraft({ ...newMeasurement(), date: todayISO(), time: new Date().toTimeString().slice(0, 5) })
  const save = () => {
    const { date, time, ...m } = draft
    if (MEASUREMENT_FIELDS.every((f) => m[f.key] == null)) return alert('Inserisci almeno un valore.')
    update((s) => A.upsertIn(s, 'measurements', { ...m, at: combineDateTime(date, time || '00:00') }))
    setDraft(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={startNew} className="btn-primary">+ Registra misura</button>
        {list.length > 0 && <button onClick={() => downloadJSON(fileNames.measurements(), exportMeasurements(state))} className="btn-ghost">Esporta JSON</button>}
      </div>

      {draft && (
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-fg" />
            </Field>
            <Field label="Ora">
              <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-fg" />
            </Field>
          </div>
          <p className="text-xs text-muted">Puoi compilare solo alcuni campi: quelli vuoti restano “non misurati”.</p>
          <div className="grid grid-cols-2 gap-3">
            {MEASUREMENT_FIELDS.map((f) => (
              <Field key={f.key} label={`${f.label} (${f.unit})`} hint={f.hint}>
                <NumberInput value={draft[f.key]} onChange={(v) => setDraft({ ...draft, [f.key]: v })} step={f.step} />
              </Field>
            ))}
          </div>
          <Field label="Fonte">
            <Select value={draft.source} onChange={(source) => setDraft({ ...draft, source })} options={Object.entries(SOURCES).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="Note">
            <TextInput value={draft.notes} onChange={(notes) => setDraft({ ...draft, notes })} />
          </Field>
          <div className="flex gap-2">
            <button onClick={save} className="btn flex-1 bg-primary text-on-primary">Salva</button>
            <button onClick={() => setDraft(null)} className="btn-ghost">Annulla</button>
          </div>
        </Card>
      )}

      {ws.length > 0 && (
        <Section title="Peso">
          <Card>
            <LineChart
              label="Peso corporeo"
              unit="kg"
              series={[
                { name: 'Peso', points: ws.map((p) => ({ date: p.date, value: p.value })) },
                ...(ws.some((p) => p.avg7 != null) ? [{ name: 'Media 7 giorni', dashed: true, points: ws.filter((p) => p.avg7 != null).map((p) => ({ date: p.date, value: p.avg7 })) }] : []),
              ]}
            />
          </Card>
        </Section>
      )}

      <Section title="Storico misure">
        {list.length === 0 && <Empty>Nessuna misura registrata.</Empty>}
        <div className="space-y-2">
          {list.map((m) => (
            <Card key={m.id} className="space-y-1 py-3">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold capitalize text-fg">
                  {fmtDateShort(localDate(m.at))} {timeOf(m.at) !== '00:00' ? timeOf(m.at) : ''}
                </span>
                <span className="text-xs text-muted">{SOURCES[m.source]}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 text-sm text-fg-soft">
                {MEASUREMENT_FIELDS.filter((f) => m[f.key] != null).map((f) => (
                  <span key={f.key}>
                    {f.label}: <b className="text-fg">{fmtNum(m[f.key], 1)}</b> {f.unit}
                  </span>
                ))}
              </div>
              {m.notes && <p className="text-xs text-muted">{m.notes}</p>}
              <div className="flex gap-3 pt-1 text-xs">
                <button onClick={() => setDraft({ ...m, date: localDate(m.at), time: timeOf(m.at) })} className="text-fg-soft underline">Modifica</button>
                <button onClick={() => confirm('Eliminare questa misura?') && update((s) => A.removeIn(s, 'measurements', m.id))} className="text-danger underline">Elimina</button>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  )
}
