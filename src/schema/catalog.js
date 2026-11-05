// CAT-02 — Catalogo esercizi normalizzato.
// Convenzione dei nomi: nome italiano d'uso comune in palestra; se in sala si usa il termine inglese
// (es. "Leg press", "Lat machine") si tiene quello. Gli alias raccolgono le altre denominazioni diffuse in italiano
// e in inglese e i nomi già presenti nelle schede, così "Technogym Pulldown Machine" è riconosciuto come Lat machine.
// Il catalogo non rinomina mai gli esercizi già registrati: serve a riconoscerli, cercarli e illustrarli.
// pattern = schema di movimento per la miniatura (src/components/ExerciseThumb.jsx).

export const GROUPS = ['Petto', 'Schiena', 'Lombari', 'Spalle', 'Bicipiti', 'Tricipiti', 'Quadricipiti', 'Femorali', 'Glutei', 'Adduttori', 'Polpacci', 'Addome']

const E = (id, name, group, equipment, pattern, aliases = [], extra = {}) => ({ id, name, group, equipment, pattern, aliases, type: 'reps', perHand: false, ...extra })
const DB = { perHand: true }

export const CATALOG = [
  // Gambe e glutei
  E('leg-press', 'Leg press', 'Quadricipiti', 'machine', 'legpress', ['pressa', 'pressa orizzontale', 'pressa 45', 'leg press 45', 'leg press machine']),
  E('leg-extension', 'Leg extension', 'Quadricipiti', 'machine', 'legext', ['estensione gambe', 'estensioni quadricipiti', 'leg extension machine']),
  E('leg-curl', 'Leg curl', 'Femorali', 'machine', 'legcurl', ['curl gambe', 'leg curl sdraiato', 'leg curl seduto', 'femorali alla macchina', 'leg curl machine']),
  E('squat-bilanciere', 'Squat con bilanciere', 'Quadricipiti', 'barbell', 'squat', ['squat', 'back squat', 'squat bilanciere']),
  E('goblet-squat', 'Goblet squat', 'Quadricipiti', 'dumbbell', 'squat', ['squat con manubrio', 'goblet']),
  E('affondi', 'Affondi', 'Glutei', 'dumbbell', 'lunge', ['affondi con manubri', 'lunges', 'lunge', 'affondi camminati'], DB),
  E('hip-thrust', 'Hip thrust', 'Glutei', 'barbell', 'bridge', ['ponte glutei', 'glute bridge', 'hip thrust bilanciere']),
  E('calf-raise', 'Calf raise', 'Polpacci', 'machine', 'calf', ['polpacci', 'sollevamento sui polpacci', 'calf machine', 'calf raise in piedi']),
  E('abductor', 'Abductor machine', 'Glutei', 'machine', 'abduct', ['abduttori', 'abductor', 'macchina abduttori']),
  E('adductor', 'Adductor machine', 'Adduttori', 'machine', 'abduct', ['adduttori', 'adductor', 'macchina adduttori']),
  E('stacco', 'Stacco da terra', 'Femorali', 'barbell', 'hinge', ['stacco', 'deadlift', 'stacco con bilanciere']),
  E('stacco-rumeno', 'Stacco rumeno', 'Femorali', 'barbell', 'hinge', ['romanian deadlift', 'rdl', 'stacco a gambe tese']),
  // Petto
  E('chest-press', 'Chest press', 'Petto', 'machine', 'push', ['chest press machine', 'distensioni petto alla macchina', 'panca alla macchina', 'seated chest press']),
  E('incline-chest-press', 'Chest press inclinata', 'Petto', 'machine', 'push', ['incline chest press', 'chest press inclinata', 'distensioni inclinate alla macchina', 'incline press machine']),
  E('panca-piana', 'Panca piana con bilanciere', 'Petto', 'barbell', 'bench', ['panca piana', 'bench press', 'distensioni su panca piana']),
  E('panca-inclinata', 'Panca inclinata con bilanciere', 'Petto', 'barbell', 'bench', ['panca inclinata', 'incline bench press']),
  E('distensioni-manubri', 'Distensioni con manubri', 'Petto', 'dumbbell', 'bench', ['dumbbell press', 'panca con manubri', 'dumbbell bench press', 'chest press con manubri'], DB),
  E('pec-deck', 'Pectoral machine', 'Petto', 'machine', 'fly', ['pec deck', 'pectoral machine pec deck', 'butterfly', 'croci alla macchina', 'chest fly machine']),
  E('croci-manubri', 'Croci con manubri', 'Petto', 'dumbbell', 'fly', ['dumbbell fly', 'croci su panca', 'croci panca piana'], DB),
  E('croci-cavi', 'Croci ai cavi', 'Petto', 'cable', 'fly', ['cable crossover', 'croci al cavo', 'cable fly']),
  E('piegamenti', 'Piegamenti sulle braccia', 'Petto', 'bodyweight', 'pushup', ['push up', 'pushup', 'flessioni', 'piegamenti']),
  // Schiena
  E('lat-machine', 'Lat machine', 'Schiena', 'machine', 'pulldown', ['lat pulldown', 'pulldown', 'pulldown machine', 'technogym pulldown machine', 'lat machine avanti', 'tirate al petto', 'lat']),
  E('trazioni', 'Trazioni alla sbarra', 'Schiena', 'bodyweight', 'pulldown', ['trazioni', 'pull up', 'pullup', 'chin up', 'trazioni alla sbarra presa prona']),
  E('pulley', 'Pulley basso', 'Schiena', 'cable', 'row', ['pulley', 'seated cable row', 'rematore al cavo', 'low pulley']),
  E('row-machine', 'Rematore alla macchina', 'Schiena', 'machine', 'row', ['upper back machine', 'seated row machine', 'low row', 'rematore seduto alla macchina', 'row machine', 'upper back']),
  E('rematore-manubrio', 'Rematore con manubrio', 'Schiena', 'dumbbell', 'row', ['one arm dumbbell row', 'rematore a un braccio', 'dumbbell row'], DB),
  E('rematore-bilanciere', 'Rematore con bilanciere', 'Schiena', 'barbell', 'row', ['barbell row', 'bent over row', 'rematore bilanciere']),
  E('hyperextension', 'Iperestensioni', 'Lombari', 'bodyweight', 'hyperext', ['hyperextension', 'iperestensioni lombari', 'back extension', 'estensioni lombari']),
  // Spalle
  E('shoulder-press', 'Shoulder press', 'Spalle', 'machine', 'overhead', ['shoulder press machine', 'lento avanti alla macchina', 'distensioni spalle alla macchina']),
  E('lento-manubri', 'Lento con manubri', 'Spalle', 'dumbbell', 'overhead', ['dumbbell shoulder press', 'military press con manubri', 'lento avanti con manubri', 'shoulder press con manubri'], DB),
  E('lento-avanti', 'Lento avanti con bilanciere', 'Spalle', 'barbell', 'overhead', ['military press', 'overhead press', 'lento avanti']),
  E('alzate-laterali', 'Alzate laterali', 'Spalle', 'dumbbell', 'raise', ['alzate laterali con manubri', 'lateral raise', 'alzate laterali manubri', 'lateral raises'], DB),
  E('alzate-frontali', 'Alzate frontali', 'Spalle', 'dumbbell', 'raise', ['front raise', 'alzate frontali con manubri'], DB),
  E('reverse-fly', 'Reverse fly alla macchina', 'Spalle', 'machine', 'fly', ['reverse pec deck', 'reverse fly', 'deltoide posteriore alla macchina', 'croci inverse']),
  E('face-pull', 'Face pull', 'Spalle', 'cable', 'row', ['face pull al cavo', 'facepull']),
  // Braccia
  E('curl-manubri', 'Curl con manubri', 'Bicipiti', 'dumbbell', 'curl', ['dumbbell curl', 'curl bicipiti con manubri', 'curl alternato', 'curl manubri'], DB),
  E('curl-bilanciere', 'Curl con bilanciere', 'Bicipiti', 'barbell', 'curl', ['barbell curl', 'curl bilanciere']),
  E('hammer-curl', 'Curl a martello', 'Bicipiti', 'dumbbell', 'curl', ['hammer curl', 'curl hammer', 'curl a martello con manubri'], DB),
  E('curl-cavo', 'Curl al cavo', 'Bicipiti', 'cable', 'curl', ['cable curl', 'curl ai cavi']),
  E('triceps-pushdown', 'Pushdown ai cavi', 'Tricipiti', 'cable', 'pushdown', ['triceps pushdown', 'triceps push down', 'triceps push down al cavo con barra', 'push down tricipiti', 'spinte in basso al cavo', 'pushdown']),
  E('french-press', 'French press', 'Tricipiti', 'barbell', 'skull', ['skull crusher', 'estensioni tricipiti su panca', 'french press bilanciere']),
  E('dip', 'Dip alle parallele', 'Tricipiti', 'bodyweight', 'dip', ['dips', 'dip', 'parallele']),
  // Addome
  E('plank', 'Plank', 'Addome', 'bodyweight', 'plank', ['plank frontale', 'tenuta addominale'], { type: 'time' }),
  E('crunch', 'Crunch', 'Addome', 'bodyweight', 'crunch', ['crunch addominali', 'sit up', 'addominali']),
  E('leg-raise', 'Sollevamento gambe', 'Addome', 'bodyweight', 'legraise', ['leg raise', 'alzate gambe', 'sollevamento gambe a terra']),
]

// Normalizzazione per confronti e ricerca: minuscole, senza accenti né punteggiatura, spazi singoli
export const normText = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const INDEX = new Map()
for (const c of CATALOG) for (const n of [c.id.replace(/-/g, ' '), c.name, ...c.aliases]) if (!INDEX.has(normText(n))) INDEX.set(normText(n), c)

// Voce del catalogo corrispondente a un esercizio: nome (o id) uguale al nome o a un alias, dopo la normalizzazione.
// Solo corrispondenze esatte, mai per somiglianza: varianti con nome diverso restano esercizi diversi.
// Carico per mano diverso → nessuna corrispondenza. L'attrezzo non si confronta: nei dati migrati è spesso quello
// predefinito ("Macchina") anche per esercizi al cavo o a corpo libero.
export function catalogMatch(ex) {
  if (!ex) return null
  const c = INDEX.get(normText(ex.name)) ?? (ex.exerciseId ?? ex.id ? INDEX.get(normText(String(ex.exerciseId ?? ex.id).replace(/-/g, ' '))) : null) ?? null
  if (!c) return null
  if (ex.perHand != null && !!ex.perHand !== c.perHand) return null
  return c
}

export const catalogById = (id) => CATALOG.find((c) => c.id === id) ?? null

// Gruppo canonico per i filtri: dal catalogo, altrimenti dal gruppo scritto nella scheda (parole chiave)
const GROUP_WORDS = [
  ['Petto', ['petto', 'pettorali', 'chest']],
  ['Schiena', ['schiena', 'dorsali', 'dorso', 'back']],
  ['Lombari', ['lombari']],
  ['Spalle', ['spalle', 'deltoidi', 'shoulder']],
  ['Bicipiti', ['bicipiti', 'biceps']],
  ['Tricipiti', ['tricipiti', 'triceps']],
  ['Quadricipiti', ['quadricipiti', 'gambe', 'legs', 'cosce']],
  ['Femorali', ['femorali', 'hamstring']],
  ['Glutei', ['glutei', 'glutes']],
  ['Adduttori', ['adduttori']],
  ['Polpacci', ['polpacci', 'calves']],
  ['Addome', ['addome', 'addominali', 'core', 'abs']],
]
export function groupOf(ex) {
  const c = catalogMatch(ex)
  if (c) return c.group
  const words = normText(ex.group).split(' ')
  return GROUP_WORDS.find(([, ws]) => ws.some((w) => words.includes(w)))?.[0] ?? null
}
