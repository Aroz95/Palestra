// Archivio chiave/valore su IndexedDB (datastore principale dei dati v3).
const DB_NAME = 'palestra'
const STORE = 'kv'

let dbPromise = null

function open() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB non disponibile'))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Apertura IndexedDB fallita'))
    req.onblocked = () => reject(new Error('IndexedDB bloccato da un’altra scheda aperta'))
  })
  dbPromise.catch(() => (dbPromise = null))
  return dbPromise
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const store = t.objectStore(STORE)
        const req = fn(store)
        t.oncomplete = () => resolve(req?.result)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error ?? new Error('Transazione annullata'))
      }),
  )
}

export const idbGet = (key) => tx('readonly', (s) => s.get(key))
export const idbSet = (key, value) => tx('readwrite', (s) => s.put(value, key))

// Scrive più chiavi in un'unica transazione (tutte o nessuna)
export const idbSetMany = (entries) =>
  tx('readwrite', (s) => {
    for (const [k, v] of entries) s.put(v, k)
  })

export function resetDbForTests() {
  dbPromise = null
}
