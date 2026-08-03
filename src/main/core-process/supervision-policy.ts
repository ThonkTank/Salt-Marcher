import type { CoreRequest } from '../../shared/contracts/core-protocol.js'
import { coreOperations } from '../../shared/contracts/operations.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'

export type CoreOperationMode = 'read' | 'write'

export function coreOperationMode(
  kind: CoreRequest['kind']
): CoreOperationMode {
  return coreOperations[kind].mode
}

export function interruptedOperationError(
  mode: CoreOperationMode,
  reason: 'timeout' | 'exit'
): CapabilityError {
  if (mode === 'write') return new CapabilityError('outcome_unknown', false)
  return new CapabilityError(
    reason === 'timeout' ? 'timeout' : 'core_unavailable',
    true
  )
}

export function coreRestartDelay(crashCount: number): number | null {
  return [100, 500, 2_000][crashCount - 1] ?? null
}
