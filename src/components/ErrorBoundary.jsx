// Schermata di emergenza: se un errore blocca il disegno, invece di uno schermo vuoto si vedono il messaggio
// e i pulsanti per uscire. I dati restano salvati sul telefono (IndexedDB): niente viene cancellato.
import { Component } from 'react'

const UI_KEYS = ['palestra:workout-mode', 'palestra:tab', 'palestra:subtabs']

export default class ErrorBoundary extends Component {
  state = { error: null, details: false }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('Errore di interfaccia', error, info?.componentStack)
    this.stack = `${error?.stack ?? ''}\n${info?.componentStack ?? ''}`.trim()
  }
  render() {
    const { error, details } = this.state
    if (!error) return this.props.children
    const { onReset, compact } = this.props
    const reload = () => {
      try {
        UI_KEYS.forEach((k) => localStorage.removeItem(k))
      } catch {
        /* nessun problema: si ricarica comunque */
      }
      location.reload()
    }
    const text = `${error?.message ?? error}\n\n${this.stack ?? ''}`
    return (
      <div role="alert" className={`${compact ? 'fixed inset-0 z-[70]' : 'min-h-dvh'} overflow-y-auto bg-bg px-4 pb-8 pt-[calc(env(safe-area-inset-top)+1.5rem)] text-fg`}>
        <div className="mx-auto max-w-md space-y-4">
          <h1 className="text-2xl font-bold">Qualcosa si è bloccato</h1>
          <p className="text-fg-soft">
            I tuoi dati sono al sicuro sul telefono, compreso l’allenamento in corso: nulla è stato cancellato.
          </p>
          <div className="flex flex-col gap-2">
            {onReset && (
              <button
                onClick={() => {
                  this.setState({ error: null })
                  onReset()
                }}
                className="btn-primary"
              >
                Esci dalla modalità allenamento
              </button>
            )}
            <button onClick={reload} className={onReset ? 'btn-ghost' : 'btn-primary'}>
              Ricarica l’app
            </button>
            <button onClick={() => this.setState({ details: !details })} className="btn-ghost text-sm">
              {details ? 'Nascondi' : 'Mostra'} i dettagli dell’errore
            </button>
          </div>
          {details && (
            <>
              <p className="text-sm text-muted">Fai uno screenshot o copia il testo e mandalo per la correzione.</p>
              <textarea readOnly value={text} rows={10} onFocus={(e) => e.target.select()} aria-label="Dettagli dell’errore" className="w-full rounded-xl border border-line-strong bg-surface p-3 font-mono text-xs text-fg" />
            </>
          )}
        </div>
      </div>
    )
  }
}
