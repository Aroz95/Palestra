// Modulo Alimentazione v4 — scenari NUT-T01..T20 verificabili a livello di logica (gli altri sono negli E2E)
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseImport, previewImport, applyImport } from '../src/lib/import'
import { emptyState } from '../src/schema/factories'
import { migrateToLatest } from '../src/schema/migrate'
import { exportDietPlan, exportBackup, buildReport, reportToCSV } from '../src/lib/report'
import { aggregateDiet } from '../src/lib/report/aggregate'
import * as D from '../src/lib/diet'
import * as A from '../src/lib/actions'

const EX = (f) => fs.readFileSync(path.resolve(__dirname, '../docs/examples', f), 'utf8')
const importInto = (state, text, opts = {}) => {
  const r = parseImport(text)
  expect(r.errors).toEqual([])
  const pv = previewImport(state, r.batch)
  return { ...applyImport(state, r.batch, pv, { decisions: Object.fromEntries(pv.items.map((i) => [i.key, opts.choice ?? 'skip'])), ...opts }), parsed: r, preview: pv }
}
const V4 = EX('piano-alimentare-v4.json')
const base = () => importInto(emptyState(), V4, { activateDietPlan: true }).state
const planOf = (s) => s.dietPlans[0]
const MON = '2026-11-02' // lunedì
const WED_SPECIAL = '2026-11-04' // mercoledì con giorno a data specifica

describe('NUT-T01/T02/T05 import completo v4 e roundtrip', () => {
  it('T01 obiettivi, guida, 9 giorni, alternative, nutrienti, base delle quantità e guida del pasto conservati', () => {
    const { parsed, state } = importInto(emptyState(), V4)
    expect(parsed.warnings).toEqual([])
    const p = planOf(state)
    expect(p.nutritionTargets.default).toMatchObject({ kcal: 2200, proteinG: 140, carbsG: 264, fatG: 65, fiberG: 30, waterMl: null })
    expect(p.nutritionTargets.training).toMatchObject({ kcal: 2300, carbsG: 289, proteinG: null })
    expect(p.nutritionTargets.weightLossKgPerWeek).toEqual({ min: 0.3, max: 0.5 })
    expect(p.guidelines.preWorkout).toEqual({ timing: 'Circa 60–90 minuti prima', advice: ['Preferire uno spuntino digeribile.', 'Evitare pasti abbondanti e molto grassi.'], mealCategories: ['afternoon_snack'] })
    expect(p.guidelines.foodWeighing).toHaveLength(2)
    expect(p.days).toHaveLength(9)
    const mon = p.days[0]
    expect(mon.meals[0].items[1]).toMatchObject({ quantity: 3, unit: 'pz', nutrition: { kcal: 100, source: 'label' } })
    expect(mon.meals[0].items[0].quantityBasis).toBe('packaged')
    expect(mon.meals[0].alternatives[0]).toMatchObject({ id: '1-colazione-skyr', label: 'Skyr e avena', nutrition: { kcal: 257 } })
    expect(mon.meals[2].guidance[0]).toMatch(/60–90 minuti/)
    expect(p.days[8]).toMatchObject({ date: WED_SPECIAL, nutritionTarget: { kcal: 2400, proteinG: null } })
    expect(p.active).toBe(false) // mai attivato in automatico
  })

  it('T02 export v4 → reimport: contenuto identico, nessuna proprietà persa', () => {
    const s = base()
    const file = JSON.stringify(exportDietPlan(planOf(s)))
    const pv = previewImport(s, parseImport(file).batch)
    expect(pv.items[0].status).toBe('identical')
    const fresh = importInto(emptyState(), file).state
    const { active, ...a } = planOf(s)
    const { active: b0, ...b } = planOf(fresh)
    expect(b).toEqual(a)
  })

  it('T05 pasti senza nutrienti: totale del giorno parziale, mai uno zero inventato', () => {
    const { day } = D.pickDay(planOf(base()), MON, { isTraining: true })
    const t = D.dayPlanned(day)
    expect(t.kcal).toEqual({ value: 1122, status: 'partial', known: 3, total: 4 }) // 335 + 580 + 207, cena senza patate
    expect(D.optionNutrition(day.meals[0]).kcal).toEqual({ value: 335, status: 'computed' })
    expect(D.optionNutrition(day.meals[1]).kcal).toEqual({ value: 580, status: 'declared' })
    expect(D.optionNutrition(day.meals[3]).kcal).toEqual({ value: null, status: 'missing' })
    expect(D.optionNutrition(day.meals[3]).source).toBe('unknown')
  })
})

describe('NUT-T03/T04/T20 compatibilità v3 e scelta di giorno e obiettivo', () => {
  it('T03 piano v3: importato invariato, obiettivi e guida non specificati (ND)', () => {
    const { parsed, state } = importInto(emptyState(), EX('piano-alimentare.json'))
    expect(parsed.errors).toEqual([])
    const p = planOf(state)
    expect(p.nutritionTargets).toBeNull()
    expect(p.guidelines).toBeNull()
    const target = D.resolveTarget(p, p.days[0], true)
    expect(D.hasTargets(target)).toBe(false)
    expect(target.kcal).toEqual({ value: null, source: null })
  })

  it('T04 allenamento vs riposo e data specifica: priorità giorno → tipo → generale, per nutriente', () => {
    const p = planOf(base())
    const tr = D.pickDay(p, MON, { isTraining: true })
    expect(tr.day.id).toBe('giorno-1')
    const tTr = D.resolveTarget(p, tr.day, D.isTrainingDay(tr.day, true))
    expect(tTr.kcal).toEqual({ value: 2300, source: 'training' })
    expect(tTr.proteinG).toEqual({ value: 140, source: 'default' })
    const rs = D.pickDay(p, MON, { isTraining: false })
    expect(rs.day.id).toBe('giorno-1-riposo')
    expect(D.resolveTarget(p, rs.day, D.isTrainingDay(rs.day, false)).kcal).toEqual({ value: 2000, source: 'rest' })
    const sp = D.pickDay(p, WED_SPECIAL, { isTraining: false })
    expect(sp.day.id).toBe('pranzo-fuori')
    const tSp = D.resolveTarget(p, sp.day, false)
    expect(tSp.kcal).toEqual({ value: 2400, source: 'day' })
    expect(tSp.carbsG).toEqual({ value: 214, source: 'rest' })
  })

  it('T20 confini di settimana: domenica → giorno 7, lunedì → giorno 1; periodo con estremi inclusi', () => {
    const p = planOf(base())
    expect(D.pickDay(p, '2026-11-08').day.weekday).toBe(7)
    expect(D.pickDay(p, '2026-11-09', { isTraining: true }).day.weekday).toBe(1)
    const s = { ...base(), dietPlans: [{ ...planOf(base()), active: true }] }
    const a = aggregateDiet(s, { from: '2026-11-08', to: '2026-11-09' })
    expect(a.daily.map((d) => d.date)).toEqual(['2026-11-08', '2026-11-09'])
  })
})

describe('NUT-T06..T09 alternative', () => {
  const s0 = base()
  const p = planOf(s0)
  const { day } = D.pickDay(p, MON, { isTraining: true })

  it('T06 l’alternativa ricalcola solo il giorno interessato', () => {
    const s = A.selectAlternative(s0, { date: MON, planId: p.id, planRevision: 1, mealId: '1-pranzo', alternativeId: '1-pranzo-riso' })
    expect(D.dayPlanned(day, D.selectionsFor(s, MON, p.id)).kcal.value).toBe(1072) // 1122 − 580 + 530
    expect(D.dayPlanned(day, D.selectionsFor(s, '2026-11-09', p.id)).kcal.value).toBe(1122) // lunedì successivo invariato
  })

  it('T07 alternativa senza nutrienti: ND, mai i valori del principale', () => {
    const main = D.optionNutrition(D.optionOf(day.meals[1], null))
    const alt = { id: 'x', items: [{ name: 'Altro', nutrition: null }], nutrition: null }
    const meal = { ...day.meals[1], alternatives: [alt] }
    expect(main.kcal.value).toBe(580)
    expect(D.optionNutrition(D.optionOf(meal, 'x')).kcal).toEqual({ value: null, status: 'missing' })
    const sel = D.dayPlanned({ meals: [meal] }, { [meal.id]: 'x' })
    expect(sel.kcal.status).toBe('missing')
    expect(D.optionDelta(D.optionNutrition(alt), main).kcal).toBeNull()
  })

  it('T08 nutrienti di pasto e alimenti entrambi presenti: nessun doppio conteggio, divergenza segnalata', () => {
    const meal = { items: [{ nutrition: { kcal: 300, proteinG: 20, carbsG: 30, fatG: 10 } }, { nutrition: { kcal: 200, proteinG: 10, carbsG: 20, fatG: 8 } }], nutrition: { kcal: 500, proteinG: 30, carbsG: 50, fatG: 18 } }
    const n = D.optionNutrition(meal)
    expect(n.kcal).toEqual({ value: 500, status: 'declared' })
    expect(n.mismatch).toEqual([])
    const off = D.optionNutrition({ ...meal, nutrition: { ...meal.nutrition, kcal: 650 } })
    expect(off.kcal.value).toBe(650) // valore dichiarato non corretto in silenzio
    expect(off.mismatch).toEqual([{ key: 'kcal', declared: 650, items: 500 }])
  })

  it('T09 scegli un’alternativa e torna al principale: stato coerente, piano invariato', () => {
    const before = JSON.stringify(planOf(s0))
    let s = A.selectAlternative(s0, { date: MON, planId: p.id, planRevision: 1, mealId: '1-colazione', alternativeId: '1-colazione-skyr' })
    expect(D.selectionsFor(s, MON, p.id)).toEqual({ '1-colazione': '1-colazione-skyr' })
    s = A.selectAlternative(s, { date: MON, planId: p.id, planRevision: 1, mealId: '1-colazione', alternativeId: null })
    expect(s.dietSelections).toEqual([])
    expect(JSON.stringify(planOf(s))).toBe(before)
  })
})

describe('NUT-T10..T12 consuntivo e scostamenti', () => {
  const s0 = base()
  const p = planOf(s0)

  it('T11 "seguito" senza quantità: aderenza sì, nutrienti consumati non attestati', () => {
    const s = A.logMeal(s0, { date: MON, planId: p.id, planRevision: 1, mealId: '1-colazione', status: 'followed' })
    const { day } = D.pickDay(p, MON, { isTraining: true })
    const c = D.dayConsumed(day, s.dietLog)
    expect(c.kcal.status).toBe('missing')
    expect(D.consumptionQuality(s.dietLog[0])).toBe('missing')
    const a = aggregateDiet(s, { from: MON, to: MON })
    expect(a.adherence).toMatchObject({ followed: 1 })
    expect(a.consumed.avg.kcal).toBeNull()
  })

  it('consumi registrati: totale completo solo con tutti i pasti registrati e valori noti; saltato = 0', () => {
    const { day } = D.pickDay(p, MON, { isTraining: true })
    const eat = (kcal) => ({ source: 'manual', chosenAlternativeId: null, items: [], nutrition: { kcal, proteinG: 10, carbsG: 10, fatG: 10, fiberG: null } })
    let s = s0
    s = A.logMeal(s, { date: MON, planId: p.id, planRevision: 1, mealId: '1-colazione', status: 'modified', consumption: eat(300) })
    s = A.logMeal(s, { date: MON, planId: p.id, planRevision: 1, mealId: '1-pranzo', status: 'followed', consumption: eat(600) })
    expect(D.dayConsumed(day, s.dietLog).kcal).toEqual({ value: 900, status: 'partial', known: 2, total: 4 })
    s = A.logMeal(s, { date: MON, planId: p.id, planRevision: 1, mealId: '1-merenda', status: 'skipped' })
    s = A.logMeal(s, { date: MON, planId: p.id, planRevision: 1, mealId: '1-cena', status: 'modified', consumption: eat(700) })
    s = A.addExtraFood(s, { date: MON, planId: p.id, planRevision: 1, label: 'Gelato', consumption: eat(200) })
    expect(D.dayConsumed(day, s.dietLog).kcal).toEqual({ value: 1800, status: 'complete', known: 5, total: 5 })
    // cambiare lo stato non cancella le quantità già registrate
    s = A.logMeal(s, { date: MON, planId: p.id, planRevision: 1, mealId: '1-cena', status: 'followed' })
    expect(s.dietLog.find((l) => l.mealId === '1-cena').consumption.nutrition.kcal).toBe(700)
  })

  it('T10 modifica del piano dopo i pasti registrati: diario stabile e legato alla sua revisione', () => {
    let s = A.logMeal({ ...s0 }, { date: MON, planId: p.id, planRevision: 1, mealId: '1-pranzo', status: 'modified', consumption: { source: 'manual', items: [{ name: 'Pasta', quantity: 100, unit: 'g', nutrition: null }], nutrition: null } })
    const logBefore = structuredClone(s.dietLog)
    const changed = JSON.parse(V4)
    changed.days[0].meals[1].nutrition.kcal = 600
    s = importInto(s, JSON.stringify(changed), { choice: 'update' }).state
    expect(planOf(s).revision).toBe(2)
    expect(s.dietLog).toEqual(logBefore)
    expect(s.dietLog[0].planRevision).toBe(1)
  })

  it('T12 scostamento dal target mostrato solo con dati completi, senza aggiustamenti automatici', () => {
    const day = { meals: [{ id: 'a', items: [], nutrition: { kcal: 1500, proteinG: 100, carbsG: 150, fatG: 50 } }] }
    const target = D.resolveTarget(planOf(s0), day, false)
    const planned = D.dayPlanned(day)
    expect(D.deltaToTarget(planned, target)).toMatchObject({ kcal: -500, proteinG: -40, carbsG: -64, fatG: -15 })
    const partial = D.dayPlanned({ meals: [...day.meals, { id: 'b', items: [], nutrition: null }] })
    expect(D.deltaToTarget(partial, target).kcal).toBeNull()
  })
})

describe('NUT-T13/T14 report e privacy', () => {
  const eat = (kcal) => ({ source: 'manual', chosenAlternativeId: null, items: [], nutrition: { kcal, proteinG: 30, carbsG: 50, fatG: 20, fiberG: null } })
  let s = base()
  const p = planOf(s)
  // lunedì con allenamento: vale la variante "allenamento" del piano
  s = { ...s, sessions: [{ id: 'sw', kind: 'swim', date: MON, status: 'completed', durationMin: 45, plannedBlocks: [], technique: {}, feedback: {} }] }
  for (const m of ['1-colazione', '1-pranzo', '1-merenda', '1-cena']) s = A.logMeal(s, { date: MON, planId: p.id, planRevision: 1, mealId: m, status: 'followed', consumption: eat(500), note: 'NOTA-PRIVATA-PASTO' })
  s = A.selectAlternative(s, { date: MON, planId: p.id, planRevision: 1, mealId: '1-pranzo', alternativeId: '1-pranzo-riso' })
  const period = { from: MON, to: '2026-11-03' }

  it('T13 JSON: obiettivi, programmato, consumato e qualità distinti e coerenti', () => {
    const r = buildReport(s, period, { sections: ['diet'], detail: 'detailed' })
    const d = r.summary.diet
    expect(d.targets.default.kcal).toBe(2200)
    expect(d.consumed.avg.kcal).toBe(2000)
    expect(d.consumed.daysComplete.kcal).toBe(1)
    expect(d.planned.quality).toBe('partial')
    expect(d.dataQuality).toMatchObject({ targets: 'declared', planned: 'partial', consumed: 'complete' })
    expect(r.details.diet[0]).toMatchObject({ date: MON, target: { kcal: 2300 }, consumed: { kcal: { value: 2000, status: 'complete' } }, deltaConsumed: { kcal: -300 } })
    expect(r.details.diet[0].planned.kcal).toEqual({ value: 1072, status: 'partial', known: 3, total: 4 }) // con l’alternativa scelta
    expect(r.summary.diet.daily).toBeUndefined() // il dettaglio giornaliero solo nei details
  })

  it('T13 CSV: righe per data e indicatore con qualità', () => {
    const csv = reportToCSV(s, period, { sections: ['diet'], dialect: 'standard' })
    expect(csv).toContain(`${MON},diet,target_kcal,2300,,,kcal,declared,training`)
    expect(csv).toContain(`${MON},diet,planned_kcal,1072,,,kcal,partial,`)
    expect(csv).toContain(`${MON},diet,consumed_kcal,2000,,,kcal,computed,`)
  })

  it('T14 note private e guida del piano escluse per impostazione predefinita, incluse solo su richiesta', () => {
    const closed = JSON.stringify(buildReport(s, period, { sections: ['diet'], detail: 'detailed' }))
    expect(closed).not.toContain('NOTA-PRIVATA-PASTO')
    expect(closed).not.toContain('Preferire uno spuntino digeribile')
    const guide = JSON.stringify(buildReport(s, period, { sections: ['diet'], detail: 'detailed', includePlanGuide: true }))
    expect(guide).toContain('Preferire uno spuntino digeribile')
    expect(guide).not.toContain('NOTA-PRIVATA-PASTO')
    const notes = JSON.stringify(buildReport(s, period, { sections: ['diet'], detail: 'detailed', excludeNotes: false }))
    expect(notes).toContain('NOTA-PRIVATA-PASTO')
  })
})

describe('NUT-T15/T16/T19 validazione, aggiornamenti e migrazione', () => {
  it('T15 numeri e unità non validi: errori sul campo, nessun dato', () => {
    const bad = JSON.parse(V4)
    bad.days[0].meals[0].items[0].nutrition.kcal = -5
    bad.days[0].meals[0].items[0].quantityBasis = 'bollito'
    bad.nutritionTargets.weightLossKgPerWeek = { min: 0.8, max: 0.3 }
    bad.guidelines.preWorkout.mealCategories = ['brunch']
    bad.days[0].meals[1].alternatives.push({ id: '1-pranzo-riso', items: [] })
    const { errors } = parseImport(JSON.stringify(bad))
    const paths = errors.map((e) => e.path)
    expect(paths).toEqual(
      expect.arrayContaining([
        '(radice).days[0].meals[0].items[0].nutrition.kcal',
        '(radice).days[0].meals[0].items[0].quantityBasis',
        '(radice).nutritionTargets.weightLossKgPerWeek',
        '(radice).guidelines.preWorkout.mealCategories[0]',
        '(radice).days[0].meals[1].alternatives[1].id',
      ]),
    )
  })

  it('avviso (non errore) se kcal e macro sono incoerenti', () => {
    const odd = JSON.parse(V4)
    odd.days[0].meals[1].nutrition.kcal = 900
    const r = parseImport(JSON.stringify(odd))
    expect(r.errors).toEqual([])
    expect(r.warnings.map((w) => w.path)).toContain('(radice).days[0].meals[1].nutrition')
  })

  it('T16 aggiorna / copia / salta un piano esistente', () => {
    const s = base()
    expect(importInto(s, V4).state.dietPlans).toHaveLength(1) // salta (identico)
    const cloned = importInto(s, V4, { choice: 'clone' }).state
    expect(cloned.dietPlans).toHaveLength(2)
    expect(cloned.dietPlans[1].id).not.toBe(cloned.dietPlans[0].id)
    expect(cloned.dietPlans[1].active).toBe(false)
    const changed = JSON.parse(V4)
    changed.nutritionTargets.default.kcal = 2100
    const upd = importInto(s, JSON.stringify(changed), { choice: 'update' }).state
    expect(upd.dietPlans).toHaveLength(1)
    expect(planOf(upd)).toMatchObject({ revision: 2, active: true })
    expect(planOf(upd).history[0].snapshot.nutritionTargets.default.kcal).toBe(2200)
  })

  it('T19 stato v3 (piani e diario) → v4 → backup → ripristino: nessuna perdita', () => {
    const v3plan = JSON.parse(EX('piano-alimentare.json'))
    const stateV3 = {
      ...emptyState(),
      schemaVersion: 3,
      dietPlans: [{ ...v3plan, type: undefined, schemaVersion: undefined, active: true, archived: false, revision: 2, history: [{ revision: 1, savedAt: '2026-10-01T10:00:00+02:00', snapshot: { name: 'old' } }] }],
      dietLog: [{ id: 'l1', date: '2026-11-05', planId: 'diet-plan-001', planRevision: 1, mealId: 'colazione', status: 'followed', note: 'ok' }],
    }
    delete stateV3.dietSelections
    const v4 = migrateToLatest(stateV3)
    expect(v4.schemaVersion).toBe(4)
    expect(v4.dietSelections).toEqual([])
    expect(v4.dietPlans[0]).toMatchObject({ active: true, revision: 2, nutritionTargets: null, guidelines: null })
    expect(v4.dietPlans[0].history).toEqual(stateV3.dietPlans[0].history)
    expect(v4.dietLog[0]).toMatchObject({ id: 'l1', planRevision: 1, status: 'followed', note: 'ok', consumption: null })
    const restored = importInto(emptyState(), JSON.stringify(exportBackup(v4)), { mode: 'replace' }).state
    for (const k of ['dietPlans', 'dietLog', 'dietSelections']) expect(restored[k]).toEqual(v4[k])
  })
})

describe('report PDF alimentazione (v4)', async () => {
  const { buildReportPdf } = await import('../src/lib/report/pdf')
  const pdfText = (doc) => Buffer.from(doc.output('arraybuffer')).toString('latin1').replace(/\\([()])/g, '$1')
  const period = { from: '2026-11-01', to: '2026-11-30' }
  it('obiettivi dal piano; guida inclusa solo su richiesta esplicita', () => {
    const s = base()
    const closed = pdfText(buildReportPdf(s, period, { sections: ['diet'] }))
    expect(closed).toContain('Obiettivo predefinito')
    expect(closed).not.toContain('Guida del piano')
    const open = pdfText(buildReportPdf(s, period, { sections: ['diet'], includePlanGuide: true }))
    expect(open).toContain('Guida del piano')
  })
})
