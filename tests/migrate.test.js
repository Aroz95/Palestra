import { describe, expect, it } from 'vitest'
import { createInitialState as legacyV2State } from './fixtures/legacyV2'
import { migrateToV3 } from '../src/schema/migrate'
import { strengthStats, sessionDuration } from '../src/lib/stats'
import { SCHEMA_VERSION } from '../src/schema/constants'

describe('migrazione v2 → v3 (US-10)', () => {
  const legacy = legacyV2State()
  const v3 = migrateToV3(legacy)

  it('conserva tutte le sedute con i loro id', () => {
    expect(v3.schemaVersion).toBe(SCHEMA_VERSION)
    expect(v3.sessions.map((s) => s.id)).toEqual(legacy.sessions.map((s) => s.id))
    expect(v3.sessions.every((s) => s.kind === 'strength')).toBe(true)
    expect(v3.activeSessionId).toBe(legacy.activeSessionId)
  })

  it('i totali del 20/10 restano identici', () => {
    const s = v3.sessions.find((x) => x.date === '2026-10-20')
    const st = strengthStats(s)
    expect(st.sets).toBe(30)
    expect(st.reps).toBe(342)
    expect(st.volume).toBe(7386)
    expect(st.timeSets).toBe(3)
    expect(st.timeSeconds).toBe(90)
    expect(st.cardioMin).toBe(25)
    expect(st.cardioKm).toBeCloseTo(2.3, 1)
    expect(s.status).toBe('completed')
  })

  it('durata legacy mantenuta senza inventare orari', () => {
    const s = v3.sessions.find((x) => x.date === '2026-10-20')
    expect(s.startedAt).toBeNull()
    expect(s.endedAt).toBeNull()
    expect(sessionDuration(s)).toMatchObject({ min: 95, source: 'legacy' })
  })

  it('seduta attiva in corso con serie da fare', () => {
    const s = v3.sessions.find((x) => x.date === '2026-10-22')
    expect(s.status).toBe('in_progress')
    expect(s.warmup[0]).toMatchObject({ minutes: 10, speed: 5.5, done: true })
  })

  it('conserva note, perHand, velocità e progressione per serie', () => {
    const s = v3.sessions.find((x) => x.date === '2026-10-20')
    const curl = s.exercises.find((e) => e.exerciseId === 'curl-manubri')
    expect(curl.perHand).toBe(true)
    expect(curl.notes).toBe('Una progressione per serie')
    expect(curl.sets.map((x) => x.weight)).toEqual([6, 8, 10])
    const plank = s.exercises.find((e) => e.exerciseId === 'plank')
    expect(plank.type).toBe('time')
    expect(plank.sets[0].durationSec).toBe(30)
    expect(s.cooldown[1].note).toMatch(/Prima 4/)
  })

  it('la vecchia scheda diventa la Scheda A del programma principale', () => {
    expect(v3.programs).toHaveLength(1)
    expect(v3.programs[0].isMain).toBe(true)
    const t = v3.workoutTemplates[0]
    expect(t.label).toBe('A')
    expect(t.programId).toBe(v3.programs[0].id)
    expect(t.exercises).toHaveLength(11)
    expect(t.exercises[0]).toMatchObject({ id: 'leg-press', repMin: 12, repMax: 12, suggestedWeightKg: 60, restSeconds: 60 })
    expect(v3.sessions.every((s) => s.templateId === t.id)).toBe(true)
  })

  it('il peso di riferimento diventa una misura importata separata', () => {
    expect(v3.measurements).toHaveLength(1)
    expect(v3.measurements[0]).toMatchObject({ weightKg: 75, source: 'imported' })
  })

  it('stato v1 senza recuperi e stato vuoto della v2', () => {
    const v1 = legacyV2State()
    v1.version = 1
    v1.template.exercises.forEach((e) => delete e.rest)
    expect(migrateToV3(v1).workoutTemplates[0].exercises[0].restSeconds).toBe(60)
    const empty = migrateToV3({ version: 2, template: { name: 'La mia scheda', warmup: [], exercises: [], cooldown: [] }, sessions: [], activeSessionId: null, settings: {} })
    expect(empty.programs).toHaveLength(0)
    expect(empty.sessions).toHaveLength(0)
  })

  it('è idempotente su dati già v3', () => {
    expect(migrateToV3(v3)).toEqual({ ...v3 })
  })
})
