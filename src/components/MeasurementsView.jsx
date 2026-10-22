import { useState } from 'react'
import { Card, Empty, Field, NumberInput, Section, Select, TextInput } from './ui'
import LineChart from './LineChart'
import { MEASUREMENT_FIELDS } from '../schema/constants'
import { newMeasurement } from '../schema/factories'
import { combineDateTime, todayISO, timeOf, fmtDateShort } from '../lib/dates'
import { weightSeries } from '../lib/report/aggregate'
import { fmtNum } from '../lib/stats'
import * as A from '../lib/actions'
import { exportMeasurements, fileNames } from '../lib/report'
import { downloadJSON } from '../lib/download'

const SOURCES = { manual: 'Manuale', imported: 'Importata', device: 'Dispositivo' }

export default function MeasurementsView({ state, update }) {
  const [draft, setDraft] = useState(null)
  const list = [...state.measurements].sort((a, b) => b.at.localeCompare(a.at))
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
        <button onClick={startNew} className="btn bg-emerald-500 text-slate-950">+ Registra misura</button>
        {list.length > 0 && <button onClick={() => downloadJSON(fileNames.measurements(), exportMeasurements(state))} className="btn-ghost">Esporta JSON</button>}
      </div>

      {draft && (
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="w-full rounded-xl bg-slate-800 px-3 py-2 text-slate-100 [color-scheme:dark]" />
            </Field>
            <Field label="Ora">
              <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className="w-full rounded-xl bg-slate-800 px-3 py-2 text-slate-100 [color-scheme:dark]" />
            </Field>
          </div>
          <p className="text-xs text-slate-500">Puoi compilare solo alcuni campi: quelli vuoti restano “non misurati”.</p>
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
            <button onClick={save} className="btn flex-1 bg-emerald-500 text-slate-950">Salva</button>
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
                <span className="font-semibold capitalize text-white">
                  {fmtDateShort(m.at.slice(0, 10))} {timeOf(m.at) !== '00:00' ? timeOf(m.at) : ''}
                </span>
                <span className="text-xs text-slate-400">{SOURCES[m.source]}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 text-sm text-slate-300">
                {MEASUREMENT_FIELDS.filter((f) => m[f.key] != null).map((f) => (
                  <span key={f.key}>
                    {f.label}: <b className="text-white">{fmtNum(m[f.key], 1)}</b> {f.unit}
                  </span>
                ))}
              </div>
              {m.notes && <p className="text-xs text-slate-400">{m.notes}</p>}
              <div className="flex gap-3 pt-1 text-xs">
                <button onClick={() => setDraft({ ...m, date: m.at.slice(0, 10), time: timeOf(m.at) })} className="text-slate-300 underline">Modifica</button>
                <button onClick={() => confirm('Eliminare questa misura?') && update((s) => A.removeIn(s, 'measurements', m.id))} className="text-rose-400 underline">Elimina</button>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  )
}
