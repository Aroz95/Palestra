// E2E-01 — Aggiornamento di un dispositivo con dati v2 (backup reale anonimizzato)
import { test, expect } from '@playwright/test'
import { openApp, nav, tab, main, savedState, waitSaved, readJSON, LEGACY_REAL } from './helpers'

test('migrazione unica, storico invariato, snapshot recuperabile', async ({ page }) => {
  const legacy = readJSON(LEGACY_REAL)
  await openApp(page, { legacy })
  await expect(page.getByText('Dati aggiornati alla nuova versione')).toBeVisible()
  await waitSaved(page)

  // Storico: totali del 20/10 e del 22/10 identici a quelli della v2
  await nav(page, /Allenamenti/)
  await tab(page, 'Storico')
  const cards = main(page).locator('div.rounded-2xl.border')
  await expect(cards.filter({ hasText: '20 ott' })).toContainText(['30 serie'])
  await expect(cards.filter({ hasText: '20 ott' })).toContainText('7.386 kg')
  await expect(cards.filter({ hasText: '22 ott' })).toContainText('22 serie')
  await expect(cards.filter({ hasText: '22 ott' })).toContainText('250 rip.')
  await expect(cards.filter({ hasText: '22 ott' })).toContainText('4.844 kg')
  await expect(cards.filter({ hasText: '22 ott' })).toContainText('95 min')

  const s = await savedState(page)
  expect(s.schemaVersion).toBe(3)
  expect(s.sessions).toHaveLength(2)
  expect(s.sessions[1].startedAt).toBeNull() // orari non inventati

  // La migrazione avviene una sola volta
  await page.reload()
  await expect(page.getByText('Dati aggiornati alla nuova versione')).toHaveCount(0)
  expect((await savedState(page)).sessions).toHaveLength(2)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('palestra:data')))).toEqual(legacy) // v2 mai cancellata

  // Snapshot della versione precedente scaricabile
  await nav(page, /Altro/)
  await tab(page, 'Opzioni')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByText('Copia dei dati della versione precedente').getByRole('button', { name: 'Scarica' }).click()])
  expect(JSON.parse(await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8'))).toEqual(legacy)
})
