// Promemoria dei pasti: eventi nel calendario del telefono (sempre affidabili) e notifiche dell'app (solo ad app aperta).
import { useState } from 'react'
import { Select, Sheet, Toggle } from '../ui'
import { DEFAULT_REMINDERS, LEAD_OPTIONS, mealEvents, notificationPermission, notificationsSupported, showMealNotification, toICS } from '../../lib/mealReminders'
import { downloadBlob } from '../../lib/download'
import { todayISO } from '../../lib/dates'

const DAYS = 14
const leadLabel = (m) => (m === 0 ? 'All’orario del pasto' : `${m} minuti prima`)

export default function RemindersSheet({ open, onClose, state, update, plan }) {
  const cfg = { ...DEFAULT_REMINDERS, ...(state.settings.mealReminders ?? {}) }
  const set = (patch) => update((s) => ({ ...s, settings: { ...s.settings, mealReminders: { ...cfg, ...patch } } }))
  const [perm, setPerm] = useState(notificationPermission)
  const [msg, setMsg] = useState('')
  const events = open && plan ? mealEvents(state, plan, todayISO(), DAYS) : []
  const example = events[0]

  const toggle = async (enabled) => {
    setMsg('')
    if (enabled && notificationsSupported()) setPerm(Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission)
    set({ enabled })
  }
  const exportCalendar = async () => {
    const name = `Pasti · ${plan.name}`
    const file = new File([toICS(events, { name, leadMin: cfg.leadMin })], 'promemoria-pasti.ics', { type: 'text/calendar' })
    try {
      // su iPhone la condivisione apre direttamente "Aggiungi al calendario"
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name })
      else downloadBlob(file.name, file)
      setMsg(`File del calendario creato: ${events.length} promemoria.`)
    } catch (e) {
      if (e?.name !== 'AbortError') downloadBlob(file.name, file)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Promemoria dei pasti">
      <div className="space-y-5 text-sm">
        <label className="block space-y-1">
          <span className="text-[13px] font-medium text-muted">Quando avvisare</span>
          <Select value={String(cfg.leadMin)} onChange={(v) => set({ leadMin: Number(v) })} options={LEAD_OPTIONS.map((m) => ({ value: String(m), label: leadLabel(m) }))} aria-label="Quando avvisare" />
        </label>

        <section className="space-y-2" aria-label="Calendario del telefono">
          <h3 className="text-base font-semibold text-fg">Nel calendario del telefono</h3>
          <p className="text-fg-soft">
            Il modo affidabile: l’avviso arriva anche con l’app chiusa e dice cosa c’è da mangiare. Crea un evento per ogni pasto con orario dei prossimi {DAYS} giorni, con la variante del giorno e le alternative già scelte.
          </p>
          {example && (
            <p className="rounded-xl bg-surface-muted px-3 py-2 text-fg">
              <span className="text-xs font-semibold text-muted">Esempio di avviso · {example.time}</span>
              <br />
              <b className="font-semibold">{example.label}</b>
              {example.text ? `: ${example.text}` : ''}
            </p>
          )}
          <button onClick={exportCalendar} disabled={!events.length} className="btn-primary w-full">
            Aggiungi al calendario ({events.length})
          </button>
          {!events.length && <p className="text-muted">{plan ? 'Nessun pasto con orario nei prossimi giorni: aggiungi gli orari ai pasti con “Modifica”.' : 'Nessun piano alimentare.'}</p>}
          <p className="text-xs text-muted">Se cambi il piano, aggiungi di nuovo il file: gli eventi esistenti si aggiornano.</p>
        </section>

        <section className="space-y-2 border-t border-line pt-4" aria-label="Notifiche dell’app">
          <h3 className="text-base font-semibold text-fg">Notifiche dell’app</h3>
          <Toggle checked={cfg.enabled} onChange={toggle} label="Avvisami quando è ora di un pasto" />
          <p className="text-fg-soft">Funzionano solo mentre l’app è aperta o appena messa in secondo piano: ad app chiusa il telefono non le consegna. I pasti già registrati non vengono ricordati.</p>
          {!notificationsSupported() && <p className="text-warning">Questo browser non consente le notifiche. Su iPhone aggiungi prima l’app alla schermata Home.</p>}
          {cfg.enabled && perm === 'denied' && <p className="text-warning">Le notifiche sono bloccate nelle impostazioni del telefono per questa app.</p>}
          {cfg.enabled && perm === 'granted' && (
            <button
              onClick={async () => setMsg((await showMealNotification(example?.label ?? 'Promemoria pasto', example?.text || 'Qui vedrai cosa c’è da mangiare.', 'meal-test')) ? 'Notifica di prova inviata.' : 'Notifica non riuscita su questo dispositivo.')}
              className="btn-ghost w-full"
            >
              Invia una notifica di prova
            </button>
          )}
        </section>
        <p role="status" className="min-h-5 text-fg-soft">{msg}</p>
      </div>
    </Sheet>
  )
}
