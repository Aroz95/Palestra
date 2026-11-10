// SES-01 fine allenamento · EXE-01 ultima esecuzione e note · TIM-01 recupero scelto con ±15 s
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { openApp, nav, tab, main, goImport, importFile, savedState, waitSaved, EX } from './helpers'

const wm = (page) => page.getByRole('dialog', { name: 'Modalità allenamento' })
const savedSheet = (page) => page.getByRole('dialog', { name: 'Allenamento salvato' })

async function startA(page) {
  await nav(page, /Oggi/)
  await page.getByRole('button', { name: /A · Full Body A/ }).click()
}

test('SES-01 + TIM-01 + EXE-01: seduta parziale, recupero 2:00 → 1:30, fine con export, riepilogo, seduta successiva', async ({ page }) => {
  await openApp(page)
  await goImport(page)
  await importFile(page, EX('programma-ab.json'))
  await startA(page)
  // nota dell'esercizio nella seduta di oggi
  await main(page).getByLabel('Note Leg Press').fill('sedile 4')
  await page.getByRole('button', { name: /Inizia allenamento/ }).click()
  await wm(page).getByRole('button', { name: /Segna fatto senza timer/ }).click() // riscaldamento
  await expect(wm(page).getByTestId('previous-line')).toContainText('nessuna esecuzione')
  await wm(page).getByRole('button', { name: /Serie fatta/ }).click()
  // recupero di Leg Press 2:00 → −15 −15 = 1:30
  await wm(page).getByRole('button', { name: '−15s' }).click()
  await wm(page).getByRole('button', { name: '−15s' }).click()
  await waitSaved(page)
  let st = await savedState(page)
  expect(st.sessions[0].exercises[0]).toMatchObject({ rest: 90, restChosen: true })
  expect(st.sessions[0].exercises[1].restChosen).toBeUndefined() // gli altri esercizi non cambiano

  // Termina con serie mancanti: avviso, si può tornare alla seduta
  await wm(page).getByRole('button', { name: 'Termina allenamento' }).click()
  const warn = page.getByRole('dialog', { name: 'Allenamento non completo' })
  await expect(warn).toContainText('non sono state completate')
  await warn.getByRole('button', { name: 'Torna alla seduta' }).click()
  await expect(wm(page)).toBeVisible()
  await wm(page).getByRole('button', { name: 'Termina allenamento' }).click()
  await warn.getByRole('button', { name: 'Concludi comunque' }).click()

  // seduta già salvata come completata, senza segnare come fatte le serie mancanti; timer fermi
  await expect(savedSheet(page)).toBeVisible()
  await expect(wm(page)).toHaveCount(0)
  await waitSaved(page)
  st = await savedState(page)
  expect(st.sessions).toHaveLength(1)
  expect(st.sessions[0].status).toBe('completed')
  expect(st.sessions[0].exercises[0].sets.map((x) => x.done)).toEqual([true, false])
  expect(st.activeSessionId).toBeNull()
  const sw = await page.evaluate(() => JSON.parse(localStorage.getItem('palestra:stopwatch')))
  expect(sw.startedAt).toBeNull()
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('palestra:rest')))).endsAt).toBeNull()

  // esportazione facoltativa: JSON della singola seduta, stesso id
  const [dl] = await Promise.all([page.waitForEvent('download'), savedSheet(page).getByRole('button', { name: /Esporta allenamento/ }).click()])
  const json = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'))
  expect(json.type).toBe('palestra-seduta')
  expect(json.session.id).toBe(st.sessions[0].id)
  await expect(savedSheet(page)).toContainText('File generato')
  await savedSheet(page).getByRole('button', { name: 'Conferma e concludi' }).click()

  // riepilogo, poi storico
  const summary = main(page).getByTestId('session-summary')
  await expect(summary).toContainText('Allenamento concluso')
  await expect(summary).toContainText('1/6')
  await expect(summary).toContainText('Recupero scelto: 01:30')
  await summary.getByRole('button', { name: 'Vai allo storico' }).click()
  await expect(page.getByRole('tab', { name: 'Storico', exact: true })).toHaveAttribute('aria-selected', 'true')

  // seduta successiva: ultima volta, note e recupero 1:30
  await page.clock.runFor(2 * 86_400_000)
  await page.reload()
  await startA(page)
  const prev = main(page).getByTestId('previous-performance').first()
  await expect(prev).toContainText('Ultima volta')
  await expect(prev).toContainText('60 kg')
  await expect(prev).toContainText('“sedile 4”')
  await expect(prev).toContainText('Recupero scelto: 01:30')
  await expect(main(page)).toContainText('(scelto l’ultima volta)')
  st = await savedState(page)
  const next = st.sessions.find((s) => s.id === st.activeSessionId)
  expect(next.exercises[0]).toMatchObject({ rest: 90, notes: '' })
  expect(next.exercises[0].sets.every((x) => !x.done)).toBe(true)
  await page.getByRole('button', { name: /Inizia allenamento/ }).click()
  await wm(page).getByRole('button', { name: /Segna fatto senza timer/ }).click()
  // modalità allenamento: riga compatta "Ultima volta"; il dettaglio con le note si apre toccandola
  await expect(wm(page).getByTestId('previous-line')).toContainText('nota')
  await wm(page).getByTestId('previous-line').click()
  await expect(page.getByRole('dialog', { name: 'Ultima volta · Leg Press' })).toContainText('“sedile 4”')
  await page.keyboard.press('Escape')
  await wm(page).getByRole('button', { name: /Serie fatta/ }).click()
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('palestra:rest')))).duration).toBe(90)
})

test('SES-01: chiudere la finestra senza confermare porta al riepilogo; esportazione non riuscita si può ripetere', async ({ page }) => {
  await openApp(page)
  await goImport(page)
  await importFile(page, EX('programma-ab.json'))
  await startA(page)
  await main(page).getByRole('button', { name: /Termina seduta/ }).click()
  await page.getByRole('dialog', { name: 'Allenamento non completo' }).getByRole('button', { name: 'Concludi comunque' }).click()
  // download non consentito
  await page.evaluate(() => {
    window.__orig = URL.createObjectURL
    URL.createObjectURL = () => {
      throw new Error('download non consentito')
    }
  })
  await savedSheet(page).getByRole('button', { name: /Esporta allenamento/ }).click()
  await expect(savedSheet(page)).toContainText('Esportazione non riuscita: download non consentito')
  await page.evaluate(() => (URL.createObjectURL = window.__orig))
  const [dl] = await Promise.all([page.waitForEvent('download'), savedSheet(page).getByRole('button', { name: /Esporta allenamento/ }).click()])
  expect(dl.suggestedFilename()).toMatch(/\.json$/)
  await page.keyboard.press('Escape')
  await expect(main(page).getByTestId('session-summary')).toBeVisible()
  await waitSaved(page)
  const st = await savedState(page)
  expect(st.sessions).toHaveLength(1)
  expect(st.sessions[0].status).toBe('completed')
  // ricaricando la seduta resta nello storico
  await page.reload()
  await nav(page, /Allenamenti/)
  await tab(page, 'Storico')
  await expect(main(page).getByRole('button', { name: 'Apri' })).toHaveCount(1)
})
