// Collegamento di un bot Telegram personale: invio diretto nella chat scelta e invio automatico all'ora del pasto.
import { useState } from 'react'
import { Toggle } from '../ui'
import { TelegramIcon } from './TelegramButton'
import { DEFAULT_TELEGRAM, asText, botInfo, botReady, findChats, isToken, saveTelegram, sendText, useTelegram } from '../../lib/telegram'

export default function TelegramSettings({ leadMin }) {
  const cfg = useTelegram()
  const [chats, setChats] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { ok|error: testo }
  const [manual, setManual] = useState(false)
  const set = (patch) => {
    saveTelegram({ ...cfg, ...patch })
  }
  const run = async (fn) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setMsg({ error: e.message })
    } finally {
      setBusy(false)
    }
  }
  const search = () =>
    run(async () => {
      const bot = await botInfo(cfg.token)
      const list = await findChats(cfg.token)
      setChats(list)
      if (!list.length) setMsg({ error: `nessuna chat trovata. Apri @${bot.username} in Telegram, tocca Avvia (o scrivi /start), poi cerca di nuovo.` })
      else if (list.length === 1) choose(list[0])
    })
  const choose = (c) => {
    set({ chatId: c.id, chatName: c.name })
    setChats(null)
    setMsg({ ok: `Collegato a ${c.name}.` })
  }
  const test = () =>
    run(async () => {
      await sendText(cfg, asText({ title: '✅ Palestra collegata', body: `Da qui riceverai i pasti${cfg.auto ? `, in automatico ${leadMin ? `${leadMin} minuti prima` : 'all’orario'} di ogni pasto` : ''}.` }))
      setMsg({ ok: 'Messaggio di prova inviato.' })
    })
  const ready = botReady(cfg)
  const tokenOk = isToken(cfg.token)

  return (
    <section className="space-y-3 border-t border-line pt-4" aria-label="Telegram">
      <h3 className="flex items-center gap-2 text-base font-semibold text-fg">
        <TelegramIcon className="h-5 w-5 text-[#229ED9]" /> Telegram
      </h3>
      {!ready && (
        <p className="text-fg-soft">
          Senza configurare nulla, “Invia su Telegram” apre Telegram con il pasto già scritto e scegli tu la chat. Per l’invio diretto e automatico serve un tuo bot (gratuito, 2 minuti):
        </p>
      )}

      {ready ? (
        <div className="space-y-3">
          <p className="rounded-xl bg-primary-soft px-3 py-2 text-fg">
            ✓ Collegato a <b className="font-semibold">{cfg.chatName || cfg.chatId}</b>
          </p>
          <Toggle checked={cfg.auto} onChange={(auto) => set({ auto })} label="Invia ogni pasto in automatico all’ora prevista" />
          <p className="text-xs text-muted">
            Come le notifiche, l’invio automatico parte solo con l’app aperta (o appena messa in secondo piano): il telefono sospende le app web chiuse. Un pasto già registrato non viene inviato.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={test} disabled={busy} className="btn-ghost text-sm">Messaggio di prova</button>
            <button
              onClick={() => {
                set({ ...DEFAULT_TELEGRAM, token: cfg.token })
                setMsg(null)
              }}
              className="btn-ghost text-sm text-danger"
            >
              Scollega chat
            </button>
          </div>
        </div>
      ) : (
        <ol className="list-decimal space-y-3 pl-5 text-fg-soft">
          <li>
            In Telegram apri <b className="text-fg">@BotFather</b>, invia <code className="rounded bg-surface-muted px-1">/newbot</code>, scegli un nome e copia il token che ti dà.
          </li>
          <li className="space-y-1">
            <span>Incollalo qui (resta solo su questo telefono, non va nei backup):</span>
            <input
              value={cfg.token}
              onChange={(e) => set({ token: e.target.value.trim(), chatId: '', chatName: '' })}
              placeholder="123456789:AA…"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Token del bot"
              className="w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 font-mono text-sm text-fg"
            />
            {cfg.token && !tokenOk && <span className="block text-xs text-warning">Il token ha la forma “numero:lettere”, es. 123456789:AAH…</span>}
          </li>
          <li>Apri il tuo bot e tocca <b className="text-fg">Avvia</b> (o aggiungilo a un gruppo e scrivi un messaggio).</li>
          <li className="space-y-2">
            <button onClick={search} disabled={!tokenOk || busy} className="btn-primary w-full">
              {busy ? 'Ricerca…' : 'Cerca la chat'}
            </button>
            {chats?.length > 1 && (
              <ul className="divide-y divide-line rounded-xl border border-line" aria-label="Chat trovate">
                {chats.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => choose(c)} className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-fg">
                      <span className="min-w-0">{c.name}</span>
                      <span className="shrink-0 text-xs text-muted">{c.type === 'private' ? 'chat privata' : 'gruppo'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!manual ? (
              <button onClick={() => setManual(true)} className="link-btn link-btn-muted -ml-2">Inserisci l’ID della chat a mano</button>
            ) : (
              <div className="flex gap-2">
                <input
                  value={cfg.chatId}
                  onChange={(e) => set({ chatId: e.target.value.trim(), chatName: '' })}
                  placeholder="es. 123456789 o -100…"
                  inputMode="numeric"
                  aria-label="ID della chat"
                  className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 font-mono text-sm text-fg"
                />
              </div>
            )}
          </li>
        </ol>
      )}
      <p role="status" className={`min-h-5 text-sm ${msg?.error ? 'text-danger' : 'text-primary'}`}>
        {msg?.error ? `Non riuscito: ${msg.error}` : msg?.ok ?? ''}
      </p>
    </section>
  )
}
