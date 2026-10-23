// Blocchi di nuoto. Sintassi (documentata in docs/SCHEMA.md):
// - distanza in metri: "500" (anche "500m")
// - somma di tratti: "200+100"
// - ripetizioni "N×D" oppure "D×N": il numero minore di 25 è il numero di ripetizioni, l'altro la distanza
//   ("4×100" = "100×4" = 4 da 100 m); se entrambi sono ≥ 25 l'espressione è ambigua e va scritta con le parentesi
// - gruppi tra parentesi: "(200+100)×2" o "2×(200+100)"; accanto a un gruppo ogni numero è un numero di ripetizioni
// - annidamento: "(100×3)×4" = 12 da 100 m
// Separatori di moltiplicazione accettati: x, X, ×, *.
export const MIN_DISTANCE_M = 25
export const MAX_REPEATS = 100
export const MAX_SEGMENTS = 1000

function tokenize(text) {
  const src = String(text ?? '').replace(/\s+/g, '').replace(/[xX*]/g, '×')
  const tokens = []
  for (let i = 0; i < src.length; ) {
    const c = src[i]
    if (/\d/.test(c)) {
      let j = i
      while (j < src.length && /\d/.test(src[j])) j++
      tokens.push({ t: 'n', v: Number(src.slice(i, j)), raw: src.slice(i, j) })
      i = j
      if (src[i] === 'm' || src[i] === 'M') i++ // "100m" ammesso
    } else if ('+×()'.includes(c)) {
      tokens.push({ t: c })
      i++
    } else if (c === ',' || c === '.') {
      throw new Error('Usa solo metri interi (niente decimali)')
    } else {
      throw new Error(`Carattere non valido "${c}"`)
    }
  }
  return tokens
}

const repeat = (segs, n) => Array.from({ length: n }, () => segs).flat()
const checkReps = (n) => {
  if (!Number.isInteger(n) || n < 1 || n > MAX_REPEATS) throw new Error(`Le ripetizioni devono essere tra 1 e ${MAX_REPEATS} (trovato ${n})`)
  return n
}
const checkSize = (segs) => {
  if (segs.length > MAX_SEGMENTS) throw new Error(`Troppi tratti (${segs.length}, massimo ${MAX_SEGMENTS})`)
  return segs
}

// Restituisce l'elenco delle distanze dei singoli tratti, nell'ordine in cui vanno nuotati.
// Lancia un Error con un messaggio leggibile se l'espressione non è valida o è ambigua.
export function parseBlock(text) {
  const tokens = tokenize(text)
  if (!tokens.length) throw new Error('Blocco vuoto')
  let pos = 0
  const peek = () => tokens[pos]
  const describe = (tok) => (!tok ? 'la fine del testo' : tok.t === 'n' ? `"${tok.raw}"` : `"${tok.t}"`)

  // fattore: numero oppure gruppo tra parentesi
  function factor() {
    const tok = peek()
    if (tok?.t === 'n') {
      pos++
      return { num: tok.v }
    }
    if (tok?.t === '(') {
      pos++
      const segs = expr()
      if (peek()?.t !== ')') throw new Error('Manca la parentesi di chiusura ")"')
      pos++
      return { group: segs }
    }
    throw new Error(tok ? `Atteso un numero o "(" al posto di ${describe(tok)}` : 'Espressione incompleta: manca un numero alla fine')
  }

  // termine: fattori uniti da ×, risolti in tratti
  function term() {
    const factors = [factor()]
    while (peek()?.t === '×') {
      pos++
      factors.push(factor())
    }
    const groups = factors.filter((f) => f.group)
    const nums = factors.filter((f) => !f.group).map((f) => f.num)
    if (groups.length > 1) throw new Error('Non si possono moltiplicare due gruppi tra parentesi tra loro')
    if (groups.length === 1) return checkSize(nums.reduce((segs, n) => repeat(segs, checkReps(n)), groups[0].group))
    if (nums.length === 1) {
      if (nums[0] <= 0) throw new Error('Le distanze devono essere positive')
      return [nums[0]]
    }
    const expr = nums.join('×')
    const distances = nums.filter((n) => n >= MIN_DISTANCE_M)
    if (distances.length === 0) throw new Error(`"${expr}": nessuna distanza riconoscibile (le distanze partono da ${MIN_DISTANCE_M} m)`)
    if (distances.length > 1) throw new Error(`"${expr}" è ambiguo: non è chiaro quale numero sia la distanza. Metti la distanza tra parentesi, es. "${nums[0]}×(${nums[1]})"`)
    const dist = distances[0]
    const counts = nums.filter((n, i) => i !== nums.indexOf(dist))
    return checkSize(counts.reduce((segs, n) => repeat(segs, checkReps(n)), [dist]))
  }

  function expr() {
    let segs = term()
    while (peek()?.t === '+') {
      pos++
      segs = checkSize(segs.concat(term()))
    }
    return segs
  }

  const segments = expr()
  if (pos < tokens.length) throw new Error(peek().t === ')' ? 'Parentesi di chiusura ")" senza apertura' : `Formato non riconosciuto vicino a ${describe(peek())}`)
  return segments
}

// Anteprima per l'interfaccia: { ok, segments, count, totalM } oppure { ok: false, error }
export function previewBlock(text) {
  if (!String(text ?? '').trim()) return null
  try {
    const segments = parseBlock(text)
    return { ok: true, segments, count: segments.length, totalM: segments.reduce((a, b) => a + b, 0) }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// Tratti salvati, espansi con le ripetizioni del blocco
export const expandedSegments = (b) => repeat(b.segmentsM ?? [], b.repeats ?? 1)

// Blocchi salvati in passato con segmenti che non corrispondono al testo (es. "(100×3)×4" letto come 100 tratti da 3 m).
// Restituisce, per ogni blocco con testo valido ma segmenti diversi, i segmenti rigenerati. Non modifica nulla.
export function blockIssues(blocks = []) {
  const out = []
  for (const b of blocks) {
    if (!b.text) continue
    const pv = previewBlock(b.text)
    if (!pv?.ok) continue
    const saved = expandedSegments(b)
    if (saved.length !== pv.segments.length || saved.some((x, i) => x !== pv.segments[i])) {
      out.push({ id: b.id, text: b.text, saved: { count: saved.length, totalM: blockTotal(b) }, regenerated: { segmentsM: pv.segments, count: pv.count, totalM: pv.totalM } })
    }
  }
  return out
}

export function regenerateBlocks(blocks, issues) {
  const byId = Object.fromEntries(issues.map((i) => [i.id, i]))
  return blocks.map((b) => (byId[b.id] ? { ...b, repeats: 1, segmentsM: byId[b.id].regenerated.segmentsM } : b))
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
