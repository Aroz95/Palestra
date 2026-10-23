import { useState } from 'react'
import { Chip, Empty, Segmented } from './ui'
import { fmtNum, fmtRange, strengthStats, sessionDuration } from '../lib/stats'
import { swimDistances } from '../lib/swim'
import { fmtDateShort } from '../lib/dates'
import { SESSION_STATUS } from '../schema/constants'
import { exportSession, fileNames } from '../lib/report'
import { downloadJSON } from '../lib/download'

export default function HistoryView({ state, onOpen, onDelete }) {
  const [kind, setKind] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const list = state.sessions
    .filter((s) => (kind === 'all' || s.kind === kind) && (!from || s.date >= from) && (!to || s.date <= to))
    .sort((a, b) => (b.date + (b.startedAt ?? '')).localeCompare(a.date + (a.startedAt ?? '')))

  return (
    <div className="space-y-3">
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { id: 'all', label: 'Tutte' },
          { id: 'strength', label: 'Palestra' },
          { id: 'swim', label: 'Nuoto' },
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Dal
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm text-fg" />
        </label>
        <label className="text-xs text-muted">
          Al
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm text-fg" />
        </label>
      </div>
      <p className="px-1 text-xs text-muted">{list.length} sedute</p>
      {list.length === 0 && <Empty>Nessuna seduta registrata con questi filtri.</Empty>}
      {list.map((s) => {
        const d = sessionDuration(s)
        return (
          <div key={s.id} className={`rounded-2xl border p-4 ${s.id === state.activeSessionId ? 'border-primary bg-surface' : 'border-line bg-surface'}`}>
            <button onClick={() => onOpen(s.id)} className="block w-full text-left">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold capitalize text-fg">{fmtDateShort(s.date)}</span>
                <Chip>{SESSION_STATUS[s.status]}</Chip>
              </div>
              <div className="text-sm text-muted">
                {s.kind === 'swim' ? '🏊 Nuoto' : '🏋️ Palestra'} · {s.title || '—'}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.kind === 'swim' ? <SwimChips s={s} /> : <StrengthChips s={s} />}
                {d.min != null && <Chip>{d.min} min</Chip>}
                {s.energy?.activeKcal && <Chip className="bg-warning-soft text-warning">{fmtRange(s.energy.activeKcal, 0, 'kcal attive')}{s.energy.source === 'estimate' ? ' (stima)' : ''}</Chip>}
              </div>
            </button>
            <div className="mt-3 flex gap-2">
              <button onClick={() => onOpen(s.id)} className="btn-ghost text-sm">Apri</button>
              <button onClick={() => downloadJSON(fileNames.session(s), exportSession(s))} className="btn-ghost text-sm">Esporta JSON</button>
              <button onClick={() => confirm('Eliminare definitivamente questa seduta?') && onDelete(s.id)} className="ml-auto rounded-xl px-3 py-2 text-sm text-danger active:bg-danger-soft">
                Elimina
              </button>
            </div>
          </div>
        )
      })}
      <p className="px-1 text-xs text-muted">
        Volume nominale (ripetizioni × carico; manubri ×2): indicativo e non confrontabile tra macchine diverse.
      </p>
    </div>
  )
}

function StrengthChips({ s }) {
  const st = strengthStats(s)
  return (
    <>
      <Chip>{st.sets} serie</Chip>
      <Chip>{fmtNum(st.reps, 0)} rip.</Chip>
      <Chip>{fmtNum(st.volume, 0)} kg{st.volumePartial ? ' (parz.)' : ''}</Chip>
      {st.timeSets > 0 && <Chip>a tempo {st.timeSets} × · {st.timeSeconds}s</Chip>}
      {st.cardioMin > 0 && <Chip>cardio {fmtNum(st.cardioMin)} min · {fmtNum(st.cardioKm, 2)} km</Chip>}
    </>
  )
}

function SwimChips({ s }) {
  const d = swimDistances(s)
  return (
    <>
      {d.measured != null && <Chip>{fmtNum(d.measured, 0)} m</Chip>}
      {d.estimated && <Chip className="bg-warning-soft text-warning">{fmtRange(d.estimated, 0, 'm')} stimati</Chip>}
      {d.quality === 'unknown' && <Chip>distanza non nota</Chip>}
      {d.planned != null && <Chip>{fmtNum(d.planned, 0)} m previsti</Chip>}
      {d.isPartial && <Chip>abbreviata</Chip>}
    </>
  )
}
