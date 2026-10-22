# Palestra — diario di allenamento e alimentazione

Web app (React + Vite + Tailwind CSS) per il telefono: programmi con schede A/B, sedute in sala pesi con timer, nuoto, misure corporee, piano alimentare, progressi e report. Funziona senza rete e senza account: i dati restano nel browser.

Principio guida: registrare ciò che è stato **realmente fatto**, senza confondere programmi, valori misurati, stime e obiettivi.

## Funzionalità

### Oggi
Attività previste dal calendario con stato (prevista, in corso, completata, saltata, rinviata) e azioni **Avvia / Salta / Rinvia**; accesso rapido alle schede, attività libera, nuoto, nuova misura, prossimo pasto del piano attivo.

### Allenamenti
- **Schede**: più programmi (uno principale), schede A/B con esercizi, serie, range di ripetizioni, carico suggerito, RIR obiettivo, recupero, attrezzo (macchina, cavo, manubri per mano, corpo libero…), variante e istruzioni. Duplica, archivia, riordina, esporta. Le modifiche a una scheda già usata creano una **nuova revisione**: le sedute svolte conservano gli obiettivi del momento.
- **Calendario** settimanale configurabile (es. lun A, mar nuoto, gio B, ven nuoto), anche con più attività nello stesso giorno. Le ricorrenze generano attività previste, mai sedute svolte.
- **Seduta di sala pesi**: obiettivo ed eseguito separati per ogni serie; RIR, RPE, fastidio e note facoltativi; suggerimenti di progressione non prescrittivi; orari di inizio/fine con durata calcolata, correzione manuale e segnalazione delle incoerenze; sensazioni e recupero; stima facoltativa delle calorie (intervallo, metodo dichiarato, attive vs totali) o valore da orologio.
- **Modalità allenamento** sequenziale a schermo intero: grande pulsante **⏱ Serie fatta**, recupero (predefinito 1 minuto) che si ferma da solo, RIR rapido durante il recupero, esercizi a tempo che si segnano a fine conto alla rovescia, schermo sempre acceso.
- **Nuoto**: vasca 25/50 m o personalizzata, blocchi nel formato `(200+100+2×75)×2`, distanza **prevista**, **misurata** e **stimata** (intervallo) sempre separate; passo e vasche marcati come stima quando la distanza non è misurata; tecnica (presa, bracciata, spalle, respirazione).
- **Storico** unificato palestra + nuoto con filtri ed esportazione di ogni seduta.

### Alimentazione
Piani importati in JSON o creati a mano: consultazione per giorno e pasto, alternative, giorni di allenamento/riposo, nutrienti solo se dichiarati (altrimenti “ND”), bozza vs validato da un professionista, revisioni, duplicazione, archiviazione. Diario facoltativo dei pasti (seguito / modificato / saltato).

### Progressi
Periodi 7/30/90 giorni, mese, anno o personalizzato, con confronto rispetto al periodo precedente: frequenza e aderenza al calendario, serie/ripetizioni/volume/RIR, record solo su esercizi confrontabili, grafico per esercizio, nuoto (misurato e stimato separati), peso con media mobile a 7 giorni, girovita e addome, alimentazione, calorie. **Report** in **PDF** (A4, generato sul dispositivo), JSON e CSV (formato Excel/Numbers italiano o standard) con scelta delle sezioni e del dettaglio, anteprima ed esclusione delle note personali.

### Altro
Profilo e obiettivi (con storico delle modifiche, senza notifiche o promesse), misure corporee (girovita e addome distinti), **Importa**, **Esporta**, impostazioni del timer, stato dell’archivio e privacy.

## Import / export

Un’unica schermata **Altro → Importa** accetta file JSON (anche incollati come testo): backup, programmi A/B, sedute, nuotate, piani alimentari, misure. Prima di salvare mostra un’anteprima (es. “1 programma, 2 schede”) con errori e avvisi indicati per campo. Per ogni elemento già presente si sceglie **salta / aggiorna / copia**; aggiornare una scheda o un piano crea una nuova revisione. L’importazione è atomica: con un errore nel file non viene modificato nulla, e il successo viene mostrato solo dopo il salvataggio riuscito. L’ultima importazione si può annullare finché non ci sono altre modifiche; lo stato precedente resta comunque come copia di sicurezza. La sostituzione completa è possibile solo da backup, con doppia conferma e copia di sicurezza.

Lo schema dei file è pubblico e stabile: **[docs/SCHEMA.md](docs/SCHEMA.md)**, con esempi validati in **[docs/examples/](docs/examples/)**. Puoi passarli a ChatGPT come modello per generare programmi o piani alimentari importabili. Restano importabili anche i file delle versioni precedenti.

## Dati, privacy e aggiornamenti

- I dati sono salvati in **IndexedDB** nel browser, subito a ogni modifica; un indicatore mostra *Salvato / Salvataggio… / Non salvato*. Timer e preferenze in localStorage. Nessun server, nessun tracciamento, nessun invio a terzi.
- Gli errori di salvataggio (es. spazio esaurito) sono mostrati in un avviso con il pulsante per esportare subito un backup.
- Copie di sicurezza automatiche prima di importazioni, annullamenti e cancellazione dei dati (*Altro → Opzioni*).
- **Offline**: dopo la prima apertura l’app funziona anche senza rete (service worker); si può aggiungere alla schermata Home come app.
- **Aggiornamento dalla versione precedente**: al primo avvio i dati della versione 2 (localStorage `palestra:data`) vengono migrati al nuovo modello; la vecchia chiave **non viene cancellata** e una copia è salvata in IndexedDB (scaricabile da *Altro → Opzioni*). La vecchia scheda diventa la “Scheda A” del programma principale; sedute, note, carichi per mano, velocità e durate sono conservati, senza inventare orari mai registrati.
- I dati restano solo sul dispositivo: per cambiare telefono usa *Altro → Esporta → Backup* e poi *Importa*.

| Chiave | Dove | Contenuto |
|---|---|---|
| `state` | IndexedDB `palestra` | tutti i dati (schema v3) |
| `legacy-snapshot` | IndexedDB `palestra` | copia dei dati v2 prima della migrazione |
| `palestra:data` | localStorage | dati v2 originali (mai cancellati) |
| `palestra:stopwatch`, `palestra:rest` | localStorage | stato di cronometro e recupero |
| `palestra:tab`, `palestra:subtabs`, `palestra:workout-mode` | localStorage | preferenze di navigazione |

## Sviluppo

Requisiti: Node.js 20+ (consigliato 22).

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # test unitari e di integrazione (Vitest)
npm run test:e2e  # collaudo end-to-end (Playwright)
npm run build     # build di produzione in dist/
npm run preview
```

Piano di collaudo, garanzie sui dati e checklist manuale per iPhone: **[docs/COLLAUDO.md](docs/COLLAUDO.md)**.

## Pubblicazione su GitHub Pages

Il workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) esegue test unitari ed end-to-end, compila e pubblica a ogni push su `main`/`master` (o manualmente da *Actions*). Configurazione una tantum: *Settings → Pages → Source: GitHub Actions*. L’app è su `https://<utente>.github.io/<repository>/`. Dal telefono: *Condividi → Aggiungi a schermata Home*.

## Struttura

```
src/
├── App.jsx                     # navigazione (Oggi, Allenamenti, Alimentazione, Progressi, Altro)
├── schema/                     # modello v3: costanti, factory, migrazioni, esempio
├── lib/
│   ├── persist.js, db.js       # IndexedDB, migrazione, gestione errori di salvataggio
│   ├── import/                 # import manager: validazione, normalizzazione, anteprima, applicazione
│   ├── report/                 # aggregazioni per periodo, report JSON/CSV, esportazioni tipizzate
│   ├── actions.js              # operazioni sullo stato
│   ├── calendar.js             # occorrenze e aderenza
│   ├── stats.js, swim.js, energy.js, dates.js
│   └── useTimers.js            # cronometro e conti alla rovescia
└── components/                 # viste e componenti
docs/SCHEMA.md, docs/examples/  # schema pubblico ed esempi
tests/                          # Vitest
```

Non ancora incluso: sincronizzazione tra dispositivi (richiede decisioni su archiviazione remota e privacy), import assistito da testo/PDF, promemoria.
