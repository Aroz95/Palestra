# Schema JSON pubblico — Palestra v3

Questo documento descrive i file che l’app sa **importare** ed **esportare**. È uno schema stabile: file scritti a mano o generati con altri strumenti (ad esempio ChatGPT) sono importabili se lo rispettano. Esempi completi e validati automaticamente dai test: [`docs/examples/`](examples/).

## Regole generali

- Ogni file ha `type` e `schemaVersion: 3`. File con `schemaVersion` maggiore di 3 vengono rifiutati.
- Date: `AAAA-MM-GG`. Istanti: ISO 8601 con offset, es. `2026-10-22T18:20:00+02:00`. Orari dei pasti: `HH:MM`.
- Unità: peso **kg**, lunghezze **cm**, distanze **m**, durate **min**, tempi di esercizi e recuperi **secondi**, energia **kcal**.
- `null` = dato non disponibile (diverso da `0`). Un carico `0` vale solo per il corpo libero.
- I numeri non possono essere negativi; i valori fuori intervallo sono errori, segnalati con il percorso del campo (es. `workoutTemplates[0].exercises[2].repMin`).
- Gli `id` sono facoltativi ma consigliati: servono a riconoscere i duplicati quando reimporti lo stesso file. Senza `id` l’app ne genera uno stabile (dal nome) o usa un’impronta del contenuto.
- I campi `summary` presenti nei file non vengono mai letti: le statistiche sono sempre ricalcolate dai dati.
- Un file può contenere un singolo oggetto oppure un **array** di oggetti tipizzati (es. programma + piano alimentare insieme).
- Limiti: 5 MB per file, 5000 elementi per elenco.

## Tipi di file

| `type` | Contenuto | Importazione |
|---|---|---|
| `palestra-backup` | tutti i dati | unione (predefinita) o sostituzione completa con doppia conferma |
| `palestra-program` | programma con schede A/B e calendario | aggiunto; se già presente: salta / aggiorna / copia |
| `palestra-seduta` | una seduta di sala pesi | aggiunta allo storico |
| `palestra-swim-session` | una nuotata (o `sessions: [...]`) | aggiunta allo storico |
| `palestra-diet-plan` | un piano alimentare | aggiunto, **non** attivato in automatico |
| `palestra-body-measurements` | elenco di misure | ogni misura è un nuovo record, nessuna sovrascrittura |
| `palestra-report` | riepilogo per periodo | **non importabile** (non è un backup) |

Compatibilità: sono importabili anche i file delle versioni precedenti, cioè il backup `{ version, template, sessions, activeSessionId, settings }` e la seduta `{ "type": "palestra-seduta", "version": 2, "session": {...} }`.

## `palestra-program`

```json
{
  "type": "palestra-program",
  "schemaVersion": 3,
  "id": "program-2026-autunno",
  "name": "Ricomposizione + nuoto",
  "description": "",
  "validFrom": "2026-11-02",
  "validTo": null,
  "status": "active",
  "workoutTemplates": [ { "...scheda..." } ],
  "weeklySchedule": [ { "...ricorrenza..." } ]
}
```

`status`: `active` | `draft` | `archived`.

### Scheda (`workoutTemplates[]`)

| Campo | Tipo | Note |
|---|---|---|
| `id` | testo | stabile; le sedute vi fanno riferimento |
| `label` | testo | es. `A`, `B` |
| `name` | testo | obbligatorio |
| `revision` | intero ≥ 1 | predefinito 1 |
| `estimatedMinutes` | numero \| null | |
| `warmup`, `cooldown` | elenco | `{ "name", "minutes", "speed" }` (velocità in km/h) |
| `exercises` | elenco | vedi sotto; una scheda senza esercizi viene segnalata come incompleta |

### Esercizio

| Campo | Tipo | Note |
|---|---|---|
| `id` | testo | identità del movimento/macchina: usata per i confronti e i record |
| `name` | testo | obbligatorio |
| `group` | testo | gruppo muscolare |
| `type` | `reps` \| `time` | `time` = esercizio a tempo (es. plank) |
| `equipment` | `machine` \| `cable` \| `dumbbell` \| `barbell` \| `bodyweight` \| `other` | |
| `perHand` | booleano | carico per mano: nel volume conta ×2 |
| `sets` | intero 0–20 | serie previste |
| `repMin`, `repMax` | intero \| null | range di ripetizioni (`repMin ≤ repMax`); `reps` è accettato come scorciatoia |
| `durationSec` | intero \| null | solo per `type: "time"` |
| `suggestedWeightKg` | numero \| null | carico suggerito |
| `targetRir` | 0–5 \| null | ripetizioni in riserva obiettivo |
| `restSeconds` | intero | recupero dopo ogni serie (predefinito 60) |
| `step` | numero | incremento dei pulsanti +/− |
| `variant`, `instructions`, `notes` | testo | |

### Ricorrenza (`weeklySchedule[]`)

| Campo | Tipo | Note |
|---|---|---|
| `weekday` | 1–7 | 1 = lunedì … 7 = domenica; più voci nello stesso giorno sono ammesse |
| `kind` | `strength` \| `swim` \| `rest` \| `other` | |
| `templateId` | testo | per `strength`: id di una scheda del programma |
| `label` | testo | per `rest`/`other` |
| `swimPlan` | oggetto \| null | per `swim`: `{ poolLengthM, style, goal, estimatedMinutes, plannedBlocks }` |

Le ricorrenze generano attività **previste**, mai sedute svolte.

## Seduta di sala pesi (`palestra-seduta`)

```json
{ "type": "palestra-seduta", "schemaVersion": 3, "session": { "...seduta..." } }
```

Campi della seduta: `id`, `kind: "strength"`, `date`, `title`, `status` (`planned` | `in_progress` | `completed` | `skipped` | `postponed`), `templateId`, `templateRevision`, `startedAt`, `endedAt`, `durationMin`, `durationSource` (`computed` | `manual` | `stopwatch` | `legacy`), `durationReason`, `note`, `feedback`, `energy`, `warmup`, `cooldown`, `exercises`.

Ogni esercizio della seduta ha `exerciseId` (id dell’esercizio in scheda), `name`, `type`, `equipment`, `perHand`, `rest`, `target` (obiettivo della scheda al momento della seduta) e `sets`:

```json
{ "reps": 10, "weight": 60, "done": true, "target": { "repMin": 10, "repMax": 12, "weightKg": 60, "rir": 3 }, "rir": 3, "rpe": null, "pain": null, "note": "", "at": "2026-11-02T18:35:00+01:00" }
```

- `reps` e `weight` sono i valori **eseguiti**; `target` è l’obiettivo.
- Per gli esercizi a tempo si usa `durationSec` al posto di `reps`/`weight`.
- `pain`: `{ "location": "spalla destra", "intensity": 3 }` oppure `null`.
- Volume = somma di `reps × weight × (perHand ? 2 : 1)` sulle sole serie con `done: true` e carico noto.

`feedback`: `{ fatigue (1–10), energy (1–5), technique (1–5), pain (testo), notes, nextDayRecovery (1–5) }`, tutti facoltativi.

`energy` (facoltativo): `{ source: "estimate" | "device" | "manual", method, bodyWeightKg, durationMin, activeKcal: { min, max }, totalKcal: { min, max } }`. Le calorie attive escludono il metabolismo a riposo; le totali lo includono.

## Nuoto (`palestra-swim-session`)

```json
{
  "type": "palestra-swim-session",
  "schemaVersion": 3,
  "id": "swim-2026-10-21",
  "date": "2026-10-21",
  "durationMin": 60,
  "poolLengthM": 25,
  "plannedDistanceM": 2450,
  "actualDistanceM": null,
  "estimatedDistanceM": { "min": 1500, "max": 1800 },
  "distanceSource": "estimated",
  "isPartial": true,
  "plannedBlocks": [ { "repeats": 2, "segmentsM": [200, 100, 75, 75] }, { "text": "(100+100+2×75)×3" } ]
}
```

| Campo | Note |
|---|---|
| `plannedDistanceM` | distanza **prevista** dal programma: non è mai conteggiata come nuotata |
| `actualDistanceM` | distanza **effettiva**, solo se nota |
| `estimatedDistanceM` | stima `{ min, max }` (o un numero): resta un intervallo e non viene sommata alle distanze misurate |
| `distanceSource` | `measured` \| `manually_counted` \| `estimated` \| `unknown`; `measured`/`manually_counted` richiedono `actualDistanceM`, `estimated` richiede `estimatedDistanceM` |
| `isPartial` | percorso abbreviato rispetto al previsto |
| `plannedBlocks` | `{ repeats, segmentsM, restSec, note }` oppure `{ text }` nel formato `(200+100+2×75)×2` («2×75» = 2 ripetizioni da 75 m, «)×2» ripete il gruppo) |
| `technique` | `{ catch, strokeQuality, shoulderFatigue, breathing }` valori 1–5 facoltativi |
| `rpe`, `style`, `goal`, `notes` | facoltativi |

Passo e numero di vasche sono calcolati solo da distanze misurate; con una distanza stimata vengono mostrati come intervallo e marcati “stima”.

## Piano alimentare (`palestra-diet-plan`)

| Campo | Note |
|---|---|
| `name` | obbligatorio |
| `status` | `draft` (bozza) \| `validated` (validato da un professionista, con `validatedBy`) |
| `author`, `goal`, `notes`, `validFrom`, `validTo` | facoltativi |
| `days[]` | `{ weekday (1–7) oppure date, dayType: "any" \| "training" \| "rest", label, meals[] }` |

Pasto: `{ id, category, label, time, items[], alternatives[], nutrition, notes }`

- `category`: `breakfast` | `snack` | `lunch` | `afternoon_snack` | `dinner` | `other`.
- Alimento: `{ name, quantity, unit, notes, alternatives: [alimento] }`.
- `alternatives` del pasto: `[{ "label": "Alternativa salata", "items": [alimento] }]` (è accettato anche un elenco di alimenti).
- `nutrition`: `{ kcal, proteinG, carbsG, fatG }` oppure `null`. Se mancano non vengono inventati: l’app mostra “ND”, e i totali del giorno sono “parziali” se mancano per alcuni pasti.

Stesso `weekday` con `dayType` diversi = varianti per giorni di allenamento e di riposo.

## Misure (`palestra-body-measurements`)

```json
{ "type": "palestra-body-measurements", "schemaVersion": 3, "measurements": [ { "date": "2026-10-22", "time": "07:30", "weightKg": 75, "waistCm": 90, "abdomenCm": 100 } ] }
```

Campi: `at` (istante) oppure `date` + `time`, `weightKg`, `waistCm` (girovita, punto più stretto), `abdomenCm` (circonferenza addominale all’ombelico), `hipsCm`, `chestCm`, `armCm`, `notes`, `source` (`manual` | `imported` | `device`). Sono ammessi dati parziali, ma almeno un valore è obbligatorio.

## Backup (`palestra-backup`)

Contiene lo stato completo: `profile`, `goals`, `measurements`, `programs`, `workoutTemplates` (con `programId`), `sessions`, `activeSessionId`, `calendar`, `dietPlans`, `dietLog`, `settings`, `meta`.

## Report (`palestra-report`)

È generato da *Progressi* e contiene `type`, `schemaVersion`, `generatedAt`, `period`, `units`, `filters`, `summary`, `dataQuality`, `notes` ed eventualmente `details`. Il CSV ha una riga per valore: `date,section,metric,value,min,max,unit,quality,source`. Un report **non** è un backup e non è importabile.
