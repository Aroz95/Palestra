// Blocchi di nuoto nel formato "(200+100+2×75)×2": "2×75" = 2 ripetizioni da 75 m, ")×2" = ripeti il gruppo.

function tokenize(text) {
  const src = String(text).replace(/\s+/g, '').replace(/[x*X]/g, '×')
  const tokens = []
  for (let i = 0; i < src.length; ) {
    const c = src[i]
    if (/\d/.test(c)) {
      let j = i
      while (j < src.length && /\d/.test(src[j])) j++
      tokens.push({ t: 'n', v: Number(src.slice(i, j)) })
      i = j
    } else if ('+×()'.includes(c)) {
      tokens.push({ t: c })
      i++
    } else if (c === 'm' || c === 'M') {
      i++ // "100m" ammesso
    } else {
      throw new Error(`Carattere non valido "${c}"`)
    }
  }
  return tokens
}

export function parseBlock(text) {
  const tokens = tokenize(text)
  let pos = 0
  const peek = () => tokens[pos]
  const take = (t) => {
    const tok = tokens[pos]
    if (!tok || (t && tok.t !== t)) throw new Error(t === 'n' ? 'Atteso un numero' : `Atteso "${t}"`)
    pos++
    return tok
  }
  const repeat = (segs, n) => Array.from({ length: n }, () => segs).flat()

  function expr() {
    let segs = term()
    while (peek()?.t === '+') {
      take('+')
      segs = segs.concat(term())
    }
    return segs
  }
  function term() {
    let segs
    if (peek()?.t === '(') {
      take('(')
      segs = expr()
      take(')')
    } else {
      const n = take('n').v
      if (peek()?.t === '×') {
        take('×')
        if (peek()?.t === '(') {
          take('(')
          const inner = expr()
          take(')')
          segs = repeat(inner, n)
        } else {
          segs = repeat([take('n').v], n)
        }
      } else {
        segs = [n]
      }
    }
    while (peek()?.t === '×') {
      take('×')
      segs = repeat(segs, take('n').v)
    }
    return segs
  }

  if (!tokens.length) throw new Error('Blocco vuoto')
  const segments = expr()
  if (pos < tokens.length) throw new Error('Formato non riconosciuto')
  if (segments.some((s) => s <= 0)) throw new Error('Le distanze devono essere positive')
  return segments
}

export function blockTotal(b) {
  return (b.repeats ?? 1) * (b.segmentsM ?? []).reduce((a, s) => a + (Number(s) || 0), 0)
}

export function blocksTotal(blocks = []) {
  return blocks.reduce((a, b) => a + blockTotal(b), 0)
}

export function formatBlock(b) {
  if (b.text) return b.text
  const inner = (b.segmentsM ?? []).join('+')
  return (b.repeats ?? 1) > 1 ? `(${inner})×${b.repeats}` : inner
}

const MEASURED = ['measured', 'manually_counted']

// Distanze di una seduta di nuoto, tenendo separati previsto / effettivo / stimato
export function swimDistances(s) {
  const fromBlocks = s.plannedBlocks?.length ? blocksTotal(s.plannedBlocks) : null
  const planned = s.plannedDistanceM ?? fromBlocks
  const measured = MEASURED.includes(s.distanceSource) && s.actualDistanceM != null ? s.actualDistanceM : null
  let estimated = null
  if (measured == null && s.estimatedDistanceM && s.estimatedDistanceM.min != null) {
    const min = s.estimatedDistanceM.min
    const max = s.estimatedDistanceM.max ?? min
    estimated = { min: Math.min(min, max), max: Math.max(min, max) }
  }
  const pool = s.poolLengthM || null
  const dur = s.durationMin
  let pace = null // secondi per 100 m
  let laps = null
  if (measured != null) {
    if (dur && measured > 0) pace = { value: (dur * 60) / (measured / 100), estimated: false }
    if (pool) laps = { value: measured / pool, estimated: false }
  } else if (estimated) {
    if (dur && estimated.min > 0) pace = { min: (dur * 60) / (estimated.max / 100), max: (dur * 60) / (estimated.min / 100), estimated: true }
    if (pool) laps = { min: estimated.min / pool, max: estimated.max / pool, estimated: true }
  }
  return {
    planned,
    plannedFromBlocks: fromBlocks,
    plannedMismatch: s.plannedDistanceM != null && fromBlocks != null && s.plannedDistanceM !== fromBlocks,
    measured,
    estimated,
    quality: measured != null ? 'measured' : estimated ? 'estimated' : 'unknown',
    pace,
    laps,
    isPartial: !!s.isPartial,
  }
}

export function fmtPace(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`
}
