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
  const token = process.argv.includes('--release-complete')
    ? process.argv.at(-1)
    : undefined
  const recovery = coordinator.recoverForStart(token, matchesRuntime)
  if (recovery === 'verify' || recovery === 'relaunch') return recovery
  const current = currentProgram(root)
  return current && !matchesRuntime(current) ? 'relaunch' : 'normal'
}

/** Caller awaited target core readiness and has not exposed user actions. */
export function completeRelease(): void {
  const coordinator = new MaintenanceCoordinator(releaseRoot())
  const token = process.argv.includes('--release-complete')
    ? process.argv.at(-1)
    : undefined
  coordinator.completeStart(token, matchesRuntime)
}

export function rollbackRelease(): void {
  const root = releaseRoot()
  adoptLegacyReleaseMaintenance(root)
  new MaintenanceCoordinator(root).rollback()
}
