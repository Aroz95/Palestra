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
