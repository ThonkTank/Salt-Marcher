export function releaseOperationErrorText(cause: unknown): string {
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
