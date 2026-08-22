import type { SaltMarcherApi } from '../../shared/contracts/capability-api.js'
import {
  capabilityErrorCodes,
  type CapabilityErrorCode
} from '../../shared/errors/capability-error-code.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type { CapabilityIssue } from '../../shared/errors/capability-issue.js'

const capabilityErrorCodeSet = new Set<string>(capabilityErrorCodes)

export function createCapabilityApi(
  bridge: Readonly<Record<string, unknown>>
): SaltMarcherApi {
  return freezeDeep(wrapObject(bridge)) as SaltMarcherApi
}

let cachedCapabilityApi: SaltMarcherApi | undefined

export function capabilityApi(): SaltMarcherApi {
  return (cachedCapabilityApi ??= createCapabilityApi(window.saltMarcherBridge))
}

function wrapObject(
  value: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, wrapValue(child)])
  )
}

function wrapValue(value: unknown): unknown {
  if (typeof value === 'function')
    return (...arguments_: unknown[]) => {
      const returned = (value as (...values: unknown[]) => unknown)(
        ...arguments_
      )
      return isPromiseLike(returned)
        ? Promise.resolve(returned).then(unwrapResult)
        : returned
    }
  if (value !== null && typeof value === 'object')
    return wrapObject(value as Readonly<Record<string, unknown>>)
  return value
}

function unwrapResult(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object')
    throw new CapabilityError('protocol_violation', false)
  const result = raw as Record<string, unknown>
  if (result['ok'] === true && 'payload' in result)
    return freezeDeep(result['payload'])
  if (result['ok'] !== false || !isCapabilityFailure(result['error']))
    throw new CapabilityError('protocol_violation', false)
  const error = result['error']
  throw new CapabilityError(error.code, error.retryable, error.issues ?? [])
}

function isCapabilityFailure(value: unknown): value is {
  code: CapabilityErrorCode
  retryable: boolean
  issues?: readonly CapabilityIssue[]
} {
  if (value === null || typeof value !== 'object') return false
  const failure = value as Record<string, unknown>
  return (
    typeof failure['code'] === 'string' &&
    capabilityErrorCodeSet.has(failure['code']) &&
    typeof failure['retryable'] === 'boolean' &&
    (failure['issues'] === undefined || Array.isArray(failure['issues']))
  )
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'then' in value &&
    typeof value.then === 'function'
  )
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
  return value
}
