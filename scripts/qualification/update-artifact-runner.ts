import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { releaseInspectionRequestSchema } from '../../src/shared/contracts/release-qualification.js'
import { inspectReleaseFile } from '../release/bundle.js'
import { readUpdateArtifact } from './update-artifact.js'
import { assertHistoricalTestIsolation } from './historical-test-isolation.js'
import { historicalOperationSchema } from './historical-runtime/contract.js'
import { runHistoricalArtifact } from './historical-artifact-runner.js'
import { prepareReleaseTestHome } from './release-test-home.js'
import { verifyReleaseInspectionReport } from './release-inspection-evidence.js'
import type { z } from 'zod'

export async function runUpdateArtifact(
  directory: string,
  dataHome: string,
  operation: z.infer<typeof historicalOperationSchema>
) {
  assertHistoricalTestIsolation()
  const artifact = readUpdateArtifact(directory)
  if (artifact.kind === 'historical-fixture')
    return runHistoricalArtifact(directory, dataHome, operation)
  const home = prepareReleaseTestHome(dataHome)
  const request = releaseInspectionRequestSchema.parse({
    requestId: randomUUID(),
    operation,
    profile: join(home.root, 'salt-marcher/profile')
  })
  const reports = join(home.root, 'release-qualification')
  const temporary = join(reports, `${request.requestId}.tmp`)
  mkdirSync(temporary, { recursive: true })
  const log = openSync(join(reports, `${request.requestId}.log`), 'wx')
  let exitCode: number | null
  try {
    exitCode = await new Promise<number | null>((resolve, reject) => {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        ...home.environment,
        TMPDIR: temporary,
        APPIMAGE_EXTRACT_AND_RUN: '1'
      }
      delete env['ELECTRON_RUN_AS_NODE']
      const child = spawn(
        artifact.executable,
        [
          '--no-sandbox',
          '--release-profile-inspection',
          request.operation,
          request.requestId
        ],
        {
          env,
          detached: true,
          stdio: ['ignore', log, log]
        }
      )
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        if (child.pid) {
          try {
            process.kill(-child.pid, 'SIGKILL')
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH')
              reject(error as Error)
          }
        }
      }, 150_000)
      child.once('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
      child.once('exit', (code) => {
        clearTimeout(timer)
        if (timedOut) reject(new Error('Release inspection timed out.'))
        else resolve(code)
      })
    })
  } finally {
    closeSync(log)
  }
  const document = inspectReleaseFile(
    join(reports, `${request.requestId}.json`),
    64 * 1024 * 1024,
    true
  )
  const result = verifyReleaseInspectionReport(
    JSON.parse(document.content.toString('utf8')) as unknown,
    artifact.manifest,
    request,
    exitCode
  )
  const after = readUpdateArtifact(directory)
  if (!isDeepStrictEqual(after, artifact))
    throw new Error('Release target changed during inspection.')
  const evidence = {
    formatVersion: 1,
    artifactKind: 'release' as const,
    requestId: request.requestId,
    operation: request.operation,
    artifactSha256: artifact.manifest.artifact.sha256,
    manifestSha256: artifact.provenance.manifestSha256,
    sourceCommit: artifact.manifest.commit,
    resultSha256: document.sha256,
    exitCode,
    result
  }
  writeFileSync(
    join(reports, `${request.requestId}.runtime.json`),
    JSON.stringify(evidence, null, 2),
    { flag: 'wx' }
  )
  return evidence
}
