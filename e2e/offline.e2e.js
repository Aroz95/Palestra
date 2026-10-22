// E2E-14 Funzionamento offline: il server viene spento davvero (l'emulazione "offline" del browser
// non blocca le richieste del service worker e renderebbe il test poco significativo).
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { ROOT, EX, nav, tab, main, goImport, importFile, savedState, waitSaved } from './helpers'

const DIST = path.join(ROOT, 'dist')
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }

function serve(port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    let file = path.join(DIST, decodeURIComponent(url.pathname))
    if (url.pathname.endsWith('/')) file = path.join(file, 'index.html')
    if (!file.startsWith(DIST) || !fs.existsSync(file)) {
      res.writeHead(404)
      return res.end()
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)))
}

test('E2E-14 senza rete: l’app si apre, i dati sono accessibili e le modifiche vengono salvate', async ({ browser }) => {
  const server = await serve(4199)
  const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:4199/' })
  const page = await ctx.newPage()
  page.on('dialog', (d) => d.accept())
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload() // ora la pagina è controllata dal service worker
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await goImport(page)
  await importFile(page, EX('misure.json'))
  await waitSaved(page)

  // rete assente: server spento
  server.closeAllConnections()
  await new Promise((r) => server.close(r))
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Navigazione principale' })).toBeVisible()
  await nav(page, /Altro/)
  await tab(page, 'Misure')
  await expect(main(page)).toContainText('Circonferenza addominale: 100 cm')
  // modifica fatta offline e salvata
  await page.getByRole('button', { name: '+ Registra misura' }).click()
  await page.getByLabel('Peso (kg)').fill('74,6')
  await page.getByRole('button', { name: 'Salva' }).click()
  await waitSaved(page)
  await page.reload()
  expect((await savedState(page)).measurements.map((m) => m.weightKg)).toContain(74.6)
  await ctx.close()
})
