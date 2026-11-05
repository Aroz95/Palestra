// CAT-01 / CAT-02: catalogo normalizzato, riconoscimento dei nomi storici, selettore (ricerca, A–Z, filtri, doppioni)
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { CATALOG, GROUPS, catalogMatch, normText } from '../src/schema/catalog'
import { exerciseKey, lastPerformance } from '../src/schema/factories'
import { buildCandidates, filterCandidates } from '../src/components/ExercisePicker'
import { IMAGE_SOURCES } from '../src/schema/catalog'
import { migrateToLatest } from '../src/schema/migrate'
import { EQUIPMENT } from '../src/schema/constants'

describe('catalogo', () => {
  it('id unici, nomi e alias senza ambiguità, gruppi/attrezzi/miniature validi', () => {
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length)
    const owner = new Map()
    for (const c of CATALOG) {
      for (const n of [c.name, ...c.aliases]) {
        const k = normText(n)
        expect(owner.get(k) ?? c.id, `"${n}" in ${c.id} e ${owner.get(k)}`).toBe(c.id)
        owner.set(k, c.id)
      }
      expect(GROUPS).toContain(c.group)
      expect(Object.keys(EQUIPMENT)).toContain(c.equipment)
      if (c.image) {
        expect(c.image).toBe(`exercises/${c.id}.webp`)
        expect(fs.existsSync(path.resolve(__dirname, '../public', c.image)), c.image).toBe(true)
      }
    }
  })
  it('nomi delle schede reali riconosciuti; solo corrispondenze esatte, carico per mano rispettato', () => {
    const m = (name, extra = {}) => catalogMatch({ name, perHand: false, ...extra })?.id ?? null
    expect(m('Technogym Pulldown Machine')).toBe('lat-machine')
    expect(m('Upper Back Machine')).toBe('row-machine')
    expect(m('Pectoral Machine (Pec Deck)')).toBe('pec-deck')
    expect(m('Triceps Push Down al cavo con barra')).toBe('triceps-pushdown')
    expect(m('Alzate laterali con manubri', { perHand: true })).toBe('alzate-laterali')
    expect(m('Curl con manubri', { perHand: true })).toBe('curl-manubri')
    expect(m('Curl con manubri', { perHand: false })).toBeNull() // carico diverso: non confuso
    expect(m('Leg')).toBeNull() // nessuna corrispondenza per somiglianza
    expect(m('Panca strana')).toBeNull()
    expect(catalogMatch({ id: 'leg-press', name: 'Pressa 45° Technogym', perHand: false })?.id).toBe('leg-press') // per id
  })
  it('stesso esercizio con nome storico e nome del catalogo: stessa identità, il carico precedente si ritrova', () => {
    const hist = { exerciseId: 'pulldown', name: 'Technogym Pulldown Machine', equipment: 'machine', perHand: false }
    const cat = { id: 'lat-machine', name: 'Lat machine', equipment: 'machine', perHand: false }
    expect(exerciseKey(hist)).toBe(exerciseKey(cat))
    const sessions = [{ id: 's', kind: 'strength', date: '2026-11-03', exercises: [{ ...hist, sets: [{ weight: 25, reps: 12, done: true }] }] }]
    expect(lastPerformance(sessions, cat)?.exercise.sets[0].weight).toBe(25)
  })
})

it('illustrazioni: un unico set (Everkinetic) con fonte dichiarata; solo plank, hip thrust e face pull senza immagine', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/exercises/manifest.json'), 'utf8'))
  expect(Object.keys(IMAGE_SOURCES).sort()).toEqual(Object.keys(manifest).sort())
  expect(Object.values(IMAGE_SOURCES).every((s) => s.startsWith('everkinetic '))).toBe(true)
  expect(CATALOG.filter((c) => !c.image).map((c) => c.id).sort()).toEqual(['face-pull', 'hip-thrust', 'plank'])
  expect(fs.readFileSync(path.resolve(__dirname, '../public/exercises/LICENSE.md'), 'utf8')).toContain('CC BY-SA 4.0')
})

describe('selettore esercizi', () => {
  const state = migrateToLatest(JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures/backup-v2-reale.json'), 'utf8')))
  const list = buildCandidates({ templates: state.workoutTemplates, currentTemplateId: state.workoutTemplates[0].id, sessionExercises: [] })
  it('nessun doppione dello stesso esercizio canonico (scheda + catalogo)', () => {
    expect(new Set(list.map((x) => x.key)).size).toBe(list.length)
    const pulldown = list.filter((x) => x.entry?.id === 'lat-machine')
    expect(pulldown).toHaveLength(1)
    expect(pulldown[0]).toMatchObject({ name: 'Lat machine', originalName: 'Technogym Pulldown Machine', inCurrent: true })
    expect(pulldown[0].tex.id).toBe('pulldown') // si aggiunge l'esercizio della scheda: continuità con lo storico
  })
  it('ordine alfabetico italiano stabile (maiuscole e accenti ignorati)', () => {
    const names = filterCandidates(list).map((x) => x.name)
    expect(names).toEqual([...names].sort(new Intl.Collator('it', { sensitivity: 'base', numeric: true }).compare))
    expect(names[0]).toBe('Abductor machine')
  })
  it('ricerca per nome, alias italiano/inglese e gruppo', () => {
    const q = (query) => filterCandidates(list, { query }).map((x) => x.name)
    expect(q('lat')).toContain('Lat machine')
    expect(q('chest press')).toEqual(expect.arrayContaining(['Chest press', 'Chest press inclinata']))
    expect(q('alzate laterali')).toContain('Alzate laterali')
    expect(q('lateral raise')).toContain('Alzate laterali')
    expect(q('PEC DECK')).toContain('Pectoral machine')
    expect(q('bicipiti')).toEqual(expect.arrayContaining(['Curl con manubri', 'Curl a martello']))
    expect(q('nessuncorrisponde')).toEqual([])
  })
  it('filtri per gruppo, attrezzo e schede; già nella seduta segnalato', () => {
    expect(filterCandidates(list, { group: 'Spalle' }).every((x) => x.group === 'Spalle')).toBe(true)
    expect(filterCandidates(list, { equipment: 'cable' }).every((x) => x.equipment === 'cable')).toBe(true)
    const tpl = filterCandidates(list, { scope: 'templates' })
    expect(tpl.length).toBe(state.workoutTemplates[0].exercises.length)
    const withSession = buildCandidates({ templates: state.workoutTemplates, currentTemplateId: null, sessionExercises: [{ exerciseId: 'leg-press', name: 'Leg Press', equipment: 'machine', perHand: false }] })
    expect(withSession.find((x) => x.entry?.id === 'leg-press').inSession).toBe(true)
  })
})
