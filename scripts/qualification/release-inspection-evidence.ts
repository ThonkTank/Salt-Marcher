import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { buildInfoSchema } from '../../src/shared/contracts/build-info.js'
import {
  releaseInspectionRequestSchema,
  releaseInspectionResponseSchema
} from '../../src/shared/contracts/release-qualification.js'
import {
  releaseManifestSchema,
  releaseVersionSchema,
  type ReleaseManifest
} from '../../src/shared/contracts/release.js'

const reportSchema = z
  .object({
    formatVersion: z.literal(1),
    artifactVersion: releaseVersionSchema,
    build: buildInfoSchema,
    operation: releaseInspectionRequestSchema.shape.operation,
    response: releaseInspectionResponseSchema
  })
  .strict()
export function verifyReleaseInspectionReport(
  raw: unknown,
  manifest: ReleaseManifest,
  request: z.infer<typeof releaseInspectionRequestSchema>,
  exitCode: number | null
) {
  const result = reportSchema.parse(raw)
  if (
    result.artifactVersion !== manifest.version ||
    result.build.channel !== 'release' ||
    result.build.dirty ||
    result.build.commit !== manifest.commit ||
    !isDeepStrictEqual(result.build.schemaVersions, manifest.schemaVersions) ||
    result.operation !== request.operation ||
    result.response.requestId !== request.requestId ||
    exitCode !== (result.response.ok ? 0 : 1)
  )
    throw new Error(
      'Release inspection does not prove the requested target bytes and invocation.'
    )
  if (request.operation === 'identity' && result.response.ok) {
    const identity = z
      .object({
        schemaVersions: releaseManifestSchema.shape.schemaVersions,
        nodeVersion: z.string().min(1),
        electronVersion: z.string().min(1)
      })
      .parse(result.response.result)
    if (!isDeepStrictEqual(identity.schemaVersions, manifest.schemaVersions))
      throw new Error(
        'Release Utility schema identity differs from its manifest.'
      )
  }
  return result
}
