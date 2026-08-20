import {
  encounterSelectionEvaluationSchema,
  evaluateEncounterSelectionInputSchema
} from '../scene.js'
import { read, utilityOperationFragment } from './registry.js'

export const encounterOperationDefinitions = utilityOperationFragment({
  'encounter.evaluate': read(
    'encounter:evaluate',
    evaluateEncounterSelectionInputSchema,
    encounterSelectionEvaluationSchema
  )
})
