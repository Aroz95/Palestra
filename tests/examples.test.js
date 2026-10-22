import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseImport, previewImport, applyImport } from '../src/lib/import'
import { emptyState } from '../src/schema/factories'
import { swimDistances } from '../src/lib/swim'

const dir = path.resolve(__dirname, '../docs/examples')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))

describe('esempi documentati in docs/examples', () => {
  it.each(files)('%s è valido e importabile', (f) => {
    const r = parseImport(fs.readFileSync(path.join(dir, f), 'utf8'))
    expect(r.errors).toEqual([])
    const res = applyImport(emptyState(), r.batch, previewImport(emptyState(), r.batch))
    expect(res.log.inserted.length).toBeGreaterThan(0)
  })

  it('il programma d’esempio: piano nuoto del martedì = 2450 m', () => {
    const r = parseImport(fs.readFileSync(path.join(dir, 'programma-ab.json'), 'utf8'))
    const tue = r.batch.programs[0].program.weeklySchedule.find((s) => s.weekday === 2)
    expect(tue.swimPlan.plannedDistanceM).toBe(2450)
  })

  it('la nuotata d’esempio resta una stima', () => {
    const r = parseImport(fs.readFileSync(path.join(dir, 'nuoto-2026-10-21.json'), 'utf8'))
    expect(swimDistances(r.batch.sessions[0].item)).toMatchObject({ measured: null, estimated: { min: 1500, max: 1800 }, planned: 2450 })
  })
})

describe('reimport dello stesso file (US-07)', () => {
  it.each(files)('%s: la seconda importazione risulta identica', (f) => {
    const text = fs.readFileSync(path.join(dir, f), 'utf8')
    const r1 = parseImport(text)
    const once = applyImport(emptyState(), r1.batch, previewImport(emptyState(), r1.batch)).state
    const pv = previewImport(once, parseImport(text).batch)
    expect(pv.items.every((i) => i.status === 'identical' || i.status === 'duplicate')).toBe(true)
  })
})
