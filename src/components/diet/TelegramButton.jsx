// "Invia su Telegram": diretto nella chat del bot se configurato, altrimenti link di condivisione (si sceglie la chat).
import { useState } from 'react'
import { asText, botReady, dayMessage, mealMessage, sendText, shareUrl, useTelegram } from '../../lib/telegram'

export const TelegramIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M21.4 4.3 2.9 11.4c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.8c.3-1.3-.5-1.9-1.5-1.6ZM8.6 14l9.9-6.3c.5-.3.9-.1.5.2l-8.4 7.6-.3 3.6L8.6 14Z" />
  </svg>
)

// message: funzione che restituisce { label, time, option } (un pasto) oppure { day: { dateLabel, meals } }
export default function TelegramButton({ message, label, className = '', children }) {
  const [state, setState] = useState(null) // null | 'sending' | 'sent' | { error }
  const build = () => {
    const m = message()
    return m.day ? dayMessage(m.day.dateLabel, m.day.meals) : mealMessage(m)
  }
  const cfg = useTelegram()
  const text = children ?? 'Invia su Telegram'

  if (!botReady(cfg)) {
    // href calcolato al tocco: riflette sempre l'alternativa scelta in quel momento
    return (
      <a href="https://t.me/share/url" onClick={(e) => (e.currentTarget.href = shareUrl(build()))} target="_blank" rel="noreferrer" className={`link-btn ${className}`} aria-label={`${text}${label ? `: ${label}` : ''}`}>
        <TelegramIcon />
        {text}
      </a>
    )
  }
  const send = async () => {
    setState('sending')
    try {
      await sendText(cfg, asText(build()))
      setState('sent')
      setTimeout(() => setState((s) => (s === 'sent' ? null : s)), 4000)
    } catch (e) {
      setState({ error: e.message })
    }
  }
  return (
    <div className={`flex flex-wrap items-center gap-x-2 ${className}`}>
      <button onClick={send} disabled={state === 'sending'} className="link-btn disabled:opacity-60" aria-label={`${text}${label ? `: ${label}` : ''} (${cfg.chatName || 'chat collegata'})`}>
        <TelegramIcon />
        {state === 'sending' ? 'Invio…' : text}
      </button>
      <span role="status" className={`text-sm ${state?.error ? 'text-danger' : 'text-primary'}`}>
        {state === 'sent' ? `✓ Inviato a ${cfg.chatName || 'Telegram'}` : state?.error ? `Non inviato: ${state.error}` : ''}
      </span>
    </div>
  )
}
