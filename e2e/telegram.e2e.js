// Telegram: condivisione senza configurazione, collegamento del bot, invio manuale e automatico (Bot API simulata)
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { openApp, nav, tab, main, goImport, importFile, openMeal, EX, readJSON } from './helpers'

test.use({ viewport: { width: 390, height: 844 } })
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw'

async function openPlan(page, info) {
  const plan = { ...readJSON(EX('piano-alimentare-v4.json')), validFrom: null, validTo: null }
  const file = info.outputPath('piano.json')
  fs.writeFileSync(file, JSON.stringify(plan))
  await openApp(page)
  await goImport(page)
  await importFile(page, file)
  await nav(page, /Alimentazione/)
  await main(page).getByRole('button', { name: 'Imposta attivo' }).click()
}

// Bot API finta: registra le richieste, risponde con le intestazioni CORS come il servizio vero
async function fakeTelegram(page) {
  const sent = []
  await page.route('https://api.telegram.org/**', async (route) => {
    const req = route.request()
    const method = req.url().split('/').pop()
    const body = Object.fromEntries(new URLSearchParams(req.postData() ?? ''))
    const result =
      method === 'getMe' ? { id: 1, is_bot: true, username: 'pasti_bot' } : method === 'getUpdates' ? [{ update_id: 1, message: { chat: { id: 4242, type: 'private', first_name: 'Antonino' }, text: '/start' } }] : { message_id: sent.length + 1 }
    if (method === 'sendMessage') sent.push(body)
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, result }) })
  })
  return sent
}

test('senza bot: il pulsante Telegram apre la condivisione con il testo del pasto', async ({ page, context }, info) => {
  await openPlan(page, info)
  await context.route('https://t.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }))
  const pranzo = await openMeal(page, 'Pranzo')
  // alternativa in anteprima: il messaggio usa quella mostrata
  await pranzo.getByRole('button', { name: 'Riso e tonno' }).click()
  const [popup] = await Promise.all([page.waitForEvent('popup'), pranzo.getByRole('link', { name: 'Invia su Telegram: Pranzo' }).click()])
  const u = new URL(popup.url())
  expect(u.origin + u.pathname).toBe('https://t.me/share/url')
  expect(u.searchParams.get('url')).toBe('🍽 Pranzo (Riso e tonno) · 13:00')
  expect(u.searchParams.get('text')).toMatch(/^• Riso/)
})

test('bot: collegamento, invio manuale e automatico al pasto, token fuori dal backup', async ({ page }, info) => {
  const sent = await fakeTelegram(page)
  await openPlan(page, info)
  await main(page).getByRole('button', { name: 'Promemoria dei pasti' }).click()
  const sheet = page.getByRole('dialog', { name: 'Promemoria e invio' })
  await expect(sheet.getByRole('button', { name: 'Cerca la chat' })).toBeDisabled()
  await sheet.getByLabel('Token del bot').fill(TOKEN)
  await sheet.getByRole('button', { name: 'Cerca la chat' }).click()
  await expect(sheet.getByText('Collegato a Antonino').first()).toBeVisible()
  await sheet.getByRole('button', { name: 'Messaggio di prova' }).click()
  await expect(sheet.getByRole('status').filter({ hasText: 'Messaggio di prova inviato' })).toBeVisible()
  expect(sent[0]).toMatchObject({ chat_id: '4242' })
  // menù del giorno
  await sheet.getByRole('button', { name: /Invia su Telegram il menù di sabato 31 ottobre/ }).click()
  await expect(sheet.getByText('✓ Inviato a Antonino')).toBeVisible()
  expect(sent[1].text).toMatch(/^📅 Menù di sabato 31 ottobre\n🍽 Colazione · 08:00\n• /)
  expect(sent[1].text).toContain('🍽 Cena · 20:30')
  // invio automatico (10 minuti prima)
  await sheet.getByRole('switch', { name: 'Invia ogni pasto in automatico all’ora prevista' }).click()
  await page.keyboard.press('Escape')

  // invio manuale dal pasto: diretto nella chat collegata
  const cena = await openMeal(page, 'Cena')
  await cena.getByRole('button', { name: /Invia su Telegram: Cena/ }).click()
  await expect(cena.getByText('✓ Inviato a Antonino')).toBeVisible()
  expect(sent[2].text).toMatch(/^🍽 Cena · 20:30\n• Salmone 150 g/)

  // alle 12:50 parte il pranzo (una sola volta); la colazione delle 08:00 è passata e non viene inviata
  const before = sent.length
  await page.clock.runFor(2 * 3600_000 + 49 * 60_000)
  expect(sent.length).toBe(before)
  await page.clock.runFor(90_000)
  await expect.poll(() => sent.length).toBe(before + 1)
  expect(sent[before].text).toMatch(/^🍽 Pranzo · 13:00\n• Pasta di semola 80 g/)
  await page.clock.runFor(5 * 60_000)
  expect(sent.length).toBe(before + 1)

  // il token resta sul dispositivo: non entra nel backup
  await nav(page, /Altro/)
  await tab(page, 'Esporta')
  const [dl] = await Promise.all([page.waitForEvent('download'), main(page).getByRole('button', { name: 'Scarica backup' }).click()])
  const backup = fs.readFileSync(await dl.path(), 'utf8')
  expect(backup).not.toContain(TOKEN)
  expect(backup).not.toContain('4242')
})
