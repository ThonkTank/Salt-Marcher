import {
  capabilityErrorCodes,
  type CapabilityErrorCode
} from './capability-error-code.js'

const capabilityErrorCodeSet = new Set<string>(capabilityErrorCodes)

export class CapabilityError extends Error {
  public constructor(
    public readonly code: CapabilityErrorCode,
    public readonly retryable: boolean
  ) {
    super(code)
    this.name = 'CapabilityError'
  }
}

export function capabilityErrorCode(
  error: unknown
): CapabilityErrorCode | null {
  if (error instanceof CapabilityError) return error.code
  if (error === null || typeof error !== 'object') return null
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && capabilityErrorCodeSet.has(code)
    ? (code as CapabilityErrorCode)
    : null
}
