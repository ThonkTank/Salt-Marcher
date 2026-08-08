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

const locallyExpectedCodes = new Set([
  'validation_failed',
  'stale',
  'not_found',
  'read_only'
])

/** Presents every failure locally and reports only unexpected failures once. */
export function presentCapabilityError(
  cause: unknown,
  reportUnexpected: (message: string) => void
): string {
  const text = capabilityErrorText(cause)
  const code = capabilityErrorCode(cause)
  if (!code || !locallyExpectedCodes.has(code)) reportUnexpected(text)
  return text
}
