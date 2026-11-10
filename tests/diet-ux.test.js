// Promemoria dei pasti (calendario e notifiche) e suggerimenti personali
import { describe, expect, it } from 'vitest'
import { dueMeals, mealEvents, toICS } from '../src/lib/mealReminders'
import { EXAMPLE_TIPS, groupTips, newTip, normTip, tipsForMeal } from '../src/lib/dietTips'
import { emptyState } from '../src/schema/factories'
import { migrateToLatest, normalizeState } from '../src/schema/migrate'
import { selectAlternative } from '../src/lib/actions'

const meal = (id, label, time, items, alternatives = []) => ({ id, category: 'lunch', label, time, items, alternatives, nutrition: null, guidance: [], notes: '' })
const item = (name, quantity, unit = 'g') => ({ name, quantity, unit, notes: '', nutrition: null, alternatives: [] })
const plan = {
  id: 'p1',
  name: 'Piano',
  active: true,
  archived: false,
  revision: 1,
  validFrom: null,
  validTo: '2026-11-03',
  days: [
    {
      id: 'd-lun',
      weekday: 1,
      date: null,
      dayType: 'any',
      meals: [
        meal('pranzo', 'Pranzo', '13:00', [item('Riso, basmati', 80), item('Pollo', 150)], [{ id: 'alt1', label: 'Tonno', items: [item('Tonno', 120)], nutrition: null, notes: '' }]),
        meal('cena', 'Cena', '20:30', [item('Salmone', 150)]),
        meal('libero', 'Spuntino libero', null, [item('Frutta', 1, 'pz')]),
      ],
    },
  ],
}
const state = () => ({ ...emptyState(), dietPlans: [plan] })

describe('promemoria dei pasti', () => {
  it('eventi: solo pasti con orario, nei giorni del piano e dentro il periodo di validità', () => {
    // 2026-11-02 è lunedì; il 9 novembre è fuori validità
    const ev = mealEvents(state(), plan, '2026-10-31', 14)
    expect(ev.map((e) => [e.date, e.time, e.label])).toEqual([
      ['2026-11-02', '13:00', 'Pranzo'],
      ['2026-11-02', '20:30', 'Cena'],
    ])
    expect(ev[0].text).toBe('Riso, basmati 80 g, Pollo 150 g')
  })

  it('eventi: usano l’alternativa scelta per quella data', () => {
    const st = selectAlternative(state(), { date: '2026-11-02', planId: 'p1', planRevision: 1, mealId: 'pranzo', alternativeId: 'alt1' })
    expect(mealEvents(st, plan, '2026-11-02', 1)[0].text).toBe('Tonno 120 g')
  })

  it('notifiche: scattano nella finestra dopo l’anticipo, una sola volta e non per i pasti registrati', () => {
    const ev = mealEvents(state(), plan, '2026-11-02', 1)
    const at = (hhmm, extra = {}) => dueMeals(ev, { date: '2026-11-02', hhmm, leadMin: 10, ...extra }).map((e) => e.label)
    expect(at('12:49')).toEqual([])
    expect(at('12:50')).toEqual(['Pranzo'])
    expect(at('13:09')).toEqual(['Pranzo'])
    expect(at('13:10')).toEqual([])
    expect(at('12:55', { notified: [ev[0].id] })).toEqual([])
    expect(at('12:55', { loggedMealIds: ['pranzo'] })).toEqual([])
    expect(dueMeals(ev, { date: '2026-11-03', hhmm: '12:55', leadMin: 10 })).toEqual([])
  })

  it('calendario .ics: evento con avviso, testo protetto, identificativo stabile, righe entro 75 ottetti', () => {
    const ev = mealEvents(state(), plan, '2026-11-02', 1)
    const ics = toICS(ev, { name: 'Pasti · Piano', leadMin: 15, now: new Date('2026-10-31T09:00:00Z') })
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    const flat = ics.replace(/\r\n /g, '')
    expect(flat).toContain('UID:p1-2026-11-02-pranzo@palestra')
    expect(flat).toContain('DTSTART:20261102T130000')
    expect(flat).toContain('SUMMARY:Pranzo: Riso\\, basmati 80 g\\, Pollo 150 g')
    expect(flat).toContain('TRIGGER:-PT15M')
    expect(flat.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(flat.match(/BEGIN:VALARM/g)).toHaveLength(2)
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    // stesso contenuto → stessi identificativi (reimportare aggiorna, non duplica)
    expect(toICS(ev, { now: new Date('2026-11-01T09:00:00Z') }).match(/UID:.*/g)).toEqual(ics.match(/UID:.*/g))
  })
})

describe('suggerimenti personali', () => {
  it('forma valida: categoria sconosciuta → altro, pasto solo per le alternative, testo obbligatorio', () => {
    expect(normTip({ text: '  ' })).toBeNull()
    expect(normTip(null)).toBeNull()
    expect(normTip({ text: ' Tisana ', category: 'boh', meal: 'lunch' })).toMatchObject({ text: 'Tisana', category: 'other', meal: null })
    expect(normTip({ id: 't1', text: 'Patate', category: 'alternative', meal: 'lunch' })).toMatchObject({ id: 't1', category: 'alternative', meal: 'lunch' })
    expect(normTip({ text: 'x', category: 'alternative', meal: 'brunch' }).meal).toBeNull()
  })

  it('dentro un pasto compaiono solo le alternative per quel pasto o per qualsiasi pasto', () => {
    const tips = [newTip({ category: 'alternative', meal: 'lunch', text: 'a' }), newTip({ category: 'alternative', meal: null, text: 'b' }), newTip({ category: 'alternative', meal: 'dinner', text: 'c' }), newTip({ category: 'hunger', text: 'd' })]
    expect(tipsForMeal(tips, 'lunch').map((t) => t.text)).toEqual(['a', 'b'])
    expect(groupTips(tips).map((g) => [g.category, g.tips.length])).toEqual([['alternative', 3], ['hunger', 1]])
    expect(EXAMPLE_TIPS.every((t) => normTip(t))).toBe(true)
  })

  it('stato: i dati esistenti acquisiscono elenco vuoto e promemoria spenti; i suggerimenti salvati restano', () => {
    const old = emptyState()
    delete old.dietTips
    delete old.settings.mealReminders
    const n = normalizeState(old)
    expect(n.dietTips).toEqual([])
    expect(n.settings.mealReminders).toEqual({ enabled: false, leadMin: 10 })
    const tip = newTip({ text: 'Tisana' })
    const kept = migrateToLatest({ ...emptyState(), dietTips: [tip], settings: { ...emptyState().settings, mealReminders: { enabled: true, leadMin: 30 } } })
    expect(kept.dietTips).toEqual([tip])
    expect(kept.settings.mealReminders).toEqual({ enabled: true, leadMin: 30 })
  })
})
