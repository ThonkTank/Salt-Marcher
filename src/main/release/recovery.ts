import { app } from 'electron'
import { currentProgram } from './deployment.js'
import { releaseRoot } from './paths.js'
import { adoptLegacyReleaseMaintenance } from './legacy-maintenance.js'
import { MaintenanceCoordinator } from '../../shared/maintenance/coordinator.js'
import { sha256 } from '../../shared/maintenance/files.js'
import type { MaintenanceProgram } from '../../shared/contracts/maintenance.js'

function matchesRuntime(program: MaintenanceProgram): boolean {
  if (program.version !== app.getVersion()) return false
  if (!app.isPackaged) return true
  const executable = process.env['APPIMAGE']
  return Boolean(executable && sha256(executable) === program.sha256)
}

export function recoverRelease(): 'normal' | 'verify' | 'relaunch' {
  const root = releaseRoot()
  adoptLegacyReleaseMaintenance(root)
  const coordinator = new MaintenanceCoordinator(root)
  const state = coordinator.read()
  if (state && !['committed', 'rolled-back'].includes(state.phase)) {
    if (
      state.phase === 'awaiting-start' &&
      process.argv.includes('--release-complete') &&
      process.argv.at(-1) === state.id &&
      matchesRuntime(state.next)
    )
      return 'verify'
    coordinator.rollback()
    if (state.previous) return 'relaunch'
  }
  const current = currentProgram(root)
  return current && !matchesRuntime(current) ? 'relaunch' : 'normal'
}

/** Caller awaited target core readiness and has not exposed user actions. */
export function completeRelease(): void {
  const coordinator = new MaintenanceCoordinator(releaseRoot())
  const state = coordinator.read()
  if (!state || state.phase === 'committed') return
  if (
    !process.argv.includes('--release-complete') ||
    process.argv.at(-1) !== state.id ||
    !matchesRuntime(state.next)
  )
    throw new Error(
      'Die Startprüfung gehört nicht zur vorgesehenen Programmversion.'
    )
  coordinator.commit(state.id)
}

export function rollbackRelease(): void {
  const root = releaseRoot()
  adoptLegacyReleaseMaintenance(root)
  new MaintenanceCoordinator(root).rollback()
}
