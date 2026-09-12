import {
  CorruptDataError,
  IncompatibleDataError
} from '../../core/persistence/sqlite/database.js'
import { maintenanceFilesystemErrorText } from '../../shared/maintenance/filesystem-error.js'

/** Translate typed failures before the Utility boundary retains only a message. */
export function maintenanceErrorMessage(error: unknown): string {
  if (error instanceof IncompatibleDataError) {
    if (
      error.actualVersion !== undefined &&
      error.actualVersion > error.expectedVersion
    )
      return 'Diese Daten verwenden ein neueres Datenformat. Aktualisiere SaltMarcher oder wähle eine mit dieser App-Version kompatible Sicherung.'
    return 'Für dieses Datenformat fehlt ein vollständiger Migrationspfad. Wähle eine unterstützte Sicherung oder ein anderes Profil.'
  }
  if (error instanceof CorruptDataError)
    return 'Die Profildaten konnten nicht geprüft werden und sind möglicherweise beschädigt. Wähle eine andere geprüfte Sicherung.'
  return (
    maintenanceFilesystemErrorText(error) ??
    (error instanceof Error ? error.message : 'Wartung fehlgeschlagen.')
  )
}
