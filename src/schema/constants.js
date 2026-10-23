// Contratti dati v3. Lo schema pubblico è documentato in docs/SCHEMA.md.
// v4: piani alimentari con obiettivi, guida, nutrienti per alimento/alternativa; diario con consumi; scelte delle alternative
export const SCHEMA_VERSION = 4
export const DEFAULT_REST = 60

export const FILE_TYPES = {
  backup: 'palestra-backup',
  program: 'palestra-program',
  strength: 'palestra-seduta',
  swim: 'palestra-swim-session',
  diet: 'palestra-diet-plan',
  measurements: 'palestra-body-measurements',
  report: 'palestra-report',
}

export const SESSION_STATUS = {
  planned: 'Prevista',
  in_progress: 'In corso',
  completed: 'Completata',
  skipped: 'Saltata',
  postponed: 'Rinviata',
}

export const ACTIVITY_KINDS = {
  strength: 'Sala pesi',
  swim: 'Nuoto',
  rest: 'Recupero',
  other: 'Altro',
}

export const EQUIPMENT = {
  machine: 'Macchina',
  cable: 'Cavo',
  dumbbell: 'Manubri',
  barbell: 'Bilanciere',
  bodyweight: 'Corpo libero',
  other: 'Altro',
}

export const DISTANCE_SOURCES = {
  measured: 'Misurata',
  manually_counted: 'Contata a mano',
  estimated: 'Stimata',
  unknown: 'Non nota',
}

export const SWIM_STYLES = ['Stile libero', 'Dorso', 'Rana', 'Delfino', 'Misti', 'Gambe', 'Braccia', 'Altro']

export const MEAL_CATEGORIES = {
  breakfast: 'Colazione',
  snack: 'Spuntino',
  lunch: 'Pranzo',
  afternoon_snack: 'Merenda',
  dinner: 'Cena',
  other: 'Altro',
}

export const ADHERENCE = {
  followed: 'Seguito',
  modified: 'Modificato',
  skipped: 'Saltato',
}

export const MEASUREMENT_FIELDS = [
  { key: 'weightKg', label: 'Peso', unit: 'kg', step: 0.1, hint: '' },
  { key: 'waistCm', label: 'Girovita', unit: 'cm', step: 0.5, hint: 'Punto più stretto del busto, tra costole e cresta iliaca' },
  { key: 'abdomenCm', label: 'Circonferenza addominale', unit: 'cm', step: 0.5, hint: "All'altezza dell'ombelico, a fine espirazione" },
  { key: 'hipsCm', label: 'Fianchi', unit: 'cm', step: 0.5, hint: 'Punto più largo dei glutei' },
  { key: 'chestCm', label: 'Petto', unit: 'cm', step: 0.5, hint: "All'altezza dei capezzoli" },
  { key: 'armCm', label: 'Braccio', unit: 'cm', step: 0.5, hint: 'Metà braccio, rilassato' },
]

export const LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  itemsPerCollection: 5000,
}
