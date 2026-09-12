import { loadBuildInfo } from '../application-lifecycle/build-info.js'
import { app, utilityProcess } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { acquireProfileAccess } from '../local-profile/profile-access.js'
import { outputPath } from '../application-lifecycle/runtime-paths.js'
import {
  releaseInspectionRequestSchema,
  releaseInspectionResponseSchema
} from '../../shared/contracts/release-qualification.js'
import { releaseQualificationContext } from '../../shared/maintenance/release-qualification-context.js'

export async function runReleaseInspection(): Promise<void> {
  const context = releaseQualificationContext()
  const build = loadBuildInfo()
  if (!build || build.channel !== 'release' || build.dirty)
    throw new Error(
      'Inspection requires an embedded clean release build identity.'
    )
  const index = process.argv.indexOf('--release-profile-inspection')
  const request = releaseInspectionRequestSchema.parse({
    requestId: process.argv[index + 2],
    operation: process.argv[index + 1],
    profile: context.profile
  })
  mkdirSync(context.reports, { recursive: true })
  app.setPath('userData', join(context.reports, 'electron'))
  app.setPath('sessionData', join(context.reports, 'electron'))
  await app.whenReady()
  const access = acquireProfileAccess(context.profile, 'application')
  try {
    const response = await new Promise<
      ReturnType<typeof releaseInspectionResponseSchema.parse>
    >((resolve, reject) => {
      const worker = utilityProcess.fork(
        outputPath('main', 'release-inspection.js'),
        [],
        { serviceName: 'SaltMarcher Releaseprüfung' }
      )
      let response:
        ReturnType<typeof releaseInspectionResponseSchema.parse> | undefined
      let failure: Error | undefined
      const timeout = setTimeout(() => {
        failure = new Error('Release inspection exceeded its deadline.')
        worker.kill()
      }, 120_000)
      worker.once('spawn', () => worker.postMessage(request))
      worker.once('message', (raw: unknown) => {
        try {
          response = releaseInspectionResponseSchema.parse(raw)
          if (response.requestId !== request.requestId)
            throw new Error('Inspection response belongs to another request.')
        } catch (error) {
          failure =
            error instanceof Error
              ? error
              : new Error('Invalid inspection response.')
        }
        worker.kill()
      })
      worker.once('exit', () => {
        clearTimeout(timeout)
        if (failure) reject(failure)
        else if (!response)
          reject(new Error('Inspection worker exited without evidence.'))
        else resolve(response)
      })
    })
    writeFileSync(
      join(context.reports, `${request.requestId}.json`),
      JSON.stringify({
        formatVersion: 1,
        artifactVersion: app.getVersion(),
        build,
        operation: request.operation,
        response
      }),
      { flag: 'wx' }
    )
    if (!response.ok) throw new Error(response.message)
  } finally {
    access.release()
    app.quit()
  }
}
