// Fine allenamento (SES-01): avviso per le serie mancanti, seduta salvata, esportazione facoltativa, riepilogo.
// La seduta viene salvata come completata PRIMA della finestra: chiuderla, ricaricare o non esportare non perde nulla.
import { Card, Metric, Section, Sheet } from './ui'
import { fmtNum, fmtClock, personalRecords, sessionDuration, strengthStats, DURATION_SOURCES } from '../lib/stats'
import { fmtDate } from '../lib/dates'
import { isRescheduled } from '../lib/sessionDates'

// Serie e attività cardio non completate (non vengono mai segnate come fatte chiudendo la seduta)
export function pendingCount(session) {
  const sets = (session.exercises ?? []).reduce((n, ex) => n + ex.sets.filter((s) => !s.done).length, 0)
  const cardio = [...(session.warmup ?? []), ...(session.cooldown ?? [])].filter((c) => !c.done).length
  return { sets, cardio, total: sets + cardio }
}

export function IncompleteSheet({ open, pending, onBack, onConfirm }) {
  return (
    <Sheet open={open} onClose={onBack} title="Allenamento non completo">
      {pending && (
        <div className="space-y-4">
          <p className="text-fg-soft">
            {[pending.sets && `${pending.sets} ${pending.sets === 1 ? 'serie' : 'serie'}`, pending.cardio && `${pending.cardio} ${pending.cardio === 1 ? 'attività cardio' : 'attività cardio'}`].filter(Boolean).join(' e ')}{' '}
            {pending.total === 1 ? 'non è stata completata' : 'non sono state completate'}. Se concludi, {pending.total === 1 ? 'resta registrata' : 'restano registrate'} come non {pending.total === 1 ? 'svolta' : 'svolte'}.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button onClick={onConfirm} className="btn-primary flex-1">Concludi comunque</button>
            <button onClick={onBack} className="btn-ghost flex-1">Torna alla seduta</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

// Seduta salvata: esportazione facoltativa (anche ripetibile), poi conferma. Chiudere la finestra equivale a confermare.
export function SavedSheet({ open, session, exportState, onExport, onConfirm }) {
  const d = session ? sessionDuration(session) : null
  const st = session ? strengthStats(session) : null
  return (
    <Sheet open={open} onClose={onConfirm} title="Allenamento salvato">
      {session && (
        <div className="space-y-4">
          <p className="text-fg-soft">
            {d.min != null ? `${d.min} min · ` : ''}
            {st.doneSets} {st.doneSets === 1 ? 'serie' : 'serie'} su {st.totalSets}. La seduta è già nello storico.
          </p>
          <div className="flex flex-col gap-2">
            <button onClick={onExport} className="btn-ghost">
              {exportState?.ok ? 'Esporta di nuovo' : 'Esporta allenamento (JSON)'}
            </button>
            <p role="status" className={`min-h-5 text-sm ${exportState?.error ? 'text-danger' : 'text-fg-soft'}`}>
              {exportState?.error ? `Esportazione non riuscita: ${exportState.error}. Puoi riprovare; la seduta è comunque salvata.` : exportState?.ok ? '✓ File generato. L’esportazione è facoltativa.' : ''}
            </p>
            <button onClick={onConfirm} className="btn-primary">Conferma e concludi</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

// Riepilogo dell'allenamento appena concluso: solo dati registrati (ND se mancano)
export function SessionSummary({ session, sessions, onHistory, onHome, onExport }) {
  const st = strengthStats(session)
  const d = sessionDuration(session)
  const records = personalRecords(sessions, { from: session.date, to: session.date }).newInPeriod.filter((r) => session.exercises.some((ex) => ex.name === r.name))
  const cardio = [...session.warmup.map((c) => ({ ...c, section: 'Riscaldamento' })), ...session.cooldown.map((c) => ({ ...c, section: 'Defaticamento' }))]
  return (
    <div className="anim-fade-up space-y-5" data-testid="session-summary">
      <header>
        <p className="text-sm font-semibold text-primary">Allenamento concluso</p>
        <h1 className="text-[28px] font-bold leading-tight text-fg">{session.title || 'Seduta'}</h1>
        <p className="text-sm capitalize text-muted">
          {fmtDate(session.date)}
          {isRescheduled(session) && <span className="normal-case"> · programmata per {fmtDate(session.plannedDate, { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Durata" value={d.min} unit="min" hint={d.source ? DURATION_SOURCES[d.source] : 'non registrata'} />
        <Metric label="Serie" value={`${st.doneSets}/${st.totalSets}`} hint="svolte / previste" />
        <Metric label="Ripetizioni" value={st.sets ? fmtNum(st.reps, 0) : null} />
        <Metric label="Volume" value={st.sets ? fmtNum(st.volume, 0) : null} unit="kg" hint={st.volumePartial ? 'parziale: carichi mancanti' : 'nominale'} />
      </div>

      {records.length > 0 && (
        <Section title="Nuovi record">
          <Card className="space-y-1 text-sm">
            {records.map((r) => (
              <p key={r.key} className="text-fg">
                <b>{r.name}</b>: {r.reps} × {fmtNum(r.weight, 2)} kg <span className="text-muted">(prima {r.prevBest.reps} × {fmtNum(r.prevBest.weight, 2)} kg)</span>
              </p>
            ))}
          </Card>
        </Section>
      )}

      {cardio.length > 0 && (
        <Section title="Cardio">
          <Card className="space-y-1 text-sm">
            {cardio.map((c) => (
              <p key={c.id} className={c.done ? 'text-fg' : 'text-muted'}>
                {c.section}: {c.name} · {fmtNum(c.minutes)} min{c.speed ? ` · ${fmtNum(c.speed)} km/h` : ''} {c.done ? '' : '(non svolto)'}
              </p>
            ))}
          </Card>
        </Section>
      )}

      <Section title="Esercizi">
        <div className="space-y-2">
          {session.exercises.map((ex) => {
            const done = ex.sets.filter((s) => s.done)
            return (
              <Card key={ex.id} className="space-y-1 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-fg">{ex.name}</span>
                  <span className="tabular-nums text-muted">
                    {done.length}/{ex.sets.length}
                  </span>
                </div>
                {done.length > 0 ? (
                  <p className="tabular-nums text-fg-soft">
                    {done.map((s) => (ex.type === 'time' ? `${s.durationSec ?? '—'} s` : `${s.reps ?? '—'} × ${s.weight == null ? '—' : fmtNum(s.weight, 2)} kg`)).join(' · ')}
                    {ex.perHand && ex.type !== 'time' ? ' (per mano)' : ''}
                  </p>
                ) : (
                  <p className="text-muted">Non svolto</p>
                )}
                {ex.restChosen && <p className="text-muted">Recupero scelto: {fmtClock(ex.rest * 1000)}</p>}
                {ex.notes && <p className="text-fg-soft">“{ex.notes}”</p>}
              </Card>
            )
          })}
        </div>
      </Section>

      {(session.feedback?.notes || session.note) && (
        <Section title="Note">
          <Card className="text-sm text-fg-soft">{session.feedback?.notes || session.note}</Card>
        </Section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onHistory} className="btn-primary flex-1">Vai allo storico</button>
        <button onClick={onHome} className="btn-ghost flex-1">Torna alla home</button>
        <button onClick={onExport} className="btn-ghost flex-1">Esporta JSON</button>
      </div>
    </div>
  )
}
