// Controllo di impaginazione eseguito nella pagina: trova ciò che i test di "scorrimento orizzontale" non vedono
// (html/body tagliano l'eccedenza): elementi che escono dallo schermo o dal proprio contenitore, testo tagliato
// senza puntini, aree toccabili troppo piccole, barre che scorrono di lato.
export function auditLayout(page, { minTap = 44 } = {}) {
  return page.evaluate((minTap) => {
    const vw = document.documentElement.clientWidth
    const out = []
    const desc = (el) => {
      const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50)
      return `<${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 3).join('.') : ''}> "${t}"`
    }
    const scroller = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p)
        if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return p
      }
      return null
    }
    const hiddenByAncestor = (el) => {
      for (let p = el; p; p = p.parentElement) {
        const s = getComputedStyle(p)
        if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0 || p.hasAttribute('inert')) return true
        if (p.classList?.contains('sr-only')) return true
      }
      return false
    }
    // solo lo strato in primo piano: se c'è una finestra aperta, si controlla quella
    const dialogs = [...document.querySelectorAll('[role=dialog]')]
    const roots = dialogs.length ? [dialogs[dialogs.length - 1]] : [document.body]
    const seen = new Set()
    for (const root of roots) {
      for (const el of root.querySelectorAll('*')) {
        const r = el.getBoundingClientRect()
        if (r.width < 1 || r.height < 1 || hiddenByAncestor(el)) continue
        if (el.closest('svg') && el.tagName !== 'svg') continue
        const cs = getComputedStyle(el)
        const inScroller = scroller(el)
        // 1. fuori dallo schermo
        if ((r.right > vw + 1 || r.left < -1) && !inScroller && cs.position !== 'fixed') {
          if (![...seen].some((s) => s.contains(el))) out.push({ kind: 'fuori-schermo', el: desc(el), by: Math.round(Math.max(r.right - vw, -r.left)) })
          seen.add(el)
        }
        // 2. fuori dal contenitore (pulsante o testo che esce dalla card)
        const p = el.parentElement
        if (p && p !== document.body && cs.position !== 'absolute' && cs.position !== 'fixed' && !inScroller) {
          const pr = p.getBoundingClientRect()
          const ps = getComputedStyle(p)
          const ml = parseFloat(cs.marginLeft) || 0
          const mr = parseFloat(cs.marginRight) || 0
          if (ps.overflowX === 'visible' && ps.display !== 'contents' && ml >= 0 && mr >= 0 && (r.right > pr.right + 1.5 || r.left < pr.left - 1.5)) {
            out.push({ kind: 'fuori-contenitore', el: desc(el), parent: desc(p), by: Math.round(Math.max(r.right - pr.right, pr.left - r.left)) })
          }
        }
        // 3. testo tagliato senza puntini
        if (el.scrollWidth > el.clientWidth + 1 && /(hidden|clip)/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis' && el.childElementCount === 0 && el.textContent.trim()) {
          out.push({ kind: 'testo-tagliato', el: desc(el), by: el.scrollWidth - el.clientWidth })
        }
        // 4. barre che scorrono di lato
        // (ammesse: anteprime di codice e tabelle di dati, che scorrono per natura)
        if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && !/^(TEXTAREA|PRE)$/.test(el.tagName) && !el.querySelector(':scope > table')) {
          out.push({ kind: 'scorre-di-lato', el: desc(el), by: el.scrollWidth - el.clientWidth })
        }
        // 5. aree toccabili
        // 5. aree toccabili: alte almeno 44 px e larghe almeno 32 (i +/− affiancati di un campo numerico).
        //    Esclusi: interruttori (è toccabile tutta la riga), link dentro un testo, eccezioni dichiarate (data-tap-ok)
        if (/^(BUTTON|SELECT|INPUT|SUMMARY)$/.test(el.tagName) && el.type !== 'hidden' && el.type !== 'file' && !el.disabled && el.getAttribute('role') !== 'switch' && !el.closest('[data-tap-ok]')) {
          // (il campo tra − e + di un contatore fa parte di un controllo unico: basta che contenga il numero)
          if (r.height < minTap - 0.5 || r.width < (el.tagName === 'INPUT' ? 24 : 32) - 0.5) out.push({ kind: 'area-piccola', el: desc(el), by: `${Math.round(r.width)}x${Math.round(r.height)}` })
        }
      }
    }
    return out
  }, minTap)
}
