// P0-03: migrazione e ripristino con un backup v2 realistico (anonimizzato) — tests/fixtures/backup-v2-reale.json
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { migrateToV3 } from '../src/schema/migrate'
import { strengthStats, sessionDuration } from '../src/lib/stats'
import { parseImport, previewImport, applyImport } from '../src/lib/import'
import { exportBackup } from '../src/lib/report'
import { emptyState } from '../src/schema/factories'

const raw = fs.readFileSync(path.resolve(__dirname, 'fixtures/backup-v2-reale.json'), 'utf8')
const legacy = JSON.parse(raw)
const v3 = migrateToV3(JSON.parse(raw))
const s22 = v3.sessions.find((s) => s.date === '2026-10-22')

describe('backup v2 reale → v3', () => {
  it('nessuna perdita di serie, ripetizioni, carichi e cardio del 22/10 (valori calcolati a mano)', () => {
    const st = strengthStats(s22)
    expect(st.sets).toBe(22)
    expect(st.reps).toBe(250)
    expect(st.volume).toBe(4844)
    expect(st.volumePartial).toBe(false)
    expect(st.timeSets).toBe(2)
    expect(st.timeSeconds).toBe(55)
    expect(st.cardioMin).toBe(20)
    expect(s22.status).toBe('completed')
  })

  it('ogni serie completata della v2 resta completata con gli stessi valori', () => {
    const legacy22 = legacy.sessions.find((s) => s.date === '2026-10-22')
    legacy22.exercises.forEach((lex, i) => {
      const ex = s22.exercises[i]
      expect(ex.name).toBe(lex.name)
      expect(ex.sets.map((x) => x.done)).toEqual(lex.sets.map((x) => !!x.done))
      if (ex.type === 'time') expect(ex.sets.map((x) => x.durationSec)).toEqual(lex.sets.map((x) => x.reps))
      else expect(ex.sets.map((x) => [x.reps, x.weight])).toEqual(lex.sets.map((x) => [x.reps, x.weight]))
    })
  })

  it('durata manuale 95 min conservata, orari non inventati', () => {
    expect(s22.startedAt).toBeNull()
    expect(s22.endedAt).toBeNull()
    expect(sessionDuration(s22)).toMatchObject({ min: 95, source: 'legacy' })
  })

  it('Hyperextension riconosciuto come corpo libero (carico 0, non dato mancante)', () => {
    const h = s22.exercises.find((e) => e.exerciseId === 'hyperextension')
    expect(h.equipment).toBe('bodyweight')
    expect(h.sets.every((x) => x.weight === 0 && x.done)).toBe(true)
    const tex = v3.workoutTemplates[0].exercises.find((e) => e.id === 'hyperextension')
    expect(tex).toMatchObject({ equipment: 'bodyweight', suggestedWeightKg: 0, repMin: 12, repMax: 12 })
  })

  it('per mano, note di seduta/esercizio e velocità conservati', () => {
    const curl = s22.exercises.find((e) => e.exerciseId === 'curl-manubri')
    expect(curl).toMatchObject({ perHand: true, equipment: 'dumbbell', notes: 'Seconda serie più pesante' })
    expect(s22.note).toBe('Recupero dopo nuoto del 21/10. Nessun cedimento.')
    expect(s22.cooldown.map((c) => c.speed)).toEqual([5.5, 3.75])
  })

  it('la scheda originale diventa A e non viene contaminata dall’import di nuove schede', () => {
    const before = JSON.stringify(v3.workoutTemplates[0])
    const program = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../docs/examples/programma-ab.json'), 'utf8'))
    const r = parseImport(JSON.stringify(program))
    const next = applyImport(v3, r.batch, previewImport(v3, r.batch)).state
    expect(JSON.stringify(next.workoutTemplates.find((t) => t.id === 'scheda-a'))).toBe(before)
    expect(next.workoutTemplates.map((t) => t.label)).toEqual(['A', 'A', 'B'])
    expect(next.sessions).toEqual(v3.sessions)
  })

  it('backup v3 esportato → archivio pulito → dati equivalenti', () => {
    const file = JSON.parse(JSON.stringify(exportBackup(v3)))
    const r = parseImport(JSON.stringify(file))
    expect(r.errors).toEqual([])
    const restored = applyImport(emptyState(), r.batch, previewImport(emptyState(), r.batch), { mode: 'replace' }).state
    for (const k of ['programs', 'workoutTemplates', 'sessions', 'measurements', 'settings']) expect(restored[k]).toEqual(v3[k])
  })

  it('il backup v2 originale resta importabile anche dopo la migrazione (merge senza duplicati)', () => {
    const r = parseImport(raw)
    const pv = previewImport(v3, r.batch)
    expect(pv.items.filter((i) => i.collection === 'sessions').every((i) => i.status === 'identical')).toBe(true)
  })
})
