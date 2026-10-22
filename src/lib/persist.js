import { useCallback, useEffect, useRef, useState } from 'react'
import { idbGet, idbSet, idbSetMany } from './db'
import { readJSON } from './storage'
import { migrateToV3 } from '../schema/migrate'
import { emptyState } from '../schema/factories'
import { toLocalISO } from './dates'

export const LEGACY_KEY = 'palestra:data' // dati v1/v2: non vengono mai cancellati (copia di ripristino)
const STATE_KEY = 'state'
const FALLBACK_KEY = 'palestra:data:v3'

// Carica lo stato: IndexedDB → (prima volta) migrazione da localStorage → stato vuoto.
export async function loadState() {
  try {
    const stored = await idbGet(STATE_KEY)
    if (stored) {
      return { state: migrateToV3(stored), backend: 'indexeddb' }
    }
    const legacy = readJSON(LEGACY_KEY, null)
    if (legacy) {
      const migrated = migrateToV3(legacy)
      // Snapshot di rollback + nuovo stato nella stessa transazione
      await idbSetMany([
        ['legacy-snapshot', { savedAt: toLocalISO(), data: legacy }],
        [STATE_KEY, migrated],
      ])
      return { state: migrated, backend: 'indexeddb', migrated: true }
    }
    return { state: emptyState(), backend: 'indexeddb' }
  } catch (e) {
    // IndexedDB non disponibile (es. alcune modalità private): ripiego su localStorage
    const v3 = readJSON(FALLBACK_KEY, null)
    const legacy = readJSON(LEGACY_KEY, null)
    return { state: migrateToV3(v3 ?? legacy ?? null), backend: 'localstorage', warning: e.message }
  }
}

async function saveState(state, backend) {
  if (backend === 'indexeddb') return idbSet(STATE_KEY, state)
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(state)) // può lanciare QuotaExceededError
}

export function describeSaveError(e) {
  const quota = e?.name === 'QuotaExceededError' || /quota/i.test(e?.message ?? '')
  return quota
    ? 'Spazio di archiviazione del browser esaurito: l’ultima modifica NON è stata salvata. Esporta subito un backup.'
    : `Salvataggio non riuscito: ${e?.message ?? e}. Esporta un backup per non perdere i dati.`
}

// Stato persistente: salvataggio automatico con debounce, errori visibili, flush alla chiusura.
export function usePersistentState() {
  const [state, setState] = useState(null)
  const [status, setStatus] = useState({ loading: true, backend: null, error: null, warning: null, savedAt: null, migrated: false })
  const latest = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    let alive = true
    loadState().then((r) => {
      if (!alive) return
      latest.current = r.state
      setState(r.state)
      setStatus((s) => ({ ...s, loading: false, backend: r.backend, warning: r.warning ?? null, migrated: !!r.migrated }))
    })
    return () => {
      alive = false
    }
  }, [])

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
    const s = latest.current
    if (!s || !status.backend) return Promise.resolve()
    return saveState(s, status.backend).then(
      () => setStatus((st) => ({ ...st, error: null, savedAt: toLocalISO() })),
      (e) => setStatus((st) => ({ ...st, error: describeSaveError(e) })),
    )
  }, [status.backend])

  useEffect(() => {
    if (!state || status.loading) return
    latest.current = state
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 250)
  }, [state, status.loading, flush])

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && timer.current && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [flush])

  return [state, setState, status]
}

export const getLegacySnapshot = () => idbGet('legacy-snapshot').catch(() => null)
