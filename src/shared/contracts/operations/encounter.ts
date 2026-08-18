import {
  encounterSelectionEvaluationSchema,
  evaluateEncounterSelectionInputSchema
} from '../scene.js'
import { read } from './registry.js'

export const encounterOperationDefinitions = {
  'encounter.evaluate': read(
    'encounter:evaluate',
    evaluateEncounterSelectionInputSchema,
    encounterSelectionEvaluationSchema
  )
} as const
