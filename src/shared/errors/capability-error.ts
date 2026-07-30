import type { CapabilityErrorCode } from '../contracts/campaign.js'

export class CapabilityError extends Error {
  public constructor(
    public readonly code: CapabilityErrorCode,
    public readonly retryable: boolean
  ) {
    super(code)
    this.name = 'CapabilityError'
  }
}
