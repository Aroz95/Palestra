// MOB-01: l'interfaccia non si ingrandisce né si sposta con il pinch a due dita.
// - touch-action: pan-x pan-y (CSS) disattiva pinch e doppio tocco per lo zoom, lasciando lo scorrimento con un dito;
// - su Safari iOS anche gli eventi gesture* (solo quelli: nessun preventDefault sui normali touchmove).
// Disattivabile in Altro → Opzioni per chi usa lo zoom della pagina come ausilio; lo Zoom di accessibilità di iOS
// e le dimensioni del testo di Safari restano sempre disponibili.
import { useEffect } from 'react'
import { useLocalStorage } from './storage'

const prevent = (e) => e.preventDefault()

export function usePinchLock() {
  const [locked, setLocked] = useLocalStorage('palestra:pinch-lock', true)
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('allow-zoom', !locked)
    if (!locked) return
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, prevent, { passive: false })
    return () => {
      for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.removeEventListener(t, prevent)
    }
  }, [locked])
  return [locked, setLocked]
}
