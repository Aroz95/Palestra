// Import manager unico: riconosce il tipo di file, valida, mostra un'anteprima con i duplicati
// e applica le modifiche in modo atomico (nuovo stato calcolato per intero, oppure nessuna modifica).
import { Validator } from './validate'
import {
  normDietPlan,
  normGoal,
  normMeasurement,
  normProfile,
  normProgram,
  normStrengthSession,
  normSwimSession,
  normTemplate,
} from './normalize'
import { FILE_TYPES, LIMITS, SCHEMA_VERSION } from '../../schema/constants'
import { isLegacyBackup, migrateLegacySession, migrateLegacyState } from '../../schema/migrate'
import { clone, emptyState, uid } from '../../schema/factories'
import { toLocalISO, localDate } from '../dates'

const emptyBatch = () => ({
  fullBackup: false,
  programs: [], // { program, templates }
  templates: [], // schede senza programma
  sessions: [],
  dietPlans: [],
  measurements: [],
  goals: [],
  profile: null,
  settings: null,
  calendar: null,
  dietLog: [],
  activeSessionId: null,
  sources: [],
})

const tooNew = (v, raw, path) => {
  const ver = raw.schemaVersion ?? raw.version
  if (typeof ver === 'number' && ver > SCHEMA_VERSION) {
    v.err(path || '(radice)', `file creato da una versione più recente dell'app (schema ${ver}); aggiorna l'app prima di importarlo`)
    return true
  }
  return false
}

// I campi "summary" dei file non vengono mai letti: le statistiche sono ricalcolate dai dati primari.
function collect(v, raw, path, batch) {
  if (!raw || typeof raw !== 'object') {
    v.err(path || '(radice)', 'il file non contiene un oggetto JSON')
    return
  }
  if (Array.isArray(raw)) {
    raw.forEach((item, i) => collect(v, item, `${path}[${i}]`, batch))
    return
  }
  const p = (k) => (path ? `${path}.${k}` : k)
  const type = raw.type

  if (!type && isLegacyBackup(raw)) {
    batch.sources.push('backup versione precedente (v1/v2)')
    collectBackup(v, migrateLegacyState(clone(raw)), path, batch)
    return
  }
  if (tooNew(v, raw, path)) return

  switch (type) {
    case FILE_TYPES.backup:
      batch.sources.push('backup completo')
      collectBackup(v, raw, path, batch)
      return
    case FILE_TYPES.strength: {
      // Seduta singola: legacy v2 (senza schemaVersion) o v3
      const sv = raw.schemaVersion ?? 0
      const session = sv >= 3 ? raw.session : migrateLegacySession(raw.session ?? {}, {})
      if (sv < 3 && (!raw.session || !Array.isArray(raw.session.exercises))) {
        v.err(p('session'), 'seduta mancante o non valida')
        return
      }
      if (sv < 3) session.origin = 'legacy-v2'
      const s = normStrengthSession(v, session, p('session'))
      if (s) batch.sessions.push({ item: s, hadId: !!raw.session?.id })
      batch.sources.push(sv >= 3 ? 'seduta palestra' : 'seduta palestra (versione precedente)')
      return
    }
    case FILE_TYPES.swim: {
      const list = Array.isArray(raw.sessions) ? raw.sessions.map((s, i) => [s, p(`sessions[${i}]`)]) : [[raw, path || '(radice)']]
      for (const [s, sp] of list) {
        const n = normSwimSession(v, s, sp)
        if (n) batch.sessions.push({ item: n, hadId: !!s.id })
      }
      batch.sources.push('nuoto')
      return
    }
    case FILE_TYPES.program: {
      const r = normProgram(v, raw, path || '(radice)')
      if (r) batch.programs.push({ ...r, hadId: !!raw.id })
      batch.sources.push('programma')
      return
    }
    case FILE_TYPES.diet: {
      const d = normDietPlan(v, raw, path || '(radice)')
      if (d) batch.dietPlans.push({ item: { ...d, active: false }, hadId: !!raw.id })
      batch.sources.push('piano alimentare')
      return
    }
    case FILE_TYPES.measurements: {
      const list = Array.isArray(raw.measurements) ? raw.measurements : null
      if (!list) {
        v.err(p('measurements'), 'elenco misure mancante')
        return
      }
      if (list.length > LIMITS.itemsPerCollection) {
        v.err(p('measurements'), `troppe misure (max ${LIMITS.itemsPerCollection})`)
        return
      }
      list.forEach((m, i) => {
        const n = normMeasurement(v, m, p(`measurements[${i}]`))
        if (n) batch.measurements.push({ item: n, hadId: !!m.id })
      })
      batch.sources.push('misure corporee')
      return
    }
    case FILE_TYPES.report:
      v.err(path || '(radice)', 'questo file è un report riepilogativo: non contiene dati ripristinabili e non può essere importato')
      return
    default:
      v.err(p('type'), type ? `tipo di file non riconosciuto: "${type}"` : 'campo "type" mancante: file non riconosciuto')
  }
}

function collectBackup(v, raw, path, batch) {
  const p = (k) => (path ? `${path}.${k}` : k)
  batch.fullBackup = true
  const programs = v.arr(raw.programs, p('programs'))
  const templates = v.arr(raw.workoutTemplates, p('workoutTemplates'))
  const byProgram = new Map()
  templates.forEach((t, i) => {
    const key = t?.programId ?? null
    if (!byProgram.has(key)) byProgram.set(key, [])
    byProgram.get(key).push([t, i])
  })
  programs.forEach((pr, i) => {
    const r = normProgram(v, { ...pr, workoutTemplates: [] }, p(`programs[${i}]`))
    if (!r) return
    r.templates = (byProgram.get(pr.id) ?? []).map(([t, j]) => normTemplate(v, t, p(`workoutTemplates[${j}]`), r.program.id)).filter(Boolean)
    byProgram.delete(pr.id)
    batch.programs.push({ ...r, hadId: true })
  })
  for (const list of byProgram.values()) {
    for (const [t, j] of list) {
      const n = normTemplate(v, t, p(`workoutTemplates[${j}]`), null)
      if (n) batch.templates.push({ item: n, hadId: !!t.id })
    }
  }
  v.arr(raw.sessions, p('sessions')).forEach((s, i) => {
    const n = s?.kind === 'swim' ? normSwimSession(v, s, p(`sessions[${i}]`)) : normStrengthSession(v, s, p(`sessions[${i}]`))
    if (n) batch.sessions.push({ item: n, hadId: !!s.id })
  })
  v.arr(raw.dietPlans, p('dietPlans')).forEach((d, i) => {
    const n = normDietPlan(v, d, p(`dietPlans[${i}]`))
    if (n) batch.dietPlans.push({ item: n, hadId: true })
  })
  v.arr(raw.measurements, p('measurements')).forEach((m, i) => {
    const n = normMeasurement(v, m, p(`measurements[${i}]`), { defaultSource: 'manual' })
    if (n) batch.measurements.push({ item: n, hadId: true })
  })
  v.arr(raw.goals, p('goals')).forEach((g, i) => {
    const n = normGoal(v, g, p(`goals[${i}]`))
    if (n) batch.goals.push({ item: n, hadId: true })
  })
  batch.profile = normProfile(v, raw.profile, p('profile'))
  batch.settings = raw.settings && typeof raw.settings === 'object' ? { ...raw.settings } : null
  batch.calendar = raw.calendar && typeof raw.calendar === 'object' ? clone(raw.calendar) : null
  batch.dietLog = Array.isArray(raw.dietLog) ? clone(raw.dietLog) : []
  batch.activeSessionId = raw.activeSessionId ?? null
}

// Legge e valida il contenuto di un file. Nessuna modifica allo stato.
export function parseImport(text, { fileName = '', size = text?.length ?? 0 } = {}) {
  const v = new Validator()
  const batch = emptyBatch()
  if (size > LIMITS.fileBytes) {
    v.err('(file)', `file troppo grande (${Math.round(size / 1024)} KB, max ${LIMITS.fileBytes / 1024 / 1024} MB)`)
    return { batch, errors: v.errors, warnings: v.warnings, fileName }
  }
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    v.err('(file)', `JSON non valido: ${e.message}`)
    return { batch, errors: v.errors, warnings: v.warnings, fileName }
  }
  collect(v, data, '', batch)
  return { batch, errors: v.errors, warnings: v.warnings, fileName }
}

// ---- Anteprima e duplicati ----

const VOLATILE = new Set(['createdAt', 'updatedAt', 'revisionInUse', 'isMain'])
function stable(x) {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`
  if (x && typeof x === 'object') {
    return `{${Object.keys(x)
      .filter((k) => !VOLATILE.has(k) && x[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(x[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(x ?? null)
}

const fingerprints = {
  sessions: (s) =>
    s.kind === 'swim'
      ? `swim|${s.date}|${s.durationMin}|${s.plannedDistanceM}`
      : `strength|${s.date}|${s.exercises.map((e) => `${e.name}:${e.sets.length}`).join(',')}`,
  measurements: (m) => `${m.at.slice(0, 16)}|${m.weightKg}|${m.waistCm}|${m.abdomenCm}`,
  dietPlans: (d) => `${d.name}|${d.validFrom}`,
  goals: (g) => `${g.label}|${g.targetValue}`,
  templates: (t) => `${t.name}|${t.label}`,
}

function describe(collection, item) {
  switch (collection) {
    case 'programs':
      return `${item.program.name} (${item.templates.length} schede)`
    case 'sessions':
      return `${item.kind === 'swim' ? 'Nuoto' : 'Palestra'} ${item.date}${item.title ? ` · ${item.title}` : ''}`
    case 'measurements':
      return `Misura ${localDate(item.at)}`
    case 'dietPlans':
      return `Piano "${item.name}"`
    case 'goals':
      return `Obiettivo "${item.label}"`
    case 'templates':
      return `Scheda "${item.name}"`
    default:
      return collection
  }
}

const STATE_KEY = { programs: 'programs', sessions: 'sessions', measurements: 'measurements', dietPlans: 'dietPlans', goals: 'goals', templates: 'workoutTemplates' }

// Elenco degli elementi con stato: new | identical | conflict (stesso id, contenuto diverso) | duplicate (stessa impronta)
export function previewImport(state, batch) {
  const items = []
  const add = (collection, entry, existingList, idOf, contentOf) => {
    const item = collection === 'programs' ? entry : entry.item
    const id = idOf(item)
    const existing = existingList.find((x) => idOf(x) === id)
    let status = 'new'
    let targetId = null
    if (existing) {
      status = stable(contentOf(existing)) === stable(contentOf(item)) ? 'identical' : 'conflict'
      targetId = id
    } else if (!entry.hadId && fingerprints[collection]) {
      const fp = fingerprints[collection](item)
      const dup = existingList.find((x) => fingerprints[collection](x) === fp)
      if (dup) {
        status = 'duplicate'
        targetId = idOf(dup)
      }
    }
    items.push({ key: `${collection}:${id}:${items.length}`, collection, id, label: describe(collection, item), status, targetId, entry })
  }

  const programsWithTemplates = state.programs.map((pr) => ({ program: pr, templates: state.workoutTemplates.filter((t) => t.programId === pr.id) }))
  batch.programs.forEach((e) =>
    add('programs', e, programsWithTemplates, (x) => x.program.id, (x) => ({ program: x.program, templates: x.templates.map(({ history, revision, ...t }) => t) })),
  )
  const plain = (collection) => (e) => add(collection, e, state[STATE_KEY[collection]], (x) => x.id, (x) => x)
  batch.templates.forEach(plain('templates'))
  batch.sessions.forEach(plain('sessions'))
  batch.dietPlans.forEach((e) => add('dietPlans', e, state.dietPlans, (x) => x.id, ({ active, archived, history, ...x }) => x))
  batch.measurements.forEach(plain('measurements'))
  batch.goals.forEach(plain('goals'))

  const count = (c) => items.filter((i) => i.collection === c).length
  const templatesCount = batch.programs.reduce((a, p) => a + p.templates.length, 0) + batch.templates.length
  const summary = [
    batch.programs.length && `${batch.programs.length} programm${batch.programs.length === 1 ? 'a' : 'i'}`,
    templatesCount && `${templatesCount} sched${templatesCount === 1 ? 'a' : 'e'}`,
    count('sessions') && `${count('sessions')} sedut${count('sessions') === 1 ? 'a' : 'e'}`,
    count('dietPlans') && `${count('dietPlans')} pian${count('dietPlans') === 1 ? 'o' : 'i'} alimentar${count('dietPlans') === 1 ? 'e' : 'i'}`,
    count('measurements') && `${count('measurements')} misur${count('measurements') === 1 ? 'a' : 'e'}`,
    count('goals') && `${count('goals')} obiettiv${count('goals') === 1 ? 'o' : 'i'}`,
    batch.profile && 'profilo',
  ].filter(Boolean)
  return {
    items,
    summary: summary.join(', ') || 'nessun dato',
    duplicates: items.filter((i) => i.status !== 'new').length,
    canReplace: batch.fullBackup,
  }
}

// ---- Applicazione ----

function remapProgramClone({ program, templates }) {
  const pid = uid('program')
  const map = new Map(templates.map((t) => [t.id, uid('tpl')]))
  return {
    program: {
      ...program,
      id: pid,
      name: `${program.name} (copia)`,
      isMain: false,
      weeklySchedule: program.weeklySchedule.map((s) => ({ ...s, id: uid('slot'), templateId: map.get(s.templateId) ?? s.templateId })),
    },
    templates: templates.map((t) => ({ ...t, id: map.get(t.id), programId: pid })),
  }
}

const templateContent = ({ history, revision, revisionInUse, programId, ...t }) => t
const dietContent = ({ history, revision, active, archived, createdAt, updatedAt, ...d }) => d
const snapshotOf = (x) => {
  const { history, ...snapshot } = x
  return { revision: x.revision, savedAt: toLocalISO(), snapshot: clone(snapshot) }
}

// Aggiornamento di un programma da file. Per ogni scheda:
// - stesso contenuto → invariata;
// - contenuto diverso → nuova revisione (attuale + 1), la precedente resta nello storico della scheda;
// - scheda nuova → aggiunta;
// - scheda non più presente nel file → archiviata (non cancellata: le sedute vi fanno ancora riferimento).
function mergeProgramTemplates(all, incoming, pid) {
  const byId = new Map(incoming.map((t) => [t.id, t]))
  const out = all.map((t) => {
    if (t.programId !== pid) return t
    const inc = byId.get(t.id)
    if (!inc) return t.archived ? t : { ...t, archived: true }
    byId.delete(t.id)
    if (stable(templateContent(t)) === stable(templateContent({ ...inc, programId: pid }))) return t.archived ? { ...t, archived: false } : t
    return { ...inc, programId: pid, revision: t.revision + 1, revisionInUse: false, history: [...(t.history ?? []), snapshotOf(t)] }
  })
  const taken = new Set(all.map((t) => t.id))
  for (const t of byId.values()) out.push({ ...t, id: taken.has(t.id) ? uid('tpl') : t.id, programId: pid, history: [] })
  return out
}

// options: { mode: 'merge'|'replace', decisions: { [key]: 'skip'|'update'|'clone' }, setMainProgram, activateDietPlan }
export function applyImport(state, batch, preview, options = {}) {
  const mode = options.mode ?? 'merge'
  const log = { at: toLocalISO(), mode, inserted: [], updated: [], skipped: [], errors: [] }

  if (mode === 'replace') {
    if (!batch.fullBackup) throw new Error('La sostituzione completa è ammessa solo con un backup completo')
    const next = emptyState()
    next.programs = batch.programs.map((p) => p.program)
    next.workoutTemplates = [...batch.programs.flatMap((p) => p.templates), ...batch.templates.map((t) => t.item)]
    next.sessions = batch.sessions.map((s) => s.item)
    next.dietPlans = batch.dietPlans.map((d) => d.item)
    next.measurements = batch.measurements.map((m) => m.item)
    next.goals = batch.goals.map((g) => g.item)
    next.profile = batch.profile ?? next.profile
    next.settings = { ...next.settings, ...(batch.settings ?? {}) }
    next.calendar = { overrides: batch.calendar?.overrides ?? {}, extra: batch.calendar?.extra ?? [] }
    next.dietLog = batch.dietLog
    next.activeSessionId = next.sessions.some((s) => s.id === batch.activeSessionId) ? batch.activeSessionId : null
    next.meta = { ...next.meta, restoredAt: toLocalISO() }
    log.inserted = preview.items.map((i) => i.label)
    return { state: next, log }
  }

  const next = { ...state, programs: [...state.programs], workoutTemplates: [...state.workoutTemplates], sessions: [...state.sessions], dietPlans: [...state.dietPlans], measurements: [...state.measurements], goals: [...state.goals] }
  const decisions = options.decisions ?? {}
  let importedProgramId = null
  let importedDietId = null

  for (const it of preview.items) {
    const choice = it.status === 'new' ? 'insert' : (decisions[it.key] ?? 'skip')
    if (choice === 'skip') {
      log.skipped.push(`${it.label} (${it.status === 'identical' ? 'identico' : 'già presente'})`)
      continue
    }
    if (it.collection === 'programs') {
      let unit = { program: it.entry.program, templates: it.entry.templates }
      if (choice === 'clone') unit = remapProgramClone(unit)
      const pid = choice === 'update' ? it.targetId : unit.program.id
      if (choice === 'update') {
        const old = next.programs.find((p) => p.id === pid)
        unit.program = { ...unit.program, id: pid, isMain: old?.isMain ?? false }
        next.programs = next.programs.map((p) => (p.id === pid ? unit.program : p))
        next.workoutTemplates = mergeProgramTemplates(next.workoutTemplates, unit.templates, pid)
        log.updated.push(it.label)
      } else {
        const clash = new Set(next.workoutTemplates.map((t) => t.id))
        if (unit.templates.some((t) => clash.has(t.id))) unit = remapProgramClone(unit) // evita collisioni di id delle schede
        next.programs.push({ ...unit.program, isMain: false })
        next.workoutTemplates.push(...unit.templates)
        log.inserted.push(it.label)
      }
      importedProgramId ??= choice === 'update' ? pid : next.programs[next.programs.length - 1].id
      continue
    }
    const key = STATE_KEY[it.collection]
    const item = clone(it.entry.item)
    if (choice === 'update') {
      next[key] = next[key].map((x) => {
        if (x.id !== it.targetId) return x
        if (it.collection !== 'dietPlans') return { ...item, id: it.targetId }
        // Piano alimentare: il contenuto del file diventa la revisione successiva, la precedente resta nello storico
        if (stable(dietContent(x)) === stable(dietContent(item))) return x
        return { ...item, id: x.id, active: x.active, archived: x.archived, revision: x.revision + 1, history: [...(x.history ?? []), snapshotOf(x)], updatedAt: toLocalISO() }
      })
      log.updated.push(it.label)
    } else {
      const exists = next[key].some((x) => x.id === item.id)
      if (choice === 'clone' || exists) item.id = uid(it.collection === 'sessions' ? item.kind : it.collection.slice(0, -1))
      if (it.collection === 'dietPlans') item.active = false
      next[key].push(item)
      log.inserted.push(it.label)
    }
    if (it.collection === 'dietPlans') importedDietId ??= choice === 'update' ? it.targetId : item.id
  }

  // Programma principale: solo se richiesto o se non ne esiste uno
  if (importedProgramId && (options.setMainProgram || !next.programs.some((p) => p.isMain && p.status !== 'archived'))) {
    next.programs = next.programs.map((p) => ({ ...p, isMain: p.id === importedProgramId }))
  }
  // Il piano alimentare attivo non viene mai sostituito automaticamente
  if (importedDietId && options.activateDietPlan) {
    next.dietPlans = next.dietPlans.map((d) => ({ ...d, active: d.id === importedDietId }))
  }
  // Profilo da backup: usato solo se quello attuale è vuoto
  if (batch.profile) {
    const empty = !Object.entries(state.profile).some(([k, val]) => k !== 'units' && val !== null && val !== '')
    if (empty) {
      next.profile = batch.profile
      log.inserted.push('Profilo')
    } else log.skipped.push('Profilo (mantenuto quello attuale)')
  }
  return { state: next, log }
}
