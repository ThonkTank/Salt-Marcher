import {
  generatedEncounterPlanSummaryBatchQuerySchema,
  generatedEncounterPlanSummaryBatchResultSchema,
  savedEncounterPlanSearchResultSchema,
  searchSavedEncounterPlansQuerySchema
} from '../encounter-plans.js'
import { read } from './registry.js'

export const encounterPlansOperationDefinitions = {
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
} as const
