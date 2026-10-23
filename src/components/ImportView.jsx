import { useRef, useState } from 'react'
import { Card, Chip, Section, Segmented, TextArea, Toggle } from './ui'
import { parseImport, previewImport, applyImport } from '../lib/import'
import { exportBackup, fileNames } from '../lib/report'
import { downloadJSON } from '../lib/download'
import { LIMITS } from '../schema/constants'

const STATUS = {
  new: { label: 'Nuovo', cls: 'bg-primary-soft text-primary' },
  identical: { label: 'Identico a esistente', cls: 'bg-surface-strong text-fg' },
  conflict: { label: 'Stesso id, contenuto diverso', cls: 'bg-warning-soft text-warning' },
  duplicate: { label: 'Probabile duplicato', cls: 'bg-warning-soft text-warning' },
}

export default function ImportView({ state, onApply, undo, onUndo }) {
  const fileRef = useRef(null)
  const [parsed, setParsed] = useState(null)
  const [paste, setPaste] = useState('')
  const [mode, setMode] = useState('merge')
  const [decisions, setDecisions] = useState({})
  const [setMain, setSetMain] = useState(false)
  const [activateDiet, setActivateDiet] = useState(false)
  const [safetyCopy, setSafetyCopy] = useState(true)
  const [log, setLog] = useState(null)
  const [drag, setDrag] = useState(false)

  const load = (text, fileName, size) => {
    setLog(null)
    setDecisions({})
    setMode('merge')
    setParsed(parseImport(text, { fileName, size }))
  }
  const readFile = async (f) => {
    if (!f) return
    if (f.size > LIMITS.fileBytes) return load('', f.name, f.size)
    load(await f.text(), f.name, f.size)
  }

  const preview = parsed && !parsed.errors.length ? previewImport(state, parsed.batch) : null

  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)

  const apply = async () => {
    const pv = previewImport(state, parsed.batch) // ricalcolato sullo stato attuale
    if (mode === 'replace') {
      if (!confirm('Sostituire TUTTI i dati attuali con quelli del backup?')) return
      if (!confirm('Conferma definitiva: scheda, sedute, misure e piani attuali verranno rimpiazzati. Procedere?')) return
      if (safetyCopy) downloadJSON(fileNames.backup().replace('backup', 'backup-prima-del-ripristino'), exportBackup(state))
    }
    let res
    try {
      res = applyImport(state, parsed.batch, pv, { mode, decisions, setMainProgram: setMain, activateDietPlan: activateDiet })
    } catch (e) {
      alert(`Importazione annullata, nessun dato modificato: ${e.message}`)
      return
    }
    setBusy(true)
    setFailure(null)
    try {
      // Successo mostrato solo dopo il salvataggio riuscito
      await onApply(res.state, parsed.fileName || 'testo incollato')
    } catch (e) {
      setFailure(`Importazione NON salvata: ${e.message} I dati precedenti sono intatti; puoi riprovare.`)
      return
    } finally {
      setBusy(false)
    }
    setLog({ ...res.log, file: parsed.fileName || 'testo incollato' })
    setParsed(null)
    setPaste('')
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Importa file JSON dell’app (backup, programmi A/B, sedute, nuoto, piani alimentari, misure) anche generati con altri strumenti secondo lo schema pubblico. Prima di salvare vedi un’anteprima: nulla viene modificato finché non confermi.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          readFile(e.dataTransfer.files?.[0])
        }}
        className={`rounded-2xl border-2 border-dashed p-6 text-center ${drag ? 'border-primary bg-primary-soft' : 'border-line'}`}
      >
        <button onClick={() => fileRef.current?.click()} className="btn-primary">Scegli file JSON</button>
        <p className="mt-2 text-xs text-muted">oppure trascinalo qui · max {LIMITS.fileBytes / 1024 / 1024} MB</p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            readFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      <details className="rounded-2xl bg-surface p-3">
        <summary className="cursor-pointer text-sm text-fg-soft">Incolla JSON</summary>
        <div className="mt-2 space-y-2">
          <TextArea value={paste} onChange={setPaste} rows={6} placeholder='{"type": "palestra-program", ...}' aria-label="JSON da importare" />
          <button disabled={!paste.trim()} onClick={() => load(paste, 'testo incollato', paste.length)} className="btn-ghost text-sm disabled:opacity-40">Analizza</button>
        </div>
      </details>

      {parsed && (
        <Card tone={parsed.errors.length ? 'warn' : 'default'} className="space-y-3">
          <div className="text-sm text-fg-soft">
            <b className="text-fg">{parsed.fileName}</b>
            {parsed.batch.sources.length > 0 && <span className="text-muted"> · {[...new Set(parsed.batch.sources)].join(', ')}</span>}
          </div>
          {parsed.errors.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-danger">Il file contiene {parsed.errors.length} errori: nessun dato verrà importato.</p>
              <ul className="mt-1 max-h-60 space-y-1 overflow-auto text-xs">
                {parsed.errors.slice(0, 100).map((e, i) => (
                  <li key={i}>
                    <code className="text-danger">{e.path}</code> — {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {parsed.warnings.length > 0 && (
            <ul className="space-y-1 text-xs text-warning">
              {parsed.warnings.map((w, i) => (
                <li key={i}>⚠ {w.message}</li>
              ))}
            </ul>
          )}
          {preview && (
            <>
              <p className="text-sm text-fg">Contenuto: {preview.summary}</p>
              {preview.canReplace && (
                <Segmented value={mode} onChange={setMode} options={[{ id: 'merge', label: 'Unisci (consigliato)' }, { id: 'replace', label: 'Sostituisci tutto' }]} />
              )}
              {mode === 'replace' ? (
                <div className="space-y-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
                  <p>Tutti i dati attuali verranno sostituiti dal backup. Richiede doppia conferma.</p>
                  <Toggle checked={safetyCopy} onChange={setSafetyCopy} label="Scarica prima una copia di sicurezza" />
                </div>
              ) : (
                <ul className="max-h-80 space-y-2 overflow-auto">
                  {preview.items.map((it) => (
                    <li key={it.key} className="rounded-xl bg-surface-muted/60 p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-fg">{it.label}</span>
                        <Chip className={STATUS[it.status].cls}>{STATUS[it.status].label}</Chip>
                      </div>
                      {it.status !== 'new' && (
                        <select
                          value={decisions[it.key] ?? 'skip'}
                          onChange={(e) => setDecisions({ ...decisions, [it.key]: e.target.value })}
                          aria-label={`Azione per ${it.label}`}
                          className="mt-2 w-full rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm text-fg"
                        >
                          <option value="skip">Salta (mantieni l’esistente)</option>
                          <option value="update">Aggiorna l’esistente con il file</option>
                          <option value="clone">Importa come copia con nuovo id</option>
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {mode === 'merge' && parsed.batch.programs.length > 0 && <Toggle checked={setMain} onChange={setSetMain} label="Imposta il programma importato come principale" />}
              {mode === 'merge' && parsed.batch.dietPlans.length > 0 && <Toggle checked={activateDiet} onChange={setActivateDiet} label="Imposta il piano importato come attivo" />}
              <div className="flex gap-2">
                <button onClick={apply} disabled={busy} className="btn flex-1 bg-primary text-on-primary disabled:opacity-50">
                  {busy ? 'Salvataggio…' : mode === 'replace' ? 'Sostituisci' : 'Importa'}
                </button>
                <button onClick={() => setParsed(null)} className="btn-ghost">Annulla</button>
              </div>
            </>
          )}
        </Card>
      )}

      {failure && (
        <div role="alert" className="rounded-2xl bg-danger-soft p-3 text-sm text-danger">
          {failure}
        </div>
      )}

      {log && (
        <Section title="Risultato importazione">
          <Card className="space-y-2 text-sm">
            <p className="text-fg">
              Inseriti {log.inserted.length} · aggiornati {log.updated.length} · saltati {log.skipped.length}
            </p>
            <ul className="space-y-0.5 text-xs text-muted">
              {log.inserted.map((x, i) => <li key={`i${i}`}>+ {x}</li>)}
              {log.updated.map((x, i) => <li key={`u${i}`}>↻ {x}</li>)}
              {log.skipped.map((x, i) => <li key={`s${i}`}>– {x}</li>)}
            </ul>
            <button onClick={() => downloadJSON(`palestra-import-log-${log.at.slice(0, 10)}.json`, log)} className="btn-ghost text-sm">Scarica log</button>
          </Card>
        </Section>
      )}

      {undo && (
        <Card tone="info" className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-fg">Ultima importazione: {undo.label}</span>
            {undo.available && (
              <button
                onClick={async () => {
                  try {
                    await onUndo()
                  } catch (e) {
                    setFailure(`Annullamento NON salvato: ${e.message}`)
                  }
                }}
                className="btn-ghost text-sm"
              >
                Annulla importazione
              </button>
            )}
          </div>
          {!undo.available && (
            <p className="text-xs text-muted">
              Annullamento non più disponibile: dopo l’importazione ci sono state altre modifiche, che verrebbero perse. Lo stato precedente all’importazione resta salvato come copia di sicurezza in Altro → Opzioni.
            </p>
          )}
        </Card>
      )}
    </div>
  )
}
