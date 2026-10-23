// Icone a tratto (24×24, currentColor): sostituiscono le emoji nella navigazione
const PATHS = {
  today: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  training: 'M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11',
  diet: 'M7 3v7.5M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 10.5V21M17 21v-7h-3V8c0-3 1.5-5 3-5z',
  progress: 'M3 3v18h18M7 15l4-4 3 3 6-7',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
}

export function Icon({ name, className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={name === 'more' ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
