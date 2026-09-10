import { ProfileLockedError } from '../local-profile/local-profile-lock.js'

export function releaseOperationErrorText(cause: unknown): string {
  if (cause instanceof ProfileLockedError)
    return 'Das Profil wird gerade verwendet. Schließe die andere SaltMarcher-Instanz beziehungsweise warte, bis ihre Wartung abgeschlossen ist, und versuche es erneut.'
  if (
    cause instanceof Error &&
    'code' in cause &&
    (cause.code === 'ENOSPC' || cause.code === 'EDQUOT')
  )
    return 'Nicht genug freier Speicherplatz. Gib Speicherplatz frei und versuche den Vorgang erneut.'
  return cause instanceof Error
    ? cause.message
    : 'Vorgang fehlgeschlagen. Bitte erneut versuchen.'
}
