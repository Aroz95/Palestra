// Telegram: testo del messaggio, link di condivisione, Bot API (fetch simulato), dati solo sul dispositivo
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { asText, dayMessage, findChats, isToken, mealMessage, sendText, shareUrl } from '../src/lib/telegram'

const item = (name, quantity, unit = 'g', nutrition = null) => ({ name, quantity, unit, notes: '', nutrition, alternatives: [] })
const pasta = { id: null, label: 'Principale', items: [item('Pasta di semola', 80, 'g', { kcal: 285, proteinG: 10, carbsG: 58, fatG: 1.2 }), item('Olio', 10, 'g', { kcal: 90, proteinG: 0, carbsG: 0, fatG: 10 })], nutrition: null }

describe('messaggio del pasto', () => {
  it('titolo con orario, un alimento per riga, macro note', () => {
    const m = mealMessage({ label: 'Pranzo', time: '13:00', option: pasta })
    expect(m.title).toBe('🍽 Pranzo · 13:00')
    expect(asText(m)).toBe('🍽 Pranzo · 13:00\n• Pasta di semola 80 g\n• Olio 10 g\n\n375 kcal · P 10 g · C 58 g · G 11 g')
  })
  it('alternativa scelta nel titolo; nessuna riga di macro se mancano i valori', () => {
    const m = mealMessage({ label: 'Cena', time: null, option: { id: 'a1', label: 'Pesce', items: [item('Salmone', 150)], nutrition: null } })
    expect(asText(m)).toBe('🍽 Cena (Pesce)\n• Salmone 150 g')
  })
  it('menù del giorno: pasti separati da una riga vuota', () => {
    const d = dayMessage('sabato 31 ottobre', [{ label: 'Colazione', time: '08:00', option: { id: null, items: [item('Latte', 250, 'ml')] } }, { label: 'Pranzo', time: '13:00', option: pasta }])
    expect(d.title).toBe('📅 Menù di sabato 31 ottobre')
    expect(d.body.split('\n\n')[0]).toBe('🍽 Colazione · 08:00\n• Latte 250 ml')
  })
  it('link di condivisione: titolo e testo codificati', () => {
    const u = new URL(shareUrl(mealMessage({ label: 'Pranzo', time: '13:00', option: pasta })))
    expect(u.origin + u.pathname).toBe('https://t.me/share/url')
    expect(u.searchParams.get('url')).toBe('🍽 Pranzo · 13:00')
    expect(u.searchParams.get('text')).toContain('• Pasta di semola 80 g')
  })
  it('forma del token', () => {
    expect(isToken('123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw')).toBe(true)
    expect(isToken('123:abc')).toBe(false)
    expect(isToken('')).toBe(false)
  })
})

describe('Bot API', () => {
  let calls
  beforeEach(() => {
    calls = []
    vi.stubGlobal('fetch', async (url, opts) => {
      calls.push({ url, body: Object.fromEntries(new URLSearchParams(opts.body)), method: opts.method })
      if (url.endsWith('/getUpdates'))
        return new Response(JSON.stringify({ ok: true, result: [{ message: { chat: { id: 42, type: 'private', first_name: 'Mario' } } }, { my_chat_member: { chat: { id: -100, type: 'group', title: 'Famiglia' } } }, { message: { chat: { id: 42, type: 'private', first_name: 'Mario' } } }] }))
      if (url.includes('/botBAD')) return new Response(JSON.stringify({ ok: false, error_code: 401, description: 'Unauthorized' }), { status: 401 })
      if (url.endsWith('/sendMessage') && opts.body.get('chat_id') === '7') return new Response(JSON.stringify({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }), { status: 400 })
      return new Response(JSON.stringify({ ok: true, result: {} }))
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('richiesta semplice (form-urlencoded, nessuna intestazione personalizzata)', async () => {
    await sendText({ token: 'T', chatId: '42' }, 'ciao')
    expect(calls[0]).toMatchObject({ url: 'https://api.telegram.org/botT/sendMessage', method: 'POST', body: { chat_id: '42', text: 'ciao' } })
  })
  it('chat trovate dagli ultimi messaggi, senza doppioni', async () => {
    expect(await findChats('T')).toEqual([
      { id: '42', name: 'Mario', type: 'private' },
      { id: '-100', name: 'Famiglia', type: 'group' },
    ])
  })
  it('errori comprensibili', async () => {
    await expect(sendText({ token: 'BAD', chatId: '1' }, 'x')).rejects.toThrow('token del bot non valido')
    await expect(sendText({ token: 'T', chatId: '7' }, 'x')).rejects.toThrow('chat non trovata')
  })
})
