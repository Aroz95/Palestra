// Alimentazione: suggerimenti personali, promemoria dei pasti; cronometro e recupero solo negli allenamenti
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { openApp, nav, main, goImport, importFile, savedState, waitSaved, openMeal, EX, readJSON } from './helpers'

test.use({ viewport: { width: 390, height: 844 } })

async function openPlan(page, info) {
  const plan = { ...readJSON(EX('piano-alimentare-v4.json')), validFrom: null, validTo: null }
  const file = info.outputPath('piano.json')
  fs.writeFileSync(file, JSON.stringify(plan))
  await openApp(page)
  await goImport(page)
  await importFile(page, file)
  await nav(page, /Alimentazione/)
  await main(page).getByRole('button', { name: 'Imposta attivo' }).click()
}

test('suggerimenti: esempi, nuova alternativa per il pranzo visibile nel pasto, modifica ed eliminazione', async ({ page }, info) => {
  await openPlan(page, info)
  await page.getByRole('tab', { name: 'Suggerimenti' }).click()
  await expect(main(page)).toContainText('Nessun suggerimento')
  await main(page).getByRole('button', { name: 'Parti da qualche esempio' }).click()
  await expect(main(page).getByRole('region', { name: 'Ingannare la fame' }).getByRole('listitem')).toHaveCount(4)
  // nuovo suggerimento: alternativa per il pranzo
  await main(page).getByRole('button', { name: '+ Aggiungi' }).click()
  const sheet = page.getByRole('dialog', { name: 'Nuovo suggerimento' })
  await sheet.getByLabel('Categoria').selectOption({ label: 'Alternative per un pasto' })
  await sheet.getByLabel('Per quale pasto').selectOption({ label: 'Pranzo' })
  await sheet.getByLabel('Testo del suggerimento').fill('Al posto della pasta: 300 g di patate')
  await sheet.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('tab', { name: 'Suggerimenti (7)' })).toBeVisible()
  // filtro per categoria
  await main(page).getByRole('group', { name: 'Filtra i suggerimenti' }).getByRole('button', { name: 'Fuori casa e imprevisti' }).click()
  await expect(main(page).getByRole('listitem')).toHaveCount(1)
  // dentro il pranzo: solo le alternative per quel pasto
  await page.getByRole('tab', { name: 'Pasti' }).click()
  const pranzo = await openMeal(page, 'Pranzo')
  await pranzo.getByRole('button', { name: 'I tuoi suggerimenti (2)' }).click()
  await expect(pranzo).toContainText('Al posto della pasta: 300 g di patate')
  await expect(await openMeal(page, 'Cena')).not.toContainText('I tuoi suggerimenti')
  // modifica ed eliminazione, persistenti
  await page.getByRole('tab', { name: /Suggerimenti/ }).click()
  await main(page).getByRole('button', { name: /Modifica suggerimento: Al posto della pasta/ }).click()
  const edit = page.getByRole('dialog', { name: 'Modifica suggerimento' })
  await edit.getByLabel('Testo del suggerimento').fill('Al posto della pasta: 250 g di patate')
  await edit.getByRole('button', { name: 'Salva' }).click()
  await main(page).getByRole('button', { name: /Modifica suggerimento: Mi lavo i denti/ }).click()
  await edit.getByRole('button', { name: 'Elimina suggerimento' }).click()
  await waitSaved(page)
  const tips = (await savedState(page)).dietTips
  expect(tips).toHaveLength(6)
  expect(tips.find((t) => t.meal === 'lunch' && t.text.includes('250 g'))).toMatchObject({ category: 'alternative' })
  await page.reload()
  await nav(page, /Alimentazione/)
  await expect(page.getByRole('tab', { name: 'Suggerimenti (6)' })).toBeVisible()
})

test('promemoria: file del calendario con il contenuto del pasto e avviso; notifiche attivabili', async ({ page }, info) => {
  await openPlan(page, info)
  await main(page).getByRole('button', { name: 'Promemoria dei pasti' }).click()
  const sheet = page.getByRole('dialog', { name: 'Promemoria dei pasti' })
  await expect(sheet).toContainText('Esempio di avviso')
  await sheet.getByLabel('Quando avvisare').selectOption({ label: '30 minuti prima' })
  const [download] = await Promise.all([page.waitForEvent('download'), sheet.getByRole('button', { name: /Aggiungi al calendario \(\d+\)/ }).click()])
  expect(download.suggestedFilename()).toBe('promemoria-pasti.ics')
  const ics = fs.readFileSync(await download.path(), 'utf8').replace(/\r\n /g, '')
  expect(ics).toContain('DTSTART:20261031T130000') // pranzo di oggi (sabato 31/10)
  expect(ics).toMatch(/SUMMARY:Pranzo: Pasta di semola 80 g/)
  expect(ics).toContain('TRIGGER:-PT30M')
  await expect(sheet.getByRole('status')).toContainText('File del calendario creato')
  // notifiche dell'app
  await sheet.getByRole('switch', { name: 'Avvisami quando è ora di un pasto' }).click()
  await expect(sheet.getByRole('switch', { name: 'Avvisami quando è ora di un pasto' })).toHaveAttribute('aria-checked', 'true')
  // nel browser di prova il permesso non è concesso: l'app lo dichiara invece di tacere
  await expect(sheet.getByText(/Le notifiche sono bloccate|Invia una notifica di prova|non consente le notifiche/)).toBeVisible()
  await waitSaved(page)
  expect((await savedState(page)).settings.mealReminders).toEqual({ enabled: true, leadMin: 30 })
})

test('cronometro e recupero solo nella seduta; altrove un richiamo compatto se l’allenamento è in corso', async ({ page }) => {
  await openApp(page)
  await goImport(page)
  await importFile(page, EX('programma-ab.json'))
  const bar = page.getByText('Cronometro', { exact: true })
  const live = page.getByRole('button', { name: 'Allenamento in corso: torna alla seduta' })
  await nav(page, /Oggi/)
  await page.getByRole('button', { name: /A · Full Body A/ }).click()
  await expect(bar).toBeVisible() // seduta aperta
  await expect(page.getByRole('group', { name: 'Avvia un recupero' })).toBeVisible()
  for (const t of [/Oggi/, /Alimentazione/, /Progressi/, /Altro/]) {
    await nav(page, t)
    await expect(bar).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Avvia un recupero' })).toHaveCount(0)
    await expect(live).toHaveCount(0)
  }
  // anche nelle altre sezioni degli allenamenti (calendario, schede, storico) niente cronometro
  await nav(page, /Allenamenti/)
  await page.getByRole('tab', { name: 'Calendario' }).click()
  await expect(bar).toHaveCount(0)
  await page.getByRole('tab', { name: 'Seduta' }).click()
  await page.getByRole('button', { name: 'Avvia', exact: true }).click()
  await nav(page, /Alimentazione/)
  await expect(bar).toHaveCount(0)
  await expect(live).toBeVisible()
  await live.click()
  await expect(bar).toBeVisible()
  await expect(main(page).getByRole('tab', { name: 'Seduta' })).toHaveAttribute('aria-selected', 'true')
})
