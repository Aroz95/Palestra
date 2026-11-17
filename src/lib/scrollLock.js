// Blocco dello scorrimento della pagina sotto un pannello a schermo intero o un foglio, con conteggio (pannelli annidati).
// Solo overflow: hidden su html/body: la pagina NON viene riposizionata. (Prima il body diventava position: fixed:
// su iPhone una pagina lunga diventava un unico livello fisso altissimo che Safari a volte non disegna, schermo
// nero con i tocchi che arrivano sotto.) Lo scorrimento "a catena" lo fermano overscroll-behavior e touch-action
// sui pannelli.
import { useEffect } from 'react'

let locks = 0
let saved = null

function lock() {
  if (locks++ > 0) return
  const h = document.documentElement.style
  const b = document.body.style
  saved = { html: h.overflow, body: b.overflow }
  h.overflow = 'hidden'
  b.overflow = 'hidden'
}

function unlock() {
  if (locks === 0) return
  if (--locks > 0 || !saved) return
  document.documentElement.style.overflow = saved.html
  document.body.style.overflow = saved.body
  saved = null
}

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    lock()
    return unlock
  }, [active])
}
