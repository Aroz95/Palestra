import { useEffect, useState } from 'react'

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage pieno o non disponibile (es. navigazione privata): ignoriamo
  }
}

// Stato React sincronizzato con localStorage.
// migrate (opzionale) converte i dati salvati da versioni precedenti.
export function useLocalStorage(key, init, migrate) {
  const [value, setValue] = useState(() => {
    const stored = readJSON(key, undefined)
    if (stored !== undefined) return migrate ? migrate(stored) : stored
    return typeof init === 'function' ? init() : init
  })
  useEffect(() => {
    writeJSON(key, value)
  }, [key, value])
  return [value, setValue]
}
