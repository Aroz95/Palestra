// E2E-02, 05, 06, 07, 09, 10, 11, 12 e sostituzione da backup
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { openApp, nav, tab, main, goImport, importFile, savedState, waitSaved, EX, FIX, readJSON, LEGACY_REAL } from './helpers'

test('E2E-02 programma A/B: anteprima, calendario corretto, nessun duplicato', async ({ page }) => {
  await openApp(page)
  await goImport(page)
  await page.locator('input[type=file]').setInputFiles(EX('programma-ab.json'))
  await expect(page.getByText('Contenuto: 1 programma, 2 schede')).toBeVisible()
  await page.getByRole('button', { name: 'Importa', exact: true }).click()
  await expect(page.getByText('Inseriti 1 · aggiornati 0 · saltati 0')).toBeVisible()
  // stesso file: riconosciuto come identico e saltato
  await page.locator('input[type=file]').setInputFiles(EX('programma-ab.json'))
  await expect(page.getByText('Identico a esistente')).toBeVisible()
  await page.getByRole('button', { name: 'Importa', exact: true }).click()
  await expect(page.getByText('Inseriti 0 · aggiornati 0 · saltati 1')).toBeVisible()
  await waitSaved(page)
  expect((await savedState(page)).programs).toHaveLength(1)

  // settimana del 2 novembre: lun A, mar nuoto 2450 m, gio B
  await nav(page, /Allenamenti/)
  await tab(page, 'Calendario')
  await page.getByLabel('Settimana successiva').click()
  await expect(main(page).getByText('Lun 2 nov').locator('..')).toContainText('A · Full Body A')
  await expect(main(page).getByText('Mar 3 nov').locator('..')).toContainText('Nuoto · 2450 m previsti')
  await expect(main(page).getByText('Gio 5 nov').locator('..')).toContainText('B · Full Body B')
})

test('E2E-05 nuotata stimata: previsto 2.450 m distinto da 1.500–1.800 m stimati', async ({ page }) => {
  await openApp(page)
  await goImport(page)
  await importFile(page, EX('nuoto-2026-10-21.json'))
  await nav(page, /Allenamenti/)
  await tab(page, 'Storico')
  await page.getByRole('button', { name: 'Apri' }).first().click()
  const card = main(page).locator('div.rounded-2xl').filter({ hasText: 'Previsti' }).first()
  await expect(card).toContainText('2.450')
  await expect(card).toContainText('programma, non nuotati')
  await expect(card).toContainText('1.500–1.800')
  await expect(card).toContainText('stima')
  await expect(card).toContainText('3:20–4:00') // passo solo come intervallo stimato
  const s = (await savedState(page)).sessions[0]
  expect(s).toMatchObject({ actualDistanceM: null, distanceSource: 'estimated', plannedDistanceM: 2450 })
})

test('E2E-06 dieta: mercoledì con pasti ordinati, alternative e valori ignoti ND', async ({ page }) => {
  await openApp(page)
  await goImport(page)
  await importFile(page, FIX('dieta-mercoledi.json'))
  await nav(page, /Alimentazione/)
  await page.getByRole('button', { name: 'Mer', exact: true }).click()
  const meals = main(page).locator('div.rounded-2xl').filter({ hasText: /Colazione|Cena/ })
  await expect(meals.nth(0)).toContainText('Colazione') // 07:30 prima delle 20:00
  await expect(meals.nth(0)).toContainText('oppure: Gallette 30 g')
  await expect(meals.nth(0)).toContainText('P 12 g · C ND · G ND')
  await expect(meals.nth(1)).toContainText('Valori nutrizionali non disponibili')
  await expect(main(page)).toContainText('Bozza — non validato da un professionista')
  // alternativa del pasto: anteprima con i propri alimenti, senza copiare i valori del principale
  await main(page).getByRole('group', { name: 'Opzioni Colazione' }).getByRole('button', { name: 'Dolce' }).click()
  await expect(meals.nth(0)).toContainText('Yogurt · 125 g')
  await expect(meals.nth(0)).toContainText('Valori nutrizionali non disponibili')
  // il piano importato non viene attivato da solo
  expect((await savedState(page)).dietPlans[0].active).toBe(false)
})

test('E2E-07 misure 75 kg / vita 90 / addome 100: serie distinte in misure, dashboard e report', async ({ page }) => {
  await openApp(page)
  await goImport(page)
  await importFile(page, EX('misure.json'))
  await tab(page, 'Misure')
  await expect(main(page)).toContainText('Girovita: 90 cm')
  await expect(main(page)).toContainText('Circonferenza addominale: 100 cm')
  await nav(page, /Progressi/)
  const body = main(page).locator('section').filter({ hasText: 'Peso (ultimo)' })
  await expect(body).toContainText(/girovita\s*90/i)
  await expect(body).toContainText(/addome\s*100/i)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Scarica JSON' }).click()])
  const rep = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'))
  expect(rep.summary.body.waist.last.value).toBe(90)
  expect(rep.summary.body.abdomen.last.value).toBe(100)
  expect(rep.summary.body.weight.last.value).toBe(75)
})

test('E2E-09 un record non valido: nessun dato salvato, errore con percorso', async ({ page }, info) => {
  await openApp(page)
  const file = info.outputPath('misto.json')
  fs.writeFileSync(file, JSON.stringify([readJSON(EX('programma-ab.json')), { type: 'palestra-body-measurements', measurements: [{ date: '2026-10-22', weightKg: 75 }, { date: '2026-13-40', weightKg: -3 }] }]))
  await goImport(page)
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.getByText(/nessun dato verrà importato/)).toBeVisible()
  await expect(page.getByText('[1].measurements[1].date')).toBeVisible()
  await expect(page.getByText('[1].measurements[1].weightKg')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importa', exact: true })).toHaveCount(0)
  // nessuna scrittura: per un utente nuovo l'archivio resta vuoto
  const s = (await savedState(page)) ?? { programs: [], measurements: [] }
  expect(s.programs).toHaveLength(0)
  expect(s.measurements).toHaveLength(0)
})

test('E2E-10 errore di IndexedDB durante l’import: nessun falso successo, nessuna perdita', async ({ page }) => {
  await openApp(page)
  await goImport(page)
  await importFile(page, EX('misure.json'))
  await waitSaved(page)
  // da qui ogni scrittura fallisce come con spazio esaurito
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('Spazio esaurito (simulato)', 'QuotaExceededError')
    }
  })
  await page.locator('input[type=file]').setInputFiles(EX('programma-ab.json'))
  await page.getByRole('button', { name: 'Importa', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Importazione NON salvata' })).toBeVisible()
  await expect(page.getByText(/Inseriti \d+ · aggiornati/)).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('Non salvato')
  // in memoria resta lo stato precedente: il programma non compare
  await nav(page, /Allenamenti/)
  await tab(page, 'Schede')
  await expect(main(page)).not.toContainText('Ricomposizione + nuoto')
  // al riavvio lo stato è coerente: misure presenti, programma assente; si può riprovare
  await page.reload()
  const s = await savedState(page)
  expect(s.measurements).toHaveLength(2)
  expect(s.programs).toHaveLength(0)
  await goImport(page)
  await importFile(page, EX('programma-ab.json'))
  await waitSaved(page)
  expect((await savedState(page)).programs).toHaveLength(1)
})

test('E2E-11 import → modifica successiva → annullamento non più disponibile', async ({ page }) => {
  await openApp(page)
  await goImport(page)
  await importFile(page, EX('programma-ab.json'))
  // subito dopo: annullabile
  await page.getByRole('button', { name: 'Annulla importazione' }).click()
  await waitSaved(page)
  expect((await savedState(page)).programs).toHaveLength(0)
  // nuovo import, poi una misura registrata a mano
  await importFile(page, EX('programma-ab.json'))
  await tab(page, 'Misure')
  await page.getByRole('button', { name: '+ Registra misura' }).click()
  await page.getByLabel('Peso (kg)').fill('74,8')
  await page.getByRole('button', { name: 'Salva' }).click()
  await waitSaved(page)
  await tab(page, 'Importa')
  await expect(page.getByRole('button', { name: 'Annulla importazione' })).toHaveCount(0)
  await expect(page.getByText(/Annullamento non più disponibile/)).toBeVisible()
  const s = await savedState(page)
  expect(s.measurements).toHaveLength(1)
  expect(s.programs).toHaveLength(1)
})

test('E2E-12 backup → nuovo browser → import: dati equivalenti; sostituzione con copia di sicurezza', async ({ page, browser }) => {
  await openApp(page, { legacy: readJSON(LEGACY_REAL) })
  await goImport(page)
  for (const f of ['programma-ab.json', 'nuoto-2026-10-21.json', 'piano-alimentare.json', 'misure.json']) await importFile(page, EX(f))
  await waitSaved(page)
  await tab(page, 'Esporta')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Scarica backup' }).click()])
  const backupPath = await dl.path()
  const original = await savedState(page)

  const ctx2 = await browser.newContext({ baseURL: 'http://127.0.0.1:4173/', acceptDownloads: true })
  const p2 = await ctx2.newPage()
  await openApp(p2)
  await goImport(p2)
  await p2.locator('input[type=file]').setInputFiles(backupPath)
  await p2.getByRole('tab', { name: 'Sostituisci tutto' }).click()
  const [safety] = await Promise.all([p2.waitForEvent('download'), p2.getByRole('button', { name: 'Sostituisci' }).click()])
  expect(safety.suggestedFilename()).toMatch(/backup-prima-del-ripristino/)
  await expect(p2.getByText(/Inseriti \d+/)).toBeVisible()
  await waitSaved(p2)
  const restored = await savedState(p2)
  for (const k of ['programs', 'workoutTemplates', 'sessions', 'measurements', 'dietPlans', 'dietLog', 'goals', 'profile']) expect(restored[k]).toEqual(original[k])
  await ctx2.close()
})
