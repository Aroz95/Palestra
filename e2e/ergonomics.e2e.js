// EXE-02 chiusura automatica delle card completate · MOB-01 pinch-zoom e spostamenti su mobile
import { test, expect } from '@playwright/test'
import { openApp, nav, tab, main, goImport, importFile, savedState, waitSaved, EX } from './helpers'

async function startA(page) {
  await openApp(page)
  await goImport(page)
  await importFile(page, EX('programma-ab.json'))
  await nav(page, /Oggi/)
  await page.getByRole('button', { name: /A · Full Body A/ }).click()
}
const header = (page, name) => main(page).locator('[id^="exercise-"]').filter({ hasText: name }).first().locator('button[aria-expanded]').first()
const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

test('EXE-02: ultima serie → card chiusa con sintesi; riapertura manuale e annullamento coerenti', async ({ page }) => {
  await startA(page)
  const leg = header(page, 'Leg Press')
  await expect(leg).toHaveAttribute('aria-expanded', 'true')
  await main(page).getByRole('button', { name: 'Serie 1: segna come fatta' }).first().click()
  await expect(leg).toHaveAttribute('aria-expanded', 'true') // non ancora completo
  // regressione: la prima serie spuntata (che avvia il cronometro e fissa l'inizio) non va persa
  await waitSaved(page)
  const s1 = (await savedState(page)).sessions[0]
  expect(s1.exercises[0].sets[0].done).toBe(true)
  expect(s1.startedAt).toBeTruthy()
  await main(page).getByRole('button', { name: 'Serie 2: segna come fatta' }).first().click()
  await expect(leg).toHaveAttribute('aria-expanded', 'false')
  await expect(leg).toContainText('2/2')
  await expect(leg).toContainText('2 × 12 · 60 kg') // sintesi di carichi e ripetizioni
  // il prossimo esercizio è subito raggiungibile
  await expect(header(page, 'Incline Chest Press')).toBeInViewport()
  // riapertura manuale: resta aperta; annullando una serie la card torna incompleta e aperta
  await leg.click()
  await expect(leg).toHaveAttribute('aria-expanded', 'true')
  await main(page).getByRole('button', { name: 'Serie 2: segna come non fatta' }).first().click()
  await expect(leg).toHaveAttribute('aria-expanded', 'true')
  await expect(leg).toContainText('1/2')
  // seduta ripresa dopo ricaricamento: le card complete partono chiuse
  await main(page).getByRole('button', { name: 'Serie 2: segna come fatta' }).first().click()
  await page.reload()
  await nav(page, /Allenamenti/)
  await tab(page, 'Seduta')
  await expect(header(page, 'Leg Press')).toHaveAttribute('aria-expanded', 'false')
})

test('MOB-01: pinch bloccato (touch-action e gesture di Safari), disattivabile; scorrimento verticale invariato', async ({ page }) => {
  await startA(page)
  const state = () =>
    page.evaluate(() => {
      const e = new Event('gesturestart', { cancelable: true })
      document.dispatchEvent(e)
      return { touch: getComputedStyle(document.documentElement).touchAction, prevented: e.defaultPrevented }
    })
  expect(await state()).toEqual({ touch: 'pan-x pan-y', prevented: true })
  // un normale touchmove non viene bloccato
  expect(await page.evaluate(() => {
    const e = new Event('touchmove', { cancelable: true })
    document.dispatchEvent(e)
    return e.defaultPrevented
  })).toBe(false)
  await page.mouse.wheel(0, 600)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  // opzione di accessibilità
  await nav(page, /Altro/)
  await tab(page, 'Opzioni')
  await page.getByRole('switch', { name: 'Blocca lo zoom con due dita' }).click()
  expect(await state()).toEqual({ touch: 'auto', prevented: false })
  await page.reload()
  expect(await state()).toEqual({ touch: 'auto', prevented: false })
})

for (const width of [320, 375, 390, 430]) {
  test(`MOB-01: nessuno scorrimento orizzontale a ${width} px (seduta e modalità allenamento)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await startA(page)
    expect(await noHorizontalScroll(page)).toBe(true)
    await page.getByRole('button', { name: /Inizia allenamento/ }).click()
    expect(await noHorizontalScroll(page)).toBe(true)
  })
}

// Dettaglio dell'esercizio in modalità allenamento: tutto in una schermata, senza scorrere, su telefoni piccoli e
// grandi, tablet e in orizzontale; con "Ultima volta", nota di oggi e durante il recupero
for (const [w, h] of [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024], [844, 390], [667, 375]]) {
  test(`modalità allenamento senza scorrimento a ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await openApp(page)
    await goImport(page)
    await importFile(page, EX('programma-ab.json'))
    await nav(page, /Oggi/)
    await page.getByRole('button', { name: /A · Full Body A/ }).click()
    await main(page).getByLabel('Note Leg Press').fill('sedile 4, schienale 2')
    await main(page).getByRole('button', { name: 'Tutte fatte' }).first().click()
    await main(page).getByRole('button', { name: /Termina seduta/ }).click()
    await page.getByRole('button', { name: 'Concludi comunque' }).click()
    await page.getByRole('button', { name: 'Conferma e concludi' }).click()
    await page.clock.runFor(2 * 86_400_000)
    await nav(page, /Oggi/)
    await page.getByRole('button', { name: /A · Full Body A/ }).click()
    await page.getByRole('button', { name: /Inizia allenamento/ }).click()
    const wm = page.getByRole('dialog', { name: 'Modalità allenamento' })
    await wm.getByRole('button', { name: /Segna fatto senza timer/ }).click()
    await wm.getByTestId('previous-line').click()
    await page.getByLabel('Nota Leg Press').fill('oggi più leggero')
    await page.getByRole('button', { name: 'Fatto' }).click()
    await expect(page.getByRole('dialog', { name: 'Ultima volta · Leg Press' })).toHaveCount(0)
    const overflow = () => page.evaluate(() => {
      const el = document.querySelector('[aria-label="Modalità allenamento"] .overflow-y-auto')
      return el.scrollHeight - el.clientHeight
    })
    expect(await overflow()).toBeLessThanOrEqual(0)
    await expect(wm.getByRole('button', { name: /Serie fatta/ })).toBeInViewport({ ratio: 1 })
    await wm.getByRole('button', { name: /Serie fatta/ }).click()
    await expect(wm.getByRole('button', { name: 'Salta recupero' })).toBeVisible()
    expect(await overflow()).toBeLessThanOrEqual(0)
    for (const name of ['−15s', 'Salta recupero', 'Aggiungi serie', 'Modifica serie 1: 12 × 60 kg', 'Passo successivo']) await expect(wm.getByRole('button', { name })).toBeInViewport({ ratio: 1 })
    // esercizio a tempo: pulsante grande + "Segna fatta senza timer" (prima debordava di 16 px a 375x667)
    await wm.getByRole('button', { name: 'Salta recupero' }).click()
    await wm.getByLabel('Vai al passo').selectOption({ label: '4. Plank' })
    await expect(wm.getByRole('button', { name: /Avvia 30s/ })).toBeVisible()
    expect(await overflow()).toBeLessThanOrEqual(0)
    await expect(wm.getByRole('button', { name: /Segna fatta senza timer/ })).toBeInViewport({ ratio: 1 })
  })
}

test('pannello a schermo intero: la pagina sotto non scorre (niente barra di iOS) e torna alla stessa posizione', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openApp(page)
  await goImport(page)
  await importFile(page, EX('programma-ab.json'))
  await nav(page, /Oggi/)
  await page.getByRole('button', { name: /A · Full Body A/ }).click()
  // pagina scorsa in basso, poi avvio senza che il clic riporti il pulsante in vista
  const y = await page.evaluate(() => {
    window.scrollTo(0, 300)
    const y = Math.round(window.scrollY)
    ;[...document.querySelectorAll('button')].find((b) => /Inizia allenamento/.test(b.textContent)).click()
    return y
  })
  expect(y).toBeGreaterThan(0)
  const wm = page.getByRole('dialog', { name: 'Modalità allenamento' })
  await expect(wm).toBeVisible()
  // pagina bloccata nella posizione corrente; il pannello non passa lo scorrimento alla pagina
  expect(await page.evaluate(() => [document.body.style.position, document.body.style.top])).toEqual(['fixed', `-${y}px`])
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[aria-label="Modalità allenamento"] .overflow-y-auto')).overscrollBehaviorY)).toBe('contain')
  await page.mouse.move(195, 400)
  await page.mouse.wheel(0, 800)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true)
  // un pannello sopra l'altro: il blocco resta finché si chiude l'ultimo
  await wm.getByLabel('Vai al passo').selectOption({ label: '2. Leg Press' })
  await wm.getByTestId('previous-line').click()
  await expect(page.getByRole('dialog', { name: 'Ultima volta · Leg Press' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /^Ultima volta/ })).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.position)).toBe('fixed')
  await wm.getByRole('button', { name: /Esci/ }).click()
  expect(await page.evaluate(() => [document.body.style.position, Math.round(window.scrollY)])).toEqual(['', y])
})
