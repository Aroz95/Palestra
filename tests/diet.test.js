// P1-05: consultazione del piano, revisioni e regole prudenziali
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { pickDay, nextMeal, sortedMeals, isValidated } from '../src/lib/diet'
import { parseImport, previewImport, applyImport } from '../src/lib/import'
import { emptyState } from '../src/schema/factories'
import { logMeal } from '../src/lib/actions'
import { dayPlanned } from '../src/lib/diet'

const meal = (id, time, kcal = null) => ({ id, category: 'other', label: id, time, items: [], alternatives: [], nutrition: kcal == null ? null : { kcal, proteinG: null, carbsG: null, fatG: null }, notes: '' })
const plan = {
  id: 'p', revision: 1, status: 'draft', validatedBy: '',
  days: [
    { id: 'mer-allen', weekday: 3, date: null, dayType: 'training', meals: [meal('pranzo', '13:00', 600), meal('colazione', '08:00', 400), meal('spuntino', null)] },
    { id: 'mer-riposo', weekday: 3, date: null, dayType: 'rest', meals: [meal('colazione', '08:00', 350)] },
    { id: 'festa', weekday: null, date: '2026-10-28', dayType: 'any', meals: [meal('pranzo-festa', '13:30')] },
  ],
}

describe('scelta del giorno', () => {
  it('mercoledì: variante allenamento o riposo in base all’attività, scelta manuale prioritaria', () => {
    expect(pickDay(plan, '2026-10-21', { isTraining: true }).day.id).toBe('mer-allen')
    expect(pickDay(plan, '2026-10-21', { isTraining: false }).day.id).toBe('mer-riposo')
    expect(pickDay(plan, '2026-10-21', { isTraining: true, dayType: 'rest' }).day.id).toBe('mer-riposo')
    expect(pickDay(plan, '2026-10-21').types).toEqual(['training', 'rest'])
  })
  it('una data specifica ha la precedenza sul giorno della settimana', () => {
    expect(pickDay(plan, '2026-10-28', { isTraining: true }).day.id).toBe('festa') // anche il 28/10 è mercoledì
  })
  it('giorno senza pasti previsti', () => {
    expect(pickDay(plan, '2026-10-22').day).toBeNull()
  })
  it('ordinamento per orario (senza orario in fondo) e pasto prossimo', () => {
    const d = plan.days[0]
    expect(sortedMeals(d).map((m) => m.id)).toEqual(['colazione', 'pranzo', 'spuntino'])
    expect(nextMeal(d, '10:00').id).toBe('pranzo')
    expect(nextMeal(d, '07:00').id).toBe('colazione')
    expect(nextMeal(d, '21:00').id).toBe('spuntino')
  })
  it('macro: somma solo dei valori dichiarati, giorno parziale se mancano', () => {
    expect(dayPlanned(plan.days[0]).kcal).toEqual({ value: 1000, status: 'partial', known: 2, total: 3 })
    expect(dayPlanned(plan.days[0]).proteinG).toEqual({ value: null, status: 'missing', known: 0, total: 3 })
  })
})

describe('validazione e revisioni', () => {
  it('"validated" senza validatore viene importato come bozza, con avviso', () => {
    const r = parseImport(JSON.stringify({ type: 'palestra-diet-plan', schemaVersion: 3, name: 'X', status: 'validated', days: [{ weekday: 1, meals: [] }] }))
    expect(r.batch.dietPlans[0].item.status).toBe('draft')
    expect(r.warnings[0].message).toMatch(/validatedBy/)
    expect(isValidated({ status: 'validated', validatedBy: 'Dott.ssa R.' })).toBe(true)
    expect(isValidated({ status: 'validated', validatedBy: ' ' })).toBe(false)
  })

  it('aggiornamento da file → nuova revisione; il diario resta sulla revisione in cui è stato registrato', () => {
    const file = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../docs/examples/piano-alimentare.json'), 'utf8'))
    const r1 = parseImport(JSON.stringify(file))
    let state = applyImport(emptyState(), r1.batch, previewImport(emptyState(), r1.batch), { activateDietPlan: true }).state
    state = logMeal(state, { date: '2026-11-05', planId: 'diet-plan-001', planRevision: 1, mealId: 'colazione', status: 'followed' })
    file.days[0].meals[0].items[0].quantity = 200
    const r2 = parseImport(JSON.stringify(file))
    const pv = previewImport(state, r2.batch)
    expect(pv.items[0].status).toBe('conflict')
    state = applyImport(state, r2.batch, pv, { decisions: { [pv.items[0].key]: 'update' } }).state
    const p = state.dietPlans[0]
    expect(p.revision).toBe(2)
    expect(p.active).toBe(true) // stato attivo non toccato dall'aggiornamento
    expect(p.history[0].snapshot.days[0].meals[0].items[0].quantity).toBe(170)
    expect(p.days[0].meals[0].items[0].quantity).toBe(200)
    expect(state.dietLog[0]).toMatchObject({ planRevision: 1, status: 'followed' })
  })

  it('un nuovo piano importato non sostituisce quello attivo', () => {
    const file = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../docs/examples/piano-alimentare.json'), 'utf8'))
    const r1 = parseImport(JSON.stringify(file))
    let state = applyImport(emptyState(), r1.batch, previewImport(emptyState(), r1.batch), { activateDietPlan: true }).state
    const r2 = parseImport(JSON.stringify({ ...file, id: 'altro', name: 'Altro piano' }))
    state = applyImport(state, r2.batch, previewImport(state, r2.batch)).state
    expect(state.dietPlans.map((d) => [d.id, d.active])).toEqual([['diet-plan-001', true], ['altro', false]])
  })
})

describe('CR-UX-ALIM-001: giorno mostrato all’apertura', async () => {
  const { initialDate, rangeStatus } = await import('../src/lib/diet')
  const plan = { validFrom: '2026-11-02', validTo: '2026-11-30' }
  it('oggi se compreso nel piano, altrimenti il primo o l’ultimo giorno utile', () => {
    expect(initialDate(plan, '2026-11-10')).toBe('2026-11-10')
    expect(initialDate(plan, '2026-10-31')).toBe('2026-11-02')
    expect(initialDate(plan, '2026-12-05')).toBe('2026-11-30')
    expect(initialDate({ validFrom: null, validTo: null }, '2026-10-31')).toBe('2026-10-31')
    expect(initialDate(null, '2026-10-31')).toBe('2026-10-31')
  })
  it('stato rispetto al periodo', () => {
    expect(rangeStatus(plan, '2026-10-31')).toBe('before')
    expect(rangeStatus(plan, '2026-12-01')).toBe('after')
    expect(rangeStatus(plan, '2026-11-30')).toBe(null)
  })
})
