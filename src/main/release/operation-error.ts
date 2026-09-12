import { maintenanceFilesystemErrorText } from '../../shared/maintenance/filesystem-error.js'
import { ProfileLockedError } from '../local-profile/local-profile-lock.js'

export function releaseOperationErrorText(cause: unknown): string {
  if (cause instanceof ProfileLockedError)
    return 'Das Profil wird gerade verwendet. Schließe die andere SaltMarcher-Instanz beziehungsweise warte, bis ihre Wartung abgeschlossen ist, und versuche es erneut.'
  const filesystemMessage = maintenanceFilesystemErrorText(cause)
  if (filesystemMessage) return filesystemMessage
  return cause instanceof Error
    ? cause.message
    : 'Vorgang fehlgeschlagen. Bitte erneut versuchen.'
}
