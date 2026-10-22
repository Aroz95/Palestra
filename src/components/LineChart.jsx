// Grafico a linee leggero in SVG: un solo asse Y, tooltip al tocco/hover, legenda per ≥ 2 serie, tabella dei valori.
// Colori validati (scripts dataviz) su sfondo #0f172a: serie 1 #059669, serie 2 #0284c7.
import { useMemo, useRef, useState } from 'react'
import { parseDate, fmtDate } from '../lib/dates'
import { fmtNum } from '../lib/stats'

export const SERIES_COLORS = ['#059669', '#0284c7']
// Dimensioni vicine a quelle reali su telefono, così testo e punti non vengono rimpiccioliti
const W = 360
const H = 200
const PAD = { l: 40, r: 12, t: 12, b: 26 }

function niceTicks(min, max, n = 4) {
  if (min === max) {
    const d = Math.abs(min) * 0.05 || 1
    min -= d
    max += d
  }
  const raw = (max - min) / n
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}

export default function LineChart({ series, unit = '', digits = 1, label }) {
  const [hover, setHover] = useState(null)
  const ref = useRef(null)
  const all = series.flatMap((s) => s.points)
  const dates = useMemo(() => [...new Set(all.map((p) => p.date))].sort(), [all])

  if (!all.length) return <p className="py-6 text-center text-sm text-slate-500">Nessun dato nel periodo.</p>

  const xs = dates.map((d) => parseDate(d).getTime())
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const ticks = niceTicks(Math.min(...all.map((p) => p.value)), Math.max(...all.map((p) => p.value)))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const x = (date) => (xMax === xMin ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((parseDate(date).getTime() - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r))
  const y = (v) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b)

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    let best = null
    for (const d of dates) if (!best || Math.abs(x(d) - px) < Math.abs(x(best) - px)) best = d
    setHover(best)
  }

  const hoverVals = hover ? series.map((s) => ({ s, p: s.points.find((p) => p.date === hover) })).filter((v) => v.p) : []
  const xLabels = dates.length <= 2 ? dates : [dates[0], dates[Math.floor(dates.length / 2)], dates[dates.length - 1]]

  return (
    <figure className="space-y-2">
      {series.length > 1 && (
        <figcaption className="flex flex-wrap gap-3 text-xs text-slate-300">
          {series.map((s, i) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <svg width="18" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="18" y2="4" stroke={s.color ?? SERIES_COLORS[i]} strokeWidth="2" strokeDasharray={s.dashed ? '4 3' : undefined} />
              </svg>
              {s.name}
            </span>
          ))}
        </figcaption>
      )}
      <div className="relative">
        <svg
          ref={ref}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none select-none"
          role="img"
          aria-label={label}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#1e293b" strokeWidth="1" />
              <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmtNum(t, digits)}
              </text>
            </g>
          ))}
          {xLabels.map((d, i) => (
            <text key={d} x={x(d)} y={H - 8} textAnchor={i === 0 && xLabels.length > 1 ? 'start' : i === xLabels.length - 1 && xLabels.length > 1 ? 'end' : 'middle'} fontSize="11" fill="#94a3b8">
              {fmtDate(d, { day: 'numeric', month: 'short' })}
            </text>
          ))}
          {hover && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#475569" strokeWidth="1" />}
          {series.map((s, i) => {
            const color = s.color ?? SERIES_COLORS[i]
            const pts = s.points
            return (
              <g key={s.name}>
                {pts.length > 1 && (
                  <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={s.dashed ? '6 4' : undefined}
                    points={pts.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')}
                  />
                )}
                {pts.map((p) => (
                  <circle
                    key={p.date + p.value}
                    cx={x(p.date)}
                    cy={y(p.value)}
                    r={hover === p.date ? 5 : 4}
                    fill={s.dashed ? '#0f172a' : color}
                    stroke={s.dashed ? color : '#0f172a'}
                    strokeWidth="2"
                  />
                ))}
              </g>
            )
          })}
        </svg>
        {hover && hoverVals.length > 0 && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg border border-slate-700 bg-slate-900/95 px-2 py-1 text-xs shadow-lg"
            style={{ left: `${Math.min(70, Math.max(0, (x(hover) / W) * 100 - 15))}%` }}
          >
            <div className="text-slate-400">{fmtDate(hover, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            {hoverVals.map(({ s, p }) => (
              <div key={s.name} className="text-slate-100">
                {series.length > 1 && <span className="text-slate-400">{s.name}: </span>}
                {fmtNum(p.value, digits)} {unit}
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="text-xs text-slate-400">
        <summary className="cursor-pointer">Tabella valori</summary>
        <table className="mt-1 w-full text-left">
          <thead>
            <tr>
              <th className="py-1 font-medium">Data</th>
              {series.map((s) => (
                <th key={s.name} className="py-1 font-medium">{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((d) => (
              <tr key={d} className="border-t border-slate-800">
                <td className="py-1">{d}</td>
                {series.map((s) => {
                  const p = s.points.find((q) => q.date === d)
                  return (
                    <td key={s.name} className="py-1 text-slate-200">
                      {p ? `${fmtNum(p.value, digits)} ${unit}` : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
