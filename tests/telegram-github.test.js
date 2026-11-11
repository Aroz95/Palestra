// Invio da GitHub Actions: programma copiato dall'app, scelta dei messaggi da inviare, registro degli invii
import { describe, expect, it } from 'vitest'
import { dueMessages, nowIn, parseSchedule, pruneSent, send } from '../scripts/telegram-pasti.mjs'
import { buildSchedule, repoUrl, serverActive } from '../src/lib/telegram'
import { emptyState } from '../src/schema/factories'

const item = (name, quantity) => ({ name, quantity, unit: 'g', notes: '', nutrition: null, alternatives: [] })
const meal = (id, label, time) => ({ id, category: 'lunch', label, time, items: [item(label === 'Pranzo' ? 'Pasta' : 'Salmone', 80)], alternatives: [], nutrition: null, guidance: [], notes: '' })
const plan = { id: 'p', name: 'P', active: true, archived: false, revision: 1, validFrom: null, validTo: null, days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ id: `d${weekday}`, weekday, date: null, dayType: 'any', meals: [meal('l', 'Pranzo', '13:00'), meal('c', 'Cena', '20:30'), meal('x', 'Spuntino', null)] })) }
const cfg = { token: '1:T', chatId: '-100' }

describe('programma per GitHub', () => {
  const out = buildSchedule({ ...emptyState(), dietPlans: [plan] }, plan, cfg, { from: '2026-11-11', leadMin: 15, tz: 'Europe/Rome' })
  const s = parseSchedule(out.json)
  it('28 giorni di pasti con orario, testi uguali salvati una volta, entro il limite dei segreti', () => {
    expect(out.count).toBe(56)
    expect(out.until).toBe('2026-12-08')
    expect(s.texts).toHaveLength(2)
    expect(s.events[0]).toEqual(['2026-11-11', '13:00', 0])
    expect(s.texts[0]).toBe('🍽 Pranzo · 13:00\n• Pasta 80 g')
    expect(s).toMatchObject({ v: 1, token: '1:T', chatId: '-100', leadMin: 15, tz: 'Europe/Rome' })
    expect(new TextEncoder().encode(out.json).length).toBeLessThan(47_000)
  })
  it('programma non valido → errore comprensibile', () => {
    expect(() => parseSchedule('{"v":1}')).toThrow('copialo di nuovo')
  })

  it('invio dopo orario − anticipo, entro 60 minuti di ritardo, una volta sola', () => {
    const at = (time, sent = []) => dueMessages(s, { date: '2026-11-11', time }, sent).map((m) => m.id)
    expect(at('12:44')).toEqual([])
    expect(at('12:45')).toEqual(['2026-11-11|13:00|0'])
    expect(at('13:40')).toEqual(['2026-11-11|13:00|0']) // esecuzione in ritardo: arriva comunque
    expect(at('13:46')).toEqual([]) // troppo tardi
    expect(at('12:50', ['2026-11-11|13:00|0'])).toEqual([])
    expect(at('20:20')).toEqual(['2026-11-11|20:30|1'])
  })
  it('a cavallo della mezzanotte', () => {
    const late = { ...s, leadMin: 30, events: [['2026-11-12', '00:15', 0]] }
    expect(dueMessages(late, { date: '2026-11-11', time: '23:50' }).map((m) => m.id)).toEqual(['2026-11-12|00:15|0'])
  })
  it('avviso di scadenza: negli ultimi 2 giorni, una volta al giorno, dalle 9', () => {
    const ids = (date, time, sent) => dueMessages({ ...s, events: [] }, { date, time }, sent).map((m) => m.id)
    expect(ids('2026-12-05', '10:00')).toEqual([])
    expect(ids('2026-12-06', '08:59')).toEqual([])
    expect(ids('2026-12-06', '09:00')).toEqual(['scadenza|2026-12-06'])
    expect(ids('2026-12-06', '18:00', ['scadenza|2026-12-06'])).toEqual([])
  })
  it('ora locale del fuso del programma (anche con l’ora legale)', () => {
    expect(nowIn('Europe/Rome', new Date('2026-11-11T11:00:00Z'))).toEqual({ date: '2026-11-11', time: '12:00' })
    expect(nowIn('Europe/Rome', new Date('2026-07-01T22:30:00Z'))).toEqual({ date: '2026-07-02', time: '00:30' })
  })
  it('registro: solo gli ultimi giorni', () => {
    expect(pruneSent(['2026-11-01|13:00|0', '2026-11-09|13:00|0', 'scadenza|2026-11-11'], '2026-11-11')).toEqual(['2026-11-09|13:00|0', 'scadenza|2026-11-11'])
  })
  it('invio: richiesta alla Bot API ed errore se Telegram rifiuta', async () => {
    const calls = []
    const ok = async (url, o) => (calls.push([url, Object.fromEntries(o.body)]), new Response('{"ok":true,"result":{}}'))
    await send(s, 'ciao', ok)
    expect(calls[0]).toEqual(['https://api.telegram.org/bot1:T/sendMessage', { chat_id: '-100', text: 'ciao', disable_web_page_preview: 'true' }])
    await expect(send(s, 'x', async () => new Response('{"ok":false,"error_code":403}', { status: 403 }))).rejects.toThrow('403')
  })
})

describe('app', () => {
  it('indirizzo del repository dall’indirizzo dell’app', () => {
    expect(repoUrl({ hostname: 'aroz95.github.io', pathname: '/Palestra/' })).toBe('https://github.com/aroz95/Palestra')
    expect(repoUrl({ hostname: 'localhost', pathname: '/' })).toBe('https://github.com/Aroz95/Palestra')
  })
  it('invio da GitHub attivo fino alla scadenza del programma', () => {
    expect(serverActive({ serverUntil: '2026-12-08' }, '2026-12-08')).toBe(true)
    expect(serverActive({ serverUntil: '2026-12-08' }, '2026-12-09')).toBe(false)
    expect(serverActive({}, '2026-12-01')).toBe(false)
  })
})
