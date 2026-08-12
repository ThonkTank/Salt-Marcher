import type {
  SavedEncounterPlanSearchResult,
  SavedEncounterPlanSummary
} from '../../../shared/contracts/encounter-plans.js'
import { formatMessage } from '../../i18n/session-runtime.de.js'

type PlanTitle = Pick<
  SavedEncounterPlanSummary,
  'titleKind' | 'authoredName' | 'generatedEncounterNumber'
>

export function encounterPlanTitle(plan: PlanTitle): string {
  return plan.titleKind === 'authored'
    ? plan.authoredName!
    : formatMessage('planner.generatedEncounterTitle', {
        number: plan.generatedEncounterNumber!
      })
}

export function encounterRosterText(
  plan:
    SavedEncounterPlanSummary | SavedEncounterPlanSearchResult['hits'][number]
): string {
  return plan.creatures
    .map((creature) => `${creature.quantity}× ${creature.name}`)
    .join(', ')
}

export function encounterSummaryText(plan: SavedEncounterPlanSummary): string {
  return `${plan.difficulty} · ${plan.adjustedXp} EP · ${encounterRosterText(plan)}`
}
