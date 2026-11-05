// CAT-02 — Miniature degli esercizi: pittogrammi schematici per schema di movimento, disegnati per questa app
// (nessuna immagine esterna: niente licenze di terzi, nessun download, funzionano offline e nei due temi).
// Dimensione fissa (nessuno spostamento del layout); esercizi senza corrispondenza → icona generica coerente.
import { catalogMatch } from '../schema/catalog'

// Ogni figura: percorsi a tratto (M/L) e teste (cerchi pieni) su una griglia 48 × 48
export const PATTERNS = {
  push: { d: 'M12 14V38M8 34H24M16 18V32H28V42M16 21H31M33 16V26', heads: [[16, 12]], label: 'spinta in avanti da seduto' },
  bench: { d: 'M6 32H42M10 32V40M38 32V40M14 29H31L37 36M18 28V17M10 16H26', heads: [[10, 27]], dots: [[10, 16], [26, 16]], label: 'distensioni su panca' },
  fly: { d: 'M24 15V32M24 19H15V27M24 19H33V27M11 14V32M37 14V32M18 32L16 42M30 32L32 42', heads: [[24, 10]], label: 'croci' },
  pulldown: { d: 'M8 7H40M24 3V7M24 22V34M24 24L15 15L12 7M24 24L33 15L36 7M16 34H32M24 34L30 42', heads: [[24, 18]], label: 'trazione dall’alto' },
  row: { d: 'M14 18L16 32H32V40M15 22L31 24M33 24H42M44 18V30', heads: [[13, 14]], label: 'trazione orizzontale' },
  legpress: { d: 'M8 20L15 38M12 24L16 34M16 34L26 26L34 32M38 20V40', heads: [[9, 17]], label: 'pressa per le gambe' },
  legext: { d: 'M10 12V34M10 34H26M13 14V32M13 32H26L38 27M13 18H22', heads: [[13, 9]], dots: [[38, 27]], label: 'estensione delle gambe' },
  legcurl: { d: 'M4 31H32M6 28H30M30 28L38 28L38 16M10 31V40M30 31V40', heads: [[5, 24]], dots: [[38, 18]], label: 'flessione delle gambe' },
  squat: { d: 'M13 13H35M24 13L22 26L32 30L30 41M22 26L16 32L18 41', heads: [[24, 8]], dots: [[13, 13], [35, 13]], label: 'squat' },
  lunge: { d: 'M22 12V26L32 30V41M22 26L15 34L9 41M22 16L20 26', heads: [[22, 8]], dots: [[20, 28]], label: 'affondo' },
  bridge: { d: 'M4 22H14M9 21L26 25L36 25L36 40M14 22V40', heads: [[7, 18]], label: 'spinta dei fianchi' },
  hinge: { d: 'M18 13L29 24V41M20 16V32M12 32H30', heads: [[16, 10]], dots: [[12, 32], [30, 32]], label: 'stacco (cerniera d’anca)' },
  hyperext: { d: 'M12 30L30 22M30 22L40 34M26 26L38 40M14 26L12 34', heads: [[9, 32]], label: 'estensione lombare' },
  overhead: { d: 'M24 18V34M24 21H14V9M24 21H34V9M10 9H18M30 9H38M17 34H31', heads: [[24, 14]], label: 'spinta sopra la testa' },
  raise: { d: 'M24 12V28L20 41M24 28L28 41M24 16H10M24 16H38', heads: [[24, 8]], dots: [[9, 16], [39, 16]], label: 'alzate' },
  curl: { d: 'M20 12V28L18 41M20 28L22 41M20 15V25L29 17', heads: [[20, 8]], dots: [[30, 16]], label: 'curl per i bicipiti' },
  pushdown: { d: 'M31 3V28M27 28H35M20 12V28L18 41M20 28L22 41M20 15L23 23L29 28', heads: [[20, 8]], label: 'spinta in basso al cavo' },
  skull: { d: 'M6 32H42M10 32V40M38 32V40M14 29H31L37 36M18 28V18L12 14', heads: [[10, 27]], dots: [[12, 14]], label: 'estensioni per i tricipiti' },
  dip: { d: 'M8 22H18M30 22H40M24 14V28M24 16L18 22M24 16L30 22M24 28L24 36L30 39', heads: [[24, 10]], label: 'dip alle parallele' },
  pushup: { d: 'M4 40H44M10 30L38 36M14 31V40M38 36V40', heads: [[8, 27]], label: 'piegamenti' },
  plank: { d: 'M4 40H44M12 31L38 36M13 33V40H19M38 36V40', heads: [[9, 29]], label: 'plank' },
  crunch: { d: 'M4 40H44M14 30L22 38M22 38L32 30L38 40', heads: [[12, 26]], label: 'crunch' },
  legraise: { d: 'M4 40H44M8 38H24L34 18', heads: [[6, 35]], label: 'sollevamento delle gambe' },
  calf: { d: 'M14 41H34M24 12V28L22 37L24 40M24 28L26 37L28 40', heads: [[24, 8]], label: 'sollevamento sui polpacci' },
  abduct: { d: 'M24 12V28M16 28H32M24 28L14 40M24 28L34 40M10 34V44M38 34V44', heads: [[24, 8]], label: 'abduzione / adduzione' },
}
const GENERIC = { d: 'M10 24H38M14 18V30M10 20V28M34 18V30M38 20V28', heads: [], label: 'esercizio' }

export default function ExerciseThumb({ ex, entry, size = 40, className = '' }) {
  const c = entry ?? catalogMatch(ex)
  const fig = (c && PATTERNS[c.pattern]) || (ex?.type === 'time' ? PATTERNS.plank : GENERIC)
  const name = c?.name ?? ex?.name ?? 'Esercizio'
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-line bg-surface-muted text-fg-soft ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 48 48" width={size - 8} height={size - 8} role="img" aria-label={`${name}: ${fig.label}`} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={fig.d} />
        {fig.heads.map(([x, y], i) => (
          <circle key={`h${i}`} cx={x} cy={y} r="3.6" fill="currentColor" stroke="none" />
        ))}
        {(fig.dots ?? []).map(([x, y], i) => (
          <circle key={`d${i}`} cx={x} cy={y} r="2.4" fill="currentColor" stroke="none" />
        ))}
      </svg>
    </span>
  )
}
