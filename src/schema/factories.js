import { DEFAULT_REST, SCHEMA_VERSION } from './constants'
import { todayISO, toLocalISO } from '../lib/dates'

export function uid(prefix = '') {
  const r = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  return prefix ? `${prefix}-${r}` : r
}

export const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

export function emptyProfile() {
  return {
    heightCm: null,
    birthDate: null,
    age: null,
    sex: null, // usato solo dalle formule che lo richiedono
    units: { weight: 'kg', length: 'cm', distance: 'm' },
    goal: '',
    referenceWeightKg: null,
    weeklyAvailability: '',
    strengthGoal: '',
    swimGoal: '',
    limitations: '',
    updatedAt: null,
  }
}

export function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: emptyProfile(),
    goals: [],
    measurements: [],
    programs: [],
    workoutTemplates: [],
    sessions: [],
    activeSessionId: null,
    calendar: { overrides: {}, extra: [] },
    dietPlans: [],
    dietLog: [],
    dietSelections: [], // alternative scelte per data: { date, planId, planRevision, mealId, alternativeId }
    settings: { restSeconds: DEFAULT_REST, autoRest: true, sound: true, reportExcludeNotes: true },
    meta: { createdAt: toLocalISO(), migratedFrom: null },
  }
}

// ---- Programmi e schede ----

export function newProgram(partial = {}) {
  return {
    id: uid('program'),
    name: 'Nuovo programma',
    description: '',
    validFrom: todayISO(),
    validTo: null,
    durationWeeks: null,
    status: 'active',
    isMain: false,
    weeklySchedule: [],
    notes: '',
    createdAt: toLocalISO(),
    ...partial,
  }
}

export function newTemplateExercise(partial = {}) {
  return {
    id: uid('ex'),
    name: 'Nuovo esercizio',
    group: '',
    type: 'reps', // 'reps' | 'time'
    equipment: 'machine',
    perHand: false,
    step: 2.5,
    sets: 3,
    repMin: 10,
    repMax: 12,
    durationSec: null,
    suggestedWeightKg: null,
    targetRir: null,
    restSeconds: DEFAULT_REST,
    variant: '',
    instructions: '',
    notes: '',
    ...partial,
  }
}

export function newCardio(partial = {}) {
  return { id: uid('cardio'), name: 'Tapis roulant', minutes: 5, speed: 5.5, note: '', ...partial }
}

export function newTemplate(partial = {}) {
  return {
    id: uid('tpl'),
    programId: null,
    label: 'A',
    name: 'Nuova scheda',
    revision: 1,
    revisionInUse: false,
    estimatedMinutes: null,
    archived: false,
    notes: '',
    warmup: [],
    exercises: [],
    cooldown: [],
    history: [],
    ...partial,
  }
}

// Una modifica a una scheda già usata da una seduta crea una nuova revisione;
// la versione precedente resta nello storico della scheda e nelle sedute svolte.
export function reviseTemplate(prev, next) {
  if (!prev.revisionInUse) return next
  const { history, ...snapshot } = prev
  return {
    ...next,
    revision: prev.revision + 1,
    revisionInUse: false,
    history: [...(prev.history ?? []), { revision: prev.revision, savedAt: toLocalISO(), snapshot: clone(snapshot) }],
  }
}

// ---- Sedute ----

export function emptyFeedback() {
  return { fatigue: null, energy: null, technique: null, pain: '', notes: '', nextDayRecovery: null }
}

function baseSession(kind, partial) {
  return {
    id: uid(kind === 'swim' ? 'swim' : 'session'),
    kind,
    date: todayISO(),
    title: '',
    status: 'planned',
    programId: null,
    occurrenceKey: null,
    startedAt: null,
    endedAt: null,
    durationMin: null,
    durationSource: null, // 'computed' | 'manual' | 'stopwatch' | 'legacy'
    durationReason: '',
    note: '',
    feedback: emptyFeedback(),
    energy: null,
    createdAt: toLocalISO(),
    ...partial,
  }
}

// Ultima esecuzione completata di un esercizio (stessa identità = stessa macchina/movimento)
export function lastPerformance(sessions, exerciseId, { excludeSessionId, beforeDate } = {}) {
  if (!exerciseId) return null
  const sorted = sessions
    .filter((s) => s.kind === 'strength' && s.id !== excludeSessionId && (!beforeDate || s.date <= beforeDate))
    .sort((a, b) => (b.date + (b.startedAt ?? '')).localeCompare(a.date + (a.startedAt ?? '')))
  for (const s of sorted) {
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId)
    if (ex && ex.sets.some((st) => st.done)) return { date: s.date, sessionId: s.id, exercise: ex }
  }
  return null
}

export function sessionExerciseFromTemplate(tex, last) {
  const isTime = tex.type === 'time'
  const lastDone = last?.exercise.sets.filter((s) => s.done) ?? []
  const target = {
    sets: tex.sets,
    repMin: isTime ? null : tex.repMin,
    repMax: isTime ? null : tex.repMax,
    durationSec: isTime ? tex.durationSec : null,
    weightKg: tex.suggestedWeightKg ?? null,
    rir: tex.targetRir ?? null,
  }
  const sets = Array.from({ length: Math.max(0, tex.sets) }, (_, i) => {
    if (isTime) {
      return { durationSec: tex.durationSec ?? 30, done: false, target: { durationSec: tex.durationSec ?? null }, rpe: null, pain: null, note: '', at: null }
    }
    // Carico proposto: quello effettivo dell'ultima volta (stessa serie), altrimenti quello suggerito dalla scheda
    const prevWeight = (lastDone[i] ?? lastDone[lastDone.length - 1])?.weight
    const weight = prevWeight ?? tex.suggestedWeightKg ?? (tex.equipment === 'bodyweight' ? 0 : null)
    return {
      reps: tex.repMax ?? tex.repMin ?? null,
      weight,
      done: false,
      target: { repMin: tex.repMin ?? null, repMax: tex.repMax ?? null, weightKg: tex.suggestedWeightKg ?? null, rir: tex.targetRir ?? null },
      rir: null,
      rpe: null,
      pain: null,
      note: '',
      at: null,
    }
  })
  return {
    id: uid('sx'),
    exerciseId: tex.id,
    name: tex.name,
    group: tex.group,
    type: tex.type,
    equipment: tex.equipment,
    perHand: !!tex.perHand,
    step: tex.step,
    rest: tex.restSeconds ?? DEFAULT_REST,
    variant: tex.variant ?? '',
    instructions: tex.instructions ?? '',
    notes: '',
    target,
    sets,
  }
}

export function createStrengthSession(template, sessions, { date = todayISO(), occurrenceKey = null, programId = null } = {}) {
  const tpl = template ?? newTemplate({ name: 'Seduta libera', label: '' })
  return baseSession('strength', {
    date,
    title: template ? `${template.label ? `${template.label} · ` : ''}${template.name}` : 'Seduta libera',
    templateId: template?.id ?? null,
    templateRevision: template?.revision ?? null,
    programId: programId ?? template?.programId ?? null,
    occurrenceKey,
    warmup: tpl.warmup.map((c) => ({ ...clone(c), id: uid('cardio'), done: false })),
    exercises: tpl.exercises.map((tex) => sessionExerciseFromTemplate(tex, lastPerformance(sessions, tex.id, { beforeDate: date }))),
    cooldown: tpl.cooldown.map((c) => ({ ...clone(c), id: uid('cardio'), done: false })),
  })
}

export function newSessionExercise(partial = {}) {
  return sessionExerciseFromTemplate(newTemplateExercise({ sets: 1, ...partial }), null)
}

export function createSwimSession({ date = todayISO(), occurrenceKey = null, programId = null, plan = null } = {}) {
  return baseSession('swim', {
    date,
    title: plan?.title || 'Nuoto',
    occurrenceKey,
    programId,
    isFree: !plan,
    poolLengthM: plan?.poolLengthM ?? 25,
    style: plan?.style ?? 'Stile libero',
    goal: plan?.goal ?? '',
    rpe: null,
    plannedBlocks: clone(plan?.plannedBlocks ?? []),
    plannedDistanceM: plan?.plannedDistanceM ?? null,
    actualDistanceM: null,
    estimatedDistanceM: null,
    distanceSource: 'unknown',
    isPartial: false,
    technique: { catch: null, strokeQuality: null, shoulderFatigue: null, breathing: null },
    notes: '',
  })
}

// ---- Misure, obiettivi, dieta ----

export function newMeasurement(partial = {}) {
  return {
    id: uid('measure'),
    at: toLocalISO(),
    weightKg: null,
    waistCm: null,
    abdomenCm: null,
    hipsCm: null,
    chestCm: null,
    armCm: null,
    notes: '',
    source: 'manual',
    ...partial,
  }
}

export function newGoal(partial = {}) {
  return { id: uid('goal'), label: '', targetValue: null, unit: '', targetDate: null, status: 'active', notes: '', history: [], ...partial }
}

export function newDietPlan(partial = {}) {
  return {
    id: uid('diet'),
    name: 'Nuovo piano',
    author: '',
    status: 'draft', // 'draft' | 'validated'
    validatedBy: '',
    active: false,
    archived: false,
    validFrom: null,
    validTo: null,
    goal: '',
    revision: 1,
    notes: '',
    nutritionTargets: null, // { default, training, rest, weightLossKgPerWeek }: obiettivi, non consumi
    guidelines: null, // { general, foodWeighing, hydration, preWorkout, postWorkout, notes }
    days: [],
    history: [],
    createdAt: toLocalISO(),
    updatedAt: toLocalISO(),
    ...partial,
  }
}
