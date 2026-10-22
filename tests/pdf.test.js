// P2-01: PDF con le stesse cifre del report, sezioni selezionate e privacy
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildReportPdf } from '../src/lib/report/pdf'
import { migrateToV3 } from '../src/schema/migrate'

const state = migrateToV3(JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures/backup-v2-reale.json'), 'utf8')))
state.sessions[1].note = 'NOTA-SEGRETA'
state.measurements.push({ id: 'm2', at: '2026-10-22T07:30:00+02:00', weightKg: 74.6, waistCm: 90, abdomenCm: 100, hipsCm: null, chestCm: null, armCm: null, notes: 'MISURA-SEGRETA', source: 'manual' })
state.sessions.push({ id: 'swim', kind: 'swim', date: '2026-10-21', title: 'Nuoto', status: 'completed', durationMin: 60, durationSource: 'manual', poolLengthM: 25, plannedBlocks: [], plannedDistanceM: 2450, actualDistanceM: null, estimatedDistanceM: { min: 1500, max: 1800 }, distanceSource: 'estimated', isPartial: true, technique: {}, feedback: {}, notes: '' })
const period = { from: '2026-10-01', to: '2026-10-31' }
// Nel PDF le parentesi dei testi sono precedute da \ : le togliamo per cercare il testo leggibile
const pdfText = (doc) => Buffer.from(doc.output('arraybuffer')).toString('latin1').replace(/\\([()])/g, '$1')

describe('report PDF', () => {
  it('A4, sezioni, numeri coerenti con il report, stime etichettate', () => {
    const doc = buildReportPdf(state, period, { detail: 'detailed', excludeNotes: true })
    const txt = pdfText(doc)
    expect(txt.startsWith('%PDF-')).toBe(true)
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(210)
    for (const t of ['Report Palestra', 'Riepilogo attivit', 'Forza (sala pesi)', 'Nuoto', 'Misure corporee', 'Alimentazione', 'Dispendio energetico', 'Dettaglio sedute', 'Qualit']) expect(txt).toContain(t)
    expect(txt).toContain('12.230 kg') // volume 20/10 (7.386) + 22/10 (4.844)
    // il separatore delle migliaia sui numeri di 4 cifre dipende dalla versione ICU (Node/browser)
    expect(txt).toMatch(/1\.?500-1\.?800 m \(stima\)/)
    expect(txt).toMatch(/2\.?450 m/)
    expect(txt).toContain('Note personali e sanitarie escluse')
  })
  it('“Escludi note” rispettato; incluse solo su richiesta esplicita', () => {
    const closed = pdfText(buildReportPdf(state, period, { detail: 'detailed', excludeNotes: true }))
    expect(closed).not.toContain('NOTA-SEGRETA')
    expect(closed).not.toContain('MISURA-SEGRETA')
    const open = pdfText(buildReportPdf(state, period, { detail: 'detailed', excludeNotes: false }))
    expect(open).toContain('NOTA-SEGRETA')
  })
  it('solo le sezioni selezionate; numerazione pagine', () => {
    const txt = pdfText(buildReportPdf(state, period, { sections: ['swim'] }))
    expect(txt).toContain('Nuoto')
    expect(txt).not.toContain('Forza (sala pesi)')
    expect(txt).not.toContain('Misure corporee')
    expect(txt).toMatch(/1 \/ \d/)
  })
})
