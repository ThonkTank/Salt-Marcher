import './publication-interruption.js'
import { historicalUiFeed, historicalUiFetch } from './ui-feed.js'
import { app, utilityProcess } from 'electron'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { acquireProfileAccess } from '../../../src/main/local-profile/profile-access.js'
import {
  historicalOperationSchema,
  historicalRequestSchema,
  historicalResponseSchema,
  historicalInterruptionSchema
} from './contract.js'

const operationIndex = process.argv.indexOf('--historical-qualification')
const identityOnly = process.argv.includes(
  '--historical-qualification-identity'
)
if (operationIndex === -1 && !identityOnly) {
  const feed = historicalUiFeed(process.env)
  if (feed) {
    globalThis.fetch = historicalUiFetch(feed, globalThis.fetch)
    app.commandLine.appendSwitch('remote-debugging-port', '0')
  }
  void import(pathToFileURL(join(__dirname, '../main/index.js')).href)
} else {
  const root = process.env['XDG_DATA_HOME']
  if (
    process.env['SALT_MARCHER_HISTORICAL_QUALIFICATION'] !== 'true' ||
    !root ||
    !isAbsolute(root)
  )
    throw new Error(
      'Historical qualification requires explicit isolated XDG storage'
    )
  const directory = join(root, 'historical-qualification')
  const operation = historicalOperationSchema.parse(
    identityOnly ? 'identity' : process.argv[operationIndex + 1]
  )
  const requestId =
    process.env['SALT_MARCHER_HISTORICAL_REQUEST_ID'] ?? randomUUID()
  const request = historicalRequestSchema.parse({
    requestId,
    operation,
    profile: join(root, 'salt-marcher', 'profile')
  })
  mkdirSync(directory, { recursive: true })
  app.setPath('userData', join(directory, 'electron'))
  void app.whenReady().then(() => {
    const access = acquireProfileAccess(request.profile, 'application')
    const worker = utilityProcess.fork(join(__dirname, 'worker.cjs'), [], {
      serviceName: 'SaltMarcher historical qualification'
    })
    let exitCode = 1
    let workerPid: number | undefined
    let receivedResponse = false
    worker.once('spawn', () => {
      workerPid = worker.pid
      worker.postMessage(request)
    })
    worker.once('message', (raw: unknown) => {
      receivedResponse = true
      const response = historicalResponseSchema.parse(raw)
      if (response.requestId !== requestId)
        throw new Error('Historical response identity mismatch')
      writeFileSync(
        join(directory, `${requestId}.json`),
        JSON.stringify({
          formatVersion: 1,
          artifactVersion: app.getVersion(),
          operation,
          response
        }),
        { flag: 'wx' }
      )
      exitCode = response.ok ? 0 : 1
      worker.kill()
    })
    worker.once('exit', (workerExitCode) => {
      try {
        if (
          operation === 'migrate-kill' &&
          !receivedResponse &&
          workerExitCode !== 0
        ) {
          const interruption = historicalInterruptionSchema.parse(
            JSON.parse(
              readFileSync(
                join(
                  root,
                  'salt-marcher',
                  `migration-interruption-${requestId}.json`
                ),
                'utf8'
              )
            )
          )
          if (
            interruption.requestId !== requestId ||
            interruption.pid !== workerPid
          )
            throw new Error('Migration interruption identity mismatch')
          writeFileSync(
            join(directory, `${requestId}.interruption.json`),
            JSON.stringify({
              ...interruption,
              workerExitCode
            }),
            { flag: 'wx' }
          )
          writeFileSync(
            join(directory, `${requestId}.json`),
            JSON.stringify({
              formatVersion: 1,
              artifactVersion: app.getVersion(),
              operation,
              response: {
                ok: false,
                requestId,
                message: 'Historical migration worker interrupted'
              }
            }),
            { flag: 'wx' }
          )
        }
      } finally {
        access.release()
        app.exit(exitCode)
      }
    })
  })
}
