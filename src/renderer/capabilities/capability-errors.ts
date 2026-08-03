import { capabilityErrorCode } from '../../shared/errors/capability-error.js'
import { capabilityErrorMessage } from '../i18n/messages.de.js'

/**
 * Mutations with an unknown outcome trigger readback through the composition
 * root. The original command is never replayed.
 */
export function capabilityErrorText(cause: unknown): string {
  if (capabilityErrorCode(cause) === 'outcome_unknown')
    window.dispatchEvent(new Event('saltmarcher:readback'))
  return capabilityErrorMessage(cause)
}

export function reportCapabilityError(
  setError: (message: string) => void
): (cause: unknown) => void {
  return (cause) => setError(capabilityErrorText(cause))
}
