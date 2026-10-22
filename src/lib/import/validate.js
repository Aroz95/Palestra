import { isValidDate, isValidDateTime } from '../dates'
import { LIMITS } from '../../schema/constants'

// Raccoglie errori e avvisi con il percorso del campo (es. workoutTemplates[0].exercises[2].repMin)
export class Validator {
  constructor() {
    this.errors = []
    this.warnings = []
  }
  err(path, msg) {
    this.errors.push({ path, message: msg })
  }
  warn(path, msg) {
    this.warnings.push({ path, message: msg })
  }

  num(v, path, { min = 0, max = Infinity, int = false, nullable = true, def = null } = {}) {
    if (v === undefined || v === null || v === '') {
      if (!nullable && def === null) this.err(path, 'valore obbligatorio')
      return def
    }
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      this.err(path, `numero non valido (${JSON.stringify(v)})`)
      return def
    }
    if (int && !Number.isInteger(n)) this.err(path, 'deve essere un numero intero')
    if (n < min) this.err(path, `deve essere ≥ ${min}`)
    if (n > max) this.err(path, `deve essere ≤ ${max}`)
    return n
  }

  str(v, path, { nullable = true, max = 5000, def = '' } = {}) {
    if (v === undefined || v === null) {
      if (!nullable) this.err(path, 'testo obbligatorio')
      return def
    }
    if (typeof v !== 'string' && typeof v !== 'number') {
      this.err(path, 'deve essere un testo')
      return def
    }
    const s = String(v)
    if (s.length > max) this.err(path, `testo troppo lungo (max ${max} caratteri)`)
    if (!nullable && !s.trim()) this.err(path, 'testo obbligatorio')
    return s
  }

  id(v, path) {
    if (v === undefined || v === null || v === '') return null
    if (typeof v !== 'string' && typeof v !== 'number') {
      this.err(path, 'id non valido')
      return null
    }
    return String(v).slice(0, 200)
  }

  bool(v, path, def = false) {
    if (v === undefined || v === null) return def
    if (typeof v !== 'boolean') {
      this.err(path, 'deve essere true o false')
      return def
    }
    return v
  }

  date(v, path, { nullable = true } = {}) {
    if (v === undefined || v === null || v === '') {
      if (!nullable) this.err(path, 'data obbligatoria (AAAA-MM-GG)')
      return null
    }
    if (!isValidDate(v)) {
      this.err(path, `data non valida (${JSON.stringify(v)}), formato atteso AAAA-MM-GG`)
      return null
    }
    return v
  }

  datetime(v, path, { nullable = true } = {}) {
    if (v === undefined || v === null || v === '') {
      if (!nullable) this.err(path, 'data/ora obbligatoria')
      return null
    }
    if (!isValidDateTime(v)) {
      this.err(path, `data/ora non valida (${JSON.stringify(v)}), formato atteso ISO 8601`)
      return null
    }
    return v
  }

  time(v, path) {
    if (v === undefined || v === null || v === '') return null
    if (typeof v !== 'string' || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(v)) {
      this.err(path, `orario non valido (${JSON.stringify(v)}), formato atteso HH:MM`)
      return null
    }
    return v.padStart(5, '0')
  }

  oneOf(v, path, allowed, def) {
    if (v === undefined || v === null || v === '') return def
    if (!allowed.includes(v)) {
      this.err(path, `valore non ammesso (${JSON.stringify(v)}); ammessi: ${allowed.join(', ')}`)
      return def
    }
    return v
  }

  arr(v, path, { required = false } = {}) {
    if (v === undefined || v === null) {
      if (required) this.err(path, 'elenco obbligatorio')
      return []
    }
    if (!Array.isArray(v)) {
      this.err(path, 'deve essere un elenco')
      return []
    }
    if (v.length > LIMITS.itemsPerCollection) {
      this.err(path, `troppi elementi (max ${LIMITS.itemsPerCollection})`)
      return []
    }
    return v
  }

  obj(v, path, { nullable = true } = {}) {
    if (v === undefined || v === null) {
      if (!nullable) this.err(path, 'oggetto obbligatorio')
      return null
    }
    if (typeof v !== 'object' || Array.isArray(v)) {
      this.err(path, 'deve essere un oggetto')
      return null
    }
    return v
  }
}
