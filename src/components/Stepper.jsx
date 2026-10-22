import { useEffect, useState } from 'react'

// Campo numerico con pulsanti − / +. Il valore si può anche digitare direttamente.
export default function Stepper({ value, onChange, step = 1, min = 0, suffix, label, disabled }) {
  const [text, setText] = useState(show(value))
  useEffect(() => setText(show(value)), [value])

  const commit = (raw) => {
    const n = parseFloat(String(raw).replace(',', '.'))
    if (Number.isFinite(n)) onChange(Math.max(min, round(n)))
    else setText(show(value))
  }
  const bump = (dir) => onChange(Math.max(min, round((Number(value) || 0) + dir * step)))

  return (
    <div className="flex flex-col items-center">
      {label && <span className="mb-0.5 text-[10px] uppercase tracking-wider text-slate-400">{label}</span>}
      <div className={`flex items-center rounded-xl bg-slate-800 ${disabled ? 'opacity-50' : ''}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => bump(-1)}
          className="h-10 w-9 rounded-l-xl text-xl text-slate-300 active:bg-slate-700"
          aria-label="Diminuisci"
        >
          −
        </button>
        <input
          inputMode="decimal"
          disabled={disabled}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onFocus={(e) => e.target.select()}
          className="h-10 w-12 bg-transparent text-center text-lg font-semibold tabular-nums text-white outline-none"
        />
        {suffix && <span className="-ml-1 pr-1 text-xs text-slate-400">{suffix}</span>}
        <button
          type="button"
          disabled={disabled}
          onClick={() => bump(1)}
          className="h-10 w-9 rounded-r-xl text-xl text-slate-300 active:bg-slate-700"
          aria-label="Aumenta"
        >
          +
        </button>
      </div>
    </div>
  )
}

const round = (n) => Math.round(n * 100) / 100
const show = (v) => String(v ?? '').replace('.', ',')
