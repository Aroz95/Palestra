// Validazione + normalizzazione delle entità v3. Ogni funzione restituisce l'oggetto normalizzato
// e registra errori/avvisi nel Validator con il percorso del campo.
import { DEFAULT_REST, EQUIPMENT, DISTANCE_SOURCES, MEAL_CATEGORIES, SESSION_STATUS, ACTIVITY_KINDS } from '../../schema/constants'
import { uid } from '../../schema/factories'
import { parseBlock, blocksTotal } from '../swim'
import { combineDateTime, isValidDate } from '../dates'

const slug = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

const pick = (raw, ...keys) => keys.map((k) => raw?.[k]).find((x) => x !== undefined)

// ---- Programmi e schede ----

export function normCardio(v, raw, p, { withDone = false, fallbackId } = {}) {
  if (!v.obj(raw, p, { nullable: false })) return null
  const c = {
    id: v.id(raw.id, `${p}.id`) ?? fallbackId ?? uid('cardio'),
    name: v.str(raw.name, `${p}.name`, { def: 'Tapis roulant' }) || 'Tapis roulant',
    minutes: v.num(raw.minutes, `${p}.minutes`, { max: 600 }),
    speed: v.num(pick(raw, 'speed', 'speedKmh'), `${p}.speed`, { max: 40 }),
    note: v.str(raw.note, `${p}.note`),
  }
  if (withDone) c.done = v.bool(raw.done, `${p}.done`)
  return c
}

export function normTemplateExercise(v, raw, p) {
  if (!v.obj(raw, p, { nullable: false })) return null
  const name = v.str(raw.name, `${p}.name`, { nullable: false, max: 200 })
  const type = v.oneOf(raw.type, `${p}.type`, ['reps', 'time'], 'reps')
  const perHand = v.bool(raw.perHand, `${p}.perHand`)
  const isTime = type === 'time'
  const reps = v.num(raw.reps, `${p}.reps`, { int: true, max: 1000 })
  let repMin = isTime ? null : v.num(raw.repMin, `${p}.repMin`, { int: true, max: 1000, def: reps })
  let repMax = isTime ? null : v.num(raw.repMax, `${p}.repMax`, { int: true, max: 1000, def: reps ?? repMin })
  if (repMin == null && repMax != null) repMin = repMax
  if (repMin != null && repMax != null && repMin > repMax) v.err(`${p}.repMin`, `repMin (${repMin}) maggiore di repMax (${repMax})`)
  if (!isTime && repMin == null) v.warn(`${p}`, `"${name}": ripetizioni obiettivo non indicate`)
  return {
    id: v.id(raw.id, `${p}.id`) ?? (slug(name) || uid('ex')),
    name,
    group: v.str(raw.group, `${p}.group`),
    type,
    equipment: v.oneOf(raw.equipment, `${p}.equipment`, Object.keys(EQUIPMENT), isTime ? 'bodyweight' : perHand ? 'dumbbell' : 'machine'),
    perHand,
    step: v.num(raw.step, `${p}.step`, { max: 50, def: isTime ? 0 : 2.5 }),
    sets: v.num(raw.sets, `${p}.sets`, { int: true, max: 20, def: 3 }),
    repMin,
    repMax,
    durationSec: isTime ? v.num(pick(raw, 'durationSec', 'seconds'), `${p}.durationSec`, { int: true, max: 3600, def: reps ?? 30 }) : null,
    suggestedWeightKg: isTime ? null : v.num(pick(raw, 'suggestedWeightKg', 'weightKg', 'weight'), `${p}.suggestedWeightKg`, { max: 1000 }),
    targetRir: v.num(raw.targetRir, `${p}.targetRir`, { max: 5 }),
    restSeconds: v.num(pick(raw, 'restSeconds', 'rest'), `${p}.restSeconds`, { int: true, max: 1800, def: DEFAULT_REST }),
    variant: v.str(raw.variant, `${p}.variant`),
    instructions: v.str(raw.instructions, `${p}.instructions`),
    notes: v.str(pick(raw, 'notes', 'note'), `${p}.notes`),
  }
}

export function normTemplate(v, raw, p, programId) {
  if (!v.obj(raw, p, { nullable: false })) return null
  const name = v.str(raw.name, `${p}.name`, { nullable: false, max: 200 })
  const exercises = v.arr(raw.exercises, `${p}.exercises`).map((e, i) => normTemplateExercise(v, e, `${p}.exercises[${i}]`)).filter(Boolean)
  const ids = exercises.map((e) => e.id)
  ids.forEach((id, i) => ids.indexOf(id) !== i && v.err(`${p}.exercises[${i}].id`, `id esercizio duplicato "${id}"`))
  const warmup = v.arr(raw.warmup, `${p}.warmup`).map((c, i) => normCardio(v, c, `${p}.warmup[${i}]`, { fallbackId: `warmup-${i + 1}` })).filter(Boolean)
  const cooldown = v.arr(raw.cooldown, `${p}.cooldown`).map((c, i) => normCardio(v, c, `${p}.cooldown[${i}]`, { fallbackId: `cooldown-${i + 1}` })).filter(Boolean)
  if (!exercises.length) v.warn(p, `Scheda "${name}" incompleta: nessun esercizio`)
  return {
    id: v.id(raw.id, `${p}.id`) ?? (slug(name) || uid('tpl')),
    programId: programId ?? v.id(raw.programId, `${p}.programId`),
    label: v.str(raw.label, `${p}.label`, { max: 20 }),
    name,
    revision: v.num(raw.revision, `${p}.revision`, { int: true, min: 1, def: 1 }),
    revisionInUse: v.bool(raw.revisionInUse, `${p}.revisionInUse`),
    estimatedMinutes: v.num(raw.estimatedMinutes, `${p}.estimatedMinutes`, { max: 600 }),
    archived: v.bool(raw.archived, `${p}.archived`),
    notes: v.str(raw.notes, `${p}.notes`),
    warmup,
    exercises,
    cooldown,
    history: Array.isArray(raw.history) ? raw.history : [],
  }
}

export function normSwimPlan(v, raw, p) {
  if (!v.obj(raw, p)) return null
  const plannedBlocks = normBlocks(v, raw.plannedBlocks, `${p}.plannedBlocks`)
  return {
    title: v.str(raw.title, `${p}.title`),
    poolLengthM: v.num(raw.poolLengthM, `${p}.poolLengthM`, { min: 1, max: 100, def: 25 }),
    style: v.str(raw.style, `${p}.style`),
    goal: v.str(raw.goal, `${p}.goal`),
    estimatedMinutes: v.num(raw.estimatedMinutes, `${p}.estimatedMinutes`, { max: 600 }),
    plannedBlocks,
    plannedDistanceM: v.num(raw.plannedDistanceM, `${p}.plannedDistanceM`, { max: 100000, def: plannedBlocks.length ? blocksTotal(plannedBlocks) : null }),
  }
}

export function normProgram(v, raw, p) {
  if (!v.obj(raw, p, { nullable: false })) return null
  const id = v.id(raw.id, `${p}.id`) ?? (slug(raw.name) || uid('program'))
  const templates = v.arr(raw.workoutTemplates, `${p}.workoutTemplates`).map((t, i) => normTemplate(v, t, `${p}.workoutTemplates[${i}]`, id)).filter(Boolean)
  const tids = templates.map((t) => t.id)
  tids.forEach((tid, i) => tids.indexOf(tid) !== i && v.err(`${p}.workoutTemplates[${i}].id`, `id scheda duplicato "${tid}"`))
  const weeklySchedule = v.arr(raw.weeklySchedule, `${p}.weeklySchedule`).map((s, i) => {
    const sp = `${p}.weeklySchedule[${i}]`
    if (!v.obj(s, sp, { nullable: false })) return null
    const kind = v.oneOf(s.kind, `${sp}.kind`, Object.keys(ACTIVITY_KINDS), 'strength')
    const templateId = v.id(s.templateId, `${sp}.templateId`)
    if (kind === 'strength' && templateId && templates.length && !tids.includes(templateId)) v.err(`${sp}.templateId`, `la scheda "${templateId}" non esiste nel programma`)
    return {
      id: v.id(s.id, `${sp}.id`) ?? `slot-${i + 1}-${s.weekday}-${kind}`, // deterministico: reimportare lo stesso file dà lo stesso id
      weekday: v.num(s.weekday, `${sp}.weekday`, { int: true, min: 1, max: 7, nullable: false }),
      kind,
      templateId,
      label: v.str(s.label, `${sp}.label`),
      swimPlan: kind === 'swim' ? normSwimPlan(v, s.swimPlan, `${sp}.swimPlan`) : null,
    }
  }).filter(Boolean)
  return {
    program: {
      id,
      name: v.str(raw.name, `${p}.name`, { nullable: false, max: 200 }),
      description: v.str(raw.description, `${p}.description`),
      validFrom: v.date(raw.validFrom, `${p}.validFrom`),
      validTo: v.date(raw.validTo, `${p}.validTo`),
      durationWeeks: v.num(raw.durationWeeks, `${p}.durationWeeks`, { int: true, max: 520 }),
      status: v.oneOf(raw.status, `${p}.status`, ['active', 'archived', 'draft'], 'active'),
      isMain: v.bool(raw.isMain, `${p}.isMain`),
      weeklySchedule,
      notes: v.str(raw.notes, `${p}.notes`),
      createdAt: v.datetime(raw.createdAt, `${p}.createdAt`),
    },
    templates,
  }
}

// ---- Sedute ----

function normFeedback(v, raw, p) {
  const f = v.obj(raw, p) ?? {}
  return {
    fatigue: v.num(f.fatigue, `${p}.fatigue`, { min: 1, max: 10 }),
    energy: v.num(f.energy, `${p}.energy`, { min: 1, max: 5 }),
    technique: v.num(f.technique, `${p}.technique`, { min: 1, max: 5 }),
    pain: v.str(f.pain, `${p}.pain`),
    notes: v.str(f.notes, `${p}.notes`),
    nextDayRecovery: v.num(f.nextDayRecovery, `${p}.nextDayRecovery`, { min: 1, max: 5 }),
  }
}

function normRange(v, raw, p, max) {
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'number') return { min: v.num(raw, p, { max }), max: v.num(raw, p, { max }) }
  if (!v.obj(raw, p)) return null
  const min = v.num(raw.min, `${p}.min`, { max, nullable: false })
  const mx = v.num(raw.max, `${p}.max`, { max, def: min })
  if (min != null && mx != null && min > mx) v.err(p, `min (${min}) maggiore di max (${mx})`)
  return { min, max: mx }
}

function normEnergy(v, raw, p) {
  if (!v.obj(raw, p)) return null
  return {
    source: v.oneOf(raw.source, `${p}.source`, ['estimate', 'device', 'manual'], 'estimate'),
    method: v.str(raw.method, `${p}.method`),
    bodyWeightKg: v.num(raw.bodyWeightKg, `${p}.bodyWeightKg`, { max: 400 }),
    durationMin: v.num(raw.durationMin, `${p}.durationMin`, { max: 1440 }),
    activeKcal: normRange(v, raw.activeKcal, `${p}.activeKcal`, 20000),
    totalKcal: normRange(v, raw.totalKcal, `${p}.totalKcal`, 20000),
  }
}

function normPain(v, raw, p) {
  if (!v.obj(raw, p)) return null
  return { location: v.str(raw.location, `${p}.location`), intensity: v.num(raw.intensity, `${p}.intensity`, { max: 10 }) }
}

function normSet(v, raw, p, isTime) {
  if (!v.obj(raw, p, { nullable: false })) return null
  const t = v.obj(raw.target, `${p}.target`)
  if (isTime) {
    return {
      durationSec: v.num(pick(raw, 'durationSec', 'seconds'), `${p}.durationSec`, { max: 7200 }),
      done: v.bool(raw.done, `${p}.done`),
      target: t ? { durationSec: v.num(t.durationSec, `${p}.target.durationSec`, { max: 7200 }) } : null,
      rpe: v.num(raw.rpe, `${p}.rpe`, { min: 1, max: 10 }),
      pain: normPain(v, raw.pain, `${p}.pain`),
      note: v.str(raw.note, `${p}.note`),
      at: v.datetime(raw.at, `${p}.at`),
    }
  }
  const target = t
    ? {
        repMin: v.num(t.repMin, `${p}.target.repMin`, { int: true, max: 1000 }),
        repMax: v.num(t.repMax, `${p}.target.repMax`, { int: true, max: 1000 }),
        weightKg: v.num(t.weightKg, `${p}.target.weightKg`, { max: 1000 }),
        rir: v.num(t.rir, `${p}.target.rir`, { max: 5 }),
      }
    : null
  return {
    reps: v.num(raw.reps, `${p}.reps`, { int: true, max: 1000 }),
    weight: v.num(pick(raw, 'weight', 'weightKg'), `${p}.weight`, { max: 1000 }),
    done: v.bool(raw.done, `${p}.done`),
    target,
    rir: v.num(raw.rir, `${p}.rir`, { max: 5 }),
    rpe: v.num(raw.rpe, `${p}.rpe`, { min: 1, max: 10 }),
    pain: normPain(v, raw.pain, `${p}.pain`),
    note: v.str(raw.note, `${p}.note`),
    at: v.datetime(raw.at, `${p}.at`),
  }
}

function normSessionExercise(v, raw, p, fallbackId) {
  if (!v.obj(raw, p, { nullable: false })) return null
  const type = v.oneOf(raw.type, `${p}.type`, ['reps', 'time'], 'reps')
  const perHand = v.bool(raw.perHand, `${p}.perHand`)
  const t = v.obj(raw.target, `${p}.target`)
  return {
    id: v.id(raw.id, `${p}.id`) ?? fallbackId,
    exerciseId: v.id(raw.exerciseId, `${p}.exerciseId`),
    name: v.str(raw.name, `${p}.name`, { nullable: false, max: 200 }),
    group: v.str(raw.group, `${p}.group`),
    type,
    equipment: v.oneOf(raw.equipment, `${p}.equipment`, Object.keys(EQUIPMENT), type === 'time' ? 'bodyweight' : perHand ? 'dumbbell' : 'machine'),
    perHand,
    step: v.num(raw.step, `${p}.step`, { max: 50, def: 2.5 }),
    rest: v.num(raw.rest, `${p}.rest`, { int: true, max: 1800, def: DEFAULT_REST }),
    variant: v.str(raw.variant, `${p}.variant`),
    instructions: v.str(raw.instructions, `${p}.instructions`),
    notes: v.str(raw.notes, `${p}.notes`),
    target: t
      ? {
          sets: v.num(t.sets, `${p}.target.sets`, { int: true, max: 20 }),
          repMin: v.num(t.repMin, `${p}.target.repMin`, { int: true, max: 1000 }),
          repMax: v.num(t.repMax, `${p}.target.repMax`, { int: true, max: 1000 }),
          durationSec: v.num(t.durationSec, `${p}.target.durationSec`, { max: 7200 }),
          weightKg: v.num(t.weightKg, `${p}.target.weightKg`, { max: 1000 }),
          rir: v.num(t.rir, `${p}.target.rir`, { max: 5 }),
        }
      : null,
    sets: v.arr(raw.sets, `${p}.sets`).map((s, i) => normSet(v, s, `${p}.sets[${i}]`, type === 'time')).filter(Boolean),
  }
}

function sessionCommon(v, raw, p) {
  return {
    date: v.date(raw.date, `${p}.date`, { nullable: false }),
    title: v.str(raw.title, `${p}.title`),
    status: v.oneOf(raw.status, `${p}.status`, Object.keys(SESSION_STATUS), 'completed'),
    programId: v.id(raw.programId, `${p}.programId`),
    occurrenceKey: v.id(raw.occurrenceKey, `${p}.occurrenceKey`),
    startedAt: v.datetime(raw.startedAt, `${p}.startedAt`),
    endedAt: v.datetime(raw.endedAt, `${p}.endedAt`),
    durationMin: v.num(raw.durationMin, `${p}.durationMin`, { max: 1440 }),
    durationSource: v.oneOf(raw.durationSource, `${p}.durationSource`, ['computed', 'manual', 'stopwatch', 'legacy'], raw.durationMin != null ? 'manual' : null),
    durationReason: v.str(raw.durationReason, `${p}.durationReason`),
    note: v.str(raw.note, `${p}.note`),
    feedback: normFeedback(v, raw.feedback, `${p}.feedback`),
    energy: normEnergy(v, raw.energy, `${p}.energy`),
    createdAt: v.datetime(raw.createdAt, `${p}.createdAt`),
  }
}

export function normStrengthSession(v, raw, p) {
  if (!v.obj(raw, p, { nullable: false })) return null
  const s = {
    id: v.id(raw.id, `${p}.id`) ?? uid('session'),
    kind: 'strength',
    ...sessionCommon(v, raw, p),
    templateId: v.id(raw.templateId, `${p}.templateId`),
    templateRevision: v.num(raw.templateRevision, `${p}.templateRevision`, { int: true, min: 1 }),
    warmup: v.arr(raw.warmup, `${p}.warmup`).map((c, i) => normCardio(v, c, `${p}.warmup[${i}]`, { withDone: true, fallbackId: `warmup-${i + 1}` })).filter(Boolean),
    exercises: v.arr(raw.exercises, `${p}.exercises`).map((e, i) => normSessionExercise(v, e, `${p}.exercises[${i}]`, `sx-${i + 1}`)).filter(Boolean),
    cooldown: v.arr(raw.cooldown, `${p}.cooldown`).map((c, i) => normCardio(v, c, `${p}.cooldown[${i}]`, { withDone: true, fallbackId: `cooldown-${i + 1}` })).filter(Boolean),
  }
  if (raw.origin) s.origin = String(raw.origin)
  return s
}

function normBlocks(v, raw, p) {
  return v.arr(raw, p).map((b, i) => {
    const bp = `${p}[${i}]`
    if (typeof b === 'string') b = { text: b }
    if (!v.obj(b, bp, { nullable: false })) return null
    let segmentsM = v.arr(b.segmentsM, `${bp}.segmentsM`).map((s, j) => v.num(s, `${bp}.segmentsM[${j}]`, { min: 1, max: 10000 }))
    const text = v.str(b.text, `${bp}.text`, { def: null })
    if (!segmentsM.length && text) {
      try {
        segmentsM = parseBlock(text)
      } catch (e) {
        v.err(`${bp}.text`, `${e.message} in "${text}"`)
      }
    }
    if (!segmentsM.length) v.err(bp, 'blocco senza distanze (segmentsM o text)')
    return {
      id: v.id(b.id, `${bp}.id`) ?? `block-${i + 1}`,
      text: text || null,
      repeats: v.num(b.repeats, `${bp}.repeats`, { int: true, min: 1, max: 100, def: 1 }),
      segmentsM: segmentsM.filter((x) => x != null),
      restSec: v.num(b.restSec, `${bp}.restSec`, { max: 3600 }),
      note: v.str(b.note, `${bp}.note`),
    }
  }).filter(Boolean)
}

export function normSwimSession(v, raw, p) {
  if (!v.obj(raw, p, { nullable: false })) return null
  const plannedBlocks = normBlocks(v, raw.plannedBlocks, `${p}.plannedBlocks`)
  const fromBlocks = plannedBlocks.length ? blocksTotal(plannedBlocks) : null
  const plannedDistanceM = v.num(raw.plannedDistanceM, `${p}.plannedDistanceM`, { max: 100000, def: fromBlocks })
  if (plannedDistanceM != null && fromBlocks != null && plannedDistanceM !== fromBlocks) {
    v.warn(`${p}.plannedDistanceM`, `distanza prevista ${plannedDistanceM} m diversa dalla somma dei blocchi (${fromBlocks} m)`)
  }
  const actualDistanceM = v.num(raw.actualDistanceM, `${p}.actualDistanceM`, { max: 100000 })
  const estimatedDistanceM = normRange(v, raw.estimatedDistanceM, `${p}.estimatedDistanceM`, 100000)
  const defSource = actualDistanceM != null ? 'measured' : estimatedDistanceM ? 'estimated' : 'unknown'
  const distanceSource = v.oneOf(raw.distanceSource, `${p}.distanceSource`, Object.keys(DISTANCE_SOURCES), defSource)
  if (['measured', 'manually_counted'].includes(distanceSource) && actualDistanceM == null) {
    v.err(`${p}.actualDistanceM`, `distanceSource "${distanceSource}" richiede actualDistanceM`)
  }
  if (distanceSource === 'estimated' && !estimatedDistanceM) v.err(`${p}.estimatedDistanceM`, 'distanceSource "estimated" richiede estimatedDistanceM {min,max}')
  const tq = v.obj(raw.technique, `${p}.technique`) ?? {}
  const rating = (k) => v.num(tq[k], `${p}.technique.${k}`, { min: 1, max: 5 })
  return {
    id: v.id(raw.id, `${p}.id`) ?? uid('swim'),
    kind: 'swim',
    ...sessionCommon(v, raw, p),
    isFree: v.bool(raw.isFree, `${p}.isFree`, !plannedBlocks.length),
    poolLengthM: v.num(raw.poolLengthM, `${p}.poolLengthM`, { min: 1, max: 100, def: 25 }),
    style: v.str(raw.style, `${p}.style`),
    goal: v.str(raw.goal, `${p}.goal`),
    rpe: v.num(raw.rpe, `${p}.rpe`, { min: 1, max: 10 }),
    plannedBlocks,
    plannedDistanceM,
    actualDistanceM,
    estimatedDistanceM,
    distanceSource,
    isPartial: v.bool(raw.isPartial, `${p}.isPartial`),
    technique: { catch: rating('catch'), strokeQuality: rating('strokeQuality'), shoulderFatigue: rating('shoulderFatigue'), breathing: rating('breathing') },
    notes: v.str(pick(raw, 'notes', 'note'), `${p}.notes`),
  }
}

// ---- Misure, profilo, obiettivi ----

const MEASURE_KEYS = [
  ['weightKg', 400],
  ['waistCm', 300],
  ['abdomenCm', 300],
  ['hipsCm', 300],
  ['chestCm', 300],
  ['armCm', 150],
]

export function normMeasurement(v, raw, p, { defaultSource = 'imported' } = {}) {
  if (!v.obj(raw, p, { nullable: false })) return null
  // Istante da "at" oppure da "date" (+ "time"): l'errore viene indicato sul campo presente nel file
  let at
  if (raw.at === undefined && raw.date !== undefined) {
    const d = v.date(raw.date, `${p}.date`, { nullable: false })
    const t = raw.time !== undefined ? v.time(raw.time, `${p}.time`) : '00:00'
    at = d ? combineDateTime(d, t ?? '00:00') : null
  } else {
    at = v.datetime(isValidDate(raw.at) ? combineDateTime(raw.at, '00:00') : raw.at, `${p}.at`, { nullable: false })
  }
  const m = {
    id: v.id(raw.id, `${p}.id`) ?? uid('measure'),
    at,
    notes: v.str(pick(raw, 'notes', 'note'), `${p}.notes`),
    source: v.oneOf(raw.source, `${p}.source`, ['manual', 'imported', 'device'], defaultSource),
  }
  for (const [k, max] of MEASURE_KEYS) m[k] = v.num(raw[k], `${p}.${k}`, { min: 0.1, max })
  if (MEASURE_KEYS.every(([k]) => m[k] == null)) v.err(p, 'nessun valore di misura presente')
  return m
}

export function normProfile(v, raw, p) {
  const r = v.obj(raw, p) ?? {}
  return {
    heightCm: v.num(r.heightCm, `${p}.heightCm`, { min: 50, max: 260 }),
    birthDate: v.date(r.birthDate, `${p}.birthDate`),
    age: v.num(r.age, `${p}.age`, { int: true, max: 120 }),
    sex: v.oneOf(r.sex, `${p}.sex`, ['male', 'female'], null),
    units: { weight: 'kg', length: 'cm', distance: 'm' },
    goal: v.str(r.goal, `${p}.goal`),
    referenceWeightKg: v.num(r.referenceWeightKg, `${p}.referenceWeightKg`, { max: 400 }),
    weeklyAvailability: v.str(r.weeklyAvailability, `${p}.weeklyAvailability`),
    strengthGoal: v.str(r.strengthGoal, `${p}.strengthGoal`),
    swimGoal: v.str(r.swimGoal, `${p}.swimGoal`),
    limitations: v.str(r.limitations, `${p}.limitations`),
    updatedAt: v.datetime(r.updatedAt, `${p}.updatedAt`),
  }
}

export function normGoal(v, raw, p) {
  if (!v.obj(raw, p, { nullable: false })) return null
  return {
    id: v.id(raw.id, `${p}.id`) ?? uid('goal'),
    label: v.str(raw.label, `${p}.label`, { nullable: false }),
    targetValue: v.num(raw.targetValue, `${p}.targetValue`, { min: -1e9, max: 1e9 }),
    unit: v.str(raw.unit, `${p}.unit`),
    targetDate: v.date(raw.targetDate, `${p}.targetDate`),
    status: v.oneOf(raw.status, `${p}.status`, ['active', 'achieved', 'paused', 'abandoned'], 'active'),
    notes: v.str(raw.notes, `${p}.notes`),
    history: Array.isArray(raw.history) ? raw.history : [],
  }
}

// ---- Alimentazione (schema v4: campi nuovi tutti facoltativi, i piani v3 restano validi) ----

export const NUTRIENT_KEYS = ['kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG']
const NUTRIENT_MAX = { kcal: 20000, proteinG: 2000, carbsG: 2000, fatG: 2000, fiberG: 500, waterMl: 20000 }
const NUTRIENT_ALIASES = { proteinG: ['proteinG', 'protein'], carbsG: ['carbsG', 'carbs'], fatG: ['fatG', 'fat'], fiberG: ['fiberG', 'fiber'] }
export const NUTRITION_SOURCES = ['label', 'table', 'manual', 'calculated', 'unknown']
export const QUANTITY_BASIS = ['raw', 'cooked', 'drained', 'packaged', 'unspecified']
const getN = (raw, k) => pick(raw, ...(NUTRIENT_ALIASES[k] ?? [k]))

// Avviso (non errore): kcal dichiarate molto diverse da 4·P + 4·C + 9·G (arrotondamenti, fibre, alcol)
function checkEnergy(v, n, p) {
  if ([n.kcal, n.proteinG, n.carbsG, n.fatG].some((x) => x == null)) return
  const fromMacros = 4 * n.proteinG + 4 * n.carbsG + 9 * n.fatG
  if (Math.abs(fromMacros - n.kcal) > Math.max(30, 0.15 * n.kcal)) {
    v.warn(p, `kcal dichiarate (${n.kcal}) lontane da quelle dei macro (${Math.round(fromMacros)}): verificare i valori`)
  }
}

export function normNutrition(v, raw, p) {
  if (!v.obj(raw, p)) return null
  const n = {}
  for (const k of NUTRIENT_KEYS) n[k] = v.num(getN(raw, k), `${p}.${k}`, { max: NUTRIENT_MAX[k] })
  n.source = v.oneOf(raw.source, `${p}.source`, NUTRITION_SOURCES, null)
  n.sourceNote = v.str(raw.sourceNote, `${p}.sourceNote`)
  checkEnergy(v, n, p)
  return n
}

function normNutritionGoal(v, raw, p) {
  if (!v.obj(raw, p)) return null
  const g = {}
  for (const k of [...NUTRIENT_KEYS, 'waterMl']) g[k] = v.num(getN(raw, k), `${p}.${k}`, { max: NUTRIENT_MAX[k] })
  checkEnergy(v, g, p)
  return g
}

function normTargets(v, raw, p) {
  if (!v.obj(raw, p)) return null
  let loss = null
  if (raw.weightLossKgPerWeek != null && v.obj(raw.weightLossKgPerWeek, `${p}.weightLossKgPerWeek`)) {
    const min = v.num(raw.weightLossKgPerWeek.min, `${p}.weightLossKgPerWeek.min`, { max: 2 })
    const max = v.num(raw.weightLossKgPerWeek.max, `${p}.weightLossKgPerWeek.max`, { max: 2, def: min })
    if (min != null && max != null && min > max) v.err(`${p}.weightLossKgPerWeek`, `min (${min}) maggiore di max (${max})`)
    loss = { min, max }
  }
  return {
    default: normNutritionGoal(v, raw.default, `${p}.default`),
    training: normNutritionGoal(v, raw.training, `${p}.training`),
    rest: normNutritionGoal(v, raw.rest, `${p}.rest`),
    weightLossKgPerWeek: loss,
  }
}

// Elenchi di testo: accetta anche una stringa singola (una voce per riga)
function normTextList(v, raw, p) {
  if (raw == null) return []
  if (typeof raw === 'string') return raw.split('\n').map((x) => x.trim()).filter(Boolean)
  return v.arr(raw, p).map((x, i) => v.str(x, `${p}[${i}]`, { max: 2000 })).filter((x) => x.trim())
}

function normGuidance(v, raw, p) {
  if (!v.obj(raw, p)) return null
  return {
    timing: v.str(raw.timing, `${p}.timing`, { max: 300 }),
    advice: normTextList(v, raw.advice, `${p}.advice`),
    mealCategories: v.arr(raw.mealCategories, `${p}.mealCategories`).map((c, i) => v.oneOf(c, `${p}.mealCategories[${i}]`, Object.keys(MEAL_CATEGORIES), null)).filter(Boolean),
  }
}

function normGuidelines(v, raw, p) {
  if (!v.obj(raw, p)) return null
  return {
    general: normTextList(v, raw.general, `${p}.general`),
    foodWeighing: normTextList(v, raw.foodWeighing, `${p}.foodWeighing`),
    hydration: normTextList(v, raw.hydration, `${p}.hydration`),
    preWorkout: normGuidance(v, raw.preWorkout, `${p}.preWorkout`),
    postWorkout: normGuidance(v, raw.postWorkout, `${p}.postWorkout`),
    notes: normTextList(v, raw.notes, `${p}.notes`),
  }
}

function normFood(v, raw, p) {
  if (typeof raw === 'string') raw = { name: raw }
  if (!v.obj(raw, p, { nullable: false })) return null
  return {
    id: v.id(raw.id, `${p}.id`),
    name: v.str(pick(raw, 'name', 'food'), `${p}.name`, { nullable: false, max: 300 }),
    quantity: v.num(pick(raw, 'quantity', 'qty'), `${p}.quantity`, { max: 100000 }),
    unit: v.str(raw.unit, `${p}.unit`, { max: 30 }),
    quantityBasis: v.oneOf(raw.quantityBasis, `${p}.quantityBasis`, QUANTITY_BASIS, null),
    notes: v.str(pick(raw, 'notes', 'note', 'preparation'), `${p}.notes`),
    nutrition: normNutrition(v, raw.nutrition, `${p}.nutrition`),
    alternatives: v.arr(raw.alternatives, `${p}.alternatives`).map((a, i) => normFood(v, a, `${p}.alternatives[${i}]`)).filter(Boolean),
  }
}

function normMeal(v, m, mp, fallbackId) {
  if (!v.obj(m, mp, { nullable: false })) return null
  const category = v.oneOf(m.category, `${mp}.category`, Object.keys(MEAL_CATEGORIES), 'other')
  const id = v.id(m.id, `${mp}.id`) ?? `${fallbackId}-${category}`
  const alternatives = v
    .arr(m.alternatives, `${mp}.alternatives`)
    .map((a, k) => {
      const ap = `${mp}.alternatives[${k}]`
      // Alternativa di pasto { label, items, nutrition } oppure singolo alimento alternativo
      const group = a && typeof a === 'object' && Array.isArray(a.items) ? a : { items: [a] }
      if (group === a && !v.obj(a, ap, { nullable: false })) return null
      return {
        id: (group === a ? v.id(a.id, `${ap}.id`) : null) ?? `${id}-alt-${k + 1}`,
        label: group === a ? v.str(a.label, `${ap}.label`) : '',
        items: group.items.map((it, z) => normFood(v, it, group === a ? `${ap}.items[${z}]` : ap)).filter(Boolean),
        nutrition: group === a ? normNutrition(v, a.nutrition, `${ap}.nutrition`) : null,
        notes: group === a ? v.str(pick(a, 'notes', 'note'), `${ap}.notes`) : '',
      }
    })
    .filter(Boolean)
  const aids = alternatives.map((a) => a.id)
  aids.forEach((x, k) => aids.indexOf(x) !== k && v.err(`${mp}.alternatives[${k}].id`, `id alternativa duplicato "${x}"`))
  return {
    id,
    category,
    label: v.str(m.label, `${mp}.label`) || MEAL_CATEGORIES[category],
    time: v.time(m.time, `${mp}.time`),
    items: v.arr(m.items, `${mp}.items`).map((it, k) => normFood(v, it, `${mp}.items[${k}]`)).filter(Boolean),
    alternatives,
    nutrition: normNutrition(v, m.nutrition, `${mp}.nutrition`),
    guidance: normTextList(v, m.guidance, `${mp}.guidance`),
    notes: v.str(pick(m, 'notes', 'note'), `${mp}.notes`),
  }
}

export function normDietPlan(v, raw, p) {
  if (!v.obj(raw, p, { nullable: false })) return null
  const days = v.arr(raw.days, `${p}.days`, { required: true }).map((d, i) => {
    const dp = `${p}.days[${i}]`
    if (!v.obj(d, dp, { nullable: false })) return null
    const weekday = v.num(d.weekday, `${dp}.weekday`, { int: true, min: 1, max: 7 })
    const date = v.date(d.date, `${dp}.date`)
    if (weekday == null && !date) v.err(dp, 'indicare weekday (1 = lunedì … 7 = domenica) oppure date')
    const meals = v.arr(d.meals, `${dp}.meals`).map((m, j) => normMeal(v, m, `${dp}.meals[${j}]`, `${weekday ?? date}-${j}`)).filter(Boolean)
    const mids = meals.map((m) => m.id)
    mids.forEach((id, j) => mids.indexOf(id) !== j && v.err(`${dp}.meals[${j}].id`, `id pasto duplicato "${id}"`))
    return {
      id: v.id(d.id, `${dp}.id`) ?? `day-${i + 1}`,
      weekday,
      date,
      dayType: v.oneOf(d.dayType, `${dp}.dayType`, ['any', 'training', 'rest'], 'any'),
      label: v.str(d.label, `${dp}.label`),
      nutritionTarget: normNutritionGoal(v, d.nutritionTarget, `${dp}.nutritionTarget`),
      meals,
    }
  }).filter(Boolean)
  let status = v.oneOf(raw.status, `${p}.status`, ['draft', 'validated'], 'draft')
  if (status === 'validated' && !String(raw.validatedBy ?? '').trim()) {
    v.warn(`${p}.status`, 'piano indicato come "validated" senza "validatedBy": importato come bozza')
    status = 'draft'
  }
  return {
    id: v.id(raw.id, `${p}.id`) ?? (slug(raw.name) || uid('diet')),
    name: v.str(raw.name, `${p}.name`, { nullable: false, max: 200 }),
    author: v.str(raw.author, `${p}.author`),
    status,
    validatedBy: v.str(raw.validatedBy, `${p}.validatedBy`),
    active: v.bool(raw.active, `${p}.active`),
    archived: v.bool(raw.archived, `${p}.archived`),
    validFrom: v.date(raw.validFrom, `${p}.validFrom`),
    validTo: v.date(raw.validTo, `${p}.validTo`),
    goal: v.str(raw.goal, `${p}.goal`),
    revision: v.num(raw.revision, `${p}.revision`, { int: true, min: 1, def: 1 }),
    notes: v.str(raw.notes, `${p}.notes`),
    nutritionTargets: normTargets(v, raw.nutritionTargets, `${p}.nutritionTargets`),
    guidelines: normGuidelines(v, raw.guidelines, `${p}.guidelines`),
    days,
    history: Array.isArray(raw.history) ? raw.history : [],
    createdAt: v.datetime(raw.createdAt, `${p}.createdAt`),
    updatedAt: v.datetime(raw.updatedAt, `${p}.updatedAt`),
  }
}

// ---- Diario alimentare e scelte delle alternative (contenuti nel backup) ----

export function normConsumption(v, raw, p) {
  if (!v.obj(raw, p)) return null
  return {
    source: v.oneOf(raw.source, `${p}.source`, ['manual', 'plan', 'device'], 'manual'),
    chosenAlternativeId: v.id(raw.chosenAlternativeId, `${p}.chosenAlternativeId`),
    items: v.arr(raw.items, `${p}.items`).map((it, i) => normFood(v, it, `${p}.items[${i}]`)).filter(Boolean),
    nutrition: normNutrition(v, raw.nutrition, `${p}.nutrition`),
  }
}

export function normDietLog(v, raw, p) {
  if (!v.obj(raw, p, { nullable: false })) return null
  return {
    id: v.id(raw.id, `${p}.id`) ?? uid('meallog'),
    date: v.date(raw.date, `${p}.date`, { nullable: false }),
    planId: v.id(raw.planId, `${p}.planId`),
    planRevision: v.num(raw.planRevision, `${p}.planRevision`, { int: true, min: 1 }),
    mealId: v.id(raw.mealId, `${p}.mealId`),
    label: v.str(raw.label, `${p}.label`),
    status: v.oneOf(raw.status, `${p}.status`, ['followed', 'modified', 'skipped', 'extra'], 'followed'),
    consumption: normConsumption(v, raw.consumption, `${p}.consumption`),
    note: v.str(pick(raw, 'note', 'notes'), `${p}.note`),
  }
}

export function normDietSelection(v, raw, p) {
  if (!v.obj(raw, p, { nullable: false })) return null
  return {
    id: v.id(raw.id, `${p}.id`) ?? uid('dietsel'),
    date: v.date(raw.date, `${p}.date`, { nullable: false }),
    planId: v.id(raw.planId, `${p}.planId`),
    planRevision: v.num(raw.planRevision, `${p}.planRevision`, { int: true, min: 1 }),
    mealId: v.id(raw.mealId, `${p}.mealId`),
    alternativeId: v.id(raw.alternativeId, `${p}.alternativeId`),
  }
}
