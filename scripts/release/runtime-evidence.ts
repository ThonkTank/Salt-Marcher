import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { historicalResponseSchema } from '../qualification/historical-runtime/contract.js'
import { verifyReleaseInspectionReport } from '../qualification/release-inspection-evidence.js'
import type { UpdateArtifact } from '../qualification/update-artifact.js'

const operationSchema = z.enum(['seed', 'read', 'identity'])
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const common = {
  formatVersion: z.literal(1),
  requestId: z.uuid(),
  operation: operationSchema,
  artifactSha256: digest,
  sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
  resultSha256: digest,
  exitCode: z.literal(0),
  result: z.unknown()
}
const historical = z
  .object({ ...common, interruption: z.null(), receiptSha256: digest })
  .strict()
const release = z
  .object({
    ...common,
    artifactKind: z.literal('release'),
    manifestSha256: digest
  })
  .strict()

/** Checks embedded reports; the artifact argument must already have trusted file provenance. */
export function verifyRuntimeEvidence(
  raw: unknown,
  artifact: UpdateArtifact,
  operation: z.infer<typeof operationSchema>
): unknown {
  const value =
    artifact.kind === 'release' ? release.parse(raw) : historical.parse(raw)
  assert.equal(value.operation, operation, 'Wrong runtime operation')
  assert.equal(
    value.artifactSha256,
    artifact.manifest.artifact.sha256,
    'Wrong runtime AppImage'
  )
  assert.equal(
    value.sourceCommit,
    artifact.manifest.commit,
    'Wrong runtime commit'
  )
  // Both fixture and release inspection entries write compact JSON without a newline.
  assert.equal(
    createHash('sha256').update(JSON.stringify(value.result)).digest('hex'),
    value.resultSha256,
    'Embedded runtime result differs from its original document hash'
  )
  if (artifact.kind === 'release') {
    const envelope = release.parse(value)
    assert.equal(
      envelope.manifestSha256,
      artifact.provenance.manifestSha256,
      'Wrong runtime manifest'
    )
    assert(
      operation !== 'seed',
      'A shipped release cannot seed historical fixture data'
    )
    const report = verifyReleaseInspectionReport(
      envelope.result,
      artifact.manifest,
      {
        requestId: envelope.requestId,
        operation,
        profile: '/validated-report-only'
      },
      envelope.exitCode
    )
    assert(report.response.ok, 'Failed release runtime response')
    if (operation === 'identity') {
      const identity = z
        .object({ electronVersion: z.string() })
        .parse(report.response.result)
      assert.equal(
        identity.electronVersion,
        report.build.toolchain.electron,
        'Runtime Electron differs from embedded toolchain'
      )
    }
    return report.response.result
  }
  const envelope = historical.parse(value)
  assert.equal(
    envelope.receiptSha256,
    artifact.provenance.receiptSha256,
    'Wrong historical runtime receipt'
  )
  const report = z
    .object({
      formatVersion: z.literal(1),
      artifactVersion: z.string(),
      operation: operationSchema,
      response: historicalResponseSchema
    })
    .strict()
    .parse(envelope.result)
  assert.equal(
    report.artifactVersion,
    artifact.manifest.version,
    'Wrong historical runtime version'
  )
  assert.equal(report.operation, operation, 'Wrong historical result operation')
  assert.equal(
    report.response.requestId,
    envelope.requestId,
    'Wrong historical result request'
  )
  assert(report.response.ok, 'Failed historical runtime response')
  return report.response.result
}
