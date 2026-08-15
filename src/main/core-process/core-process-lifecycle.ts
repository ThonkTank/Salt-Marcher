import type { UtilityProcess } from 'electron'
import type { CoreStartupFailureReason } from '../../shared/contracts/core-protocol.js'
import type { CoreProcessStatus } from '../../shared/contracts/runtime.js'

export type RestartTerminationReason =
  | 'ready-timeout'
  | 'request-timeout'
  | 'send-failed'
  | 'protocol-violation'
  | 'e2e-probe'

export type CoreLifecycleState =
  | Readonly<{
      phase: 'starting' | 'ready'
      generation: number
      child: UtilityProcess
    }>
  | Readonly<{
      phase: 'terminating'
      generation: number
      child: UtilityProcess
      disposition: 'restart' | 'terminal' | 'closed'
      reason: RestartTerminationReason | CoreStartupFailureReason | 'shutdown'
    }>
  | Readonly<{
      phase: 'backing-off'
      generation: number
      attempt: number
    }>
  | Readonly<{ phase: 'unavailable'; generation: number }>
  | Readonly<{
      phase: 'terminal'
      generation: number
      reason: Exclude<CoreStartupFailureReason, 'internal'>
    }>
  | Readonly<{
      phase: 'closing'
      generation: number
      child?: UtilityProcess
    }>
  | Readonly<{ phase: 'closed'; generation: number }>

export function lifecycleChild(
  state: CoreLifecycleState
): UtilityProcess | undefined {
  switch (state.phase) {
    case 'starting':
    case 'ready':
    case 'terminating':
      return state.child
    case 'closing':
      return state.child
    default:
      return undefined
  }
}

export function acceptsCoreMessage(
  state: CoreLifecycleState,
  generation: number,
  child: UtilityProcess
): boolean {
  return (
    state.generation === generation &&
    lifecycleChild(state) === child &&
    state.phase !== 'terminating' &&
    state.phase !== 'closed'
  )
}

export function publicCoreStatus(state: CoreLifecycleState): CoreProcessStatus {
  switch (state.phase) {
    case 'starting':
      return state.generation === 1 ? 'starting' : 'recovering'
    case 'ready':
      return 'ready'
    case 'terminating':
      return state.disposition === 'terminal'
        ? terminalStatus(state.reason)
        : state.disposition === 'closed'
          ? 'closed'
          : 'recovering'
    case 'backing-off':
      return 'recovering'
    case 'unavailable':
      return 'unavailable'
    case 'terminal':
      return terminalStatus(state.reason)
    case 'closing':
      return state.child === undefined ? 'closed' : 'ready'
    case 'closed':
      return 'closed'
  }
}

function terminalStatus(
  reason: RestartTerminationReason | CoreStartupFailureReason | 'shutdown'
): CoreProcessStatus {
  switch (reason) {
    case 'incompatible-data':
      return 'incompatible-data'
    case 'corrupt-data':
      return 'corrupt-data'
    case 'access-denied':
      return 'access-denied'
    case 'resource-missing':
      return 'resource-missing'
    case 'invalid-configuration':
      return 'invalid-configuration'
    default:
      return 'unavailable'
  }
}
