import { join, dirname } from 'node:path'
import { durableJson } from '../../../src/shared/maintenance/files.js'
import Database from 'better-sqlite3'
import { databaseSchemaVersions } from '@historical/schema-owner'
import {
  historicalRequestSchema,
  historicalResponseSchema,
  historicalInterruptionSchema
} from './contract.js'
import {
  advanceHistoricalProfile,
  finishCombatAndTravelHistoricalProfile,
  migrateHistoricalProfile,
  readHistoricalProfile,
  seedHistoricalProfile
} from '@qualification/profile'

process.parentPort?.on('message', (event) => {
  const request = historicalRequestSchema.parse(event.data)
  try {
    const result =
      request.operation === 'identity'
        ? identity()
        : request.operation === 'seed'
          ? seedHistoricalProfile(request.profile)
          : request.operation === 'read'
            ? readHistoricalProfile(request.profile)
            : request.operation === 'advance-combat'
              ? advanceHistoricalProfile(request.profile, false)
              : request.operation === 'finish-combat-and-travel'
                ? finishCombatAndTravelHistoricalProfile(request.profile)
                : request.operation === 'advance'
                  ? advanceHistoricalProfile(request.profile)
                  : migrateHistoricalProfile(
                      request.profile,
                      request.operation === 'migrate-kill'
                        ? (boundary) => {
                            const interruption =
                              historicalInterruptionSchema.parse({
                                requestId: request.requestId,
                                pid: process.pid,
                                signal: 'SIGKILL',
                                boundary
                              })
                            durableJson(
                              join(
                                dirname(request.profile),
                                `migration-interruption-${request.requestId}.json`
                              ),
                              interruption
                            )
                            process.kill(process.pid, 'SIGKILL')
                            throw new Error(
                              'SIGKILL did not terminate migration worker'
                            )
                          }
                        : undefined
                    )
    process.parentPort?.postMessage(
      historicalResponseSchema.parse({
        ok: true,
        requestId: request.requestId,
        result
      })
    )
  } catch (error) {
    process.parentPort?.postMessage(
      historicalResponseSchema.parse({
        ok: false,
        requestId: request.requestId,
        message:
          error instanceof Error ? error.message : 'Historical operation failed'
      })
    )
  }
})

function identity() {
  const database = new Database(':memory:')
  try {
    const sqliteVersion = database
      .prepare('SELECT sqlite_version()')
      .pluck()
      .get()
    return {
      schemaVersions: databaseSchemaVersions,
      sqliteVersion,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron
    }
  } finally {
    database.close()
  }
}
