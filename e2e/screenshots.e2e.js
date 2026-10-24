// Screenshot delle schermate principali per l'audit UI e il "prima/dopo" delle PR (non è un test funzionale).
// Uso: SHOTS=docs/ui-audit/after npx playwright test e2e/screenshots.e2e.js   (facoltativi: SHOTS_THEMES=light,dark SHOTS_WIDTHS=375,768,1440)
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { openApp, nav, tab, main, goImport, importFile, waitSaved, EX, ROOT } from './helpers'

const OUT = process.env.SHOTS
const ALL_WIDTHS = [
  { name: '375', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
  { name: '768', viewport: { width: 768, height: 1024 }, isMobile: false, hasTouch: true },
  { name: '1440', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
]
const WIDTHS = ALL_WIDTHS.filter((w) => !process.env.SHOTS_WIDTHS || process.env.SHOTS_WIDTHS.split(',').includes(w.name))
const THEMES = (process.env.SHOTS_THEMES ?? 'light,dark').split(',')

for (const w of WIDTHS) {
  for (const theme of THEMES) {
    test.describe(`${w.name} ${theme}`, () => {
      test.skip(!OUT, 'solo con SHOTS=<cartella>')
      test.use({ viewport: w.viewport, isMobile: w.isMobile, hasTouch: w.hasTouch, colorScheme: theme, deviceScaleFactor: 1 })
      test(`schermate ${w.name} ${theme}`, async ({ page }) => {
        const shot = async (name) => {
          await page.waitForTimeout(350) // fine delle transizioni
          await page.screenshot({ path: path.join(ROOT, OUT, `${w.name}-${theme}-${name}.jpg`), type: 'jpeg', quality: 70, fullPage: true })
        }
        await openApp(page)
        await shot('01-oggi-vuoto')
        await goImport(page)
        await shot('02-importa')
        for (const f of ['programma-ab.json', 'piano-alimentare-v4.json', 'misure.json', 'nuoto-2026-10-21.json']) await importFile(page, EX(f))
        await nav(page, /Alimentazione/)
        await main(page).getByRole('button', { name: 'Imposta attivo' }).click()
        await waitSaved(page)
        await shot('03-alimentazione')
        await nav(page, /Oggi/)
        await shot('04-oggi')
        await page.getByRole('button', { name: /A · Full Body A/ }).click()
        await shot('05-seduta')
        await page.getByRole('button', { name: /Inizia allenamento/ }).click()
        await expect(page.getByRole('dialog', { name: 'Modalità allenamento' })).toBeVisible()
        await shot('06-modalita-allenamento')
        await page.getByRole('dialog', { name: 'Modalità allenamento' }).getByRole('button', { name: /Chiudi|Esci/ }).first().click()
        await tab(page, 'Calendario')
        await shot('07-calendario')
        await tab(page, 'Schede')
        await shot('08-schede')
        await tab(page, 'Storico')
        await shot('09-storico')
        await page.getByRole('button', { name: 'Apri' }).last().click()
        await shot('10-nuoto')
        await nav(page, /Progressi/)
        await shot('11-progressi')
        await nav(page, /Altro/)
        await shot('12-altro')
      })
    })
  }
}

// CR-UX-ALIM-001: Alimentazione "above the fold" (solo l'area visibile, senza scorrere)
const DIET_WIDTHS = [
  { name: '390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: '1280', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false },
]
for (const w of DIET_WIDTHS) {
  for (const theme of THEMES) {
    test.describe(`alimentazione ${w.name} ${theme}`, () => {
      test.skip(!OUT, 'solo con SHOTS=<cartella>')
      test.use({ viewport: w.viewport, isMobile: w.isMobile, hasTouch: w.hasTouch, colorScheme: theme, deviceScaleFactor: 1 })
      test(`alimentazione ${w.name} ${theme}`, async ({ page }) => {
        await openApp(page)
        await goImport(page)
        await importFile(page, EX('piano-alimentare-v4.json'))
        await nav(page, /Alimentazione/)
        const activate = main(page).getByRole('button', { name: 'Imposta attivo' })
        if (await activate.count()) await activate.click()
        await waitSaved(page)
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.waitForTimeout(400)
        const file = (k) => path.join(ROOT, OUT, `alimentazione-${w.name}-${theme}${k}.jpg`)
        await page.screenshot({ path: file(''), type: 'jpeg', quality: 75 })
        await page.screenshot({ path: file('-intera'), type: 'jpeg', quality: 70, fullPage: true })
      })
    })
  }
}
