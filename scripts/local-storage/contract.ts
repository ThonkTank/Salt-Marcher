export interface StorageFinding {
  readonly area: 'deployments' | 'backups' | 'audit'
  readonly name: string
  readonly reason: string
}

export interface StorageWarning {
  readonly code: 'backup-count-high' | 'backup-bytes-high'
  readonly message: string
}

export interface ValidDeployment {
  readonly fingerprint: string
  readonly path: string
  readonly builtAt: string
  readonly bytes: number
  readonly manifestSha256: string
  readonly active: boolean
  readonly journalProtected: boolean
  readonly retention: 'keep' | 'delete'
}

export interface ValidBackup {
  readonly name: string
  readonly path: string
  readonly createdAt: string
  readonly bytes: number
  readonly manifestSha256: string
  readonly protectedByRecency: boolean
  readonly protectedByAge: boolean
  readonly pruneEligible: boolean
}

export interface LocalStorageInspection {
  readonly formatVersion: 1
  readonly installationRoot: string
  readonly activeDeploymentFingerprint: string | null
  readonly deployments: readonly ValidDeployment[]
  readonly backups: readonly ValidBackup[]
  readonly backupEntryCount: number
  readonly backupBytes: number
  readonly findings: readonly StorageFinding[]
  readonly warnings: readonly StorageWarning[]
}

export interface DeploymentRetentionResult {
  readonly activeDeploymentFingerprint: string
  readonly retainedDeploymentFingerprints: readonly string[]
  readonly deletedDeploymentFingerprints: readonly string[]
  readonly releasedBytes: number
  readonly findings: readonly StorageFinding[]
  readonly warnings: readonly StorageWarning[]
}

export interface AuditRetentionResult {
  readonly retainedInvocations: number
  readonly removedInvocations: number
  readonly removedAttemptFiles: readonly string[]
  readonly findings: readonly StorageFinding[]
}

export interface StorageRetentionReceipt {
  readonly formatVersion: 1
  readonly applicationSha: string
  readonly createdAt: string
  readonly deployment: DeploymentRetentionResult
  readonly audit: AuditRetentionResult
}

export interface BackupPruneResult {
  readonly backup: string
  readonly manifestSha256: string | null
  readonly dryRun: boolean
  readonly deleted: boolean
  readonly releasedBytes: number
  readonly refusal: string | null
}

export const deploymentFingerprintPattern = /^[a-f0-9]{64}$/
export const sha256Pattern = /^[a-f0-9]{64}$/
export const backupCountWarningThreshold = 50
export const backupBytesWarningThreshold = 1024 ** 3
export const retainedInactiveDeployments = 2
export const retainedRecentBackups = 5
export const minimumBackupAgeMs = 30 * 24 * 60 * 60 * 1000
export const retainedTerminalAuditEntries = 100
