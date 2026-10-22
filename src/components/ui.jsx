// Componenti di interfaccia condivisi
import { useEffect } from 'react'

export function Section({ title, right, children, className = '' }) {
  return (
    <section className={className}>
      {(title || right) && (
        <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
          {title && <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function Card({ children, className = '', tone = 'default' }) {
  const tones = {
    default: 'border-slate-800 bg-slate-900',
    done: 'border-emerald-700/60 bg-emerald-950/30',
    warn: 'border-amber-700/50 bg-amber-950/40',
    info: 'border-sky-800/60 bg-sky-950/40',
  }
  return <div className={`rounded-2xl border p-4 ${tones[tone]} ${className}`}>{children}</div>
}

export function Chip({ children, className = '' }) {
  return <span className={`inline-block rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300 ${className}`}>{children}</span>
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div role="tablist" className={`flex gap-1 overflow-x-auto rounded-xl bg-slate-900 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`shrink-0 flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
            value === o.id ? 'bg-slate-700 text-white' : 'text-slate-400'
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
      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

const inputCls = 'w-full rounded-xl bg-slate-800 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]'

export function TextInput({ value, onChange, ...rest }) {
  return <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls} {...rest} />
}

export function TextArea({ value, onChange, rows = 2, ...rest }) {
  return <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={rows} className={inputCls} {...rest} />
}

// Numero opzionale: stringa vuota = null (dato non registrato), 0 resta 0
export function NumberInput({ value, onChange, step = 'any', min = 0, max, ...rest }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      max={max}
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.')
        if (raw === '') return onChange(null)
        const n = Number(raw)
        if (Number.isFinite(n)) onChange(n)
      }}
      className={inputCls}
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
          className={`h-9 min-w-9 rounded-lg px-2 text-sm font-semibold ${value === n ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
        >
          {labels?.[n] ?? n}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </label>
  )
}

// Pannello a comparsa dal basso
export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-slate-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="btn-ghost text-sm" aria-label="Chiudi">
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
    <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
      {children}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

// Valore con unità; null = "ND" (non disponibile), distinto da 0
export function Metric({ label, value, unit, hint, estimate }) {
  return (
    <div className="rounded-xl bg-slate-800/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">
        {label}
        {estimate && <span className="ml-1 rounded bg-amber-500/20 px-1 text-amber-300">stima</span>}
      </div>
      <div className="font-semibold text-white">
        {value ?? 'ND'}
        {value != null && unit ? <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span> : null}
      </div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  )
}
