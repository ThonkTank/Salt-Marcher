import { databaseSchemaVersions } from '../../core/persistence/sqlite/database.js'
import {
  releaseInspectionRequestSchema,
  releaseInspectionResponseSchema
} from '../../shared/contracts/release-qualification.js'
import { releaseQualificationContext } from '../../shared/maintenance/release-qualification-context.js'
import { readReleaseQualificationProfile } from './profile.js'

process.parentPort?.on('message', (event) => {
  const request = releaseInspectionRequestSchema.parse(event.data)
  try {
    const context = releaseQualificationContext()
    if (request.profile !== context.profile)
      throw new Error('Inspection profile escaped its isolated context.')
    const result =
      request.operation === 'identity'
        ? {
            schemaVersions: databaseSchemaVersions,
            nodeVersion: process.versions.node,
            electronVersion: process.versions.electron
          }
        : readReleaseQualificationProfile(request.profile)
    process.parentPort?.postMessage(
      releaseInspectionResponseSchema.parse({
        ok: true,
        requestId: request.requestId,
        result
      })
    )
  } catch (error) {
    process.parentPort?.postMessage(
      releaseInspectionResponseSchema.parse({
        ok: false,
        requestId: request.requestId,
        message:
          error instanceof Error ? error.message : 'Release inspection failed.'
      })
    )
  }
})
