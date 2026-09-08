import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readlinkSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { sha256 } from '../../shared/maintenance/files.js'
import { MaintenanceCoordinator } from '../../shared/maintenance/coordinator.js'
import { acquireProfileLock } from '../local-profile/local-profile-lock.js'

/** No SQLite or normal app bootstrap may run before this admission gate. */
export function admitDesktopStart(root: string): string {
  const lock = acquireProfileLock(join(root, 'runtime.lock'), 'installer')
  try {
    const coordinator = new MaintenanceCoordinator(root)
    coordinator.rollback()
    const state = coordinator.read()
    if (!state)
      throw new Error('Der Wartungsbeleg fehlt. Bitte Installation prüfen.')
    const expected = state.phase === 'committed' ? state.next : state.previous
    if (!expected)
      throw new Error(
        'Keine bestätigte Installation vorhanden. Bitte Installation erneut ausführen.'
      )
    const current = join(root, 'current')
    if (!lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink())
      throw new Error(
        'Keine bestätigte Installation vorhanden. Bitte Installation erneut ausführen.'
      )
    const deployment = resolve(root, readlinkSync(current))
    if (deployment !== join(root, 'deployments', basename(deployment)))
      throw new Error(
        'Der Programmstartpunkt liegt außerhalb der Installation.'
      )
    const executable = join(deployment, 'SaltMarcher.AppImage')
    if (!existsSync(executable))
      throw new Error(
        'Die installierte Programmdatei fehlt. Bitte Installation prüfen.'
      )
    if (
      basename(deployment) !== expected.deployment ||
      sha256(executable) !== expected.sha256
    )
      throw new Error(
        'Die installierte Programmversion stimmt nicht mit dem Wartungsbeleg überein.'
      )
    return executable
  } finally {
    lock.release()
  }
}

export function launchDesktop(
  root: string,
  arguments_: readonly string[]
): number {
  const executable = admitDesktopStart(root)
  const environment = { ...process.env }
  for (const key of ['ELECTRON_RUN_AS_NODE', 'APPIMAGE', 'APPDIR', 'OWD'])
    delete environment[key]
  const result = spawnSync(
    executable,
    [`--user-data-dir=${join(root, 'profile')}`, ...arguments_],
    {
      stdio: 'inherit',
      env: environment
    }
  )
  if (result.error)
    throw new Error(
      'Das installierte Programm konnte nicht gestartet werden.',
      { cause: result.error }
    )
  // Never interpret a later runtime failure as permission to roll back user work.
  return result.status ?? 1
}
