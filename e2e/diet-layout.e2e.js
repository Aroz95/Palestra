// CR-UX-ALIM-001: piano del giorno subito visibile, bozza compatta, giorno conservato, responsive e tastiera
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { openApp, nav, main, goImport, importFile, EX, FIX, readJSON } from './helpers'

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
