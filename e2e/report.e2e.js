// E2E-08 report 30 e 90 giorni (JSON/CSV) · E2E-15 PDF
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { openApp, nav, goImport, importFile, main, readJSON, waitSaved, EX, LEGACY_REAL } from './helpers'

async function prepare(page) {
  await openApp(page, { legacy: readJSON(LEGACY_REAL) })
  await goImport(page)
  await importFile(page, EX('nuoto-2026-10-21.json'))
  await importFile(page, EX('misure.json'))
  await waitSaved(page)
  await nav(page, /Progressi/)
}
const download = async (page, name) => {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()])
  return { name: dl.suggestedFilename(), path: await dl.path() }
}

test('E2E-08 report 30 e 90 giorni: valori coerenti con le card, filtri e privacy', async ({ page }) => {
  await prepare(page)
  const strength = main(page).locator('section').filter({ hasText: 'Sala pesi' }).first()
  await expect(strength).toContainText(/serie completate\s*52/i)
  await expect(strength).toContainText(/ripetizioni\s*592/i)

  // 30 giorni, con dettaglio: note escluse per impostazione predefinita
  await page.getByRole('tab', { name: 'Con dettaglio sedute' }).click()
  const j30 = await download(page, 'Scarica JSON')
  expect(j30.name).toBe('palestra-report-2026-10-02_2026-10-31.json')
  const r30 = JSON.parse(fs.readFileSync(j30.path, 'utf8'))
  expect(r30.summary.strength).toMatchObject({ sets: 52, reps: 592, volumeKg: 12230 })
  expect(r30.summary.swim).toMatchObject({ measuredM: null, estimatedM: { min: 1500, max: 1800 }, plannedM: 2450 })
  expect(r30.filters.excludeNotes).toBe(true)
  expect(JSON.stringify(r30)).not.toContain('Recupero dopo nuoto') // nota della seduta del 22/10
  expect(JSON.stringify(r30)).not.toContain('A digiuno') // nota della misura

  const c30 = await download(page, 'Scarica CSV')
  const csv = fs.readFileSync(c30.path, 'utf8')
  expect(csv.charCodeAt(0)).toBe(0xfeff) // BOM per Excel
  expect(csv).toContain('date;section;metric;value;min;max;unit;quality;source')
  expect(csv).toContain('2026-10-21;swim;distance;;1500;1800;m;estimated;estimated')
  expect(csv).toContain('2026-10-22;body;weight;75;;;kg;measured;')

  // 90 giorni: stessi valori (nessun dato prima di ottobre)
  await page.getByRole('tab', { name: '90 giorni' }).click()
  const r90 = JSON.parse(fs.readFileSync((await download(page, 'Scarica JSON')).path, 'utf8'))
  expect(r90.period).toEqual({ from: '2026-08-03', to: '2026-10-31' })
  expect(r90.summary.strength.sets).toBe(52)

  // filtro sezioni: solo nuoto
  for (const s of ['Frequenza e minuti', 'Sala pesi', 'Misure corporee', 'Alimentazione', 'Dispendio energetico (stime)']) await main(page).getByRole('button', { name: s, exact: true }).click()
  const rSwim = JSON.parse(fs.readFileSync((await download(page, 'Scarica JSON')).path, 'utf8'))
  expect(Object.keys(rSwim.summary)).toEqual(['swim'])
})

test('E2E-15 PDF completo, rispettoso dell’opzione privacy', async ({ page }) => {
  await prepare(page)
  const pdf = await download(page, 'Scarica PDF')
  expect(pdf.name).toBe('palestra-report-2026-10-02_2026-10-31.pdf')
  const raw = fs.readFileSync(pdf.path).toString('latin1').replace(/\\([()])/g, '$1')
  expect(raw.startsWith('%PDF-')).toBe(true)
  for (const t of ['Report Palestra', 'Forza (sala pesi)', 'Nuoto', 'Misure corporee', 'Note personali e sanitarie escluse']) expect(raw).toContain(t)
  expect(raw).toMatch(/1\.?500-1\.?800 m \(stima\)/)
  expect(raw).not.toContain('Recupero dopo nuoto')
})
