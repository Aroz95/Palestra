// CAT-01/CAT-02: selettore esercizi con ricerca, filtri, miniature; aggiunta con riscontro immediato
import { test, expect } from '@playwright/test'
import { openApp, nav, main, goImport, importFile, savedState, waitSaved, EX } from './helpers'

test('aggiungi esercizio: ricerca, ordine A–Z, filtri, già presenti, personalizzato', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openApp(page)
  await goImport(page)
  await importFile(page, EX('programma-ab.json'))
  await nav(page, /Oggi/)
  await page.getByRole('button', { name: /A · Full Body A/ }).click()
  await main(page).getByRole('button', { name: '+ Aggiungi esercizio' }).click()
  const sheet = page.getByRole('dialog', { name: 'Aggiungi esercizio' })
  const rows = sheet.getByRole('list', { name: 'Esercizi' }).getByRole('button')
  // A–Z e miniature con testo alternativo
  const names = await rows.evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label').replace(/, già nella seduta$/, '')))
  expect(names).toEqual([...names].sort(new Intl.Collator('it', { sensitivity: 'base' }).compare))
  await expect(rows.first().getByRole('img')).toHaveAttribute('aria-label', /: /)
  // già presente nella seduta: segnalato e non aggiungibile due volte
  await expect(sheet.getByRole('button', { name: 'Leg press, già nella seduta' })).toBeDisabled()
  // ricerca
  const search = sheet.getByLabel('Cerca esercizio')
  await search.fill('lat')
  await expect(sheet.getByRole('button', { name: 'Lat machine', exact: true })).toBeVisible()
  await search.fill('alzate laterali')
  await expect(rows).toHaveCount(1)
  // filtri
  await search.fill('')
  await sheet.getByLabel('Gruppo muscolare').selectOption('Bicipiti')
  await sheet.getByLabel('Attrezzo').selectOption('dumbbell')
  await expect(rows).toHaveCount(2) // Curl con manubri, Curl a martello
  await sheet.getByLabel('Gruppo muscolare').selectOption('')
  await sheet.getByLabel('Attrezzo').selectOption('')
  // aggiunta dal catalogo
  await search.fill('alzate laterali')
  await sheet.getByRole('button', { name: 'Alzate laterali', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  await expect(main(page).locator('[id^="exercise-"]').filter({ hasText: 'Alzate laterali' })).toBeInViewport()
  // personalizzato dal testo cercato
  await main(page).getByRole('button', { name: '+ Aggiungi esercizio' }).click()
  await sheet.getByLabel('Cerca esercizio').fill('Rematore landmine')
  await expect(sheet).toContainText('Nessun esercizio trovato')
  await sheet.getByRole('button', { name: /Esercizio personalizzato: “Rematore landmine”/ }).click()
  await waitSaved(page)
  const s = (await savedState(page)).sessions[0]
  expect(s.exercises.map((e) => e.name).slice(-2)).toEqual(['Alzate laterali', 'Rematore landmine'])
  expect(s.exercises.at(-2)).toMatchObject({ exerciseId: 'alzate-laterali', perHand: true, equipment: 'dumbbell' })
})
