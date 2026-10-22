// E2E-03 seduta completa con timer e RIR · E2E-04 revisione della scheda · E2E-13 app in background/chiusa (emulazione)
import { test, expect } from '@playwright/test'
import { openApp, nav, tab, main, goImport, importFile, savedState, waitSaved, EX, NOW } from './helpers'

async function startA(page) {
  await openApp(page)
  await goImport(page)
  await importFile(page, EX('programma-ab.json'))
  await nav(page, /Oggi/)
  await page.getByRole('button', { name: /A · Full Body A/ }).click()
  await page.getByRole('button', { name: /Inizia allenamento/ }).click()
}
// Elementi della modalità allenamento (finestra modale a schermo intero)
const wm = (page) => page.getByRole('dialog', { name: 'Modalità allenamento' })
const serieFatta = (page) => wm(page).getByRole('button', { name: /Serie fatta/ }).click()

test('E2E-03 Full Body A: tutte le serie registrate, RIR, durata corretta dopo refresh', async ({ page }) => {
  await startA(page)
  await wm(page).getByRole('button', { name: /Segna fatto senza timer/ }).click() // riscaldamento
  await expect(wm(page).getByRole('heading', { name: 'Leg Press' })).toBeVisible()
  await expect(wm(page).getByText('Obiettivo: 2 × 10–12 · 60 kg · RIR 3')).toBeVisible()

  await serieFatta(page)
  await expect(wm(page).getByRole('button', { name: 'Salta recupero' })).toBeVisible()
  await wm(page).getByRole('button', { name: 'RIR 2' }).click()
  await page.clock.runFor(121_000) // recupero da 2 minuti: si ferma da solo
  await expect(wm(page).getByRole('button', { name: 'Salta recupero' })).toHaveCount(0)
  await serieFatta(page)
  // ultima serie: si passa al prossimo esercizio ma il RIR resta indicabile per la serie appena fatta
  await expect(wm(page).getByRole('heading', { name: 'Incline Chest Press' })).toBeVisible()
  await wm(page).getByRole('button', { name: 'RIR 3' }).click()
  await page.clock.runFor(121_000)
  for (let i = 0; i < 2; i++) {
    await serieFatta(page)
    await page.clock.runFor(91_000)
  }
  // Plank a tempo: si segna da solo a fine conto alla rovescia
  await expect(wm(page).getByRole('heading', { name: 'Plank' })).toBeVisible()
  await wm(page).getByRole('button', { name: /Avvia 30s/ }).click()
  await page.clock.runFor(31_000)
  await page.clock.runFor(61_000)
  await wm(page).getByRole('button', { name: /Avvia 30s/ }).click()
  await page.clock.runFor(31_000)
  await wm(page).getByRole('button', { name: /Segna fatto senza timer/ }).click() // defaticamento
  await expect(wm(page).getByText('Allenamento completato!')).toBeVisible()
  await wm(page).getByRole('button', { name: /e chiudi/ }).click()
  await waitSaved(page)

  const s = (await savedState(page)).sessions[0]
  expect(s.status).toBe('completed')
  expect(s.exercises.every((e) => e.sets.every((x) => x.done))).toBe(true)
  expect(s.exercises[0].sets.map((x) => x.rir)).toEqual([2, 3])
  expect(s.exercises[2].sets.map((x) => x.durationSec)).toEqual([30, 30])
  expect(s.durationSource).toBe('computed')
  expect(s.durationMin).toBe(9) // 547 s di attività simulata
  expect(Date.parse(s.endedAt) - Date.parse(s.startedAt)).toBeGreaterThan(540_000)

  await page.reload()
  await nav(page, /Allenamenti/)
  await tab(page, 'Seduta')
  await expect(main(page)).toContainText('Durata: 9 min')
  await expect(main(page)).toContainText('da orari inizio/fine')
})

test('E2E-04 modifica della scheda A già usata: nuova revisione, prima seduta invariata', async ({ page }) => {
  await startA(page)
  await wm(page).getByRole('button', { name: /Segna fatto senza timer/ }).click()
  await serieFatta(page)
  await wm(page).getByRole('button', { name: /Esci/ }).click()
  await waitSaved(page)
  const before = (await savedState(page)).sessions[0]

  await tab(page, 'Schede')
  await page.getByRole('button', { name: 'Modifica' }).first().click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Nome esercizio').first().fill('Leg Press 45°')
  await expect(dlg).toContainText('Revisione 2')
  await dlg.getByLabel('Chiudi').click()
  await waitSaved(page)

  const s = await savedState(page)
  expect(s.sessions[0]).toEqual(before)
  expect(s.workoutTemplates.find((t) => t.id === 'full-body-a')).toMatchObject({ revision: 2 })
  await tab(page, 'Seduta')
  await expect(main(page)).toContainText('revisione 1 (attuale: 2)')
  await expect(main(page)).not.toContainText('Leg Press 45°')
})

test('E2E-13 (emulato) app in background e poi chiusa durante il recupero: nessuna serie persa o duplicata', async ({ page, context }) => {
  await startA(page)
  await wm(page).getByRole('button', { name: /Segna fatto senza timer/ }).click()
  await serieFatta(page)
  await waitSaved(page)
  // schermo spento / app in background
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.runFor(150_000)
  await page.close() // il sistema chiude l'app

  const p2 = await context.newPage()
  p2.on('dialog', (d) => d.accept())
  await p2.clock.install({ time: new Date(NOW.getTime() + 160_000) })
  await p2.goto('/')
  // la modalità allenamento riprende dov'era, il recupero è terminato
  await expect(wm(p2).getByRole('heading', { name: 'Leg Press' })).toBeVisible()
  await expect(wm(p2).getByText(/Serie 2 di 2/)).toBeVisible()
  await expect(wm(p2).getByRole('button', { name: 'Salta recupero' })).toHaveCount(0)
  const s = (await savedState(p2)).sessions[0]
  expect(s.exercises[0].sets.map((x) => x.done)).toEqual([true, false])
  await wm(p2).getByRole('button', { name: /Serie fatta/ }).click()
  await waitSaved(p2)
  expect((await savedState(p2)).sessions[0].exercises[0].sets.map((x) => x.done)).toEqual([true, true])
})
