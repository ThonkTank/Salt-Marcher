import assert from 'node:assert/strict'
import { join } from 'node:path'
import { z } from 'zod'
import { inspectReleaseFile } from './bundle.js'
import {
  qualificationEnvironment,
  verifyEnvironmentFile
} from './qualification-environment.js'

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const file = z
  .object({
    path: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)+$/)
      .refine(
        (value) =>
          !value.split('/').some((part) => part === '..' || part === '.')
      ),
    bytes: z
      .number()
      .int()
      .nonnegative()
      .max(64 * 1024 * 1024),
    sha256: hash
  })
  .strict()
export const preparedEnvironmentSchema = z
  .object({
    formatVersion: z.literal(1),
    environment: z.unknown(),
    engine: z.enum(['podman', 'docker']),
    toolImageId: z.string().regex(/^(sha256:)?[a-f0-9]{64}$/),
    bootstrapSha256: hash,
    prepared: z
      .object({
        name: z.literal('prepared-guest.qcow2'),
        bytes: z
          .number()
          .int()
          .positive()
          .max(32 * 1024 ** 3),
        sha256: hash
      })
      .strict(),
    evidence: z
      .object({
        formatVersion: z.literal(1),
        coverage: z.literal('guest-bootstrap-only-no-application-test'),
        hostBootId: z.uuid(),
        guestBootId: z.uuid(),
        kernel: z.string().min(1),
        packages: z.string().min(1)
      })
      .strict(),
    archive: z
      .object({
        formatVersion: z.literal(1),
        evidence: z.literal(
          'transport-integrity-only-semantic-acceptance-not-verified'
        ),
        source: z.string().min(1),
        vmExitCode: z.literal(0),
        testExitCodes: z.tuple([z.literal(0)]),
        serialSha256: hash,
        files: z.array(file).min(2).max(20)
      })
      .strict()
  })
  .strict()

/** Local preparation receipt, not a substitute for authenticated release workflow provenance. */
export function verifyPreparedEnvironment(
  directory: string,
  bootstrap: string
) {
  const read = (path: string) =>
    inspectReleaseFile(path, 4 * 1024 * 1024, true).content
  const receipt = preparedEnvironmentSchema.parse(
    JSON.parse(
      read(join(directory, 'prepared-environment.json')).toString('utf8')
    )
  )
  assert.deepEqual(
    receipt.environment,
    qualificationEnvironment,
    'Prepared environment uses different pinned inputs'
  )
  assert.equal(
    inspectReleaseFile(bootstrap, 1024 * 1024, false).sha256,
    receipt.bootstrapSha256,
    'Bootstrap source changed'
  )
  assert.notEqual(receipt.evidence.hostBootId, receipt.evidence.guestBootId)
  assert.equal(
    new Set(receipt.archive.files.map((item) => item.path)).size,
    receipt.archive.files.length
  )
  const archive = join(directory, 'bootstrap-evidence')
  assert.deepEqual(
    JSON.parse(read(join(archive, 'archive-manifest.json')).toString('utf8')),
    receipt.archive
  )
  for (const item of receipt.archive.files)
    verifyEnvironmentFile(join(archive, item.path), item)
  assert.deepEqual(
    JSON.parse(
      read(join(archive, 'export-0/reports/bootstrap-evidence.json')).toString(
        'utf8'
      )
    ),
    receipt.evidence
  )
  for (const name of [
    'libgtk-3-0t64',
    'libnss3',
    'xvfb',
    'xdotool',
    'dbus-x11'
  ])
    assert(
      receipt.evidence.packages
        .split('\n')
        .some(
          (line) => line.startsWith(`${name}\t`) || line.startsWith(`${name}:`)
        ),
      `Missing guest package ${name}`
    )
  assert.equal(
    inspectReleaseFile(
      join(directory, 'bootstrap-run/serial.log'),
      64 * 1024 * 1024,
      false
    ).sha256,
    receipt.archive.serialSha256
  )
  verifyEnvironmentFile(
    join(directory, receipt.prepared.name),
    receipt.prepared
  )
  return receipt
}
