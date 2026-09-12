/** Translate operating-system codes before errors cross a process boundary. */
export function maintenanceFilesystemErrorText(cause: unknown): string | null {
  if (!(cause instanceof Error) || !('code' in cause)) return null
  if (cause.code === 'ENOSPC' || cause.code === 'EDQUOT')
    return 'Nicht genug freier Speicherplatz. Gib Speicherplatz frei und versuche den Vorgang erneut.'
  if (cause.code === 'EACCES' || cause.code === 'EPERM')
    return 'Der Zugriff auf die Profildaten oder Sicherungen wurde verweigert. Prüfe die Zugriffsrechte und versuche den Vorgang erneut.'
  return null
}
