import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPersistence, describeSaveError, loadState, FALLBACK_KEY, LEGACY_KEY } from '../src/lib/persist'
import { idbGet, idbSet } from '../src/lib/db'
import { createInitialState as legacyV2State } from './fixtures/legacyV2'
import { emptyState } from '../src/schema/factories'

function memoryStorage() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() }
}

beforeEach(async () => {
  globalThis.localStorage = memoryStorage()
  await idbSet('state', undefined)
  await idbSet('legacy-snapshot', undefined)
})

describe('commit transazionale (P0-01)', () => {
  it('con datastore che fallisce il commit rifiuta e non risulta salvato', async () => {
    const quota = Object.assign(new Error('quota exceeded'), { name: 'QuotaExceededError' })
    const p = createPersistence('indexeddb', async () => {
      throw quota
    })
    await expect(p.commit({ a: 1 })).rejects.toBe(quota)
    expect(describeSaveError(quota)).toMatch(/NON sono salvate/)
  })

  it('le scritture sono serializzate nell’ordine di richiesta', async () => {
    const log = []
    const p = createPersistence('indexeddb', async (s) => {
      await new Promise((r) => setTimeout(r, s.delay))
      log.push(s.n)
    })
    await Promise.all([p.save({ n: 1, delay: 30 }), p.commit({ n: 2, delay: 0 }), p.save({ n: 3, delay: 5 })])
    expect(log).toEqual([1, 2, 3]) // ordine delle richieste rispettato anche con tempi di scrittura diversi
  })

  it('salvataggi ravvicinati uniti in una sola scrittura dello stato più recente', async () => {
    const log = []
    const p = createPersistence('indexeddb', async (s) => {
      await new Promise((r) => setTimeout(r, 10))
      log.push(s.n)
    })
    await Promise.all([p.save({ n: 1 }), p.save({ n: 2 }), p.save({ n: 3 })])
    expect(log).toEqual([3])
  })

  it('un commit non viene mai superato da salvataggi precedenti', async () => {
    const log = []
    const p = createPersistence('indexeddb', async (s) => log.push(s.n))
    await Promise.all([p.save({ n: 1 }), p.commit({ n: 2 }), p.save({ n: 3 }), p.save({ n: 4 })])
    expect(log).toEqual([1, 2, 4])
  })

  it('un errore non blocca le scritture successive della coda', async () => {
    let fail = true
    const p = createPersistence('indexeddb', async () => {
      if (fail) {
        fail = false
        throw new Error('disco')
      }
    })
    await expect(p.save({})).rejects.toThrow('disco')
    await expect(p.save({})).resolves.toBeUndefined()
  })

  it('snapshot e stato nella stessa transazione IndexedDB', async () => {
    const p = createPersistence('indexeddb')
    const prev = { ...emptyState(), goals: [{ id: 'g' }] }
    await p.commit(emptyState(), [['snapshot:import', { state: prev }]])
    expect((await idbGet('snapshot:import')).state.goals).toHaveLength(1)
    expect((await idbGet('state')).goals).toHaveLength(0)
  })

  it('ripiego localStorage: quota esaurita → errore propagato, stato precedente intatto', async () => {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify({ old: true }))
    localStorage.setItem = () => {
      throw Object.assign(new Error('full'), { name: 'QuotaExceededError' })
    }
    const p = createPersistence('localstorage')
    await expect(p.commit({ new: true })).rejects.toThrow('full')
  })
})

describe('caricamento e recupero (P0-03)', () => {
  it('i dati v3 scritti in ripiego hanno la precedenza sulla v2 quando IndexedDB torna disponibile', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacyV2State()))
    localStorage.setItem(FALLBACK_KEY, JSON.stringify({ ...emptyState(), goals: [{ id: 'g1', label: 'x', history: [] }] }))
    const r = await loadState()
    expect(r.state.goals).toHaveLength(1)
    expect(r.state.sessions).toHaveLength(0)
    expect((await idbGet('state')).goals).toHaveLength(1)
  })

  it('IndexedDB non disponibile durante la migrazione: dati v2 intatti, app usabile in ripiego', async () => {
    const legacy = legacyV2State()
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy))
    const db = await import('../src/lib/db')
    const spy = vi.spyOn(db, 'idbGet').mockRejectedValue(new Error('IndexedDB bloccato'))
    try {
      const r = await loadState()
      expect(r.backend).toBe('localstorage')
      expect(r.warning).toMatch(/IndexedDB non disponibile/)
      expect(r.state.sessions).toHaveLength(2)
      expect(JSON.parse(localStorage.getItem(LEGACY_KEY))).toEqual(legacy)
    } finally {
      spy.mockRestore()
    }
  })

  it('migrazione ripetuta (refresh) non duplica né altera i dati', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacyV2State()))
    const a = await loadState()
    const b = await loadState()
    const c = await loadState()
    expect(b.state).toEqual(a.state)
    expect(c.state.sessions).toHaveLength(2)
    expect(b.migrated).toBeFalsy()
  })
})
