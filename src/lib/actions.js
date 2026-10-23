// Operazioni pure sullo stato: (state, ...args) → nuovo stato.
import { createStrengthSession, createSwimSession, reviseTemplate, uid, clone, newTemplate } from '../schema/factories'
import { todayISO, toLocalISO } from './dates'

const replaceById = (list, item) => list.map((x) => (x.id === item.id ? item : x))

export function upsertSession(state, session) {
  const exists = state.sessions.some((s) => s.id === session.id)
  return { ...state, sessions: exists ? replaceById(state.sessions, session) : [...state.sessions, session] }
}

export function deleteSession(state, id) {
  return { ...state, sessions: state.sessions.filter((s) => s.id !== id), activeSessionId: state.activeSessionId === id ? null : state.activeSessionId }
}

// Crea (senza salvarla) la seduta per un'attività: palestra da scheda A/B o libera, oppure nuoto.
export function buildSession(state, { occ = null, templateId = null, kind = 'strength', date = todayISO(), plan = null } = {}) {
  const opts = occ ? { date: occ.date, occurrenceKey: occ.key, programId: occ.programId } : { date }
  if ((occ?.kind ?? kind) === 'swim') return createSwimSession({ ...opts, plan: occ ? occ.swimPlan : plan })
  const template = state.workoutTemplates.find((t) => t.id === (occ ? occ.templateId : templateId)) ?? null
  return createStrengthSession(template, state.sessions, opts)
}

// Inserisce una seduta appena creata, la rende attiva e segna la revisione della scheda come usata
export function addStartedSession(state, session) {
  return {
    ...state,
    sessions: [...state.sessions, session],
    activeSessionId: session.id,
    workoutTemplates: session.templateId
      ? state.workoutTemplates.map((t) => (t.id === session.templateId ? { ...t, revisionInUse: true } : t))
      : state.workoutTemplates,
  }
}

export function setOccurrenceStatus(state, occ, status, movedTo = null) {
  const overrides = { ...state.calendar.overrides }
  let extra = state.calendar.extra
  if (status === null) delete overrides[occ.key]
  else overrides[occ.key] = { status, movedTo }
  if (status === 'postponed' && movedTo) {
    extra = [...extra, { id: uid('occ'), date: movedTo, kind: occ.kind, templateId: occ.templateId, label: occ.label, swimPlan: occ.swimPlan, programId: occ.programId, movedFrom: occ.date }]
  }
  return { ...state, calendar: { overrides, extra } }
}

// Alla prima attività registrata fissa l'orario di inizio. Non per le sedute migrate dalla versione
// precedente: il loro inizio reale non è noto e non va inventato (si può inserire a mano).
export function autoStart(session) {
  if (session.startedAt) return session
  const status = session.status === 'planned' ? 'in_progress' : session.status
  if (session.origin === 'legacy-v2') return { ...session, status }
  return { ...session, startedAt: toLocalISO(), status }
}

// ---- Programmi e schede ----

export function upsertProgram(state, program) {
  let programs = state.programs.some((p) => p.id === program.id) ? replaceById(state.programs, program) : [...state.programs, program]
  if (program.isMain) programs = programs.map((p) => ({ ...p, isMain: p.id === program.id }))
  return { ...state, programs }
}

export function setMainProgram(state, id) {
  return { ...state, programs: state.programs.map((p) => ({ ...p, isMain: p.id === id })) }
}

export function upsertTemplate(state, template) {
  const prev = state.workoutTemplates.find((t) => t.id === template.id)
  const next = prev ? reviseTemplate(prev, template) : template
  return { ...state, workoutTemplates: prev ? replaceById(state.workoutTemplates, next) : [...state.workoutTemplates, next] }
}

export function duplicateTemplate(state, id) {
  const t = state.workoutTemplates.find((x) => x.id === id)
  const copy = { ...clone(t), id: uid('tpl'), name: `${t.name} (copia)`, revision: 1, revisionInUse: false, history: [] }
  return { ...state, workoutTemplates: [...state.workoutTemplates, copy] }
}

export function addTemplate(state, programId, label) {
  const t = newTemplate({ programId, label, name: `Scheda ${label}` })
  return { state: { ...state, workoutTemplates: [...state.workoutTemplates, t] }, template: t }
}

export function moveTemplate(state, id, dir) {
  const list = [...state.workoutTemplates]
  const i = list.findIndex((t) => t.id === id)
  const programId = list[i].programId
  let j = i + dir
  while (j >= 0 && j < list.length && list[j].programId !== programId) j += dir
  if (j < 0 || j >= list.length) return state
  ;[list[i], list[j]] = [list[j], list[i]]
  return { ...state, workoutTemplates: list }
}

// ---- Misure, obiettivi, dieta ----

export function upsertIn(state, key, item) {
  const exists = state[key].some((x) => x.id === item.id)
  return { ...state, [key]: exists ? replaceById(state[key], item) : [...state[key], item] }
}

export function removeIn(state, key, id) {
  return { ...state, [key]: state[key].filter((x) => x.id !== id) }
}

export function setActiveDiet(state, id) {
  return { ...state, dietPlans: state.dietPlans.map((d) => ({ ...d, active: d.id === id })) }
}

// Diario: lo stato (seguito/modificato/saltato) e gli eventuali consumi registrati sono indipendenti dal piano;
// le modifiche successive del piano non riscrivono il diario. status null = registrazione rimossa.
export function logMeal(state, { date, planId, planRevision, mealId, status, note, consumption, label }) {
  const same = (l) => l.date === date && l.planId === planId && l.mealId === mealId
  const prev = state.dietLog.find(same)
  const rest = state.dietLog.filter((l) => !same(l))
  if (!status) return { ...state, dietLog: rest }
  const entry = {
    id: prev?.id ?? uid('meallog'),
    date,
    planId,
    planRevision: prev?.planRevision ?? planRevision,
    mealId,
    label: label ?? prev?.label ?? '',
    status,
    consumption: consumption !== undefined ? consumption : (prev?.consumption ?? null),
    note: note ?? prev?.note ?? '',
  }
  return { ...state, dietLog: [...rest, entry] }
}

// Aggiunta fuori piano (es. uno spuntino non previsto)
export function addExtraFood(state, { date, planId, planRevision, label, consumption, note = '' }) {
  return { ...state, dietLog: [...state.dietLog, { id: uid('meallog'), date, planId, planRevision, mealId: uid('extra'), label, status: 'extra', consumption, note }] }
}

export function removeLog(state, id) {
  return { ...state, dietLog: state.dietLog.filter((l) => l.id !== id) }
}

// Alternativa applicata a un pasto in una data (null = torna al principale). Non modifica il piano.
export function selectAlternative(state, { date, planId, planRevision, mealId, alternativeId }) {
  const rest = (state.dietSelections ?? []).filter((x) => !(x.date === date && x.planId === planId && x.mealId === mealId))
  if (!alternativeId) return { ...state, dietSelections: rest }
  return { ...state, dietSelections: [...rest, { id: uid('dietsel'), date, planId, planRevision, mealId, alternativeId }] }
}
