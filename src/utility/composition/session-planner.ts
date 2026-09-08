import { CapabilityError } from '../../shared/errors/capability-error.js'
import { encounterPlansOperationDefinitions } from '../../shared/contracts/operations/encounter-plans.js'
import { sessionPlannerOperationDefinitions } from '../../shared/contracts/operations/session-planner.js'
import {
  composeOperationDefinitions,
  defineOperationHandlers,
  type OperationHandlers
} from '../../shared/contracts/operations/registry.js'
import type { GeneratedEncounterPlanService } from '../../core/encounter/generated-plan-service.js'
import type { SessionPlannerService } from '../session-planner/session-planner-service.js'

const sessionPlannerHandlerOperations = composeOperationDefinitions(
  encounterPlansOperationDefinitions,
  sessionPlannerOperationDefinitions
)

export function createSessionPlannerHandlers(dependencies: {
  activeCampaignId(): string
  encounterPlans: GeneratedEncounterPlanService
  sessionPlanner: SessionPlannerService
}): OperationHandlers<typeof sessionPlannerHandlerOperations> {
  const { encounterPlans, sessionPlanner } = dependencies
  return defineOperationHandlers(
    'session_planner_handlers',
    sessionPlannerHandlerOperations,
    {
      'encounterPlans.summaries': (input) => encounterPlans.summaries(input),
      'encounterPlans.search': (input) => encounterPlans.search(input),
      'sessionPlanner.preparationMaintenanceStatus': ({
        campaignId,
        operationIds
      }) => {
        if (campaignId !== dependencies.activeCampaignId())
          throw new CapabilityError('stale', false)
        return sessionPlanner.preparationMaintenanceStatus(operationIds)
      },
      'sessionPlanner.cancelPreparationForMaintenance': ({
        campaignId,
        operationId
      }) => {
        if (campaignId !== dependencies.activeCampaignId())
          throw new CapabilityError('stale', false)
        return sessionPlanner.cancelPreparation({ operationId })
      },
      'sessionPlanner.executeCommand': ({ campaignId, ...input }) => {
        if (campaignId !== dependencies.activeCampaignId())
          throw new CapabilityError('stale', false)
        return sessionPlanner.executeCommand(input)
      },
      'sessionPlanner.commandStatus': ({ campaignId, ...input }) => {
        if (campaignId !== dependencies.activeCampaignId())
          throw new CapabilityError('stale', false)
        return sessionPlanner.commandStatus(input)
      },
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
  )
}
