import type { CoreHandlers } from '../../shared/contracts/core-protocol.js'
import type { GeneratedEncounterPlanService } from '../../core/encounter/generated-plan-service.js'
import type { SessionPlannerService } from '../session-planner/session-planner-service.js'

type SessionPlannerHandlerName =
  | 'encounterPlans.summaries'
  | 'encounterPlans.search'
  | 'sessionPlanner.read'
  | 'sessionPlanner.create'
  | 'sessionPlanner.open'
  | 'sessionPlanner.switch'
  | 'sessionPlanner.rename'
  | 'sessionPlanner.save'
  | 'sessionPlanner.delete'
  | 'sessionPlanner.startPreparation'
  | 'sessionPlanner.preparationReceipt'
  | 'sessionPlanner.cancelPreparation'

export function createSessionPlannerHandlers(dependencies: {
  encounterPlans: GeneratedEncounterPlanService
  sessionPlanner: SessionPlannerService
}): Pick<CoreHandlers, SessionPlannerHandlerName> {
  const { encounterPlans, sessionPlanner } = dependencies
  return {
    'encounterPlans.summaries': (input) => encounterPlans.summaries(input),
    'encounterPlans.search': (input) => encounterPlans.search(input),
    'sessionPlanner.read': () => sessionPlanner.read(),
    'sessionPlanner.create': (input) => sessionPlanner.create(input),
    'sessionPlanner.open': (input) => sessionPlanner.open(input),
    'sessionPlanner.switch': (input) => sessionPlanner.switch(input),
    'sessionPlanner.rename': (input) => sessionPlanner.rename(input),
    'sessionPlanner.save': (input) => sessionPlanner.save(input),
    'sessionPlanner.delete': (input) => sessionPlanner.delete(input),
    'sessionPlanner.startPreparation': (input) =>
      sessionPlanner.startPreparation(input),
    'sessionPlanner.preparationReceipt': (input) =>
      sessionPlanner.preparationReceipt(input),
    'sessionPlanner.cancelPreparation': (input) =>
      sessionPlanner.cancelPreparation(input)
  }
}
