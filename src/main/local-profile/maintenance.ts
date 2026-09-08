import { app } from 'electron'
import { MaintenanceCoordinator } from '../../shared/maintenance/coordinator.js'
import { currentLocalProgram } from '../../shared/maintenance/local-program.js'
import { sha256 } from '../../shared/maintenance/files.js'
import type { MaintenanceProgram } from '../../shared/contracts/maintenance.js'

function matchesRuntime(program: MaintenanceProgram, commit: string): boolean {
  if (program.version !== commit) return false
  if (!app.isPackaged) return true
  const executable = process.env['APPIMAGE']
  return Boolean(executable && sha256(executable) === program.sha256)
}
function completionToken(): string | undefined {
  return process.argv.includes('--maintenance-complete')
    ? process.argv.at(-1)
    : undefined
}

/** Profile lock is held; no core data connection has been opened. */
export function recoverLocalMaintenance(
  root: string,
  commit: string
): 'normal' | 'verify' | 'relaunch' {
  const coordinator = new MaintenanceCoordinator(root)
  const recovery = coordinator.recoverForStart(completionToken(), (program) =>
    matchesRuntime(program, commit)
  )
  if (recovery === 'uninstalled')
    throw new Error(
      'Die unbestätigte Erstinstallation wurde zurückgesetzt. Bitte den Local-Handoff erneut ausführen.'
    )
  if (recovery !== 'normal') return recovery
  const current = currentLocalProgram(root)
  return current && !matchesRuntime(current, commit) ? 'relaunch' : 'normal'
}

/** The target core is ready, but normal user actions are still disabled. */
export function completeLocalMaintenance(root: string, commit: string): void {
  const coordinator = new MaintenanceCoordinator(root)
  coordinator.completeStart(completionToken(), (program) =>
    matchesRuntime(program, commit)
  )
}
export function rollbackLocalMaintenance(root: string): void {
  new MaintenanceCoordinator(root).rollback()
}
