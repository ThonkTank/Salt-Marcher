import type {
  AsyncCommandCoordinator,
  AsyncCommandOutcome
} from '../../async/async-command-coordinator.js'

const hexWriteScope = 'hex.write'

export function queueHexCommand<Value>(
  coordinator: AsyncCommandCoordinator,
  entityKey: `campaign:${string}` | `map:${string}`,
  execute: () => Promise<Value>,
  accept?: (value: Value) => unknown
): Promise<AsyncCommandOutcome<Value>> {
  const command = {
    scope: hexWriteScope,
    entityKey,
    mode: 'queue' as const,
    execute
  }
  return coordinator.run(
    accept ? { ...command, accept: (value) => accept(value) } : command
  )
}

export function hexCommandValue<Value>(
  outcome: AsyncCommandOutcome<Value>
): Value | undefined {
  return outcome.status === 'success' ? outcome.value : undefined
}

export function requireHexCommandValue<Value>(
  outcome: AsyncCommandOutcome<Value>
): Value {
  if (outcome.status === 'success') return outcome.value
  if (outcome.status === 'failure') throw outcome.cause
  throw new DOMException(
    'Hex command scope is no longer current.',
    'AbortError'
  )
}
