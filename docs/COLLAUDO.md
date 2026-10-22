# Collaudo e affidabilità

Questo documento descrive come sono garantite l’integrità dei dati e il collaudo dell’app, collegando ogni voce del piano di completamento ai test automatici e indicando ciò che va verificato a mano.

## Come eseguire i test

```bash
npm test           # test unitari e di integrazione (Vitest)
npm run test:e2e   # collaudo end-to-end nel browser (Playwright, viewport/touch di iPhone 13, motore Chromium)
```

La pipeline GitHub Actions esegue entrambi a ogni push: la pubblicazione su GitHub Pages avviene solo se tutti passano. In caso di errore il rapporto Playwright (schermate e tracce) è disponibile come artefatto `playwright-report`.

Tutti i test E2E usano una data fissa (31/10/2026) e i file di `docs/examples/` e `tests/fixtures/`, quindi danno lo stesso risultato in qualunque giorno.

## Comportamenti garantiti

### Salvataggio (P0-01)
- Ogni modifica viene scritta subito in IndexedDB tramite una coda seriale; l’indicatore in alto mostra **Salvato sul dispositivo / Salvataggio… / Non salvato**.
- Importazione, sostituzione da backup, annullamento e cancellazione dei dati usano `commit`: lo stato in memoria cambia **solo dopo** la scrittura riuscita. Lo stato precedente viene salvato come copia di sicurezza nella **stessa transazione** (o si scrivono entrambi o nessuno).
- Se la scrittura fallisce (es. spazio esaurito) compare un errore con il pulsante per esportare un backup; nessun messaggio di successo; al riavvio lo stato è quello dell’ultimo salvataggio riuscito.
- Le copie di sicurezza automatiche (prima dell’ultima importazione, dell’ultimo annullamento, della cancellazione) sono scaricabili da *Altro → Opzioni* come backup reimportabili.

### Annullamento dell’importazione (P0-02)
Strategia MVP: l’importazione si può annullare **solo finché non ci sono altre modifiche**. Dopo una qualunque modifica (seduta, misura, pasto, cambio di schermata della seduta attiva) il pulsante scompare e un avviso spiega il motivo, così l’annullamento non può cancellare dati inseriti dopo. Lo stato precedente all’importazione resta comunque scaricabile come copia di sicurezza. L’annullamento vale per la sessione corrente dell’app.

### Migrazione dalla versione precedente (P0-03)
- Avviene una sola volta, al primo avvio: snapshot dei dati v2 e nuovo stato v3 nella stessa transazione; la chiave v2 in localStorage non viene mai cancellata.
- Se IndexedDB non è disponibile l’app lavora sull’archivio di ripiego (localStorage); quando IndexedDB torna disponibile, i dati scritti in ripiego hanno la precedenza sui dati v2.
- Nessun orario inventato: la durata registrata nella v2 resta con fonte “versione precedente”.
- Un carico 0 nella v2 viene riconosciuto come corpo libero (es. Hyperextension), non come dato mancante.

### Revisioni (P1-02)
- Una scheda già usata da una seduta passa alla revisione successiva alla prima modifica; le sedute conservano obiettivi e revisione del momento.
- Aggiornare un programma da file: ogni scheda con contenuto diverso diventa la revisione successiva (la precedente resta nello storico); le schede non più presenti nel file vengono **archiviate**, non cancellate.
- Aggiornare un piano alimentare da file crea una nuova revisione e non cambia quale piano è attivo; il diario dei pasti resta associato alla revisione in cui è stato registrato.

### Metriche e report (P1-04)
- Distanze di nuoto: prevista, misurata e stimata (intervallo) sempre separate; il passo su distanza stimata è un intervallo etichettato.
- `null`/ND distinto da 0 (es. minuti senza durata registrata).
- Record solo tra sedute svolte (non saltate) dello stesso esercizio e attrezzo; il “nuovo record del periodo” non dipende da ciò che accade dopo il periodo.
- I giorni delle misure sono calcolati nel fuso orario del dispositivo anche se il file usa un altro fuso.
- CSV in due formati (Excel/Numbers italiano con `;` e virgola decimale, oppure standard); i testi che inizierebbero una formula (`= + - @`) vengono neutralizzati.
- “Escludi note” rimuove note di seduta e serie, fastidi, note delle misure e nome del validatore del piano da JSON, CSV e PDF.

### Alimentazione (P1-05)
- Un giorno con data specifica ha la precedenza sul giorno della settimana; variante allenamento/riposo scelta in base alle attività del giorno, modificabile.
- “Validato da professionista” richiede il nome di chi ha validato; altrimenti il piano resta bozza (anche in import, con avviso).

### Offline e schermata Home
Un service worker conserva l’app sul dispositivo: dopo la prima apertura online, l’app si apre e salva i dati anche senza rete. Gli aggiornamenti vengono scaricati alla prima apertura con rete.

## Mappa del piano di collaudo

| ID | Scenario | Test automatico | Esito |
|---|---|---|---|
| E2E-01 | Upgrade con dati v2 | `e2e/upgrade.e2e.js`, `tests/migrate-real.test.js`, `tests/persist*.test.js` | automatico |
| E2E-02 | Import programma A/B | `e2e/import.e2e.js` | automatico |
| E2E-03 | Full Body A con timer e RIR | `e2e/workout.e2e.js` | automatico (Chromium) |
| E2E-04 | Modifica scheda già usata | `e2e/workout.e2e.js`, `tests/integrity.test.js` | automatico |
| E2E-05 | Nuotata stimata 1.500–1.800 m | `e2e/import.e2e.js`, `tests/swim.test.js` | automatico |
| E2E-06 | Dieta, consultazione del mercoledì | `e2e/import.e2e.js`, `tests/diet.test.js` | automatico |
| E2E-07 | Misure 75 / 90 / 100 | `e2e/import.e2e.js`, `tests/kpi.test.js` | automatico |
| E2E-08 | Report 30/90 giorni JSON e CSV | `e2e/report.e2e.js`, `tests/kpi.test.js` | automatico |
| E2E-09 | Import con un record non valido | `e2e/import.e2e.js`, `tests/import.test.js` | automatico |
| E2E-10 | Errore IndexedDB durante l’import | `e2e/import.e2e.js`, `tests/persist-commit.test.js` | automatico |
| E2E-11 | Import → modifica → annullamento | `e2e/import.e2e.js` | automatico |
| E2E-12 | Backup → nuovo browser → import | `e2e/import.e2e.js`, `tests/import.test.js` | automatico |
| E2E-13 | iPhone, app in background durante il timer | `e2e/workout.e2e.js` (emulazione) | **da verificare su iPhone** |
| E2E-14 | Funzionamento offline | `e2e/offline.e2e.js` (server spento davvero) | automatico (Chromium) |
| E2E-15 | PDF | `e2e/report.e2e.js`, `tests/pdf.test.js` | automatico; download su iPhone **da verificare** |

I test automatici girano con il motore Chromium e il profilo di iPhone 13 (dimensioni, touch). Safari/WebKit non è disponibile nell’ambiente di sviluppo: le voci seguenti vanno verificate a mano.

## Checklist manuale su iPhone (P1-03)

Da eseguire su Safari iOS e sull’app aggiunta alla schermata Home (*Condividi → Aggiungi a schermata Home*). Prima di iniziare: *Altro → Esporta → Scarica backup*.

- [ ] Apertura con i dati esistenti: compare l’avviso di aggiornamento una sola volta; lo storico del 20/10 e del 22/10 è invariato.
- [ ] Indicatore “Salvato sul dispositivo” visibile dopo ogni modifica.
- [ ] Seduta in modalità allenamento: “Serie fatta”, recupero che si ferma da solo con suono/vibrazione, RIR durante il recupero.
- [ ] Schermo spento durante il recupero (tasto laterale), riaccensione dopo 2 minuti: recupero terminato, nessuna serie duplicata o persa.
- [ ] App in background (passa a un’altra app, ricevi una notifica o una chiamata), ritorno: seduta e cronometro coerenti.
- [ ] Chiusura dell’app dal multitasking durante la seduta, riapertura: la seduta riprende dalla serie corretta.
- [ ] Rotazione in orizzontale e ritorno: nessun pulsante irraggiungibile.
- [ ] “Annulla ultima serie” in modalità allenamento.
- [ ] Inserimento di un decimale con la virgola (es. peso 74,6 kg) in Misure.
- [ ] Import di un file JSON dall’app File (anche un file generato da ChatGPT seguendo `docs/SCHEMA.md`).
- [ ] Download di backup JSON, report CSV (apertura in Numbers/Excel: colonne separate, accenti corretti) e PDF.
- [ ] Modalità aereo dopo una prima apertura online: l’app si apre, i dati sono visibili, una nuova misura viene salvata e resta dopo la riapertura.
- [ ] Schermo che resta acceso durante la modalità allenamento e si spegne normalmente dopo l’uscita.

Annotare data, modello di iPhone, versione di iOS ed eventuali anomalie (con schermata) in una issue del repository.

## Fuori ambito in questa versione

- **Sincronizzazione tra dispositivi (P2-02)**: non implementata. Richiede una decisione sul servizio di archiviazione remota, autenticazione, cifratura e gestione dei conflitti; nel frattempo il passaggio di dispositivo avviene con backup e import.
- **Import assistito da testo/PDF (P3-01)** e **promemoria (P3-02)**: in attesa, come da backlog.
