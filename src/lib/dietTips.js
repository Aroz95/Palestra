// Suggerimenti personali per l'alimentazione: un elenco dell'utente (non fa parte del piano del professionista).
// Categorie: alternative per un pasto, come gestire la fame, fuori casa, altro.
import { MEAL_CATEGORIES } from '../schema/constants'
import { uid } from '../schema/factories'
import { toLocalISO } from './dates'

export const TIP_CATEGORIES = {
  alternative: 'Alternative per un pasto',
  hunger: 'Ingannare la fame',
  out: 'Fuori casa e imprevisti',
  other: 'Altro',
}

export function newTip(patch = {}) {
  return { id: uid('tip'), category: 'hunger', meal: null, text: '', createdAt: toLocalISO(), ...patch }
}

// Forma valida di un suggerimento letto da un file (backup); null se inutilizzabile
export function normTip(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.text !== 'string' || !raw.text.trim()) return null
  const category = raw.category in TIP_CATEGORIES ? raw.category : 'other'
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid('tip'),
    category,
    meal: category === 'alternative' && raw.meal in MEAL_CATEGORIES ? raw.meal : null,
    text: raw.text.trim().slice(0, 600),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : toLocalISO(),
  }
}

// Suggerimenti da mostrare dentro un pasto: le alternative legate a quel tipo di pasto (o a qualsiasi pasto)
export function tipsForMeal(tips, mealCategory) {
  return (tips ?? []).filter((t) => t.category === 'alternative' && (t.meal == null || t.meal === mealCategory))
}

export function groupTips(tips) {
  return Object.keys(TIP_CATEGORIES)
    .map((category) => ({ category, label: TIP_CATEGORIES[category], tips: (tips ?? []).filter((t) => t.category === category) }))
    .filter((g) => g.tips.length)
}

// Esempi generici, inseriti solo su richiesta e modificabili: non sono indicazioni del professionista
export const EXAMPLE_TIPS = [
  { category: 'hunger', text: 'Un bicchiere grande d’acqua o una tisana senza zucchero, poi aspetto 10 minuti.' },
  { category: 'hunger', text: 'Verdure crude già pronte in frigo (finocchi, carote, cetrioli).' },
  { category: 'hunger', text: 'Mi lavo i denti dopo cena: chiude la cucina.' },
  { category: 'hunger', text: 'Esco a camminare 10 minuti o mi tengo occupato con altro.' },
  { category: 'out', text: 'Al ristorante: un secondo con contorno di verdure, pane contato.' },
  { category: 'alternative', meal: 'lunch', text: 'Senza tempo per cucinare: la stessa quantità di proteine e carboidrati con alimenti pronti (da concordare con il professionista).' },
]
