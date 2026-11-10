// E2E-03 seduta completa con timer · E2E-04 revisione della scheda · E2E-13 app in background/chiusa (emulazione)
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
// Fine allenamento dalla schermata finale della modalità allenamento: seduta salvata → conferma → riepilogo
async function finishWorkout(page) {
  await wm(page).getByRole('button', { name: /^Termina allenamento \(/ }).click()
  await page.getByRole('dialog', { name: 'Allenamento salvato' }).getByRole('button', { name: 'Conferma e concludi' }).click()
  await expect(main(page).getByTestId('session-summary')).toBeVisible()
  await waitSaved(page)
}

test('E2E-03 Full Body A: tutte le serie registrate, durata corretta dopo refresh', async ({ page }) => {
  await startA(page)
  await wm(page).getByRole('button', { name: /Segna fatto senza timer/ }).click() // riscaldamento
  await expect(wm(page).getByRole('heading', { name: 'Leg Press' })).toBeVisible()
  await expect(wm(page)).toContainText('Obiettivo 2 × 10–12 · 60 kg') // senza RIR in modalità allenamento
  await expect(wm(page)).not.toContainText('RIR 3')

  await serieFatta(page)
  await expect(wm(page).getByRole('button', { name: 'Salta recupero' })).toBeVisible()
  await expect(wm(page).getByRole('button', { name: /^RIR/ })).toHaveCount(0) // RIR non più richiesto
  await page.clock.runFor(121_000) // recupero da 2 minuti: si ferma da solo
  await expect(wm(page).getByRole('button', { name: 'Salta recupero' })).toHaveCount(0)
  await serieFatta(page)
  await expect(wm(page).getByRole('heading', { name: 'Incline Chest Press' })).toBeVisible()
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
  await finishWorkout(page)

  const s = (await savedState(page)).sessions[0]
  expect(s.status).toBe('completed')
  expect(s.exercises.every((e) => e.sets.every((x) => x.done))).toBe(true)
  expect(s.exercises[0].sets.map((x) => x.rir)).toEqual([null, null])
  expect(s.exercises[2].sets.map((x) => x.durationSec)).toEqual([30, 30])
  // riscaldamento da 10 min segnato "fatto senza timer": incluso nella seduta (inizio anticipato), una sola volta
  expect(s.durationSource).toBe('stopwatch')
  expect(s.durationMin).toBe(19) // 10 min di riscaldamento + 547 s di attività simulata
  expect(Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000)).toBe(19)

  await page.reload()
  // conclusa: non resta aperta, si consulta dallo storico
  await nav(page, /Allenamenti/)
  await tab(page, 'Storico')
  await page.getByRole('button', { name: 'Apri' }).first().click()
  await expect(main(page)).toContainText('Durata: 19 min')
  await expect(main(page)).toContainText('da cronometro della seduta')
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

test('durata: riscaldamento a tempo, pausa e defaticamento → durata = cronometro, inizio all’avvio del riscaldamento', async ({ page }) => {
  await startA(page)
  const t0 = await page.evaluate(() => Date.now())
  await wm(page).getByRole('button', { name: /Avvia 10 min/i }).click() // riscaldamento con il timer
  await page.clock.runFor(601_000)
  await expect(wm(page).getByRole('heading', { name: 'Leg Press' })).toBeVisible()
  let s = (await savedState(page)).sessions[0]
  expect(Math.abs(Date.parse(s.startedAt) - t0)).toBeLessThan(2000) // inizio = avvio del riscaldamento, non la sua fine
  // pausa di 5 minuti del cronometro della seduta
  await wm(page).getByRole('button', { name: /Tempo totale .*metti in pausa/ }).click()
  await page.clock.runFor(300_000)
  await wm(page).getByRole('button', { name: /Tempo totale .*riprendi/ }).click()
  // esercizi
  for (let i = 0; i < 4; i++) {
    await serieFatta(page)
    await page.clock.runFor(121_000)
  }
  await wm(page).getByRole('button', { name: /Avvia 30s/ }).click()
  await page.clock.runFor(31_000)
  await page.clock.runFor(61_000)
  await wm(page).getByRole('button', { name: /Avvia 30s/ }).click()
  await page.clock.runFor(31_000)
  // defaticamento a tempo (5 min)
  await wm(page).getByRole('button', { name: /Avvia 5 min/i }).click()
  await page.clock.runFor(301_000)
  await expect(wm(page).getByText('Allenamento completato!')).toBeVisible()
  await finishWorkout(page)
  s = (await savedState(page)).sessions[0]
  const wall = (Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000
  expect(s.durationSource).toBe('stopwatch')
  expect(s.durationMin).toBe(Math.round(wall - 5)) // tutto il tempo effettivo, pausa esclusa
  // cronometro fermo dopo il completamento
  const sw = await page.evaluate(() => JSON.parse(localStorage.getItem('palestra:stopwatch')))
  expect(sw.startedAt).toBeNull()
  expect(Math.round(sw.accumulated / 60000)).toBe(s.durationMin)
  await nav(page, /Allenamenti/)
  await tab(page, 'Storico')
  await page.getByRole('button', { name: 'Apri' }).first().click()
  await expect(main(page)).toContainText(`Durata: ${s.durationMin} min`)
  await expect(main(page)).toContainText('pause escluse: 5 min')
})

test('durata: "Completata" dallo stato chiude la seduta come "Termina" (cronometro fermato, fine registrata)', async ({ page }) => {
  await startA(page)
  await wm(page).getByRole('button', { name: /Segna fatto senza timer/ }).click()
  await serieFatta(page)
  await page.clock.runFor(120_000)
  await wm(page).getByRole('button', { name: /Esci/ }).click()
  await main(page).getByLabel('Stato seduta').selectOption('completed')
  await page.getByRole('dialog', { name: 'Allenamento non completo' }).getByRole('button', { name: 'Concludi comunque' }).click()
  await page.getByRole('dialog', { name: 'Allenamento salvato' }).getByRole('button', { name: 'Conferma e concludi' }).click()
  await waitSaved(page)
  const s = (await savedState(page)).sessions[0]
  expect(s.status).toBe('completed')
  expect(s.endedAt).toBeTruthy()
  expect(s.durationMin).toBe(12) // 10 min di riscaldamento + 2 min
  const sw = await page.evaluate(() => JSON.parse(localStorage.getItem('palestra:stopwatch')))
  expect(sw.startedAt).toBeNull()
})

test('pesi: la seduta successiva parte dai carichi effettivi della precedente, non dai valori della scheda', async ({ page }) => {
  await openApp(page)
  await goImport(page)
  await importFile(page, EX('programma-ab.json'))
  await nav(page, /Oggi/)
  await page.getByRole('button', { name: /A · Full Body A/ }).click()
  const card = main(page).locator('div.rounded-2xl').filter({ hasText: 'Leg Press' }).first()
  const inc = card.getByRole('button', { name: 'Aumenta' })
  for (let i = 0; i < 4; i++) await inc.nth(0).click() // serie 1: 60 → 70
  for (let i = 0; i < 4; i++) await inc.nth(2).click() // serie 2: 60 → 70
  await card.getByRole('button', { name: 'Tutte fatte' }).click()
  await main(page).getByRole('button', { name: /Termina seduta/ }).click()
  await page.getByRole('dialog', { name: 'Allenamento non completo' }).getByRole('button', { name: 'Concludi comunque' }).click()
  await page.getByRole('dialog', { name: 'Allenamento salvato' }).getByRole('button', { name: 'Conferma e concludi' }).click()
  await waitSaved(page)
  await page.clock.runFor(2 * 86_400_000) // due giorni dopo
  await nav(page, /Oggi/)
  await page.getByRole('button', { name: /A · Full Body A/ }).click()
  await waitSaved(page)
  const st = await savedState(page)
  const next = st.sessions.find((s) => s.id === st.activeSessionId)
  expect(next.exercises[0].sets.map((s) => [s.weight, s.done])).toEqual([[70, false], [70, false]])
  expect(next.exercises[0].target.weightKg).toBe(60)
})

test('modalità allenamento: + Serie (cerchio), nota dal pannello “Ultima volta”, modifica di una serie fatta', async ({ page }) => {
  await startA(page)
  await wm(page).getByRole('button', { name: /Segna fatto senza timer/ }).click() // riscaldamento
  await expect(wm(page).getByRole('heading', { name: 'Leg Press' })).toBeVisible()
  await expect(wm(page).getByText('Serie 1 di 2')).toBeVisible()
  await wm(page).getByRole('button', { name: 'Aggiungi serie' }).click()
  await expect(wm(page).getByText('Serie 1 di 3')).toBeVisible()
  // nota: nel pannello "Ultima volta" (non ci sono più pulsanti Nota / Annulla sotto)
  await expect(wm(page).getByRole('button', { name: /Nota|Annulla/ })).toHaveCount(0)
  await wm(page).getByTestId('previous-line').click()
  const sheet = page.getByRole('dialog', { name: 'Ultima volta · Leg Press' })
  await expect(sheet).toContainText('Nessuna esecuzione precedente')
  await sheet.getByLabel('Nota Leg Press').fill('sedile 4')
  await sheet.getByRole('button', { name: 'Fatto' }).click()
  await expect(wm(page).getByTestId('previous-line')).toContainText('✎ oggi')
  // serie fatta → si tocca e si corregge
  await wm(page).getByRole('button', { name: /Serie fatta/ }).click()
  await wm(page).getByRole('button', { name: 'Salta recupero' }).click()
  await wm(page).getByRole('button', { name: 'Modifica serie 1: 12 × 60 kg' }).click()
  const edit = page.getByRole('dialog', { name: 'Serie 1 · Leg Press' })
  await edit.getByRole('button', { name: 'Diminuisci' }).last().click() // ripetizioni 12 → 11
  await edit.getByRole('button', { name: 'Fatto' }).click()
  await expect(wm(page).getByRole('button', { name: 'Modifica serie 1: 11 × 60 kg' })).toBeVisible()
  await expect(wm(page).getByText('Serie 2 di 3')).toBeVisible()
  await waitSaved(page)
  let ex = (await savedState(page)).sessions[0].exercises[0]
  expect(ex.notes).toBe('sedile 4')
  expect(ex.sets).toHaveLength(3)
  expect(ex.sets[0]).toMatchObject({ done: true, weight: 60, reps: 11 })
  expect(ex.sets[1]).toMatchObject({ done: false, weight: 60, reps: 12 }) // le serie da fare non cambiano
  expect(ex.sets[2]).toMatchObject({ done: false, weight: 60, reps: 12 })
  // e si può riportare da fare dallo stesso pannello
  await wm(page).getByRole('button', { name: /Modifica serie 1/ }).click()
  await page.getByRole('dialog', { name: 'Serie 1 · Leg Press' }).getByRole('button', { name: 'Segna come non fatta' }).click()
  await expect(wm(page).getByText('Serie 1 di 3')).toBeVisible()
  await waitSaved(page)
  ex = (await savedState(page)).sessions[0].exercises[0]
  expect(ex.sets[0].done).toBe(false)
})
