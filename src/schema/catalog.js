// CAT-02 — Catalogo esercizi normalizzato.
// Convenzione dei nomi: nome italiano d'uso comune in palestra; se in sala si usa il termine inglese
// (es. "Leg press", "Lat machine") si tiene quello. Gli alias raccolgono le altre denominazioni diffuse in italiano
// e in inglese e i nomi già presenti nelle schede, così "Technogym Pulldown Machine" è riconosciuto come Lat machine.
// Il catalogo non rinomina mai gli esercizi già registrati: serve a riconoscerli, cercarli e illustrarli.
// Illustrazioni: set unico Everkinetic (Greg Priday), CC BY-SA 4.0 — vedi public/exercises/LICENSE.md.

// Illustrazione per esercizio (public/exercises/<id>.webp) e disegno originale da cui è ricavata.
// Senza voce: il set non contiene quell'esercizio (es. plank frontale) e la miniatura resta neutra.
export const IMAGE_SOURCES = {
  'leg-press': 'everkinetic 0127: Leg Press',
  'leg-extension': 'everkinetic 0142: Leg Extensions',
  'leg-curl': 'everkinetic 0117: Lying Leg Curl Machine',
  'squat-bilanciere': 'everkinetic 0122: Barbell Squat',
  'goblet-squat': 'everkinetic 0130: Squats: Dumbbells',
  'affondi': 'everkinetic 0115: Lunges: Dumbbell',
  'calf-raise': 'everkinetic 0282: Standing Calf Raises using Machine',
  'abductor': 'everkinetic 0156: Thigh Abductor',
  'adductor': 'everkinetic 0157: Thigh Adductor',
  'stacco': 'everkinetic 0099: Dead Lifts: Barbell',
  'stacco-rumeno': 'everkinetic 0118: Romanian Dead Lift',
  'chest-press': 'everkinetic 0066: Bench Press: Machine',
  'incline-chest-press': 'everkinetic 0084: Incline Chest Press',
  'panca-piana': 'everkinetic 0042: Bench Press: Barbell',
  'panca-inclinata': 'everkinetic 0043: Bench Press: Barbell (Incline)',
  'distensioni-manubri': 'everkinetic 0055: Bench Press: Dumbbell',
  'pec-deck': 'everkinetic 0047: Butterfly Machine',
  'croci-manubri': 'everkinetic 0056: Dumbbell Flys',
  'croci-cavi': 'everkinetic 0057: Flat Bench Cable Flys',
  'piegamenti': 'everkinetic 0077: Push Up: Body Weight',
  'lat-machine': 'everkinetic 0093: Pull Down: Underhand',
  'trazioni': 'everkinetic 0087: Pull Ups',
  'pulley': 'everkinetic 0025: Seated Cable Rows',
  'row-machine': 'everkinetic 0025: Seated Cable Rows',
  'rematore-manubrio': 'everkinetic 0024: Rear Deltoid Row Dumbbell',
  'rematore-bilanciere': 'everkinetic 0026: Reverse Grips Bent Over Barbell Rows',
  'hyperextension': 'everkinetic 0103: Hyperextensions',
  'shoulder-press': 'everkinetic 0003: Seated Shoulder Press Machine',
  'lento-manubri': 'everkinetic 0012: Dumbbell Shoulder Press',
  'lento-avanti': 'everkinetic 0004: Seated Military Press',
  'alzate-laterali': 'everkinetic 0018: Lateral Dumbbell Raises',
  'alzate-frontali': 'everkinetic 0033: Front Dumbbell Raise',
  'reverse-fly': 'everkinetic 0035: Seated Rear Lateral Cable Raise',
  'curl-manubri': 'everkinetic 0224: Biceps Curl: Dumbbell',
  'curl-bilanciere': 'everkinetic 0211: Biceps Curl: Barbell',
  'hammer-curl': 'everkinetic 0227: Biceps Curl: Dumbbell (Hammer)',
  'curl-cavo': 'everkinetic 0212: Standing Biceps Curl with Cable',
  'triceps-pushdown': 'everkinetic 0205: Triceps Pushdown: Cable',
  'french-press': 'everkinetic 0183: Lying Triceps Press with Barbell',
  'dip': 'everkinetic 0172: Triceps Dips: Body Weight',
  'crunch': 'everkinetic 0291: Crunches',
  'leg-raise': 'everkinetic 0021: Flat Bench Leg Raises',
}
const IMAGES = Object.fromEntries(Object.keys(IMAGE_SOURCES).map((id) => [id, `exercises/${id}.webp`]))

export const GROUPS = ['Petto', 'Schiena', 'Lombari', 'Spalle', 'Bicipiti', 'Tricipiti', 'Quadricipiti', 'Femorali', 'Glutei', 'Adduttori', 'Polpacci', 'Addome']

const E = (id, name, group, equipment, aliases = [], extra = {}) => ({ id, name, group, equipment, aliases, type: 'reps', perHand: false, image: IMAGES[id] ?? null, ...extra })
const DB = { perHand: true }

export const CATALOG = [
  // Gambe e glutei
  E('leg-press', 'Leg press', 'Quadricipiti', 'machine', ['pressa', 'pressa orizzontale', 'pressa 45', 'leg press 45', 'leg press machine']),
  E('leg-extension', 'Leg extension', 'Quadricipiti', 'machine', ['estensione gambe', 'estensioni quadricipiti', 'leg extension machine']),
  E('leg-curl', 'Leg curl', 'Femorali', 'machine', ['curl gambe', 'leg curl sdraiato', 'leg curl seduto', 'femorali alla macchina', 'leg curl machine']),
  E('squat-bilanciere', 'Squat con bilanciere', 'Quadricipiti', 'barbell', ['squat', 'back squat', 'squat bilanciere']),
  E('goblet-squat', 'Goblet squat', 'Quadricipiti', 'dumbbell', ['squat con manubrio', 'goblet']),
  E('affondi', 'Affondi', 'Glutei', 'dumbbell', ['affondi con manubri', 'lunges', 'lunge', 'affondi camminati'], DB),
  E('hip-thrust', 'Hip thrust', 'Glutei', 'barbell', ['ponte glutei', 'glute bridge', 'hip thrust bilanciere']),
  E('calf-raise', 'Calf raise', 'Polpacci', 'machine', ['polpacci', 'sollevamento sui polpacci', 'calf machine', 'calf raise in piedi']),
  E('abductor', 'Abductor machine', 'Glutei', 'machine', ['abduttori', 'abductor', 'macchina abduttori']),
  E('adductor', 'Adductor machine', 'Adduttori', 'machine', ['adduttori', 'adductor', 'macchina adduttori']),
  E('stacco', 'Stacco da terra', 'Femorali', 'barbell', ['stacco', 'deadlift', 'stacco con bilanciere']),
  E('stacco-rumeno', 'Stacco rumeno', 'Femorali', 'barbell', ['romanian deadlift', 'rdl', 'stacco a gambe tese']),
  // Petto
  E('chest-press', 'Chest press', 'Petto', 'machine', ['chest press machine', 'distensioni petto alla macchina', 'panca alla macchina', 'seated chest press']),
  E('incline-chest-press', 'Chest press inclinata', 'Petto', 'machine', ['incline chest press', 'chest press inclinata', 'distensioni inclinate alla macchina', 'incline press machine']),
  E('panca-piana', 'Panca piana con bilanciere', 'Petto', 'barbell', ['panca piana', 'bench press', 'distensioni su panca piana']),
  E('panca-inclinata', 'Panca inclinata con bilanciere', 'Petto', 'barbell', ['panca inclinata', 'incline bench press']),
  E('distensioni-manubri', 'Distensioni con manubri', 'Petto', 'dumbbell', ['dumbbell press', 'panca con manubri', 'dumbbell bench press', 'chest press con manubri'], DB),
  E('pec-deck', 'Pectoral machine', 'Petto', 'machine', ['pec deck', 'pectoral machine pec deck', 'butterfly', 'croci alla macchina', 'chest fly machine']),
  E('croci-manubri', 'Croci con manubri', 'Petto', 'dumbbell', ['dumbbell fly', 'croci su panca', 'croci panca piana'], DB),
  E('croci-cavi', 'Croci ai cavi', 'Petto', 'cable', ['cable crossover', 'croci al cavo', 'cable fly']),
  E('piegamenti', 'Piegamenti sulle braccia', 'Petto', 'bodyweight', ['push up', 'pushup', 'flessioni', 'piegamenti']),
  // Schiena
  E('lat-machine', 'Lat machine', 'Schiena', 'machine', ['lat pulldown', 'pulldown', 'pulldown machine', 'technogym pulldown machine', 'lat machine avanti', 'tirate al petto', 'lat']),
  E('trazioni', 'Trazioni alla sbarra', 'Schiena', 'bodyweight', ['trazioni', 'pull up', 'pullup', 'chin up', 'trazioni alla sbarra presa prona']),
  E('pulley', 'Pulley basso', 'Schiena', 'cable', ['pulley', 'seated cable row', 'rematore al cavo', 'low pulley']),
  E('row-machine', 'Rematore alla macchina', 'Schiena', 'machine', ['upper back machine', 'seated row machine', 'low row', 'rematore seduto alla macchina', 'row machine', 'upper back']),
  E('rematore-manubrio', 'Rematore con manubrio', 'Schiena', 'dumbbell', ['one arm dumbbell row', 'rematore a un braccio', 'dumbbell row'], DB),
  E('rematore-bilanciere', 'Rematore con bilanciere', 'Schiena', 'barbell', ['barbell row', 'bent over row', 'rematore bilanciere']),
  E('hyperextension', 'Iperestensioni', 'Lombari', 'bodyweight', ['hyperextension', 'iperestensioni lombari', 'back extension', 'estensioni lombari']),
  // Spalle
  E('shoulder-press', 'Shoulder press', 'Spalle', 'machine', ['shoulder press machine', 'lento avanti alla macchina', 'distensioni spalle alla macchina']),
  E('lento-manubri', 'Lento con manubri', 'Spalle', 'dumbbell', ['dumbbell shoulder press', 'military press con manubri', 'lento avanti con manubri', 'shoulder press con manubri'], DB),
  E('lento-avanti', 'Lento avanti con bilanciere', 'Spalle', 'barbell', ['military press', 'overhead press', 'lento avanti']),
  E('alzate-laterali', 'Alzate laterali', 'Spalle', 'dumbbell', ['alzate laterali con manubri', 'lateral raise', 'alzate laterali manubri', 'lateral raises'], DB),
  E('alzate-frontali', 'Alzate frontali', 'Spalle', 'dumbbell', ['front raise', 'alzate frontali con manubri'], DB),
  E('reverse-fly', 'Reverse fly alla macchina', 'Spalle', 'machine', ['reverse pec deck', 'reverse fly', 'deltoide posteriore alla macchina', 'croci inverse']),
  E('face-pull', 'Face pull', 'Spalle', 'cable', ['face pull al cavo', 'facepull']),
  // Braccia
  E('curl-manubri', 'Curl con manubri', 'Bicipiti', 'dumbbell', ['dumbbell curl', 'curl bicipiti con manubri', 'curl alternato', 'curl manubri'], DB),
  E('curl-bilanciere', 'Curl con bilanciere', 'Bicipiti', 'barbell', ['barbell curl', 'curl bilanciere']),
  E('hammer-curl', 'Curl a martello', 'Bicipiti', 'dumbbell', ['hammer curl', 'curl hammer', 'curl a martello con manubri'], DB),
  E('curl-cavo', 'Curl al cavo', 'Bicipiti', 'cable', ['cable curl', 'curl ai cavi']),
  E('triceps-pushdown', 'Pushdown ai cavi', 'Tricipiti', 'cable', ['triceps pushdown', 'triceps push down', 'triceps push down al cavo con barra', 'push down tricipiti', 'spinte in basso al cavo', 'pushdown']),
  E('french-press', 'French press', 'Tricipiti', 'barbell', ['skull crusher', 'estensioni tricipiti su panca', 'french press bilanciere']),
  E('dip', 'Dip alle parallele', 'Tricipiti', 'bodyweight', ['dips', 'dip', 'parallele']),
  // Addome
  E('plank', 'Plank', 'Addome', 'bodyweight', ['plank frontale', 'tenuta addominale'], { type: 'time' }),
  E('crunch', 'Crunch', 'Addome', 'bodyweight', ['crunch addominali', 'sit up', 'addominali']),
  E('leg-raise', 'Sollevamento gambe', 'Addome', 'bodyweight', ['leg raise', 'alzate gambe', 'sollevamento gambe a terra']),
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
