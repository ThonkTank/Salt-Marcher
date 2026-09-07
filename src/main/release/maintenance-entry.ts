import { app } from 'electron'
import { existsSync, readFileSync, rmSync } from 'node:fs'
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
    operation: z.enum(['prepare', 'activate', 'commit', 'rollback', 'restore']),
    source: z.string().optional(),
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
  if (token !== request.token || !existsSync(`/proc/${request.parent}`))
    throw new Error('Wartungsauftrag ist nicht mehr gültig.')
  const lock = JSON.parse(readFileSync(join(root, 'runtime.lock'), 'utf8')) as {
    pid?: number
  }
  if (lock.pid !== request.parent)
    throw new Error('Die Profilsperre gehört nicht zur Wartung.')
  try {
    await maintenanceWorker({
      root,
      version: request.sourceVersion,
      operation: request.operation,
      ...(request.source ? { source: request.source } : {}),
      ...(request.id ? { id: request.id } : {})
    })
    durableJson(join(root, `maintenance-result-${request.token}.json`), {
      ok: true
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
