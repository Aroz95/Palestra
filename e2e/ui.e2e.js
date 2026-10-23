// Restyle UI (docs/ui-audit.md): tema, focus nei pannelli, movimento ridotto, reflow a 320 px
import { test, expect } from '@playwright/test'
import { openApp, nav, tab, main, goImport, importFile, EX } from './helpers'

const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

test('tema chiaro/scuro: scelta salvata sul dispositivo e applicata prima del disegno', async ({ page }) => {
  await openApp(page)
  await nav(page, /Altro/)
  await tab(page, 'Opzioni')
  await page.getByRole('tab', { name: 'Scuro', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(await bg()).toBe('rgb(16, 25, 29)')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await nav(page, /Altro/)
  await page.getByRole('tab', { name: 'Chiaro', exact: true }).click()
  expect(await bg()).toBe('rgb(246, 248, 249)')
  await page.getByRole('tab', { name: 'Automatico', exact: true }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./)
})

test('pannello: focus all’interno, Tab ciclico, Esc chiude e ripristina il focus', async ({ page }) => {
  await openApp(page)
  await goImport(page)
  await importFile(page, EX('programma-ab.json'))
  await nav(page, /Oggi/)
  const opener = main(page).getByRole('button', { name: 'Inizia allenamento' })
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Attività libera' })
  await expect(dialog).toBeFocused()
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test.describe('movimento ridotto', () => {
  test('animazioni e transizioni annullate', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openApp(page)
    const d = await page.evaluate(() => {
      const el = document.querySelector('nav button')
      return { mq: matchMedia('(prefers-reduced-motion: reduce)').matches, t: getComputedStyle(el).transitionDuration }
    })
    expect(d.mq).toBe(true)
    expect(parseFloat(d.t)).toBeLessThan(0.001)
  })
})

test.describe('reflow 320 px', () => {
  test.use({ viewport: { width: 320, height: 640 } })
  test('nessuno scorrimento orizzontale nelle schermate principali', async ({ page }) => {
    await openApp(page)
    await goImport(page)
    for (const f of ['programma-ab.json', 'piano-alimentare-v4.json', 'misure.json']) await importFile(page, EX(f))
    await nav(page, /Oggi/)
    expect(await noHorizontalScroll(page)).toBe(true)
    await page.getByRole('button', { name: /A · Full Body A/ }).click()
    expect(await noHorizontalScroll(page)).toBe(true)
    for (const t of ['Calendario', 'Schede', 'Storico']) {
      await tab(page, t)
      expect(await noHorizontalScroll(page), t).toBe(true)
    }
    for (const n of [/Alimentazione/, /Progressi/, /Altro/]) {
      await nav(page, n)
      expect(await noHorizontalScroll(page), String(n)).toBe(true)
    }
  })
})
