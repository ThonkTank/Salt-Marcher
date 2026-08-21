import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import type { LocalInstallationPaths } from '../local-installation/contract.js'
import { withInstallationLock } from '../local-installation/installation-lock.js'
import { applyAuditRetention } from './audit-retention.js'
import {
  deploymentFingerprintPattern,
  type DeploymentRetentionResult,
  type StorageRetentionReceipt
} from './contract.js'
import { atomicWrite, syncDirectory } from './filesystem.js'
import { evacuateCompatibility } from './compatibility-evacuation.js'
import {
  inspectLocalStorage,
  validateDeploymentDirectory
} from './inspection.js'

export interface ApplyStorageRetentionOptions {
  readonly paths: LocalInstallationPaths
  readonly iconSourcePath: string
  readonly receiptDirectory: string
  readonly applicationSha: string
  readonly now?: () => Date
  readonly removeDirectory?: (path: string) => void
  readonly removeAuditFile?: (path: string) => void
}

const findingSchema = z
  .object({
    area: z.enum(['deployments', 'backups', 'audit', 'compatibility']),
    name: z.string(),
    reason: z.string()
  })
  .strict()
const warningSchema = z
  .object({
    code: z.enum(['backup-count-high', 'backup-bytes-high']),
    message: z.string()
  })
  .strict()
const deploymentResultSchema = z
  .object({
    activeDeploymentFingerprint: z.string().regex(deploymentFingerprintPattern),
    retainedDeploymentFingerprints: z.array(
      z.string().regex(deploymentFingerprintPattern)
    ),
    deletedDeploymentFingerprints: z.array(
      z.string().regex(deploymentFingerprintPattern)
    ),
    releasedBytes: z.number().int().nonnegative(),
    findings: z.array(findingSchema),
    warnings: z.array(warningSchema)
  })
  .strict()
const progressSchema = z
  .object({
    formatVersion: z.literal(1),
    applicationSha: z.string().regex(/^[a-f0-9]{40}$/),
    deployment: deploymentResultSchema
  })
  .strict()
const receiptSchema = progressSchema
  .extend({
    createdAt: z.iso.datetime(),
    audit: z
      .object({
        retainedInvocations: z.number().int().nonnegative(),
        removedInvocations: z.number().int().nonnegative(),
        removedAttemptFiles: z.array(z.string()),
        findings: z.array(findingSchema)
      })
      .strict(),
    compatibility: z
      .object({
        formatVersion: z.literal(1),
        artifacts: z.array(
          z
            .object({
              area: z.enum([
                'profile',
                'backup',
                'deployment',
                'install-journal',
                'handoff-state',
                'handoff-history'
              ]),
              name: z.string(),
              path: z.string(),
              status: z.enum([
                'current',
                'migratable',
                'legacy-reader-required',
                'unknown-invalid'
              ]),
              format: z.string(),
              applicationReachable: z.boolean(),
              reason: z.string()
            })
            .strict()
        ),
        reachableLegacyCount: z.number().int().nonnegative(),
        reachableNonCurrentCount: z.number().int().nonnegative(),
        unknownInvalidCount: z.number().int().nonnegative()
      })
      .strict()
  })
  .strict()

export function applyStorageRetention(
  options: ApplyStorageRetentionOptions
): StorageRetentionReceipt {
  if (!/^[a-f0-9]{40}$/.test(options.applicationSha))
    throw new Error('Storage retention requires an exact application SHA')
  return withInstallationLock(options.paths, () => {
    const progressPath = join(
      options.receiptDirectory,
      'storage-retention-progress.json'
    )
    evacuateCompatibility(options)
    const prior = readProgress(progressPath, options.applicationSha)
    const current = applyDeploymentRetention({
      ...options,
      onProgress: (deployment) =>
        atomicWrite(
          progressPath,
          `${JSON.stringify(
            {
              formatVersion: 1,
              applicationSha: options.applicationSha,
              deployment: combineDeploymentResults(prior, deployment)
            },
            null,
            2
          )}\n`
        )
    })
    const deployment = combineDeploymentResults(prior, current)
    atomicWrite(
      progressPath,
      `${JSON.stringify(
        {
          formatVersion: 1,
          applicationSha: options.applicationSha,
          deployment
        },
        null,
        2
      )}\n`
    )
    const audit = applyAuditRetention({
      receiptDirectory: options.receiptDirectory,
      ...(options.removeAuditFile === undefined
        ? {}
        : { removeFile: options.removeAuditFile })
    })
    const compatibility = inspectLocalStorage(options).compatibility
    if (compatibility.reachableNonCurrentCount !== 0)
      throw new Error(
        `Storage retention left ${compatibility.reachableNonCurrentCount} application-reachable non-current artifact(s)`
      )
    const receipt = receiptSchema.parse({
      formatVersion: 1,
      applicationSha: options.applicationSha,
      createdAt: (options.now ?? (() => new Date()))().toISOString(),
      deployment,
      audit,
      compatibility
    })
    atomicWrite(
      storageRetentionReceiptPath(options.receiptDirectory),
      `${JSON.stringify(receipt, null, 2)}\n`
    )
    return receipt
  })
}

export function collectStorageRetentionReceipt(
  options: Omit<
    ApplyStorageRetentionOptions,
    'removeDirectory' | 'removeAuditFile'
  >
): StorageRetentionReceipt {
  const receipt = receiptSchema.parse(
    JSON.parse(
      readFileSync(
        storageRetentionReceiptPath(options.receiptDirectory),
        'utf8'
      )
    )
  )
  if (receipt.applicationSha !== options.applicationSha)
    throw new Error('Storage-retention receipt proves another application SHA')
  const inspection = inspectLocalStorage(options)
  if (inspection.activeDeploymentFingerprint === null)
    throw new Error('Storage-retention receipt has no valid active deployment')
  if (inspection.deployments.some(({ retention }) => retention === 'delete'))
    throw new Error('Storage-retention receipt is stale; pruning remains')
  const retained = inspection.deployments
    .map(({ fingerprint }) => fingerprint)
    .sort()
  if (
    JSON.stringify(retained) !==
    JSON.stringify(
      [...receipt.deployment.retainedDeploymentFingerprints].sort()
    )
  )
    throw new Error('Retained deployment evidence differs from local storage')
  for (const fingerprint of receipt.deployment.deletedDeploymentFingerprints)
    if (existsSync(join(options.paths.deployments, fingerprint)))
      throw new Error(`Deleted deployment is present again: ${fingerprint}`)
  if (inspection.compatibility.reachableNonCurrentCount !== 0)
    throw new Error(
      'Storage-retention receipt is stale; non-current storage remains reachable'
    )
  if (
    JSON.stringify(inspection.compatibility) !==
    JSON.stringify(receipt.compatibility)
  )
    throw new Error('Compatibility evidence differs from local storage')
  return receipt
}

export function applyDeploymentRetention(
  options: ApplyStorageRetentionOptions & {
    readonly onProgress?: (result: DeploymentRetentionResult) => void
  }
): DeploymentRetentionResult {
  const first = inspectLocalStorage(options)
  if (first.activeDeploymentFingerprint === null)
    throw new Error(
      'Automatic deployment pruning requires a valid active deployment'
    )
  const deleted: string[] = []
  let releasedBytes = 0
  const removeDirectory =
    options.removeDirectory ??
    ((path: string) => rmSync(path, { recursive: true, force: false }))

  for (const candidate of first.deployments.filter(
    ({ retention }) => retention === 'delete'
  )) {
    const live = inspectLocalStorage(options).deployments.find(
      ({ fingerprint }) => fingerprint === candidate.fingerprint
    )
    if (
      live === undefined ||
      live.retention !== 'delete' ||
      live.manifestSha256 !== candidate.manifestSha256 ||
      live.bytes !== candidate.bytes
    )
      throw new Error(
        `Deployment changed before pruning: ${candidate.fingerprint}`
      )
    const validated = validateDeploymentDirectory(
      candidate.path,
      candidate.fingerprint,
      options.iconSourcePath
    )
    if (
      validated.manifestSha256 !== candidate.manifestSha256 ||
      validated.bytes !== candidate.bytes
    )
      throw new Error(
        `Deployment ownership changed before pruning: ${candidate.fingerprint}`
      )
    removeDirectory(candidate.path)
    if (existsSync(candidate.path))
      throw new Error(
        `Deployment removal was incomplete: ${candidate.fingerprint}`
      )
    deleted.push(candidate.fingerprint)
    releasedBytes += candidate.bytes
    options.onProgress?.(
      deploymentResult(first, deleted, releasedBytes, options)
    )
  }
  if (deleted.length > 0) syncDirectory(options.paths.deployments)
  return deploymentResult(first, deleted, releasedBytes, options)
}

function deploymentResult(
  initial: ReturnType<typeof inspectLocalStorage>,
  deleted: readonly string[],
  releasedBytes: number,
  options: ApplyStorageRetentionOptions
): DeploymentRetentionResult {
  const final = inspectLocalStorage(options)
  if (
    final.activeDeploymentFingerprint === null ||
    final.activeDeploymentFingerprint !== initial.activeDeploymentFingerprint
  )
    throw new Error('Active deployment changed during storage retention')
  return {
    activeDeploymentFingerprint: final.activeDeploymentFingerprint,
    retainedDeploymentFingerprints: final.deployments.map(
      ({ fingerprint }) => fingerprint
    ),
    deletedDeploymentFingerprints: [...deleted],
    releasedBytes,
    findings: final.findings,
    warnings: final.warnings
  }
}

function readProgress(
  path: string,
  applicationSha: string
): DeploymentRetentionResult | null {
  if (!existsSync(path)) return null
  const progress = progressSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
  return progress.applicationSha === applicationSha ? progress.deployment : null
}

function combineDeploymentResults(
  prior: DeploymentRetentionResult | null,
  current: DeploymentRetentionResult
): DeploymentRetentionResult {
  if (prior === null) return current
  if (prior.activeDeploymentFingerprint !== current.activeDeploymentFingerprint)
    throw new Error(
      'Storage-retention progress names another active deployment'
    )
  return {
    ...current,
    deletedDeploymentFingerprints: [
      ...new Set([
        ...prior.deletedDeploymentFingerprints,
        ...current.deletedDeploymentFingerprints
      ])
    ],
    releasedBytes: prior.releasedBytes + current.releasedBytes
  }
}

export function storageRetentionReceiptPath(receiptDirectory: string): string {
  return join(receiptDirectory, 'storage-retention-receipt.json')
}
