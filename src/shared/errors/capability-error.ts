import {
  capabilityErrorCodes,
  type CapabilityErrorCode
} from './capability-error-code.js'
import type { CapabilityIssue } from './capability-issue.js'

const capabilityErrorCodeSet = new Set<string>(capabilityErrorCodes)

export class CapabilityError extends Error {
  public constructor(
    public readonly code: CapabilityErrorCode,
    public readonly retryable: boolean,
    public readonly issues: readonly CapabilityIssue[] = []
  ) {
    super(code)
    this.name = 'CapabilityError'
    this.issues = Object.freeze(
      issues.map((issue) =>
        Object.freeze({
          ...issue,
          path: Object.freeze([...issue.path]),
          parameters: Object.freeze({ ...issue.parameters })
        })
      )
    )
  }
}

export function capabilityErrorIssues(
  error: unknown
): readonly CapabilityIssue[] {
  return error instanceof CapabilityError ? error.issues : []
}

export function capabilityErrorCode(
  error: unknown
): CapabilityErrorCode | null {
  if (error instanceof CapabilityError) return error.code
  if (error === null || typeof error !== 'object') return null
  const candidate = error as { code?: unknown; message?: unknown }
  for (const value of [candidate.code, candidate.message])
    if (typeof value === 'string' && capabilityErrorCodeSet.has(value))
      return value as CapabilityErrorCode
  return null
}
