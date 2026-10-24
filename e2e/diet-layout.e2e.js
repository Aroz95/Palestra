// CR-UX-ALIM-001: piano del giorno subito visibile, bozza compatta, giorno conservato, responsive e tastiera
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { openApp, nav, main, goImport, importFile, waitSaved, EX, FIX, readJSON } from './helpers'

// Piano v4 senza periodo di validità: "oggi" (sabato 31/10) è compreso
async function openPlan(page, info, extra = []) {
  const plan = { ...readJSON(EX('piano-alimentare-v4.json')), validFrom: null, validTo: null }
  const file = info.outputPath('piano.json')
  fs.writeFileSync(file, JSON.stringify(plan))
  await openApp(page)
  await goImport(page)
  await importFile(page, file)
  for (const f of extra) await importFile(page, f)
  await nav(page, /Alimentazione/)
  const activate = main(page).getByRole('button', { name: 'Imposta attivo' })
  if (await activate.count()) await activate.click()
}
const heading = (page) => main(page).getByRole('heading', { level: 2 }).first()
const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

test.describe('390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('1-2 giorno e primo pasto visibili senza scorrere; bozza come semplice etichetta', async ({ page }, info) => {
    await openPlan(page, info)
    await page.evaluate(() => window.scrollTo(0, 0))
    const navBar = await page.getByRole('navigation', { name: 'Navigazione principale' }).boundingBox()
    const visibleBottom = navBar.y // sopra la barra di navigazione in basso
    const days = await main(page).getByRole('navigation', { name: 'Giorno del piano' }).boundingBox()
    expect(days.y + days.height).toBeLessThan(visibleBottom)
    await expect(heading(page)).toHaveText('sabato 31 ottobre')
    const firstMeal = await main(page).getByText('Colazione', { exact: true }).first().boundingBox()
    expect(firstMeal.y + firstMeal.height + 40).toBeLessThan(visibleBottom) // nome del pasto e inizio degli alimenti
    // stato bozza: testo accanto al nome del piano, nessuna card dedicata sopra i pasti
    await expect(main(page).getByTestId('plan-status')).toHaveText('Bozza')
    await expect(main(page).getByText('Bozza — non validato da un professionista')).toHaveCount(0)
    await expect(main(page).getByRole('button', { name: 'Gestisci piano' })).toBeVisible()
  })

  test('3-4 cambio giorno in place; "Gestisci piano" e "Modifica → Annulla" non perdono il giorno', async ({ page }, info) => {
    await openPlan(page, info)
    const tue = main(page).getByRole('button', { name: /^martedì 27 ottobre/ })
    await tue.click()
    await expect(tue).toHaveAttribute('aria-current', 'date')
    await expect(main(page).getByRole('button', { name: /^sabato 31 ottobre/ })).not.toHaveAttribute('aria-current', 'date')
    await expect(heading(page)).toHaveText('martedì 27 ottobre')
    await expect(main(page).getByText('Torna a oggi')).toBeVisible()

    await main(page).getByRole('button', { name: 'Gestisci piano' }).click()
    const dialog = page.getByRole('dialog', { name: 'Gestisci piano' })
    await expect(dialog).toContainText('Bozza — non validato da un professionista')
    await page.keyboard.press('Escape')
    await expect(heading(page)).toHaveText('martedì 27 ottobre')

    await main(page).getByRole('button', { name: 'Gestisci piano' }).click()
    await dialog.getByRole('button', { name: 'Modifica' }).click()
    await page.getByRole('button', { name: 'Annulla' }).last().click()
    await expect(heading(page)).toHaveText('martedì 27 ottobre')

    await main(page).getByText('Torna a oggi').click()
    await expect(heading(page)).toHaveText('sabato 31 ottobre')
  })

  test('7 tastiera: giorni e gestione raggiungibili e attivabili', async ({ page }, info) => {
    await openPlan(page, info)
    const fri = main(page).getByRole('button', { name: /^venerdì 30 ottobre/ })
    await fri.focus()
    await page.keyboard.press('Enter')
    await expect(fri).toHaveAttribute('aria-current', 'date')
    await expect(main(page).getByText('venerdì 30 ottobre: 4 pasti')).toBeAttached() // annuncio per screen reader
    const manage = main(page).getByRole('button', { name: 'Gestisci piano' })
    await manage.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Gestisci piano' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(manage).toBeFocused()
  })
})

test('6 giorno senza pasti e più piani: stato vuoto, selettore compatto, nessun cambio automatico', async ({ page }, info) => {
  await openPlan(page, info, [FIX('dieta-mercoledi.json')])
  // il piano attivo resta quello mostrato anche dopo l'import di un secondo piano
  const picker = main(page).getByLabel('Piano alimentare')
  await expect(picker.locator('option:checked')).toHaveText(/Ricomposizione e nuoto.*\(attivo\)/)
  await picker.selectOption({ label: 'Piano E2E' })
  await expect(main(page)).toContainText('non attivo')
  await expect(main(page)).toContainText('Stai consultando un piano non attivo.')
  // il piano E2E ha solo il mercoledì: sabato è vuoto
  await expect(heading(page)).toHaveText('sabato 31 ottobre')
  await expect(main(page)).toContainText('Nessun pasto previsto per questo giorno.')
  await expect(main(page).getByRole('button', { name: 'Modifica il piano' })).toBeVisible()
})

for (const width of [320, 390, 768, 1280]) {
  test(`5 nessuno scorrimento orizzontale a ${width} px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 })
    await openPlan(page, info)
    expect(await noHorizontalScroll(page)).toBe(true)
    await main(page).getByRole('button', { name: 'Gestisci piano' }).click()
    expect(await noHorizontalScroll(page)).toBe(true)
  })
}

// ---- CR-UX-ALIM-002: livelli di informazione, feedback e motion ----
const card = (page, name) => main(page).getByRole('article', { name })

test.describe('CR-UX-ALIM-002 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('alimenti e quantità in primo piano; dettagli su richiesta, animati e accessibili da tastiera', async ({ page }, info) => {
    await openPlan(page, info)
    const c = card(page, 'Colazione')
    // primario: alimenti con quantità; la provenienza dei valori non è nella lettura principale
    await expect(c.getByRole('listitem').first()).toContainText('250 ml')
    const details = c.getByRole('button', { name: 'Dettagli', exact: true })
    await expect(details).toHaveAttribute('aria-expanded', 'false')
    const panel = page.locator(`#${await details.getAttribute('aria-controls')}`)
    await expect(panel).toHaveAttribute('inert', '')
    await expect(panel).not.toBeVisible()
    await details.focus()
    await page.keyboard.press('Enter')
    await expect(details).toHaveAttribute('aria-expanded', 'true')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('somma degli alimenti')
    // l'altezza si anima (grid-template-rows), non salta
    expect(await panel.evaluate((el) => getComputedStyle(el).transitionProperty)).toContain('grid-template-rows')
    await page.keyboard.press('Enter')
    await expect(details).toHaveAttribute('aria-expanded', 'false')
  })

  test('segna consumato: conferma esplicita e persistente; annullabile', async ({ page }, info) => {
    await openPlan(page, info)
    const c = card(page, 'Pranzo')
    await c.getByRole('button', { name: 'Segna consumato' }).click()
    const done = c.getByRole('status').filter({ hasText: 'Consumato come previsto' })
    await expect(done).toBeVisible()
    await expect(done).toHaveClass(/anim-pop/)
    await expect(main(page).getByTestId('day-summary')).toContainText('1 di 4 registrati')
    await waitSaved(page)
    await page.reload()
    await nav(page, /Alimentazione/)
    await expect(card(page, 'Pranzo').getByText('Consumato come previsto')).toBeVisible()
    await card(page, 'Pranzo').getByRole('button', { name: 'Annulla registrazione Pranzo' }).click()
    await expect(card(page, 'Pranzo').getByRole('button', { name: 'Segna consumato' })).toBeVisible()
  })

  test('alternativa: anteprima distinta dal salvataggio, conferma persistente', async ({ page }, info) => {
    await openPlan(page, info)
    const c = card(page, 'Colazione')
    await c.getByRole('group', { name: 'Opzioni Colazione' }).getByRole('button', { name: 'Skyr e avena' }).click()
    await expect(c.getByRole('status').filter({ hasText: 'Anteprima' })).toContainText('non ancora salvata')
    await c.getByRole('button', { name: 'Annulla', exact: true }).click()
    await expect(c.getByRole('button', { name: 'Principale' })).toHaveAttribute('aria-pressed', 'true')
    await c.getByRole('button', { name: 'Skyr e avena' }).click()
    await c.getByRole('button', { name: 'Scegli per questa data' }).click()
    await expect(c.getByRole('status').filter({ hasText: 'Alternativa scelta per questa data' })).toBeVisible()
    await expect(c.getByRole('button', { name: 'Skyr e avena ✓' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('cambio giorno: transizione direzionale, indicatore animato, nessun salto di scroll', async ({ page }, info) => {
    await openPlan(page, info)
    await page.evaluate(() => window.scrollTo(0, 120))
    const content = main(page).locator('section[aria-labelledby="diet-day-title"] > div[class*="anim-day"]')
    // clic diretto: il clic di Playwright scorrerebbe da solo per portare in vista il pulsante
    await main(page).getByRole('button', { name: /^domenica 1 novembre/ }).evaluate((b) => b.click())
    await expect(content).toHaveClass(/anim-day-next/)
    expect(await page.evaluate(() => window.scrollY)).toBe(120)
    await main(page).getByRole('button', { name: /^giovedì 29 ottobre/ }).click()
    await expect(content).toHaveClass(/anim-day-prev/)
    const indicator = main(page).getByRole('navigation', { name: 'Giorno del piano' }).locator('span[aria-hidden="true"]').first()
    expect(await indicator.evaluate((el) => getComputedStyle(el).transitionProperty)).toContain('transform')
  })

  test('pannelli: animazione anche in chiusura; con movimento ridotto chiusura immediata', async ({ page }, info) => {
    await openPlan(page, info)
    await main(page).getByRole('button', { name: 'Gestisci piano' }).click()
    const dialog = page.getByRole('dialog', { name: 'Gestisci piano' })
    await expect(dialog).toHaveClass(/anim-sheet/)
    await page.keyboard.press('Escape')
    await expect(page.locator('.anim-sheet-out')).toHaveCount(1) // uscita animata
    await expect(page.locator('.anim-sheet-out')).toHaveCount(0)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await main(page).getByRole('button', { name: 'Gestisci piano' }).click()
    await page.keyboard.press('Escape')
    await expect(page.locator('[role=dialog], .anim-sheet-out')).toHaveCount(0)
  })

  test('aree interattive essenziali dei pasti almeno 44x44 px', async ({ page }, info) => {
    await openPlan(page, info)
    const c = card(page, 'Colazione')
    for (const b of await c.getByRole('button').all()) {
      const box = await b.boundingBox()
      expect(box.height, await b.textContent()).toBeGreaterThanOrEqual(44)
    }
    for (const b of await main(page).getByRole('navigation', { name: 'Giorno del piano' }).getByRole('button').all()) {
      expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44)
    }
  })
})
