import { assertProfileAccessOwner } from '../local-profile/profile-access.js'
import { app } from 'electron'
import { maintenanceWorkerRequestSchema } from '../../shared/contracts/maintenance.js'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { maintenanceWorker } from './maintenance-worker.js'
import { releaseRoot } from './paths.js'
import { durableJson } from '../../shared/maintenance/files.js'
export const maintenanceRequestSchema = z
  .object({
    token: z.uuid(),
    parent: z.number().int().positive(),
    sourceVersion: z.string(),
    operation: z.enum(['prepare', 'restore', 'import-backup']),
    transactionId: z.uuid(),
    source: z.string().optional(),
    backupDirectory: z.string().optional(),
    id: z.string().optional()
  })
  .strict()
export async function runMaintenanceEntry(): Promise<void> {
  await app.whenReady()
  const root = releaseRoot()
  const request = maintenanceRequestSchema.parse(
    JSON.parse(readFileSync(join(root, 'maintenance-request.json'), 'utf8'))
  )
  const token = process.argv.at(-1)
  if (token !== request.token)
    throw new Error('Wartungsauftrag ist nicht mehr gültig.')
  assertProfileAccessOwner(join(root, 'profile'), request.parent, root)
  try {
    const result = await maintenanceWorker(
      maintenanceWorkerRequestSchema.parse({
        root,
        version: request.sourceVersion,
        operation: request.operation,
        transactionId: request.transactionId,
        ...(request.backupDirectory
          ? { backupDirectory: request.backupDirectory }
          : {}),
        ...(request.source ? { source: request.source } : {}),
        ...(request.id ? { id: request.id } : {})
      })
    )
    durableJson(join(root, `maintenance-result-${request.token}.json`), {
      ok: true,
      result
    })
  } catch (error) {
    durableJson(join(root, `maintenance-result-${request.token}.json`), {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Wartung fehlgeschlagen.'
    })
  } finally {
    rmSync(join(root, 'maintenance-request.json'), { force: true })
    app.quit()
  }
}
