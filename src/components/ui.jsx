// Componenti di interfaccia condivisi
import { useEffect, useRef, useState } from 'react'

export function Section({ title, right, children, className = '' }) {
  return (
    <section className={className}>
      {(title || right) && (
        <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
          {title && <h2 className="text-lg font-semibold leading-tight text-fg">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function Card({ children, className = '', tone = 'default' }) {
  const tones = {
    default: 'border-line bg-surface',
    done: 'border-primary/50 bg-primary-soft',
    warn: 'border-warning/50 bg-warning-soft',
    info: 'border-swim/40 bg-swim-soft',
    muted: 'border-line bg-surface-muted',
  }
  return <div className={`rounded-2xl border p-4 ${tones[tone]} ${className}`}>{children}</div>
}

export function Chip({ children, className = '' }) {
  // colori personalizzati: niente sfondo/testo predefiniti (classi in conflitto darebbero un risultato casuale)
  const base = /(^|\s)bg-/.test(className) ? '' : 'border border-line bg-surface-muted text-fg-soft'
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${base} ${className}`}>{children}</span>
}

export function Segmented({ options, value, onChange, className = '', ...rest }) {
  return (
    <div role="tablist" {...rest} className={`flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface-muted p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-10 shrink-0 flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
            value === o.id ? 'bg-surface text-fg shadow-sm ring-1 ring-line' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[13px] font-medium text-fg-soft">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

const inputCls = 'min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-base text-fg outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 aria-[invalid=true]:border-danger'

export function TextInput({ value, onChange, ...rest }) {
  return <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls} {...rest} />
}

export function TextArea({ value, onChange, rows = 2, ...rest }) {
  return <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={rows} className={inputCls} {...rest} />
}

// Numero opzionale: campo vuoto = null (dato non registrato), 0 resta 0.
// Campo di testo con tastiera decimale: accetta la virgola (tastiera italiana di iPhone) e il punto.
const showNum = (v) => (v == null ? '' : String(v).replace('.', ','))
export function NumberInput({ value, onChange, step, min = 0, max = Infinity, ...rest }) {
  const [text, setText] = useState(showNum(value))
  const [invalid, setInvalid] = useState(false)
  const last = useRef(value)
  useEffect(() => {
    if (value !== last.current) {
      last.current = value
      setText(showNum(value))
      setInvalid(false)
    }
  }, [value])
  const handle = (raw) => {
    setText(raw)
    const t = raw.trim().replace(',', '.')
    if (t === '') {
      setInvalid(false)
      last.current = null
      return onChange(null)
    }
    const n = /^-?\d*\.?\d+$|^-?\d+\.?$/.test(t) ? Number(t) : NaN
    const ok = Number.isFinite(n) && n >= min && n <= max
    setInvalid(!ok)
    if (!ok) return // valore non valido o incompleto: non viene salvato
    last.current = n
    onChange(n)
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => handle(e.target.value)}
      onBlur={() => {
        if (invalid) {
          setText(showNum(value))
          setInvalid(false)
        }
      }}
      aria-invalid={invalid || undefined}
      className={`${inputCls} ${invalid ? 'ring-2 ring-danger' : ''}`}
      {...rest}
    />
  )
}

export function Select({ value, onChange, options, ...rest }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// Valutazione 1..max (tocca di nuovo per azzerare)
export function Rating({ value, onChange, max = 5, min = 1, labels }) {
  const vals = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return (
    <div className="flex flex-wrap gap-1">
      {vals.map((n) => (
        <button
          type="button"
          key={n}
          onClick={() => onChange(value === n ? null : n)}
          aria-pressed={value === n}
          className={`h-11 min-w-11 rounded-lg px-2 text-sm font-semibold tabular-nums transition-colors duration-150 ${value === n ? 'bg-primary text-on-primary' : 'border border-line bg-surface-muted text-fg-soft'}`}
        >
          {labels?.[n] ?? n}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-fg">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 ${checked ? 'bg-primary' : 'bg-surface-strong'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full transition-all ${checked ? 'left-6 bg-on-primary' : 'left-1 bg-muted'}`} />
      </button>
    </label>
  )
}

// Pannello a comparsa dal basso (finestra di dialogo): focus all'interno, Tab ciclico, Esc chiude, focus ripristinato
export function Sheet({ open, onClose, title, children }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const box = ref.current
    const focusables = () => [...box.querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null)
    // focus sul pannello (non su un campo: su mobile non apre la tastiera da solo)
    box.focus({ preventScroll: true })
    const onKey = (e) => {
      if (e.key === 'Escape') return closeRef.current()
      if (e.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      const [f, l] = [list[0], list[list.length - 1]]
      if (e.shiftKey && (document.activeElement === f || document.activeElement === box)) {
        e.preventDefault()
        l.focus()
      } else if (!e.shiftKey && document.activeElement === l) {
        e.preventDefault()
        f.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true })
    }
  }, [open])
  if (!open) return null
  return (
    <div className="anim-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-[var(--backdrop)] sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="anim-sheet max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-[20px] border border-line bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] outline-none sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
          <button onClick={onClose} className="btn-ghost h-11 w-11 px-0 text-sm" aria-label="Chiudi">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Empty({ children, action }) {
  return (
    <div className="anim-fade-up rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">
      {children}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

// Valore con unità; null = "ND" (non disponibile), distinto da 0
export function Metric({ label, value, unit, hint, estimate }) {
  return (
    <div className="rounded-xl bg-surface-muted px-3 py-2">
      <div className="text-xs font-medium text-muted">
        {label}
        {estimate && <span className="ml-1 rounded bg-warning-soft px-1 font-semibold text-warning">stima</span>}
      </div>
      <div className="text-lg font-bold tabular-nums text-fg">
        {value ?? 'ND'}
        {value != null && unit ? <span className="ml-1 text-xs font-normal text-muted">{unit}</span> : null}
      </div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  )
}
