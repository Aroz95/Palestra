import { useMemo, useState } from 'react'
import { Card, Chip, Metric, Section, Segmented, Toggle } from './ui'
import { DayTable } from './diet/NutritionView'
import { MAIN_KEYS } from '../lib/diet'
import LineChart from './LineChart'
import { PERIODS, periodRange, previousPeriod, todayISO } from '../lib/dates'
import { aggregateAll, weightSeries, measurementSeries } from '../lib/report/aggregate'
import { comparableKey, exerciseHistory, fmtNum, fmtRange } from '../lib/stats'
import { buildReport, reportToCSV, REPORT_SECTIONS, CSV_DIALECTS, fileNames } from '../lib/report'
import { downloadBlob, downloadCSV, downloadJSON } from '../lib/download'
import { WEEKDAYS_SHORT } from '../lib/dates'

function Delta({ cur, prev, digits = 0, unit = '' }) {
  if (cur == null || prev == null) return null
  const d = cur - prev
  if (!d) return <span className="text-[11px] text-slate-500">= periodo prec.</span>
  return (
    <span className="text-[11px] text-slate-400">
      {d > 0 ? '+' : ''}
      {fmtNum(d, digits)}
      {unit} vs periodo prec.
    </span>
  )
}

export default function ProgressView({ state, settings }) {
  const [kind, setKind] = useState('30d')
  const [custom, setCustom] = useState({ from: '', to: todayISO() })
  const [compare, setCompare] = useState(true)
  const period = periodRange(kind, todayISO(), custom)
  const prevPeriod = previousPeriod(period)
  const a = useMemo(() => aggregateAll(state, period), [state, period.from, period.to])
  const p = useMemo(() => (compare ? aggregateAll(state, prevPeriod) : null), [state, compare, prevPeriod.from, prevPeriod.to])

  return (
    <div className="space-y-5">
      <Segmented options={PERIODS} value={kind} onChange={setKind} />
      {kind === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="Dal" className="rounded-xl bg-slate-800 px-2 py-1.5 text-sm text-slate-100 [color-scheme:dark]" />
          <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="Al" className="rounded-xl bg-slate-800 px-2 py-1.5 text-sm text-slate-100 [color-scheme:dark]" />
        </div>
      )}
      <div className="flex items-center justify-between px-1 text-xs text-slate-400">
        <span>
          {period.from} → {period.to}
        </span>
        <span className="w-48">
          <Toggle checked={compare} onChange={setCompare} label="Confronta" />
        </span>
      </div>

      <TrainingWidget a={a} p={p} />
      <StrengthWidget a={a} p={p} state={state} />
      <SwimWidget a={a} p={p} />
      <BodyWidget a={a} state={state} period={period} />
      <DietWidget a={a} />
      <EnergyWidget a={a} />
      <ReportExport state={state} period={period} settings={settings} />
    </div>
  )
}

function TrainingWidget({ a, p }) {
  const t = a.training
  return (
    <Section title="Frequenza">
      <Card className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div>
          <Metric label="Sedute palestra" value={t.strengthSessions} />
          {p && <Delta cur={t.strengthSessions} prev={p.training.strengthSessions} />}
        </div>
        <div>
          <Metric label="Sedute nuoto" value={t.swimSessions} />
          {p && <Delta cur={t.swimSessions} prev={p.training.swimSessions} />}
        </div>
        <Metric label="Giorni allenati" value={t.daysTrained} />
        <Metric label="Minuti palestra" value={t.strengthMinutes.value} unit="min" hint={t.strengthMinutes.missing ? `${t.strengthMinutes.missing} sedute senza durata` : null} />
        <Metric label="Minuti nuoto" value={t.swimMinutes.value} unit="min" hint={t.swimMinutes.missing ? `${t.swimMinutes.missing} sedute senza durata` : null} />
        <Metric
          label="Aderenza calendario"
          value={t.adherence.ratio != null ? `${Math.round(t.adherence.ratio * 100)}%` : null}
          hint={t.adherence.planned ? `${t.adherence.completed}/${t.adherence.planned} attività previste` : 'nessuna attività prevista'}
        />
      </Card>
    </Section>
  )
}

function StrengthWidget({ a, p, state }) {
  const s = a.strength
  const keys = useMemo(() => {
    const m = new Map()
    for (const ses of state.sessions.filter((x) => x.kind === 'strength')) {
      for (const ex of ses.exercises) if (ex.type !== 'time' && ex.sets.some((st) => st.done)) m.set(comparableKey(ex), ex.name)
    }
    return [...m.entries()]
  }, [state.sessions])
  const [picked, setKey] = useState('')
  const key = keys.some(([k]) => k === picked) ? picked : (keys[0]?.[0] ?? '')
  const hist = key ? exerciseHistory(state.sessions, key) : []
  return (
    <Section title="Sala pesi">
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <Metric label="Serie completate" value={s.sets} />
            {p && <Delta cur={s.sets} prev={p.strength.sets} />}
          </div>
          <Metric label="Ripetizioni" value={s.reps} />
          <div>
            <Metric label="Volume nominale" value={fmtNum(s.volumeKg, 0)} unit="kg" hint={s.volumePartial ? 'parziale: carichi mancanti' : 'indicativo'} />
            {p && <Delta cur={s.volumeKg} prev={p.strength.volumeKg} unit=" kg" />}
          </div>
          <Metric label="RIR medio" value={s.avgRir != null ? fmtNum(s.avgRir, 1) : null} hint={s.rirSamples ? `${s.rirSamples} serie con RIR` : 'non registrato'} />
        </div>
        {s.newRecords.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Nuovi record (stesso esercizio)</div>
            <div className="flex flex-wrap gap-1">
              {s.newRecords.map((r) => (
                <Chip key={r.key} className="bg-emerald-500/20 text-emerald-200">
                  {r.name}: {fmtNum(r.weight, 1)} kg × {r.reps} ({r.date}) — prima {fmtNum(r.prevBest.weight, 1)} kg
                </Chip>
              ))}
            </div>
          </div>
        )}
        {keys.length > 0 && (
          <div className="space-y-2">
            <select value={key} onChange={(e) => setKey(e.target.value)} aria-label="Esercizio" className="w-full rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-100">
              {keys.map(([k, name]) => (
                <option key={k} value={k}>{name}</option>
              ))}
            </select>
            <LineChart
              label="Carico massimo per seduta"
              unit="kg"
              series={[{ name: 'Carico massimo', points: hist.filter((h) => h.maxWeight != null).map((h) => ({ date: h.date, value: h.maxWeight })) }]}
            />
            <p className="text-[11px] text-slate-500">
              Confronto solo tra sedute dello stesso esercizio e attrezzo. Ultime: {hist.slice(-3).map((h) => `${h.date} ${h.reps.join('/')} rip.${h.avgRir != null ? ` RIR ${fmtNum(h.avgRir, 1)}` : ''}`).join(' · ') || '—'}
            </p>
          </div>
        )}
      </Card>
    </Section>
  )
}

function SwimWidget({ a, p }) {
  const s = a.swim
  return (
    <Section title="Nuoto">
      <Card className="space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric label="Sedute" value={s.sessions} />
          <Metric label="Minuti" value={s.minutes.value} unit="min" />
          <div>
            <Metric label="Distanza misurata" value={s.measuredM != null ? fmtNum(s.measuredM / 1000, 2) : null} unit="km" hint={`${s.measuredSessions} sedute`} />
            {p && <Delta cur={s.measuredM} prev={p.swim.measuredM} unit=" m" />}
          </div>
          <Metric label="Distanza stimata" value={s.estimatedM ? fmtRange({ min: s.estimatedM.min / 1000, max: s.estimatedM.max / 1000 }, 2) : null} unit="km" estimate={!!s.estimatedM} hint={`${s.estimatedSessions} sedute · non sommata alla misurata`} />
          <Metric label="Volume previsto" value={s.plannedM != null ? fmtNum(s.plannedM / 1000, 2) : null} unit="km" hint="programma, non svolto" />
          <Metric label="Abbreviate" value={s.partialSessions} hint={s.unknownSessions ? `${s.unknownSessions} senza distanza` : null} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Presa sull’acqua" value={s.technique.catch != null ? fmtNum(s.technique.catch, 1) : null} unit="/5" />
          <Metric label="Qualità bracciata" value={s.technique.strokeQuality != null ? fmtNum(s.technique.strokeQuality, 1) : null} unit="/5" />
          <Metric label="Affaticamento spalle" value={s.technique.shoulderFatigue != null ? fmtNum(s.technique.shoulderFatigue, 1) : null} unit="/5" />
          <Metric label="Respirazione" value={s.technique.breathing != null ? fmtNum(s.technique.breathing, 1) : null} unit="/5" />
        </div>
      </Card>
    </Section>
  )
}

function BodyWidget({ a, state, period }) {
  const b = a.body
  const inP = (pt) => pt.date >= period.from && pt.date <= period.to
  const ws = weightSeries(state.measurements).filter(inP)
  const waist = measurementSeries(state.measurements, 'waistCm').filter(inP)
  const abd = measurementSeries(state.measurements, 'abdomenCm').filter(inP)
  const stat = (x, unit) => (x ? { value: fmtNum(x.last.value, 1), hint: x.delta != null ? `${x.delta > 0 ? '+' : ''}${fmtNum(x.delta, 1)} ${unit} nel periodo (${x.samples} misure)` : '1 misura' } : { value: null, hint: 'non misurato' })
  return (
    <Section title="Misure corporee">
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Peso (ultimo)" unit="kg" {...stat(b.weight, 'kg')} />
          <Metric label="Media 7 giorni" value={b.weightAvg7Last != null ? fmtNum(b.weightAvg7Last, 1) : null} unit="kg" hint={b.weightAvg7Last == null ? 'servono ≥ 2 misure in 7 giorni' : null} />
          <Metric label="Girovita" unit="cm" {...stat(b.waist, 'cm')} />
          <Metric label="Addome" unit="cm" {...stat(b.abdomen, 'cm')} />
        </div>
        {ws.length > 0 && (
          <LineChart
            label="Peso corporeo"
            unit="kg"
            series={[
              { name: 'Peso', points: ws.map((x) => ({ date: x.date, value: x.value })) },
              ...(ws.some((x) => x.avg7 != null) ? [{ name: 'Media 7 giorni', dashed: true, points: ws.filter((x) => x.avg7 != null).map((x) => ({ date: x.date, value: x.avg7 })) }] : []),
            ]}
          />
        )}
        {(waist.length > 0 || abd.length > 0) && (
          <LineChart
            label="Circonferenze"
            unit="cm"
            series={[
              ...(waist.length ? [{ name: 'Girovita', points: waist }] : []),
              ...(abd.length ? [{ name: 'Addome', points: abd }] : []),
            ]}
          />
        )}
      </Card>
    </Section>
  )
}

function DietWidget({ a }) {
  const d = a.diet
  const avgCells = (sum, total) =>
    Object.fromEntries(MAIN_KEYS.map((k) => [k, sum && sum.avg[k] != null ? { value: sum.avg[k], status: 'complete' } : { value: null, status: 'missing' }]))
  const targetAvg = Object.fromEntries(MAIN_KEYS.map((k) => {
    const v = d.daily.map((r) => r.target?.[k]).filter((x) => x != null)
    return [k, v.length ? v.reduce((x, y) => x + y, 0) / v.length : null]
  }))
  const consumedPts = d.daily.filter((r) => r.consumed?.kcal.status === 'complete').map((r) => ({ date: r.date, value: r.consumed.kcal.value }))
  const targetPts = d.daily.filter((r) => r.target?.kcal != null && consumedPts.length).map((r) => ({ date: r.date, value: r.target.kcal }))
  return (
    <Section title="Alimentazione">
      <Card className="space-y-3 text-sm">
        {d.activePlan ? (
          <div className="text-slate-200">
            Piano attivo: <b className="text-white">{d.activePlan.name}</b> · rev. {d.activePlan.revision} · {d.activePlan.status === 'validated' ? 'validato' : 'bozza'}
          </div>
        ) : (
          <p className="text-slate-400">Nessun piano attivo: obiettivi e programmato non disponibili.</p>
        )}
        <DayTable
          rows={[
            { label: 'Obiettivo medio', kind: 'target', hint: d.dataQuality.targets === 'declared' ? 'dal piano' : 'non specificato', cells: targetAvg },
            ...(d.planned ? [{ label: 'Programmato medio', kind: 'total', hint: `${d.planned.daysComplete.kcal}/${d.planned.days} giorni con dati completi`, cells: avgCells(d.planned) }] : []),
            { label: 'Consumato medio', kind: 'total', hint: `${d.consumed.daysComplete.kcal}/${d.consumed.days} giorni registrati completi`, cells: avgCells(d.consumed) },
          ]}
        />
        {consumedPts.length > 0 && (
          <LineChart label="kcal consumate e obiettivo" unit="kcal" digits={0} series={[{ name: 'Consumate (giorni completi)', points: consumedPts }, ...(targetPts.length ? [{ name: 'Obiettivo', dashed: true, points: targetPts }] : [])]} />
        )}
        <p className="text-xs text-slate-400">
          Medie calcolate solo sui giorni con dati completi; i giorni parziali non vengono stimati.
          {d.dataQuality.nutritionCompleteness?.total ? ` Pasti del piano con valori completi: ${d.dataQuality.nutritionCompleteness.complete}/${d.dataQuality.nutritionCompleteness.total}.` : ''}
        </p>
        <p className="text-slate-300">
          Aderenza:{' '}
          {d.adherence ? `${d.adherence.followed} seguiti · ${d.adherence.modified} modificati · ${d.adherence.skipped} saltati${d.adherence.extra ? ` · ${d.adherence.extra} fuori piano` : ''}` : 'non registrata'}
        </p>
      </Card>
    </Section>
  )
}

function EnergyWidget({ a }) {
  const e = a.energy
  return (
    <Section title="Calorie da esercizio">
      <Card className="space-y-2 text-sm">
        {e.sessionsWithValue ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Attive" value={fmtRange(e.activeKcal, 0)} unit="kcal" estimate={e.sources.includes('estimate')} />
              <Metric label="Totali" value={fmtRange(e.totalKcal, 0)} unit="kcal" estimate={e.sources.includes('estimate')} />
            </div>
            <p className="text-xs text-slate-400">
              {e.sessionsWithValue} sedute con valore, {e.sessionsWithout} senza (non conteggiate). Metodo: {e.methods.join('; ') || '—'}
            </p>
          </>
        ) : (
          <p className="text-slate-400">ND — nessuna seduta con stima o dato da dispositivo nel periodo.</p>
        )}
      </Card>
    </Section>
  )
}

function ReportExport({ state, period, settings }) {
  const [sections, setSections] = useState(Object.keys(REPORT_SECTIONS))
  const [detail, setDetail] = useState('summary')
  const [excludeNotes, setExcludeNotes] = useState(settings.reportExcludeNotes ?? true)
  const [includePlanGuide, setIncludePlanGuide] = useState(false)
  const report = useMemo(() => buildReport(state, period, { sections, detail, excludeNotes, includePlanGuide }), [state, period.from, period.to, sections, detail, excludeNotes, includePlanGuide])
  const [dialect, setDialect] = useState('excel')
  const [pdfBusy, setPdfBusy] = useState(false)
  const csv = useMemo(() => reportToCSV(state, period, { sections, dialect }), [state, period.from, period.to, sections, dialect])
  const toggle = (k) => setSections(sections.includes(k) ? sections.filter((x) => x !== k) : [...sections, k])
  return (
    <Section title="Esporta report">
      <Card className="space-y-3">
        <p className="text-xs text-slate-400">Un report è un riepilogo da condividere: non è un backup e non si può reimportare.</p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(REPORT_SECTIONS).map(([k, label]) => (
            <button key={k} onClick={() => toggle(k)} aria-pressed={sections.includes(k)} className={`rounded-lg px-2 py-1 text-xs font-medium ${sections.includes(k) ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
              {label}
            </button>
          ))}
        </div>
        <Segmented value={detail} onChange={setDetail} options={[{ id: 'summary', label: 'Solo riepilogo' }, { id: 'detailed', label: 'Con dettaglio sedute' }]} />
        <Toggle checked={excludeNotes} onChange={setExcludeNotes} label="Escludi note personali e sanitarie" />
        {sections.includes('diet') && <Toggle checked={includePlanGuide} onChange={setIncludePlanGuide} label="Includi la guida del piano alimentare" />}
        <Segmented value={dialect} onChange={setDialect} options={Object.entries(CSV_DIALECTS).map(([id, d]) => ({ id, label: `CSV ${d.label}` }))} />
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-300">Anteprima ({csv.split('\n').length - 1} righe CSV)</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-slate-950 p-2 text-[11px] text-slate-300">{JSON.stringify(report, null, 2).slice(0, 4000)}</pre>
        </details>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={!sections.length || pdfBusy}
            onClick={async () => {
              setPdfBusy(true)
              try {
                // jsPDF viene caricato solo quando serve
                const { buildReportPdf } = await import('../lib/report/pdf')
                downloadBlob(fileNames.report(period, 'pdf'), buildReportPdf(state, period, { sections, detail, excludeNotes, includePlanGuide }).output('blob'))
              } catch (e) {
                alert(`PDF non generato: ${e.message}`)
              } finally {
                setPdfBusy(false)
              }
            }}
            className="btn w-full bg-sky-500 text-slate-950 disabled:opacity-40"
          >
            {pdfBusy ? 'Generazione PDF…' : 'Scarica PDF'}
          </button>
          <button disabled={!sections.length} onClick={() => downloadJSON(fileNames.report(period, 'json'), report)} className="btn flex-1 bg-emerald-500 text-slate-950 disabled:opacity-40">Scarica JSON</button>
          <button disabled={!sections.length} onClick={() => downloadCSV(fileNames.report(period, 'csv'), csv)} className="btn-ghost flex-1 disabled:opacity-40">Scarica CSV</button>
        </div>
      </Card>
    </Section>
  )
}
