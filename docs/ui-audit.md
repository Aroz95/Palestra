# Audit UI e restyle “Performance Editorial”

Riferimento: *Palestra — UI/UX & Motion Design Specification v1.0* (23/10/2026). Questo documento è l’audit richiesto dalla sezione 2, scritto leggendo il codice: ogni punto rimanda a file reali. Le schermate sono generate con `e2e/screenshots.e2e.js` (data fissa 31/10/2026, dati degli esempi in `docs/examples/`).

- **Prima** (solo tema scuro, l’unico esistente): [`ui-audit/before/`](ui-audit/before/) — 375, 768 e 1440 px.
- **Dopo** (chiaro e scuro): [`ui-audit/after/`](ui-audit/after/) — 375 e 1440 px.
- Rigenerare: `SHOTS=docs/ui-audit/after SHOTS_WIDTHS=375,768,1440 npx playwright test e2e/screenshots.e2e.js`.

## 1. Inventario tecnico (verificato)

| Aspetto | Stato nel codice |
|---|---|
| Framework | React 18 + Vite 6, PWA con service worker (`public/sw.js`), pubblicazione GitHub Pages |
| Routing | nessun router: schede in stato persistito (`palestra:tab`, `palestra:subtabs`) in `src/App.jsx` |
| Styling | Tailwind 4 (`@tailwindcss/vite`), un solo file `src/index.css` |
| Libreria UI | nessuna: primitive proprie in `src/components/ui.jsx` (Section, Card, Chip, Segmented, Field, campi, Rating, Toggle, Sheet, Empty, Metric), `Stepper.jsx` |
| Grafici | SVG fatto a mano (`src/components/LineChart.jsx`) con tabella valori accessibile |
| Icone | prima: emoji nella navigazione; ora icone SVG a tratto (`src/components/icons.jsx`) |
| Stato e persistenza | stato unico React + IndexedDB con coda di scrittura e indicatore “Salvato / Salvataggio / Non salvato” (`src/lib/persist.js`) |
| Tipografia | font di sistema; nessun web font (resta offline) |
| Breakpoint | Tailwind standard; prima nessun layout desktop dedicato |
| Test | Vitest (logica, contrasti dei token), Playwright Chromium con profilo iPhone 13 |

## 2. Matrice schermate

| Schermata | Componenti / file | Stato prima | Gap rispetto alla specifica | Priorità | Intervento |
|---|---|---|---|---|---|
| Shell e navigazione | `App.jsx` | barra in basso con emoji; a 1440 px colonna centrale con barra in basso | nessuna navigazione desktop; icone non coerenti | P1 | barra in basso su mobile, laterale da 1024 px; icone SVG; etichette sempre visibili |
| Oggi | `TodayView.jsx` | cronometro in alto come elemento dominante; nessuna CTA principale; 3 pulsanti con emoji | §6.1: una CTA “Inizia/Riprendi allenamento” | P1 | CTA unica (Riprendi se c’è una seduta aperta, altrimenti Inizia se non c’è un’attività in programma); cronometro solo negli Allenamenti o se in uso |
| Seduta palestra | `SessionView.jsx`, `ExerciseCard.jsx`, `Stepper.jsx` | righe serie con stepper; “Inizia allenamento” evidente | campi a 40 px; spunta senza feedback | P1 | campi a 44 px con bordo; spunta animata 180 ms; nessun overflow a 320 px (testato) |
| Modalità allenamento | `WorkoutMode.jsx` | pulsante circolare ambra per avviare i tempi | ambra usata come azione principale | P1 | azioni in colore primario, ambra solo per avvisi; recupero in neutro; pressione max 0,98 |
| Nuoto | `SwimSessionView.jsx`, `ProgramsView.jsx` (BlocksEditor) | previsto / nuotato / stimato già distinti con etichetta “stima” | — (requisito §6.4 già rispettato) | P0 verificato | solo token; editor blocchi con anteprima (correzione precedente) |
| Alimentazione | `DietView.jsx`, `diet/*` | obiettivo / programmato / consumato distinti, ND mai zero | chip “Attivo” con classi in conflitto (colore casuale) | P1 | `Chip` senza conflitti; token |
| Calendario, Schede, Storico | `CalendarView.jsx`, `ProgramsView.jsx`, `HistoryView.jsx` | stati con colori Tailwind fissi in `lib/calendar.js` | “In corso” in ambra (non è un avviso) | P1 | stati semantici con etichetta sempre visibile |
| Progressi | `ProgressView.jsx`, `LineChart.jsx` | grafici con HEX fissi; a 1440 px testi del grafico enormi | due pulsanti “primari” (PDF blu, JSON verde) | P1/P2 | colori del grafico dai token; larghezza massima; un solo primario (PDF) |
| Altro / Importa / Opzioni | `MoreView.jsx`, `ImportView.jsx` | — | nessuna scelta del tema | P1 | sezione “Aspetto”: Automatico / Chiaro / Scuro |
| Pannelli (Sheet) | `ui.jsx` | nessuna animazione, focus non gestito | §9 focus trap e ripristino | P0 | focus sul pannello, Tab ciclico, Esc, ripristino del focus; apertura 260 ms |
| Editor blocchi nuoto | `ProgramsView.jsx` | dentro un `<label>`: un tocco eliminava il primo blocco | difetto funzionale | P0 | corretto (commit precedente) |

## 3. Problemi trasversali trovati

1. **Colori codificati**: circa 700 classi `slate/emerald/sky/amber/rose` sparse in 25 componenti, più HEX nel grafico e negli stati del calendario. Nessun token, un solo tema.
2. **Gerarchia**: più azioni “primarie” nella stessa area (export report; cronometro e attività su Oggi).
3. **Ambra come azione** (timer della modalità allenamento, stato “In corso”) invece che come attenzione.
4. **Focus**: nessun `focus-visible` sui pulsanti; pannelli senza gestione del focus.
5. **Movimento**: `active:scale-95` ovunque; nessun rispetto di `prefers-reduced-motion`.
6. **Target tattili**: valutazioni e segmenti a 36 px, campi a 40 px.
7. **Classi in conflitto**: `Chip` con sfondo predefinito + sfondo personalizzato (risultato dipendente dall’ordine del CSS).

Già conformi prima del restyle (verificato, non modificato nella logica): distinzione previsto / effettivo / stimato / ND (nuoto, alimentazione, report); salvataggio con indicatore visibile e ripristino dopo interruzione; campi numerici con virgola decimale; tabelle dati accessibili accanto ai grafici.

## 4. Decisioni e scostamenti motivati dalla specifica

| Specifica | Decisione | Motivo |
|---|---|---|
| `--primary` chiaro `#087F70` | `#077365` | `#087F70` dà 4,26:1 su `primary-soft` e 4,34:1 su `surface-muted` (sotto 4,5:1, come la specifica chiedeva di verificare) |
| Bordi `#D7E1E4` | mantenuti per separatori; nuovo `--border-strong` (`#7F9298` / `#6B848B`) per i bordi dei campi | WCAG 1.4.11: il contorno di un campo deve avere 3:1 |
| Timer di recupero “non deve avviarsi senza consenso” (§6.3) | resta automatico, disattivabile in *Altro → Opzioni* | requisito esplicito del proprietario del prodotto (recupero di 1 minuto avviato da “Serie fatta”); il consenso è l’impostazione |
| Destinazione “Nuoto” separata (§5) | non aggiunta | struttura esistente valida (nuoto dentro Allenamenti, Oggi e Calendario); la specifica chiede di non aggiungere schede senza valutazione d’uso |
| Font Inter | font di sistema | nessun download, funziona offline; la specifica lo ammette |
| Libreria di animazione | nessuna | bastano transizioni e keyframe CSS (§10) |
| Toast di salvataggio | indicatore “Salvato sul dispositivo” esistente, discreto, `role=status` | già soddisfa “feedback discreto, mai un modale” |
| Vasche effettive per singolo blocco (§6.4) | non implementato | richiede un cambio del modello dati: la specifica chiede di concordarlo prima |

## 5. Sistema di design implementato

- **Token** in `src/index.css`: palette chiara e scura della specifica (con le correzioni sopra), esposte a Tailwind come colori semantici: `bg-bg`, `bg-surface`, `bg-surface-muted`, `bg-surface-strong`, `text-fg`, `text-fg-soft`, `text-muted`, `border-line`, `border-line-strong`, `primary` / `on-primary` / `primary-soft`, `swim`, `warning`, `danger` con i rispettivi `on-*` e `*-soft`, `focus`, colori dei grafici. Nei componenti non restano HEX né palette Tailwind (verificabile con `grep -rE "(bg|text|border)-(slate|emerald|sky|amber|rose)" src`).
- **Tema**: automatico (`prefers-color-scheme`), oppure Chiaro/Scuro in *Altro → Opzioni*; scelta per dispositivo (`palestra:theme`), applicata prima del primo disegno da `index.html`; `theme-color` aggiornato.
- **Contrasti**: `tests/tokens.test.js` verifica 4,5:1 per i testi e 3:1 per componenti, bordi dei campi, focus e serie dei grafici, in entrambi i temi.
- **Pulsanti**: `.btn-primary`, `.btn-secondary` (alias `.btn-ghost`), `.btn-danger`; altezza minima 44 px; pressione 0,98; disabilitato al 50%.
- **Campi**: 44 px, bordo `line-strong`, focus con bordo e anello primario, errore con bordo rosso (`aria-invalid`).
- **Tipografia**: titolo pagina 28/32 px, titoli di sezione 18 px semibold (non più maiuscolo spaziato), etichette 13 px, metriche 18 px bold con cifre tabulari.
- **Movimento** (§8): pannelli 260 ms `cubic-bezier(.2,.8,.2,1)`, sfondo in dissolvenza 200 ms, spunta della serie 180 ms, cambio di scheda 150 ms, comparsa di card vuote/CTA 200 ms con 6 px. Con `prefers-reduced-motion: reduce` transizioni e animazioni sono annullate (test E2E).
- **Accessibilità**: `focus-visible` 2 px con colore `--focus` su tutti gli elementi interattivi; pannelli con focus trap, Esc e ripristino del focus (test E2E); stati del calendario sempre con etichetta testuale; reflow senza scorrimento orizzontale a 320 px (test E2E).

## 6. Verifica (Definition of Done)

| Voce | Esito |
|---|---|
| Screenshot prima/dopo, mobile e desktop, chiaro/scuro | `docs/ui-audit/before`, `docs/ui-audit/after` |
| Componenti riutilizzati | sì: primitive di `ui.jsx` e classi `.btn-*`; nessuna nuova variante senza motivo |
| Contrasto e focus visibile | test automatico dei token; focus-visible globale |
| Comunicazione non solo cromatica | stati con etichetta, “stima”, “ND”, “parziale” testuali |
| Tastiera e focus nei pannelli | `e2e/ui.e2e.js` |
| `prefers-reduced-motion` | `e2e/ui.e2e.js` |
| Nessuna regressione su salvataggio e previsto/effettivo/stimato | intera suite unit ed E2E invariata e verde |
| Nessun overflow 320–375 px | `e2e/ui.e2e.js` (320 px) e screenshot a 375 px |
| Da verificare a mano | VoiceOver su iPhone, testo ingrandito di iOS, tastiera virtuale aperta nei fogli, orientamento orizzontale (checklist in `docs/COLLAUDO.md`) |

## 7. Backlog (fasi successive)

1. **P2 — Progressi**: due o tre indicatori principali in alto, volume di nuoto effettivo per settimana con le stime distinte, tooltip accessibili da tastiera.
2. **P2 — Card alimentazione comprimibili** e riepilogo macro “consumato / obiettivo” come barre con valori testuali.
3. **P2 — Dialog di conferma** in-app (oggi `window.confirm`) con descrizione dell’impatto e pulsante “Elimina sessione”.
4. **P3 — Layout desktop a più colonne** per Progressi (da 1200 px) e rifiniture dopo prova sul campo.
5. **Modello dati** (da concordare): vasche effettive per blocco di nuoto.
