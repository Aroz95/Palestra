import { useCallback, useEffect, useRef, useState } from 'react'
import { idbGet, idbSetMany } from './db'
import { readJSON } from './storage'
import { migrateToV3 } from '../schema/migrate'
import { emptyState } from '../schema/factories'
import { toLocalISO } from './dates'

export const LEGACY_KEY = 'palestra:data' // dati v1/v2: non vengono mai cancellati (copia di ripristino)
const STATE_KEY = 'state'
export const FALLBACK_KEY = 'palestra:data:v3' // usato solo se IndexedDB non è disponibile

// ---- Caricamento ----
// IndexedDB → dati v3 salvati in ripiego (localStorage) → dati v2 da migrare → stato vuoto.
export async function loadState() {
  try {
    const stored = await idbGet(STATE_KEY)
    if (stored) return { state: migrateToV3(stored), backend: 'indexeddb' }
    // Dati scritti in ripiego quando IndexedDB non era disponibile: hanno la precedenza sulla v2
    const fallback = readJSON(FALLBACK_KEY, null)
    const legacy = readJSON(LEGACY_KEY, null)
    const source = fallback ?? legacy
    if (source) {
      const migrated = migrateToV3(source)
      const entries = [[STATE_KEY, migrated]]
      if (!fallback && legacy) entries.unshift(['legacy-snapshot', { savedAt: toLocalISO(), data: legacy }])
      // Snapshot di ripristino e nuovo stato nella stessa transazione: o entrambi o nessuno
      await idbSetMany(entries)
      return { state: migrated, backend: 'indexeddb', migrated: !fallback }
    }
    return { state: emptyState(), backend: 'indexeddb' }
  } catch (e) {
    // IndexedDB non disponibile o scrittura fallita: i dati originali restano dove sono
    const v3 = readJSON(FALLBACK_KEY, null)
    const legacy = readJSON(LEGACY_KEY, null)
    return { state: migrateToV3(v3 ?? legacy ?? null), backend: 'localstorage', warning: `IndexedDB non disponibile (${e.message}): uso l’archivio di ripiego del browser.` }
  }
}

// ---- Scrittura ----

async function writeState(state, backend, extra = []) {
  if (backend === 'indexeddb') return idbSetMany([...extra, [STATE_KEY, state]])
  // Ripiego: prima gli snapshot, poi lo stato (se lo stato fallisce, lo snapshot coincide con lo stato ancora valido)
  for (const [k, v] of extra) localStorage.setItem(`palestra:${k}`, JSON.stringify(v))
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(state)) // può lanciare QuotaExceededError
}

// Coda seriale: le scritture vengono applicate nell'ordine in cui sono richieste
export function createPersistence(backend, write = writeState) {
  let chain = Promise.resolve()
  const enqueue = (fn) => {
    const p = chain.then(fn)
    chain = p.catch(() => {})
    return p
  }
  // Salvataggi ordinari ancora in attesa vengono uniti: si scrive solo lo stato più recente
  // (con molti dati evita scritture accodate a ogni tasto). Un commit chiude il gruppo, così l'ordine resta quello delle richieste.
  let batch = null
  return {
    backend,
    save: (state) => {
      if (batch && !batch.started) {
        batch.state = state
        return batch.promise
      }
      const b = { state, started: false }
      b.promise = enqueue(() => {
        b.started = true
        return write(b.state, backend)
      })
      batch = b
      return b.promise
    },
    // Risolve solo a scrittura riuscita; con errore rifiuta e nulla viene scritto (stessa transazione)
    commit: (state, extra = []) => {
      batch = null
      return enqueue(() => write(state, backend, extra))
    },
  }
}

export function describeSaveError(e) {
  const quota = e?.name === 'QuotaExceededError' || /quota/i.test(e?.message ?? '')
  return quota
    ? 'Spazio di archiviazione del browser esaurito: le ultime modifiche NON sono salvate. Esporta subito un backup.'
    : `Salvataggio non riuscito (${e?.message ?? e}): le ultime modifiche NON sono salvate. Esporta un backup.`
}

// Stato persistente.
// - Le modifiche ordinarie vengono scritte subito (coda seriale), con stato visibile: saving / saved / error.
// - commit(next, snapshot) per import, ripristino e cancellazione: lo stato in memoria cambia SOLO dopo
//   che la scrittura è riuscita; in caso di errore resta lo stato precedente e l'errore viene propagato.
export function usePersistentState() {
  const [state, setState] = useState(null)
  const [status, setStatus] = useState({ loading: true, backend: null, warning: null, migrated: false, save: 'idle', error: null, savedAt: null })
  const store = useRef(null)
  const lastSaved = useRef(null)

  useEffect(() => {
    let alive = true
    loadState().then((r) => {
      if (!alive) return
      store.current = createPersistence(r.backend)
      lastSaved.current = r.state
      setState(r.state)
      setStatus((s) => ({ ...s, loading: false, backend: r.backend, warning: r.warning ?? null, migrated: !!r.migrated, save: 'saved' }))
    })
    return () => {
      alive = false
    }
  }, [])

  const markSaved = (s) => {
    lastSaved.current = s
    setStatus((st) => ({ ...st, save: 'saved', error: null, savedAt: toLocalISO() }))
  }
  const markError = (e) => setStatus((st) => ({ ...st, save: 'error', error: describeSaveError(e) }))

  // Salvataggio automatico delle modifiche ordinarie
  useEffect(() => {
    if (!state || !store.current || state === lastSaved.current) return
    setStatus((st) => ({ ...st, save: 'saving' }))
    store.current.save(state).then(() => markSaved(state), markError)
  }, [state])

  const commit = useCallback(async (next, snapshot = null) => {
    setStatus((st) => ({ ...st, save: 'saving' }))
    const extra = snapshot ? [[`snapshot:${snapshot.kind}`, { savedAt: toLocalISO(), label: snapshot.label ?? '', state: snapshot.state }]] : []
    try {
      await store.current.commit(next, extra)
    } catch (e) {
      markError(e)
      throw new Error(describeSaveError(e))
    }
    markSaved(next)
    setState(next)
  }, [])

  // Nuovo tentativo quando la pagina torna visibile dopo un errore
  useEffect(() => {
    const retry = () => {
      if (document.visibilityState !== 'visible' || !store.current) return
      setState((s) => (s && s !== lastSaved.current ? { ...s } : s))
    }
    document.addEventListener('visibilitychange', retry)
    return () => document.removeEventListener('visibilitychange', retry)
  }, [])

  return [state, setState, status, commit]
}

export async function getLegacySnapshot() {
  try {
    return (await idbGet('legacy-snapshot')) ?? null
  } catch {
    return null
  }
}

export async function getSnapshot(kind) {
  try {
    return (await idbGet(`snapshot:${kind}`)) ?? null
  } catch {
    return readJSON(`palestra:snapshot:${kind}`, null)
  }
}
