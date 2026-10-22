# Palestra — Scheda Total Body

Web app (React + Vite + Tailwind CSS) per seguire la scheda di allenamento **Total Body** in palestra, direttamente dal telefono: segni le serie fatte, modifichi al volo pesi e ripetizioni e usi il cronometro e il timer di recupero.

I dati per ora sono salvati nel **localStorage** del browser (nessun server, nessun account).

## Funzionalità

- **Seduta in corso**
  - Riscaldamento e defaticamento (tapis roulant): minuti, velocità, spunta “fatto”, distanza stimata.
  - Esercizi in sala pesi con una riga per serie: carico e ripetizioni modificabili con **− / +** o digitandoli, pulsante **✓** per segnare la serie come fatta.
  - Aggiungi / togli serie, “Tutte fatte”, note per esercizio, aggiunta di esercizi dalla scheda o liberi.
  - Esercizi a tempo (es. Plank): pulsante **▶ Avvia** che fa partire il conto alla rovescia della serie.
  - Avanzamento (serie completate), ripetizioni, volume e minuti di cardio calcolati in automatico.
  - Durata della seduta, con la possibilità di prenderla dal cronometro.
- **Cronometro** sempre visibile in alto: avvia / pausa / riprendi / azzera e **giri**. Parte da solo alla prima serie spuntata.
- **Timer di recupero**: preset da 45 s a 3 min, +15 s, suono e vibrazione a fine recupero. Può partire in automatico quando spunti una serie (disattivabile in *Opzioni*).
- Cronometro e recupero sono basati su timestamp: continuano a contare anche se ricarichi la pagina o lo schermo si spegne.
- **Storico** delle sedute con riepilogo (serie, ripetizioni, volume, plank, cardio, durata).
- **Scheda** modificabile: esercizi, serie/ripetizioni/carico predefiniti, incremento dei pulsanti +/−, manubri “per mano”, ordine degli esercizi, riscaldamento e defaticamento.
- **Nuova seduta**: viene creata dalla scheda riprendendo serie e carichi dell’ultima volta in cui hai fatto ciascun esercizio.
- **Backup**: esporta / importa i dati in JSON, ripristino dei dati iniziali.

### Dati precaricati

- **20 ottobre 2026 — Seduta originale** (storico, tutta completata): 30 serie, 342 ripetizioni, 7.386 kg di volume nominale, plank 3 × 30 s, 25 min di tapis roulant (~2,3 km), ~95 minuti.
- **22 ottobre 2026 — Nuova seduta** (da compilare): tapis roulant iniziale 10 min a 5,5 km/h già segnato; esercizi precompilati con **2 serie** (consiglio: 1–2 serie, niente cedimento, carichi adeguati al recupero dopo palestra del 20 e nuoto del 21). Modifica serie, carichi e ripetizioni in base a quanto fatto davvero.

> Il volume è nominale (ripetizioni × carico, i manubri “per mano” contano ×2): è indicativo e non direttamente comparabile tra macchine diverse.

## Sviluppo locale

Requisiti: Node.js 20+ (consigliato 22).

```bash
npm install
npm run dev       # server di sviluppo su http://localhost:5173
npm run build     # build di produzione in dist/
npm run preview   # anteprima della build
```

## Pubblicazione su GitHub Pages

Il workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) compila l’app e la pubblica su GitHub Pages a ogni push su `main` (o `master`), oppure manualmente da *Actions → Deploy su GitHub Pages → Run workflow*.

Configurazione una tantum:

1. Su GitHub apri **Settings → Pages**.
2. In **Build and deployment → Source** scegli **GitHub Actions**.
3. Fai push sul branch principale: al termine del workflow l’app è disponibile su
   `https://<utente>.github.io/<repository>/` (es. `https://aroz95.github.io/palestra/`).

In `vite.config.js` il `base` è relativo (`./`), quindi la build funziona con qualsiasi nome di repository senza modifiche.

Suggerimento: dal telefono apri il sito e usa **“Aggiungi a schermata Home”** per averlo come un’app.

## Dati e localStorage

| Chiave               | Contenuto                                    |
|----------------------|----------------------------------------------|
| `palestra:data`      | scheda, sedute, seduta attiva, impostazioni  |
| `palestra:stopwatch` | stato del cronometro                         |
| `palestra:rest`      | stato del timer di recupero                  |

I dati restano solo nel browser/dispositivo in cui li hai inseriti: cancellando i dati del sito si perdono. Usa **Opzioni → Esporta backup** ogni tanto e **Importa backup** per spostarli su un altro dispositivo.

## Struttura del progetto

```
src/
├── App.jsx                  # stato principale, navigazione a schede
├── data/defaultData.js      # scheda Total Body e sedute iniziali
├── lib/
│   ├── storage.js           # hook useLocalStorage
│   ├── stats.js             # calcolo riepiloghi e formattazione
│   └── useTimers.js         # cronometro + timer di recupero
└── components/
    ├── TimerBar.jsx         # barra cronometro/recupero
    ├── SessionView.jsx      # seduta in corso
    ├── ExerciseCard.jsx     # esercizio con le sue serie
    ├── CardioList.jsx       # riscaldamento / defaticamento
    ├── HistoryView.jsx      # storico sedute
    ├── TemplateView.jsx     # modifica della scheda
    ├── SettingsView.jsx     # opzioni, backup
    └── Stepper.jsx          # campo numerico con − / +
```

Per passare in futuro a un backend basta sostituire `useLocalStorage` in `App.jsx` con una sorgente dati remota mantenendo la stessa forma dei dati.
