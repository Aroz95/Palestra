import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialState as legacyV2State } from './fixtures/legacyV2'
import { loadState, LEGACY_KEY } from '../src/lib/persist'
import { idbGet, idbSet } from '../src/lib/db'

function memoryStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  }
}

beforeEach(async () => {
  globalThis.localStorage = memoryStorage()
  await idbSet('state', undefined)
  await idbSet('legacy-snapshot', undefined)
})

describe('persistenza e migrazione dei dati salvati', () => {
  it('primo avvio dopo l’aggiornamento: migra, crea lo snapshot e non cancella i dati vecchi', async () => {
    const legacy = legacyV2State()
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))
    const r = await loadState()
    expect(r.backend).toBe('indexeddb')
    expect(r.migrated).toBe(true)
    expect(r.state.sessions).toHaveLength(2)
    expect(JSON.parse(localStorage.getItem(LEGACY_KEY))).toEqual(legacy) // copia di ripristino intatta
    const snap = await idbGet('legacy-snapshot')
    expect(snap.data).toEqual(legacy)
    expect((await idbGet('state')).schemaVersion).toBe(4)
  })

  it('avvii successivi leggono IndexedDB e non rimigrano', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacyV2State()))
    const first = await loadState()
    const changed = { ...first.state, sessions: first.state.sessions.slice(0, 1) }
    await idbSet('state', changed)
    const second = await loadState()
    expect(second.migrated).toBeFalsy()
    expect(second.state.sessions).toHaveLength(1)
  })

  it('nuovo utente: stato vuoto', async () => {
    const r = await loadState()
    expect(r.state.programs).toHaveLength(0)
    expect(r.state.sessions).toHaveLength(0)
  })
})
