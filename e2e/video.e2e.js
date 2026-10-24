// Registrazione video delle interazioni dell'Alimentazione (consegna CR-UX-ALIM-002). Non è un test funzionale.
// Uso: VIDEO=docs/ui-audit/cr-alim-002 npx playwright test e2e/video.e2e.js
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { openApp, nav, main, goImport, importFile, waitSaved, EX, ROOT, readJSON } from './helpers'

const OUT = process.env.VIDEO
for (const [name, viewport, isMobile, theme] of [
  ['390-light', { width: 390, height: 844 }, true, 'light'],
  ['1280-dark', { width: 1280, height: 800 }, false, 'dark'],
]) {
  test.describe(`video ${name}`, () => {
    test.skip(!OUT, 'solo con VIDEO=<cartella>')
    test(`interazioni ${name}`, async ({ browser }, info) => {
      // contesto dedicato: la registrazione video non si può attivare per singolo gruppo di test
      const context = await browser.newContext({
        viewport,
        isMobile,
        hasTouch: isMobile,
        colorScheme: theme,
        locale: 'it-IT',
        timezoneId: 'Europe/Rome',
        baseURL: info.project.use.baseURL,
        recordVideo: { dir: info.outputPath('video'), size: viewport },
      })
      const page = await context.newPage()
      const pause = (ms = 900) => page.waitForTimeout(ms)
      const file = info.outputPath('piano.json')
      fs.writeFileSync(file, JSON.stringify({ ...readJSON(EX('piano-alimentare-v4.json')), validFrom: null, validTo: null }))
      await openApp(page, { clock: false })
      await goImport(page)
      await importFile(page, file)
      await nav(page, /Alimentazione/)
      await main(page).getByRole('button', { name: 'Imposta attivo' }).click()
      await waitSaved(page)
      await pause(1200)
      // 1. cambio giorno (avanti e indietro)
      const days = main(page).getByRole('navigation', { name: 'Giorno del piano' }).getByRole('button')
      await days.nth(2).click()
      await pause()
      await days.nth(4).click()
      await pause()
      await days.nth(1).click()
      await pause()
      // 2. espansione e chiusura dei dettagli
      const first = main(page).getByRole('article').first()
      await first.getByRole('button', { name: 'Dettagli', exact: true }).click()
      await pause(1200)
      await first.getByRole('button', { name: 'Dettagli', exact: true }).click()
      await pause()
      // 3. scelta di un'alternativa: anteprima, poi salvataggio
      const alt = first.getByRole('group').getByRole('button').nth(1)
      await alt.click()
      await pause(1200)
      await first.getByRole('button', { name: /Scegli per questa data/ }).click()
      await pause(1200)
      // 4. registrazione del pasto
      await first.getByRole('button', { name: 'Segna consumato' }).click()
      await pause(1400)
      // 5. apertura e chiusura di "Gestisci piano"
      await main(page).getByRole('button', { name: 'Gestisci piano' }).click()
      await pause(1400)
      await page.keyboard.press('Escape')
      await pause(1000)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      const video = page.video()
      await context.close()
      fs.mkdirSync(path.join(ROOT, OUT), { recursive: true })
      await video.saveAs(path.join(ROOT, OUT, `interazioni-${name}.webm`))
    })
  })
}
