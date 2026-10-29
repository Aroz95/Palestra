// Blocchi comuni alle sedute di palestra e nuoto: orari/durata, feedback, energia, stato.
import { useState } from 'react'
import { Card, Field, NumberInput, Rating, Section, Select, TextArea, TextInput, Toggle } from './ui'
import { sessionDuration, DURATION_SOURCES, fmtRange } from '../lib/stats'
import { addDays, combineDateTime, timeOf } from '../lib/dates'
import { estimateEnergy, bodyWeightAt } from '../lib/energy'
import { SESSION_STATUS } from '../schema/constants'
import { activeMs } from '../lib/actions'

export function StatusSelect({ value, onChange }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      aria-label="Stato seduta"
      options={Object.entries(SESSION_STATUS).map(([v, label]) => ({ value: v, label }))}
    />
  )
}

export function TimesCard({ session, onChange, timers }) {
  const d = sessionDuration(session)
  const manual = session.durationSource === 'manual'
  const setTime = (field, hhmm) => {
    const iso = hhmm ? combineDateTime(session.date, hhmm) : null
    const next = { ...session, [field]: iso }
    // Fine prima dell'inizio: si assume il giorno dopo (allenamento oltre la mezzanotte)
    if (next.startedAt && next.endedAt && Date.parse(next.endedAt) < Date.parse(next.startedAt)) {
      next.endedAt = combineDateTime(addDays(session.date, 1), timeOf(next.endedAt))
    }
    // con durata da cronometro o manuale la durata resta quella; gli orari aggiornano solo il confronto
    if (!manual && session.durationSource !== 'stopwatch') {
      const c = sessionDuration({ ...next, durationSource: null })
      if (c.source === 'computed') Object.assign(next, { durationMin: c.min, durationSource: 'computed' })
    }
    onChange(next)
  }
  const swMin = timers ? Math.round(activeMs(session, timers.stopwatchFor(session.id)) / 60000) : 0

  return (
    <Section title="Orari e durata">
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inizio">
            <input type="time" value={timeOf(session.startedAt)} onChange={(e) => setTime('startedAt', e.target.value)} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-fg" aria-label="Ora di inizio" />
          </Field>
          <Field label="Fine">
            <input type="time" value={timeOf(session.endedAt)} onChange={(e) => setTime('endedAt', e.target.value)} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-fg" aria-label="Ora di fine" />
          </Field>
        </div>
        <div className="text-sm text-fg-soft">
          Durata: <b className="text-fg">{d.min != null ? `${d.min} min` : 'non registrata'}</b>
          {d.source && <span className="text-muted"> · {DURATION_SOURCES[d.source]}</span>}
          {d.pausedMin != null && <span className="text-muted"> · pause escluse: {d.pausedMin} min</span>}
        </div>
        <p className="text-xs text-muted">Comprende riscaldamento, esercizi, recuperi e defaticamento (i minuti di cardio non vengono sommati una seconda volta).</p>
        {d.mismatch && d.source === 'stopwatch' && (
          <p className="rounded-xl bg-warning-soft p-2 text-xs text-warning">
            Il cronometro ({d.min} min) supera l’intervallo tra inizio e fine ({d.computed} min): l’orario di inizio è probabilmente successivo all’inizio reale. Puoi correggerlo qui sopra.
          </p>
        )}
        {d.mismatch && d.source === 'manual' && (
          <p className="rounded-xl bg-warning-soft p-2 text-xs text-warning">
            La durata inserita ({d.min} min) è diversa da quella degli orari ({d.computed} min). Entrambi i valori restano salvati.
          </p>
        )}
        <Toggle
          checked={manual}
          label="Correggi la durata a mano"
          onChange={(on) => onChange({ ...session, durationSource: on ? 'manual' : d.computed != null ? 'computed' : session.durationMin != null ? 'stopwatch' : null, durationMin: on ? (session.durationMin ?? d.min) : (d.computed ?? session.durationMin) })}
        />
        {manual && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minuti">
              <NumberInput value={session.durationMin} onChange={(durationMin) => onChange({ ...session, durationMin })} step={1} max={1440} />
            </Field>
            <Field label="Motivo (facoltativo)">
              <TextInput value={session.durationReason} onChange={(durationReason) => onChange({ ...session, durationReason })} placeholder="es. cronometro dimenticato" />
            </Field>
          </div>
        )}
        {swMin > 0 && !manual && d.source !== 'stopwatch' && (
          <button onClick={() => onChange({ ...session, durationMin: swMin, durationSource: 'stopwatch' })} className="btn-ghost text-sm">
            Usa cronometro ({swMin} min)
          </button>
        )}
      </Card>
    </Section>
  )
}

export function FeedbackCard({ session, onChange, swim = false }) {
  const f = session.feedback ?? {}
  const set = (patch) => onChange({ ...session, feedback: { ...f, ...patch } })
  return (
    <Section title="Sensazioni e recupero">
      <Card className="space-y-3">
        <Field label="Fatica percepita (1–10)">
          <Rating value={f.fatigue} onChange={(fatigue) => set({ fatigue })} max={10} />
        </Field>
        <Field label="Energia (1–5)">
          <Rating value={f.energy} onChange={(energy) => set({ energy })} />
        </Field>
        {!swim && (
          <Field label="Qualità tecnica (1–5)">
            <Rating value={f.technique} onChange={(technique) => set({ technique })} />
          </Field>
        )}
        <Field label="Dolore / fastidio (facoltativo)">
          <TextInput value={f.pain} onChange={(pain) => set({ pain })} placeholder="Zona e descrizione" />
        </Field>
        <Field label="Recupero il giorno dopo (1–5)" hint="Da compilare il giorno successivo">
          <Rating value={f.nextDayRecovery} onChange={(nextDayRecovery) => set({ nextDayRecovery })} />
        </Field>
        <Field label="Note">
          <TextArea value={session.note} onChange={(note) => onChange({ ...session, note })} placeholder="Note sulla seduta" />
        </Field>
      </Card>
    </Section>
  )
}

export function EnergyCard({ session, onChange, measurements }) {
  const [device, setDevice] = useState(session.energy?.source === 'device')
  const e = session.energy
  const d = sessionDuration(session)
  const bw = bodyWeightAt(measurements, session.date)
  const canEstimate = bw && d.min
  return (
    <Section title="Calorie (facoltativo)">
      <Card className="space-y-3">
        {e ? (
          <div className="space-y-1 text-sm">
            <div className="text-fg">
              Attive: <b className="text-fg">{fmtRange(e.activeKcal, 0, 'kcal')}</b> · Totali: <b className="text-fg">{fmtRange(e.totalKcal, 0, 'kcal')}</b>
            </div>
            <div className="text-xs text-muted">
              {e.source === 'estimate' ? `Stima — ${e.method}, peso ${e.bodyWeightKg} kg, ${e.durationMin} min` : 'Da dispositivo/inserite a mano'}
            </div>
            <button onClick={() => onChange({ ...session, energy: null })} className="text-xs text-danger underline">Rimuovi</button>
          </div>
        ) : (
          <p className="text-sm text-muted">Nessun dato. Le calorie non vengono mai calcolate in automatico.</p>
        )}
        <p className="text-xs text-muted">
          Attive = solo dovute all’allenamento; totali = incluse quelle a riposo. Errore realistico ±20–30%.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={!canEstimate}
            onClick={() => onChange({ ...session, energy: estimateEnergy(session, bw.weightKg, d.min) })}
            className="btn-ghost text-sm disabled:opacity-40"
          >
            Stima intervallo
          </button>
          <button onClick={() => setDevice((v) => !v)} className="btn-ghost text-sm">Inserisci da orologio</button>
        </div>
        {!canEstimate && (
          <p className="text-xs text-muted">
            Per stimare servono {!bw ? 'una misura del peso (Altro → Misure)' : ''}
            {!bw && !d.min ? ' e ' : ''}
            {!d.min ? 'la durata della seduta' : ''}.
          </p>
        )}
        {device && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kcal attive">
              <NumberInput
                value={e?.source !== 'estimate' ? (e?.activeKcal?.min ?? null) : null}
                onChange={(v) => onChange({ ...session, energy: { ...(e?.source !== 'estimate' ? e : {}), source: 'device', method: 'dispositivo', activeKcal: v == null ? null : { min: v, max: v }, totalKcal: e?.source !== 'estimate' ? (e?.totalKcal ?? null) : null } })}
              />
            </Field>
            <Field label="Kcal totali">
              <NumberInput
                value={e?.source !== 'estimate' ? (e?.totalKcal?.min ?? null) : null}
                onChange={(v) => onChange({ ...session, energy: { ...(e?.source !== 'estimate' ? e : {}), source: 'device', method: 'dispositivo', totalKcal: v == null ? null : { min: v, max: v }, activeKcal: e?.source !== 'estimate' ? (e?.activeKcal ?? null) : null } })}
              />
            </Field>
          </div>
        )}
      </Card>
    </Section>
  )
}
