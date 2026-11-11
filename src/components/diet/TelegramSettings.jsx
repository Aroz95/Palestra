// Collegamento di un bot Telegram personale: invio diretto nella chat scelta e invio automatico all'ora del pasto.
import { useState } from 'react'
import { Toggle } from '../ui'
import { TelegramIcon } from './TelegramButton'
import { DEFAULT_TELEGRAM, SECRET_NAME, asText, botInfo, botReady, buildSchedule, findChats, isToken, repoUrl, saveTelegram, sendText, serverActive, useTelegram } from '../../lib/telegram'
import { fmtDate, todayISO } from '../../lib/dates'

export default function TelegramSettings({ leadMin, state, plan }) {
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
          <GithubSender cfg={cfg} set={set} state={state} plan={plan} leadMin={leadMin} />
          {!serverActive(cfg, todayISO()) && (
            <>
              <Toggle checked={cfg.auto} onChange={(auto) => set({ auto })} label="Invia ogni pasto in automatico all’ora prevista (con l’app aperta)" />
              <p className="text-xs text-muted">Senza GitHub l’invio automatico parte solo con l’app aperta o appena messa in secondo piano: il telefono sospende le app web chiuse. Un pasto già registrato non viene inviato.</p>
            </>
          )}
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
          <li>
            Apri il tuo bot e tocca <b className="text-fg">Avvia</b>. Per scrivere a più persone con un solo messaggio crea un <b className="text-fg">gruppo</b> con loro e il bot, poi scrivi <code className="rounded bg-surface-muted px-1">/start</code> nel gruppo.
          </li>
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

// Invio anche ad app chiusa: GitHub Actions legge il programma dal segreto del repository e invia all'ora dei pasti
function GithubSender({ cfg, set, state, plan, leadMin }) {
  const [copied, setCopied] = useState(null) // { json, until, count, fallback }
  const [err, setErr] = useState('')
  const today = todayISO()
  const active = serverActive(cfg, today)
  const repo = repoUrl()
  const copy = async () => {
    setErr('')
    let out
    try {
      out = buildSchedule(state, plan, cfg, { from: today, leadMin })
    } catch (e) {
      return setErr(e.message)
    }
    if (!out.count) return setErr('nessun pasto con orario nei prossimi giorni: aggiungi gli orari ai pasti')
    let fallback = false
    try {
      await navigator.clipboard.writeText(out.json)
    } catch {
      fallback = true // appunti non disponibili: il testo si seleziona a mano
    }
    setCopied({ ...out, fallback })
    set({ serverUntil: out.until, serverCopiedAt: today, auto: false })
  }
  const left = active ? Math.round((Date.parse(cfg.serverUntil) - Date.parse(today)) / 86400000) + 1 : 0

  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <h4 className="font-semibold text-fg">Invio automatico anche ad app chiusa</h4>
      {active ? (
        <p className={left <= 3 ? 'text-warning' : 'text-fg-soft'}>
          {left <= 3 ? '⏳ ' : '✓ '}Ci pensa GitHub fino al {fmtDate(cfg.serverUntil, { day: 'numeric', month: 'long' })}
          {left <= 3 ? `: mancano ${left} giorni, copia di nuovo il programma.` : '.'} Ricopialo anche quando cambi il piano, le alternative o l’anticipo.
        </p>
      ) : (
        <p className="text-fg-soft">GitHub (gratuito, nel repository dell’app) controlla ogni 5 minuti e invia i pasti dei prossimi 28 giorni, con qualche minuto di possibile ritardo. Non sa quali pasti hai già registrato.</p>
      )}
      <ol className="list-decimal space-y-2 pl-5 text-fg-soft">
        <li className="space-y-1">
          <button onClick={copy} className="btn-primary w-full">{active ? 'Copia il programma aggiornato' : 'Copia il programma'}</button>
          {copied && !copied.fallback && <span className="block text-xs text-primary">✓ Copiato: {copied.count} pasti fino al {fmtDate(copied.until, { day: 'numeric', month: 'long' })}.</span>}
          {copied?.fallback && (
            <textarea readOnly value={copied.json} rows={3} onFocus={(e) => e.target.select()} aria-label="Programma da copiare" className="w-full rounded-lg border border-line-strong bg-surface p-2 font-mono text-xs text-fg" />
          )}
          {err && <span className="block text-xs text-danger">Non riuscito: {err}</span>}
        </li>
        <li>
          Apri{' '}
          <a href={`${repo}/settings/secrets/actions`} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-4">
            i segreti del repository
          </a>
          : la prima volta <b className="text-fg">New repository secret</b>, nome <code className="rounded bg-surface-muted px-1">{SECRET_NAME}</code>, incolla e salva; le volte dopo matita accanto al nome → incolla → aggiorna.
        </li>
        <li>
          Per una prova subito:{' '}
          <a href={`${repo}/actions/workflows/telegram-pasti.yml`} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-4">
            Pasti su Telegram
          </a>{' '}
          → Run workflow.
        </li>
      </ol>
      <p className="text-xs text-muted">Il programma contiene il token del bot, la chat e i pasti: su GitHub resta cifrato tra i segreti e non compare mai nei registri pubblici.</p>
      {active && (
        <button onClick={() => set({ serverUntil: null, serverCopiedAt: null })} className="link-btn link-btn-muted -ml-2">
          Non uso più GitHub (poi elimina il segreto)
        </button>
      )}
    </div>
  )
}
