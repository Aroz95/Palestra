// Dati iniziali: nessuna scheda e nessuna seduta. La scheda Total Body è solo un esempio caricabile a richiesta.
// type: 'reps' → il campo reps sono ripetizioni; 'time' → il campo reps sono secondi.
// perHand: il carico è per mano (manubri), nel volume viene contato ×2.
// step: incremento del carico con i pulsanti +/−.
// rest: secondi di recupero dopo ogni serie.

export const SCHEMA_VERSION = 2
export const DEFAULT_REST = 60

export const EXAMPLE_TEMPLATE = {
  name: 'Total Body',
  bodyWeight: 75,
  goal: 'Ripresa graduale dell’allenamento dopo circa 2 anni di pausa.',
  warmup: [
    { id: 'wu1', name: 'Tapis roulant', minutes: 7.5, speed: 5.5, note: '' },
    { id: 'wu2', name: 'Tapis roulant', minutes: 7.5, speed: 6.5, note: '' },
  ],
  exercises: [
    { id: 'leg-press', name: 'Leg Press', group: 'Gambe / glutei', type: 'reps', perHand: false, step: 5, sets: 3, reps: 12, weight: 60, rest: DEFAULT_REST },
    { id: 'leg-extension', name: 'Leg Extension', group: 'Quadricipiti', type: 'reps', perHand: false, step: 2.5, sets: 3, reps: 12, weight: 20, rest: DEFAULT_REST },
    { id: 'leg-curl', name: 'Leg Curl', group: 'Femorali', type: 'reps', perHand: false, step: 2.5, sets: 3, reps: 12, weight: 20, rest: DEFAULT_REST },
    { id: 'incline-chest-press', name: 'Incline Chest Press', group: 'Pettorali / tricipiti', type: 'reps', perHand: false, step: 2.5, sets: 3, reps: 12, weight: 20, rest: DEFAULT_REST },
    { id: 'pec-deck', name: 'Pectoral Machine (Pec Deck)', group: 'Pettorali', type: 'reps', perHand: false, step: 2.5, sets: 3, reps: 10, weight: 15, rest: DEFAULT_REST },
    { id: 'upper-back', name: 'Upper Back Machine', group: 'Schiena', type: 'reps', perHand: false, step: 2.5, sets: 3, reps: 10, weight: 20, rest: DEFAULT_REST },
    { id: 'alzate-laterali', name: 'Alzate laterali con manubri', group: 'Spalle', type: 'reps', perHand: true, step: 1, sets: 3, reps: 10, weight: 6, rest: DEFAULT_REST },
    { id: 'curl-manubri', name: 'Curl con manubri', group: 'Bicipiti', type: 'reps', perHand: true, step: 1, sets: 3, reps: 12, weight: 6, rest: DEFAULT_REST },
    { id: 'triceps-pushdown', name: 'Triceps Push Down al cavo con barra', group: 'Tricipiti', type: 'reps', perHand: false, step: 2.5, sets: 3, reps: 12, weight: 10, rest: DEFAULT_REST },
    { id: 'pulldown', name: 'Technogym Pulldown Machine', group: 'Dorsali', type: 'reps', perHand: false, step: 2.5, sets: 3, reps: 12, weight: 20, rest: DEFAULT_REST },
    { id: 'plank', name: 'Plank', group: 'Core', type: 'time', perHand: false, step: 0, sets: 3, reps: 30, weight: 0, rest: DEFAULT_REST },
  ],
  cooldown: [
    { id: 'cd1', name: 'Tapis roulant', minutes: 6, speed: 5.5, note: '' },
    { id: 'cd2', name: 'Tapis roulant', minutes: 4, speed: 3.75, note: 'Prima 4, poi 3,5 km/h (durate esatte non rilevate)' },
  ],
}

export const EMPTY_TEMPLATE = {
  name: 'La mia scheda',
  bodyWeight: null,
  goal: '',
  warmup: [],
  exercises: [],
  cooldown: [],
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

function makeSets(ex, count, done) {
  return Array.from({ length: count }, () => ({ reps: ex.reps, weight: ex.weight, done }))
}

function exerciseFromTemplate(ex, count, done = false) {
  return {
    id: uid(),
    templateId: ex.id,
    name: ex.name,
    group: ex.group,
    type: ex.type,
    perHand: ex.perHand,
    step: ex.step,
    rest: ex.rest ?? DEFAULT_REST,
    notes: '',
    sets: makeSets(ex, count ?? ex.sets, done),
  }
}

function cardioFromTemplate(list, done = false) {
  return list.map((c) => ({ ...c, id: uid(), done }))
}

export function createInitialState() {
  return {
    version: SCHEMA_VERSION,
    template: structuredClone(EMPTY_TEMPLATE),
    sessions: [],
    activeSessionId: null,
    settings: { restSeconds: DEFAULT_REST, autoRest: true, sound: true },
  }
}

// Crea una nuova seduta dalla scheda; se useLast, riprende serie/carichi dall'ultima seduta che contiene l'esercizio.
export function createSessionFromTemplate(template, sessions, { date, useLast = true } = {}) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  const exercises = template.exercises.map((ex) => {
    const base = exerciseFromTemplate(ex)
    if (!useLast) return base
    for (const s of sorted) {
      const prev = s.exercises.find((e) => e.templateId === ex.id)
      if (prev && prev.sets.length) {
        base.sets = prev.sets.map((st) => ({ reps: st.reps, weight: st.weight, done: false }))
        break
      }
    }
    return base
  })
  return {
    id: uid(),
    date: date ?? todayISO(),
    title: template.name,
    note: '',
    durationMin: null,
    warmup: cardioFromTemplate(template.warmup),
    exercises,
    cooldown: cardioFromTemplate(template.cooldown),
  }
}

export function newExerciseFromTemplate(ex) {
  return exerciseFromTemplate(ex)
}

export function todayISO() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

// Aggiorna i dati salvati con versioni precedenti dell'app.
export function migrate(state) {
  if (!state || (state.version ?? 1) >= SCHEMA_VERSION) return state
  const withRest = (ex) => ({ ...ex, rest: ex.rest ?? DEFAULT_REST })
  return {
    ...state,
    version: SCHEMA_VERSION,
    // v2: recupero di 1 minuto per ogni serie
    settings: { ...state.settings, restSeconds: DEFAULT_REST },
    template: { ...state.template, exercises: state.template.exercises.map(withRest) },
    sessions: state.sessions.map((s) => ({ ...s, exercises: s.exercises.map(withRest) })),
  }
}
