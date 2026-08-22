export const localPersistenceFormatVersions = Object.freeze({
  buildReceipt: 2,
  localArtifactManifest: 2,
  campaignLifecycleReceipt: 2,
  localInstallJournal: 2,
  handoffReceipt: 7,
  handoffInvocationHistory: 2,
  candidateArtifactReceipt: 1,
  campaignBackupManifest: 1,
  localProfileLock: 1,
  localStorageInspection: 1,
  localStorageCompatibilityInspection: 1,
  storageRetentionProgress: 1,
  storageRetentionReceipt: 1
} as const)

export type LocalPersistenceContract =
  keyof typeof localPersistenceFormatVersions

export const currentVersionOneLocalPersistenceContracts = Object.freeze(
  (
    Object.entries(localPersistenceFormatVersions) as Array<
      [LocalPersistenceContract, number]
    >
  )
    .filter(([, version]) => version === 1)
    .map(([contract]) => contract)
)

export function assertCurrentLocalPersistenceVersion(
  value: unknown,
  contract: LocalPersistenceContract,
  field: 'formatVersion' | 'schemaVersion' = 'formatVersion'
): void {
  const version =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)[field]
      : undefined
  const expected = localPersistenceFormatVersions[contract]
  if (version !== expected)
    throw new Error(
      `Unsupported ${contract} ${field} ${displayVersion(version)}; expected ${expected}`
    )
}

function displayVersion(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'string')
    return JSON.stringify(value)
  return value === undefined ? '<missing>' : `<${typeof value}>`
}
