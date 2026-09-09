import type { SessionPlannerPort } from './use-session-planner-ports.js'
import { isPreparationTerminal } from './preparation-status-model.js'
import type { PlannerPreparationMaintenanceStatus } from '../../../shared/contracts/session-planner.js'

/** Terminal receipts, rather than a cancel acknowledgement, define quiescence. */
export async function settlePlannerPreparations(options: {
  planner: Pick<
    SessionPlannerPort,
    'preparationMaintenanceStatus' | 'cancelPreparationForMaintenance'
  >
  choice: 'save' | 'discard'
  operationIds: readonly string[]
  observed: (
    operations: PlannerPreparationMaintenanceStatus['operations']
  ) => void
  now?: () => number
  pause?: () => Promise<void>
}): Promise<PlannerPreparationMaintenanceStatus['workspace']> {
  const now = options.now ?? Date.now
  const pause =
    options.pause ??
    (() => new Promise<void>((resolve) => setTimeout(resolve, 250)))
  const deadline = now() + 30_000
  const known = new Set(options.operationIds)
  const canceled = new Set<string>()
  for (;;) {
    const status = await options.planner.preparationMaintenanceStatus([
      ...known
    ])
    for (const operationId of known)
      if (
        !status.operations.some(
          (operation) => operation.operationId === operationId
        )
      )
        throw new Error(
          'Der Vorbereitungsstatus ist unvollständig. Bitte die Wartung erneut versuchen.'
        )
    for (const operation of status.operations) known.add(operation.operationId)
    options.observed(status.operations)
    const active = status.operations.filter(
      ({ receipt }) => receipt && !isPreparationTerminal(receipt.status)
    )
    if (active.length === 0) return status.workspace
    if (options.choice === 'discard') {
      for (const { operationId } of active) {
        if (canceled.has(operationId)) continue
        await options.planner.cancelPreparationForMaintenance(operationId)
        canceled.add(operationId)
      }
    }
    if (now() >= deadline)
      throw new Error(
        'Die Sitzungsvorbereitung ist noch nicht abgeschlossen. Bitte warten und die Wartung erneut versuchen.'
      )
    await pause()
  }
}
