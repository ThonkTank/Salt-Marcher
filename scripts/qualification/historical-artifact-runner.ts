import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { acquireProfileAccess } from '../../src/main/local-profile/profile-access.js'
import {
  directoryInventory,
  inventory,
  sha256
} from '../../src/shared/maintenance/files.js'
import { releaseVersionSchema } from '../../src/shared/contracts/release.js'
import { historicalSourceSchema } from './historical-release-sources.js'
import {
  historicalOperationSchema,
  historicalResponseSchema
} from './historical-runtime/contract.js'

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/)
const artifactSchema = z.object({
  formatVersion: z.literal(1),
  evidence: z.literal('historical-test-artifact-not-public-release'),
  source: historicalSourceSchema.extend({
    formatVersion: z.literal(1),
    evidence: z.literal('source-inspection-only'),
    tree: z.string().regex(/^[a-f0-9]{40}$/),
    packageVersion: z.string().min(1),
    packageManager: z.string().min(1),
    files: z.array(
      z.object({ path: z.string(), sha256: digestSchema }).strict()
    )
  }),
  version: releaseVersionSchema,
  artifact: z
    .object({
      name: z.string().regex(/^SaltMarcher-[0-9.]+-x64\.AppImage$/),
      bytes: z.number().int().positive(),
      sha256: digestSchema
    })
    .strict()
})

export function readHistoricalArtifact(directory: string) {
  const manifest = readFileSync(join(directory, 'historical-artifact.json'))
  const receiptSha256 = createHash('sha256').update(manifest).digest('hex')
  const receipt = artifactSchema.parse(JSON.parse(manifest.toString('utf8')))
  if (receipt.artifact.name !== `SaltMarcher-${receipt.version}-x64.AppImage`)
    throw new Error('Historical artifact filename and version disagree')
  const executable = resolve(directory, receipt.artifact.name)
  if (
    statSync(executable).size !== receipt.artifact.bytes ||
    sha256(executable) !== receipt.artifact.sha256
  )
    throw new Error('Historical artifact bytes do not match their receipt')
  return { receipt, executable, receiptSha256 }
}

export async function runHistoricalArtifact(
  directory: string,
  dataHome: string,
  rawOperation: z.infer<typeof historicalOperationSchema>
) {
  if (process.platform !== 'linux')
    throw new Error('Historical AppImage runner requires Linux')
  const operation = historicalOperationSchema.parse(rawOperation)
  const { receipt, executable, receiptSha256 } =
    readHistoricalArtifact(directory)
  const requestId = randomUUID()
  const root = resolve(dataHome)
  const reports = join(root, 'historical-qualification')
  mkdirSync(reports, { recursive: true })
  const temporary = join(reports, `${requestId}.tmp`)
  mkdirSync(temporary, { mode: 0o700 })
  const log = openSync(join(reports, `${requestId}.log`), 'wx')
  let exitCode: number | null
  try {
    exitCode = await new Promise<number | null>((resolveExit, reject) => {
      const environment: NodeJS.ProcessEnv = {
        ...process.env,
        XDG_DATA_HOME: root,
        TMPDIR: temporary,
        APPIMAGE_EXTRACT_AND_RUN: '1',
        SALT_MARCHER_HISTORICAL_QUALIFICATION: 'true',
        SALT_MARCHER_HISTORICAL_REQUEST_ID: requestId
      }
      delete environment['ELECTRON_RUN_AS_NODE']
      const child = spawn(
        executable,
        ['--historical-qualification', operation],
        {
          env: environment,
          detached: true,
          stdio: ['ignore', log, log]
        }
      )
      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        if (child.pid) {
          try {
            process.kill(-child.pid, 'SIGKILL')
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH')
              reject(
                new Error('Could not terminate historical test process group', {
                  cause: error
                })
              )
          }
        }
      }, 120_000)
      child.once('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      child.once('exit', (code) => {
        clearTimeout(timeout)
        if (timedOut)
          reject(
            new Error(
              `Historical artifact request ${requestId} exceeded its test deadline`
            )
          )
        else resolveExit(code)
      })
    })
  } finally {
    closeSync(log)
  }
  const resultPath = join(reports, `${requestId}.json`)
  const result = z
    .object({
      formatVersion: z.literal(1),
      artifactVersion: releaseVersionSchema,
      operation: historicalOperationSchema,
      response: historicalResponseSchema
    })
    .strict()
    .parse(JSON.parse(readFileSync(resultPath, 'utf8')))
  if (
    result.artifactVersion !== receipt.version ||
    result.operation !== operation ||
    result.response.requestId !== requestId ||
    exitCode !== (result.response.ok ? 0 : 1)
  )
    throw new Error(
      `Historical artifact response does not prove invocation ${requestId}: exit ${exitCode}, expected ${result.response.ok ? 0 : 1}`
    )
  if (readHistoricalArtifact(directory).receiptSha256 !== receiptSha256)
    throw new Error('Historical artifact receipt changed during execution')
  const evidence = {
    formatVersion: 1,
    requestId,
    operation,
    artifactSha256: receipt.artifact.sha256,
    receiptSha256,
    sourceCommit: receipt.source.commit,
    resultSha256: sha256(resultPath),
    exitCode,
    result
  }
  writeFileSync(
    join(reports, `${requestId}.runtime.json`),
    JSON.stringify(evidence, null, 2),
    { flag: 'wx' }
  )
  return evidence
}

/** Fixture transport only; production update backup/activation is tested separately. */
export function copyHistoricalWorkingProfile(
  sourceHome: string,
  targetHome: string
) {
  const target = resolve(targetHome)
  if (existsSync(target))
    throw new Error('Historical working copy destination already exists')
  const sourceProfile = resolve(sourceHome, 'salt-marcher/profile')
  const access = acquireProfileAccess(sourceProfile, 'installer')
  try {
    const before = {
      files: inventory(access.profile),
      directories: directoryInventory(access.profile)
    }
    const parent = join(target, 'salt-marcher')
    mkdirSync(parent, { recursive: true })
    cpSync(access.profile, join(parent, 'profile'), {
      recursive: true,
      force: false,
      errorOnExist: true
    })
    const copied = {
      files: inventory(join(parent, 'profile')),
      directories: directoryInventory(join(parent, 'profile'))
    }
    const after = {
      files: inventory(access.profile),
      directories: directoryInventory(access.profile)
    }
    if (
      JSON.stringify(before) !== JSON.stringify(after) ||
      JSON.stringify(before) !== JSON.stringify(copied)
    )
      throw new Error('Historical profile copy changed content')
    writeFileSync(
      join(parent, 'historical-working-copy.json'),
      JSON.stringify({
        formatVersion: 1,
        sourceProfile: access.profile,
        inventory: before
      }),
      { flag: 'wx' }
    )
  } finally {
    access.release()
  }
}
