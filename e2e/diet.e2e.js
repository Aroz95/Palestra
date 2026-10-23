// NUT: piano alimentare v4 — obiettivi, programmato, alternative per data, consumato, fuori piano, guida
import { test, expect } from '@playwright/test'
import { openApp, nav, main, goImport, importFile, savedState, waitSaved, EX } from './helpers'

test('NUT v4: obiettivo ≠ programmato ≠ consumato, alternativa per data, guida', async ({ page }) => {
  await openApp(page) // sabato 31/10: giorno di riposo
  await goImport(page)
  await importFile(page, EX('piano-alimentare-v4.json'))
  await nav(page, /Alimentazione/)
  await main(page).getByRole('button', { name: 'Imposta attivo' }).click()

  // riepilogo del giorno: obiettivo dal piano (riposo) e programmato separati
  const summary = main(page).locator('table').first()
  await expect(summary).toContainText('Obiettivo')
  await expect(summary).toContainText('giorno di riposo')
  await expect(summary).toContainText('Programmato')
  await expect(summary).not.toContainText('Consumato')

  // anteprima dell'alternativa: nulla viene salvato finché non si sceglie
  const opts = main(page).getByRole('group', { name: 'Opzioni Colazione' })
  await opts.getByRole('button', { name: 'Skyr e avena' }).click()
  await expect(main(page)).toContainText('Anteprima: i totali del giorno mostrano questa opzione')
  await waitSaved(page)
  expect((await savedState(page)).dietSelections).toHaveLength(0)
  await main(page).getByRole('button', { name: 'Scegli per questa data' }).click()
  await expect(opts.getByRole('button', { name: 'Skyr e avena ✓' })).toBeVisible()
  await waitSaved(page)
  let st = await savedState(page)
  expect(st.dietSelections).toHaveLength(1)
  expect(st.dietSelections[0]).toMatchObject({ date: '2026-10-31', alternativeId: '6-colazione-skyr' })
  // il piano non cambia
  expect(st.dietPlans[0].revision).toBe(1)

  // consumato: registrazione precompilata con l'opzione scelta
  const card = main(page).locator('div.rounded-2xl').filter({ has: page.getByRole('group', { name: 'Opzioni Colazione' }) })
  await card.getByRole('button', { name: 'Registra quantità' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Salva', exact: true }).click()
  await expect(summary).toContainText('Consumato')
  await waitSaved(page)
  st = await savedState(page)
  expect(st.dietLog).toHaveLength(1)
  expect(st.dietLog[0].consumption).toBeTruthy()

  // fuori piano
  await main(page).locator('section').filter({ hasText: 'Fuori piano' }).getByRole('button', { name: '+ Aggiungi' }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByPlaceholder('es. Spuntino al bar').fill('Caffè e cornetto')
  await sheet.getByRole('button', { name: 'Salva', exact: true }).click()
  await expect(main(page)).toContainText('Caffè e cornetto')

  // persistenza dopo ricaricamento
  await waitSaved(page)
  await page.reload()
  await nav(page, /Alimentazione/)
  await expect(main(page).getByRole('group', { name: 'Opzioni Colazione' }).getByRole('button', { name: 'Skyr e avena ✓' })).toBeVisible()
  await expect(main(page)).toContainText('Caffè e cornetto')
  st = await savedState(page)
  expect(st.dietLog.filter((l) => l.status === 'extra')).toHaveLength(1)

  // guida del piano in scheda separata
  await page.getByRole('tab', { name: 'Guida', exact: true }).click()
  await expect(main(page)).toContainText('Idratazione')
})
