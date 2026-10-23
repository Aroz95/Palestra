// BUG P1 nuoto: "(100x3)x4" deve dare 12 tratti da 100 m, anche dopo export e reimport
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { openApp, nav, tab, main, goImport, importFile, savedState, waitSaved } from './helpers'

const hundreds = Array(12).fill(100)

test('nuoto: (100x3)x4 = 12 × 100 m, 2.100 m totali, export → reimport invariato', async ({ page }) => {
  await openApp(page)
  await main(page).getByRole('button', { name: '🏊 Aggiungi nuoto' }).click()
  const input = main(page).getByLabel('Nuovo blocco')
  const addBtn = main(page).getByRole('button', { name: 'Aggiungi', exact: true })

  // espressione ambigua: errore e nessun salvataggio
  await input.fill('50x50')
  await expect(main(page)).toContainText('è ambiguo')
  await expect(addBtn).toBeDisabled()

  for (const t of ['500', '(200)x2']) {
    await input.fill(t)
    await addBtn.click()
  }
  await input.fill('(100x3)x4')
  await expect(main(page).getByTestId('block-preview')).toContainText('12 tratti · 1.200 m')
  await addBtn.click()
  await expect(main(page)).toContainText('Totale previsto: 2.100 m')
  await expect(main(page).getByTestId('swim-block').nth(2)).toContainText('12 tratti')
  // un tocco sul testo di un blocco non lo elimina
  await main(page).getByTestId('swim-block').first().getByText('500', { exact: true }).click()
  await expect(main(page).getByTestId('swim-block')).toHaveCount(3)

  await main(page).getByLabel('Come conosci la distanza?').selectOption('manually_counted')
  await main(page).getByLabel('oppure vasche').fill('84')
  await main(page).getByLabel('oppure vasche').blur()
  await main(page).getByRole('button', { name: 'Termina nuotata' }).click()
  await waitSaved(page)
  const saved = (await savedState(page)).sessions[0]
  expect(saved.plannedBlocks.map((b) => b.segmentsM)).toEqual([[500], [200, 200], hundreds])
  expect(saved).toMatchObject({ plannedDistanceM: 2100, actualDistanceM: 2100, status: 'completed' })

  // export JSON
  await nav(page, /Allenamenti/)
  await tab(page, 'Storico')
  await page.getByRole('button', { name: 'Apri' }).first().click()
  const [dl] = await Promise.all([page.waitForEvent('download'), main(page).getByRole('button', { name: 'Esporta JSON' }).click()])
  const file = await dl.path()
  const exported = JSON.parse(fs.readFileSync(file, 'utf8'))
  expect(exported.plannedBlocks[2]).toMatchObject({ text: '(100x3)x4', repeats: 1, segmentsM: hundreds })

  // elimina e reimporta il file esportato
  await main(page).getByRole('button', { name: 'Elimina' }).click()
  await waitSaved(page)
  expect((await savedState(page)).sessions).toHaveLength(0)
  await goImport(page)
  await importFile(page, file)
  await waitSaved(page)
  const back = (await savedState(page)).sessions[0]
  expect(back.plannedBlocks.map((b) => b.segmentsM)).toEqual([[500], [200, 200], hundreds])
  expect(back).toMatchObject({ plannedDistanceM: 2100, actualDistanceM: 2100 })
})

test('nuoto: blocchi salvati male da versioni precedenti, rigenerati con anteprima e conferma', async ({ page }, info) => {
  const broken = {
    type: 'palestra-swim-session', schemaVersion: 4, id: 'swim-2026-10-23', kind: 'swim', date: '2026-10-23', title: 'Nuoto', status: 'completed',
    durationMin: 60, durationSource: 'manual', poolLengthM: 25, distanceSource: 'manually_counted', actualDistanceM: 2100, plannedDistanceM: 1200,
    plannedBlocks: [
      { id: 'b1', text: '500', repeats: 1, segmentsM: [500] },
      { id: 'b2', text: '(200)x2', repeats: 1, segmentsM: [200, 200] },
      { id: 'b3', text: '(100x3)x4', repeats: 1, segmentsM: Array(100).fill(3) },
    ],
  }
  const file = info.outputPath('nuoto-errato.json')
  fs.writeFileSync(file, JSON.stringify(broken))
  await openApp(page)
  await goImport(page)
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.getByText(/non corrispondono al testo/)).toBeVisible() // avviso in anteprima
  await page.getByRole('button', { name: 'Importa', exact: true }).click()
  await waitSaved(page)
  // import senza correzioni automatiche
  expect((await savedState(page)).sessions[0].plannedBlocks[2].segmentsM).toHaveLength(100)

  await nav(page, /Allenamenti/)
  await tab(page, 'Storico')
  await page.getByRole('button', { name: 'Apri' }).first().click()
  const alert = main(page).getByRole('alert')
  await expect(alert).toContainText('salvati 100 tratti (300 m), dal testo 12 tratti (1.200 m)')
  await alert.getByRole('button', { name: 'Rigenera i tratti dal testo' }).click() // conferma accettata da openApp
  await expect(main(page).getByRole('alert')).toHaveCount(0)
  await expect(main(page)).toContainText('Totale previsto: 2.100 m')
  await waitSaved(page)
  const s = (await savedState(page)).sessions[0]
  expect(s.plannedBlocks[2].segmentsM).toEqual(hundreds)
  expect(s).toMatchObject({ plannedDistanceM: 2100, actualDistanceM: 2100, distanceSource: 'manually_counted', status: 'completed' })
})
