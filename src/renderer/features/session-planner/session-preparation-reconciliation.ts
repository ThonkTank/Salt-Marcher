import type { SessionPreparationReceipt } from '../../../shared/contracts/session-planner.js'
import type {
  AsyncCommandCoordinator,
  AsyncCommandOutcome
} from '../../async/async-command-coordinator.js'
import type { PreparationTarget } from './session-preparation-target.js'
import type { SessionPlannerPort } from './use-session-planner-ports.js'

export function reconcileSessionPreparation(options: {
  coordinator: AsyncCommandCoordinator
  planner: SessionPlannerPort
  target: PreparationTarget
  signal: AbortSignal
  acceptReceipt: (receipt: SessionPreparationReceipt) => Promise<void>
}): Promise<
  AsyncCommandOutcome<
    Awaited<ReturnType<SessionPlannerPort['preparationReceipt']>>
  >
> {
  const { acceptReceipt, coordinator, planner, signal, target } = options
  return coordinator.run({
    scope: 'planner.preparation-receipt',
    entityKey: `session:${target.sessionId}`,
    mode: 'latest-only',
    signal,
    execute: () =>
      planner.preparationReceipt({ operationId: target.operationId }),
    accept: async (result) => {
      if (result.receipt) await acceptReceipt(result.receipt)
    }
  })
}
