import {
  capabilityErrorCodeSchema,
  type CapabilityErrorCode
} from '../contracts/campaign.js'

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
  const parsed = capabilityErrorCodeSchema.safeParse(code)
  return parsed.success ? parsed.data : null
}
