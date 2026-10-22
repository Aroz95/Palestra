import { useRef } from 'react'
import Stepper from './Stepper'
import { downloadJSON } from '../lib/download'

export default function SettingsView({ settings, onSettings, state, onImport, onImportSession, onReset }) {
  const fileRef = useRef(null)

  const exportData = () => downloadJSON(`palestra-backup-${new Date().toISOString().slice(0, 10)}.json`, state)

  const importData = async (file) => {
    try {
      const data = JSON.parse(await file.text())
      // File di una singola seduta (esportato dallo storico): la aggiunge senza toccare il resto
      if (data?.type === 'palestra-seduta' && data.session?.exercises) {
        if (confirm(`Aggiungere allo storico la seduta del ${data.session.date}?`)) onImportSession(data.session)
        return
      }
      if (!data || !Array.isArray(data.sessions) || !data.template) throw new Error('formato non valido')
      if (confirm('Sostituire tutti i dati attuali con quelli del file?')) onImport(data)
    } catch (e) {
      alert(`Impossibile importare il file: ${e.message}`)
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Opzioni</h1>

      <section className="space-y-4 rounded-2xl bg-slate-900 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Recupero</h2>
        <Stepper
          label="Recupero evidenziato nella barra (s)"
          value={settings.restSeconds}
          step={15}
          min={15}
          onChange={(restSeconds) => onSettings({ ...settings, restSeconds: Math.round(restSeconds) })}
        />
        <p className="text-xs text-slate-400">
          Il recupero dopo ogni serie si imposta per esercizio nella scheda (predefinito 1 minuto).
        </p>
        <Toggle
          checked={settings.autoRest}
          onChange={(autoRest) => onSettings({ ...settings, autoRest })}
          label="Avvia il recupero quando segno una serie come fatta"
        />
        <Toggle
          checked={settings.sound}
          onChange={(sound) => onSettings({ ...settings, sound })}
          label="Suono a fine recupero"
        />
      </section>

      <section className="space-y-3 rounded-2xl bg-slate-900 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Dati</h2>
        <p className="text-sm text-slate-400">
          I dati sono salvati solo in questo browser (localStorage). Esporta un backup ogni tanto, soprattutto prima di
          cancellare i dati del browser o cambiare dispositivo. Con “Importa” puoi caricare anche il file di una
          singola seduta esportata dallo storico: viene aggiunta senza toccare gli altri dati.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportData} className="btn bg-emerald-500 text-slate-950">Esporta backup</button>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost">Importa</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importData(f)
              e.target.value = ''
            }}
          />
        </div>
        <button
          onClick={() => confirm('Ripristinare la scheda e le sedute iniziali? Tutti i dati attuali andranno persi.') && onReset()}
          className="rounded-xl px-3 py-2 text-sm text-rose-400 active:bg-rose-950"
        >
          Ripristina dati iniziali
        </button>
      </section>
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </label>
  )
}
