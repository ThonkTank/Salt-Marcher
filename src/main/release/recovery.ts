import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { durableJson } from '../../shared/maintenance/files.js'
import { readActivation, setCurrent } from './deployment.js'
import { maintenanceWorker } from './maintenance-worker.js'
import { releaseRoot } from './paths.js'
export async function recoverRelease(): Promise<
  'normal' | 'verify' | 'relaunch'
> {
  const root = releaseRoot()
  const state = readActivation(root)
  const journal = existsSync(join(root, 'maintenance-journal.json'))
    ? (JSON.parse(
        readFileSync(join(root, 'maintenance-journal.json'), 'utf8')
      ) as { phase?: string })
    : null
  if (!state || state.phase !== 'pending') {
    if (journal && !['committed', 'rolled-back'].includes(journal.phase ?? ''))
      await maintenanceWorker({
        root,
        version: app.getVersion(),
        operation: 'rollback'
      })
    const currentManifest = join(root, 'current', 'manifest.json')
    if (existsSync(currentManifest)) {
      const current = JSON.parse(readFileSync(currentManifest, 'utf8')) as {
        version: string
      }
      if (current.version !== app.getVersion()) return 'relaunch'
    }
    return 'normal'
  }
  if (journal?.phase === 'committed') {
    setCurrent(root, state.next)
    durableJson(join(root, 'activation.json'), { ...state, phase: 'committed' })
    const manifest = JSON.parse(
      readFileSync(join(root, 'current', 'manifest.json'), 'utf8')
    ) as { version: string }
    return manifest.version === app.getVersion() ? 'normal' : 'relaunch'
  }
  if (
    process.argv.includes('--release-complete') &&
    process.argv.at(-1) === state.id
  )
    return 'verify'
  await rollbackRelease()
  return state.previous ? 'relaunch' : 'normal'
}
export async function completeRelease(): Promise<void> {
  const root = releaseRoot()
  const state = readActivation(root)
  if (!state || state.phase !== 'pending') return
  await maintenanceWorker({
    root,
    version: app.getVersion(),
    operation: 'commit'
  })
  durableJson(join(root, 'activation.json'), { ...state, phase: 'committed' })
}
export async function rollbackRelease(): Promise<void> {
  const root = releaseRoot()
  const state = readActivation(root)
  await maintenanceWorker({
    root,
    version: app.getVersion(),
    operation: 'rollback'
  })
  if (!state || state.phase !== 'pending') return
  if (state.previous) setCurrent(root, state.previous)
  durableJson(join(root, 'activation.json'), { ...state, phase: 'rolled-back' })
}
