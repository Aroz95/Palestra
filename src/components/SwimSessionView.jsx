import { Card, Field, Metric, NumberInput, Rating, Section, Select, TextArea, TextInput, Toggle } from './ui'
import { TimesCard, FeedbackCard, EnergyCard, StatusSelect } from './SessionShared'
import { BlocksEditor } from './ProgramsView'
import { swimDistances, fmtPace, blocksTotal } from '../lib/swim'
import { fmtNum, fmtRange } from '../lib/stats'
import { fmtDate, toLocalISO, minutesBetween } from '../lib/dates'
import { DISTANCE_SOURCES, SWIM_STYLES } from '../schema/constants'

const TECHNIQUE = [
  ['catch', 'Presa sull’acqua'],
  ['strokeQuality', 'Qualità della bracciata'],
  ['shoulderFatigue', 'Affaticamento spalle/braccia', '1 = nessuno, 5 = molto'],
  ['breathing', 'Sensazione respiratoria'],
]

export default function SwimSessionView({ session: s, state, onChange, timers, onDelete, onExport }) {
  const set = (patch) => onChange({ ...s, ...patch })
  const d = swimDistances(s)
  const lapsToMeters = (laps) => (laps == null || !s.poolLengthM ? null : laps * s.poolLengthM)

  const setBlocks = (plannedBlocks) => set({ plannedBlocks, plannedDistanceM: plannedBlocks.length ? blocksTotal(plannedBlocks) : s.plannedDistanceM, isFree: plannedBlocks.length === 0 && s.isFree })

  const finish = () => {
    const endedAt = s.endedAt ?? (s.startedAt ? toLocalISO() : null)
    const patch = { status: 'completed', endedAt }
    const computed = minutesBetween(s.startedAt, endedAt)
    if (s.durationSource !== 'manual' && computed > 0) Object.assign(patch, { durationMin: computed, durationSource: 'computed' })
    set(patch)
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <input value={s.title} onChange={(e) => set({ title: e.target.value })} aria-label="Titolo" placeholder="Nuoto" className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-white outline-none" />
          <input type="date" value={s.date} aria-label="Data" onChange={(e) => e.target.value && set({ date: e.target.value })} className="rounded-lg bg-slate-800 px-2 py-1 text-sm text-slate-200 [color-scheme:dark]" />
        </div>
        <p className="text-sm capitalize text-slate-400">{fmtDate(s.date)} · {s.isFree ? 'sessione libera' : 'da programma'}</p>
        <div className="w-40">
          <StatusSelect value={s.status} onChange={(status) => set({ status })} />
        </div>
      </header>

      {s.status !== 'completed' && !s.startedAt && (
        <button onClick={() => set({ startedAt: toLocalISO(), status: 'in_progress' })} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-sky-500 py-4 text-lg font-extrabold text-slate-950">
          ▶ Inizia nuotata (segna l’orario)
        </button>
      )}

      {/* Riepilogo: previsto, effettivo, stimato sempre separati */}
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric label="Previsti" value={d.planned != null ? fmtNum(d.planned, 0) : null} unit="m" hint="programma, non nuotati" />
          {d.measured != null ? (
            <Metric label="Nuotati" value={fmtNum(d.measured, 0)} unit="m" hint={DISTANCE_SOURCES[s.distanceSource]} />
          ) : (
            <Metric label="Nuotati" value={d.estimated ? fmtRange(d.estimated, 0) : null} unit="m" estimate={!!d.estimated} hint={d.estimated ? 'intervallo stimato' : 'non nota'} />
          )}
          <Metric
            label="Vasche"
            value={d.laps ? (d.laps.estimated ? fmtRange(d.laps, 0) : fmtNum(d.laps.value, 1)) : null}
            estimate={d.laps?.estimated}
            hint={`vasca da ${s.poolLengthM} m`}
          />
          <Metric
            label="Passo /100 m"
            value={d.pace ? (d.pace.estimated ? `${fmtPace(d.pace.min)}–${fmtPace(d.pace.max)}` : fmtPace(d.pace.value)) : null}
            estimate={d.pace?.estimated}
            hint={d.pace?.estimated ? 'su distanza stimata' : d.pace ? 'su distanza misurata' : 'serve distanza e durata'}
          />
        </div>
        {d.isPartial && <p className="text-xs text-amber-300">Percorso abbreviato rispetto al previsto.</p>}
        {d.plannedMismatch && <p className="text-xs text-amber-300">La distanza prevista indicata non coincide con la somma dei blocchi ({d.plannedFromBlocks} m).</p>}
      </Card>

      <Section title="Piscina e piano">
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lunghezza vasca (m)">
              <Select
                value={[25, 50].includes(s.poolLengthM) ? String(s.poolLengthM) : 'custom'}
                onChange={(v) => set({ poolLengthM: v === 'custom' ? (s.poolLengthM ?? 33) : Number(v) })}
                options={[{ value: '25', label: '25 m' }, { value: '50', label: '50 m' }, { value: 'custom', label: 'Altra' }]}
              />
            </Field>
            {![25, 50].includes(s.poolLengthM) && (
              <Field label="Metri">
                <NumberInput value={s.poolLengthM} onChange={(poolLengthM) => set({ poolLengthM })} min={1} />
              </Field>
            )}
            <Field label="Stile">
              <Select value={s.style} onChange={(style) => set({ style })} options={SWIM_STYLES.map((x) => ({ value: x, label: x }))} />
            </Field>
          </div>
          <Field label="Obiettivo">
            <TextInput value={s.goal} onChange={(goal) => set({ goal })} placeholder="es. resistenza aerobica, tecnica" />
          </Field>
          <BlocksEditor blocks={s.plannedBlocks} onChange={setBlocks} />
          {!s.plannedBlocks.length && (
            <Field label="Distanza prevista (m, facoltativa)">
              <NumberInput value={s.plannedDistanceM} onChange={(plannedDistanceM) => set({ plannedDistanceM })} step={25} />
            </Field>
          )}
        </Card>
      </Section>

      <Section title="Distanza effettiva">
        <Card className="space-y-3">
          <Field label="Come conosci la distanza?">
            <Select value={s.distanceSource} onChange={(distanceSource) => set({ distanceSource })} options={Object.entries(DISTANCE_SOURCES).map(([value, label]) => ({ value, label }))} />
          </Field>
          {['measured', 'manually_counted'].includes(s.distanceSource) && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Metri nuotati">
                <NumberInput value={s.actualDistanceM} onChange={(actualDistanceM) => set({ actualDistanceM })} step={25} />
              </Field>
              <Field label="oppure vasche">
                <NumberInput
                  value={s.actualDistanceM != null && s.poolLengthM ? s.actualDistanceM / s.poolLengthM : null}
                  onChange={(laps) => set({ actualDistanceM: lapsToMeters(laps) })}
                  step={1}
                />
              </Field>
            </div>
          )}
          {s.distanceSource === 'estimated' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stima minima (m)">
                <NumberInput value={s.estimatedDistanceM?.min ?? null} onChange={(min) => set({ estimatedDistanceM: min == null ? null : { min, max: Math.max(min, s.estimatedDistanceM?.max ?? min) } })} step={50} />
              </Field>
              <Field label="Stima massima (m)">
                <NumberInput value={s.estimatedDistanceM?.max ?? null} onChange={(max) => set({ estimatedDistanceM: max == null ? null : { min: Math.min(max, s.estimatedDistanceM?.min ?? max), max } })} step={50} />
              </Field>
            </div>
          )}
          {s.distanceSource === 'unknown' && <p className="text-xs text-slate-400">Nessuna distanza registrata: i totali non la conteranno.</p>}
          <Toggle checked={s.isPartial} onChange={(isPartial) => set({ isPartial })} label="Percorso abbreviato rispetto al previsto" />
        </Card>
      </Section>

      <Section title="Tecnica (facoltativo, 1–5)">
        <Card className="space-y-3">
          {TECHNIQUE.map(([k, label, hint]) => (
            <Field key={k} label={label} hint={hint}>
              <Rating value={s.technique?.[k] ?? null} onChange={(v) => set({ technique: { ...s.technique, [k]: v } })} />
            </Field>
          ))}
          <Field label="Intensità percepita (RPE 1–10)">
            <Rating value={s.rpe} onChange={(rpe) => set({ rpe })} max={10} />
          </Field>
          <Field label="Note tecniche">
            <TextArea value={s.notes} onChange={(notes) => set({ notes })} placeholder="es. minore forza di trazione nella bracciata" />
          </Field>
        </Card>
      </Section>

      <TimesCard session={s} onChange={onChange} timers={timers} />
      <FeedbackCard session={s} onChange={onChange} swim />
      <EnergyCard session={s} onChange={onChange} measurements={state.measurements} />

      <div className="flex flex-wrap gap-2">
        {s.status !== 'completed' && <button onClick={finish} className="btn flex-1 bg-emerald-500 text-slate-950">Termina nuotata</button>}
        <button onClick={onExport} className="btn-ghost">Esporta JSON</button>
        <button onClick={() => confirm('Eliminare definitivamente questa nuotata?') && onDelete()} className="rounded-xl px-3 py-2 text-sm text-rose-400">Elimina</button>
      </div>
    </div>
  )
}
