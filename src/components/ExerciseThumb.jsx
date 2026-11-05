// Miniatura dell'esercizio: illustrazioni di un unico set (Everkinetic, CC BY-SA 4.0, public/exercises/LICENSE.md),
// stesso autore e stesso stile per tutto il catalogo. Dimensione fissa (nessuno spostamento del layout), caricamento
// differito, testo alternativo. Esercizi senza illustrazione nel set: riquadro neutro con le iniziali, nessun disegno
// di stile diverso.
import { catalogMatch } from '../schema/catalog'

const initials = (name) =>
  String(name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

export default function ExerciseThumb({ ex, entry, size = 40, className = '' }) {
  const c = entry ?? catalogMatch(ex)
  const name = c?.name ?? ex?.name ?? 'Esercizio'
  const box = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line ${className}`
  if (c?.image) {
    return (
      <span className={`${box} bg-white`} style={{ width: size, height: size }}>
        <img src={c.image} alt={`Illustrazione: ${name}`} width={size} height={size} loading="lazy" decoding="async" className="h-full w-full object-contain" />
      </span>
    )
  }
  return (
    <span className={`${box} bg-surface-muted text-xs font-semibold text-muted`} style={{ width: size, height: size }} role="img" aria-label={`${name}: illustrazione non disponibile`}>
      {initials(name)}
    </span>
  )
}
