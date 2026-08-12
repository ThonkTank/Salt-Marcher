import type { SessionPreparationReceipt } from '../../../shared/contracts/session-planner.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'

export type PreparationStage =
  | 'idle'
  | 'confirming-replacement'
  | 'queued'
  | 'generating'
  | 'resolving-encounters'
  | 'saving'
  | 'ready'
  | 'invalid'
  | 'stale'
  | 'canceled'
  | 'failed'

export function isPreparationTerminal(
  status: SessionPreparationReceipt['status']
): boolean {
  return ['succeeded', 'invalid', 'stale', 'failed', 'canceled'].includes(
    status
  )
}

export function preparationStatusMessage(
  receipt: SessionPreparationReceipt
): string {
  if (receipt.failure)
    return formatMessage('planner.preparationFailure', {
      code: receipt.failure.code
    })
  return {
    queued: message('planner.progressQueued'),
    generating: message('planner.progressGenerating'),
    resolving_encounters: message('planner.progressResolving'),
    saving: message('planner.progressSaving'),
    succeeded: message('planner.progressReady'),
    invalid: message('planner.statusInvalid'),
    stale: message('planner.statusStale'),
    failed: message('planner.statusFailed'),
    canceled: message('planner.statusCanceled')
  }[receipt.status]
}

export function preparationStageLabel(stage: PreparationStage): string {
  return {
    idle: message('planner.statusReady'),
    'confirming-replacement': message('planner.statusConfirmation'),
    queued: message('planner.statusQueued'),
    generating: message('planner.statusGenerating'),
    'resolving-encounters': message('planner.statusResolving'),
    saving: message('planner.statusSaving'),
    ready: message('planner.statusReady'),
    invalid: message('planner.statusInvalid'),
    stale: message('planner.statusStale'),
    canceled: message('planner.statusCanceled'),
    failed: message('planner.statusFailed')
  }[stage]
}
