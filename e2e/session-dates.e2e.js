// BUG data seduta: attività programmata per lunedì 2/11 svolta sabato 31/10 (anticipo)
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { openApp, nav, tab, main, goImport, importFile, savedState, waitSaved, EX } from './helpers'

test('seduta anticipata: data effettiva 31/10, programmata 2/11, coerente in seduta, export, riepilogo, storico e calendario', async ({ page }) => {
  await openApp(page) // sabato 31/10/2026, Europe/Rome
  await goImport(page)
  await importFile(page, EX('programma-ab.json'))
  await nav(page, /Allenamenti/)
  await tab(page, 'Calendario')
  await page.getByLabel('Settimana successiva').click()
  const monday = main(page).getByText('Lun 2 nov').locator('..')
  await monday.getByRole('button', { name: '▶ Avvia' }).click()

  // la seduta è di oggi; la data programmata resta visibile
  await expect(main(page).getByTestId('session-date')).toContainText('sabato 31 ottobre')
  await expect(main(page).getByTestId('session-date')).toContainText('programmata per lun 2 nov')
  await main(page).getByRole('button', { name: 'Serie 1: segna come fatta' }).first().click()
  await main(page).getByRole('button', { name: /Termina seduta/ }).click()
  await page.getByRole('button', { name: 'Concludi comunque' }).click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Esporta allenamento/ }).click()])
  expect(dl.suggestedFilename()).toBe('palestra-seduta-2026-10-31.json')
  const json = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'))
  expect(json.session).toMatchObject({ date: '2026-10-31', plannedDate: '2026-11-02' })
  expect(json.session.occurrenceKey).toContain(':2026-11-02:') // identifica l'attività programmata
  await page.getByRole('button', { name: 'Conferma e concludi' }).click()
  await expect(main(page).getByTestId('session-summary')).toContainText('programmata per lun 2 nov')

  await waitSaved(page)
  const st = await savedState(page)
  expect(st.sessions).toHaveLength(1)
  expect(st.sessions[0]).toMatchObject({ date: '2026-10-31', plannedDate: '2026-11-02', status: 'completed' })

  // storico
  await main(page).getByRole('button', { name: 'Vai allo storico' }).click()
  await expect(main(page)).toContainText('programmata per')
  // calendario: l'attività di lunedì risulta svolta, in anticipo, una sola volta
  await tab(page, 'Calendario')
  await page.getByLabel('Settimana successiva').click()
  await expect(monday).toContainText('Completata')
  await expect(monday).toContainText('Svolta in anticipo: sab 31 ott')
  await expect(monday.getByRole('button', { name: '▶ Avvia' })).toHaveCount(0)
  // oggi: la seduta compare nel giorno in cui è stata fatta
  await nav(page, /Oggi/)
  await expect(main(page)).toContainText('programmata per lun 2 nov')
})
