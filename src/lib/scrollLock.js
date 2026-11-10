// Blocco dello scorrimento della pagina sotto un pannello a schermo intero o una finestra.
// Su iOS Safari un trascinamento su un pannello fisso che non ha nulla da scorrere viene passato alla pagina sotto:
// la pagina scorre dietro e compare la sua barra. overflow: hidden non basta su iOS, quindi il body viene fissato
// nella posizione corrente e ripristinato alla chiusura (stessa posizione di scorrimento). Con più pannelli aperti
// uno sopra l'altro il blocco resta finché non si chiude l'ultimo.
import { useEffect } from 'react'

let locks = 0
let saved = null

function lock() {
  if (locks++ > 0) return
  const y = window.scrollY
  const b = document.body.style
  saved = { y, position: b.position, top: b.top, left: b.left, right: b.right, overflow: b.overflow }
  Object.assign(b, { position: 'fixed', top: `-${y}px`, left: '0', right: '0', overflow: 'hidden' })
}

function unlock() {
  if (--locks > 0 || !saved) return
  const { y, ...prev } = saved
  Object.assign(document.body.style, prev)
  saved = null
  window.scrollTo(0, y)
}

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    lock()
    return unlock
  }, [active])
}
