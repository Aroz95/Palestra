// Report PDF A4 generato interamente sul dispositivo (nessun servizio esterno).
// Usa gli stessi aggregati del report JSON/CSV (buildReport) e ne rispetta sezioni, dettaglio e privacy.
import { jsPDF } from 'jspdf'
import { buildReport, REPORT_SECTIONS } from './index'
import { weightSeries } from './aggregate'
import { fmtNum, fmtRange } from '../stats'
import { fmtDate, WEEKDAYS_SHORT } from '../dates'

const M = 15 // margine (mm)
const QUALITY = {
  measured: 'misurata',
  estimated: 'stimata (intervallo)',
  mixed: 'in parte misurata, in parte stimata (non sommate)',
  none: 'nessun dato',
  not_provided: 'non disponibile',
  device: 'da dispositivo',
  nominal: 'nominale (indicativo)',
  partial: 'parziale (dati mancanti)',
  complete: 'completa',
}

// I font standard del PDF coprono l'alfabeto latino: sostituisce i pochi simboli non rappresentabili
const clean = (s) =>
  String(s ?? '')
    .replace(/→/g, '->')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ | /g, ' ')
const nd = (v, digits = 0, unit = '') => (v == null ? 'ND' : `${fmtNum(v, digits)}${unit ? ` ${unit}` : ''}`)
const it = (iso) => fmtDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' })

export function buildReportPdf(state, period, opts = {}) {
  const report = buildReport(state, period, opts)
  const s = report.summary
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false })
  doc.setProperties({ title: `Report Palestra ${period.from} - ${period.to}`, creator: 'Palestra (generato sul dispositivo)' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  let y = M + 5

  const ensure = (h) => {
    if (y + h > H - M - 8) {
      doc.addPage()
      y = M + 5
    }
  }
  const text = (str, { size = 10, bold = false, color = [30, 41, 59], indent = 0, gap = 1.5 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(clean(str), W - 2 * M - indent)
    const lh = size * 0.42
    ensure(lines.length * lh + gap)
    doc.text(lines, M + indent, y)
    y += lines.length * lh + gap
  }
  const h2 = (str) => {
    ensure(14)
    y += 3
    doc.setDrawColor(16, 185, 129)
    doc.setLineWidth(0.6)
    doc.line(M, y, M + 12, y)
    y += 5
    text(str, { size: 13, bold: true, color: [15, 23, 42], gap: 2 })
  }
  const kv = (label, value, note) => {
    doc.setFontSize(10)
    ensure(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text(clean(label), M + 2, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(clean(value), M + 70, y)
    y += 4.6
    if (note) text(note, { size: 8, color: [100, 116, 139], indent: 70, gap: 1 })
  }

  // ---- Copertina essenziale ----
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 34, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('Report Palestra', M, 17)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(clean(`Periodo: ${it(period.from)} - ${it(period.to)}`), M, 26)
  y = 44
  text(`Generato il ${clean(report.generatedAt.slice(0, 16).replace('T', ' '))} sul dispositivo, senza invio di dati a servizi esterni.`, { size: 9, color: [71, 85, 105] })
  text(`Sezioni: ${opts.sections ? opts.sections.map((k) => REPORT_SECTIONS[k]).join(', ') : Object.values(REPORT_SECTIONS).join(', ')}.`, { size: 9, color: [71, 85, 105] })
  text(report.filters.excludeNotes ? 'Note personali e sanitarie escluse.' : 'ATTENZIONE: il report include le note personali.', { size: 9, bold: !report.filters.excludeNotes, color: report.filters.excludeNotes ? [71, 85, 105] : [190, 18, 60] })
  text('Report riepilogativo: non è un backup e non può essere reimportato. ND = dato non disponibile.', { size: 9, color: [71, 85, 105] })

  if (s.training) {
    const t = s.training
    h2('Riepilogo attività')
    kv('Sedute di sala pesi', String(t.strengthSessions))
    kv('Sedute di nuoto', String(t.swimSessions))
    kv('Giorni allenati', String(t.daysTrained))
    kv('Minuti sala pesi', nd(t.strengthMinutes.value, 0, 'min'), t.strengthMinutes.missing ? `${t.strengthMinutes.missing} sedute senza durata registrata` : null)
    kv('Minuti nuoto', nd(t.swimMinutes.value, 0, 'min'), t.swimMinutes.missing ? `${t.swimMinutes.missing} sedute senza durata registrata` : null)
    kv('Aderenza al calendario', t.adherence.ratio == null ? 'ND' : `${Math.round(t.adherence.ratio * 100)}%`, t.adherence.planned ? `${t.adherence.completed} su ${t.adherence.planned} attività previste` : 'nessuna attività prevista')
  }

  if (s.strength) {
    const st = s.strength
    h2('Forza (sala pesi)')
    kv('Serie completate', String(st.sets))
    kv('Ripetizioni', String(st.reps))
    kv('Volume nominale', nd(st.volumeKg, 0, 'kg'), st.volumePartial ? 'parziale: alcune serie senza carico registrato' : 'ripetizioni × carico (manubri ×2): indicativo, non confrontabile tra macchine')
    kv('Esercizi a tempo', `${st.timeSets} serie · ${st.timeSeconds} s`)
    kv('RIR medio', st.avgRir == null ? 'ND' : fmtNum(st.avgRir, 1), st.rirSamples ? `${st.rirSamples} serie con RIR registrato` : null)
    if (st.newRecords.length) {
      text('Nuovi record (stesso esercizio e attrezzo):', { size: 10, bold: true, gap: 1 })
      for (const r of st.newRecords) text(`- ${r.name}: ${fmtNum(r.weight, 1)} kg × ${r.reps} il ${it(r.date)} (prima ${fmtNum(r.prevBest.weight, 1)} kg)`, { size: 9, indent: 2 })
    }
  }

  if (s.swim) {
    const sw = s.swim
    h2('Nuoto')
    kv('Sedute', String(sw.sessions))
    kv('Minuti', nd(sw.minutes.value, 0, 'min'))
    kv('Distanza misurata', sw.measuredM == null ? 'ND' : `${fmtNum(sw.measuredM, 0)} m`, `${sw.measuredSessions} sedute con distanza misurata o contata`)
    kv('Distanza stimata', sw.estimatedM ? `${fmtRange(sw.estimatedM, 0)} m (stima)` : 'ND', sw.estimatedM ? 'intervallo dichiarato, non sommato alla distanza misurata' : null)
    kv('Volume previsto', sw.plannedM == null ? 'ND' : `${fmtNum(sw.plannedM, 0)} m`, 'distanza da programma, non nuotata')
    kv('Sedute abbreviate', String(sw.partialSessions))
    const tq = sw.technique
    kv('Tecnica (media 1-5)', `presa ${nd(tq.catch, 1)} · bracciata ${nd(tq.strokeQuality, 1)} · spalle ${nd(tq.shoulderFatigue, 1)} · respiro ${nd(tq.breathing, 1)}`)
  }

  if (s.body) {
    const b = s.body
    h2('Misure corporee')
    const line = (x, unit) => (x ? `${fmtNum(x.last.value, 1)} ${unit}${x.delta != null ? ` (${x.delta > 0 ? '+' : ''}${fmtNum(x.delta, 1)} ${unit} nel periodo)` : ''}` : 'ND')
    kv('Peso (ultimo)', line(b.weight, 'kg'), b.weight ? `${b.weight.samples} misure nel periodo` : 'nessuna misura nel periodo')
    kv('Peso, media mobile 7 giorni', b.weightAvg7Last == null ? 'ND' : `${fmtNum(b.weightAvg7Last, 1)} kg`, b.weightAvg7Last == null ? 'servono almeno 2 misure in 7 giorni' : null)
    kv('Girovita', line(b.waist, 'cm'))
    kv('Circonferenza addominale', line(b.abdomen, 'cm'))
    const pts = weightSeries(state.measurements).filter((p) => p.date >= period.from && p.date <= period.to)
    if (pts.length >= 2) {
      ensure(62) // titolo e grafico restano sulla stessa pagina
      text('Andamento del peso', { size: 9, bold: true, gap: 0.5 })
      drawWeightChart(doc, pts, () => {}, () => y, (v) => (y = v), W)
    }
  }

  if (s.diet) {
    const d = s.diet
    h2('Alimentazione')
    if (d.activePlan) {
      kv('Piano attivo', `${d.activePlan.name} (rev. ${d.activePlan.revision})`, d.activePlan.status === 'validated' ? 'validato da un professionista' : 'bozza, non validata da un professionista')
      for (const day of d.programmed) {
        const label = `${day.weekday ? WEEKDAYS_SHORT[day.weekday] : it(day.date)}${day.dayType !== 'any' ? ` (${day.dayType === 'training' ? 'allenamento' : 'riposo'})` : ''}`
        kv(`kcal programmate ${label}`, day.kcal.missing ? 'ND' : `${fmtNum(day.kcal.value, 0)} kcal${day.kcal.partial ? ' (parziale)' : ''}`)
      }
    } else kv('Piano attivo', 'nessuno')
    kv('Aderenza registrata', d.adherence ? `${d.adherence.followed} seguiti · ${d.adherence.modified} modificati · ${d.adherence.skipped} saltati` : 'non registrata')
  }

  if (s.energy) {
    const e = s.energy
    h2('Dispendio energetico')
    if (e.sessionsWithValue) {
      kv('kcal attive', `${fmtRange(e.activeKcal, 0)} kcal`, 'solo dovute all’allenamento')
      kv('kcal totali', `${fmtRange(e.totalKcal, 0)} kcal`, 'incluso il metabolismo a riposo')
      kv('Copertura', `${e.sessionsWithValue} sedute con valore, ${e.sessionsWithout} senza`)
      text(`Metodo: ${e.methods.join('; ') || '-'}. Le stime hanno un errore realistico del 20-30%.`, { size: 8, color: [100, 116, 139] })
    } else kv('kcal', 'ND', 'nessuna stima o dato da dispositivo nel periodo')
  }

  if (report.details?.sessions?.length) {
    h2('Dettaglio sedute')
    for (const d of report.details.sessions) {
      const main =
        d.kind === 'swim'
          ? `Nuoto · previsti ${nd(d.plannedDistanceM, 0, 'm')} · ${d.actualDistanceM != null ? `nuotati ${fmtNum(d.actualDistanceM, 0)} m` : d.estimatedDistanceM ? `stimati ${fmtRange(d.estimatedDistanceM, 0)} m` : 'distanza non nota'}${d.isPartial ? ' · abbreviata' : ''}`
          : `Palestra · ${d.sets} serie · ${d.reps} rip. · ${fmtNum(d.volumeKg, 0)} kg`
      text(`${it(d.date)}  ${d.title || ''}`, { size: 9, bold: true, gap: 0.5 })
      text(`${main} · durata ${nd(d.durationMin, 0, 'min')}${d.note ? ` · Nota: ${d.note}` : ''}`, { size: 8.5, indent: 2, color: [71, 85, 105] })
    }
  }

  h2('Qualità dei dati e note metodologiche')
  const q = report.dataQuality
  kv('Distanza nuoto', QUALITY[q.swimDistance] ?? q.swimDistance)
  kv('Calorie', QUALITY[q.energyExpenditure] ?? q.energyExpenditure)
  kv('Volume pesi', QUALITY[q.strengthVolume] ?? q.strengthVolume)
  kv('Durate', QUALITY[q.durations] ?? q.durations)
  for (const n of report.notes) text(`- ${n}`, { size: 8.5, color: [71, 85, 105] })

  // Piè di pagina
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(clean(`Palestra · report ${it(period.from)} - ${it(period.to)}`), M, H - 8)
    doc.text(`${i} / ${pages}`, W - M, H - 8, { align: 'right' })
  }
  return doc
}

// Andamento del peso: una linea, un solo asse, valori minimo/massimo indicati
function drawWeightChart(doc, pts, ensure, getY, setY, W) {
  ensure()
  let y = getY() + 2
  const x0 = M + 12
  const w = W - 2 * M - 14
  const h = 38
  const vals = pts.map((p) => p.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const t0 = Date.parse(pts[0].at)
  const t1 = Date.parse(pts[pts.length - 1].at)
  const px = (p) => x0 + (t1 === t0 ? w / 2 : ((Date.parse(p.at) - t0) / (t1 - t0)) * w)
  const py = (v) => y + h - ((v - min) / span) * h
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.2)
  doc.line(x0, y, x0 + w, y)
  doc.line(x0, y + h, x0 + w, y + h)
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'normal')
  doc.text(`${fmtNum(max, 1)}`, x0 - 2, y + 2, { align: 'right' })
  doc.text(`${fmtNum(min, 1)}`, x0 - 2, y + h, { align: 'right' })
  doc.text('kg', x0 - 2, y + h / 2, { align: 'right' })
  doc.setDrawColor(5, 150, 105)
  doc.setLineWidth(0.6)
  for (let i = 1; i < pts.length; i++) doc.line(px(pts[i - 1]), py(pts[i - 1].value), px(pts[i]), py(pts[i].value))
  doc.setFillColor(5, 150, 105)
  for (const p of pts) doc.circle(px(p), py(p.value), 0.8, 'F')
  doc.text(clean(it(pts[0].date)), x0, y + h + 4)
  doc.text(clean(it(pts[pts.length - 1].date)), x0 + w, y + h + 4, { align: 'right' })
  setY(y + h + 8)
}
