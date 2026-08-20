import {
  generatedEncounterPlanSummaryBatchQuerySchema,
  generatedEncounterPlanSummaryBatchResultSchema,
  savedEncounterPlanSearchResultSchema,
  searchSavedEncounterPlansQuerySchema
} from '../encounter-plans.js'
import { read, utilityOperationFragment } from './registry.js'

export const encounterPlansOperationDefinitions = utilityOperationFragment({
  'encounterPlans.summaries': read(
    'encounter-plans:summaries',
    generatedEncounterPlanSummaryBatchQuerySchema,
    generatedEncounterPlanSummaryBatchResultSchema
  ),
  'encounterPlans.search': read(
    'encounter-plans:search',
    searchSavedEncounterPlansQuerySchema,
    savedEncounterPlanSearchResultSchema
  )
})
