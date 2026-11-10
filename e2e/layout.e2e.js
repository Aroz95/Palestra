// Impaginazione di tutta l'app: nessun elemento fuori dallo schermo o dal proprio contenitore, niente testo tagliato,
// aree toccabili ≥ 44 px, nessuna barra che scorre di lato. Dati volutamente "scomodi" (nomi lunghi, senza spazi).
// Rapporto con immagini: AUDIT=<cartella> npx playwright test e2e/layout.e2e.js
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { openApp, nav, tab, main, goImport, importFile, waitSaved, EX, readJSON } from './helpers'
import { auditLayout } from './layout-audit'

const OUT = process.env.AUDIT
const SIZES = [
  [320, 568],
  [390, 844],
]

for (const [w, h] of SIZES) {
  test(`impaginazione a ${w} px: tutte le schermate`, async ({ page }, info) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: w, height: h })
    const issues = []
    page.setDefaultTimeout(10_000)
    let n = 0
    const check = async (name) => {
      await page.waitForTimeout(320) // fine delle transizioni
      const found = await auditLayout(page)
      for (const f of found) issues.push({ step: name, ...f })
      if (OUT) fs.writeFileSync(path.join(OUT, `issues-${w}.json`), JSON.stringify(issues, null, 1))
      if (OUT) await page.screenshot({ path: path.join(OUT, `${w}-${String(++n).padStart(2, '0')}-${name}.png`), fullPage: !(await page.locator('[role=dialog]').count()) })
    }
    const expandAll = async () => {
      for (const b of await main(page).locator('button[aria-expanded="false"][aria-controls], details:not([open]) > summary').all()) if (await b.isVisible()) await b.click()
    }
    const closeSheet = async () => {
      await page.keyboard.press('Escape')
      await expect(page.locator('[role=dialog]:not([aria-label="Modalità allenamento"])')).toHaveCount(0)
    }
    // file con nomi lunghi e senza spazi, come quelli veri
    const longFile = (src, name, patch = {}) => {
      const f = info.outputPath(name)
      fs.writeFileSync(f, JSON.stringify({ ...readJSON(EX(src)), ...patch }))
      return f
    }

    await openApp(page)
    await check('oggi-vuoto')
    for (const t of [/Allenamenti/, /Alimentazione/, /Progressi/]) {
      await nav(page, t)
      await check(`vuoto-${t.source}`)
    }
    await goImport(page)
    await check('importa-vuoto')
    await importFile(page, longFile('programma-ab.json', 'programma_allenamento_completo_test_neutro_v4.json'))
    await importFile(page, longFile('misure.json', 'misure_corporee_esportazione_2026_10.json'))
    await importFile(page, EX('nuoto-2026-10-21.json'))
    // anteprima prima della conferma
    await page.locator('input[type=file]').setInputFiles(longFile('piano-alimentare-v4.json', 'piano_alimentare_test_neutro_v4.json', { name: 'Piano alimentare — dati nutrizionali completi di prova', validFrom: null, validTo: null }))
    await expect(page.getByRole('button', { name: 'Importa', exact: true })).toBeVisible()
    await check('importa-anteprima')
    await page.getByRole('button', { name: 'Importa', exact: true }).click()
    await expect(page.getByText(/Inseriti \d+ · aggiornati/)).toBeVisible()
    await check('importa-risultato')

    for (const [label, id] of [['Profilo', 'profilo'], ['Misure', 'misure'], ['Esporta', 'esporta'], ['Opzioni', 'opzioni']]) {
      await tab(page, label)
      await expandAll()
      await check(`altro-${id}`)
    }
    await tab(page, 'Profilo')
    await main(page).getByRole('button', { name: '+ Obiettivo' }).click()
    await check('altro-profilo-obiettivo')
    await tab(page, 'Misure')
    await main(page).getByRole('button', { name: '+ Registra misura' }).click()
    await check('altro-misure-nuova')

    // Alimentazione
    await nav(page, /Alimentazione/)
    await main(page).getByRole('button', { name: 'Imposta attivo' }).click()
    await check('dieta-pasti')
    await expandAll()
    await check('dieta-pasti-aperti')
    await main(page).getByRole('button', { name: 'Registra dettagli' }).first().click()
    await check('dieta-registra')
    await closeSheet()
    await main(page).getByRole('button', { name: '+ Aggiungi' }).click()
    await check('dieta-fuori-piano')
    await closeSheet()
    await main(page).getByRole('button', { name: 'Promemoria dei pasti' }).click()
    await check('dieta-promemoria')
    await closeSheet()
    await main(page).getByRole('button', { name: 'Gestisci piano' }).click()
    await check('dieta-gestisci')
    await page.getByRole('dialog').getByRole('button', { name: 'Modifica' }).click()
    await check('dieta-modifica')
    await page.getByRole('button', { name: 'Annulla' }).last().click()
    await page.getByRole('tab', { name: /Suggerimenti/ }).click()
    await main(page).getByRole('button', { name: 'Parti da qualche esempio' }).click()
    await expandAll()
    await check('dieta-suggerimenti')
    await main(page).getByRole('button', { name: '+ Aggiungi' }).click()
    await check('dieta-suggerimento-nuovo')
    await closeSheet()

    // Oggi e allenamenti
    await nav(page, /Oggi/)
    await check('oggi')
    await page.getByRole('button', { name: /A · Full Body A/ }).click()
    await check('seduta')
    await expandAll()
    await check('seduta-aperta')
    await main(page).getByRole('button', { name: '+ Aggiungi esercizio' }).click()
    await check('seduta-aggiungi-esercizio')
    await closeSheet()
    await page.getByRole('button', { name: 'Avvia', exact: true }).click()
    await main(page).getByRole('button', { name: 'Tutte fatte' }).first().click()
    await check('seduta-cronometro-recupero')
    await page.getByRole('button', { name: /Inizia allenamento|Continua allenamento|Riprendi/ }).first().click()
    const wm = page.getByRole('dialog', { name: 'Modalità allenamento' })
    await check('allenamento-riscaldamento')
    await wm.getByLabel('Vai al passo').selectOption({ index: 2 })
    await check('allenamento-esercizio')
    await wm.getByTestId('previous-line').click()
    await check('allenamento-ultima-volta')
    await page.keyboard.press('Escape')
    await wm.getByRole('button', { name: /Esci/ }).click()
    await main(page).getByRole('button', { name: /Termina seduta/ }).click()
    await check('fine-non-completo')
    await page.getByRole('button', { name: 'Concludi comunque' }).click()
    await check('fine-salvato')
    await page.getByRole('button', { name: 'Conferma e concludi' }).click()
    await check('riepilogo')
    await nav(page, /Allenamenti/)
    for (const [label, id] of [['Seduta', 'seduta-vuota'], ['Calendario', 'calendario'], ['Schede', 'schede'], ['Storico', 'storico']]) {
      await tab(page, label)
      await expandAll()
      await check(`allenamenti-${id}`)
    }
    await tab(page, 'Schede')
    await main(page).getByRole('button', { name: 'Modifica' }).first().click()
    await expandAll()
    await check('scheda-modifica')
    await closeSheet()
    await tab(page, 'Storico')
    await main(page).getByRole('button', { name: 'Apri' }).last().click()
    await expandAll()
    await check('nuoto')
    await nav(page, /Progressi/)
    await expandAll()
    await check('progressi')
    await waitSaved(page)

    if (OUT) fs.writeFileSync(path.join(OUT, `issues-${w}.json`), JSON.stringify(issues, null, 1))
    expect(issues.map((i) => `${i.step} · ${i.kind} · ${i.el} (${i.by})`)).toEqual([])
  })
}
