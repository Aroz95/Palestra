// Riepilogo del giorno in un colpo d'occhio: pasti registrati, calorie e macro programmati rispetto all'obiettivo.
// Solo valori presenti nel piano o registrati: nessuna stima (ND resta ND, i totali incompleti sono dichiarati).
import { fmtNum } from '../../lib/stats'

const MACROS = [
  ['proteinG', 'Proteine'],
  ['carbsG', 'Carboidrati'],
  ['fatG', 'Grassi'],
]

function Ring({ done, total }) {
  const r = 22
  const c = 2 * Math.PI * r
  const pct = total ? Math.min(1, done / total) : 0
  return (
    <div className="relative h-16 w-16 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 52 52" className="h-full w-full -rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="5" className="stroke-surface-strong" />
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-out" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums text-fg">
        {done}/{total}
      </span>
    </div>
  )
}

function Bar({ value, target, over }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-strong" aria-hidden="true">
      <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${over ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function DaySummary({ meals, loggedCount, planned, target, consumed, training, previewing }) {
  const val = (t, k) => (t?.[k]?.status === 'complete' ? t[k].value : null)
  const kcal = val(planned, 'kcal')
  const tKcal = target?.kcal.value ?? null
  const cKcal = consumed?.kcal?.value ?? null
  const partial = planned?.kcal.status === 'partial'
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Ring done={loggedCount} total={meals} />
        <div className="min-w-0 flex-1 space-y-1">
          <p data-testid="day-summary" className="text-sm text-fg-soft">
            <b className="font-semibold text-fg">
              {loggedCount} di {meals} registrati
            </b>{' '}
            · {training ? 'giorno di allenamento' : 'giorno di riposo'}
          </p>
          {kcal != null ? (
            <>
              <p className="text-sm tabular-nums text-fg-soft">
                <b className="text-xl font-bold text-fg">{fmtNum(kcal, 0)}</b> kcal programmate
                {tKcal != null && <> · obiettivo {fmtNum(tKcal, 0)}</>}
              </p>
              {tKcal != null && <Bar value={kcal} target={tKcal} over={kcal > tKcal * 1.05} />}
            </>
          ) : (
            <p className="text-sm tabular-nums text-fg-soft">
              {partial ? (
                <>
                  <b className="text-xl font-bold text-fg">{fmtNum(planned.kcal.value, 0)}</b> kcal in {planned.kcal.known} pasti su {planned.kcal.total} <span className="text-muted">(gli altri senza valori)</span>
                </>
              ) : (
                <span className="text-muted">Calorie non indicate nel piano</span>
              )}
              {tKcal != null && <> · obiettivo {fmtNum(tKcal, 0)}</>}
            </p>
          )}
          {cKcal != null && (
            <p className="text-xs tabular-nums text-muted">
              Registrato finora: {fmtNum(cKcal, 0)} kcal{consumed.kcal.status !== 'complete' ? ' (parziale)' : ''}
            </p>
          )}
          {previewing && <p className="text-xs font-medium text-fg-soft">Con l’anteprima delle alternative</p>}
        </div>
      </div>
      {MACROS.some(([k]) => val(planned, k) != null) && (
        <dl className="grid grid-cols-3 gap-3">
          {MACROS.map(([k, label]) => {
            const v = val(planned, k)
            const t = target?.[k].value ?? null
            return (
              <div key={k} className="min-w-0 space-y-1">
                <dt className="truncate text-xs text-muted">{label}</dt>
                <dd className="text-sm tabular-nums text-fg">
                  <b className="font-semibold">{v == null ? 'ND' : fmtNum(v, 0)}</b>
                  {t != null && <span className="text-muted"> / {fmtNum(t, 0)}</span>} g
                </dd>
                {v != null && t != null && <Bar value={v} target={t} over={v > t * 1.1} />}
              </div>
            )
          })}
        </dl>
      )}
    </div>
  )
}
