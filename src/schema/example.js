// Programma di esempio, caricabile a richiesta (non è preimpostato).
import { newProgram, newTemplate, newCardio, uid } from './factories'
import { migrateLegacyTemplateExercise } from './migrate'

const TOTAL_BODY = [
  { id: 'leg-press', name: 'Leg Press', group: 'Gambe / glutei', step: 5, reps: 12, weight: 60 },
  { id: 'leg-extension', name: 'Leg Extension', group: 'Quadricipiti', reps: 12, weight: 20 },
  { id: 'leg-curl', name: 'Leg Curl', group: 'Femorali', reps: 12, weight: 20 },
  { id: 'incline-chest-press', name: 'Incline Chest Press', group: 'Pettorali / tricipiti', reps: 12, weight: 20 },
  { id: 'pec-deck', name: 'Pectoral Machine (Pec Deck)', group: 'Pettorali', reps: 10, weight: 15 },
  { id: 'upper-back', name: 'Upper Back Machine', group: 'Schiena', reps: 10, weight: 20 },
  { id: 'alzate-laterali', name: 'Alzate laterali con manubri', group: 'Spalle', perHand: true, step: 1, reps: 10, weight: 6 },
  { id: 'curl-manubri', name: 'Curl con manubri', group: 'Bicipiti', perHand: true, step: 1, reps: 12, weight: 6 },
  { id: 'triceps-pushdown', name: 'Triceps Push Down al cavo con barra', group: 'Tricipiti', reps: 12, weight: 10 },
  { id: 'pulldown', name: 'Technogym Pulldown Machine', group: 'Dorsali', reps: 12, weight: 20 },
  { id: 'plank', name: 'Plank', group: 'Core', type: 'time', reps: 30 },
]

export function exampleProgram() {
  const program = newProgram({ name: 'Esempio Total Body', description: 'Programma di esempio modificabile' })
  const template = newTemplate({
    programId: program.id,
    label: 'A',
    name: 'Total Body',
    estimatedMinutes: 90,
    warmup: [newCardio({ minutes: 7.5, speed: 5.5 }), newCardio({ minutes: 7.5, speed: 6.5 })],
    exercises: TOTAL_BODY.map((e) => ({
      ...migrateLegacyTemplateExercise({ sets: 3, step: 2.5, ...e }),
      equipment: e.id === 'triceps-pushdown' ? 'cable' : e.type === 'time' ? 'bodyweight' : e.perHand ? 'dumbbell' : 'machine',
    })),
    cooldown: [newCardio({ minutes: 6, speed: 5.5 }), newCardio({ minutes: 4, speed: 3.75, note: 'Prima 4, poi 3,5 km/h' })],
  })
  program.weeklySchedule = [{ id: uid('slot'), weekday: 1, kind: 'strength', templateId: template.id, label: '' }]
  return { program, templates: [template] }
}
