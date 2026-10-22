import { DEFAULT_REST, SCHEMA_VERSION } from './constants'
import { emptyState, emptyProfile, uid, clone } from './factories'
import { toLocalISO, todayISO, combineDateTime } from '../lib/dates'

// ---- Conversione degli oggetti legacy (schema v1/v2) ----

// Nella v2 un carico 0 su un esercizio a ripetizioni indicava il corpo libero
const legacyEquipment = (isTime, perHand, weights) =>
  isTime ? 'bodyweight' : perHand ? 'dumbbell' : weights.length && weights.every((w) => w === 0) ? 'bodyweight' : 'machine'

export function migrateLegacyTemplateExercise(ex) {
  const isTime = ex.type === 'time'
  return {
    id: ex.id ?? uid('ex'),
    name: ex.name ?? 'Esercizio',
    group: ex.group ?? '',
    type: isTime ? 'time' : 'reps',
    equipment: legacyEquipment(isTime, ex.perHand, [ex.weight ?? null]),
    perHand: !!ex.perHand,
    step: ex.step || (isTime ? 0 : 2.5),
    sets: ex.sets ?? 3,
    repMin: isTime ? null : (ex.reps ?? null),
    repMax: isTime ? null : (ex.reps ?? null),
    durationSec: isTime ? (ex.reps ?? 30) : null,
    suggestedWeightKg: isTime ? null : (ex.weight ?? null),
    targetRir: null,
    restSeconds: ex.rest ?? DEFAULT_REST,
    variant: '',
    instructions: '',
    notes: ex.note ?? '',
  }
}

function legacyCardio(list = [], keepDone = true) {
  return list.map((c) => ({
    id: c.id ?? uid('cardio'),
    name: c.name ?? 'Tapis roulant',
    minutes: c.minutes ?? null,
    speed: c.speed ?? null,
    note: c.note ?? '',
    ...(keepDone ? { done: !!c.done } : {}),
  }))
}

// Seduta v1/v2 → seduta strength v3. I valori registrati restano quelli effettivi;
// il target viene ricavato dagli stessi valori (nel vecchio modello coincidevano).
export function migrateLegacySession(s, { templateId = null, templateExerciseIds = [], activeSessionId = null } = {}) {
  const exercises = (s.exercises ?? []).map((ex) => {
    const isTime = ex.type === 'time'
    const sets = (ex.sets ?? []).map((st) =>
      isTime
        ? { durationSec: st.reps ?? null, done: !!st.done, target: { durationSec: st.reps ?? null }, rpe: null, pain: null, note: '', at: null }
        : {
            reps: st.reps ?? null,
            weight: st.weight ?? null,
            done: !!st.done,
            target: { repMin: st.reps ?? null, repMax: st.reps ?? null, weightKg: st.weight ?? null, rir: null },
            rir: null,
            rpe: null,
            pain: null,
            note: '',
            at: null,
          },
    )
    return {
      id: ex.id ?? uid('sx'),
      exerciseId: ex.templateId ?? null,
      name: ex.name ?? 'Esercizio',
      group: ex.group ?? '',
      type: isTime ? 'time' : 'reps',
      equipment: legacyEquipment(isTime, ex.perHand, (ex.sets ?? []).map((st) => st.weight ?? null)),
      perHand: !!ex.perHand,
      step: ex.step || (isTime ? 0 : 2.5),
      rest: ex.rest ?? DEFAULT_REST,
      variant: '',
      instructions: '',
      notes: ex.notes ?? '',
      target: null,
      sets,
    }
  })
  const warmup = legacyCardio(s.warmup)
  const cooldown = legacyCardio(s.cooldown)
  const all = [...exercises.flatMap((e) => e.sets), ...warmup, ...cooldown]
  const anyDone = all.some((x) => x.done)
  const allDone = all.length > 0 && all.every((x) => x.done)
  const status = allDone ? 'completed' : s.id === activeSessionId ? 'in_progress' : anyDone ? 'completed' : 'planned'
  const linked = templateId && exercises.some((e) => templateExerciseIds.includes(e.exerciseId))

  return {
    id: s.id ?? uid('session'),
    kind: 'strength',
    date: s.date ?? todayISO(),
    title: s.title ?? '',
    status,
    templateId: linked ? templateId : null,
    templateRevision: null, // non nota per le sedute legacy
    programId: null,
    occurrenceKey: null,
    startedAt: null, // non inventiamo orari che non sono stati registrati
    endedAt: null,
    durationMin: s.durationMin ?? null,
    durationSource: s.durationMin ? 'legacy' : null,
    durationReason: '',
    note: s.note ?? '',
    feedback: { fatigue: null, energy: null, technique: null, pain: '', notes: '', nextDayRecovery: null },
    energy: null,
    createdAt: null,
    origin: 'legacy-v2',
    warmup,
    exercises,
    cooldown,
  }
}

export function isLegacyBackup(data) {
  return !!data && typeof data === 'object' && !data.type && !data.schemaVersion && Array.isArray(data.sessions) && !!data.template
}

// Backup / stato v1-v2 → stato v3
export function migrateLegacyState(data) {
  const version = data.version ?? 1
  const state = emptyState()
  const tpl = data.template ?? {}
  const hasTemplate = (tpl.exercises?.length ?? 0) + (tpl.warmup?.length ?? 0) + (tpl.cooldown?.length ?? 0) > 0
  const sessionsIn = data.sessions ?? []
  const firstDate = sessionsIn.map((s) => s.date).filter(Boolean).sort()[0] ?? todayISO()

  let templateId = null
  let templateExerciseIds = []
  if (hasTemplate) {
    const program = {
      id: 'program-principale',
      name: 'Programma principale',
      description: 'Creato automaticamente dalla scheda della versione precedente',
      validFrom: firstDate,
      validTo: null,
      durationWeeks: null,
      status: 'active',
      isMain: true,
      weeklySchedule: [],
      notes: '',
      createdAt: toLocalISO(),
    }
    const exercises = (tpl.exercises ?? []).map(migrateLegacyTemplateExercise)
    templateId = 'scheda-a'
    templateExerciseIds = exercises.map((e) => e.id)
    state.programs.push(program)
    state.workoutTemplates.push({
      id: templateId,
      programId: program.id,
      label: 'A',
      name: tpl.name || 'Scheda A',
      revision: 1,
      revisionInUse: sessionsIn.length > 0,
      estimatedMinutes: null,
      archived: false,
      notes: '',
      warmup: legacyCardio(tpl.warmup, false),
      exercises,
      cooldown: legacyCardio(tpl.cooldown, false),
      history: [],
    })
  }

  state.profile = { ...emptyProfile(), goal: tpl.goal ?? '' }
  // Il peso corporeo indicato nella vecchia scheda diventa una misura importata, datata alla prima seduta
  if (typeof tpl.bodyWeight === 'number' && tpl.bodyWeight > 0) {
    state.measurements.push({
      id: 'measure-legacy',
      at: combineDateTime(firstDate, '00:00'),
      weightKg: tpl.bodyWeight,
      waistCm: null,
      abdomenCm: null,
      hipsCm: null,
      chestCm: null,
      armCm: null,
      notes: 'Peso corporeo di riferimento della scheda precedente',
      source: 'imported',
    })
  }

  state.sessions = sessionsIn.map((s) =>
    migrateLegacySession(s, { templateId, templateExerciseIds, activeSessionId: data.activeSessionId }),
  )
  state.activeSessionId = state.sessions.some((s) => s.id === data.activeSessionId) ? data.activeSessionId : null
  state.settings = {
    ...state.settings,
    restSeconds: data.settings?.restSeconds ?? DEFAULT_REST,
    autoRest: data.settings?.autoRest ?? true,
    sound: data.settings?.sound ?? true,
  }
  state.meta = { createdAt: toLocalISO(), migratedFrom: `v${version}`, migratedAt: toLocalISO() }
  return state
}

// Completa uno stato v3 con eventuali chiavi mancanti (file scritti a mano, versioni future compatibili)
export function normalizeState(s) {
  const base = emptyState()
  return {
    ...base,
    ...s,
    schemaVersion: SCHEMA_VERSION,
    profile: { ...base.profile, ...(s.profile ?? {}) },
    calendar: { overrides: { ...(s.calendar?.overrides ?? {}) }, extra: [...(s.calendar?.extra ?? [])] },
    settings: { ...base.settings, ...(s.settings ?? {}) },
    meta: { ...base.meta, ...(s.meta ?? {}) },
  }
}

// Punto di ingresso unico: qualunque versione → v3
export function migrateToV3(data) {
  if (!data || typeof data !== 'object') return emptyState()
  if ((data.schemaVersion ?? 0) >= 3) return normalizeState(clone(data))
  if (isLegacyBackup(data)) return migrateLegacyState(clone(data))
  return emptyState()
}
